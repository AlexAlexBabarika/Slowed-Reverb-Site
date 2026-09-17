import json
import math
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import ffmpeg
import yt_dlp
from django.conf import settings


class IngestError(Exception):
    """Raised when decoding, transcoding, probing, or downloading fails."""

    def __init__(self, detail: str, public_message: str | None = None):
        super().__init__(detail)
        self.public_message = public_message or detail


def transcode_to_compressed(in_path: str, out_path: str) -> None:
    """Transcode any input audio to the configured compressed codec.

    Raises IngestError on ffmpeg failure or empty output.
    """
    try:
        command = (
            ffmpeg.input(in_path, protocol_whitelist="file,pipe")
            .output(
                out_path,
                acodec=settings.AUDIO_CODEC,
                audio_bitrate=settings.AUDIO_BITRATE,
                ac=2,
                vn=None,  # drop any video/cover stream
                loglevel="error",
            )
            .overwrite_output()
            .compile()
        )
        subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=settings.AUDIO_TRANSCODE_TIMEOUT_SECONDS,
            check=True,
        )
    except subprocess.TimeoutExpired as exc:
        raise IngestError(
            "transcode timed out",
            "Audio processing took too long. Try a smaller audio file.",
        ) from exc
    except (OSError, subprocess.CalledProcessError) as exc:
        raise IngestError(
            f"transcode failed: {exc}",
            "Could not process this audio file. "
            "Choose a valid audio file and try again.",
        ) from exc

    if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
        raise IngestError(
            "transcode produced no output",
            "Audio processing produced an empty file. "
            "Choose another source and try again.",
        )


