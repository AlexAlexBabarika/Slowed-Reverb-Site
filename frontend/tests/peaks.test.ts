import { expect, test } from 'vitest';
import { computePeaks } from '../src/lib/audio/peaks';

test('returns the requested number of buckets', () => {
  const data = new Float32Array(1000).map((_, i) => Math.sin(i));
  expect(computePeaks(data, 50)).toHaveLength(50);
});

test('captures min and max within each bucket', () => {
  const data = new Float32Array([1, -1, 0.5, -0.5]);
  const peaks = computePeaks(data, 2);
  expect(peaks[0]).toEqual({ min: -1, max: 1 });
  expect(peaks[1]).toEqual({ min: -0.5, max: 0.5 });
});

test('handles buckets larger than sample count without crashing', () => {
  expect(computePeaks(new Float32Array([0.2]), 4)).toHaveLength(4);
});
