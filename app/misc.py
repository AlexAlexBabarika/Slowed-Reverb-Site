import os


def safe_remove(path: str) -> None:
    """Remove a file if it exists, swallowing errors."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError as exc:
        print(f"Failed to remove {path}: {exc}")
