import os
import re

from django.http import (
    FileResponse,
    HttpResponse,
    HttpResponseNotFound,
    StreamingHttpResponse,
)

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _limited_reader(file_obj, length, chunk_size=8192):
    remaining = length
    try:
        while remaining > 0:
            data = file_obj.read(min(chunk_size, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data
    finally:
        file_obj.close()


def range_file_response(request, path, content_type, cache_seconds=31536000):
    """Serve `path` honoring an optional HTTP Range header.

    Source files are immutable (effects are applied client-side), so responses
    are marked publicly cacheable and immutable.
    """
    if not os.path.exists(path):
        return HttpResponseNotFound("Not found")

    file_size = os.path.getsize(path)
    cache_value = f"public, max-age={cache_seconds}, immutable"
    range_header = request.headers.get("Range")
    match = _RANGE_RE.match(range_header) if range_header else None

    if match:
        start_s, end_s = match.group(1), match.group(2)
        if start_s == "":
            # Suffix range: last N bytes.
            length = int(end_s) if end_s else 0
            start = max(0, file_size - length)
            end = file_size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else file_size - 1
        end = min(end, file_size - 1)

        if start > end or start >= file_size:
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{file_size}"
            return resp

        length = end - start + 1
        file_obj = open(path, "rb")
        file_obj.seek(start)
        resp = StreamingHttpResponse(
            _limited_reader(file_obj, length),
            status=206,
            content_type=content_type,
        )
        resp["Content-Length"] = str(length)
        resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        resp["Accept-Ranges"] = "bytes"
        resp["Cache-Control"] = cache_value
        return resp

    resp = FileResponse(open(path, "rb"), content_type=content_type)
    resp["Content-Length"] = str(file_size)
    resp["Accept-Ranges"] = "bytes"
    resp["Cache-Control"] = cache_value
    return resp
