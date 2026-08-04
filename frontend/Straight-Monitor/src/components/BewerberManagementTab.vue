<template>
  <section class="bewerber-management">
    <nav class="subtabs" aria-label="Bewerbermanagement">
      <button type="button" :class="{ active: view === 'documents' }" @click="view = 'documents'">
        <font-awesome-icon icon="fa-solid fa-paperclip" /> Anhangsbibliothek
      </button>
      <button type="button" :class="{ active: view === 'templates' }" @click="view = 'templates'">
        <font-awesome-icon icon="fa-solid fa-envelope" /> E-Mail-Vorlagen
      </button>
    </nav>

    <section v-if="view === 'documents'" class="workspace">
      <header class="workspace-header">
        <div>
          <h2>Anhangsbibliothek</h2>
          <p>Diese Dateien werden beim Versand einer Bewerbereinladung vorgeschlagen.</p>
        </div>
        <label class="upload-action">
          <font-awesome-icon :icon="uploading ? 'fa-solid fa-spinner' : 'fa-solid fa-upload'" :spin="uploading" />
          Datei hochladen
          <input type="file" accept=".pdf,.doc,.docx" :disabled="uploading" @change="uploadDocument" />
        </label>
      </header>

      <div class="filters">
        <label>Geltungsbereich
          <select v-model="documentScope">
            <option value="all">Alle</option>
            <option value="global">Global</option>
            <option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
          </select>
        </label>
        <label>Dateien durchsuchen
          <input v-model.trim="documentSearch" type="search" placeholder="Dateiname" />
        </label>
        <span class="count">{{ filteredDocuments.length }} Dateien</span>
      </div>

      <p v-if="documentError" class="error">{{ documentError }}</p>
      <p v-else-if="documentsLoading" class="state">Dateien werden geladen ...</p>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Datei</th><th>Geltungsbereich</th><th>Format</th><th>Größe</th><th>Geändert</th><th class="actions-cell">Aktionen</th></tr></thead>
          <tbody>
            <tr v-for="document in filteredDocuments" :key="document._id">
              <td><strong>{{ document.name }}</strong></td>
              <td><span class="scope-badge" :style="scopeStyle(document)">{{ document.locationV2?.nameFull || 'Global' }}</span></td>
              <td>{{ fileType(document.contentType) }}</td>
              <td>{{ formatFileSize(document.size) }}</td>
              <td>{{ formatDate(document.updatedAt) }}</td>
              <td class="actions-cell">
                <button type="button" title="Herunterladen" @click="downloadDocument(document)"><font-awesome-icon icon="fa-solid fa-download" /></button>
                <button type="button" title="Bearbeiten oder ersetzen" @click="openDocumentEdit(document)"><font-awesome-icon icon="fa-solid fa-pen" /></button>
                <button type="button" class="danger" title="Löschen" @click="deleteDocument(document)"><font-awesome-icon icon="fa-solid fa-trash" /></button>
              </td>
            </tr>
            <tr v-if="!filteredDocuments.length"><td colspan="6" class="empty">Keine passenden Dateien vorhanden.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="workspace">
      <header class="workspace-header">
        <div>
          <h2>E-Mail-Vorlagen</h2>
          <p>Standortvorlagen überschreiben die globale Vorlage; anschließend gilt der Systemstandard.</p>
        </div>
        <span class="source" :class="`source--${templateSource}`">{{ sourceLabel }}</span>
      </header>

      <div class="template-selectors">
        <label>Standort
          <select v-model="templateLocationId" @change="loadTemplate">
            <option value="">Global</option>
            <option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
          </select>
        </label>
        <label>Einladungstyp
          <select v-model="templateType" @change="loadTemplate">
            <option value="vertrag">Vertragsunterschrift</option>
            <option value="vertrag_service">Vertrag und Service-Schulung</option>
            <option value="vertrag_logistik">Vertrag und Logistik-Schulung</option>
          </select>
        </label>
      </div>

      <p v-if="templateError" class="error">{{ templateError }}</p>
      <p v-if="templateLoading" class="state">Vorlage wird geladen ...</p>
      <form v-else class="template-editor" @submit.prevent="saveTemplate">
        <label>Betreff
          <input v-model="templateForm.subjectTemplate" required maxlength="250" />
        </label>
        <label>HTML-Inhalt
          <textarea v-model="templateForm.htmlTemplate" required rows="18" spellcheck="false" />
        </label>
        <section class="placeholders">
          <h3>Sichere Platzhalter</h3>
          <button v-for="(label, key) in placeholders" :key="key" type="button" :title="label" @click="insertPlaceholder(key)">{{ placeholderToken(key) }}</button>
        </section>
        <footer class="editor-actions">
          <button type="button" class="secondary" @click="previewTemplate"><font-awesome-icon icon="fa-solid fa-eye" /> Vorschau</button>
          <button v-if="canResetTemplate" type="button" class="secondary danger-text" @click="resetTemplate"><font-awesome-icon icon="fa-solid fa-rotate-left" /> Auf Standard zurücksetzen</button>
          <button type="submit" class="primary" :disabled="templateSaving"><font-awesome-icon :icon="templateSaving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'" :spin="templateSaving" /> Speichern</button>
        </footer>
      </form>
    </section>

    <div v-if="documentModal.open" class="modal-backdrop" @click.self="closeDocumentEdit">
      <form class="modal" @submit.prevent="saveDocument">
        <header><h3>Datei bearbeiten</h3><button type="button" title="Schließen" @click="closeDocumentEdit"><font-awesome-icon icon="fa-solid fa-times" /></button></header>
        <label>Name<input v-model.trim="documentModal.name" required /></label>
        <label>Geltungsbereich
          <select v-model="documentModal.locationId">
            <option value="">Global</option>
            <option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
          </select>
        </label>
        <label>Datei ersetzen <input type="file" accept=".pdf,.doc,.docx" @change="documentModal.file = $event.target.files?.[0] || null" /></label>
        <p v-if="documentModal.error" class="error">{{ documentModal.error }}</p>
        <footer><button type="button" class="secondary" @click="closeDocumentEdit">Abbrechen</button><button type="submit" class="primary" :disabled="documentModal.saving">Speichern</button></footer>
      </form>
    </div>

    <div v-if="preview.open" class="modal-backdrop" @click.self="preview.open = false">
      <section class="modal preview-modal">
        <header><div><h3>{{ preview.subject }}</h3><small>Serverseitig bereinigte Vorschau</small></div><button type="button" title="Schließen" @click="preview.open = false"><font-awesome-icon icon="fa-solid fa-times" /></button></header>
        <iframe title="E-Mail-Vorschau" sandbox :srcdoc="preview.html" />
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';

