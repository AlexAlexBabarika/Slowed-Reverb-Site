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
    loading,
    stopPlayback,
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
    <button class="t-btn" aria-label="Previous track" onclick={prev} disabled={!$buffer || $loading}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M3 3h2v14H3zM17 3v14L6 10z" />
      </svg>
    </button>
    <button class="t-btn" aria-label={$isPlaying ? 'Pause' : 'Play'} onclick={toggle} disabled={!$buffer || $loading}>
      {$isPlaying ? '⏸' : '▶'}
    </button>
    <button class="t-btn" aria-label="Stop" onclick={stopPlayback} disabled={!$buffer && !$loading}>■</button>
    <button class="t-btn" aria-label="Next track" onclick={next} disabled={!$buffer || $loading}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M15 3h2v14h-2zM3 3l11 7-11 7z" />
      </svg>
    </button>

    <span class="t-time">
      {#if $loading}
        Loading…
      {:else}
        {fmt($progress === 1 ? Math.round($duration) : $currentTime)} / {fmt(Math.round($duration))}
      {/if}
    </span>

    <div class="t-wave">
      <Waveform buffer={$buffer} progress={$progress} height={46} onseek={seekFraction} />
    </div>

    <button
      class="t-btn t-repeat"
      class:is-on={$looping}
      aria-label="Repeat current track"
      aria-pressed={$looping}
      onclick={toggleLoop}
      disabled={!$buffer || $loading}>↺</button
    >
    <button
      class="t-btn t-download"
      aria-label="Download processed track"
      title="Download (slowed + reverb)"
      onclick={exportCurrent}
      disabled={!$buffer || $loading || $exporting}>{$exporting ? '…' : '⬇'}</button
    >
  </div>
</div>
