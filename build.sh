#!/usr/bin/env bash
set -o errexit

apt-get update && apt-get install -y ffmpeg
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate