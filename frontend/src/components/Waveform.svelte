<script lang="ts">
  import { computePeaks } from '$lib/audio/peaks';

  let {
    buffer,
    progress = 0,
    height = 96,
    onseek
  }: {
    buffer: AudioBuffer | null;
    progress: number;
    height?: number;
    onseek: (fraction: number) => void;
  } = $props();

  let canvas: HTMLCanvasElement;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr)));
    const h = (canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr)));
    ctx.clearRect(0, 0, w, h);
    if (!buffer) return;

    const barW = Math.max(1, Math.floor(2 * dpr));
    const gap = Math.max(1, Math.floor(1 * dpr));
    const stride = barW + gap;
    const bars = Math.max(1, Math.floor(w / stride));
    const peaks = computePeaks(buffer.getChannelData(0), bars);
    const mid = h / 2;
    const playedX = w * progress;

    peaks.forEach((p, i) => {
      const x = i * stride;
      const amp = Math.max(Math.abs(p.min), Math.abs(p.max));
      const barH = Math.max(2 * dpr, amp * (h - 2 * dpr));
      ctx.fillStyle = x < playedX ? '#FAFAFA' : 'rgba(255,255,255,0.45)';
      ctx.fillRect(x, mid - barH / 2, barW, barH);
    });

    // playhead
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(Math.min(playedX, w - dpr), 0, Math.max(1, dpr), h);
  }

  $effect(() => {
    buffer;
    progress;
    height;
    draw();
  });

  function seek(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    onseek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }
</script>

<canvas
  bind:this={canvas}
  onpointerdown={seek}
  class="wave"
  style="height: {height}px"
  role="slider"
  tabindex="0"
  aria-label="Seek"
  aria-valuenow={Math.round(progress * 100)}
  aria-valuemin="0"
  aria-valuemax="100"
></canvas>

<style>
  .wave {
    width: 100%;
    display: block;
    cursor: pointer;
    touch-action: none;
  }
</style>
