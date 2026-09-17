import { get, writable } from 'svelte/store';
import { effects, normalizeEffects } from './effects';

export type Appearance = 'midnight' | 'cobalt';

export const PREFERENCES_KEY = 'slowed-reverb:workspace:v1';
export const appearance = writable<Appearance>('midnight');
export const shortcutsEnabled = writable(true);

export function connectPreferences(): () => void {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return () => {};
  }

  try {
    const saved: unknown = JSON.parse(storage.getItem(PREFERENCES_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && 'version' in saved && saved.version === 1) {
      if ('effects' in saved) effects.set(normalizeEffects(saved.effects));
      if ('appearance' in saved && (saved.appearance === 'midnight' || saved.appearance === 'cobalt')) {
        appearance.set(saved.appearance);
      }
      if ('shortcutsEnabled' in saved && typeof saved.shortcutsEnabled === 'boolean') {
        shortcutsEnabled.set(saved.shortcutsEnabled);
      }
    }
  } catch {}

  function persist(): void {
    try {
      storage.setItem(PREFERENCES_KEY, JSON.stringify({
        version: 1,
        effects: get(effects),
        appearance: get(appearance),
        shortcutsEnabled: get(shortcutsEnabled)
      }));
    } catch {}
  }

  const unsubscribe = [
    effects.subscribe(persist),
    appearance.subscribe(persist),
    shortcutsEnabled.subscribe(persist)
  ];
  return () => unsubscribe.forEach((stop) => stop());
}
