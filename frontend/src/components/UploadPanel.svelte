<script lang="ts">
  import { uploadTrack, ApiError, type Track } from '$lib/api/tracks';

  let { onadd }: { onadd: (track: Track) => void } = $props();
  let busy = $state(false);
  let error = $state('');
  let fileInput: HTMLInputElement;

  async function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    busy = true;
    error = '';
    try {
      for (const file of files) onadd(await uploadTrack(file));
    } catch (cause) {
      error = cause instanceof ApiError ? cause.message : 'Upload failed. Choose the file and try again.';
    } finally {
      busy = false;
      input.value = '';
    }
  }
</script>

<div class="import-mode">
  <div class="import-illustration" aria-hidden="true">
    {#each [18, 34, 62, 42, 78, 50, 28, 46, 22] as bar}
      <i style:height={`${bar}px`}></i>
    {/each}
  </div>
  <h3>Choose audio from this device</h3>
  <p>Pick one or more audio files. Your tracks stay in this browser session.</p>
  <input
    bind:this={fileInput}
    name="audio-files"
    type="file"
    accept="audio/*"
    multiple
    onchange={pick}
    hidden
  />
  <button class="btn btn-primary" onclick={() => fileInput.click()} disabled={busy}>
    {busy ? 'Uploading audio…' : 'Choose audio files'}
  </button>
  {#if error}<p class="error-message" role="alert">{error}</p>{/if}
</div>
