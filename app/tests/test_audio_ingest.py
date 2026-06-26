import os
import shutil
import tempfile
from unittest.mock import patch

from django.test import SimpleTestCase

from app.audio_ingest import (
    IngestError,
    transcode_to_compressed,
    probe_audio,
    download_youtube,
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

    def test_download_youtube_wraps_failures(self):
        with patch("app.audio_ingest.yt_dlp.YoutubeDL") as ydl_cls:
            ydl_cls.return_value.__enter__.return_value.extract_info.side_effect = (
                RuntimeError("boom")
            )
            with self.assertRaises(IngestError):
                download_youtube("https://youtu.be/x", os.path.join(self.tmp, "yt"))