const props = defineProps({ locations: { type: Array, default: () => [] } });
const view = ref('documents');
const documents = ref([]);
const documentsLoading = ref(false);
const uploading = ref(false);
const documentError = ref('');
const documentScope = ref('all');
const documentSearch = ref('');
const templateLocationId = ref('');
const templateType = ref('vertrag');
const templateId = ref(null);
const templateSource = ref('system');
const templateLoading = ref(false);
const templateSaving = ref(false);
const templateError = ref('');
const placeholders = ref({});
const templateForm = reactive({ subjectTemplate: '', htmlTemplate: '' });
const preview = reactive({ open: false, subject: '', html: '' });
const documentModal = reactive({ open: false, id: '', name: '', locationId: '', file: null, saving: false, error: '' });

const filteredDocuments = computed(() => {
  const needle = documentSearch.value.toLowerCase();
  return documents.value.filter((document) => {
    const locationId = document.locationV2?._id || '';
    const scopeMatches = documentScope.value === 'all'
      || (documentScope.value === 'global' ? !locationId : locationId === documentScope.value);
    return scopeMatches && (!needle || document.name.toLowerCase().includes(needle));
  });
});
const sourceLabel = computed(() => ({ location: 'Standortvorlage', global: 'Globale Vorlage', system: 'Systemstandard' })[templateSource.value]);
const canResetTemplate = computed(() => !!templateId.value && (
  templateSource.value === 'location' || (!templateLocationId.value && templateSource.value === 'global')
));

onMounted(async () => Promise.all([loadDocuments(), loadTemplate()]));

async function loadDocuments() {
  documentsLoading.value = true;
  documentError.value = '';
  try {
    const response = await api.get('/api/bewerber/admin/email-documents');
    documents.value = response.data.data || [];
  } catch (error) {
    documentError.value = error.response?.data?.message || 'Dateien konnten nicht geladen werden.';
  } finally {
    documentsLoading.value = false;
  }
}

