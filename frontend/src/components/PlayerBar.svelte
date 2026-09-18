<script lang="ts">
  import Waveform from './Waveform.svelte';
  import {
    isPlaying,
    progress,
    currentTime,
    duration,
    buffer,
    looping,
    loading,
    stopPlayback,
    toggle,
    prev,
    next,
    seekFraction,
    toggleLoop,
    syncTrack
  } from '$lib/stores/player';
  import { currentTrack } from '$lib/stores/playlist';
  import { effects } from '$lib/stores/effects';
  import { shortcutsEnabled } from '$lib/stores/preferences';

  let {
    onadd,
    onqueue
  }: {
    onadd: () => void;
    onqueue: () => void;
  } = $props();

  function fmt(sec: number): string {
    const seconds = Math.max(0, Math.floor(sec) || 0);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  }

</script>

<section class="stage" aria-labelledby="track-heading">
  {#if $currentTrack}
    <div class="track-heading">
      <div class="track-heading-copy">
        <h2 id="track-heading" title={$currentTrack.filename}>{$currentTrack.filename}</h2>
        <p>
          {#if $loading}
            Loading audio…
          {:else if !$buffer}
            Audio unavailable
          {:else if $isPlaying}
            <span class="playing-dot" aria-hidden="true"></span> Playing at {Math.round($effects.speed * 100)}% speed
          {:else if $progress === 1}
            Finished
          {:else if $progress > 0}
            Paused at {fmt($currentTime)}
          {:else}
            Ready to play
          {/if}
        </p>
      </div>
      <div class="track-duration">
        <span>Original duration</span>
        <strong>{fmt(Math.round($duration || $currentTrack.duration))}</strong>
      </div>
    </div>

    <div class="hero-wave">
      <Waveform
        buffer={$buffer}
        progress={$progress}
        reverb={$effects.reverb}
        height={176}
        onseek={seekFraction}
      />
    </div>

    <div class="source-time" aria-hidden="true">
      <span>{fmt($progress === 1 ? Math.round($duration) : $currentTime)}</span>
      <span>{fmt(Math.round($duration))}</span>
    </div>

    {#if !$loading && !$buffer}
      <button class="btn btn-primary retry-track" onclick={() => syncTrack($currentTrack)}>Retry loading audio</button>
    {/if}

    <div class="transport">
      <div class="transport-main" id="main-transport">
        <button class="transport-btn" aria-label="Previous track" aria-keyshortcuts={$shortcutsEnabled ? 'Shift+ArrowLeft' : undefined} onclick={prev} disabled={!$buffer || $loading}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14M19 6l-10 6 10 6z" /></svg>
        </button>
        <button class="play-btn" aria-label={$isPlaying ? 'Pause' : 'Play'} aria-keyshortcuts={$shortcutsEnabled ? 'Space' : undefined} onclick={toggle} disabled={!$buffer || $loading}>
          {#if $isPlaying}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14" /></svg>
          {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
          {/if}
        </button>
        <button class="transport-btn" aria-label="Stop" aria-keyshortcuts={$shortcutsEnabled ? 'Escape' : undefined} onclick={stopPlayback} disabled={!$buffer && !$loading}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1" /></svg>
        </button>
        <button class="transport-btn" aria-label="Next track" aria-keyshortcuts={$shortcutsEnabled ? 'Shift+ArrowRight' : undefined} onclick={next} disabled={!$buffer || $loading}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v14M5 6l10 6-10 6z" /></svg>
        </button>
      </div>
      <button
        class="repeat-btn"
        class:is-on={$looping}
        aria-label="Repeat current track"
        aria-keyshortcuts={$shortcutsEnabled ? 'R' : undefined}
        aria-pressed={$looping}
        onclick={toggleLoop}
        disabled={!$buffer || $loading}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 7l3 3-3 3M6 17l-3-3 3-3M20 10H9a5 5 0 0 0-5 5M4 14h11a5 5 0 0 0 5-5" /></svg>
        <span>Repeat {$looping ? 'on' : 'off'}</span>
      </button>
      <span class="timeline-label">Source timeline</span>
      <button class="queue-mobile-btn" onclick={onqueue}>Queue</button>
    </div>
  {:else}
    <div class="empty-stage">
      <div class="empty-wave" aria-hidden="true">
        {#each [12, 24, 42, 70, 34, 86, 46, 64, 28, 48, 20, 34, 14] as bar}
          <i style:height={`${bar}px`}></i>
        {/each}
      </div>
      <h2 id="track-heading">Add a track to begin</h2>
      <p>Upload audio or bring in a YouTube link, then shape the speed, tone, and space.</p>
      <button class="btn btn-primary" onclick={onadd}>Add audio</button>
    </div>
  {/if}
</section>
