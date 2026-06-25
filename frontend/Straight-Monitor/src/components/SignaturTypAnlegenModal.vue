<template>
  <Teleport to="body">
    <Transition name="sigt-modal">
      <div v-if="modelValue" class="sigt-backdrop" @mousedown.self="close">
        <div class="sigt-dialog" role="dialog" aria-modal="true">
          <header class="sigt-header">
            <div class="sigt-title">
              <font-awesome-icon :icon="['fas', 'plus']" />
              <h2>Neuer Signaturtyp</h2>
            </div>
            <button class="sigt-close" type="button" @click="close">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </header>

          <div class="sigt-body">
            <label class="sigt-label" for="sigt-label-input">Bezeichnung</label>
            <input
              id="sigt-label-input"
              v-model="label"
              type="text"
              class="sigt-input"
              placeholder="z. B. Geheimhaltungsvereinbarung"
              @input="syncKey"
            />

            <label class="sigt-label" for="sigt-key-input">
              Schlüssel <span class="sigt-hint">(für Dateiablage, automatisch)</span>
            </label>
            <input
              id="sigt-key-input"
              v-model="key"
              type="text"
              class="sigt-input sigt-input--mono"
              placeholder="geheimhaltungsvereinbarung"
              @input="keyEdited = true"
            />

            <label class="sigt-label">Verknüpfbar mit</label>
            <div class="sigt-linked">
              <button
                v-for="opt in linkedOptions"
                :key="opt.value"
                class="sigt-linked-btn"
                :class="{ active: linkedTo === opt.value }"
                type="button"
                @click="linkedTo = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>

            <label class="sigt-label" for="sigt-order-input">Reihenfolge</label>
            <input id="sigt-order-input" v-model.number="order" type="number" class="sigt-input" min="0" />
          </div>

          <footer class="sigt-footer">
            <p v-if="error" class="sigt-error"><font-awesome-icon :icon="['fas', 'triangle-exclamation']" /> {{ error }}</p>
            <div class="sigt-actions">
              <button class="sigt-btn sigt-btn--ghost" type="button" @click="close">Abbrechen</button>
              <button class="sigt-btn sigt-btn--primary" type="button" :disabled="!canSave || saving" @click="save">
                <font-awesome-icon :icon="['fas', saving ? 'spinner' : 'check']" :spin="saving" />
                Anlegen
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPlus, faXmark, faCheck, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';

library.add(faPlus, faXmark, faCheck, faSpinner, faTriangleExclamation);

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
    close();
  } catch (e) {
    console.error('Typ anlegen fehlgeschlagen', e);
    error.value = e?.response?.data?.message || 'Der Typ konnte nicht angelegt werden.';
  } finally {
    saving.value = false;
  }
}

function close() {
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
.sigt-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.sigt-dialog {
  width: 100%;
  max-width: 440px;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sigt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  .sigt-title {
    display: flex; align-items: center; gap: 10px; color: var(--primary);
    h2 { font-size: 1.05rem; font-weight: 700; color: var(--text); margin: 0; }
  }
}

.sigt-close {
  background: none; border: none; color: var(--muted); font-size: 1.05rem; cursor: pointer;
  width: 32px; height: 32px; border-radius: 8px;
  &:hover { background: var(--hover); color: var(--text); }
}

.sigt-body { padding: 18px 20px; display: flex; flex-direction: column; }

.sigt-label {
  font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--muted); margin: 14px 0 6px;
  &:first-child { margin-top: 0; }
  .sigt-hint { text-transform: none; font-weight: 500; letter-spacing: 0; }
}

.sigt-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg, var(--surface));
  color: var(--text);
  font-size: 0.88rem;
  font-family: inherit;
  outline: none;
  &:focus { border-color: var(--primary); }
  &--mono { font-family: ui-monospace, monospace; font-size: 0.82rem; }
}

.sigt-linked { display: flex; flex-wrap: wrap; gap: 6px; }
.sigt-linked-btn {
  padding: 7px 12px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg, var(--surface));
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  &.active { border-color: var(--primary); color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
}

.sigt-footer {
  border-top: 1px solid var(--border);
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sigt-error { font-size: 0.8rem; color: #ef4444; display: flex; gap: 6px; align-items: center; }
.sigt-actions { display: flex; justify-content: flex-end; gap: 10px; }

.sigt-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 16px; border-radius: 8px; font-size: 0.86rem; font-weight: 600;
  cursor: pointer; border: 1px solid transparent; font-family: inherit;
  &--primary {
    background: var(--primary); color: #fff;
    &:hover:not(:disabled) { background: color-mix(in srgb, var(--primary) 88%, #000); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  &--ghost { background: none; border-color: var(--border); color: var(--text); &:hover { background: var(--hover); } }
}

.sigt-modal-enter-active, .sigt-modal-leave-active { transition: opacity 0.2s; }
.sigt-modal-enter-from, .sigt-modal-leave-to { opacity: 0; }
</style>
