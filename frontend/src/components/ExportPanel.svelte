<script lang="ts">
  import { buffer, duration, loading, exporting, exportCurrent } from '$lib/stores/player';
  import { effects } from '$lib/stores/effects';
  import { REVERB_SECONDS } from '$lib/audio/reverb';

  let exportDuration = $derived(
    $buffer ? $duration / $effects.speed + ($effects.reverb > 0 ? REVERB_SECONDS : 0) : 0
  );

  function fmt(sec: number): string {
    const seconds = Math.ceil(sec);
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
</script>

<section class="export-panel" aria-labelledby="export-heading">
  <div>
    <span class="export-label">Your export</span>
    <h2 id="export-heading">{exportDuration ? `About ${fmt(exportDuration)}` : 'Make it your own'}</h2>
    <p>
      {#if exportDuration}
        {Math.round($effects.speed * 100)}% speed{#if $effects.reverb > 0}, including reverb tail{/if}
      {:else}
        Add a track to download your mix.
      {/if}
    </p>
  </div>
  <button class="btn btn-accent" onclick={exportCurrent} disabled={!$buffer || $loading || $exporting}>
    {$exporting ? 'Rendering WAV…' : 'Download WAV'}
  </button>
  <span class="export-note" role="status">{$exporting ? 'Rendering with the current effects…' : 'WAV audio with your current effects'}</span>
</section>
