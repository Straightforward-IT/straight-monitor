<template>
  <ModalFrame
    :model-value="modelValue"
    title="Kündigung"
    subtitle="Mitarbeiterdokument"
    size="md"
    layer="elevated"
    :show-close="!busy"
    :close-on-backdrop="!busy"
    :close-on-escape="!busy"
    @close="close"
  >
    <div class="kuendigung-modal">
      <h4>{{ employeeName }}</h4>
      <p v-if="mitarbeiter.personalnr">
        Personalnummer: {{ mitarbeiter.personalnr }}
      </p>
      <p
        v-if="loading"
        role="status"
      >
        Dokumentvorbereitung wird geladen…
      </p>
      <template v-else-if="defaults">
        <section class="form-grid">
          <label>
            Standort
            <AppSelect
              v-model="parameters.locationId"
              class="form-control"
            >
              <option value="">— Standort wählen —</option>
              <option
                v-for="location in defaults.locations"
                :key="location._id"
                :value="location._id"
              >
                {{ location.name }}
              </option>
            </AppSelect>
          </label>
          <label>
            Anrede
            <AppSelect
              v-model="parameters.anrede"
              class="form-control"
            >
              <option value="frau">Frau</option>
              <option value="herr">Herr</option>
            </AppSelect>
          </label>
          <label>
            Briefdatum
            <AppTextInput
              v-model="parameters.briefdatum"
              class="form-control"
              type="date"
              required
            />
          </label>
          <label>
            Beendigungsdatum
            <AppTextInput
              v-model="parameters.beendigungsdatum"
              class="form-control"
              type="date"
              required
            />
          </label>
          <label>
            Freistellung
            <AppSelect
              v-model="parameters.freistellung"
              class="form-control"
            >
              <option value="none">Keine Freistellung</option>
              <option value="arbeitszeitkonto">Nur Arbeitszeitkonto</option>
              <option value="resturlaub">Nur Resturlaub</option>
              <option value="beides">Arbeitszeitkonto und Resturlaub</option>
            </AppSelect>
          </label>
          <label v-if="hasFreistellung">
            Freistellung ab
            <AppTextInput
              v-model="parameters.freistellungAb"
              class="form-control"
              type="date"
              required
            />
          </label>
          <label v-if="usesArbeitszeitkonto">
            Arbeitszeitkonto (Stunden)
            <AppTextInput
              v-model.number="parameters.arbeitszeitkontoStunden"
              class="form-control"
              type="number"
              min="0"
              step="0.25"
              required
            />
          </label>
          <label v-if="usesResturlaub">
            Resturlaub (Tage)
            <AppTextInput
              v-model.number="parameters.resturlaubTage"
              class="form-control"
              type="number"
              min="0"
              step="0.5"
              required
            />
          </label>
        </section>
        <p>Die PDF wird beim Mitarbeiter in der Ablage gespeichert und kann anschließend heruntergeladen werden. Es wird kein Signaturvorgang gestartet.</p>
        <p>Das Erstellen des Dokuments ändert weder den Mitarbeiterstatus noch das Austrittsdatum.</p>
        <section
          v-if="missingFields.length"
          class="document-hint"
        >
          <ul>
            <li
              v-for="field in missingFields"
              :key="field"
            >
              {{ field }} – fehlt
            </li>
          </ul>
        </section>
        <section
          v-if="documents.length"
          aria-label="Erstellte Kündigungen"
        >
          <h4>Erstellte Dokumente</h4>
          <ul>
            <li
              v-for="document in documents"
              :key="document._id"
            >
              <span>{{ document.filename }}</span>
              <AppButton
                variant="secondary"
                size="sm"
                :disabled="busy"
                @click="download(document)"
              >
                Herunterladen
              </AppButton>
            </li>
          </ul>
        </section>
      </template>
      <p
        v-if="error"
        role="alert"
        class="document-error"
      >
        {{ error }}
      </p>
      <p
        v-if="saved"
        role="status"
      >
        PDF erfolgreich in der Mitarbeiter-Ablage gespeichert.
      </p>
    </div>
    <template #footer>
      <AppButton
        variant="secondary"
        :disabled="busy"
        @click="close"
      >
        Schließen
      </AppButton>
      <AppButton
        v-if="!defaults && !loading"
        variant="secondary"
        @click="loadDefaults"
      >
        Erneut laden
      </AppButton>
      <AppButton
        :disabled="loading || !defaults?.ready || busy || !canGenerate"
        :loading="saving"
        @click="generate"
      >
        PDF erstellen
      </AppButton>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import api from '@/utils/api';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mitarbeiter: { type: Object, required: true },
});
const emit = defineEmits(['update:modelValue', 'saved']);
const defaults = ref(null);
const parameters = ref({});
const documents = ref([]);
const loading = ref(false);
const saving = ref(false);
const downloading = ref(false);
const error = ref('');
const saved = ref(false);
const busy = computed(() => saving.value || downloading.value);
const employeeName = computed(() => [props.mitarbeiter.vorname, props.mitarbeiter.nachname].filter(Boolean).join(' '));
const endpoint = computed(() => `/api/personal/mitarbeiter/${props.mitarbeiter._id}/documents/kuendigung`);
const hasFreistellung = computed(() => parameters.value.freistellung !== 'none');
const usesArbeitszeitkonto = computed(() => ['arbeitszeitkonto', 'beides'].includes(parameters.value.freistellung));
const usesResturlaub = computed(() => ['resturlaub', 'beides'].includes(parameters.value.freistellung));
const missingFields = computed(() => {
  if (!defaults.value) return [];
  const missing = [];
  if (!parameters.value.locationId) missing.push('Standort');
  if (!parameters.value.anrede) missing.push('Anrede');
  if (!parameters.value.briefdatum) missing.push('Briefdatum');
  if (!parameters.value.beendigungsdatum) missing.push('Beendigungsdatum');
  if (hasFreistellung.value && !parameters.value.freistellungAb) missing.push('Freistellung ab');
  if (usesArbeitszeitkonto.value && !hasNonNegativeNumber(parameters.value.arbeitszeitkontoStunden)) {
    missing.push('Arbeitszeitkonto (Stunden)');
  }
  if (usesResturlaub.value && !hasNonNegativeNumber(parameters.value.resturlaubTage)) {
    missing.push('Resturlaub (Tage)');
  }
  return missing;
});
const canGenerate = computed(() => missingFields.value.length === 0);
let loadVersion = 0;

