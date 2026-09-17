<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { addToPlaylist, currentTrack, initializePlaylist, playlist } from '$lib/stores/playlist';
  import { effects } from '$lib/stores/effects';
  import { appearance, connectPreferences } from '$lib/stores/preferences';
  import { handleShortcut } from '$lib/keyboard';
  import type { Track } from '$lib/api/tracks';
  import { syncTrack, applyLiveEffects, disposePlayer, playerError } from '$lib/stores/player';
  import EffectsPanel from '../components/EffectsPanel.svelte';
  import Playlist from '../components/Playlist.svelte';
  import PlayerBar from '../components/PlayerBar.svelte';
  import CompactPlayer from '../components/CompactPlayer.svelte';
  import ImportDialog from '../components/ImportDialog.svelte';
  import QueueDialog from '../components/QueueDialog.svelte';
  import ExportPanel from '../components/ExportPanel.svelte';
  import ShortcutsDialog from '../components/ShortcutsDialog.svelte';

  let initialization = $state<'loading' | 'ready' | 'error'>('loading');
  let bootstrap: AbortController | null = null;
  let importOpen = $state(false);
  let queueOpen = $state(false);
  let shortcutsOpen = $state(false);

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

  function added(track: Track) {
    addToPlaylist(track);
  }

  async function importFromQueue() {
    queueOpen = false;
    await tick();
    document.getElementById('add-audio')?.focus();
    importOpen = true;
  }

  $effect(() => {
    syncTrack($currentTrack);
  });

  $effect(() => {
    $effects;
    applyLiveEffects();
  });

  onMount(() => {
    const disconnectPreferences = connectPreferences();
    void initialize();
    return () => {
      disconnectPreferences();
      bootstrap?.abort();
      disposePlayer();
    };
  });
</script>

<svelte:head>
  <title>Slowed × Reverb</title>
  <meta
    name="description"
    content="Slow down audio, shape the tone, add reverb, and export the result."
  />
  <meta name="theme-color" content={$appearance === 'midnight' ? '#152c4a' : '#2448b4'} />
</svelte:head>

<svelte:window onkeydown={(event) => handleShortcut(event, () => (shortcutsOpen = true))} />

<a class="skip-link" href="#workspace">Skip to workspace</a>
<main class="app" class:cobalt={$appearance === 'cobalt'}>
  <header class="masthead">
    <h1 translate="no">Slowed × Reverb</h1>
    <div class="masthead-actions">
      <button
        class="appearance-btn"
        aria-label="Change appearance"
        aria-pressed={$appearance === 'cobalt'}
        onclick={() => appearance.update((value) => value === 'midnight' ? 'cobalt' : 'midnight')}
      >
        <span class="appearance-dot" aria-hidden="true"></span>
        <span class="appearance-label">Appearance</span>
      </button>
      <button id="add-audio" class="btn btn-ice" aria-label="Add audio" onclick={() => (importOpen = true)} disabled={initialization !== 'ready'}>
        <span aria-hidden="true">+</span> <span class="add-label">Add audio</span>
      </button>
    </div>
  </header>

  <div class="workspace" id="workspace">
    {#if initialization === 'loading'}
      <section class="stage status-stage" aria-live="polite">
        <div class="status-mark" aria-hidden="true"></div>
        <h2>Loading your tracks…</h2>
        <p>The listening room will be ready in a moment.</p>
      </section>
    {:else if initialization === 'error'}
      <section class="stage status-stage" role="alert">
        <h2>Could not load your tracks</h2>
        <p>Check the connection and retry to import or play audio.</p>
        <button class="btn btn-primary" onclick={initialize}>Retry</button>
      </section>
    {:else}
      <PlayerBar onadd={() => (importOpen = true)} onqueue={() => (queueOpen = true)} />
      <EffectsPanel />
      <ExportPanel />
      {#if $playerError}<p class="error-message player-error" role="alert">{$playerError}</p>{/if}

      <aside class="queue-panel" aria-labelledby="queue-heading">
        <div class="section-heading">
          <div>
            <h2 id="queue-heading">Queue</h2>
            <p>{$playlist.length} {$playlist.length === 1 ? 'track' : 'tracks'}</p>
          </div>
          <button class="icon-btn" aria-label="Add audio" onclick={() => (importOpen = true)}>+</button>
        </div>
        <Playlist />
        <button class="btn btn-secondary queue-add" onclick={() => (importOpen = true)}>
          <span aria-hidden="true">+</span> Add audio
        </button>
      </aside>
    {/if}
  </div>

  <footer class="workspace-footer">
    <button class="text-btn" onclick={() => (shortcutsOpen = true)}>Keyboard shortcuts <kbd>?</kbd></button>
  </footer>

  {#if initialization === 'ready'}
    <CompactPlayer onqueue={() => (queueOpen = true)} />
  {/if}
</main>

<ImportDialog open={importOpen} onclose={() => (importOpen = false)} onadd={added} />
<ShortcutsDialog open={shortcutsOpen} onclose={() => (shortcutsOpen = false)} />
<QueueDialog
  open={queueOpen}
  onclose={() => (queueOpen = false)}
  onadd={importFromQueue}
/>
