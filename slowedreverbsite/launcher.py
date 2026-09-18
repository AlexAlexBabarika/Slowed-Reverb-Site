from __future__ import annotations

import argparse
import os
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DEFAULT_BACKEND_PORT = 8000
DEFAULT_FRONTEND_PORT = 5173
WINDOWS_NEW_PROCESS_GROUP = 0x00000200
WINDOWS_CTRL_BREAK_EVENT = 1


class LauncherError(RuntimeError):
    pass


def _command(name: str) -> str:
    executable = shutil.which(name)
    if not executable:
        raise LauncherError(f"{name} is required but was not found on PATH.")
    return executable


def _port_is_available(port: int) -> bool:
    with socket.socket() as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def _ensure_frontend_dependencies(npm: str) -> None:
    installed_lock = FRONTEND_DIR / "node_modules" / ".package-lock.json"
    source_lock = FRONTEND_DIR / "package-lock.json"
    if (
        installed_lock.exists()
        and installed_lock.stat().st_mtime >= source_lock.stat().st_mtime
    ):
        return
    print("Installing frontend dependencies…")
    if _run_setup([npm, "ci"], FRONTEND_DIR):
        raise LauncherError(
            "npm ci failed. Fix the error above, then run the launcher again."
        )


def _spawn(
    command: list[str], cwd: Path, env: dict[str, str] | None = None
) -> subprocess.Popen[bytes]:
    if os.name == "nt":
        return subprocess.Popen(
            command,
            cwd=cwd,
            env=env,
            creationflags=WINDOWS_NEW_PROCESS_GROUP,
        )
    return subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True)


def _stop_process(process: subprocess.Popen) -> None:
    if os.name == "nt" and process.poll() is not None:
        return
    try:
        if os.name == "nt":
            process.send_signal(WINDOWS_CTRL_BREAK_EVENT)
        else:
            os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except ProcessLookupError:
        process.wait()
    except (OSError, subprocess.TimeoutExpired):
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                check=False,
                capture_output=True,
            )
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass
    finally:
        if os.name != "nt":
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass


def _run_setup(command: list[str], cwd: Path) -> int:
    process = _spawn(command, cwd)
    try:
        return process.wait()
    finally:
        _stop_process(process)


def _is_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=0.5) as response:
            return response.status < 500
    except (urllib.error.URLError, TimeoutError):
        return False


def _wait_until_ready(
    backend: subprocess.Popen,
    frontend: subprocess.Popen,
    backend_url: str,
    frontend_url: str,
    timeout: float = 30,
) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if backend.poll() is not None:
            raise LauncherError(
                f"Django stopped during startup (exit {backend.returncode})."
            )
        if frontend.poll() is not None:
            raise LauncherError(
                f"Vite stopped during startup (exit {frontend.returncode})."
            )
        if _is_ready(f"{backend_url}/api/tracks") and _is_ready(frontend_url):
            return
        time.sleep(0.15)
    raise LauncherError("The app did not become ready within 30 seconds.")


def run_app(args: argparse.Namespace) -> int:
    npm = _command("npm")
    _command("ffmpeg")
    if args.backend_port == args.frontend_port:
        raise LauncherError("Django and Vite need different ports.")
    for port in (args.backend_port, args.frontend_port):
        if not _port_is_available(port):
            raise LauncherError(
                f"Port {port} is already in use. Stop the process using it "
                "or choose another port."
            )

    _ensure_frontend_dependencies(npm)
    migrate = _run_setup(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        PROJECT_ROOT,
    )
    if migrate:
        raise LauncherError(
            "Database migration failed. Fix the error above and try again."
        )

    backend_url = f"http://127.0.0.1:{args.backend_port}"
    frontend_url = f"http://127.0.0.1:{args.frontend_port}"
    processes: list[subprocess.Popen[bytes]] = []
    try:
        backend = _spawn(
            [
                sys.executable,
                "manage.py",
                "runserver",
                f"127.0.0.1:{args.backend_port}",
                "--noreload",
            ],
            PROJECT_ROOT,
        )
        processes.append(backend)
        frontend = _spawn(
            [
                npm,
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                str(args.frontend_port),
                "--strictPort",
            ],
            FRONTEND_DIR,
            {**os.environ, "SLOWED_REVERB_BACKEND_URL": backend_url},
        )
        processes.append(frontend)
        _wait_until_ready(backend, frontend, backend_url, frontend_url)
        print(f"\nSlowed × Reverb is ready at {frontend_url}")
        print("Press Ctrl+C to stop Django and Vite.\n")
        if not args.no_browser:
            try:
                if not webbrowser.open(frontend_url):
                    print("Open the address above in your browser.")
            except (webbrowser.Error, OSError):
                print("Could not open the browser. Open the address above manually.")

        while True:
            if backend.poll() is not None:
                raise LauncherError(
                    f"Django stopped unexpectedly (exit {backend.returncode})."
                )
            if frontend.poll() is not None:
                raise LauncherError(
                    f"Vite stopped unexpectedly (exit {frontend.returncode})."
                )
            time.sleep(0.2)
    finally:
        print("\nStopping Django and Vite…")
        for process in reversed(processes):
            _stop_process(process)
        print("Stopped.")


def _launcher_directory() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "SlowedReverb" / "bin"
    return Path.home() / ".local" / "bin"


def install_command(_args: argparse.Namespace) -> int:
    uv = _command("uv")
    destination_dir = _launcher_directory()
    destination_dir.mkdir(parents=True, exist_ok=True)

    if os.name == "nt":
        destination = destination_dir / "slowed.cmd"
        content = (
            f'@echo off\r\n"{uv}" run --directory "{PROJECT_ROOT}" '
            "python -m slowedreverbsite.launcher %*\r\n"
        )
    else:
        destination = destination_dir / "slowed"
        content = (
            "#!/bin/sh\n"
            f"exec {shlex.quote(uv)} run --directory {shlex.quote(str(PROJECT_ROOT))} "
            'python -m slowedreverbsite.launcher "$@"\n'
        )

    if (
        destination.exists()
        and "slowedreverbsite.launcher" not in destination.read_text()
    ):
        raise LauncherError(f"{destination} already exists and is not this launcher.")
    destination.write_text(content, encoding="utf-8")
    if os.name != "nt":
        destination.chmod(0o755)

    print(f"Installed {destination}")
    if shutil.which("slowed") is None:
        print(f"Add {destination_dir} to PATH, then open a new terminal.")
    print("Run: slowed xreverb")
    return 0


def _port(value: str) -> int:
    port = int(value)
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="slowed")
    subparsers = parser.add_subparsers(dest="command", required=True)

    start = subparsers.add_parser("xreverb", help="start Django and Vite")
    start.add_argument("--backend-port", type=_port, default=DEFAULT_BACKEND_PORT)
    start.add_argument("--frontend-port", type=_port, default=DEFAULT_FRONTEND_PORT)
    start.add_argument("--no-browser", action="store_true")

    subparsers.add_parser("install", help="install the slowed command")
    return parser


def _interrupt(_signum: int, _frame: object) -> None:
    raise KeyboardInterrupt


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    previous_handler = signal.signal(signal.SIGTERM, _interrupt)
    try:
        if args.command == "xreverb":
            return run_app(args)
        return install_command(args)
    except KeyboardInterrupt:
        return 0
    except (LauncherError, OSError) as exc:
        print(f"slowed: {exc}", file=sys.stderr)
        return 1
    finally:
        signal.signal(signal.SIGTERM, previous_handler)


if __name__ == "__main__":
    raise SystemExit(main())
