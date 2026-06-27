import { afterEach, expect, test, vi } from 'vitest';
import {
  getCsrfToken,
  listTracks,
  uploadTrack,
  addYoutube,
  deleteTrack,
  ApiError
} from '../src/lib/api/tracks';

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Stub global fetch with a typed mock so `.mock.calls[0]` is a proper tuple. */
function mockFetch(response: Response) {
  const fn = vi.fn<FetchMock>(async () => response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

function headersOf(init?: RequestInit): Record<string, string> {
  return (init?.headers ?? {}) as Record<string, string>;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = 'csrftoken=; max-age=0; path=/';
});

test('getCsrfToken reads the cookie', () => {
  document.cookie = 'csrftoken=abc123; path=/';
  expect(getCsrfToken()).toBe('abc123');
});

test('listTracks unwraps the tracks array', async () => {
  const track = { id: '1', filename: 'a', artist: '', duration: 10, url: '/api/tracks/1/audio' };
  mockFetch(new Response(JSON.stringify({ tracks: [track] }), { status: 200 }));
  await expect(listTracks()).resolves.toEqual([track]);
});

test('uploadTrack sends audio_file field and CSRF header', async () => {
  document.cookie = 'csrftoken=tok; path=/';
  const track = { id: '2', filename: 'b', artist: '', duration: 5, url: '/api/tracks/2/audio' };
  const fetchMock = mockFetch(new Response(JSON.stringify(track), { status: 200 }));
  const file = new File([new Uint8Array([1, 2, 3])], 'b.mp3', { type: 'audio/mpeg' });
  await expect(uploadTrack(file)).resolves.toEqual(track);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/tracks');
  expect(init?.method).toBe('POST');
  expect(headersOf(init)['X-CSRFToken']).toBe('tok');
  expect((init?.body as FormData).get('audio_file')).toBe(file);
});

test('addYoutube posts JSON {url} with CSRF + content-type headers', async () => {
  document.cookie = 'csrftoken=tok; path=/';
  const track = { id: '3', filename: 'yt', artist: '', duration: 9, url: '/api/tracks/3/audio' };
  const fetchMock = mockFetch(new Response(JSON.stringify(track), { status: 200 }));
  await expect(addYoutube('https://youtu.be/x')).resolves.toEqual(track);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/tracks/youtube');
  expect(init?.method).toBe('POST');
  expect(headersOf(init)['X-CSRFToken']).toBe('tok');
  expect(headersOf(init)['Content-Type']).toBe('application/json');
  expect(init?.body).toBe(JSON.stringify({ url: 'https://youtu.be/x' }));
});

test('deleteTrack issues DELETE with CSRF header', async () => {
  document.cookie = 'csrftoken=tok; path=/';
  const fetchMock = mockFetch(new Response(JSON.stringify({ deleted: '7' }), { status: 200 }));
  await expect(deleteTrack('7')).resolves.toBeUndefined();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/tracks/7');
  expect(init?.method).toBe('DELETE');
  expect(headersOf(init)['X-CSRFToken']).toBe('tok');
});

test('throws ApiError with the server error message', async () => {
  mockFetch(new Response(JSON.stringify({ error: 'audio too long' }), { status: 400 }));
  await expect(listTracks()).rejects.toMatchObject({
    message: 'audio too long',
    status: 400
  } as Partial<ApiError>);
});

test('429 surfaces a rate-limit message including the retry delay', async () => {
  mockFetch(new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }));
  await expect(listTracks()).rejects.toMatchObject({
    status: 429,
    message: 'Rate limited — try again in 30s.'
  });
});
