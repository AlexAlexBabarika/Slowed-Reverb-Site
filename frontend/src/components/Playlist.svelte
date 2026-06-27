<script lang="ts">
  import { playlist, currentId, removeFromPlaylist } from '$lib/stores/playlist';
  import { deleteTrack } from '$lib/api/tracks';
  import { playTrack } from '$lib/stores/player';

  async function remove(id: string) {
    try {
      await deleteTrack(id);
    } catch {
      /* drop locally even if the server call fails */
    }
    removeFromPlaylist(id);
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
            onclick={() => remove(track.id)}>✕</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</div>
