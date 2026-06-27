import { expect, test } from 'vitest';
import { encodeWav, exportFilename } from '../src/lib/audio/export';

function readTag(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1),
    view.getUint8(offset + 2), view.getUint8(offset + 3)
  );
}

test('encodeWav writes a RIFF/WAVE header', () => {
  const buf = encodeWav([new Float32Array([0, 0.5, -0.5])], 44100);
  const view = new DataView(buf);
  expect(readTag(view, 0)).toBe('RIFF');
  expect(readTag(view, 8)).toBe('WAVE');
  expect(readTag(view, 12)).toBe('fmt ');
  expect(readTag(view, 36)).toBe('data');
});

test('encodeWav data length matches samples*channels*2 bytes', () => {
  const buf = encodeWav([new Float32Array([0, 0, 0, 0]), new Float32Array([0, 0, 0, 0])], 44100);
  const view = new DataView(buf);
  // 44-byte header + 4 frames * 2 channels * 2 bytes = 44 + 16
  expect(view.getUint32(40, true)).toBe(16);
  expect(buf.byteLength).toBe(44 + 16);
});

test('exportFilename swaps extension for .wav', () => {
  expect(exportFilename({ filename: 'song.mp3' })).toBe('song (slowed + reverb).wav');
  expect(exportFilename({ filename: 'no-ext' })).toBe('no-ext (slowed + reverb).wav');
});
