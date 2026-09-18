import json
import os
import shutil
import tempfile
from unittest.mock import patch

from django.test import TestCase, override_settings

from app.audio_ingest import IngestError
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

    def test_invalid_payload_types_return_400(self):
        for payload in (None, [], 42, "video", {"url": []}, {"url": 42}, {"url": None}):
            with self.subTest(payload=payload):
                self.assertEqual(self._post(payload).status_code, 400)

    @override_settings(MAX_AUDIO_DURATION_SECONDS=1)
    @patch("app.api.transcode_to_compressed")
    @patch("app.api.download_youtube")
    def test_actual_youtube_duration_is_checked_before_transcoding(
        self, download, transcode
    ):
        source = os.path.join(self.tmp, "long.wav")
        make_test_audio(source, seconds=2)
        download.return_value = (source, {"title": "Unexpectedly long"})

        response = self._post({"url": "https://youtu.be/abc"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("import limit", response.json()["error"])
        transcode.assert_not_called()
        self.assertEqual(os.listdir(self.tmp), [])

    @patch("app.api.download_youtube")
    def test_download_failure_returns_400(self, mock_dl):
        mock_dl.side_effect = IngestError("detail", "Try another YouTube link.")
        response = self._post({"url": "https://youtu.be/x"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Try another YouTube link.")
