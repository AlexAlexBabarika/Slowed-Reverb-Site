<script lang="ts">
  import { addYoutube, ApiError, type Track } from '$lib/api/tracks';

  let { onadd }: { onadd: (t: Track) => void } = $props();
  let url = $state('');
  let busy = $state(false);
  let error = $state('');

  async function submit() {
    if (!url.trim()) return;
    busy = true;
    error = '';
    try {
      onadd(await addYoutube(url.trim()));
      url = '';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not fetch that link.';
    } finally {
      busy = false;
    }
  }
</script>

<div>
  <div class="input-row">
    <input
      class="text-input"
      type="url"
      placeholder="Enter YouTube URL to download"
      bind:value={url}
      disabled={busy}
      onkeydown={(e) => e.key === 'Enter' && submit()}
    />
    <button class="t-btn" aria-label="Add from YouTube" onclick={submit} disabled={busy || !url.trim()}>
      {busy ? '…' : '⬇'}
    </button>
  </div>
  {#if error}<p class="err">{error}</p>{/if}
</div>