async function loadDefaults() {
  const version = ++loadVersion;
  defaults.value = null;
  documents.value = [];
  parameters.value = {};
  saved.value = false;
  error.value = '';
  loading.value = true;
  try {
    const { data } = await api.get(endpoint.value);
    if (version !== loadVersion) return;
    defaults.value = data;
    parameters.value = data.parameters;
    documents.value = data.documents;
  } catch (err) {
    if (version === loadVersion) {
      error.value = err.response?.data?.message || 'Dokumentvorbereitung konnte nicht geladen werden.';
    }
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}

async function generate() {
  if (busy.value || loading.value || !defaults.value?.ready || !canGenerate.value) return;
  saving.value = true;
  saved.value = false;
  error.value = '';
  try {
    const { data } = await api.post(endpoint.value, { parameters: parameters.value });
    documents.value.push(data.document);
    saved.value = true;
    emit('saved', data.document);
  } catch (err) {
    error.value = err.response?.data?.message || 'Kündigungsdokument konnte nicht erstellt werden.';
  } finally {
    saving.value = false;
  }
}

async function download(document) {
  if (busy.value) return;
  downloading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/api/personal/mitarbeiter/${props.mitarbeiter._id}/storage/url`, {
      params: { key: document.r2Key, download: 'true' },
    });
    const link = window.document.createElement('a');
    link.href = data.url;
    link.download = document.filename;
    link.click();
  } catch (err) {
    error.value = err.response?.data?.message || 'Dokument konnte nicht heruntergeladen werden.';
  } finally {
    downloading.value = false;
  }
}

function close() {
  if (!busy.value) emit('update:modelValue', false);
}

function hasNonNegativeNumber(value) {
  return value !== '' && value !== null && value !== undefined
    && Number.isFinite(Number(value)) && Number(value) >= 0;
}

watch(() => [props.modelValue, props.mitarbeiter._id], ([open]) => {
  if (open) {
    loadDefaults();
  } else {
    loadVersion++;
  }
}, { immediate: true });
</script>

<style scoped lang="scss">
.kuendigung-modal {
  display: grid;
  gap: 16px;

  h4, p { margin: 0; }
  p { line-height: 1.5; }
  .document-hint {
    padding: 10px 12px;
    border: 1px solid var(--primary);
    border-radius: 8px;

    ul {
      display: grid;
      gap: 2px;
      margin: 6px 0 0;
      padding-left: 20px;
    }
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  label {
    display: grid;
    min-width: 0;
    gap: 5px;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .form-control {
    width: 100%;
  }
  .document-error { color: var(--danger, #dc3545); }
  ul { list-style: none; padding: 0; }
  li { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
  li span { overflow-wrap: anywhere; min-width: 0; }

  @media (max-width: 600px) {
    .form-grid { grid-template-columns: 1fr; }
  }
}
</style>
