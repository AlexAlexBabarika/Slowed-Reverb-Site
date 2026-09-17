<script lang="ts">
  import { shortcutsEnabled } from '$lib/stores/preferences';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
  let dialog: HTMLDialogElement;

  const shortcuts = [
    ['Play / pause', 'Space'],
    ['Stop and rewind', 'Esc'],
    ['Seek 5 seconds', '← / →'],
    ['Previous / next track', 'Shift + ← / →'],
    ['Repeat current track', 'R'],
    ['Open this guide', '?']
  ];

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="sheet shortcuts-sheet"
  aria-labelledby="shortcuts-heading"
  onclose={onclose}
  onclick={(event) => {
    if (event.currentTarget === event.target) onclose();
  }}
>
  <div class="sheet-body">
    <div class="section-heading">
      <h2 id="shortcuts-heading">Keyboard shortcuts</h2>
      <button class="icon-btn" aria-label="Close keyboard shortcuts" onclick={onclose}>×</button>
    </div>
    <p class="shortcuts-note">Use these outside fields, controls, and dialogs. Seeking follows the source timeline.</p>
    <dl class="shortcut-list">
      {#each shortcuts as [action, keys]}
        <div><dt>{action}</dt><dd><kbd>{keys}</kbd></dd></div>
      {/each}
    </dl>
    <label class="shortcut-setting">
      <input type="checkbox" bind:checked={$shortcutsEnabled} />
      <span>Enable keyboard shortcuts</span>
    </label>
  </div>
</dialog>
