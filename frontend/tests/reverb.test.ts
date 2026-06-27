import { expect, test } from 'vitest';
import { computeImpulse, buildImpulseResponse } from '../src/lib/audio/reverb';
import { FakeAudioContext } from './fakes';

test('computeImpulse has the requested length', () => {
  expect(computeImpulse(1000, 2.0, 42).length).toBe(1000);
});

test('computeImpulse decays — tail is quieter than the head', () => {
  const ir = computeImpulse(2000, 3.0, 42);
  const head = Math.abs(ir[10]);
  const tail = Math.abs(ir[1990]);
  expect(tail).toBeLessThan(head);
});

test('computeImpulse is deterministic for a given seed', () => {
  expect(Array.from(computeImpulse(50, 2, 7))).toEqual(Array.from(computeImpulse(50, 2, 7)));
});

test('buildImpulseResponse returns a 2-channel buffer of seconds*sampleRate', () => {
  const ctx = new FakeAudioContext();
  const buf = buildImpulseResponse(ctx as unknown as BaseAudioContext, 2, 3) as any;
  expect(buf.numberOfChannels).toBe(2);
  expect(buf.length).toBe(2 * ctx.sampleRate);
});
