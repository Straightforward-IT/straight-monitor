<template>
  <div
    class="minute-select"
    :class="{ 'minute-select--compact': compact, 'minute-select--disabled': disabled || readonly }"
  >
    <select
      :value="selectedValue"
      :disabled="disabled || readonly"
      :aria-label="ariaLabel"
      :aria-invalid="ariaInvalid"
      :aria-describedby="ariaDescribedby"
      @change="selectMinutes"
    >
      <option
        v-if="legacyValue !== null"
        :value="legacyValue"
        disabled
      >
        {{ legacyValue }}
      </option>
      <option
        v-for="minute in minuteOptions"
        :key="minute"
        :value="minute"
      >
        {{ minute }}
      </option>
    </select>
    <span aria-hidden="true">Min.</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: [Number, String], default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 150 },
  step: { type: Number, default: 15 },
  ariaLabel: { type: String, default: 'Minuten' },
  ariaInvalid: { type: [Boolean, String], default: undefined },
  ariaDescribedby: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const minuteOptions = computed(() => {
  const options = [];
  for (let minute = props.min; minute <= props.max; minute += props.step) options.push(minute);
  return options;
});
const numericValue = computed(() => Number(props.modelValue));
const selectedValue = computed(() => Number.isFinite(numericValue.value) ? numericValue.value : props.min);
const legacyValue = computed(() => minuteOptions.value.includes(selectedValue.value) ? null : selectedValue.value);

function selectMinutes(event) {
  emit('update:modelValue', Number(event.target.value));
}
</script>

<style scoped>
.minute-select { display: inline-grid; grid-template-columns: 1fr auto; align-items: center; width: 96px; height: 36px; overflow: hidden; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--text); font-variant-numeric: tabular-nums; }
.minute-select select { width: 100%; min-width: 0; height: 100%; padding: 0 2px 0 6px; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-weight: 500; text-align: right; cursor: pointer; }
.minute-select > span { padding-right: 6px; color: var(--muted); font-size: .85em; white-space: nowrap; }
.minute-select:focus-within { border-color: var(--primary); outline: 2px solid color-mix(in srgb, var(--primary) 28%, transparent); outline-offset: 1px; }
.minute-select--disabled { background: var(--hover); color: var(--muted); opacity: .65; }
.minute-select--disabled select { cursor: not-allowed; }
.minute-select--compact { width: 76px; height: 26px; border-radius: 4px; font-size: 11px; }
@media (max-width: 760px) {
  .minute-select--compact { width: 96px; height: 40px; font-size: 14px; }
}
</style>