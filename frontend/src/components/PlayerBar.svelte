<script lang="ts">
  import Waveform from './Waveform.svelte';
  import {
    isPlaying,
    progress,
    currentTime,
    duration,
    buffer,
    looping,
    exporting,
    toggle,
    prev,
    next,
    seekFraction,
    toggleLoop,
    exportCurrent
  } from '$lib/stores/player';

  function fmt(sec: number): string {
    const s = Math.max(0, Math.floor(sec) || 0);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }
</script>

<div class="player">
  <div class="player-inner">
    <button class="t-btn" aria-label="Previous track" onclick={prev} disabled={!$buffer}>⏮</button>
    <button class="t-btn" aria-label={$isPlaying ? 'Pause' : 'Play'} onclick={toggle} disabled={!$buffer}>
      {$isPlaying ? '⏸' : '▶'}
    </button>
    <button class="t-btn" aria-label="Next track" onclick={next} disabled={!$buffer}>⏭</button>

    <span class="t-time">{fmt($currentTime)} / {fmt($duration)}</span>

    <div class="t-wave">
      <Waveform buffer={$buffer} progress={$progress} height={46} onseek={seekFraction} />
    </div>

    <button
      class="t-btn"
      class:is-on={$looping}
      aria-label="Loop"
      aria-pressed={$looping}
      onclick={toggleLoop}
      disabled={!$buffer}>↺</button
    >
    <button
      class="t-btn"
      aria-label="Download processed track"
      title="Download (slowed + reverb)"
      onclick={exportCurrent}
      disabled={!$buffer || $exporting}>{$exporting ? '…' : '⬇'}</button
    >
  </div>
</div>
