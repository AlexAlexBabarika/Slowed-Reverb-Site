import json
import logging
import os

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .audio_ingest import (
    IngestError,
    download_youtube,
    probe_audio,
    transcode_to_compressed,
    validate_audio_duration,
)
from .http_range import range_file_response
from .misc import safe_remove
from .track_store import (
    add_track,
    get_playlist,
    get_track,
    new_track_id,
    processing_dir,
    remove_track,
    track_audio_path,
)

logger = logging.getLogger(__name__)


def _track_json(track: dict) -> dict:
    return {**track, "url": f"/api/tracks/{track['id']}/audio"}


@ensure_csrf_cookie
@require_http_methods(["GET", "POST"])
def tracks_collection(request):
    if request.method == "GET":
        tracks = [_track_json(t) for t in get_playlist(request.session)]
        return JsonResponse({"tracks": tracks})

    upload = request.FILES.get("audio_file")
    if not upload:
        return JsonResponse({"error": "no file provided"}, status=400)

    ext = os.path.splitext(upload.name)[1].lower().lstrip(".")
    if ext not in settings.ALLOWED_UPLOAD_EXTS:
        return JsonResponse({"error": f"unsupported file type: {ext}"}, status=400)
    if upload.size > settings.MAX_AUDIO_UPLOAD_BYTES:
        limit = settings.MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024)
        return JsonResponse(
            {"error": f"This file exceeds the {limit:g} MiB upload limit."},
            status=413,
        )

    track_id = new_track_id()
    processing_dir()
    in_path = os.path.join(settings.PROCESSING_DIR, f"{track_id}_src.{ext}")
    out_path = track_audio_path(track_id)

    try:
        with open(in_path, "wb") as dst:
            for chunk in upload.chunks():
                dst.write(chunk)
        meta = probe_audio(in_path)
        validate_audio_duration(meta["duration"])
        transcode_to_compressed(in_path, out_path)
        out_meta = probe_audio(out_path)
        validate_audio_duration(out_meta["duration"], tolerance=0.1)
    except IngestError as exc:
        safe_remove(out_path)
        return JsonResponse({"error": exc.public_message}, status=400)
    except OSError:
        logger.exception("Could not store uploaded audio")
        safe_remove(out_path)
        return JsonResponse(
            {"error": "Audio storage is unavailable. Please try again later."},
            status=503,
        )
    finally:
        safe_remove(in_path)

    track = {
        "id": track_id,
        "filename": upload.name,
        "artist": meta.get("artist") or "",
        "duration": out_meta.get("duration", 0.0),
    }
    add_track(request.session, track)
    request.session.modified = True
    return JsonResponse(_track_json(track))


@require_http_methods(["DELETE"])
def track_detail(request, track_id):
    track_id = str(track_id)
    removed = remove_track(request.session, track_id)
    if removed is None:
        return JsonResponse({"error": "not found"}, status=404)
    request.session.modified = True
    safe_remove(track_audio_path(track_id))
    return JsonResponse({"deleted": track_id})


@require_http_methods(["GET"])
@never_cache
def track_audio(request, track_id):
    track_id = str(track_id)
    if get_track(request.session, track_id) is None:
        return JsonResponse({"error": "not found"}, status=404)
    return range_file_response(
        request,
        track_audio_path(track_id),
        settings.AUDIO_CONTENT_TYPE,
    )


@require_http_methods(["POST"])
def youtube_track(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"error": "invalid JSON"}, status=400)

    if not isinstance(data, dict) or not isinstance(data.get("url", ""), str):
        return JsonResponse(
            {"error": "Provide a JSON object with a URL string."}, status=400
        )
    url = data.get("url", "").strip()
    if not url:
        return JsonResponse({"error": "no url provided"}, status=400)

    track_id = new_track_id()
    processing_dir()
    dest_base = os.path.join(settings.PROCESSING_DIR, f"{track_id}_src")
    out_path = track_audio_path(track_id)
    downloaded = None

    try:
        downloaded, meta = download_youtube(url, dest_base)
        validate_audio_duration(probe_audio(downloaded)["duration"])
        transcode_to_compressed(downloaded, out_path)
        out_meta = probe_audio(out_path)
        validate_audio_duration(out_meta["duration"], tolerance=0.1)
    except IngestError as exc:
        safe_remove(out_path)
        return JsonResponse({"error": exc.public_message}, status=400)
    finally:
        safe_remove(downloaded)

    track = {
        "id": track_id,
        "filename": meta.get("title") or "YouTube audio",
        "artist": meta.get("artist") or "",
        "duration": out_meta.get("duration", 0.0),
    }
    add_track(request.session, track)
    request.session.modified = True
    return JsonResponse(_track_json(track))
