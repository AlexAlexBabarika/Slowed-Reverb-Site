import { expect, test, vi } from 'vitest';
import { bufferPeaks, computePeaks } from '../src/lib/audio/peaks';
import { FakeAudioBuffer } from './fakes';

test('progress draws reuse peaks and only width or buffer changes rescan samples', () => {
  const first = new FakeAudioBuffer(1, 4, 4);
  first.getChannelData(0).set([1, -1, 0.5, -0.5]);
  const read = vi.spyOn(first, 'getChannelData');
  const buffer = first as unknown as AudioBuffer;
  const peaks = bufferPeaks(buffer, 2);
  for (let frame = 0; frame < 60; frame++) expect(bufferPeaks(buffer, 2)).toBe(peaks);
  expect(read).toHaveBeenCalledOnce();
  expect(bufferPeaks(buffer, 4)).toEqual(computePeaks(new Float32Array([1, -1, 0.5, -0.5]), 4));
  expect(read).toHaveBeenCalledTimes(2);
  const second = new FakeAudioBuffer(1, 4, 4) as unknown as AudioBuffer;
  expect(bufferPeaks(second, 2)).not.toBe(peaks);
});
