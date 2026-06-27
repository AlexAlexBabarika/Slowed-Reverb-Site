<script lang="ts">
  import { onDestroy } from 'svelte';
  import { addToPlaylist, currentTrack } from '$lib/stores/playlist';
  import { effects } from '$lib/stores/effects';
  import type { Track } from '$lib/api/tracks';
  import { syncTrack, applyLiveEffects, disposePlayer, playerError } from '$lib/stores/player';
  import EffectsPanel from '../components/EffectsPanel.svelte';
  import Playlist from '../components/Playlist.svelte';
  import YoutubePanel from '../components/YoutubePanel.svelte';
  import UploadPanel from '../components/UploadPanel.svelte';
  import PlayerBar from '../components/PlayerBar.svelte';

  let background = $state<'synthwave' | 'dark'>('synthwave');

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

  onDestroy(disposePlayer);
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
        <Playlist />
        {#if $playerError}<p class="err">{$playerError}</p>{/if}
        <YoutubePanel onadd={added} />
        <UploadPanel onadd={added} />
      </section>
    </div>

    <PlayerBar />
  </div>
</main>
