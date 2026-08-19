<template>
  <section class="eet">
    <header class="eet__top">
      <div class="eet__location">
        <label>Standort
          <select v-model="selectedLocationId" @change="onLocationChange">
            <option value="">Bitte wählen …</option>
            <option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
          </select>
        </label>
        <button type="button" class="eet__source-toggle" :disabled="!selectedLocationId" @click="source.open = !source.open">
          <font-awesome-icon icon="fa-solid fa-gear" /> Quelle konfigurieren
        </button>
      </div>

      <div v-if="source.open && selectedLocationId" class="eet__source">
        <p class="eet__hint">Outlook-Postfach und Ordner-ID, aus dem Vorschläge geladen werden.</p>
        <div class="eet__source-grid">
          <label>Postfach (UPN)
            <input v-model.trim="source.mailboxUpn" type="email" placeholder="teamhamburg@straightforward.email" />
          </label>
          <label>Ordner-ID
            <input v-model.trim="source.folderId" type="text" placeholder="AQMkAD…" />
          </label>
        </div>
        <div class="eet__source-actions">
          <span v-if="source.error" class="eet__error">{{ source.error }}</span>
          <button type="button" class="eet__btn eet__btn--primary" :disabled="source.saving" @click="saveSourceConfig">
            <font-awesome-icon :icon="source.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'" :spin="source.saving" /> Speichern
          </button>
        </div>
      </div>
    </header>

    <p v-if="!selectedLocationId" class="eet__placeholder">Bitte zuerst einen Standort auswählen.</p>

    <div v-else class="eet__grid">
      <!-- Left: Suggestions + saved templates -->
      <aside class="eet__list">
        <section class="eet__panel">
          <header class="eet__panel-head">
            <h3><font-awesome-icon icon="fa-solid fa-inbox" /> Vorschläge</h3>
            <button type="button" class="eet__icon" title="Neu laden" :disabled="suggestionsLoading" @click="loadSuggestions">
              <font-awesome-icon :icon="suggestionsLoading ? 'fa-solid fa-spinner' : 'fa-solid fa-rotate'" :spin="suggestionsLoading" />
            </button>
          </header>
          <p v-if="suggestionsError" class="eet__error">{{ suggestionsError }}</p>
          <p v-else-if="suggestionsLoading" class="eet__state">E-Mails werden geladen …</p>
          <p v-else-if="!suggestions.length" class="eet__state">Keine E-Mails gefunden.</p>
          <ul v-else class="eet__suggestions">
            <li v-for="msg in suggestions" :key="msg.id">
              <button type="button" @click="useSuggestion(msg)">
                <strong>{{ msg.subject }}</strong>
                <small>{{ msg.from || '—' }} · {{ formatDate(msg.receivedDateTime) }}</small>
                <span class="eet__preview-line">{{ msg.bodyPreview }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="eet__panel">
          <header class="eet__panel-head">
            <h3><font-awesome-icon icon="fa-solid fa-file-lines" /> Gespeicherte Vorlagen</h3>
            <button type="button" class="eet__icon" title="Neue leere Vorlage" @click="newTemplate">
              <font-awesome-icon icon="fa-solid fa-plus" />
            </button>
          </header>
          <p v-if="templatesError" class="eet__error">{{ templatesError }}</p>
          <p v-else-if="templatesLoading" class="eet__state">Vorlagen werden geladen …</p>
          <p v-else-if="!templates.length" class="eet__state">Noch keine Vorlagen.</p>
          <ul v-else class="eet__templates">
            <li v-for="tpl in templates" :key="tpl._id" :class="{ active: editor.id === tpl._id }">
              <button type="button" @click="editTemplate(tpl)">
                <strong>{{ tpl.name }}</strong>
                <small>{{ tpl.subjectTemplate }}</small>
              </button>
              <button type="button" class="eet__icon eet__icon--danger" title="Löschen" @click="deleteTemplate(tpl)">
                <font-awesome-icon icon="fa-solid fa-trash" />
              </button>
            </li>
          </ul>
        </section>
      </aside>

      <!-- Center: Editor -->
      <section class="eet__editor">
        <div class="eet__field">
          <label>Vorlagenname</label>
          <input v-model="editor.name" type="text" maxlength="150" placeholder="z. B. Willkommen Hamburg" />
        </div>
        <div class="eet__field">
          <label>Betreff</label>
          <input v-model="editor.subjectTemplate" type="text" maxlength="250" />
        </div>
        <div class="eet__content">
          <div class="eet__content-tabs">
            <label>Inhalt</label>
            <div class="eet__content-switch">
              <button type="button" :class="{ active: editorView === 'preview' }" @click="switchToPreview">
                <font-awesome-icon icon="fa-solid fa-eye" /> Vorschau
              </button>
              <button type="button" :class="{ active: editorView === 'html' }" @click="editorView = 'html'">
                <font-awesome-icon icon="fa-solid fa-code" /> HTML bearbeiten
              </button>
            </div>
          </div>

          <div v-show="editorView === 'preview'" class="eet__content-preview">
            <iframe v-if="displayHtml" ref="previewIframe" title="Live-Vorschau (editierbar)" sandbox="allow-same-origin" :srcdoc="displayHtml" @load="initEditablePreview" />
            <p v-else class="eet__state">Noch kein Inhalt. Wähle links einen Vorschlag oder wechsle zu „HTML bearbeiten“.</p>
          </div>

          <div v-show="editorView === 'html'" class="eet__content-html">
            <textarea ref="htmlRef" v-model="editor.htmlTemplate" rows="16" spellcheck="false" />
            <div class="eet__marks">
              <span class="eet__marks-label">Platzhalter einfügen:</span>
              <button v-for="(label, key) in placeholders" :key="key" type="button" :title="label" @click="insertPlaceholder(key)">
                {{ placeholderToken(key) }}
              </button>
            </div>
          </div>
        </div>

        <footer class="eet__actions">
          <span v-if="saveError" class="eet__error">{{ saveError }}</span>
          <button type="button" class="eet__btn" @click="previewTemplate"><font-awesome-icon icon="fa-solid fa-vial" /> Testvorschau</button>
          <button type="button" class="eet__btn eet__btn--primary" :disabled="saving || !canSave" @click="saveTemplate">
            <font-awesome-icon :icon="saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'" :spin="saving" />
            {{ editor.id ? 'Aktualisieren' : 'Speichern' }}
          </button>
        </footer>
      </section>

      <!-- Right: Attachment library -->
      <aside class="eet__attachments">
        <header class="eet__panel-head">
          <h3><font-awesome-icon icon="fa-solid fa-paperclip" /> Anhänge</h3>
          <label class="eet__upload" :class="{ 'eet__upload--busy': uploading }" title="Datei hochladen">
            <font-awesome-icon :icon="uploading ? 'fa-solid fa-spinner' : 'fa-solid fa-upload'" :spin="uploading" />
            <input type="file" accept=".pdf,.doc,.docx" :disabled="uploading" @change="uploadAttachment" />
          </label>
        </header>
        <p class="eet__hint">Aus der Anhangsbibliothek auswählen.</p>
        <p v-if="libError" class="eet__error">{{ libError }}</p>
        <p v-else-if="libLoading" class="eet__state">Wird geladen …</p>
        <p v-else-if="!libDocs.length" class="eet__state">Keine Dateien in der Bibliothek.</p>
        <ul v-else class="eet__lib">
          <li v-for="doc in libDocs" :key="doc._id" :class="{ active: isAttached(doc._id) }">
            <label>
              <input type="checkbox" :checked="isAttached(doc._id)" @change="toggleAttachment(doc._id)" />
              <span class="eet__lib-name">{{ doc.name }}</span>
              <small>{{ doc.locationV2?.nameFull || 'Global' }} · {{ formatFileSize(doc.size) }}</small>
            </label>
          </li>
        </ul>
      </aside>
    </div>

    <div v-if="preview.open" class="eet__modal-backdrop" @click.self="preview.open = false">
      <section class="eet__modal">
        <header>
          <div><h3>{{ preview.subject }}</h3><small>Serverseitig bereinigte Vorschau</small></div>
          <button type="button" title="Schließen" @click="preview.open = false"><font-awesome-icon icon="fa-solid fa-times" /></button>
        </header>
        <iframe title="E-Mail-Vorschau" sandbox :srcdoc="preview.html" />
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';

const props = defineProps({ locations: { type: Array, default: () => [] } });

const selectedLocationId = ref('');
const source = reactive({ open: false, mailboxUpn: '', folderId: '', saving: false, error: '' });

const suggestions = ref([]);
const suggestionsLoading = ref(false);
const suggestionsError = ref('');

const templates = ref([]);
const templatesLoading = ref(false);
const templatesError = ref('');
const placeholders = ref({});

const libDocs = ref([]);
const libLoading = ref(false);
const libError = ref('');
const uploading = ref(false);

const editor = reactive({ id: null, name: '', subjectTemplate: '', htmlTemplate: '', attachmentIds: [], sourceMessageId: null });
const saving = ref(false);
const saveError = ref('');
const preview = reactive({ open: false, subject: '', html: '' });
const htmlRef = ref(null);
const editorView = ref('preview');
const previewIframe = ref(null);
// displayHtml is what the iframe renders — only updated on intentional external loads, never during preview typing.
const displayHtml = ref('');

function setDisplayHtml(html) {
  displayHtml.value = html;
}

function switchToPreview() {
  // Sync any HTML-tab edits into the iframe before switching.
  setDisplayHtml(editor.htmlTemplate);
  editorView.value = 'preview';
}

function initEditablePreview() {
  const iframe = previewIframe.value;
  if (!iframe) return;
  try {
    const doc = iframe.contentDocument;
    if (!doc?.body) return;
    doc.body.contentEditable = 'true';
    doc.body.style.outline = 'none';
    // Sync edits back to editor without touching displayHtml → no iframe reload.
    doc.addEventListener('input', () => {
      editor.htmlTemplate = doc.documentElement.outerHTML;
    });
  } catch {
    // sandbox restriction
  }
}

const sourceConfigured = computed(() => !!source.mailboxUpn && !!source.folderId);
const selectedLocation = computed(() => props.locations.find((l) => l._id === selectedLocationId.value) || null);
const canSave = computed(() => !!selectedLocationId.value && !!editor.name.trim() && !!editor.subjectTemplate.trim() && !!editor.htmlTemplate.trim());

async function onLocationChange() {
  resetEditor();
  suggestions.value = [];
  templates.value = [];
  source.error = '';
  if (!selectedLocationId.value) return;
  await Promise.all([loadSourceConfig(), loadTemplates(), loadLibrary()]);
  if (sourceConfigured.value) await loadSuggestions();
}

async function loadSourceConfig() {
  try {
    const { data } = await api.get(`/api/employee-email-templates/source-config/${selectedLocationId.value}`);
    source.mailboxUpn = data.data.mailboxUpn || '';
    source.folderId = data.data.folderId || '';
  } catch (error) {
    source.error = error.response?.data?.message || 'Quelle konnte nicht geladen werden.';
  }
}

async function saveSourceConfig() {
  source.saving = true;
  source.error = '';
  try {
    await api.put(`/api/employee-email-templates/source-config/${selectedLocationId.value}`, {
      mailboxUpn: source.mailboxUpn,
      folderId: source.folderId,
    });
    source.open = false;
    if (sourceConfigured.value) await loadSuggestions();
  } catch (error) {
    source.error = error.response?.data?.message || 'Quelle konnte nicht gespeichert werden.';
  } finally {
    source.saving = false;
  }
}

async function loadSuggestions() {
  if (!sourceConfigured.value) return;
  suggestionsLoading.value = true;
  suggestionsError.value = '';
  try {
    const { data } = await api.get('/api/employee-email-templates/suggestions', { params: { locationId: selectedLocationId.value } });
    suggestions.value = data.data || [];
  } catch (error) {
    suggestionsError.value = error.response?.data?.message || 'Vorschläge konnten nicht geladen werden.';
  } finally {
    suggestionsLoading.value = false;
  }
}

async function useSuggestion(msg) {
  saveError.value = '';
  try {
    const { data } = await api.get(`/api/employee-email-templates/suggestions/${encodeURIComponent(msg.id)}`, { params: { locationId: selectedLocationId.value } });
    const html = data.data.html || '';
    Object.assign(editor, {
      id: null,
      name: msg.subject || 'Neue Vorlage',
      subjectTemplate: data.data.subject || msg.subject || '',
      htmlTemplate: html,
      attachmentIds: [],
      sourceMessageId: data.data.id || msg.id,
    });
    setDisplayHtml(html);
  } catch (error) {
    saveError.value = error.response?.data?.message || 'E-Mail konnte nicht geladen werden.';
  }
}

async function loadTemplates() {
  templatesLoading.value = true;
  templatesError.value = '';
  try {
    const { data } = await api.get('/api/employee-email-templates', { params: { locationId: selectedLocationId.value } });
    templates.value = data.data || [];
    placeholders.value = data.placeholders || {};
  } catch (error) {
    templatesError.value = error.response?.data?.message || 'Vorlagen konnten nicht geladen werden.';
  } finally {
    templatesLoading.value = false;
  }
}

async function loadLibrary() {
  libLoading.value = true;
  libError.value = '';
  try {
    const { data } = await api.get('/api/bewerber/admin/email-documents');
    const all = data.data || [];
    libDocs.value = all.filter((doc) => {
      const docLoc = doc.locationV2?._id || '';
      return !docLoc || docLoc === selectedLocationId.value;
    });
  } catch (error) {
    libError.value = error.response?.data?.message || 'Bibliothek konnte nicht geladen werden.';
  } finally {
    libLoading.value = false;
  }
}

async function uploadAttachment(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || !selectedLocationId.value) return;
  uploading.value = true;
  libError.value = '';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('locationId', selectedLocationId.value);
    const { data } = await api.post('/api/bewerber/admin/email-documents', formData);
    await loadLibrary();
    const newId = data.data?._id;
    if (newId && !editor.attachmentIds.includes(newId)) editor.attachmentIds.push(newId);
  } catch (error) {
    libError.value = error.response?.data?.message || 'Datei konnte nicht hochgeladen werden.';
  } finally {
    uploading.value = false;
  }
}

function editTemplate(tpl) {
  saveError.value = '';
  const html = tpl.htmlTemplate || '';
  Object.assign(editor, {
    id: tpl._id,
    name: tpl.name || '',
    subjectTemplate: tpl.subjectTemplate || '',
    htmlTemplate: html,
    attachmentIds: (tpl.attachments || []).map((a) => a._id || a),
    sourceMessageId: tpl.sourceMessageId || null,
  });
  setDisplayHtml(html);
}

function newTemplate() { resetEditor(); }
function resetEditor() {
  Object.assign(editor, { id: null, name: '', subjectTemplate: '', htmlTemplate: '', attachmentIds: [], sourceMessageId: null });
  displayHtml.value = '';
  saveError.value = '';
}

function placeholderToken(key) { return `{{${key}}}`; }
function insertPlaceholder(key) {
  const token = placeholderToken(key);
  const el = htmlRef.value;
  if (!el || typeof el.selectionStart !== 'number') {
    editor.htmlTemplate += token;
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = editor.htmlTemplate;
  editor.htmlTemplate = value.slice(0, start) + token + value.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    const caret = start + token.length;
    el.setSelectionRange(caret, caret);
  });
}

function isAttached(docId) { return editor.attachmentIds.includes(docId); }
function toggleAttachment(docId) {
  const index = editor.attachmentIds.indexOf(docId);
  if (index === -1) editor.attachmentIds.push(docId);
  else editor.attachmentIds.splice(index, 1);
}

async function saveTemplate() {
  if (!canSave.value) return;
  saving.value = true;
  saveError.value = '';
  const payload = {
    locationId: selectedLocationId.value,
    name: editor.name,
    subjectTemplate: editor.subjectTemplate,
    htmlTemplate: editor.htmlTemplate,
    attachments: editor.attachmentIds,
    sourceMessageId: editor.sourceMessageId,
  };
  try {
    if (editor.id) {
      const { data } = await api.put(`/api/employee-email-templates/${editor.id}`, payload);
      editTemplate(data.data);
    } else {
      const { data } = await api.post('/api/employee-email-templates', payload);
      editTemplate(data.data);
    }
    await loadTemplates();
  } catch (error) {
    saveError.value = error.response?.data?.message || 'Vorlage konnte nicht gespeichert werden.';
  } finally {
    saving.value = false;
  }
}

async function deleteTemplate(tpl) {
  if (!window.confirm(`Vorlage „${tpl.name}“ wirklich löschen?`)) return;
  try {
    await api.delete(`/api/employee-email-templates/${tpl._id}`);
    if (editor.id === tpl._id) resetEditor();
    await loadTemplates();
  } catch (error) {
    templatesError.value = error.response?.data?.message || 'Vorlage konnte nicht gelöscht werden.';
  }
}

