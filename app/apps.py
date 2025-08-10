import atexit
from django.apps import AppConfig
from . import misc
import sys
import signal 

class AppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app'

    def ready(self):
        atexit.register(misc.cleanup_temp_files)
        atexit.register(misc.clear_all_sessions)

        def handle_exit(signum, frame):
            misc.cleanup_temp_files()
            misc.clear_all_sessions()
            sys.exit(0)

        signal.signal(signal.SIGINT, handle_exit)
        signal.signal(signal.SIGTERM, handle_exit)
