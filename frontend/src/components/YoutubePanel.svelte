<script lang="ts">
  import { addYoutube, ApiError, type Track } from '$lib/api/tracks';

  let { onadd }: { onadd: (track: Track) => void } = $props();
  let url = $state('');
  let busy = $state(false);
  let error = $state('');

  async function submit() {
    if (!url.trim() || busy) return;
    busy = true;
    error = '';
    try {
      onadd(await addYoutube(url.trim()));
      url = '';
    } catch (cause) {
      error = cause instanceof ApiError ? cause.message : 'Could not add that link. Check it and try again.';
    } finally {
      busy = false;
    }
  }
</script>

<form class="youtube-form" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
  <div>
    <h3>Add a track from YouTube</h3>
    <p>Paste the full video URL. Processing can take a moment.</p>
  </div>
  <label for="youtube-url">YouTube URL</label>
  <input
    id="youtube-url"
    name="youtube-url"
    class="text-input"
    type="url"
    placeholder="https://youtube.com/watch?v=…"
    autocomplete="off"
    spellcheck="false"
    bind:value={url}
    disabled={busy}
  />
  <button class="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
    {busy ? 'Adding from YouTube…' : 'Add from YouTube'}
  </button>
  {#if error}<p class="error-message" role="alert">{error}</p>{/if}
</form>