async function uploadDocument(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  uploading.value = true;
  documentError.value = '';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('locationId', documentScope.value !== 'all' && documentScope.value !== 'global' ? documentScope.value : '');
    await api.post('/api/bewerber/admin/email-documents', formData);
    await loadDocuments();
  } catch (error) {
    documentError.value = error.response?.data?.message || 'Datei konnte nicht hochgeladen werden.';
  } finally {
    uploading.value = false;
  }
}

function openDocumentEdit(document) {
  Object.assign(documentModal, { open: true, id: document._id, name: document.name, locationId: document.locationV2?._id || '', file: null, saving: false, error: '' });
}
function closeDocumentEdit() { documentModal.open = false; }
async function saveDocument() {
  documentModal.saving = true;
  documentModal.error = '';
  try {
    const formData = new FormData();
    formData.append('name', documentModal.name);
    formData.append('locationId', documentModal.locationId);
    if (documentModal.file) formData.append('file', documentModal.file);
    await api.patch(`/api/bewerber/admin/email-documents/${documentModal.id}`, formData);
    closeDocumentEdit();
    await loadDocuments();
  } catch (error) {
    documentModal.error = error.response?.data?.message || 'Datei konnte nicht gespeichert werden.';
  } finally {
    documentModal.saving = false;
  }
}
async function downloadDocument(document) {
  try {
    const response = await api.get(`/api/bewerber/admin/email-documents/${document._id}/download`);
    window.open(response.data.data.url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    documentError.value = error.response?.data?.message || 'Download konnte nicht gestartet werden.';
  }
}
async function deleteDocument(document) {
  if (!window.confirm(`„${document.name}“ wirklich löschen?`)) return;
  try {
    await api.delete(`/api/bewerber/admin/email-documents/${document._id}`);
    await loadDocuments();
  } catch (error) {
    documentError.value = error.response?.data?.message || 'Datei konnte nicht gelöscht werden.';
  }
}

async function loadTemplate() {
  templateLoading.value = true;
  templateError.value = '';
  try {
    const response = await api.get('/api/bewerber/admin/email-templates/effective', { params: { locationId: templateLocationId.value, type: templateType.value } });
    const data = response.data.data;
    templateForm.subjectTemplate = data.template.subjectTemplate;
    templateForm.htmlTemplate = data.template.htmlTemplate;
    templateId.value = data.templateId;
    templateSource.value = data.source;
    placeholders.value = data.placeholders || {};
  } catch (error) {
    templateError.value = error.response?.data?.message || 'Vorlage konnte nicht geladen werden.';
  } finally {
    templateLoading.value = false;
  }
}
async function saveTemplate() {
  templateSaving.value = true;
  templateError.value = '';
  try {
    await api.put('/api/bewerber/admin/email-templates', { locationId: templateLocationId.value, type: templateType.value, ...templateForm });
    await loadTemplate();
  } catch (error) {
    templateError.value = error.response?.data?.message || 'Vorlage konnte nicht gespeichert werden.';
  } finally {
    templateSaving.value = false;
  }
}
async function previewTemplate() {
  templateError.value = '';
  try {
    const location = props.locations.find((entry) => entry._id === templateLocationId.value);
    const response = await api.post('/api/bewerber/admin/email-templates/preview', { ...templateForm, locationName: location?.nameFull || 'Global' });
    Object.assign(preview, { open: true, ...response.data.data });
  } catch (error) {
    templateError.value = error.response?.data?.message || 'Vorschau konnte nicht erstellt werden.';
  }
}
async function resetTemplate() {
  if (!templateId.value || !window.confirm('Diese Überschreibung löschen und auf den Standard zurücksetzen?')) return;
  try {
    await api.delete(`/api/bewerber/admin/email-templates/${templateId.value}`);
    await loadTemplate();
  } catch (error) {
    templateError.value = error.response?.data?.message || 'Vorlage konnte nicht zurückgesetzt werden.';
  }
}
function placeholderToken(key) { return `{{${key}}}`; }
function insertPlaceholder(key) { templateForm.htmlTemplate += ` ${placeholderToken(key)}`; }
function fileType(contentType) { return contentType === 'application/pdf' ? 'PDF' : contentType.includes('officedocument') ? 'DOCX' : 'DOC'; }
function formatFileSize(size) { return `${(Number(size || 0) / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('de-DE') : '—'; }
function scopeStyle(document) { return document.locationV2 ? { '--scope-color': document.locationV2.color || '#6b7280' } : {}; }
</script>

<style scoped lang="scss">
.bewerber-management { display: grid; gap: 20px; }
.subtabs { border-bottom: 1px solid var(--border); display: flex; gap: 4px; }
.subtabs button { background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--muted); cursor: pointer; display: flex; gap: 7px; padding: 9px 12px; }
.subtabs button.active { border-bottom-color: var(--primary); color: var(--primary); font-weight: 700; }
.workspace { display: grid; gap: 18px; }
.workspace-header { align-items: end; display: flex; gap: 20px; justify-content: space-between; }
h2, h3, p { margin: 0; }
h2 { color: var(--text); font-size: 1.1rem; }
.workspace-header p { color: var(--muted); font-size: .82rem; margin-top: 5px; }
.upload-action, .primary, .secondary { align-items: center; border-radius: 6px; cursor: pointer; display: inline-flex; font: inherit; font-weight: 600; gap: 7px; min-height: 38px; padding: 7px 12px; }
.upload-action, .primary { background: var(--primary); border: 1px solid var(--primary); color: #fff; }
.upload-action input { display: none; }
.secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
.filters, .template-selectors { align-items: end; display: grid; gap: 14px; grid-template-columns: minmax(180px, 240px) minmax(220px, 1fr) auto; }
label { color: var(--text); display: grid; font-size: .82rem; font-weight: 600; gap: 6px; }
input, select, textarea { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font: inherit; min-height: 40px; padding: 8px 10px; }
textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.5; resize: vertical; }
.count, .source { border: 1px solid var(--border); border-radius: 999px; color: var(--muted); font-size: .75rem; padding: 7px 10px; }
.source--location { border-color: var(--primary); color: var(--primary); }
.table-wrap { border: 1px solid var(--border); border-radius: 6px; overflow-x: auto; }
table { border-collapse: collapse; color: var(--text); width: 100%; }
th, td { border-bottom: 1px solid var(--border); font-size: .8rem; padding: 10px 12px; text-align: left; }
th { background: var(--hover); color: var(--muted); font-weight: 700; }
.actions-cell { text-align: right; white-space: nowrap; }
.actions-cell button, .modal header button { background: transparent; border: 0; color: var(--muted); cursor: pointer; height: 32px; width: 32px; }
.danger, .danger-text { color: var(--danger, #b91c1c) !important; }
.scope-badge { border: 1px solid var(--scope-color, var(--border)); border-radius: 999px; color: var(--scope-color, var(--muted)); padding: 3px 7px; }
.empty, .state { color: var(--muted); padding: 18px; text-align: center; }
.error { color: var(--danger, #b91c1c); font-size: .82rem; }
.template-editor { display: grid; gap: 14px; }
.placeholders { display: flex; flex-wrap: wrap; gap: 6px; }
.placeholders h3 { flex-basis: 100%; font-size: .82rem; }
.placeholders button { background: var(--hover); border: 1px solid var(--border); border-radius: 4px; color: var(--text); cursor: pointer; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .72rem; padding: 5px 7px; }
.editor-actions { display: flex; gap: 8px; justify-content: flex-end; }
.modal-backdrop { align-items: center; background: rgba(0,0,0,.45); display: flex; inset: 0; justify-content: center; padding: 20px; position: fixed; z-index: 1000; }
.modal { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 8px; display: grid; gap: 16px; max-width: 520px; padding: 20px; width: 100%; }
.modal header, .modal footer { align-items: center; display: flex; gap: 10px; justify-content: space-between; }
.modal footer { justify-content: flex-end; }
.preview-modal { height: min(760px, 90vh); max-width: 760px; }
.preview-modal small { color: var(--muted); }
.preview-modal iframe { background: #fff; border: 1px solid var(--border); height: 100%; width: 100%; }
@media (max-width: 700px) { .workspace-header, .editor-actions { align-items: stretch; flex-direction: column; } .filters, .template-selectors { grid-template-columns: 1fr; } }
</style>
