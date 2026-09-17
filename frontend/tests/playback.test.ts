import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { AudioEngine } from '../src/lib/audio/engine';
import type { Track } from '../src/lib/api/tracks';
import { DEFAULT_EFFECTS, resetEffects } from '../src/lib/stores/effects';
import { currentId, playlist, removeFromPlaylist, setCurrent } from '../src/lib/stores/playlist';
import * as player from '../src/lib/stores/player';
import { FakeAudioBuffer, FakeAudioContext, FakeNode } from './fakes';

class Source extends FakeNode {
  onended: (() => void) | null = null;
  startOffset = 0;
  stops: number[] = [];
  start(_when = 0, offset = 0) { this.startOffset = offset; }
  stop(when = 0) { this.stops.push(when); }
  end() { this.onended?.(); }
}

class Context extends FakeAudioContext {
  static instances: Context[] = [];
  sampleRate = 1000;
  sources: Source[] = [];
  closes = 0;
  resumes = 0;
  constructor() { super(); Context.instances.push(this); }
  createBufferSource() {
    const source = new Source(this);
    this.sources.push(source);
    return source;
  }
  decodeAudioData(data?: ArrayBuffer) {
    const seconds = data ? new Float64Array(data)[0] : 60;
    return Promise.resolve(new FakeAudioBuffer(2, this.sampleRate * seconds, this.sampleRate));
  }
  resume() { this.resumes++; return Promise.resolve(); }
  close() { this.closes++; return Promise.resolve(); }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(seconds: number) {
  return new Response(new Float64Array([seconds]).buffer);
}

const A: Track = { id: 'a', filename: 'A.wav', artist: '', duration: 60, url: '/a' };
const B: Track = { id: 'b', filename: 'B.wav', artist: '', duration: 120, url: '/b' };
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
const engines: AudioEngine[] = [];

function frame() {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(0);
}

async function loaded() {
  await player.syncTrack(A);
  return Context.instances[0];
}

async function loadedEngine() {
  const ctx = new Context();
  const engine = new AudioEngine(ctx as unknown as AudioContext);
  engines.push(engine);
  await engine.load('/a');
  engine.applyEffects(DEFAULT_EFFECTS);
  return { ctx, engine };
}

beforeEach(() => {
  vi.useFakeTimers();
  Context.instances = [];
  frames = new Map();
  frameId = 0;
  resetEffects();
  playlist.set([A, B]);
  currentId.set(A.id);
  player.looping.set(false);
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => response(url === '/b' ? 120 : 60)));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  player.disposePlayer();
  engines.splice(0).forEach((engine) => engine.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('speed changes preserve elapsed position and pause/resume uses the rebased offset', async () => {
  const { ctx, engine } = await loadedEngine();
  await engine.play();
  ctx.currentTime = 10;
  engine.applyEffects({ ...DEFAULT_EFFECTS, speed: 0.5 });
  expect(engine.currentTime).toBe(10);
  ctx.currentTime = 20;
  engine.pause();
  expect(engine.currentTime).toBe(15);
  ctx.currentTime = 30;
  await engine.play();
  expect(ctx.sources.at(-1)?.startOffset).toBe(15);
  ctx.currentTime = 40;
  engine.applyEffects({ ...DEFAULT_EFFECTS, speed: 2 });
  expect(engine.currentTime).toBe(20);
  ctx.currentTime = 80;
  expect(engine.currentTime).toBe(60);
});

test('seek clamps to the buffer and seeking to EOF pauses without a natural end', async () => {
  const { ctx, engine } = await loadedEngine();
  const ended = vi.fn();
  engine.onended = ended;
  await engine.seek(-10);
  expect(engine.currentTime).toBe(0);
  await engine.play();
  await engine.seek(100);
  expect(engine.currentTime).toBe(60);
  expect(engine.isPlaying).toBe(false);
  expect(ended).not.toHaveBeenCalled();
  await engine.play();
  expect(ctx.sources.at(-1)?.startOffset).toBe(0);
});

test('pause fades the old graph, preserves position, and resumes with a fresh convolver', async () => {
  const { ctx, engine } = await loadedEngine();
  engine.applyEffects({ ...DEFAULT_EFFECTS, reverb: 1 });
  await engine.play();
  const oldNodes = [...ctx.created];
  const output = oldNodes.find((node) => node.connections.includes(ctx.destination))!;
  const oldSource = ctx.sources[0];
  const ended = oldSource.onended!;
  const callback = vi.fn();
  engine.onended = callback;
  ctx.currentTime = 5;
  engine.pause();
  expect(oldSource.stops).toEqual([5.02]);
  expect(output.gain.value).toBe(0);
  expect(engine.currentTime).toBe(5);
  ended();
  expect(callback).not.toHaveBeenCalled();
  await engine.play();
  expect(ctx.sources[1].startOffset).toBe(5);
  expect(oldNodes).not.toContain(ctx.sources[1].connections[0]);
  vi.advanceTimersByTime(20);
  expect(oldSource.connections).toEqual([]);
  expect(oldNodes.every((node) => node.connections.length === 0)).toBe(true);
});

test('HTTP failure is rejected before attempting audio decoding', async () => {
  const { ctx, engine } = await loadedEngine();
  const decode = vi.spyOn(ctx, 'decodeAudioData');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
  await expect(engine.decode('/missing')).rejects.toThrow('404');
  expect(decode).not.toHaveBeenCalled();
});

test('a late decode cannot replace the latest selection or its playable buffer', async () => {
  const first = deferred<FakeAudioBuffer>();
  const decode = vi.spyOn(Context.prototype, 'decodeAudioData');
  decode.mockImplementationOnce(() => first.promise);
  const loadingA = player.syncTrack(A);
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
  const fetchMock = vi.mocked(fetch);
  const signal = fetchMock.mock.calls[0][1]?.signal;
  setCurrent(B.id);
  await player.syncTrack(B);
  expect(signal?.aborted).toBe(true);
  first.resolve(new FakeAudioBuffer(2, 60000, 1000));
  await loadingA;
  expect(get(player.duration)).toBe(120);
  player.toggle();
  expect(Context.instances[0].sources.at(-1)?.buffer).toBe(get(player.buffer));
  expect(get(player.playerError)).toBe('');
});

test('removing a track during decode cannot repopulate the empty player', async () => {
  const pending = deferred<FakeAudioBuffer>();
  const decode = vi.spyOn(Context.prototype, 'decodeAudioData').mockReturnValueOnce(pending.promise);
  playlist.set([A]);
  const loading = player.syncTrack(A);
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
  removeFromPlaylist(A.id);
  await player.syncTrack(null);
  pending.resolve(new FakeAudioBuffer(2, 60000, 1000));
  await loading;
  expect(get(player.buffer)).toBeNull();
  expect(get(player.duration)).toBe(0);
  expect(get(player.loading)).toBe(false);
  player.toggle();
  expect(Context.instances[0].sources).toHaveLength(0);
});

test('transport cannot use a stale buffer during a replacement or after its failure', async () => {
  const ctx = await loaded();
  player.toggle();
  ctx.currentTime = 20;
  frame();
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  setCurrent(B.id);
  const loading = player.syncTrack(B);
  expect(get(player.buffer)).toBeNull();
  expect(get(player.currentTime)).toBe(0);
  expect(get(player.progress)).toBe(0);
  player.toggle();
  player.seekFraction(0.5);
  player.next();
  await player.exportCurrent();
  expect(ctx.sources).toHaveLength(1);
  expect(get(player.exporting)).toBe(false);
  pending.reject(new Error('network failure'));
  await loading;
  expect(get(player.playerError)).toMatch(/Could not load/);
  expect(get(player.duration)).toBe(0);
  player.toggle();
  expect(ctx.sources).toHaveLength(1);
  setCurrent(A.id);
  vi.stubGlobal('fetch', vi.fn(async () => response(60)));
  await player.syncTrack(A);
  expect(get(player.duration)).toBe(60);
});

test('selection changes gate playback and export before the page sync effect runs', async () => {
  const ctx = await loaded();
  setCurrent(B.id);
  player.toggle();
  await player.exportCurrent();
  expect(ctx.sources).toHaveLength(0);
  expect(get(player.exporting)).toBe(false);
});

test('an explicit play request joins an existing load without a second fetch', async () => {
  const pending = deferred<Response>();
  const fetchMock = vi.fn(() => pending.promise);
  vi.stubGlobal('fetch', fetchMock);
  const loading = player.syncTrack(A);
  player.playTrack(A.id);
  pending.resolve(response(60));
  await loading;
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(get(player.isPlaying)).toBe(true);
});

test('stopping during a load cancels autoplay without discarding the selected track', async () => {
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  const loading = player.syncTrack(A);
  player.playTrack(A.id);
  player.stopPlayback();
  pending.resolve(response(60));
  await loading;
  expect(get(player.buffer)?.duration).toBe(60);
  expect(get(player.isPlaying)).toBe(false);
  expect(Context.instances[0].sources).toHaveLength(0);
});

test('a canceled autoplay request cannot carry over to another selection', async () => {
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn((url: string) => url === '/a' ? pending.promise : Promise.resolve(response(120))));
  const loading = player.syncTrack(A);
  player.playTrack(A.id);
  setCurrent(B.id);
  await player.syncTrack(B);
  pending.resolve(response(60));
  await loading;
  expect(get(player.isPlaying)).toBe(false);
  expect(get(player.duration)).toBe(120);
});

test('pause in the final 60ms never advances the playlist', async () => {
  const ctx = await loaded();
  player.toggle();
  frame();
  const ended = ctx.sources[0].onended!;
  ctx.currentTime = 59.97;
  player.toggle();
  ended();
  frame();
  expect(get(player.isPlaying)).toBe(false);
  expect(get(currentId)).toBe(A.id);
  expect(get(player.currentTime)).toBeCloseTo(59.97);
  expect(frames.size).toBe(0);
});

test('natural completion advances without an animation frame and stops at the queue end', async () => {
  const ctx = await loaded();
  player.toggle();
  ctx.sources[0].end();
  expect(get(currentId)).toBe(B.id);
  await vi.waitFor(() => expect(get(player.isPlaying)).toBe(true));
  expect(get(player.duration)).toBe(120);
  ctx.sources.at(-1)!.end();
  expect(get(currentId)).toBe(B.id);
  expect(get(player.isPlaying)).toBe(false);
  expect(get(player.currentTime)).toBe(120);
  expect(get(player.progress)).toBe(1);
  expect(frames.size).toBe(0);
});

test('single-track EOF replay and manual next/previous restart from zero', async () => {
  playlist.set([A]);
  const ctx = await loaded();
  player.toggle();
  ctx.sources[0].end();
  expect(get(player.isPlaying)).toBe(false);
  player.toggle();
  expect(ctx.sources.at(-1)?.startOffset).toBe(0);
  ctx.currentTime = 10;
  player.next();
  expect(ctx.sources.at(-1)?.startOffset).toBe(0);
  ctx.currentTime = 20;
  player.prev();
  expect(ctx.sources).toHaveLength(4);
  expect(ctx.sources.at(-1)?.startOffset).toBe(0);
});

test('repeat restarts the current track without fetching or ticking', async () => {
  const ctx = await loaded();
  player.toggleLoop();
  player.toggle();
  ctx.sources[0].end();
  expect(get(currentId)).toBe(A.id);
  expect(get(player.isPlaying)).toBe(true);
  expect(get(player.currentTime)).toBe(0);
  expect(ctx.sources.at(-1)?.startOffset).toBe(0);
  expect(fetch).toHaveBeenCalledOnce();
});

test('stop resets position and silences the graph without causing queue advancement', async () => {
  const ctx = await loaded();
  player.toggle();
  ctx.currentTime = 30;
  frame();
  player.stopPlayback();
  ctx.sources[0].end();
  expect(get(player.currentTime)).toBe(0);
  expect(get(player.progress)).toBe(0);
  expect(get(player.duration)).toBe(60);
  expect(get(player.isPlaying)).toBe(false);
  expect(get(currentId)).toBe(A.id);
  player.toggle();
  expect(ctx.sources.at(-1)?.startOffset).toBe(0);
});

test('clearing the player resets all timeline stores', async () => {
  const ctx = await loaded();
  player.toggle();
  ctx.currentTime = 25;
  frame();
  await player.syncTrack(null);
  expect(get(player.currentTime)).toBe(0);
  expect(get(player.progress)).toBe(0);
  expect(get(player.duration)).toBe(0);
  expect(get(player.buffer)).toBeNull();
  expect(get(player.isPlaying)).toBe(false);
  expect(frames.size).toBe(0);
});

test('disposal stops sources, disconnects active and fading graphs, and closes the context', async () => {
  const ctx = await loaded();
  player.toggle();
  player.toggle();
  player.toggle();
  const ended = ctx.sources.at(-1)!.onended!;
  player.disposePlayer();
  ended();
  expect(ctx.closes).toBe(1);
  expect(ctx.sources.every((source) => source.stops.length > 0 && source.connections.length === 0)).toBe(true);
  expect(ctx.created.every((node) => node.connections.length === 0)).toBe(true);
  expect(get(player.buffer)).toBeNull();
  expect(get(player.isPlaying)).toBe(false);
  expect(frames.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  await player.syncTrack(A);
  expect(Context.instances).toHaveLength(2);
});

test('disposal invalidates pending loads', async () => {
  const pending = deferred<FakeAudioBuffer>();
  const decode = vi.spyOn(Context.prototype, 'decodeAudioData').mockReturnValueOnce(pending.promise);
  const loading = player.syncTrack(A);
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
  player.disposePlayer();
  pending.resolve(new FakeAudioBuffer(2, 60000, 1000));
  await loading;
  expect(get(player.buffer)).toBeNull();
  expect(get(player.playerError)).toBe('');
});

test('rejected context resume leaves a recoverable playback error', async () => {
  const ctx = await loaded();
  vi.spyOn(ctx, 'resume').mockRejectedValue(new Error('resume failed'));
  player.toggle();
  await vi.waitFor(() => expect(get(player.isPlaying)).toBe(false));
  expect(get(player.playerError)).toMatch(/Press Play/);
});
