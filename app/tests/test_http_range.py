import os
import shutil
import tempfile
from unittest.mock import patch

from django.test import SimpleTestCase
from django.test.client import RequestFactory

from app.http_range import range_file_response


class RangeResponseTests(SimpleTestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.path = os.path.join(self.tmp, "data.bin")
        with open(self.path, "wb") as f:
            f.write(bytes(range(256)))  # 256 known bytes
        self.rf = RequestFactory()

    def _body(self, resp):
        return b"".join(resp.streaming_content)

    def test_full_response_when_no_range(self):
        resp = range_file_response(self.rf.get("/x"), self.path, "audio/ogg")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Accept-Ranges"], "bytes")
        self.assertEqual(resp["Content-Length"], "256")

    def test_partial_response_for_range(self):
        req = self.rf.get("/x", HTTP_RANGE="bytes=0-9")
        resp = range_file_response(req, self.path, "audio/ogg")
        self.assertEqual(resp.status_code, 206)
        self.assertEqual(resp["Content-Range"], "bytes 0-9/256")
        self.assertEqual(resp["Content-Length"], "10")
        self.assertEqual(self._body(resp), bytes(range(0, 10)))

    def test_open_ended_range(self):
        req = self.rf.get("/x", HTTP_RANGE="bytes=250-")
        resp = range_file_response(req, self.path, "audio/ogg")
        self.assertEqual(resp.status_code, 206)
        self.assertEqual(resp["Content-Range"], "bytes 250-255/256")
        self.assertEqual(self._body(resp), bytes(range(250, 256)))

    def test_unsatisfiable_range(self):
        req = self.rf.get("/x", HTTP_RANGE="bytes=500-600")
        resp = range_file_response(req, self.path, "audio/ogg")
        self.assertEqual(resp.status_code, 416)
        self.assertEqual(resp["Content-Range"], "bytes */256")

    def test_missing_file_returns_404(self):
        resp = range_file_response(self.rf.get("/x"), self.path + ".nope", "audio/ogg")
        self.assertEqual(resp.status_code, 404)

    def test_audio_responses_are_private_and_not_stored(self):
        for range_header in ("", "bytes=0-9", "bytes=500-"):
            with self.subTest(range=range_header):
                response = range_file_response(
                    self.rf.get("/x", HTTP_RANGE=range_header), self.path, "audio/ogg"
                )
                self.addCleanup(response.close)
                self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_malformed_and_multiple_ranges_fall_back_to_full_response(self):
        for header in ("bytes=-", "bytes=0-9,20-29", "bytes=0-9garbage", "items=0-9"):
            with self.subTest(range=header):
                response = range_file_response(
                    self.rf.get("/x", HTTP_RANGE=header), self.path, "audio/ogg"
                )
                self.addCleanup(response.close)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(self._body(response), bytes(range(256)))

    def test_large_integer_ranges_do_not_crash(self):
        cases = [
            (f"bytes={'9' * 5000}-", 416, None),
            (f"bytes=0-{'9' * 5000}", 206, bytes(range(256))),
            (f"bytes=-{'9' * 5000}", 206, bytes(range(256))),
            (f"bytes={'0' * 5000}1-9", 206, bytes(range(1, 10))),
            ("bytes=-0", 416, None),
        ]
        for header, status, expected in cases:
            response = range_file_response(
                self.rf.get("/x", HTTP_RANGE=header), self.path, "audio/ogg"
            )
            self.addCleanup(response.close)
            self.assertEqual(response.status_code, status)
            if expected is not None:
                self.assertEqual(self._body(response), expected)

    def test_unvalidated_if_range_returns_the_full_file(self):
        response = range_file_response(
            self.rf.get("/x", HTTP_RANGE="bytes=0-9", HTTP_IF_RANGE='"old-version"'),
            self.path,
            "audio/ogg",
        )
        self.addCleanup(response.close)
        self.assertEqual(response.status_code, 200)

    def test_closing_an_unstarted_partial_response_closes_the_file(self):
        with open(self.path, "rb") as audio:
            with patch("app.http_range.open", return_value=audio):
                response = range_file_response(
                    self.rf.get("/x", HTTP_RANGE="bytes=0-9"), self.path, "audio/ogg"
                )
            response.close()
            self.assertTrue(audio.closed)
