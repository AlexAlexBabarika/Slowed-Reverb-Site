<script lang="ts">
  let {
    label, min, max, step, value, unit = '', onchange
  }: {
    label: string; min: number; max: number; step: number;
    value: number; unit?: string; onchange: (value: number) => void;
  } = $props();

  function handle(e: Event) {
    onchange(Number((e.currentTarget as HTMLInputElement).value));
  }
</script>

<label class="slider">
  <span class="row"><span>{label}</span><span class="val">{value}{unit}</span></span>
  <input type="range" {min} {max} {step} {value} oninput={handle} />
</label>

<style>
  .slider { display: block; }
  .row { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem; }
  .val { opacity: 0.7; }
  input[type='range'] {
    width: 100%; height: 44px; margin: 0; accent-color: #b07cff; touch-action: none;
  }
</style>
