import json
import os
import shutil
import tempfile
from unittest.mock import patch

from django.test import TestCase, override_settings

from app.tests.support import make_test_audio


class YoutubeApiTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.override = override_settings(PROCESSING_DIR=self.tmp)
        self.override.enable()
        self.addCleanup(self.override.disable)

    def _post(self, payload):
        return self.client.post(
            "/api/tracks/youtube",
            data=json.dumps(payload),
            content_type="application/json",
        )

    @patch("app.api.download_youtube")
    def test_youtube_ingest_adds_track(self, mock_dl):
        src = os.path.join(self.tmp, "yt_src.wav")
        make_test_audio(src, seconds=1.0)
        mock_dl.return_value = (src, {"title": "My Song", "artist": "Some Artist"})

        resp = self._post({"url": "https://youtu.be/abc"})

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["filename"], "My Song")
        self.assertEqual(body["artist"], "Some Artist")
        self.assertTrue(os.path.exists(os.path.join(self.tmp, f"{body['id']}.ogg")))
        self.assertFalse(os.path.exists(src))  # source cleaned up

    def test_missing_url_returns_400(self):
        self.assertEqual(self._post({}).status_code, 400)

    def test_invalid_json_returns_400(self):
        resp = self.client.post(
            "/api/tracks/youtube", data="not json", content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

    @patch("app.api.download_youtube")
    def test_download_failure_returns_400(self, mock_dl):
        from app.audio_ingest import IngestError

        mock_dl.side_effect = IngestError("boom")
        self.assertEqual(self._post({"url": "https://youtu.be/x"}).status_code, 400)
