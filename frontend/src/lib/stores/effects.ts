import { writable } from 'svelte/store';
import { clamp } from '../audio/math';

export interface EffectState {
  speed: number;   // playbackRate; pitch is COUPLED (see plan Global Constraints)
  lowpass: number; // Hz
  reverb: number;  // wet mix 0..1
  gainDb: number;  // master gain in dB
}

export const DEFAULT_EFFECTS: EffectState = {
  speed: 1.0,
  lowpass: 20000,
  reverb: 0.0,
  gainDb: 0
};

export const EFFECT_RANGES: Record<keyof EffectState, [number, number]> = {
  speed: [0.1, 2.0],
  lowpass: [20, 20000],
  reverb: [0, 1],
  gainDb: [-24, 24]
};

export const effects = writable<EffectState>({ ...DEFAULT_EFFECTS });

export function setEffect(key: keyof EffectState, value: number): void {
  const [min, max] = EFFECT_RANGES[key];
  effects.update((s) => ({ ...s, [key]: clamp(value, min, max) }));
}

export function resetEffects(): void {
  effects.set({ ...DEFAULT_EFFECTS });
}
