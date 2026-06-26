from django.urls import path

from . import api

urlpatterns = [
    path("api/tracks", api.tracks_collection, name="tracks_collection"),
    path("api/tracks/<uuid:track_id>", api.track_detail, name="track_detail"),
]
