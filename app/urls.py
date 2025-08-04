from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path('audio/', views.serve_audio, name='serve_audio'),
    path('reload/', views.reload_audio, name="reload_audio")
]