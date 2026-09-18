# Slowed Reverb Site

![Slowed Reverb Site interface](interface.jpeg)

Change the speed and pitch of audio in your browser. The application combines a
Django API with a SvelteKit frontend and includes the foundations for effects
such as reverb.

## Run with Docker

Docker is the quickest way to run the complete application. The image builds
the SvelteKit frontend and serves it with the Django API through Gunicorn and
WhiteNoise. FFmpeg is included in the image.

```sh
docker compose up --build
```

Open <http://localhost:8080>. Press `Ctrl+C` to stop the application.

The SQLite database and processed audio persist in the `app-data` Docker
volume. For a production deployment, set `DJANGO_SECRET_KEY` and
`DJANGO_ALLOWED_HOSTS`; the available settings are documented in
[`compose.yaml`](compose.yaml).

## Local development

### Prerequisites

- Python 3.13 or later
- [uv](https://docs.astral.sh/uv/)
- Node.js 20 or later
- FFmpeg

Install FFmpeg with the package manager for your platform:

```sh
# macOS
brew install ffmpeg

# Debian or Ubuntu
sudo apt install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

Install the backend and frontend dependencies:

```sh
uv sync
npm --prefix frontend ci
```

### One-command launcher

Install a `slowed` command for this checkout:

```sh
uv run python -m slowedreverbsite.launcher install
```

If the installer says the command directory is not on `PATH`, add the printed
directory and open a new terminal. Then start the complete development app:

```sh
slowed xreverb
```

The launcher installs missing frontend packages, applies database migrations,
starts Django and Vite, waits for both to become ready, and opens the page.
Press `Ctrl+C` once to stop both servers cleanly.

To run without installing the command:

```sh
uv run python -m slowedreverbsite.launcher xreverb
```

Use `--no-browser` for a headless terminal. The installed command points to
this checkout; rerun the installer if you move the repository.

Use custom ports when the defaults are occupied:

```sh
slowed xreverb --backend-port 8010 --frontend-port 5180
```

The two-terminal workflow remains available for debugging each server
independently.

### YouTube imports

The Python environment includes pinned versions of yt-dlp, its supported Deno
runtime, and its challenge solver. Install the project's locked versions with:

```sh
uv sync
```

Public YouTube links work without account access when YouTube permits it. For a
video that requires sign-in, export a Netscape-format `cookies.txt` from a
private YouTube session and point the app to it before starting:

```sh
export YTDLP_COOKIES_FILE="$HOME/.config/slowed-reverb/youtube-cookies.txt"
slowed xreverb
```

Treat that file like a password and never commit it. The app does not inspect
browser profiles or extract cookies automatically. If YouTube rejects the
session, export a fresh file and restart the app. yt-dlp's documentation
explains the recommended private-session export process:
https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies

YouTube can still require sign-in or rate-limit requests regardless of the
downloader. The app reports these cases separately and does not repeatedly
switch downloaders against the same restriction.

### Run the servers separately

Start Django and Vite in separate terminals:

```sh
uv run python manage.py migrate
uv run python manage.py runserver
```

```sh
npm --prefix frontend run dev
```

Open <http://localhost:5173>. Vite proxies API requests to Django on port
`8000`.

## Quality checks

GitHub Actions runs Python lint, formatting, type checks, and the Django tests
for pull requests and pushes to the main branch.

```sh
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run python manage.py test
npm --prefix frontend run check
npm --prefix frontend test
```

To apply Python formatting, run `uv run ruff format .`. Ruff can automatically
fix supported lint violations with `uv run ruff check --fix .`.

## Import limits

The server accepts audio up to 15 minutes and 256 MiB by default. It checks the
actual media duration for both uploads and YouTube downloads. Files without a
readable audio stream or duration are rejected.

These environment variables can be set before starting the app:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MAX_AUDIO_DURATION_SECONDS` | `900` | Maximum source duration |
| `MAX_AUDIO_UPLOAD_BYTES` | `268435456` | Maximum upload/YouTube download size |
| `AUDIO_PROBE_TIMEOUT_SECONDS` | `15` | Time allowed for each FFprobe process |
| `AUDIO_TRANSCODE_TIMEOUT_SECONDS` | `90` | Time allowed for each FFmpeg process |

The web server's request timeout also applies to the complete import. Audio
responses require the owning session and use private, non-storing cache
headers; uploads are not intended for public CDN caching.
