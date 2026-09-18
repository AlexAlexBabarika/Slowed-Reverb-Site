<script lang="ts">
  import { onMount } from 'svelte';
  import { bufferPeaks } from '$lib/audio/peaks';

  let {
    buffer,
    progress = 0,
    reverb = 0,
    height = 96,
    onseek
  }: {
    buffer: AudioBuffer | null;
    progress: number;
    reverb?: number;
    height?: number;
    onseek: (fraction: number) => void;
  } = $props();

  let canvas: HTMLCanvasElement;
  let width = $state(0);

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  });

  function drawBars(
    ctx: CanvasRenderingContext2D,
    peaks: { min: number; max: number }[],
    widthPixels: number,
    heightPixels: number,
    dpr: number,
    color: string,
    offset: number,
    playedX?: number
  ) {
    const barWidth = Math.max(2, Math.floor(3 * dpr));
    const gap = Math.max(2, Math.floor(3 * dpr));
    const stride = barWidth + gap;
    const middle = heightPixels / 2 + offset;
    peaks.forEach((peak, index) => {
      const x = index * stride;
      if (playedX !== undefined && x >= playedX) return;
      const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
      const barHeight = Math.max(4 * dpr, amplitude * (heightPixels - 26 * dpr));
      ctx.fillStyle = color;
      ctx.roundRect(x, middle - barHeight / 2, barWidth, barHeight, barWidth / 2);
    });
    ctx.fill();
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const widthPixels = (canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr)));
    const heightPixels = (canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr)));
    ctx.clearRect(0, 0, widthPixels, heightPixels);
    if (!buffer) return;

    const stride = Math.max(4, Math.floor(6 * dpr));
    const bars = Math.max(1, Math.floor(widthPixels / stride));
    const peaks = bufferPeaks(buffer, bars);
    const playedX = widthPixels * progress;

    ctx.beginPath();
    drawBars(
      ctx,
      peaks,
      widthPixels,
      heightPixels,
      dpr,
      `rgba(156,177,205,${0.18 + reverb * 0.25})`,
      (3 + reverb * 9) * dpr
    );
    ctx.beginPath();
    drawBars(ctx, peaks, widthPixels, heightPixels, dpr, 'rgba(48,91,220,0.72)', 0);
    ctx.beginPath();
    drawBars(ctx, peaks, widthPixels, heightPixels, dpr, '#ad5139', 0, playedX);

    ctx.fillStyle = '#152c4a';
    ctx.fillRect(Math.min(playedX, widthPixels - 2 * dpr), 0, Math.max(2, dpr), heightPixels);
  }

  $effect(() => {
    buffer;
    progress;
    reverb;
    height;
    width;
    draw();
  });

  function seek(event: PointerEvent) {
    if (!buffer) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    onseek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
  }

  function keySeek(event: KeyboardEvent) {
    if (!buffer?.duration) return;
    let target = progress;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') target += 5 / buffer.duration;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') target -= 5 / buffer.duration;
    else return;
    event.preventDefault();
    onseek(Math.min(1, Math.max(0, target)));
  }
</script>

<canvas
  bind:this={canvas}
  onpointerdown={seek}
  onkeydown={keySeek}
  class="wave"
  style:height={`${height}px`}
  role="slider"
  tabindex={buffer ? 0 : -1}
  aria-disabled={!buffer}
  aria-label="Track position"
  aria-valuetext={buffer
    ? `${Math.round(progress * buffer.duration)} seconds of ${Math.round(buffer.duration)} seconds`
    : 'No audio loaded'}
  aria-valuenow={Math.round(progress * 100)}
  aria-valuemin="0"
  aria-valuemax="100"
></canvas>
