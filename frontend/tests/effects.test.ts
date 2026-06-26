import { expect, test } from 'vitest';
import { get } from 'svelte/store';
import { effects, setEffect, resetEffects, DEFAULT_EFFECTS } from '../src/lib/stores/effects';

test('store starts at defaults', () => {
  resetEffects();
  expect(get(effects)).toEqual(DEFAULT_EFFECTS);
});

test('setEffect clamps to range', () => {
  resetEffects();
  setEffect('speed', 99);
  expect(get(effects).speed).toBe(2.0);
  setEffect('speed', -5);
  expect(get(effects).speed).toBe(0.1);
});

test('setEffect updates only the named key', () => {
  resetEffects();
  setEffect('reverb', 0.5);
  expect(get(effects)).toEqual({ ...DEFAULT_EFFECTS, reverb: 0.5 });
});
