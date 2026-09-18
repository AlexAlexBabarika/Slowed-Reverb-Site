import os
import re
from typing import BinaryIO

from django.http import (
    FileResponse,
    HttpResponse,
    HttpResponseNotFound,
    StreamingHttpResponse,
)

_RANGE_RE = re.compile(r"bytes=([0-9]*)-([0-9]*)")


class _RangeReader:
    def __init__(self, file_obj: BinaryIO, length: int):
        self.file_obj = file_obj
        self.remaining = length

    def __iter__(self):
        return self

    def __next__(self) -> bytes:
        if self.file_obj.closed:
            raise StopIteration
        data = self.file_obj.read(min(8192, self.remaining))
        if not data:
            self.close()
            raise StopIteration
        self.remaining -= len(data)
        return data

    def close(self) -> None:
        self.file_obj.close()


def _bounded_integer(value: str, limit: int) -> int:
    digits = value.lstrip("0") or "0"
    return limit if len(digits) > len(str(limit)) else min(int(digits), limit)


def range_file_response(request, path, content_type):
    """Serve private audio, honoring a single valid byte range."""
    try:
        file_obj = open(path, "rb")
    except FileNotFoundError:
        return HttpResponseNotFound("Not found")

    file_size = os.fstat(file_obj.fileno()).st_size
    cache_value = "private, no-store"
    range_header = request.headers.get("Range", "")
    match = (
        _RANGE_RE.fullmatch(range_header)
        if not request.headers.get("If-Range")
        else None
    )

    if match and any(match.groups()):
        start_s, end_s = match.group(1), match.group(2)
        if start_s == "":
            length = _bounded_integer(end_s, file_size)
            start = max(0, file_size - length)
            end = file_size - 1
        else:
            start = _bounded_integer(start_s, file_size)
            end = _bounded_integer(end_s, file_size) if end_s else file_size - 1
        end = min(end, file_size - 1)

        if start > end or start >= file_size:
            file_obj.close()
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{file_size}"
            resp["Cache-Control"] = cache_value
            return resp

        length = end - start + 1
        file_obj.seek(start)
        resp = StreamingHttpResponse(
            _RangeReader(file_obj, length),
            status=206,
            content_type=content_type,
        )
        resp["Content-Length"] = str(length)
        resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        resp["Accept-Ranges"] = "bytes"
        resp["Cache-Control"] = cache_value
        return resp

    resp = FileResponse(file_obj, content_type=content_type)
    resp["Content-Length"] = str(file_size)
    resp["Accept-Ranges"] = "bytes"
    resp["Cache-Control"] = cache_value
    return resp
