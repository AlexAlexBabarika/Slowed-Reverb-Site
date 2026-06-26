import { expect, test, vi } from 'vitest';
import { AudioEngine } from '../src/lib/audio/engine';
import { FakeAudioContext } from './fakes';
import { DEFAULT_EFFECTS } from '../src/lib/stores/effects';

function engineWithLoadedBuffer() {
  const ctx = new FakeAudioContext();
  const engine = new AudioEngine(ctx as unknown as AudioContext);
  // inject a decoded buffer without going through fetch
  (engine as any).buffer = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
  return { ctx, engine };
}

test('applyEffects maps state onto the graph params', () => {
  const { engine } = engineWithLoadedBuffer();
  engine.applyEffects({ speed: 0.8, lowpass: 1200, reverb: 0.3, gainDb: -6 });
  const g = (engine as any).graph;
  expect(g.lowpass.frequency.value).toBeCloseTo(1200);
  expect(g.wet.gain.value).toBeCloseTo(0.3);
  expect(g.dry.gain.value).toBeCloseTo(0.7);
  expect(g.master.gain.value).toBeCloseTo(0.50118, 4); // -6 dB
});

test('play wires source through lowpass and applies speed', () => {
  const { engine } = engineWithLoadedBuffer();
  engine.applyEffects({ ...DEFAULT_EFFECTS, speed: 0.5 });
  engine.play(0);
  const src = (engine as any).source;
  expect(src.playbackRate.value).toBeCloseTo(0.5);
  expect(src.connections.length).toBeGreaterThan(0); // connected into the graph
  expect((src.connections as unknown[])[0]).toBe((engine as any).graph.lowpass);
  expect(engine.isPlaying).toBe(true);
});

test('load decodes the fetched buffer and returns duration', async () => {
  const { ctx, engine } = engineWithLoadedBuffer();
  (engine as any).buffer = null;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 })));
  const dur = await engine.load('/api/tracks/x/audio');
  expect(dur).toBeGreaterThan(0);
  expect((engine as any).buffer).not.toBeNull();
  void ctx;
});
