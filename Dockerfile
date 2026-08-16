# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the SvelteKit SPA into static files (frontend/build).
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend
WORKDIR /app/frontend

# Install deps first for layer caching.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Build the static SPA (adapter-static -> /app/frontend/build).
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — Python backend (gunicorn) serving the API + the built SPA.
# ---------------------------------------------------------------------------
FROM python:3.13-slim AS backend

# ffmpeg is required by ffmpeg-python / yt-dlp for transcoding.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# uv for fast, locked dependency installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install locked dependencies (no dev group, no project itself — package=false).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Application code.
COPY manage.py ./
COPY slowedreverbsite/ ./slowedreverbsite/
COPY app/ ./app/

# Built SPA from stage 1 -> served at the web root by WhiteNoise.
COPY --from=frontend /app/frontend/build ./frontend/build

# Collect Django/admin static into STATIC_ROOT for WhiteNoise.
RUN DJANGO_DEBUG=0 python manage.py collectstatic --noinput

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["gunicorn", "slowedreverbsite.wsgi:application", \
     "--bind", "0.0.0.0:8080", "--workers", "3", "--timeout", "120"]
