<script lang="ts">
  let {
    label,
    min,
    max,
    step,
    value,
    valueText,
    sub = '',
    primary = false,
    onchange
  }: {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    valueText: string;
    sub?: string;
    primary?: boolean;
    onchange: (value: number) => void;
  } = $props();

  function handle(event: Event) {
    onchange(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

<label class="slider-control" class:primary>
  <span class="slider-heading">
    <span>{label}</span>
    <strong>{valueText}</strong>
  </span>
  <input
    type="range"
    {min}
    {max}
    {step}
    {value}
    aria-valuetext={valueText}
    oninput={handle}
  />
  {#if sub}<span class="slider-sub">{sub}</span>{/if}
</label>
