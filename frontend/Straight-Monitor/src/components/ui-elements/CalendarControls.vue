<template>
  <div class="calendar-controls">
    <CustomTooltip :text="previousLabel">
      <AppIconButton
        variant="secondary"
        size="sm"
        class="calendar-controls__nav"
        :label="previousLabel"
        @click="shift(-1)"
      >
        <FontAwesomeIcon :icon="faChevronLeft" />
      </AppIconButton>
    </CustomTooltip>
    <DatePicker
      v-model="selectedDate"
      inline
      :mode="type"
    >
      <template #default="{ toggle }">
        <AppButton
          variant="secondary"
          size="sm"
          class="calendar-controls__picker"
          :aria-label="pickerLabel"
          @click="toggle"
        >
          {{ label }}
        </AppButton>
      </template>
    </DatePicker>
    <CustomTooltip :text="nextLabel">
      <AppIconButton
        variant="secondary"
        size="sm"
        class="calendar-controls__nav"
        :label="nextLabel"
        @click="shift(1)"
      >
        <FontAwesomeIcon :icon="faChevronRight" />
      </AppIconButton>
    </CustomTooltip>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import CustomTooltip from '@/components/CustomTooltip.vue';
import DatePicker from '@/components/ui-elements/DatePicker.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

const props = defineProps({
  modelValue: { type: Date, default: () => new Date() },
  type: { type: String, default: 'day', validator: value => ['day', 'week', 'month', 'year'].includes(value) },
});
const emit = defineEmits(['update:modelValue']);
const selectedDate = computed({ get: () => props.modelValue || new Date(), set: value => emit('update:modelValue', value) });
const typeLabel = computed(() => ({ day: 'Tag', week: 'Kalenderwoche', month: 'Monat', year: 'Jahr' })[props.type]);
const pickerLabel = computed(() => `${typeLabel.value} wählen`);
const previousLabel = computed(() => props.type === 'week' ? 'Vorherige Kalenderwoche' : props.type === 'year' ? 'Vorheriges Jahr' : `Vorheriger ${typeLabel.value}`);
const nextLabel = computed(() => props.type === 'week' ? 'Nächste Kalenderwoche' : props.type === 'year' ? 'Nächstes Jahr' : `Nächster ${typeLabel.value}`);
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
.calendar-controls .calendar-controls__picker, .calendar-controls .calendar-controls__nav { min-height: 24px; height: 24px; border-radius: 0 0 5px 5px; font-size: 0.72rem; }
.calendar-controls .calendar-controls__picker { width: 150px; padding: 0 6px; }
.calendar-controls :deep(.dp-layer--inline) { right: -44px; left: auto; }
.calendar-controls .calendar-controls__nav { --app-button-icon-size: 28px; padding: 0; }
@media (max-width: 720px) { .calendar-controls { right: 6px; gap: 3px; } }
</style>
