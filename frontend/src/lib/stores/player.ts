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
let loadGeneration = 0;
let pendingLoad: AbortController | null = null;
let loadingId: string | null = null;
let wantPlayId: string | null = null;
let playGeneration = 0;
let exportGeneration = 0;

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
  if (!engine) {
    engine = new AudioEngine(ctx);
    engine.onended = onEnded;
  }
  return engine;
}

function startTick(): void {
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick(): void {
  raf = 0;
  if (!engine?.isPlaying) return;
  publishPosition();
  startTick();
}

function publishPosition(): void {
  if (!engine) return;
  const d = engine.duration;
  const t = engine.currentTime;
  duration.set(d);
  currentTime.set(t);
  progress.set(d ? Math.min(1, t / d) : 0);
}

function resetPosition(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  isPlaying.set(false);
  currentTime.set(0);
  progress.set(0);
  duration.set(0);
}

function onEnded(): void {
  if (!ready()) return;
  publishPosition();
  isPlaying.set(false);
  cancelAnimationFrame(raf);
  raf = 0;
  if (get(looping)) {
    startPlayback();
    return;
  }
  const list = get(playlist);
  const index = list.findIndex((t) => t.id === loadedId);
  const nextTrack = list[index + 1];
  if (index >= 0 && nextTrack) playTrack(nextTrack.id);
}

function ready(): boolean {
  return !!engine && !!get(buffer) && !get(loading) && loadedId === get(currentId);
}

function startPlayback(from = 0): void {
  if (!ready()) return;
  const e = ensureEngine();
  const generation = ++playGeneration;
  playerError.set('');
  e.applyEffects(get(effects));
  try {
    void e.play(from).catch(() => playbackFailed(generation));
  } catch {
    playbackFailed(generation);
    return;
  }
  isPlaying.set(e.isPlaying);
  publishPosition();
  startTick();
  wantPlayId = null;
}

function playbackFailed(generation: number): void {
  if (generation !== playGeneration) return;
  engine?.pause();
  isPlaying.set(false);
  playerError.set('Could not start playback. Press Play to try again.');
}

/** Load (decode) the given track; play it if a play was requested. */
export async function syncTrack(track: Track | null): Promise<void> {
  if (track && track.id === loadedId) {
    if (wantPlayId === track.id) startPlayback();
    return;
  }
  if (track && track.id === loadingId) return;
  playerError.set('');
  const generation = ++loadGeneration;
  playGeneration++;
  pendingLoad?.abort();
  pendingLoad = null;
  loadingId = null;
  loadedId = null;
  if (wantPlayId !== track?.id) wantPlayId = null;
  engine?.setBuffer(null);
  buffer.set(null);
  resetPosition();
  loading.set(false);

  if (!track) return;
  loading.set(true);
  loadingId = track.id;
  const controller = new AbortController();
  pendingLoad = controller;
  try {
    const e = ensureEngine();
    const decoded = await e.decode(track.url, controller.signal);
    if (generation !== loadGeneration || track.id !== get(currentId)) return;
    e.setBuffer(decoded);
    e.applyEffects(get(effects));
    buffer.set(e.decoded);
    duration.set(e.duration);
    loadedId = track.id;
    loading.set(false);
    if (wantPlayId === track.id) startPlayback();
  } catch {
    if (generation !== loadGeneration) return;
    wantPlayId = null;
    loadedId = null;
    buffer.set(null);
    resetPosition();
    playerError.set('Could not load this track.');
  } finally {
    if (generation === loadGeneration) {
      pendingLoad = null;
      loadingId = null;
      loading.set(false);
    }
  }
}

/** Re-apply the current effect state to the live graph (no reload). */
export function applyLiveEffects(): void {
  engine?.applyEffects(get(effects));
}

/** Select a track and start playing it (from a user gesture). */
export function playTrack(id: string): void {
  const track = get(playlist).find((t) => t.id === id);
  if (!track) return;
  wantPlayId = id;
  try {
    void ensureEngine().resume().catch(() => {});
  } catch {
    playerError.set('Audio playback is unavailable in this browser.');
    wantPlayId = null;
    return;
  }
  setCurrent(id);
  void syncTrack(track);
}

export function toggle(): void {
  if (!ready()) return;
  const e = ensureEngine();
  if (e.isPlaying) {
    playGeneration++;
    wantPlayId = null;
    e.pause();
    isPlaying.set(false);
    publishPosition();
  } else {
    startPlayback(e.currentTime);
  }
}

export function seekFraction(fraction: number): void {
  if (!ready() || !Number.isFinite(fraction)) return;
  const d = get(duration);
  const generation = ++playGeneration;
  void engine?.seek(fraction * d).catch(() => playbackFailed(generation));
  isPlaying.set(!!engine?.isPlaying);
  publishPosition();
}

function neighborId(delta: number): string | null {
  const list = get(playlist);
  if (!list.length) return null;
  const i = list.findIndex((t) => t.id === get(currentId));
  const ni = (((i < 0 ? 0 : i) + delta) % list.length + list.length) % list.length;
  return list[ni].id;
}

function skip(delta: number): void {
  if (!ready()) return;
  const id = neighborId(delta);
  if (!id) return;
  playTrack(id);
}

export function next(): void {
  skip(1);
}

export function prev(): void {
  skip(-1);
}

export function toggleLoop(): void {
  looping.update((v) => !v);
}

export async function exportCurrent(): Promise<void> {
  const buf = get(buffer);
  const track = get(playlist).find((t) => t.id === get(currentId));
  if (!ready() || !buf || !track || get(exporting)) return;
  const generation = ++exportGeneration;
  exporting.set(true);
  playerError.set('');
  try {
    const rendered = await renderProcessed(
      buf,
      get(effects),
      (ch, len, rate) => new OfflineAudioContext(ch, len, rate)
    );
    if (generation !== exportGeneration) return;
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
  } catch (error) {
    if (generation === exportGeneration) {
      playerError.set(error instanceof RangeError ? error.message : 'Export failed.');
    }
  } finally {
    if (generation === exportGeneration) exporting.set(false);
  }
}

export function disposePlayer(): void {
  loadGeneration++;
  playGeneration++;
  exportGeneration++;
  pendingLoad?.abort();
  pendingLoad = null;
  cancelAnimationFrame(raf);
  raf = 0;
  wantPlayId = null;
  loadingId = null;
  loadedId = null;
  engine?.dispose();
  engine = null;
  ctx = null;
  buffer.set(null);
  loading.set(false);
  exporting.set(false);
  playerError.set('');
  resetPosition();
}

export function stopPlayback(): void {
  playGeneration++;
  wantPlayId = null;
  engine?.stop();
  cancelAnimationFrame(raf);
  raf = 0;
  isPlaying.set(false);
  currentTime.set(0);
  progress.set(0);
}
