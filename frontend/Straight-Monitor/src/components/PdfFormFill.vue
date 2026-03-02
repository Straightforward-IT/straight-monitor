<template>
  <div class="window">
    <!-- Loading / not found -->
    <div v-if="loading" class="loading-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
      <p>Lade Vorlage…</p>
    </div>
    <div v-else-if="!template" class="empty-state">
      <font-awesome-icon :icon="['fas', 'circle-exclamation']" size="2x" />
      <p>Vorlage nicht gefunden.</p>
      <button class="btn-back" @click="$router.push('/pdf-vorlagen')"><font-awesome-icon :icon="['fas', 'arrow-left']" /> Zurück</button>
    </div>

    <template v-else>
      <div class="page-header">
        <button class="btn-back" @click="$router.push('/pdf-vorlagen')">
          <font-awesome-icon :icon="['fas', 'arrow-left']" /> Vorlagen
        </button>
        <div class="header-info">
          <h1><font-awesome-icon :icon="['fas', 'file-pen']" /> {{ template.name }}</h1>
          <p v-if="template.description" class="template-desc">{{ template.description }}</p>
        </div>
      </div>

      <div class="fill-layout">
        <!-- Form -->
        <div class="form-panel">
          <h2>Formular ausfüllen</h2>

          <div v-if="template.fields.length === 0" class="no-fields-hint">
            <font-awesome-icon :icon="['fas', 'info-circle']" />
            Diese Vorlage hat noch keine Felder. Bitte erst im Vorlagen-Editor Felder hinzufügen.
          </div>

          <form v-else class="field-form" @submit.prevent="fillAndDownload">
            <div v-for="field in template.fields" :key="field.id" class="form-row">
              <label :for="field.id">
                <font-awesome-icon :icon="fieldIcon(field.type)" class="field-icon" />
                {{ field.label }}
                <span class="page-badge">S.{{ field.page + 1 }}</span>
              </label>

              <!-- Checkbox -->
              <div v-if="field.type === 'checkbox'" class="checkbox-wrapper">
                <input
                  :id="field.id"
                  v-model="formValues[field.id]"
                  type="checkbox"
                  class="form-checkbox"
                />
                <span>{{ formValues[field.id] ? 'Ja / Angekreuzt' : 'Nein / Leer' }}</span>
              </div>

              <!-- Date -->
              <input
                v-else-if="field.type === 'date'"
                :id="field.id"
                v-model="formValues[field.id]"
                type="date"
                class="form-input"
              />

              <!-- Text / Signature -->
              <input
                v-else
                :id="field.id"
                v-model="formValues[field.id]"
                type="text"
                class="form-input"
                :placeholder="field.defaultValue || field.label"
              />
            </div>

            <div class="form-actions">
              <button type="reset" class="btn-secondary" @click="resetForm">
                <font-awesome-icon :icon="['fas', 'rotate-left']" /> Zurücksetzen
              </button>
              <button type="submit" class="btn-primary" :disabled="filling">
                <font-awesome-icon v-if="filling" :icon="['fas', 'spinner']" spin />
                <font-awesome-icon v-else :icon="['fas', 'download']" />
                {{ filling ? 'Erstelle PDF…' : 'PDF herunterladen' }}
              </button>
            </div>
          </form>
        </div>

        <!-- PDF Preview -->
        <div class="preview-panel">
          <h2>Vorschau</h2>
          <div class="preview-page-nav" v-if="template.pageCount > 1">
            <button class="btn-icon-sm" :disabled="previewPage === 0" @click="changePage(-1)">
              <font-awesome-icon :icon="['fas', 'chevron-left']" />
            </button>
            <span>Seite {{ previewPage + 1 }} / {{ template.pageCount }}</span>
            <button class="btn-icon-sm" :disabled="previewPage >= template.pageCount - 1" @click="changePage(1)">
              <font-awesome-icon :icon="['fas', 'chevron-right']" />
            </button>
          </div>
          <div class="canvas-wrapper">
            <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>
            <!-- show field positions as overlay -->
            <div
              v-for="f in fieldsOnPreviewPage"
              :key="f.id"
              class="preview-field"
              :class="[`pf-type-${f.type}`, { 'pf-checked': f.type === 'checkbox' && formValues[f.id] }]"
              :style="fieldStyle(f)"
              :title="f.label"
            >
              <template v-if="f.type === 'checkbox'">
                <span v-if="formValues[f.id]" class="pf-x">✕</span>
              </template>
              <span v-else class="pf-value">
                {{ formValues[f.id] ? (f.type === 'date' ? formatDateDisplay(formValues[f.id]) : formValues[f.id]) : '' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Suppress harmless TrueType font warnings from pdfjs worker
const _warn = console.warn.bind(console);
console.warn = (...args) => {
  if (typeof args[0] === 'string' && (args[0].startsWith('TT:') || args[0].includes('getHexString'))) return;
  _warn(...args);
};

const route = useRoute();
const token = localStorage.getItem('token');
const headers = { 'x-auth-token': token };

const loading = ref(true);
const filling = ref(false);
const template = ref(null);
const formValues = ref({});
const previewPage = ref(0);
const pdfCanvas = ref(null);
const pageNaturalHeight = ref(841);

let pdfDoc = null;

// ── Load template ─────────────────────────────────────────────────────────
async function loadTemplate() {
  loading.value = true;
  try {
    const res = await axios.get(`/api/pdf-templates/${route.params.id}`, { headers });
    template.value = res.data;

    // Init form values from field defaults
    const vals = {};
    for (const f of res.data.fields) {
      if (f.type === 'checkbox') {
        vals[f.id] = f.defaultValue === 'true' || f.defaultValue === '1';
      } else if (f.type === 'date') {
        vals[f.id] = f.defaultValue || '';
      } else {
        vals[f.id] = f.defaultValue || '';
      }
    }
    formValues.value = vals;
    previewPage.value = 0;
  } catch {
    template.value = null;
  } finally {
    loading.value = false;
  }

  // Wait for Vue to render the canvas (it's inside v-else, only shown after loading=false)
  if (template.value) {
    await nextTick();
    await loadPdfPreview(0);
  }
}

// ── PDF preview ───────────────────────────────────────────────────────────
async function loadPdfPreview(pageIdx) {
  if (!template.value) return;

  if (!pdfDoc) {
    const res = await axios.get(`/api/pdf-templates/${template.value._id}/pdf`, {
      headers,
      responseType: 'arraybuffer'
    });
    pdfDoc = await pdfjsLib.getDocument({ data: res.data }).promise;
  }

  const page = await pdfDoc.getPage(pageIdx + 1);

  const canvas = pdfCanvas.value;
  if (!canvas) return;

  // Scale to fit the available container width so CSS doesn't need to stretch/squash
  // the canvas (canvas height:auto doesn't maintain aspect ratio like <img>).
  const wrapper = canvas.parentElement;
  const availW = wrapper ? wrapper.clientWidth - 2 : 800; // subtract border
  const baseViewport = page.getViewport({ scale: 1 });
  pageNaturalHeight.value = baseViewport.height; // pt
  const scale = Math.min(1.6, availW / baseViewport.width);
  const viewport = page.getViewport({ scale });

  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
}

async function changePage(delta) {
  previewPage.value = Math.max(0, Math.min(template.value.pageCount - 1, previewPage.value + delta));
  await loadPdfPreview(previewPage.value);
}

// ── Computed ──────────────────────────────────────────────────────────────
const fieldsOnPreviewPage = computed(() =>
  template.value?.fields.filter(f => f.page === previewPage.value) ?? []
);

function fieldStyle(f) {
  const h = f.type === 'checkbox'
    ? f.height
    : ((f.fontSize || 11) * 1.5 / pageNaturalHeight.value) * 100;
  return { left: `${f.x}%`, top: `${f.y}%`, width: `${f.width}%`, height: `${h}%` };
}

function fieldIcon(type) {
  const map = { text: ['fas', 'font'], date: ['fas', 'calendar'], checkbox: ['fas', 'check'], signature: ['fas', 'pen'] };
  return map[type] || ['fas', 'font'];
}

function formatDateDisplay(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d) ? raw : d.toLocaleDateString('de-DE');
}

// ── Form actions ──────────────────────────────────────────────────────────
function resetForm() {
  for (const f of template.value.fields) {
    if (f.type === 'checkbox') {
      formValues.value[f.id] = f.defaultValue === 'true' || f.defaultValue === '1';
    } else {
      formValues.value[f.id] = f.defaultValue || '';
    }
  }
}

async function fillAndDownload() {
  if (filling.value) return;
  filling.value = true;
  try {
    // Serialize: checkboxes become "true"/"false" strings, dates formatted
    const values = {};
    for (const f of template.value.fields) {
      const raw = formValues.value[f.id];
      if (f.type === 'checkbox') {
        values[f.id] = raw ? 'true' : 'false';
      } else if (f.type === 'date' && raw) {
        // Format date as DD.MM.YYYY
        const d = new Date(raw);
        values[f.id] = isNaN(d) ? raw : d.toLocaleDateString('de-DE');
      } else {
        values[f.id] = raw || '';
      }
    }

    const res = await axios.post(`/api/pdf-templates/${template.value._id}/fill`, { values }, {
      headers,
      responseType: 'blob'
    });

    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.value.name.replace(/[^a-z0-9_\-]/gi, '_')}_ausgefuellt.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Fehler beim Erstellen des PDFs: ' + (e.message || 'Unbekannter Fehler'));
  } finally {
    filling.value = false;
  }
}

onMounted(loadTemplate);
</script>

<style scoped lang="scss">
.window { padding: 24px; max-width: 1300px; }

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; padding: 80px 20px; color: var(--text-muted); font-size: 14px;
}

.page-header {
  display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;
  .header-info h1 { font-size: 1.4rem; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
  .template-desc { font-size: 13px; color: var(--text-muted); margin: 0; }
}

.fill-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
}

/* ── Form Panel ──────────────────────────────────────────────────────── */
.form-panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 20px; display: flex; flex-direction: column; gap: 0; align-self: start;
  h2 { font-size: 15px; margin: 0 0 16px; }
}
.no-fields-hint {
  font-size: 13px; color: var(--text-muted); display: flex; gap: 8px; align-items: flex-start;
  padding: 16px; background: var(--bg); border-radius: 6px;
}
.field-form { display: flex; flex-direction: column; gap: 14px; }
.form-row {
  display: flex; flex-direction: column; gap: 5px;
  label { font-size: 12px; font-weight: 500; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
}
.field-icon { width: 14px; text-align: center; }
.page-badge {
  margin-left: auto; font-size: 10px; background: var(--bg); border: 1px solid var(--border);
  border-radius: 3px; padding: 1px 5px; color: var(--text-muted);
}
.checkbox-wrapper {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px; font-size: 13px;
}
.form-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
.form-input {
  border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
  background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit;
  &:focus { outline: none; border-color: var(--primary); }
}
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 6px; padding-top: 14px; border-top: 1px solid var(--border); }

/* ── Preview Panel ───────────────────────────────────────────────────── */
.preview-panel {
  display: flex; flex-direction: column; gap: 10px;
  h2 { font-size: 15px; margin: 0; }
}
.preview-page-nav {
  display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-muted);
}
.canvas-wrapper {
  position: relative; display: inline-block; border: 1px solid var(--border);
  border-radius: 6px; overflow: hidden; max-width: 100%;
  line-height: 0; /* prevent inline gap below canvas */
  align-self: flex-start;
}
.pdf-canvas { display: block; background: #fff; }

.preview-field {
  position: absolute;
  border: 1.5px solid var(--primary);
  background: rgba(255, 140, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  pointer-events: none;
  display: flex; align-items: center; justify-content: center; padding: 0 3px;
  &.pf-type-checkbox {
    border-color: #5a67d8;
    background: transparent;
  }
  &.pf-type-date { border-color: #38a169; background: rgba(56,161,105,.1); }
}
.pf-label { font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #333; font-weight: 600; }
.pf-value {
  font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: #1a1a1a; font-weight: 500; padding: 0 2px; width: 100%;
}
.pf-x {
  font-size: 12px; font-weight: 700; color: #5a67d8; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
}

/* ── Buttons ─────────────────────────────────────────────────────────── */
.btn-primary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 13px;
  cursor: pointer; transition: opacity 200ms; font-family: inherit;
  &:hover { opacity: .85; }
  &:disabled { opacity: .5; cursor: not-allowed; }
}
.btn-secondary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; cursor: pointer; font-family: inherit;
  &:hover { border-color: var(--text); }
}
.btn-back {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; flex-shrink: 0;
  background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; cursor: pointer; font-family: inherit; margin-top: 4px;
  &:hover { color: var(--text); border-color: var(--text); }
}
.btn-icon-sm {
  background: transparent; border: 1px solid var(--border); border-radius: 5px;
  color: var(--text-muted); padding: 3px 7px; cursor: pointer; font-size: 12px;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &:disabled { opacity: .4; cursor: not-allowed; }
}
</style>
