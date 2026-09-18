import argparse
import os
import signal
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import Mock, call, patch

from django.test import SimpleTestCase

from slowedreverbsite import launcher


class LauncherTests(SimpleTestCase):
    @patch("slowedreverbsite.launcher._run_setup")
    def test_frontend_dependencies_install_only_when_missing(self, run):
        run.return_value = 0
        with tempfile.TemporaryDirectory() as tmp:
            frontend = Path(tmp)
            (frontend / "package-lock.json").write_text("{}", encoding="utf-8")
            with patch.object(launcher, "FRONTEND_DIR", frontend):
                launcher._ensure_frontend_dependencies("npm")
                run.assert_called_once_with(["npm", "ci"], frontend)

                run.reset_mock()
                installed = frontend / "node_modules" / ".package-lock.json"
                installed.parent.mkdir()
                installed.write_text("{}", encoding="utf-8")
                os.utime(installed, (installed.stat().st_atime, 2_000_000_000))
                launcher._ensure_frontend_dependencies("npm")
                run.assert_not_called()

    @patch("slowedreverbsite.launcher.os.killpg")
    def test_stop_process_terminates_the_owned_process_group(self, killpg):
        process = Mock(spec=subprocess.Popen)
        process.pid = 1234
        process.poll.return_value = None

        with patch.object(launcher.os, "name", "posix"):
            launcher._stop_process(process)

        self.assertEqual(
            killpg.call_args_list,
            [call(1234, signal.SIGTERM), call(1234, signal.SIGKILL)],
        )
        process.wait.assert_called_once_with(timeout=5)

    @patch.object(os, "name", "posix")
    @patch("slowedreverbsite.launcher._launcher_directory")
    @patch("slowedreverbsite.launcher._command", return_value="/usr/bin/uv")
    def test_installed_command_runs_this_checkout(self, _command, launcher_directory):
        with tempfile.TemporaryDirectory() as tmp:
            launcher_directory.return_value = Path(tmp)
            result = launcher.install_command(argparse.Namespace())

            command = (Path(tmp) / "slowed").read_text(encoding="utf-8")

        self.assertEqual(result, 0)
        self.assertIn(str(launcher.PROJECT_ROOT), command)
        self.assertIn('python -m slowedreverbsite.launcher "$@"', command)

    @patch("slowedreverbsite.launcher._stop_process")
    @patch("slowedreverbsite.launcher._spawn")
    @patch("slowedreverbsite.launcher._run_setup", return_value=0)
    @patch("slowedreverbsite.launcher._ensure_frontend_dependencies")
    @patch("slowedreverbsite.launcher._port_is_available", return_value=True)
    @patch("slowedreverbsite.launcher._command", return_value="npm")
    def test_failed_frontend_start_stops_the_backend(
        self, _command, _port, _dependencies, _setup, spawn, stop
    ):
        backend = Mock(spec=subprocess.Popen)
        spawn.side_effect = [backend, OSError("Vite could not start")]

        result = launcher.main(["xreverb", "--no-browser"])

        self.assertEqual(result, 1)
        stop.assert_called_once_with(backend)
