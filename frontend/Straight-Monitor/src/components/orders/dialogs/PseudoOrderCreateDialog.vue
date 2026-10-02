<template>
  <OrderActionDialog
    :model-value="modelValue"
    title="Neuer Pseudo-Auftrag"
    icon="fa-solid fa-plus"
    :saving="saving"
    :can-submit="!!(form.eventTitel.trim() && form.vonDatum && form.bisDatum)"
    submit-label="Auftrag anlegen"
    @close="emit('update:modelValue', false)"
    @submit="emit('submit')"
  >
    <template #default="{ formId }">
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-title`"
        >Titel *</label>
        <AppTextInput
          :id="`${formId}-title`"
          :model-value="form.eventTitel"
          required
          placeholder="z.B. Konferenz Berlin 2026"
          @update:model-value="update('eventTitel', $event)"
        />
      </div>
      <div class="order-dialog-row">
        <div class="order-dialog-field">
          <label
            class="order-dialog-label"
            :for="`${formId}-from`"
          >Von *</label>
          <div class="pseudo-order-date">
            <input
              :id="`${formId}-from`"
              ref="fromInput"
              :value="form.vonDatum"
              type="date"
              required
              class="order-dialog-native"
              @input="update('vonDatum', $event.target.value)"
            >
            <AppIconButton
              label="Anfangsdatum wählen"
              variant="ghost"
              size="sm"
              @click="openDatePicker(fromInput)"
            >
              <font-awesome-icon icon="fa-solid fa-calendar" />
            </AppIconButton>
          </div>
        </div>
        <div class="order-dialog-field">
          <label
            class="order-dialog-label"
            :for="`${formId}-to`"
          >Bis *</label>
          <div class="pseudo-order-date">
            <input
              :id="`${formId}-to`"
              ref="toInput"
              :value="form.bisDatum"
              type="date"
              required
              class="order-dialog-native"
              @input="update('bisDatum', $event.target.value)"
            >
            <AppIconButton
              label="Enddatum wählen"
              variant="ghost"
              size="sm"
              @click="openDatePicker(toInput)"
            >
              <font-awesome-icon icon="fa-solid fa-calendar" />
            </AppIconButton>
          </div>
        </div>
      </div>
      <div class="order-dialog-row">
        <div class="order-dialog-field">
          <label
            class="order-dialog-label"
            :for="`${formId}-location`"
          >Standort</label>
          <select
            :id="`${formId}-location`"
            v-model="locationModel"
            class="order-dialog-native"
          >
            <option value="">
              — Keine —
            </option>
            <option
              v-for="location in locations"
              :key="location._id"
              :value="location._id"
            >
              {{ location.nameFull }}
            </option>
          </select>
        </div>
        <div class="order-dialog-field">
          <label
            class="order-dialog-label"
            :for="`${formId}-city`"
          >Ort</label>
          <AppTextInput
            :id="`${formId}-city`"
            :model-value="form.eventOrt"
            placeholder="z.B. Berlin"
            @update:model-value="update('eventOrt', $event)"
          />
        </div>
      </div>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-venue`"
        >Location</label>
        <AppTextInput
          :id="`${formId}-venue`"
          :model-value="form.eventLocation"
          placeholder="z.B. Messe Berlin"
          @update:model-value="update('eventLocation', $event)"
        />
      </div>
    </template>
  </OrderActionDialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import OrderActionDialog from './OrderActionDialog.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
library.add(faCalendar);
const props = defineProps({
  modelValue: { type: Boolean, default: false }, form: { type: Object, required: true },
  locations: { type: Array, default: () => [] }, saving: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'update:form', 'submit']);
const fromInput = ref(null), toInput = ref(null);
function update(key, value) { emit('update:form', { ...props.form, [key]: value }); }
const locationModel = computed({ get: () => props.form.locationV2, set: value => update('locationV2', value) });
function openDatePicker(input) {
  if (!input) return;
  if (typeof input.showPicker === 'function') { input.showPicker(); return; }
  input.focus(); input.click();
}
</script>

<style scoped>
.pseudo-order-date { display: flex; align-items: center; gap: 4px; }
.pseudo-order-date .order-dialog-native { flex: 1; }
</style>
