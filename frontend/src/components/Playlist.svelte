<script lang="ts">
  import { playlist, currentId, removeFromPlaylist } from '$lib/stores/playlist';
  import { deleteTrack, ApiError } from '$lib/api/tracks';
  import { playTrack } from '$lib/stores/player';

  let removing = $state<string | null>(null);
  let error = $state('');

  async function remove(id: string) {
    if (removing) return;
    removing = id;
    error = '';
    try {
      await deleteTrack(id);
      removeFromPlaylist(id);
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not remove this track. Try again.';
    } finally {
      removing = null;
    }
  }
</script>

<div class="playlist-scroll">
  {#if $playlist.length === 0}
    <p class="playlist-empty">No tracks yet — upload a file or add a YouTube link.</p>
  {:else}
    <ul class="playlist">
      {#each $playlist as track, i (track.id)}
        <li class="track" class:is-active={track.id === $currentId}>
          <button class="track-main" onclick={() => playTrack(track.id)}>
            <span class="track-num">{i + 1}</span>
            <span class="track-meta">
              <span class="track-title" title={track.filename}>{track.filename}</span>
              {#if track.artist}<span class="track-sub">{track.artist}</span>{/if}
            </span>
          </button>
          <button
            class="track-del"
            aria-label="Remove {track.filename}"
            title="Remove"
            disabled={removing !== null}
            onclick={() => remove(track.id)}>✕</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</div>
{#if error}<p class="err" role="alert">{error}</p>{/if}
