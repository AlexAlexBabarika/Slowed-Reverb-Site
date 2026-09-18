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
    scale = 1,
    unit = '',
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
    scale?: number;
    unit?: string;
    onchange: (value: number) => void;
  } = $props();

  const id = $props.id();

  function handle(event: Event) {
    onchange(Number((event.currentTarget as HTMLInputElement).value));
  }

  function editNumber(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const next = input.valueAsNumber / scale;
    if (Number.isFinite(next) && next >= min && next <= max) onchange(next);
  }

  function finishNumber(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const next = input.valueAsNumber / scale;
    const clamped = Number.isFinite(next) ? Math.max(min, Math.min(max, next)) : value;
    onchange(clamped);
    input.value = String(Number((clamped * scale).toFixed(2)));
  }
</script>

<div class="slider-control" class:primary>
  <span class="slider-heading">
    <label for={id}>{label}</label>
    <span class="value-editor">
      <input
        type="number"
        name={`${id}-value`}
        aria-label={`${label} value`}
        min={min * scale}
        max={max * scale}
        step={step * scale}
        value={Number((value * scale).toFixed(2))}
        oninput={editNumber}
        onblur={finishNumber}
      />
      <span>{unit}</span>
    </span>
  </span>
  <input
    {id}
    type="range"
    {min}
    {max}
    {step}
    {value}
    aria-valuetext={valueText}
    oninput={handle}
  />
  {#if sub}<span class="slider-sub">{sub}</span>{/if}
</div>
