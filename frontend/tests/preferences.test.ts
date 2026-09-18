import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { applyPreset, DEFAULT_EFFECTS, EFFECT_PRESETS, effects, matchingPreset, resetEffects, setEffect } from '../src/lib/stores/effects';
import { appearance, connectPreferences, PREFERENCES_KEY, shortcutsEnabled } from '../src/lib/stores/preferences';

let disconnect = () => {};

beforeEach(() => {
  localStorage.clear();
  resetEffects();
  appearance.set('midnight');
  shortcutsEnabled.set(true);
});

afterEach(() => {
  disconnect();
  vi.restoreAllMocks();
});

test('restores settings before subscribing and persists only workspace preferences', () => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    version: 1, appearance: 'cobalt', effects: EFFECT_PRESETS[2].effects, shortcutsEnabled: false
  }));
  disconnect = connectPreferences();
  expect(get(appearance)).toBe('cobalt');
  expect(get(effects)).toEqual(EFFECT_PRESETS[2].effects);
  expect(get(shortcutsEnabled)).toBe(false);
  setEffect('speed', 0.81);
  appearance.set('midnight');
  shortcutsEnabled.set(true);
  expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({
    version: 1, appearance: 'midnight', effects: { ...EFFECT_PRESETS[2].effects, speed: 0.81 }, shortcutsEnabled: true
  });
  disconnect();
  const saved = localStorage.getItem(PREFERENCES_KEY);
  resetEffects();
  expect(localStorage.getItem(PREFERENCES_KEY)).toBe(saved);
});

test.each(['broken JSON', '[]', 'null', '"cobalt"', '{"version":2,"appearance":"cobalt"}'])(
  'invalid preferences %s cannot break initialization',
  (saved) => {
    localStorage.setItem(PREFERENCES_KEY, saved);
    disconnect = connectPreferences();
    expect(get(effects)).toEqual(DEFAULT_EFFECTS);
    expect(get(appearance)).toBe('midnight');
  }
);

test('stored effects are finite numbers in range; invalid fields retain defaults', () => {
  localStorage.setItem(PREFERENCES_KEY, '{"version":1,"effects":{"speed":99,"reverb":-3,"lowpass":"bad","gainDb":1e999},"appearance":"invalid","shortcutsEnabled":"false"}');
  disconnect = connectPreferences();
  expect(get(effects)).toEqual({ ...DEFAULT_EFFECTS, speed: 2, reverb: 0 });
  expect(get(appearance)).toBe('midnight');
  expect(get(shortcutsEnabled)).toBe(true);
});

test.each(['getItem', 'setItem'] as const)('storage %s errors do not prevent edits', (method) => {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('Unavailable'); });
  expect(() => { disconnect = connectPreferences(); }).not.toThrow();
  expect(() => setEffect('speed', 0.8)).not.toThrow();
  expect(get(effects).speed).toBe(0.8);
});

test('blocked access to localStorage still allows playback settings', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Denied'); });
  expect(() => { disconnect = connectPreferences(); }).not.toThrow();
  setEffect('reverb', 0.2);
  expect(get(effects).reverb).toBe(0.2);
});

test('presets replace every effect without mutating their definitions', () => {
  setEffect('gainDb', 12);
  applyPreset(EFFECT_PRESETS[1]);
  expect(get(effects)).toEqual(EFFECT_PRESETS[1].effects);
  expect(matchingPreset(get(effects))).toBe('Slowed');
  setEffect('lowpass', 1000);
  expect(matchingPreset(get(effects))).toBeUndefined();
  expect(EFFECT_PRESETS[1].effects.lowpass).toBe(18000);
  applyPreset(EFFECT_PRESETS[0]);
  expect(get(effects)).toEqual(DEFAULT_EFFECTS);
});

test.each([NaN, Infinity, -Infinity])('nonfinite edit %s cannot enter the effects graph', (value) => {
  setEffect('speed', value);
  expect(get(effects)).toEqual(DEFAULT_EFFECTS);
});
