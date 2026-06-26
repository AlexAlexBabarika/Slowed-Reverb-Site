import os
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from app.tests.support import make_test_audio


class AudioServingTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.override = override_settings(PROCESSING_DIR=self.tmp)
        self.override.enable()
        self.addCleanup(self.override.disable)

    def _upload(self):
        src = os.path.join(self.tmp, "u.wav")
        make_test_audio(src, seconds=1.0)
        with open(src, "rb") as f:
            data = f.read()
        upload = SimpleUploadedFile("song.wav", data, content_type="audio/wav")
        return self.client.post("/api/tracks", {"audio_file": upload}).json()["id"]

    def test_serves_full_audio(self):
        track_id = self._upload()
        resp = self.client.get(f"/api/tracks/{track_id}/audio")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "audio/ogg")
        self.assertEqual(resp["Accept-Ranges"], "bytes")

    def test_serves_partial_audio_on_range(self):
        track_id = self._upload()
        resp = self.client.get(f"/api/tracks/{track_id}/audio", HTTP_RANGE="bytes=0-9")
        self.assertEqual(resp.status_code, 206)
        self.assertEqual(resp["Content-Length"], "10")

    def test_unknown_track_returns_404(self):
        resp = self.client.get("/api/tracks/00000000-0000-0000-0000-000000000000/audio")
        self.assertEqual(resp.status_code, 404)
