<template>
  <ModalFrame
    :model-value="modelValue"
    size="sm"
    title="Neuer Signaturtyp"
    :close-on-backdrop="!saving"
    :close-on-escape="!saving"
    :style="{ '--mf-body-padding': '0' }"
    @update:model-value="close"
  >
    <template #header="{ titleId }">
      <div class="sigt-title">
        <font-awesome-icon :icon="['fas', 'plus']" />
        <h2 :id="titleId">
          Neuer Signaturtyp
        </h2>
      </div>
    </template>

    <div class="sigt-body">
      <label
        class="sigt-label"
        for="sigt-label-input"
      >Bezeichnung</label>
      <AppTextInput
        id="sigt-label-input"
        v-model="label"
        type="text"
        placeholder="z. B. Geheimhaltungsvereinbarung"
        @update:model-value="syncKey"
      />

      <label
        class="sigt-label"
        for="sigt-key-input"
      >
        Schlüssel <span class="sigt-hint">(für Dateiablage, automatisch)</span>
      </label>
      <AppTextInput
        id="sigt-key-input"
        v-model="key"
        type="text"
        class="sigt-input--mono"
        placeholder="geheimhaltungsvereinbarung"
        @update:model-value="keyEdited = true"
      />

      <label class="sigt-label">Verknüpfbar mit</label>
      <AppSegmentedControl
        v-model="linkedTo"
        :options="linkedOptions"
        label="Verknüpfbar mit"
        class="sigt-linked"
      />

      <label
        class="sigt-label"
        for="sigt-order-input"
      >Reihenfolge</label>
      <AppTextInput
        id="sigt-order-input"
        v-model.number="order"
        type="number"
        min="0"
      />
    </div>

    <template #footer>
      <div class="sigt-footer">
        <p
          v-if="error"
          class="sigt-error"
        >
          <font-awesome-icon :icon="['fas', 'triangle-exclamation']" /> {{ error }}
        </p>
        <div class="sigt-actions">
          <AppButton
            variant="secondary"
            :disabled="saving"
            @click="close"
          >
            Abbrechen
          </AppButton>
          <AppButton
            :disabled="!canSave"
            :loading="saving"
            @click="save"
          >
            <font-awesome-icon :icon="['fas', 'check']" />
            Anlegen
          </AppButton>
        </div>
      </div>
    </template>
  </ModalFrame>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlus, faCheck, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';

library.add(faPlus, faCheck, faSpinner, faTriangleExclamation);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'created']);

const label = ref('');
const key = ref('');
const keyEdited = ref(false);
const linkedTo = ref('Both');
const order = ref(0);
const saving = ref(false);
const error = ref('');

const linkedOptions = [
  { value: 'Both', label: 'Kunde & Mitarbeiter' },
  { value: 'Kunde', label: 'Nur Kunde' },
  { value: 'Mitarbeiter', label: 'Nur Mitarbeiter' },
  { value: 'None', label: 'Keine' },
];

const canSave = computed(() => label.value.trim() && key.value.trim());

function slugify(str) {
  return String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function syncKey() {
  if (!keyEdited.value) key.value = slugify(label.value);
}

async function save() {
  if (saving.value || !canSave.value) return;
  saving.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/api/signatur-typen', {
      label: label.value.trim(),
      key: slugify(key.value),
      linkedTo: linkedTo.value,
      order: order.value || 0,
    });
    emit('created', data);
    emit('update:modelValue', false);
  } catch (e) {
    console.error('Typ anlegen fehlgeschlagen', e);
    error.value = e?.response?.data?.message || 'Der Typ konnte nicht angelegt werden.';
  } finally {
    saving.value = false;
  }
}

function close() {
  if (saving.value) return;
  emit('update:modelValue', false);
}

watch(() => props.modelValue, (open) => {
  if (open) {
    label.value = '';
    key.value = '';
    keyEdited.value = false;
    linkedTo.value = 'Both';
    order.value = 0;
    error.value = '';
  }
});
</script>

<style scoped lang="scss">
.sigt-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--action-accent-text);

  h2 { font-size: 1.05rem; font-weight: 700; color: var(--text); margin: 0; }
}

.sigt-body { padding: 18px 20px; display: flex; flex-direction: column; }

.sigt-label {
  font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--muted); margin: 14px 0 6px;
  &:first-child { margin-top: 0; }
  .sigt-hint { text-transform: none; font-weight: 500; letter-spacing: 0; }
}

.sigt-input--mono { font-family: ui-monospace, monospace; }

.sigt-linked {
  width: 100%;
  grid-auto-flow: row;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.sigt-linked :deep(.app-segmented-control__option) { white-space: normal; }

.sigt-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sigt-error { font-size: 0.8rem; color: var(--status-danger-text); display: flex; gap: 6px; align-items: center; }
.sigt-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }

</style>
