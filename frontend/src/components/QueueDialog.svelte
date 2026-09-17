<script lang="ts">
  import { playlist } from '$lib/stores/playlist';
  import Playlist from './Playlist.svelte';

  let {
    open,
    onclose,
    onadd
  }: {
    open: boolean;
    onclose: () => void;
    onadd: () => void;
  } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="sheet queue-sheet"
  onclose={onclose}
  onclick={(event) => {
    if (event.currentTarget === event.target) onclose();
  }}
>
  <div class="sheet-body">
    <div class="section-heading">
      <div>
        <h2>Queue</h2>
        <p>{$playlist.length} {$playlist.length === 1 ? 'track' : 'tracks'}</p>
      </div>
      <button class="icon-btn" aria-label="Close queue" onclick={onclose}>×</button>
    </div>
    <Playlist onselect={onclose} />
    <button class="btn btn-primary" onclick={onadd}>
      <span aria-hidden="true">+</span> Add audio
    </button>
  </div>
</dialog>
