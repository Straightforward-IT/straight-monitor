<template>
  <teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="kontakt-anlegen-modal" @click.stop>
        <div class="modal-header">
          <h3>
            <div class="ms-logo-grid" aria-hidden="true">
              <span style="background:#f25022"></span>
              <span style="background:#7fba00"></span>
              <span style="background:#00a4ef"></span>
              <span style="background:#ffb900"></span>
            </div>
            Kontakt anlegen
          </h3>
          <button class="btn-icon" @click="$emit('close')">
            <font-awesome-icon :icon="['fas', 'xmark']" />
          </button>
        </div>

        <div class="modal-body">
          <!-- Mailbox selection -->
          <div class="form-row form-row--full">
            <label>Mailbox (Team) <span class="req">*</span></label>
            <select v-model="form.team" class="form-input">
              <option value="berlin">Berlin</option>
              <option value="hamburg">Hamburg</option>
              <option value="koeln">Köln</option>
              <option value="rs">RS</option>
            </select>
          </div>

          <div class="form-grid">
            <div class="form-row">
              <label>Vorname</label>
              <input
                ref="firstInputRef"
                v-model="form.givenName"
                class="form-input"
                placeholder="Max"
                @keydown.enter="focusNext"
              />
            </div>
            <div class="form-row">
              <label>Nachname</label>
              <input v-model="form.surname" class="form-input" placeholder="Mustermann" />
            </div>
            <div class="form-row">
              <label>Firma</label>
              <input v-model="form.companyName" class="form-input" placeholder="Musterfirma GmbH" />
            </div>
            <div class="form-row">
              <label>Position</label>
              <input v-model="form.jobTitle" class="form-input" placeholder="Geschäftsführer" />
            </div>
            <div class="form-row form-row--full">
              <label>E-Mail</label>
              <input v-model="form.email" type="email" class="form-input" placeholder="max@musterfirma.de" />
            </div>
            <div class="form-row">
              <label>Telefon (Mobil)</label>
              <input v-model="form.mobilePhone" class="form-input" placeholder="+49 170 1234567" />
            </div>
            <div class="form-row">
              <label>Telefon (Geschäftlich)</label>
              <input v-model="form.businessPhone" class="form-input" placeholder="+49 40 1234567" />
            </div>
          </div>

          <p class="hint">
            <font-awesome-icon :icon="['fas', 'circle-info']" />
            Der Kontakt wird in der Microsoft-Mailbox des gewählten Teams gespeichert.
          </p>

          <div v-if="errorMsg" class="error-msg">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
            {{ errorMsg }}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="$emit('close')" :disabled="saving">Abbrechen</button>
          <button class="btn-primary" @click="save" :disabled="!canSave || saving">
            <font-awesome-icon v-if="saving" :icon="['fas', 'spinner']" spin />
            Kontakt anlegen
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';

const props = defineProps({
  /** Vorausfüllung für Firma (companyName), z.B. Kunden-Kürzel */
  prefilledCompanyName: { type: String, default: '' },
  /** Standard-Team bei Öffnung */
  prefilledTeam: { type: String, default: 'hamburg' },
});

const emit = defineEmits(['close', 'created']);

const saving = ref(false);
const errorMsg = ref('');
const firstInputRef = ref(null);

const form = reactive({
  team: props.prefilledTeam || 'hamburg',
  givenName: '',
  surname: '',
  companyName: props.prefilledCompanyName || '',
  jobTitle: '',
  email: '',
  mobilePhone: '',
  businessPhone: '',
});

const canSave = computed(
  () => (form.givenName.trim() || form.surname.trim()) && form.team
);

onMounted(() => {
  nextTick(() => firstInputRef.value?.focus());
});

function focusNext(e) {
  const inputs = e.currentTarget
    .closest('.kontakt-anlegen-modal')
    ?.querySelectorAll('input, select, textarea');
  if (!inputs) return;
  const idx = Array.from(inputs).indexOf(e.currentTarget);
  if (idx >= 0 && inputs[idx + 1]) inputs[idx + 1].focus();
}

async function save() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    const payload = {
      team: form.team,
    };
    if (form.givenName.trim())    payload.givenName    = form.givenName.trim();
    if (form.surname.trim())      payload.surname      = form.surname.trim();
    if (form.companyName.trim())  payload.companyName  = form.companyName.trim();
    if (form.jobTitle.trim())     payload.jobTitle     = form.jobTitle.trim();
    if (form.email.trim())        payload.email        = form.email.trim();
    if (form.mobilePhone.trim())  payload.mobilePhone  = form.mobilePhone.trim();
    if (form.businessPhone.trim()) payload.businessPhone = form.businessPhone.trim();

    const { data } = await api.post('/api/graph/contacts', payload);
    if (data.ok) {
      emit('created', data.contact);
    } else {
      errorMsg.value = data.error || 'Unbekannter Fehler';
    }
  } catch (e) {
    errorMsg.value = e?.response?.data?.error || e.message || 'Kontakt konnte nicht angelegt werden.';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.kontakt-anlegen-modal {
  background: var(--tile-bg);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}

.modal-header h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.ms-logo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.ms-logo-grid span {
  display: block;
  border-radius: 1px;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row--full {
  grid-column: 1 / -1;
}

.form-row label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.req {
  color: var(--primary);
}

.form-input {
  background: var(--input-bg, var(--hover));
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--primary);
}

.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  margin: 0;
  padding-top: 4px;
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  padding: 8px 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--hover);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}

.btn-icon:hover {
  color: var(--text);
  background: var(--hover);
}
</style>
