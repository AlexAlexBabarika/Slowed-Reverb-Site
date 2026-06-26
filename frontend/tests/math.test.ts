import { expect, test } from 'vitest';
import { clamp, dbToGain } from '../src/lib/audio/math';

test('clamp bounds the value', () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(11, 0, 10)).toBe(10);
});

test('dbToGain maps 0 dB to unity', () => {
  expect(dbToGain(0)).toBeCloseTo(1.0, 6);
});

test('dbToGain maps -6 dB to ~0.501', () => {
  expect(dbToGain(-6)).toBeCloseTo(0.50118, 4);
});
