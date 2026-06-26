import os

import ffmpeg
import yt_dlp
from django.conf import settings


class IngestError(Exception):
    """Raised when decoding, transcoding, probing, or downloading fails."""


def transcode_to_compressed(in_path: str, out_path: str) -> None:
    """Transcode any input audio to the configured compressed codec.

    Raises IngestError on ffmpeg failure or empty output.
    """
    try:
        (
            ffmpeg.input(in_path)
            .output(
                out_path,
                acodec=settings.AUDIO_CODEC,
                audio_bitrate=settings.AUDIO_BITRATE,
                ac=2,
                vn=None,  # drop any video/cover stream
                loglevel="error",
            )
            .overwrite_output()
            .run()
        )
    except ffmpeg.Error as exc:
        raise IngestError(f"transcode failed: {exc}") from exc

    if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
        raise IngestError("transcode produced no output")


def probe_audio(path: str) -> dict:
    """Return {'duration': float, 'artist': str, 'title': str} via ffprobe."""
    try:
        info = ffmpeg.probe(path)
    except ffmpeg.Error as exc:
        raise IngestError(f"probe failed: {exc}") from exc

    fmt = info.get("format", {})
    tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}

    try:
        duration = float(fmt.get("duration", 0.0))
    except (TypeError, ValueError):
        duration = 0.0

    return {
        "duration": duration,
        "artist": tags.get("artist", ""),
        "title": tags.get("title", ""),
    }


def download_youtube(url: str, dest_base: str) -> tuple:
    """Download best audio for `url` to `<dest_base>.<ext>`.

    Returns (downloaded_path, {"title": str, "artist": str}).
    Raises IngestError on failure. No browser-cookie usage (see docs/02).
    """
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": f"{dest_base}.%(ext)s",
        "quiet": True,
        "noplaylist": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            path = ydl.prepare_filename(info)
    except Exception as exc:  # yt-dlp raises many error types
        raise IngestError(f"youtube download failed: {exc}") from exc

    if not path or not os.path.exists(path):
        raise IngestError("youtube download produced no file")

    return path, {
        "title": info.get("title", "") or "",
        "artist": info.get("uploader", "") or "",
    }