def probe_audio(path: str) -> dict:
    """Return {'duration': float, 'artist': str, 'title': str} via ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-protocol_whitelist",
                "file,pipe",
                "-show_format",
                "-show_streams",
                "-of",
                "json",
                path,
            ],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            timeout=settings.AUDIO_PROBE_TIMEOUT_SECONDS,
            check=True,
        )
        info = json.loads(result.stdout)
    except subprocess.TimeoutExpired as exc:
        raise IngestError(
            "probe timed out",
            "Reading this audio took too long. Try another file.",
        ) from exc
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        raise IngestError(
            f"probe failed: {exc}",
            "That file does not contain readable audio. "
            "Choose another file and try again.",
        ) from exc

    fmt = info.get("format", {})
    tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}

    try:
        duration = float(fmt.get("duration", 0.0))
    except (TypeError, ValueError):
        duration = 0.0

    if not any(
        stream.get("codec_type") == "audio" for stream in info.get("streams", [])
    ):
        raise IngestError("This file has no audio track. Choose an audio file.")
    if not math.isfinite(duration) or duration <= 0:
        raise IngestError(
            "Could not determine the audio duration. Choose another file."
        )

    return {
        "duration": duration,
        "artist": tags.get("artist", ""),
        "title": tags.get("title", ""),
    }


def validate_audio_duration(duration: float, tolerance: float = 0) -> None:
    if duration > settings.MAX_AUDIO_DURATION_SECONDS + tolerance:
        minutes = settings.MAX_AUDIO_DURATION_SECONDS / 60
        raise IngestError(f"This audio exceeds the {minutes:g}-minute import limit.")


def _check_download_size(progress: dict) -> None:
    if progress.get("downloaded_bytes", 0) > settings.MAX_AUDIO_UPLOAD_BYTES:
        limit = settings.MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024)
        raise IngestError(f"This download exceeds the {limit:g} MiB import limit.")


def _validate_youtube_url(url: str) -> None:
    try:
        parsed = urlparse(url)
        port = parsed.port
    except ValueError as exc:
        raise IngestError("Enter a valid HTTPS YouTube URL.") from exc
    allowed_hosts = {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
        "youtu.be",
        "www.youtu.be",
    }
    if (
        parsed.scheme != "https"
        or parsed.hostname not in allowed_hosts
        or port not in (None, 443)
        or parsed.username
        or parsed.password
    ):
        raise IngestError(
            f"unsupported YouTube URL: {url}",
            "Enter a complete HTTPS URL from youtube.com or youtu.be.",
        )
    path = parsed.path.strip("/").split("/")
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        is_video = len(path) == 1 and bool(path[0])
    else:
        is_video = (
            parsed.path == "/watch" and bool(parse_qs(parsed.query).get("v"))
        ) or (
            len(path) == 2 and path[0] in {"shorts", "embed", "live"} and bool(path[1])
        )
    if not is_video:
        raise IngestError("Enter a link to a single YouTube video.")


def _duration_filter(info: dict, *, incomplete: bool) -> str | None:
    if info.get("is_live"):
        raise IngestError("Live streams cannot be imported. Choose a completed video.")
    duration = info.get("duration")
    if duration is None:
        return None
    if float(duration) > settings.MAX_AUDIO_DURATION_SECONDS:
        minutes = settings.MAX_AUDIO_DURATION_SECONDS // 60
        raise IngestError(f"This video is longer than the {minutes}-minute limit.")
    return None


def _youtube_failure_message(detail: str, cookies_configured: bool) -> str:
    lower = detail.lower()
    if any(term in lower for term in ("sign in", "login", "cookie", "age-restricted")):
        if cookies_configured:
            return (
                "YouTube rejected the configured cookies. Export a fresh cookies.txt "
                "file from a private YouTube session and restart the app."
            )
        return (
            "YouTube requires authentication for this video. Configure "
            "YTDLP_COOKIES_FILE with an exported cookies.txt file and restart the app."
        )
    if any(term in lower for term in ("javascript runtime", "challenge", "ejs")):
        return (
            "YouTube challenge solving is unavailable. Run `uv sync` to install "
            "the bundled yt-dlp JavaScript runtime, then restart the app."
        )
    if any(term in lower for term in ("429", "too many requests", "rate limit")):
        return "YouTube is limiting requests. Wait a few minutes before trying again."
    if any(term in lower for term in ("private video", "unavailable", "removed")):
        return "This YouTube video is unavailable. Choose another link."
    return (
        "YouTube could not provide audio for this link. "
        "Check your connection, wait a moment, and try again."
    )


def download_youtube(url: str, dest_base: str) -> tuple[str, dict[str, str]]:
    """Download best audio for `url` to `<dest_base>.<ext>`.

    Returns (downloaded_path, {"title": str, "artist": str}).
    Raises IngestError on failure. Browser profiles are never read automatically.
    """
    _validate_youtube_url(url)
    cookie_file = settings.YTDLP_COOKIES_FILE
    if cookie_file and not os.path.isfile(cookie_file):
        raise IngestError(
            "configured YTDLP_COOKIES_FILE does not exist",
            "The configured YouTube cookies file cannot be read. Fix "
            "YTDLP_COOKIES_FILE and restart the app.",
        )

    ydl_opts: dict[str, object] = {
        "format": "bestaudio/best",
        "quiet": True,
        "noprogress": True,
        "noplaylist": True,
        "socket_timeout": 20,
        "retries": 2,
        "extractor_retries": 2,
        "fragment_retries": 2,
        "match_filter": _duration_filter,
        "max_filesize": settings.MAX_AUDIO_UPLOAD_BYTES,
        "progress_hooks": [_check_download_size],
        "js_runtimes": {"deno": {}},
    }
    try:
        with tempfile.TemporaryDirectory(
            prefix="youtube-", dir=Path(dest_base).parent
        ) as staging_dir:
            ydl_opts["outtmpl"] = str(Path(staging_dir) / "audio.%(ext)s")
            if cookie_file:
                cookie_copy = Path(staging_dir) / "cookies.txt"
                try:
                    shutil.copyfile(cookie_file, cookie_copy)
                except OSError as exc:
                    raise IngestError(
                        "The configured YouTube cookies file cannot be read. "
                        "Fix YTDLP_COOKIES_FILE and restart the app."
                    ) from exc
                ydl_opts["cookiefile"] = str(cookie_copy)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                if not info:
                    raise IngestError(
                        "YouTube did not provide a video. Try another link."
                    )
                downloaded = ydl.prepare_filename(info)
            if not os.path.isfile(downloaded) or os.path.getsize(downloaded) == 0:
                raise IngestError(
                    "YouTube did not provide an audio file. Try another link."
                )
            path = f"{dest_base}{Path(downloaded).suffix}"
            os.replace(downloaded, path)
    except IngestError:
        raise
    except Exception as exc:
        detail = str(exc)
        raise IngestError(
            f"youtube download failed: {detail}",
            _youtube_failure_message(detail, bool(cookie_file)),
        ) from exc

    return path, {
        "title": info.get("title", "") or "",
        "artist": info.get("uploader", "") or "",
    }
