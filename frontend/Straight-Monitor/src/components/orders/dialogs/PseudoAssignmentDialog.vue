<template>
  <OrderActionDialog
    :model-value="modelValue"
    title="Pseudo-Mitarbeiter einplanen"
    icon="fa-solid fa-user-plus"
    :saving="saving"
    :can-submit="!!selected.length && (mode !== 'new' || !!newShift.bezeichnung.trim())"
    :submit-label="selected.length > 1 ? `${selected.length} Mitarbeiter einplanen` : 'Einplanen'"
    @close="emit('update:modelValue', false)"
    @submit="emit('submit')"
  >
    <template #default="{ formId }">
      <div class="order-dialog-field">
        <span class="order-dialog-label">Schicht</span>
        <AppSegmentedControl
          :model-value="mode"
          :options="shiftModes"
          label="Schicht auswählen"
          class="pseudo-assignment-mode"
          @update:model-value="emit('update:mode', $event)"
        />
      </div>
      <div
        v-if="mode === 'existing'"
        class="order-dialog-field"
      >
        <label
          class="order-dialog-label"
          :for="`${formId}-shift`"
        >Bestehende Schicht</label>
        <select
          :id="`${formId}-shift`"
          v-model="shiftModel"
          class="order-dialog-native"
        >
          <option :value="null">
            — Automatisch (erste Schicht) —
          </option>
          <option
            v-for="shift in shifts"
            :key="shift.key"
            :value="shift.key"
          >
            {{ shift.meta.schichtBezeichnung || 'Schicht ' + shift.key }}{{ shift.meta.uhrzeitVon ? ' · ' + shift.meta.uhrzeitVon.substring(0, 5) : '' }}
          </option>
        </select>
      </div>
      <template v-else>
        <div class="order-dialog-field">
          <label
            class="order-dialog-label"
            :for="`${formId}-shift-name`"
          >Bezeichnung *</label>
          <AppTextInput
            :id="`${formId}-shift-name`"
            :model-value="newShift.bezeichnung"
            required
            placeholder="z.B. Trainer, Service, Logistik..."
            @update:model-value="updateShift('bezeichnung', $event)"
          />
        </div>
        <div class="order-dialog-row">
          <div class="order-dialog-field">
            <label
              class="order-dialog-label"
              :for="`${formId}-from`"
            >Von</label>
            <input
              :id="`${formId}-from`"
              :value="newShift.uhrzeitVon"
              type="time"
              class="order-dialog-native"
              @input="updateShift('uhrzeitVon', $event.target.value)"
            >
          </div>
          <div class="order-dialog-field">
            <label
              class="order-dialog-label"
              :for="`${formId}-to`"
            >Bis</label>
            <input
              :id="`${formId}-to`"
              :value="newShift.uhrzeitBis"
              type="time"
              class="order-dialog-native"
              @input="updateShift('uhrzeitBis', $event.target.value)"
            >
          </div>
        </div>
      </template>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-search`"
        >Mitarbeiter suchen</label>
        <div class="pseudo-assignment-search">
          <AppTextInput
            :id="`${formId}-search`"
            :model-value="search"
            placeholder="Name oder E-Mail..."
            @update:model-value="emit('update:search', $event)"
          />
          <span
            v-if="searching"
            role="status"
          >Suche…</span>
        </div>
        <div
          v-if="results.length"
          class="pseudo-assignment-results"
        >
          <button
            v-for="employee in results"
            :key="employee._id"
            type="button"
            class="pseudo-assignment-result"
            :aria-pressed="isSelected(employee)"
            @click="emit('toggle', employee)"
          >
            <span>{{ formatName(employee) }} <span
              v-if="isSelected(employee)"
              aria-hidden="true"
            >✓</span></span>
            <small>{{ employee.email }}</small>
          </button>
        </div>
        <template v-if="selected.length">
          <span class="order-dialog-label">{{ selected.length }} Mitarbeiter ausgewählt</span>
          <div class="pseudo-assignment-chips">
            <span
              v-for="employee in selected"
              :key="employee._id"
              class="pseudo-assignment-chip"
            >
              {{ formatName(employee) }}
              <AppIconButton
                variant="ghost"
                size="sm"
                :label="`${formatName(employee)} aus Auswahl entfernen`"
                @click="emit('toggle', employee)"
              >×</AppIconButton>
            </span>
          </div>
        </template>
      </div>
    </template>
  </OrderActionDialog>
</template>

<script setup>
import { computed } from 'vue';
import OrderActionDialog from './OrderActionDialog.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';
const props = defineProps({
  modelValue: { type: Boolean, default: false }, mode: { type: String, default: 'existing' },
  newShift: { type: Object, required: true }, shiftKey: { type: [String, Number], default: null },
  shifts: { type: Array, default: () => [] }, search: { type: String, default: '' },
  results: { type: Array, default: () => [] }, selected: { type: Array, default: () => [] },
  searching: { type: Boolean, default: false }, saving: { type: Boolean, default: false },
  formatName: { type: Function, required: true },
});
const emit = defineEmits(['update:modelValue', 'update:mode', 'update:newShift', 'update:shiftKey', 'update:search', 'toggle', 'submit']);
const shiftModes = [{ value: 'existing', label: 'Bestehende Schicht' }, { value: 'new', label: 'Neue Pseudo-Schicht' }];
const shiftModel = computed({ get: () => props.shiftKey, set: value => emit('update:shiftKey', value) });
function updateShift(key, value) { emit('update:newShift', { ...props.newShift, [key]: value }); }
function isSelected(employee) { return props.selected.some(item => item._id === employee._id); }
</script>

<style scoped>
.pseudo-assignment-mode { width: 100%; }
.pseudo-assignment-mode :deep(.app-segmented-control__option) { white-space: normal; }
.pseudo-assignment-search { display: flex; align-items: center; gap: 8px; }
.pseudo-assignment-search span { color: var(--muted); font-size: .8rem; }
.pseudo-assignment-results { max-height: 180px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--control-radius); }
.pseudo-assignment-result { display: grid; gap: 3px; width: 100%; padding: 8px 12px; border: 0; border-bottom: 1px solid var(--border); background: var(--surface); color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.pseudo-assignment-result:hover, .pseudo-assignment-result[aria-pressed="true"] { background: var(--hover); }
.pseudo-assignment-result:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: -2px; }
.pseudo-assignment-result small { color: var(--muted); }
.pseudo-assignment-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pseudo-assignment-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px 2px 10px; border: 1px solid var(--primary); border-radius: 20px; background: var(--action-ghost-hover); color: var(--text); font-size: .8rem; }
</style>
