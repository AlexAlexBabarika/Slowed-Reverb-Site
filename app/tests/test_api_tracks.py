import json
import os
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from app.tests.support import make_test_audio


class TracksApiTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.override = override_settings(PROCESSING_DIR=self.tmp)
        self.override.enable()
        self.addCleanup(self.override.disable)

    def _upload(self, name="song.wav", seconds=1.0):
        src = os.path.join(self.tmp, "u.wav")
        make_test_audio(src, seconds=seconds)
        with open(src, "rb") as f:
            data = f.read()
        upload = SimpleUploadedFile(name, data, content_type="audio/wav")
        return self.client.post("/api/tracks", {"audio_file": upload})

    def test_upload_returns_track_json_and_writes_file(self):
        resp = self._upload()
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn("id", body)
        self.assertEqual(body["filename"], "song.wav")
        self.assertEqual(body["url"], f"/api/tracks/{body['id']}/audio")
        self.assertGreater(body["duration"], 0)
        self.assertTrue(os.path.exists(os.path.join(self.tmp, f"{body['id']}.ogg")))

    def test_upload_rejects_unsupported_extension(self):
        upload = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
        resp = self.client.post("/api/tracks", {"audio_file": upload})
        self.assertEqual(resp.status_code, 400)

    def test_upload_rejects_missing_file(self):
        resp = self.client.post("/api/tracks", {})
        self.assertEqual(resp.status_code, 400)

    def test_list_returns_uploaded_tracks(self):
        self._upload()
        resp = self.client.get("/api/tracks")
        self.assertEqual(resp.status_code, 200)
        tracks = resp.json()["tracks"]
        self.assertEqual(len(tracks), 1)
        self.assertTrue(tracks[0]["url"].endswith("/audio"))

    def test_delete_removes_track_and_file(self):
        track_id = self._upload().json()["id"]
        audio_path = os.path.join(self.tmp, f"{track_id}.ogg")
        self.assertTrue(os.path.exists(audio_path))

        resp = self.client.delete(f"/api/tracks/{track_id}")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(os.path.exists(audio_path))
        self.assertEqual(self.client.get("/api/tracks").json()["tracks"], [])

    def test_delete_missing_returns_404(self):
        resp = self.client.delete("/api/tracks/00000000-0000-0000-0000-000000000000")
        self.assertEqual(resp.status_code, 404)

    def test_get_tracks_sets_csrf_cookie(self):
        response = self.client.get("/api/tracks")
        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)
