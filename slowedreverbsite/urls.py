"""
URL configuration for slowedreverbsite project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from django.views import View


class SPAFallbackView(View):
    """Serve the built SvelteKit index.html for any client-side route.

    WhiteNoise serves the real asset files (/_app/..., /fonts/...) and "/".
    This handles deep links / refreshes on SPA routes that have no matching
    file, returning index.html so the client router can take over. Returns 404
    when the SPA hasn't been built (e.g. local dev where vite serves it).
    """

    def get(self, request, *args, **kwargs):
        index = settings.FRONTEND_BUILD_DIR / "index.html"
        if not index.is_file():
            raise Http404("Frontend build not found")
        return FileResponse(index.open("rb"), content_type="text/html")


urlpatterns = [
    path("", include("app.urls")),
    path("admin/", admin.site.urls),
    # Catch-all SPA fallback — must stay last so /api and /admin win first.
    re_path(r"^(?!api/|admin/|static/).*$", SPAFallbackView.as_view()),
]
