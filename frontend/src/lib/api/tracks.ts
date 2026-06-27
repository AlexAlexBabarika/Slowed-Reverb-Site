export interface Track {
  id: string;
  filename: string;
  artist: string;
  duration: number;
  url: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    throw new ApiError(
      retry ? `Rate limited — try again in ${retry}s.` : 'Rate limited — try again shortly.',
      429
    );
  }
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') message = body.error;
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(message, res.status);
}

export async function listTracks(): Promise<Track[]> {
  const res = await fetch('/api/tracks', { credentials: 'same-origin' });
  const data = await parseOrThrow<{ tracks: Track[] }>(res);
  return data.tracks;
}

export async function uploadTrack(file: File): Promise<Track> {
  const body = new FormData();
  body.append('audio_file', file);
  const res = await fetch('/api/tracks', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': getCsrfToken() },
    body
  });
  return parseOrThrow<Track>(res);
}

export async function addYoutube(url: string): Promise<Track> {
  const res = await fetch('/api/tracks/youtube', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': getCsrfToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return parseOrThrow<Track>(res);
}

export async function deleteTrack(id: string): Promise<void> {
  const res = await fetch(`/api/tracks/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': getCsrfToken() }
  });
  await parseOrThrow<{ deleted: string }>(res);
}
