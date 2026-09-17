<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTrack } from '$lib/stores/playlist';
  import { buffer, isPlaying, loading, stopPlayback, toggle } from '$lib/stores/player';

  let { onqueue }: { onqueue: () => void } = $props();
  let visible = $state(false);

  onMount(() => {
    const transport = document.querySelector('.transport');
    if (!transport) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible = !entry.isIntersecting;
    });
    observer.observe(transport);
    return () => observer.disconnect();
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
