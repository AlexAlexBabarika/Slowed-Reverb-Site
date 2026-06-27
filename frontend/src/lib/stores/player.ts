// Shared playback controller: owns the single AudioEngine and exposes reactive
// playback state so the effects card, playlist, and transport bar all drive the
// same audio graph. Effects are applied live (no server round-trip).
import { get, writable } from 'svelte/store';
import { AudioEngine } from '../audio/engine';
import { effects } from './effects';
import { currentId, playlist, setCurrent } from './playlist';
import type { Track } from '../api/tracks';
import { encodeWav, exportFilename, renderProcessed } from '../audio/export';

let ctx: AudioContext | null = null;
let engine: AudioEngine | null = null;
let raf = 0;
let loadedId: string | null = null;
let wantPlay = false;
let wasPlaying = false;

export const isPlaying = writable(false);
export const progress = writable(0); // 0..1
export const currentTime = writable(0); // seconds
export const duration = writable(0);
export const buffer = writable<AudioBuffer | null>(null);
export const loading = writable(false);
export const looping = writable(false);
export const exporting = writable(false);
export const playerError = writable('');

function ensureEngine(): AudioEngine {
  if (!ctx) ctx = new AudioContext();
  if (!engine) engine = new AudioEngine(ctx);
  return engine;
}

function startTick(): void {
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick(): void {
  const playing = !!engine?.isPlaying;
  if (engine && playing) {
    const d = engine.duration;
    currentTime.set(engine.currentTime);
    duration.set(d);
    progress.set(d ? Math.min(1, engine.currentTime / d) : 0);
  }
  // Detect a natural end: the engine auto-pauses (playing flips true→false) at
  // a position at/after the buffer duration.
  if (wasPlaying && !playing && engine) {
    const d = engine.duration;
    if (d && engine.currentTime >= d - 0.06) {
      isPlaying.set(false);
      onEnded();
    } else {
      isPlaying.set(false);
    }
  }
  wasPlaying = playing;
  raf = requestAnimationFrame(tick);
}

function onEnded(): void {
  if (get(looping)) {
    progress.set(0);
    currentTime.set(0);
    engine?.seek(0);
    engine?.play(0);
    isPlaying.set(true);
  } else {
    wantPlay = true;
    next();
  }
}

function startPlayback(): void {
  const e = ensureEngine();
  e.applyEffects(get(effects));
  e.play(0);
  isPlaying.set(true);
  startTick();
  wantPlay = false;
}

/** Load (decode) the given track; play it if a play was requested. */
export async function syncTrack(track: Track | null): Promise<void> {
  playerError.set('');
  if (!track) {
    engine?.pause();
    isPlaying.set(false);
    buffer.set(null);
    duration.set(0);
    loadedId = null;
    return;
  }
  if (track.id === loadedId) {
    if (wantPlay) startPlayback();
    return;
  }
  const e = ensureEngine();
  e.pause();
  isPlaying.set(false);
  loading.set(true);
  try {
    await e.load(track.url);
    e.applyEffects(get(effects));
    buffer.set(e.decoded);
    duration.set(e.duration);
    progress.set(0);
    currentTime.set(0);
    loadedId = track.id;
    if (wantPlay) startPlayback();
  } catch {
    playerError.set('Could not load this track.');
  } finally {
    loading.set(false);
  }
}

/** Re-apply the current effect state to the live graph (no reload). */
export function applyLiveEffects(): void {
  engine?.applyEffects(get(effects));
}

/** Select a track and start playing it (from a user gesture). */
export function playTrack(id: string): void {
  wantPlay = true;
  if (id === get(currentId)) {
    syncTrack(get(playlist).find((t) => t.id === id) ?? null);
  } else {
    setCurrent(id);
  }
}

export function toggle(): void {
  const e = ensureEngine();
  if (e.isPlaying) {
    e.pause();
    isPlaying.set(false);
  } else {
    if (!get(buffer)) return;
    e.play();
    isPlaying.set(true);
    startTick();
  }
}

export function seekFraction(fraction: number): void {
  const d = get(duration);
  engine?.seek(fraction * d);
  progress.set(fraction);
  currentTime.set(fraction * d);
}

function neighborId(delta: number): string | null {
  const list = get(playlist);
  if (!list.length) return null;
  const i = list.findIndex((t) => t.id === get(currentId));
  const ni = (((i < 0 ? 0 : i) + delta) % list.length + list.length) % list.length;
  return list[ni].id;
}

export function next(): void {
  const id = neighborId(1);
  if (id) {
    wantPlay = true;
    setCurrent(id);
  }
}

export function prev(): void {
  const id = neighborId(-1);
  if (id) {
    wantPlay = true;
    setCurrent(id);
  }
}

export function toggleLoop(): void {
  looping.update((v) => !v);
}

export async function exportCurrent(): Promise<void> {
  const buf = get(buffer);
  const track = get(playlist).find((t) => t.id === get(currentId));
  if (!buf || !track) return;
  exporting.set(true);
  playerError.set('');
  try {
    const rendered = await renderProcessed(
      buf,
      get(effects),
      (ch, len, rate) => new OfflineAudioContext(ch, len, rate)
    );
    const channels = Array.from({ length: rendered.numberOfChannels }, (_, c) =>
      rendered.getChannelData(c)
    );
    const wav = encodeWav(channels, rendered.sampleRate);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportFilename(track);
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    playerError.set('Export failed.');
  } finally {
    exporting.set(false);
  }
}

export function disposePlayer(): void {
  cancelAnimationFrame(raf);
  raf = 0;
}
