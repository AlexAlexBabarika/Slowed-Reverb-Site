import { beforeEach, expect, test } from 'vitest';
import { get } from 'svelte/store';
import {
  playlist, currentId, currentTrack,
  addToPlaylist, removeFromPlaylist, setCurrent
} from '../src/lib/stores/playlist';

const t = (id: string) => ({ id, filename: id, artist: '', duration: 1, url: `/api/tracks/${id}/audio` });

beforeEach(() => { playlist.set([]); currentId.set(null); });

test('addToPlaylist appends and auto-selects the first track', () => {
  addToPlaylist(t('a'));
  expect(get(playlist)).toHaveLength(1);
  expect(get(currentId)).toBe('a');
  expect(get(currentTrack)?.id).toBe('a');
});

test('removeFromPlaylist drops the track and clears current when it was current', () => {
  addToPlaylist(t('a'));
  removeFromPlaylist('a');
  expect(get(playlist)).toHaveLength(0);
  expect(get(currentId)).toBeNull();
});

test('setCurrent switches the derived current track', () => {
  addToPlaylist(t('a'));
  addToPlaylist(t('b'));
  setCurrent('b');
  expect(get(currentTrack)?.id).toBe('b');
});
