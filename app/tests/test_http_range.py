import os
import shutil
import tempfile

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