async function previewTemplate() {
  saveError.value = '';
  try {
    const { data } = await api.post('/api/employee-email-templates/preview', {
      name: editor.name || 'Vorschau',
      subjectTemplate: editor.subjectTemplate,
      htmlTemplate: editor.htmlTemplate,
      locationName: selectedLocation.value?.nameFull || 'Standort',
    });
    Object.assign(preview, { open: true, subject: data.data.subject, html: data.data.html });
  } catch (error) {
    saveError.value = error.response?.data?.message || 'Vorschau konnte nicht erstellt werden.';
  }
}

function formatDate(value) { return value ? new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'; }
function formatFileSize(size) { return `${(Number(size || 0) / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`; }
</script>

<style scoped lang="scss">
.eet { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.eet__top { display: flex; flex-direction: column; gap: 12px; }
.eet__location { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.eet__location label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--muted); }
.eet__location select { min-width: 240px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
.eet__source-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text); cursor: pointer; }
.eet__source-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.eet__source { border: 1px solid var(--border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: var(--surface); }
.eet__source-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
.eet__source-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--muted); }
.eet__source-grid input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); }
.eet__source-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.eet__hint { font-size: 12px; color: var(--muted); margin: 0; }
.eet__placeholder { color: var(--muted); padding: 40px 0; text-align: center; }

