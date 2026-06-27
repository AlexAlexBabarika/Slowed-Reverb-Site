<script lang="ts">
  import { uploadTrack, ApiError, type Track } from '$lib/api/tracks';

  let { onadd }: { onadd: (t: Track) => void } = $props();
  let busy = $state(false);
  let error = $state('');
  let fileInput: HTMLInputElement;

  async function pick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    busy = true;
    error = '';
    try {
      for (const file of files) {
        onadd(await uploadTrack(file));
      }
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Upload failed.';
    } finally {
      busy = false;
      input.value = '';
    }
  }
</script>

<div>
  <input
    bind:this={fileInput}
    type="file"
    accept="audio/*"
    multiple
    onchange={pick}
    hidden
  />
  <button class="btn btn-block" onclick={() => fileInput.click()} disabled={busy}>
    {busy ? 'Uploading…' : 'Upload song(s)'}
  </button>
  {#if error}<p class="err">{error}</p>{/if}
</div>
