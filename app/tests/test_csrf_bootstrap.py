import os
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

from app.tests.support import make_test_audio


class CsrfBootstrapTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.override = override_settings(PROCESSING_DIR=self.tmp)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.client = Client(enforce_csrf_checks=True)

    def test_bootstrap_allows_import_and_delete_and_restores_session_tracks(self):
        self.assertEqual(self.client.post("/api/tracks", {}).status_code, 403)
        self.assertEqual(self.client.post("/api/tracks/youtube", {}).status_code, 403)

        response = self.client.get("/api/tracks")
        self.assertEqual(response.json(), {"tracks": []})
        token = response.cookies["csrftoken"].value
        source = os.path.join(self.tmp, "source.wav")
        make_test_audio(source, seconds=0.2)
        with open(source, "rb") as audio:
            upload = SimpleUploadedFile(
                "song.wav", audio.read(), content_type="audio/wav"
            )
        response = self.client.post(
            "/api/tracks", {"audio_file": upload}, HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, 200)
        track = response.json()
        self.assertEqual(self.client.get("/api/tracks").json()["tracks"], [track])
        youtube = self.client.post(
            "/api/tracks/youtube",
            "{}",
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(youtube.status_code, 400)
        self.assertEqual(youtube.json(), {"error": "no url provided"})

        url = f"/api/tracks/{track['id']}"
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertEqual(
            self.client.delete(url, HTTP_X_CSRFTOKEN=token).status_code, 200
        )
        self.assertEqual(self.client.get("/api/tracks").json()["tracks"], [])
