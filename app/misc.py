import os
import tempfile

def cleanup_temp_audio_files():
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