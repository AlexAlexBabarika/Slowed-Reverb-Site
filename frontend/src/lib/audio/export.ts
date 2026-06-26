import type { EffectState } from '../stores/effects';
import { dbToGain } from './math';
import { buildImpulseResponse } from './reverb';

export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < tag.length; i++) view.setUint8(offset + i, tag.charCodeAt(i));
  };

  writeTag(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);            // fmt chunk size
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeTag(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][frame]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

export async function renderProcessed(
  buffer: AudioBuffer,
  state: EffectState,
  makeOffline: (channels: number, length: number, sampleRate: number) => OfflineAudioContext
): Promise<AudioBuffer> {
  // Output length shrinks/stretches with speed (playbackRate).
  const length = Math.ceil(buffer.length / state.speed);
  const ctx = makeOffline(buffer.numberOfChannels, length, buffer.sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = state.speed;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = state.lowpass;

  const convolver = ctx.createConvolver();
  convolver.buffer = buildImpulseResponse(ctx, 2.5, 3.0);
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  const master = ctx.createGain();
  wet.gain.value = state.reverb;
  dry.gain.value = 1 - state.reverb;
  master.gain.value = dbToGain(state.gainDb);

  source.connect(lowpass);
  lowpass.connect(dry);
  lowpass.connect(convolver);
  convolver.connect(wet);
  dry.connect(master);
  wet.connect(master);
  master.connect(ctx.destination);

  source.start();
  return ctx.startRendering();
}

export function exportFilename(track: { filename: string }): string {
  const base = track.filename.replace(/\.[^.]+$/, '');
  return `${base} (slowed + reverb).wav`;
}
