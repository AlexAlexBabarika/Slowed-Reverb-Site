<script lang="ts">
  import type { Track } from '$lib/api/tracks';
  import UploadPanel from './UploadPanel.svelte';
  import YoutubePanel from './YoutubePanel.svelte';

  let {
    open,
    onclose,
    onadd
  }: {
    open: boolean;
    onclose: () => void;
    onadd: (track: Track) => void;
  } = $props();

  let mode = $state<'upload' | 'youtube'>('upload');
  let dialog: HTMLDialogElement;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="sheet import-sheet"
  onclose={onclose}
  onclick={(event) => {
    if (event.currentTarget === event.target) onclose();
  }}
>
  <div class="sheet-body">
    <div class="section-heading">
      <div>
        <h2>Add audio</h2>
        <p>Choose a file or paste a YouTube link.</p>
      </div>
      <button class="icon-btn" aria-label="Close add audio" onclick={onclose}>×</button>
    </div>
    <fieldset class="mode-switch">
      <legend class="visually-hidden">Audio source</legend>
      <button class:is-active={mode === 'upload'} onclick={() => (mode = 'upload')}>Upload</button>
      <button class:is-active={mode === 'youtube'} onclick={() => (mode = 'youtube')}>YouTube</button>
    </fieldset>
    {#if mode === 'upload'}
      <UploadPanel {onadd} />
    {:else}
      <YoutubePanel {onadd} />
    {/if}
  </div>
</dialog>
