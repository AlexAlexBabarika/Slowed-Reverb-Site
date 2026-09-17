import { expect, test, vi } from 'vitest';
import { renderLength, renderProcessed } from '../src/lib/audio/export';
import { DEFAULT_EFFECTS } from '../src/lib/stores/effects';
import { FakeAudioBuffer, FakeAudioContext } from './fakes';

function buffer(seconds: number, sampleRate = 1000): AudioBuffer {
  return new FakeAudioBuffer(2, seconds * sampleRate, sampleRate) as unknown as AudioBuffer;
}

test.each([0.1, 0.5, 1, 2])('offline render at %sx includes the reverb tail', async (speed) => {
  const input = buffer(10);
  const ctx = new FakeAudioContext();
  const startRendering = vi.fn(async () => buffer(10 / speed + 2.5));
  const factory = vi.fn(() => Object.assign(ctx, { startRendering }) as unknown as OfflineAudioContext);
  await renderProcessed(input, { ...DEFAULT_EFFECTS, speed, reverb: 0.5 }, factory);
  expect(factory).toHaveBeenCalledWith(2, (10 / speed + 2.5) * 1000, 1000);
  expect(startRendering).toHaveBeenCalledOnce();
});

test('dry export has only the time-stretched source duration', () => {
  expect(renderLength(buffer(10), { ...DEFAULT_EFFECTS, speed: 0.5 })).toBe(20000);
});

test.each([0, -1, NaN, Infinity])('invalid speed %s fails before allocating an offline context', async (speed) => {
  const factory = vi.fn<() => OfflineAudioContext>();
  await expect(renderProcessed(buffer(10), { ...DEFAULT_EFFECTS, speed }, factory)).rejects.toThrow(RangeError);
  expect(factory).not.toHaveBeenCalled();
});

test('unreasonable export allocations give an actionable error', async () => {
  const input = new FakeAudioBuffer(2, 1, 48000);
  input.length = 900 * 48000;
  const factory = vi.fn<() => OfflineAudioContext>();
  await expect(renderProcessed(input as unknown as AudioBuffer, { ...DEFAULT_EFFECTS, speed: 0.1 }, factory))
    .rejects.toThrow('Increase the speed or choose a shorter track.');
  expect(factory).not.toHaveBeenCalled();
});
