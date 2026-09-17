import { get } from 'svelte/store';
import { buffer, currentTime, duration, loading, next, prev, seekFraction, stopPlayback, toggle, toggleLoop } from './stores/player';
import { shortcutsEnabled } from './stores/preferences';

const INTERACTIVE = 'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="button"], [role="textbox"]';

export function handleShortcut(event: KeyboardEvent, openHelp: () => void): void {
  if (
    !get(shortcutsEnabled) || event.defaultPrevented || event.repeat || event.isComposing ||
    event.ctrlKey || event.metaKey || event.altKey ||
    document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') ||
    event.composedPath().some((node) => node instanceof Element && node.closest(INTERACTIVE))
  ) return;

  if (event.key === '?') {
    event.preventDefault();
    openHelp();
    return;
  }

  if (event.key === 'Escape') {
    if (!get(buffer) && !get(loading)) return;
    event.preventDefault();
    stopPlayback();
    return;
  }

  if (!get(buffer) || get(loading)) return;

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    if (event.shiftKey) {
      if (event.key === 'ArrowLeft') prev();
      else next();
    } else if (get(duration) > 0) {
      const offset = event.key === 'ArrowLeft' ? -5 : 5;
      seekFraction((get(currentTime) + offset) / get(duration));
    }
    return;
  }

  if (event.shiftKey) return;
  if (event.key === ' ') {
    event.preventDefault();
    toggle();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    toggleLoop();
  }
}
