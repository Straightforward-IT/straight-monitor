<template>
  <div class="calendar-controls">
    <CustomTooltip :text="previousLabel">
      <button type="button" class="calendar-controls__nav" :aria-label="previousLabel" @click="shift(-1)">
        <FontAwesomeIcon :icon="faChevronLeft" />
      </button>
    </CustomTooltip>
    <DatePicker v-model="selectedDate" inline :mode="type">
      <template #default="{ toggle }">
        <button type="button" class="calendar-controls__picker" :aria-label="pickerLabel" @click="toggle">{{ label }}</button>
      </template>
    </DatePicker>
    <CustomTooltip :text="nextLabel">
      <button type="button" class="calendar-controls__nav" :aria-label="nextLabel" @click="shift(1)">
        <FontAwesomeIcon :icon="faChevronRight" />
      </button>
    </CustomTooltip>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import CustomTooltip from '@/components/CustomTooltip.vue';
import DatePicker from '@/components/ui-elements/DatePicker.vue';

const props = defineProps({
  modelValue: { type: Date, default: () => new Date() },
  type: { type: String, default: 'day', validator: value => ['day', 'week', 'month', 'year'].includes(value) },
});
const emit = defineEmits(['update:modelValue']);
const selectedDate = computed({ get: () => props.modelValue || new Date(), set: value => emit('update:modelValue', value) });
const typeLabel = computed(() => ({ day: 'Tag', week: 'Kalenderwoche', month: 'Monat', year: 'Jahr' })[props.type]);
const pickerLabel = computed(() => `${typeLabel.value} wählen`);
const previousLabel = computed(() => `Vorheriger ${typeLabel.value}`);
const nextLabel = computed(() => `Nächster ${typeLabel.value}`);
const label = computed(() => {
  const date = selectedDate.value;
  if (props.type === 'week') return `KW ${isoWeek(date)} ${isoWeekYear(date)}`;
  if (props.type === 'month') return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  if (props.type === 'year') return String(date.getFullYear());
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
});

function isoWeek(date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil(((value - yearStart) / 86400000 + 1) / 7);
}

function isoWeekYear(date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  return value.getUTCFullYear();
}

function shift(amount) {
  const date = new Date(selectedDate.value);
  if (props.type === 'day') date.setDate(date.getDate() + amount);
  if (props.type === 'week') date.setDate(date.getDate() + amount * 7);
  if (props.type === 'month') date.setMonth(date.getMonth() + amount);
  if (props.type === 'year') date.setFullYear(date.getFullYear() + amount);
  emit('update:modelValue', date);
}
</script>

<style scoped>
.calendar-controls { position: absolute; top: 100%; right: 12px; z-index: 5; display: flex; align-items: center; gap: 4px; height: 24px; white-space: nowrap; }
.calendar-controls__picker, .calendar-controls__nav { height: 24px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 0 0 5px 5px; color: var(--text); background: var(--tile-bg); font: inherit; font-size: 0.72rem; box-shadow: none; }
.calendar-controls__picker { width: 150px; padding: 0 6px; cursor: pointer; }
.calendar-controls :deep(.dp-layer--inline) { right: -44px; left: auto; }
.calendar-controls__nav { display: inline-flex; align-items: center; justify-content: center; width: 28px; padding: 0; color: var(--muted); cursor: pointer; }
.calendar-controls__picker:hover, .calendar-controls__nav:hover { color: var(--primary); border-color: var(--primary); }
.calendar-controls__nav:focus-visible, .calendar-controls__picker:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
@media (max-width: 720px) { .calendar-controls { right: 6px; gap: 3px; } }
</style>