<script lang="ts">
  import { computePeaks } from '$lib/audio/peaks';

  let { buffer, progress = 0, onseek }: {
    buffer: AudioBuffer | null; progress: number; onseek: (fraction: number) => void;
  } = $props();

  let canvas: HTMLCanvasElement;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, w, h);
    if (!buffer) return;
    const peaks = computePeaks(buffer.getChannelData(0), Math.max(1, Math.floor(w / 2)));
    const mid = h / 2;
    ctx.fillStyle = '#3a3550';
    peaks.forEach((p, i) => {
      const x = (i / peaks.length) * w;
      ctx.fillRect(x, mid + p.min * mid, Math.max(1, w / peaks.length), (p.max - p.min) * mid);
    });
    ctx.fillStyle = '#b07cff';
    ctx.fillRect(0, 0, w * progress, 2 * devicePixelRatio);
  }

  $effect(() => { buffer; progress; draw(); });

  function seek(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    onseek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }
</script>

<canvas bind:this={canvas} onpointerdown={seek} class="wave"></canvas>

<style>
  .wave { width: 100%; height: 96px; display: block; cursor: pointer; touch-action: none; }
</style>
