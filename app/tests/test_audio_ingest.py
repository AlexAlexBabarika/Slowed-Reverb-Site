import os
import shutil
import tempfile
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from app.audio_ingest import (
    IngestError,
    _duration_filter,
    _youtube_failure_message,
    download_youtube,
    probe_audio,
    transcode_to_compressed,
)
from app.tests.support import make_test_audio


class TranscodeTests(SimpleTestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def test_transcode_produces_nonempty_output(self):
        src = os.path.join(self.tmp, "src.wav")
        out = os.path.join(self.tmp, "out.ogg")
        make_test_audio(src, seconds=1.0)

        transcode_to_compressed(src, out)

        self.assertTrue(os.path.exists(out))
        self.assertGreater(os.path.getsize(out), 0)

    def test_transcode_raises_on_garbage_input(self):
        src = os.path.join(self.tmp, "garbage.wav")
        with open(src, "wb") as f:
            f.write(b"not audio")
        out = os.path.join(self.tmp, "out.ogg")

        with self.assertRaises(IngestError):
            transcode_to_compressed(src, out)

    def test_probe_returns_duration(self):
        src = os.path.join(self.tmp, "probe.wav")
        make_test_audio(src, seconds=2.0)

        meta = probe_audio(src)

        self.assertAlmostEqual(meta["duration"], 2.0, delta=0.3)
        self.assertIn("artist", meta)
        self.assertIn("title", meta)

    @override_settings(YTDLP_COOKIES_FILE="")
    def test_download_youtube_uses_bundled_runtime_and_bounded_retries(self):
        downloaded = os.path.join(self.tmp, "yt.webm")
        with open(downloaded, "wb") as output:
            output.write(b"audio")

        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            ydl = ydl_cls.return_value.__enter__.return_value
            ydl.extract_info.return_value = {
                "title": "Song",
                "uploader": "Artist",
            }
            ydl.prepare_filename.return_value = downloaded

            result = download_youtube(
                "https://youtu.be/example", os.path.join(self.tmp, "yt")
            )

        options = ydl_cls.call_args.args[0]
        self.assertEqual(options["js_runtimes"], {"deno": {}})
        self.assertEqual(options["retries"], 2)
        self.assertNotIn("cookiefile", options)
        self.assertEqual(result, (downloaded, {"title": "Song", "artist": "Artist"}))

    @override_settings(YTDLP_COOKIES_FILE="")
    def test_download_youtube_explains_authentication_failures(self):
        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            ydl_cls.return_value.__enter__.return_value.extract_info.side_effect = (
                RuntimeError("Sign in to confirm your age. Use --cookies.")
            )
            with self.assertRaises(IngestError) as raised:
                download_youtube("https://youtu.be/x", os.path.join(self.tmp, "yt"))

        self.assertIn("YTDLP_COOKIES_FILE", raised.exception.public_message)

    @override_settings(YTDLP_COOKIES_FILE="/missing/cookies.txt")
    def test_download_youtube_rejects_missing_cookie_file_before_request(self):
        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            with self.assertRaises(IngestError) as raised:
                download_youtube("https://youtu.be/x", os.path.join(self.tmp, "yt"))

        ydl_cls.assert_not_called()
        self.assertIn("cannot be read", raised.exception.public_message)

    @override_settings(YTDLP_COOKIES_FILE="")
    def test_download_youtube_rejects_non_youtube_urls(self):
        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            with self.assertRaises(IngestError) as raised:
                download_youtube(
                    "https://example.com/audio", os.path.join(self.tmp, "yt")
                )

        ydl_cls.assert_not_called()
        self.assertIn("youtube.com or youtu.be", raised.exception.public_message)

    def test_download_youtube_rejects_a_playlist_url_before_request(self):
        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            with self.assertRaisesMessage(IngestError, "single YouTube video"):
                download_youtube(
                    "https://www.youtube.com/playlist?list=example",
                    os.path.join(self.tmp, "yt"),
                )
        ydl_cls.assert_not_called()

    @override_settings(YTDLP_COOKIES_FILE="", MAX_AUDIO_DURATION_SECONDS=900)
    def test_download_youtube_rejects_long_videos_before_download(self):
        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            ydl = ydl_cls.return_value.__enter__.return_value

            def extract(_url, download):
                ydl_cls.call_args.args[0]["match_filter"](
                    {"duration": 901}, incomplete=False
                )

            ydl.extract_info.side_effect = extract
            with self.assertRaises(IngestError) as raised:
                download_youtube("https://youtu.be/x", os.path.join(self.tmp, "yt"))

        ydl.prepare_filename.assert_not_called()
        self.assertEqual(
            raised.exception.public_message,
            "This video is longer than the 15-minute limit.",
        )

    def test_live_stream_is_rejected(self):
        with self.assertRaisesMessage(IngestError, "Live streams cannot be imported"):
            _duration_filter({"is_live": True}, incomplete=True)

    def test_youtube_errors_distinguish_runtime_and_rate_limits(self):
        self.assertIn(
            "uv sync", _youtube_failure_message("JavaScript runtime missing", False)
        )
        self.assertIn(
            "Wait a few minutes",
            _youtube_failure_message("HTTP Error 429: Too Many Requests", False),
        )

    @override_settings(YTDLP_COOKIES_FILE="")
    def test_failed_download_removes_partial_files(self):
        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            ydl = ydl_cls.return_value.__enter__.return_value

            def extract(_url, download):
                template = ydl_cls.call_args.args[0]["outtmpl"]
                with open(template.replace("%(ext)s", "webm.part"), "wb") as partial:
                    partial.write(b"incomplete")
                raise RuntimeError("network connection lost")

            ydl.extract_info.side_effect = extract
            with self.assertRaises(IngestError):
                download_youtube("https://youtu.be/x", os.path.join(self.tmp, "yt"))

        self.assertEqual(os.listdir(self.tmp), [])

    def test_configured_cookie_file_is_not_modified_by_the_downloader(self):
        original = os.path.join(self.tmp, "provided-cookies.txt")
        with open(original, "w") as cookies:
            cookies.write("# Netscape HTTP Cookie File\n")

        with override_settings(YTDLP_COOKIES_FILE=original):
            with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
                ydl = ydl_cls.return_value.__enter__.return_value

                def extract(_url, download):
                    cookie_copy = ydl_cls.call_args.args[0]["cookiefile"]
                    self.assertNotEqual(cookie_copy, original)
                    with open(cookie_copy, "w") as cookies:
                        cookies.write("refreshed by downloader")
                    raise RuntimeError("download failed")

                ydl.extract_info.side_effect = extract
                with self.assertRaises(IngestError):
                    download_youtube("https://youtu.be/x", os.path.join(self.tmp, "yt"))

        with open(original) as cookies:
            self.assertEqual(cookies.read(), "# Netscape HTTP Cookie File\n")
        self.assertEqual(os.listdir(self.tmp), ["provided-cookies.txt"])
