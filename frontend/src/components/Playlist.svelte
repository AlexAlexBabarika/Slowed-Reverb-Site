<script lang="ts">
  import { playlist, currentId, removeFromPlaylist } from '$lib/stores/playlist';
  import { deleteTrack, ApiError } from '$lib/api/tracks';
  import { isPlaying, playTrack } from '$lib/stores/player';

  let { onselect = () => {} }: { onselect?: () => void } = $props();
  let removing = $state<string | null>(null);
  let error = $state('');

  function select(id: string) {
    playTrack(id);
    onselect();
  }

  async function remove(id: string, filename: string) {
    if (removing || !window.confirm(`Remove “${filename}” from this session?`)) return;
    removing = id;
    error = '';
    try {
      await deleteTrack(id);
      removeFromPlaylist(id);
    } catch (cause) {
      error = cause instanceof ApiError ? cause.message : 'Could not remove this track. Try again.';
    } finally {
      removing = null;
    }
  }

  function fmt(sec: number): string {
    const seconds = Math.max(0, Math.round(sec) || 0);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
</script>

<div class="playlist-scroll">
  {#if $playlist.length === 0}
    <div class="playlist-empty">
      <p>No tracks yet.</p>
      <span>Add audio to start a queue.</span>
    </div>
  {:else}
    <ol class="playlist">
      {#each $playlist as track, index (track.id)}
        <li class="track" class:is-active={track.id === $currentId}>
          <button class="track-main" onclick={() => select(track.id)}>
            <span class="track-num">
              {#if track.id === $currentId}
                <span class="track-bars" aria-hidden="true"><i></i><i></i><i></i></span>
              {:else}
                {index + 1}
              {/if}
            </span>
            <span class="track-meta">
              <span class="track-title" title={track.filename}>{track.filename}</span>
              <span class="track-sub">
                {#if track.id === $currentId}
                  {$isPlaying ? 'Playing' : 'Selected'} · {fmt(track.duration)}
                {:else}
                  {track.artist ? `${track.artist} · ` : ''}{fmt(track.duration)}
                {/if}
              </span>
            </span>
          </button>
          <button
            class="track-del"
            aria-label="Remove {track.filename}"
            title="Remove track"
            disabled={removing !== null}
            onclick={() => remove(track.id, track.filename)}
          >×</button>
        </li>
      {/each}
    </ol>
  {/if}
</div>
{#if error}<p class="error-message queue-error" role="alert">{error}</p>{/if}
