<template>
  <AppIconButton
    variant="secondary"
    size="sm"
    class="mobile-date-nav-button"
    label="Vorherige Woche"
    @click="emit('previous-week')"
  >
    <font-awesome-icon icon="fa-solid fa-angles-left" />
  </AppIconButton>
  <AppIconButton
    variant="secondary"
    size="sm"
    class="mobile-date-nav-button"
    label="Vorheriger Tag"
    @click="emit('previous-day')"
  >
    <font-awesome-icon icon="fa-solid fa-chevron-left" />
  </AppIconButton>
  <DatePicker
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #default="{ toggle }">
      <AppIconButton
        variant="outlined"
        size="sm"
        class="mobile-date-nav-picker"
        label="Datum wählen"
        @click="toggle"
      >
        <font-awesome-icon icon="fa-solid fa-calendar" />
      </AppIconButton>
    </template>
  </DatePicker>
  <AppIconButton
    variant="secondary"
    size="sm"
    class="mobile-date-nav-button"
    label="Nächster Tag"
    @click="emit('next-day')"
  >
    <font-awesome-icon icon="fa-solid fa-chevron-right" />
  </AppIconButton>
  <AppIconButton
    variant="secondary"
    size="sm"
    class="mobile-date-nav-button"
    label="Nächste Woche"
    @click="emit('next-week')"
  >
    <font-awesome-icon icon="fa-solid fa-angles-right" />
  </AppIconButton>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faAnglesLeft, faAnglesRight, faChevronLeft, faChevronRight, faCalendar } from '@fortawesome/free-solid-svg-icons';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import DatePicker from '@/components/ui-elements/DatePicker.vue';

library.add(faAnglesLeft, faAnglesRight, faChevronLeft, faChevronRight, faCalendar);

defineProps({ modelValue: { type: Date, default: null } });
const emit = defineEmits(['previous-week', 'previous-day', 'next-day', 'next-week', 'update:modelValue']);
</script>

<style scoped>
.app-button.mobile-date-nav-button {
  --app-button-icon-size: 26px;
  min-height: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 5px;
  font-size: 0.7rem;
}
.app-button.mobile-date-nav-picker {
  --app-button-icon-size: 32px;
  min-height: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  font-size: 0.85rem;
}
</style>
