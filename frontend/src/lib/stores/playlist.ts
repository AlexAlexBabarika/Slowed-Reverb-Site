import { derived, get, writable } from 'svelte/store';
import { listTracks, type Track } from '../api/tracks';

export const playlist = writable<Track[]>([]);
export const currentId = writable<string | null>(null);

export const currentTrack = derived(
  [playlist, currentId],
  ([$playlist, $currentId]) => $playlist.find((t) => t.id === $currentId) ?? null
);

export async function initializePlaylist(signal: AbortSignal): Promise<void> {
  const tracks = await listTracks(signal);
  signal.throwIfAborted();
  const selected = get(currentId);
  playlist.set(tracks);
  currentId.set(tracks.some((track) => track.id === selected) ? selected : tracks[0]?.id ?? null);
}

export function addToPlaylist(track: Track): void {
  playlist.update((list) => [...list, track]);
  if (get(currentId) === null) currentId.set(track.id);
}

export function removeFromPlaylist(id: string): void {
  const before = get(playlist);
  const after = before.filter((t) => t.id !== id);
  playlist.set(after);
  if (get(currentId) === id) {
    currentId.set(after.length ? after[0].id : null);
  }
}

export function setCurrent(id: string): void {
  currentId.set(id);
}
