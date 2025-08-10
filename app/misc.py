import os
import re
import tempfile
import time

MARKERS = ("_original", "_out", "_reloaded", "_mid")
ANON_TEMP_RE = re.compile(r"^(tmp|tmp\w+|[^.]+)\.wav$", re.IGNORECASE)
FILES: set = {}

def cleanup_temp_files(active_paths=(), max_age_seconds=0):
    temp_dir = tempfile.gettempdir()
    now = time.time()

    protected = set()
    for p in active_paths:
        try:
            if p:
                protected.add(os.path.realpath(p))
        except Exception:
            pass

    deleted, kept = 0, 0

    for fname in os.listdir(temp_dir):
        fpath = os.path.join(temp_dir, fname)
        try:
            if not os.path.isfile(fpath):
                continue

            ext = os.path.splitext(fname)[1].lower()
            if ext not in (".wav", ".mp3"):
                continue

            if os.path.realpath(fpath) in protected:
                kept += 1
                continue

            age = now - os.path.getmtime(fpath)
            if age < max_age_seconds:
                kept += 1
                continue

            looks_like_ours = (
                any(m in fname for m in MARKERS) or
                ANON_TEMP_RE.match(fname) or
                re.match(r"^[0-9a-f-]{36}", fname)
            )

            if not looks_like_ours:
                kept += 1
                continue

            os.remove(fpath)
            print(f"🧹 Deleted: {fpath}")
            deleted += 1

        except Exception as e:
            print(f"⚠️ Could not delete {fpath}: {e}")

    print(f"Cleanup complete. Deleted={deleted}, Kept={kept}")

def cleanup_all_temp():
    temp_dir = tempfile.gettempdir()
    for fname in os.listdir(temp_dir):
        if fname.endswith('.wav') and ('_original' in fname or '_out' in fname or '_reloaded' in fname):
            fpath = os.path.join(temp_dir, fname)
            try:
                os.remove(fpath)
                print(f"🧹 Deleted: {fpath}")
            except Exception as e:
                print(f"⚠️ Could not delete {fpath}: {e}")


def clear_all_sessions():
    from django.contrib.sessions.models import Session
    Session.objects.all().delete()
    print("✅ All Django sessions wiped from database.")