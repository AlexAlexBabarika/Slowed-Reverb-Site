from django.urls import path

from . import api

urlpatterns = [
    path("api/tracks", api.tracks_collection, name="tracks_collection"),
    path("api/tracks/youtube", api.youtube_track, name="youtube_track"),
    path("api/tracks/<uuid:track_id>/audio", api.track_audio, name="track_audio"),
    path("api/tracks/<uuid:track_id>", api.track_detail, name="track_detail"),
]