.eet__grid { display: grid; grid-template-columns: 300px minmax(0, 1fr) 260px; gap: 16px; align-items: start; }
.eet__list { display: flex; flex-direction: column; gap: 16px; }
.eet__panel { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
.eet__panel-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.eet__panel-head h3 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.eet__icon { border: none; background: transparent; color: var(--muted); cursor: pointer; padding: 4px 6px; border-radius: 6px; }
.eet__icon:hover { color: var(--text); background: var(--bg); }
.eet__icon--danger:hover { color: #dc3545; }
.eet__state { padding: 12px; font-size: 13px; color: var(--muted); margin: 0; }
.eet__error { color: #dc3545; font-size: 13px; margin: 0; }

.eet__suggestions, .eet__templates, .eet__lib { list-style: none; margin: 0; padding: 0; max-height: 340px; overflow-y: auto; }
.eet__suggestions li button { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; padding: 10px 12px; border: none; border-bottom: 1px solid var(--border); background: transparent; color: var(--text); cursor: pointer; }
.eet__suggestions li button:hover { background: var(--bg); }
.eet__suggestions strong { font-size: 13px; }
.eet__suggestions small { font-size: 11px; color: var(--muted); }
.eet__preview-line { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.eet__templates li { display: flex; align-items: stretch; border-bottom: 1px solid var(--border); }
.eet__templates li.active { background: color-mix(in srgb, var(--primary) 10%, transparent); }
.eet__templates li > button:first-child { flex: 1; display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 10px 12px; border: none; background: transparent; color: var(--text); cursor: pointer; }
.eet__templates strong { font-size: 13px; }
.eet__templates small { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.eet__editor { display: flex; flex-direction: column; gap: 12px; }
.eet__field { display: flex; flex-direction: column; gap: 4px; }
.eet__field label { font-size: 13px; color: var(--muted); }
.eet__field input, .eet__field textarea { padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-family: inherit; }
.eet__field textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.5; resize: vertical; }

.eet__content { display: flex; flex-direction: column; gap: 8px; }
.eet__content-tabs { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.eet__content-tabs > label { font-size: 13px; color: var(--muted); }
.eet__content-switch { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.eet__content-switch button { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: none; background: transparent; color: var(--muted); cursor: pointer; font-size: 12.5px; }
.eet__content-switch button + button { border-left: 1px solid var(--border); }
.eet__content-switch button.active { background: var(--primary); color: #fff; }
.eet__content-preview { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: #fff; min-height: 360px; display: flex; }
.eet__content-preview iframe { flex: 1; width: 100%; min-height: 360px; border: none; background: #fff; }
.eet__content-preview .eet__state { align-self: center; margin: 0 auto; }
.eet__content-html { display: flex; flex-direction: column; gap: 12px; }
.eet__content-html textarea { padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.5; resize: vertical; }

.eet__marks { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.eet__marks-label { font-size: 12px; color: var(--muted); }
.eet__marks button { border: 1px solid var(--primary); color: var(--primary); background: transparent; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-family: ui-monospace, monospace; cursor: pointer; }
.eet__marks button:hover { background: color-mix(in srgb, var(--primary) 12%, transparent); }

.eet__actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 4px; }
.eet__btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text); cursor: pointer; }
.eet__btn--primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.eet__btn:disabled { opacity: 0.6; cursor: not-allowed; }

.eet__attachments { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding-bottom: 6px; }
.eet__attachments .eet__hint { padding: 0 12px; }
.eet__upload { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 28px; border: 1px solid var(--primary); color: var(--primary); border-radius: 8px; cursor: pointer; }
.eet__upload:hover { background: color-mix(in srgb, var(--primary) 12%, transparent); }
.eet__upload--busy { opacity: 0.6; cursor: progress; }
.eet__upload input { display: none; }
.eet__lib li { border-bottom: 1px solid var(--border); }
.eet__lib li.active { background: color-mix(in srgb, var(--primary) 10%, transparent); }
.eet__lib label { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 8px; align-items: center; padding: 9px 12px; cursor: pointer; }
.eet__lib input { grid-row: span 2; }
.eet__lib-name { font-size: 13px; }
.eet__lib small { grid-column: 2; font-size: 11px; color: var(--muted); }

.eet__modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px; }
.eet__modal { background: var(--surface); border-radius: 12px; width: min(760px, 100%); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
.eet__modal header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.eet__modal header h3 { margin: 0; font-size: 15px; }
.eet__modal header small { color: var(--muted); font-size: 12px; }
.eet__modal header button { border: none; background: transparent; color: var(--muted); cursor: pointer; font-size: 16px; }
.eet__modal iframe { flex: 1; width: 100%; min-height: 420px; border: none; background: #fff; }

@media (max-width: 1100px) {
  .eet__grid { grid-template-columns: 1fr; }
}
</style>
