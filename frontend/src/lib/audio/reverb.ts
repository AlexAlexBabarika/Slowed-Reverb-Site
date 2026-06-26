// Deterministic LCG so tests are stable; quality is fine for a reverb tail.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Decaying white noise: white * (1 - t/length)^decay. */
export function computeImpulse(length: number, decay: number, seed = 1): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const env = Math.pow(1 - i / length, decay);
    out[i] = (rand() * 2 - 1) * env;
  }
  return out;
}

export function buildImpulseResponse(
  ctx: BaseAudioContext,
  seconds: number,
  decay: number
): AudioBuffer {
  const length = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    buffer.getChannelData(ch).set(computeImpulse(length, decay, 1 + ch));
  }
  return buffer;
}
