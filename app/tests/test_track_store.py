import os
import shutil
import tempfile

from django.test import SimpleTestCase, override_settings

from app import track_store


class TrackStoreTests(SimpleTestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.override = override_settings(PROCESSING_DIR=self.tmp, AUDIO_EXT=".ogg")
        self.override.enable()
        self.addCleanup(self.override.disable)

    def test_processing_dir_is_created(self):
        nested = os.path.join(self.tmp, "nested")
        with override_settings(PROCESSING_DIR=nested):
            self.assertEqual(track_store.processing_dir(), nested)
            self.assertTrue(os.path.isdir(nested))

    def test_new_track_id_is_unique(self):
        self.assertNotEqual(track_store.new_track_id(), track_store.new_track_id())

    def test_track_audio_path_uses_ext(self):
        path = track_store.track_audio_path("abc")
        self.assertEqual(path, os.path.join(self.tmp, "abc.ogg"))

    def test_add_get_remove_roundtrip(self):
        session = {}
        track = {"id": "abc", "filename": "x.mp3", "artist": "A", "duration": 1.0}

        track_store.add_track(session, track)
        self.assertEqual(track_store.get_playlist(session), [track])
        self.assertEqual(track_store.get_track(session, "abc"), track)

        removed = track_store.remove_track(session, "abc")
        self.assertEqual(removed, track)
        self.assertEqual(track_store.get_playlist(session), [])

    def test_get_and_remove_missing_return_none(self):
        session = {}
        self.assertIsNone(track_store.get_track(session, "nope"))
        self.assertIsNone(track_store.remove_track(session, "nope"))
