<script lang="ts">
  import { onMount } from 'svelte';
  import { addToPlaylist, currentTrack, initializePlaylist } from '$lib/stores/playlist';
  import { effects } from '$lib/stores/effects';
  import type { Track } from '$lib/api/tracks';
  import { syncTrack, applyLiveEffects, disposePlayer, playerError } from '$lib/stores/player';
  import EffectsPanel from '../components/EffectsPanel.svelte';
  import Playlist from '../components/Playlist.svelte';
  import YoutubePanel from '../components/YoutubePanel.svelte';
  import UploadPanel from '../components/UploadPanel.svelte';
  import PlayerBar from '../components/PlayerBar.svelte';

  let background = $state<'synthwave' | 'dark'>('synthwave');
  let initialization = $state<'loading' | 'ready' | 'error'>('loading');
  let bootstrap: AbortController | null = null;

  async function initialize() {
    bootstrap?.abort();
    const controller = new AbortController();
    bootstrap = controller;
    initialization = 'loading';
    try {
      await initializePlaylist(controller.signal);
      initialization = 'ready';
    } catch {
      if (!controller.signal.aborted) initialization = 'error';
    }
  }

  function added(t: Track) {
    addToPlaylist(t);
  }

  // Load (decode) the audio once whenever the selected track changes — no
  // refetch on effect changes.
  $effect(() => {
    syncTrack($currentTrack);
  });

  // Push live effect changes into the running graph (zero network).
  $effect(() => {
    $effects;
    applyLiveEffects();
  });

  onMount(() => {
    void initialize();
    return () => {
      bootstrap?.abort();
      disposePlayer();
    };
  });
</script>

<svelte:head>
  <title>Slowed x Reverb 💿</title>
</svelte:head>

<main class="app {background}">
  <header class="app-header">
    <div class="bg-switch">
      <button
        class="bg-btn synthwave"
        class:is-active={background === 'synthwave'}
        aria-label="Synthwave background"
        aria-pressed={background === 'synthwave'}
        onclick={() => (background = 'synthwave')}
      ></button>
      <button
        class="bg-btn dark"
        class:is-active={background === 'dark'}
        aria-label="Dark background"
        aria-pressed={background === 'dark'}
        onclick={() => (background = 'dark')}
      ></button>
    </div>
    <h1 class="app-title">Slowed x Reverb 💿</h1>
    <div class="header-spacer"></div>
  </header>

  <div class="main-container">
    <div class="cards">
      <EffectsPanel />

      <section class="card playlist-card">
        <div class="card-title">Playlist 📼</div>
        {#if initialization === 'ready'}
          <Playlist />
          <YoutubePanel onadd={added} />
          <UploadPanel onadd={added} />
        {:else if initialization === 'error'}
          <p class="err" role="alert">Could not initialize your playlist. Retry to enable imports.</p>
          <button class="btn" onclick={initialize}>Retry</button>
        {:else}
          <p role="status">Loading your playlist…</p>
        {/if}
        {#if $playerError}<p class="err" role="alert">{$playerError}</p>{/if}
      </section>
    </div>

    <PlayerBar />
  </div>
</main>
