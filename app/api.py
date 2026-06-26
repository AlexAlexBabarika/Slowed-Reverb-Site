import os

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .audio_ingest import IngestError, probe_audio, transcode_to_compressed
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


def _track_json(track: dict) -> dict:
    return {**track, "url": f"/api/tracks/{track['id']}/audio"}


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

    track_id = new_track_id()
    processing_dir()
    in_path = os.path.join(settings.PROCESSING_DIR, f"{track_id}_src.{ext}")
    out_path = track_audio_path(track_id)

    with open(in_path, "wb") as dst:
        for chunk in upload.chunks():
            dst.write(chunk)

    try:
        meta = probe_audio(in_path)
        if meta["duration"] > settings.MAX_AUDIO_DURATION_SECONDS:
            return JsonResponse({"error": "audio too long"}, status=400)
        transcode_to_compressed(in_path, out_path)
        out_meta = probe_audio(out_path)
    except IngestError as exc:
        safe_remove(out_path)
        return JsonResponse({"error": str(exc)}, status=400)
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
def track_audio(request, track_id):
    track_id = str(track_id)
    if get_track(request.session, track_id) is None:
        return JsonResponse({"error": "not found"}, status=404)
    return range_file_response(
        request,
        track_audio_path(track_id),
        settings.AUDIO_CONTENT_TYPE,
    )
