import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { initializePlaylist, playlist, currentId, currentTrack } from '../src/lib/stores/playlist';
import { uploadTrack } from '../src/lib/api/tracks';

const track = { id: 'a', filename: 'a.wav', artist: '', duration: 1, url: '/api/tracks/a/audio' };

beforeEach(() => {
  playlist.set([]);
  currentId.set(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'csrftoken=; max-age=0; path=/';
});

test('bootstrap restores the session playlist and the first import uses its CSRF cookie', async () => {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify(track));
    document.cookie = 'csrftoken=session-token; path=/';
    return new Response(JSON.stringify({ tracks: [track] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  const controller = new AbortController();
  await initializePlaylist(controller.signal);
  expect(get(playlist)).toEqual([track]);
  expect(get(currentTrack)).toEqual(track);
  expect(fetchMock.mock.calls[0]).toEqual([
    '/api/tracks', { credentials: 'same-origin', signal: controller.signal }
  ]);
  await uploadTrack(new File(['audio'], 'a.wav'));
  const headers = new Headers(fetchMock.mock.calls[1][1]?.headers);
  expect(headers.get('X-CSRFToken')).toBe('session-token');
});

test('failed initialization can be retried without losing an existing selection', async () => {
  playlist.set([track]);
  currentId.set(track.id);
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ tracks: [track] })));
  vi.stubGlobal('fetch', fetchMock);
  const signal = new AbortController().signal;
  await expect(initializePlaylist(signal)).rejects.toThrow();
  expect(get(currentTrack)).toEqual(track);
  await initializePlaylist(signal);
  expect(get(currentId)).toBe(track.id);
});

test('an aborted bootstrap cannot restore tracks after teardown', async () => {
  const controller = new AbortController();
  vi.stubGlobal('fetch', vi.fn(async () => {
    controller.abort();
    return new Response(JSON.stringify({ tracks: [track] }));
  }));
  await expect(initializePlaylist(controller.signal)).rejects.toThrow();
  expect(get(playlist)).toEqual([]);
  expect(get(currentId)).toBeNull();
});
