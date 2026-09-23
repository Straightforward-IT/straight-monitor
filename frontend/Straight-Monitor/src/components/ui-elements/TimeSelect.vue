<template>
  <div
    class="time-select"
    :class="{ 'time-select--compact': compact, 'time-select--disabled': disabled }"
    role="group"
    :aria-label="ariaLabel"
    :aria-invalid="ariaInvalid"
    :aria-describedby="ariaDescribedby"
  >
    <select
      :value="selectedHour"
      :disabled="disabled"
      :aria-label="`${ariaLabel} Stunde`"
      @change="selectHour"
    >
      <option value="">--</option>
      <option
        v-for="hour in hours"
        :key="hour"
        :value="hour"
      >
        {{ hour }}
      </option>
    </select>
    <span aria-hidden="true">:</span>
    <select
      :value="selectedMinute"
      :disabled="disabled || !selectedHour"
      :aria-label="`${ariaLabel} Minuten`"
      @change="selectMinute"
    >
      <option
        v-if="legacyMinute"
        :value="legacyMinute"
        disabled
      >
        {{ legacyMinute }}
      </option>
      <option
        v-for="minute in minutes"
        :key="minute"
        :value="minute"
      >
        {{ minute }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  ariaLabel: { type: String, default: 'Uhrzeit' },
  ariaInvalid: { type: [Boolean, String], default: undefined },
  ariaDescribedby: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];
const parsedValue = computed(() => /^([01]\d|2[0-3]):([0-5]\d)$/.exec(props.modelValue || ''));
const selectedHour = computed(() => parsedValue.value?.[1] || '');
const selectedMinute = computed(() => parsedValue.value?.[2] || '00');
const legacyMinute = computed(() => {
  const minute = parsedValue.value?.[2];
  return minute && !minutes.includes(minute) ? minute : '';
});

function selectHour(event) {
  const hour = event.target.value;
  if (!hour) { emit('update:modelValue', ''); return; }
  const minute = minutes.includes(selectedMinute.value) ? selectedMinute.value : '00';
  emit('update:modelValue', `${hour}:${minute}`);
}

function selectMinute(event) {
  if (!selectedHour.value) return;
  emit('update:modelValue', `${selectedHour.value}:${event.target.value}`);
}
</script>

<style scoped>
.time-select { display: inline-grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 112px; height: 36px; overflow: hidden; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--text); font-variant-numeric: tabular-nums; }
.time-select select { width: 100%; min-width: 0; height: 100%; padding: 0 3px; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-weight: 500; text-align: center; cursor: pointer; }
.time-select > span { color: var(--muted); font-weight: 500; }
.time-select:focus-within { border-color: var(--primary); outline: 2px solid color-mix(in srgb, var(--primary) 28%, transparent); outline-offset: 1px; }
.time-select--disabled { background: var(--hover); color: var(--muted); opacity: .65; }
.time-select--disabled select { cursor: not-allowed; }
.time-select--compact { width: 101px; height: 26px; border-radius: 4px; font-size: 11px; }
@media (max-width: 760px) {
  .time-select--compact { width: 116px; height: 40px; font-size: 14px; }
}
</style>