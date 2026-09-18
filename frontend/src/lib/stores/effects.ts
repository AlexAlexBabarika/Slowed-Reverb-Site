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

const EFFECT_KEYS = Object.keys(EFFECT_RANGES) as (keyof EffectState)[];

export interface EffectPreset {
  name: string;
  description: string;
  effects: EffectState;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  { name: 'Original', description: 'Untouched audio', effects: { ...DEFAULT_EFFECTS } },
  { name: 'Slowed', description: 'Warm and spacious', effects: { speed: 0.85, lowpass: 18000, reverb: 0.22, gainDb: -2 } },
  { name: 'Dream', description: 'Deep and distant', effects: { speed: 0.72, lowpass: 8000, reverb: 0.45, gainDb: -3 } },
  { name: 'Afterhours', description: 'Soft and intimate', effects: { speed: 0.9, lowpass: 2800, reverb: 0.28, gainDb: -3 } }
];

export const effects = writable<EffectState>({ ...DEFAULT_EFFECTS });

export function setEffect(key: keyof EffectState, value: number): void {
  if (!Number.isFinite(value)) return;
  const [min, max] = EFFECT_RANGES[key];
  effects.update((s) => ({ ...s, [key]: clamp(value, min, max) }));
}

export function normalizeEffects(value: unknown): EffectState {
  const normalized = { ...DEFAULT_EFFECTS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return normalized;
  const saved = value as Record<string, unknown>;
  for (const key of EFFECT_KEYS) {
    const candidate = saved[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      normalized[key] = clamp(candidate, ...EFFECT_RANGES[key]);
    }
  }
  return normalized;
}

export function applyPreset(preset: EffectPreset): void {
  effects.set({ ...preset.effects });
}

export function matchingPreset(state: EffectState): string | undefined {
  return EFFECT_PRESETS.find((preset) => EFFECT_KEYS.every((key) => preset.effects[key] === state[key]))?.name;
}

export function resetEffects(): void {
  effects.set({ ...DEFAULT_EFFECTS });
}
