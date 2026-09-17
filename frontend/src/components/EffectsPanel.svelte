<script lang="ts">
  import { effects, setEffect, resetEffects, EFFECT_RANGES, EFFECT_PRESETS, applyPreset, matchingPreset } from '$lib/stores/effects';
  import Slider from './Slider.svelte';

  const selectedPreset = $derived(matchingPreset($effects));

  function semitones(speed: number): string {
    const value = 12 * Math.log2(speed);
    return `${value > 0 ? '+' : ''}${value.toFixed(2)} semitones`;
  }
</script>

<section class="effects-panel" aria-labelledby="effects-heading">
  <div class="section-heading effects-heading">
    <div>
      <h2 id="effects-heading">Shape the sound</h2>
      <p>Changes apply while the track plays.</p>
    </div>
    <button class="text-btn" onclick={resetEffects}>Reset</button>
  </div>

  <div class="preset-grid" role="group" aria-label="Sound presets">
    {#each EFFECT_PRESETS as preset}
      <button
        class="preset-btn"
        aria-pressed={selectedPreset === preset.name}
        onclick={() => applyPreset(preset)}
      >
        <strong>{preset.name}</strong>
        <span>{preset.description}</span>
      </button>
    {/each}
  </div>

  <div class="effects-primary">
    <Slider
      primary
      label="Speed"
      min={EFFECT_RANGES.speed[0]}
      max={EFFECT_RANGES.speed[1]}
      step={0.01}
      value={$effects.speed}
      valueText={`${Math.round($effects.speed * 100)}%`}
      scale={100}
      unit="%"
      sub={`Pitch follows speed · ${semitones($effects.speed)}`}
      onchange={(value) => setEffect('speed', value)}
    />
    <Slider
      primary
      label="Reverb"
      min={EFFECT_RANGES.reverb[0]}
      max={EFFECT_RANGES.reverb[1]}
      step={0.01}
      value={$effects.reverb}
      valueText={`${Math.round($effects.reverb * 100)}%`}
      scale={100}
      unit="%"
      sub="Dry / wet mix"
      onchange={(value) => setEffect('reverb', value)}
    />
  </div>

  <details class="secondary-effects">
    <summary>
      <span>Tone and output</span>
      <span class="secondary-values">{Math.round($effects.lowpass / 100) / 10} kHz · {$effects.gainDb.toFixed(0)} dB</span>
    </summary>
    <div class="secondary-grid">
      <Slider
        label="Tone (low-pass)"
        min={EFFECT_RANGES.lowpass[0]}
        max={EFFECT_RANGES.lowpass[1]}
        step={10}
        value={$effects.lowpass}
        valueText={`${Math.round($effects.lowpass)} Hz`}
        unit="Hz"
        onchange={(value) => setEffect('lowpass', value)}
      />
      <Slider
        label="Output"
        min={EFFECT_RANGES.gainDb[0]}
        max={EFFECT_RANGES.gainDb[1]}
        step={1}
        value={$effects.gainDb}
        valueText={`${$effects.gainDb.toFixed(0)} dB`}
        unit="dB"
        onchange={(value) => setEffect('gainDb', value)}
      />
    </div>
  </details>
</section>
