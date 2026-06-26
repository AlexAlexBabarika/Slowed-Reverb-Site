import os
import uuid

from django.conf import settings

PLAYLIST_KEY = "playlist"


def processing_dir() -> str:
    """Return the configured processing directory, creating it if needed."""
    path = settings.PROCESSING_DIR
    os.makedirs(path, exist_ok=True)
    return path


def new_track_id() -> str:
    return str(uuid.uuid4())


def track_audio_path(track_id: str) -> str:
    return os.path.join(processing_dir(), f"{track_id}{settings.AUDIO_EXT}")


def get_playlist(session) -> list:
    return session.get(PLAYLIST_KEY, [])


def add_track(session, track: dict) -> None:
    playlist = session.get(PLAYLIST_KEY, [])
    playlist.append(track)
    session[PLAYLIST_KEY] = playlist


def get_track(session, track_id: str):
    for track in session.get(PLAYLIST_KEY, []):
        if track.get("id") == track_id:
            return track
    return None


def remove_track(session, track_id: str):
    playlist = session.get(PLAYLIST_KEY, [])
    for i, track in enumerate(playlist):
        if track.get("id") == track_id:
            removed = playlist.pop(i)
            session[PLAYLIST_KEY] = playlist
            return removed
    return None
