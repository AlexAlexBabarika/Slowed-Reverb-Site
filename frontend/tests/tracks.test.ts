import { afterEach, expect, test, vi } from 'vitest';
import { getCsrfToken, listTracks, uploadTrack, ApiError } from '../src/lib/api/tracks';

afterEach(() => { vi.restoreAllMocks(); document.cookie = 'csrftoken=; max-age=0; path=/'; });

test('getCsrfToken reads the cookie', () => {
  document.cookie = 'csrftoken=abc123; path=/';
  expect(getCsrfToken()).toBe('abc123');
});

test('listTracks unwraps the tracks array', async () => {
  const track = { id: '1', filename: 'a', artist: '', duration: 10, url: '/api/tracks/1/audio' };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tracks: [track] }), { status: 200 })));
  await expect(listTracks()).resolves.toEqual([track]);
});

test('uploadTrack sends audio_file field and CSRF header', async () => {
  document.cookie = 'csrftoken=tok; path=/';
  const track = { id: '2', filename: 'b', artist: '', duration: 5, url: '/api/tracks/2/audio' };
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(track), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const file = new File([new Uint8Array([1, 2, 3])], 'b.mp3', { type: 'audio/mpeg' });
  await expect(uploadTrack(file)).resolves.toEqual(track);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/tracks');
  expect((init as RequestInit).method).toBe('POST');
  expect((init as any).headers['X-CSRFToken']).toBe('tok');
  expect((init as any).body.get('audio_file')).toBe(file);
});

test('throws ApiError with the server error message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'audio too long' }), { status: 400 })));
  await expect(listTracks()).rejects.toMatchObject({ message: 'audio too long', status: 400 } as Partial<ApiError>);
});

test('429 surfaces a rate-limit message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '30' } })));
  await expect(listTracks()).rejects.toMatchObject({ status: 429 });
});
