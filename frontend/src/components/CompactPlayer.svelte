<script lang="ts">
  import { tick } from 'svelte';
  import { currentTrack } from '$lib/stores/playlist';
  import { buffer, isPlaying, loading, stopPlayback, toggle } from '$lib/stores/player';

  let { onqueue }: { onqueue: () => void } = $props();
  let visible = $state(false);

  $effect(() => {
    if (!$currentTrack) {
      visible = false;
      return;
    }
    let cancelled = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio < 1;
    }, { threshold: 1 });
    void tick().then(() => {
      if (cancelled) return;
      const transport = document.getElementById('main-transport');
      if (transport) observer.observe(transport);
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  });
</script>

{#if $currentTrack}
  <div class="compact-player" class:is-visible={visible}>
    <button class="compact-queue" onclick={onqueue}>Queue</button>
    <span class="compact-title" title={$currentTrack.filename}>{$currentTrack.filename}</span>
    <button
      class="compact-control"
      aria-label={$isPlaying ? 'Pause' : 'Play'}
      onclick={toggle}
      disabled={!$buffer || $loading}
    >
      {#if $isPlaying}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
      {/if}
    </button>
    <button class="compact-control" aria-label="Stop" onclick={stopPlayback} disabled={!$buffer && !$loading}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1" /></svg>
    </button>
  </div>
{/if}
