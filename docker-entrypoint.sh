#!/usr/bin/env bash
# Entrypoint: prepare runtime state, then exec the container command (gunicorn).
set -euo pipefail

# Ensure the data dir (mounted volume) exists for the SQLite DB + audio output.
mkdir -p "$(dirname "${DJANGO_DB_PATH:-/data/db.sqlite3}")" "${PROCESSING_DIR:-/data/processing_data}"

# Apply database migrations on every boot (safe + idempotent).
python manage.py migrate --noinput

exec "$@"
