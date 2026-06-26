export function computePeaks(
  channel: Float32Array,
  buckets: number
): { min: number; max: number }[] {
  const result: { min: number; max: number }[] = [];
  const size = channel.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.min(channel.length, Math.floor((b + 1) * size));
    let min = 0;
    let max = 0;
    let seen = false;
    for (let i = start; i < end; i++) {
      const v = channel[i];
      if (!seen) { min = v; max = v; seen = true; }
      else { if (v < min) min = v; if (v > max) max = v; }
    }
    result.push({ min, max });
  }
  return result;
}
