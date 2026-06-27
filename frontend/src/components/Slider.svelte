<script lang="ts">
  let {
    label,
    min,
    max,
    step,
    value,
    valueText,
    sub = '',
    onchange
  }: {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    valueText: string;
    sub?: string;
    onchange: (value: number) => void;
  } = $props();

  function handle(e: Event) {
    onchange(Number((e.currentTarget as HTMLInputElement).value));
  }
</script>

<label class="slider">
  <span class="slider-row">
    <span>{label}: {valueText}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
  </span>
  <input type="range" {min} {max} {step} {value} oninput={handle} aria-label={label} />
</label>
