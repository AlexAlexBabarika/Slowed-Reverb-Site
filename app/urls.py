from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path('audio/<int:index>/', views.serve_audio, name='serve_audio'),
    path('reload/', views.reload_audio, name="reload_audio"),
    path("delete/", views.delete_from_playlist, name="delete_from_playlist"),
    path("download_from_youtube", views.download_from_youtube, name="download_from_youtube"),
    path("set_last_played/<int:index>/", views.set_last_played, name="set_last_played"),
    path("cleanup/", views.cleanup_view, name="cleanup")
]