<script lang="ts">
  import { effects, setEffect, resetEffects, EFFECT_RANGES } from '$lib/stores/effects';
  import Slider from './Slider.svelte';

  function semitones(speed: number): string {
    const st = 12 * Math.log2(speed);
    const r = st.toFixed(2);
    return `${st > 0 ? '+' : ''}${r} semitones`;
  }
</script>

<section class="card">
  <div class="card-title">Apply effects 🤖</div>

  <div class="effects">
    <Slider
      label="Speed"
      min={EFFECT_RANGES.speed[0]}
      max={EFFECT_RANGES.speed[1]}
      step={0.01}
      value={$effects.speed}
      valueText={`${Math.round($effects.speed * 100)}%`}
      sub={semitones($effects.speed)}
      onchange={(v) => setEffect('speed', v)}
    />

    <Slider
      label="Low-pass"
      min={EFFECT_RANGES.lowpass[0]}
      max={EFFECT_RANGES.lowpass[1]}
      step={10}
      value={$effects.lowpass}
      valueText={`${Math.round($effects.lowpass)} Hz`}
      onchange={(v) => setEffect('lowpass', v)}
    />

    <Slider
      label="Reverb"
      min={EFFECT_RANGES.reverb[0]}
      max={EFFECT_RANGES.reverb[1]}
      step={0.01}
      value={$effects.reverb}
      valueText={`${Math.round($effects.reverb * 100)}%`}
      onchange={(v) => setEffect('reverb', v)}
    />

    <Slider
      label="Gain"
      min={EFFECT_RANGES.gainDb[0]}
      max={EFFECT_RANGES.gainDb[1]}
      step={1}
      value={$effects.gainDb}
      valueText={`${$effects.gainDb.toFixed(0)} dB`}
      onchange={(v) => setEffect('gainDb', v)}
    />

    <div class="spacer"></div>
    <p class="hint">Pitch follows speed — the classic slowed + reverb sound.</p>
    <button class="btn btn-ghost btn-block" onclick={resetEffects}>Reset effects</button>
  </div>
</section>
