<template>
  <div class="window">
    <h1><font-awesome-icon :icon="['fas', 'file-alt']" /> PDF-Vorlagen</h1>

    <!-- ── Template-Liste ─────────────────────────────────────────────── -->
    <div v-if="view === 'list'" class="list-view">
      <div class="list-header">
        <p class="info-text">PDF-Vorlagen hochladen, Felder platzieren und mit Formularen verknüpfen.</p>
        <button class="btn-primary" @click="view = 'upload'">
          <font-awesome-icon :icon="['fas', 'plus']" /> Neue Vorlage
        </button>
      </div>

      <div v-if="loading" class="loading-state"><font-awesome-icon :icon="['fas', 'spinner']" spin /> Lade Vorlagen…</div>
      <div v-else-if="templates.length === 0" class="empty-state">
        <font-awesome-icon :icon="['fas', 'file-pdf']" size="2x" />
        <p>Noch keine Vorlagen vorhanden.</p>
      </div>
      <div v-else class="template-grid">
        <div v-for="t in templates" :key="t._id" class="template-card">
          <div class="template-preview">
            <img v-if="thumbnails[t._id]" :src="thumbnails[t._id]" class="preview-thumb" alt="Vorschau" />
            <div v-else class="preview-placeholder">
              <font-awesome-icon :icon="['fas', 'file-pdf']" />
            </div>
          </div>
          <div class="template-body">
            <div class="template-info">
              <div class="template-name">{{ t.name }}</div>
              <div class="template-meta">{{ t.pageCount }} {{ t.pageCount === 1 ? 'Seite' : 'Seiten' }} · {{ t.fields.length }} Felder</div>
              <div v-if="t.description" class="template-desc">{{ t.description }}</div>
            </div>
            <div class="template-actions">
              <button class="btn-action" title="Felder bearbeiten" @click="openEditor(t._id)">
                <font-awesome-icon :icon="['fas', 'pencil-alt']" /> Bearbeiten
              </button>
              <button class="btn-action" title="Vorlage ausfüllen" @click="$router.push(`/pdf-ausfuellen/${t._id}`)">
                <font-awesome-icon :icon="['fas', 'pen']" /> Ausfüllen
              </button>
              <button class="btn-action btn-danger" title="Löschen" @click="deleteTemplate(t)">
                <font-awesome-icon :icon="['fas', 'trash']" /> Löschen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Upload-Formular ────────────────────────────────────────────── -->
    <div v-else-if="view === 'upload'" class="upload-view">
      <div class="section-nav">
        <button class="btn-back" @click="view = 'list'"><font-awesome-icon :icon="['fas', 'arrow-left']" /> Zurück</button>
        <h2>Neue Vorlage</h2>
      </div>
      <div class="upload-form">
        <div class="form-row">
          <label>Name <span class="required">*</span></label>
          <input v-model="uploadForm.name" type="text" placeholder="z.B. Arbeitsvertrag Vollzeit" class="form-input" />
        </div>
        <div class="form-row">
          <label>Beschreibung</label>
          <input v-model="uploadForm.description" type="text" placeholder="Optionale Beschreibung" class="form-input" />
        </div>
        <div class="form-row">
          <label>PDF-Datei <span class="required">*</span></label>
          <div
            class="drop-zone"
            :class="{ 'has-file': uploadForm.file }"
            @dragover.prevent
            @drop.prevent="onDropPdf"
            @click="$refs.pdfFileInput.click()"
          >
            <font-awesome-icon :icon="['fas', uploadForm.file ? 'file-pdf' : 'cloud-arrow-up']" />
            <span v-if="uploadForm.file">{{ uploadForm.file.name }}</span>
            <span v-else>PDF hier ablegen oder klicken</span>
          </div>
          <input ref="pdfFileInput" type="file" accept="application/pdf" style="display:none" @change="onPdfFileChange" />
        </div>
        <div class="form-actions">
          <button class="btn-secondary" @click="view = 'list'">Abbrechen</button>
          <button class="btn-primary" :disabled="uploading || !uploadForm.name || !uploadForm.file" @click="submitUpload">
            <font-awesome-icon v-if="uploading" :icon="['fas', 'spinner']" spin />
            <font-awesome-icon v-else :icon="['fas', 'upload']" />
            {{ uploading ? 'Uploading…' : 'Hochladen' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Editor ─────────────────────────────────────────────────────── -->
    <div v-else-if="view === 'editor' && currentTemplate" class="editor-view">
      <div class="section-nav">
        <button class="btn-back" @click="leaveEditor"><font-awesome-icon :icon="['fas', 'arrow-left']" /> Zurück</button>
        <h2>{{ currentTemplate.name }}</h2>
        <div class="nav-actions">
          <span class="page-nav">
            <button class="btn-icon" :disabled="currentPage === 0" @click="goToPage(currentPage - 1)">
              <font-awesome-icon :icon="['fas', 'chevron-left']" />
            </button>
            <span>Seite {{ currentPage + 1 }} / {{ currentTemplate.pageCount }}</span>
            <button class="btn-icon" :disabled="currentPage >= currentTemplate.pageCount - 1" @click="goToPage(currentPage + 1)">
              <font-awesome-icon :icon="['fas', 'chevron-right']" />
            </button>
          </span>
          <button class="btn-primary" :disabled="saving" @click="saveFields">
            <font-awesome-icon v-if="saving" :icon="['fas', 'spinner']" spin />
            <font-awesome-icon v-else :icon="['fas', 'floppy-disk']" />
            {{ saving ? 'Speichert…' : 'Felder speichern' }}
          </button>
        </div>
      </div>

      <div class="editor-body">
        <!-- PDF Canvas + Overlay -->
        <div class="canvas-wrapper">
          <div class="canvas-instructions">
            <font-awesome-icon :icon="['fas', 'info-circle']" />
            Rechtsklick auf die PDF → Feld erstellen. Rechtsklick auf ein Feld → Typ ändern oder löschen.
          </div>
          <div
            ref="canvasContainer"
            class="canvas-container"
            @contextmenu.prevent="onCanvasRightClick"
            @click.self="closeContextMenu(); selectedFieldId = null"
          >
            <canvas ref="pdfCanvas" class="pdf-canvas" @click="closeContextMenu(); selectedFieldId = null"></canvas>
            <!-- Field overlays -->
            <div
              v-for="field in fieldsOnCurrentPage"
              :key="field.id"
              class="field-overlay"
              :class="[`field-type-${field.type}`, { selected: selectedFieldId === field.id }]"
              :style="fieldStyle(field)"
              @mousedown.prevent="startDrag($event, field)"
              @click.stop="selectedFieldId = field.id; closeContextMenu()"
              @contextmenu.prevent.stop="onFieldRightClick($event, field)"
            >
              <!-- Checkbox: centered X. Text/Date: content at bottom --> 
              <template v-if="field.type === 'checkbox'">
                <span class="field-x">✕</span>
              </template>
              <template v-else>
                <span class="field-label">{{ field.label }}</span>
                <span class="field-type-badge">{{ fieldTypeLabel(field.type) }}</span>
              </template>
              <!-- Resize handles (visible only when selected) -->
              <template v-if="selectedFieldId === field.id">
                <!-- Checkbox: all 4 corners (width + height). Text/Date: only right side (width only) -->
                <div v-if="field.type === 'checkbox'" class="resize-handle rh-nw" @mousedown.prevent.stop="startResize($event, field, 'nw')"></div>
                <div class="resize-handle rh-ne" @mousedown.prevent.stop="startResize($event, field, 'ne')"></div>
                <div v-if="field.type === 'checkbox'" class="resize-handle rh-sw" @mousedown.prevent.stop="startResize($event, field, 'sw')"></div>
                <div class="resize-handle rh-se" @mousedown.prevent.stop="startResize($event, field, 'se')"></div>
              </template>
            </div>

            <!-- Context Menu -->
            <div
              v-if="contextMenu.visible"
              class="ctx-menu"
              :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
              @click.stop
            >
              <template v-if="contextMenu.fieldId">
                <div class="ctx-section">Typ ändern</div>
                <button
                  v-for="ft in fieldTypes"
                  :key="ft.value"
                  class="ctx-item"
                  :class="{ active: contextMenuField && contextMenuField.type === ft.value }"
                  @click="changeFieldType(contextMenu.fieldId, ft.value); closeContextMenu()"
                >
                  <font-awesome-icon :icon="ft.icon" /> {{ ft.label }}
                </button>
                <div class="ctx-divider"></div>
                <button class="ctx-item ctx-danger" @click="removeField(contextMenu.fieldId); closeContextMenu()">
                  <font-awesome-icon :icon="['fas', 'trash']" /> Löschen
                </button>
              </template>
              <template v-else>
                <div class="ctx-section">Neues Feld</div>
                <button
                  v-for="ft in fieldTypes"
                  :key="ft.value"
                  class="ctx-item"
                  @click="addFieldAt(ft.value, contextMenu.pct); closeContextMenu()"
                >
                  <font-awesome-icon :icon="ft.icon" /> {{ ft.label }}
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- Field Editor Panel -->
        <div class="field-panel">
          <h3>Felder (Seite {{ currentPage + 1 }})</h3>
          <div v-if="fields.length === 0" class="no-fields">Noch keine Felder auf dieser Vorlage.</div>
          <div v-else class="fields-list">
            <div
              v-for="f in fields"
              :key="f.id"
              class="field-list-item"
              :class="{ selected: selectedFieldId === f.id, 'other-page': f.page !== currentPage }"
              @click="selectedFieldId = f.id; if(f.page !== currentPage) goToPage(f.page)"
            >
              <font-awesome-icon :icon="fieldTypeIcon(f.type)" />
              <span class="field-list-name">{{ f.label }}</span>
              <span class="field-list-page">S.{{ f.page + 1 }}</span>
            </div>
          </div>

          <!-- Selected field editor -->
          <template v-if="selectedField">
            <div class="field-editor-title">Feld bearbeiten</div>
            <div class="field-editor">
              <div class="fe-row">
                <label>Label / Feldname</label>
                <input v-model="selectedField.label" type="text" class="form-input" />
              </div>
              <div class="fe-row">
                <label>Typ</label>
                <select v-model="selectedField.type" class="form-input">
                  <option v-for="ft in fieldTypes" :key="ft.value" :value="ft.value">{{ ft.label }}</option>
                </select>
              </div>
              <div v-if="selectedField.type !== 'checkbox'" class="fe-row">
                <label>Schriftgröße</label>
                <input v-model.number="selectedField.fontSize" type="number" min="6" max="36" class="form-input" />
              </div>
              <div class="fe-row">
                <label>Standardwert</label>
                <input v-model="selectedField.defaultValue" type="text" class="form-input" placeholder="Optional" />
              </div>
              <div class="fe-row fe-row-2">
                <div>
                  <label>Breite (%)</label>
                  <input v-model.number="selectedField.width" type="number" min="2" max="100" class="form-input" />
                </div>
                <div v-if="selectedField.type === 'checkbox'">
                  <label>Höhe (%)</label>
                  <input v-model.number="selectedField.height" type="number" min="1" max="50" class="form-input" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Suppress harmless font/encoding warnings from pdfjs worker
const _warn = console.warn.bind(console);
console.warn = (...args) => {
  if (typeof args[0] === 'string' && (args[0].startsWith('TT:') || args[0].includes('getHexString'))) return;
  _warn(...args);
};

// ── State ────────────────────────────────────────────────────────────────
const view = ref('list');       // 'list' | 'upload' | 'editor'
const templates = ref([]);
const loading = ref(false);
const uploading = ref(false);
const saving = ref(false);
const currentTemplate = ref(null);
const currentPage = ref(0);
const fields = ref([]);         // all fields (all pages)
const selectedFieldId = ref(null);
const contextMenu = ref({ visible: false, x: 0, y: 0, fieldId: null, pct: null });

const pdfCanvas = ref(null);
const canvasContainer = ref(null);
const pdfFileInput = ref(null);
const thumbnails = ref({});
const pageNaturalHeight = ref(841); // natural page height in pt (A4 default); updated on page load

let pdfDoc = null;

const uploadForm = ref({ name: '', description: '', file: null });
const token = localStorage.getItem('token');
const headers = { 'x-auth-token': token };

const fieldTypes = [
  { value: 'text',      label: 'Text',    icon: ['fas', 'font'] },
  { value: 'date',      label: 'Datum',   icon: ['fas', 'calendar'] },
  { value: 'checkbox',  label: 'Checkbox',icon: ['fas', 'check'] },
];

// ── Computed ──────────────────────────────────────────────────────────────
const fieldsOnCurrentPage = computed(() =>
  fields.value.filter(f => f.page === currentPage.value)
);

const selectedField = computed(() =>
  fields.value.find(f => f.id === selectedFieldId.value) || null
);

const contextMenuField = computed(() =>
  fields.value.find(f => f.id === contextMenu.value.fieldId) || null
);

// When fontSize changes on a text/date field, keep the bottom edge fixed
// by shifting y down (top moves down = smaller field pushes top border down).
watch(() => selectedField.value?.fontSize, (newFs, oldFs) => {
  const f = selectedField.value;
  if (!f || f.type === 'checkbox' || !oldFs || !newFs || oldFs === newFs) return;
  const oldH = (oldFs * 1.5 / pageNaturalHeight.value) * 100;
  const newH = (newFs * 1.5 / pageNaturalHeight.value) * 100;
  f.y = Math.max(0, f.y + oldH - newH);
});

// ── Helpers ───────────────────────────────────────────────────────────────
function fieldTypeLabel(type) {
  return fieldTypes.find(ft => ft.value === type)?.label || type;
}

function fieldTypeIcon(type) {
  return fieldTypes.find(ft => ft.value === type)?.icon || ['fas', 'font'];
}

function fieldDisplayHeight(field) {
  if (field.type === 'checkbox') return field.height;
  // Text/date: derive height from fontSize so it mirrors actual PDF text height
  return ((field.fontSize || 11) * 1.5 / pageNaturalHeight.value) * 100;
}

function fieldStyle(field) {
  return {
    left: `${field.x}%`,
    top: `${field.y}%`,
    width: `${field.width}%`,
    height: `${fieldDisplayHeight(field)}%`,
  };
}

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

// ── API ───────────────────────────────────────────────────────────────────
async function fetchTemplates() {
  loading.value = true;
  try {
    const res = await axios.get('/api/pdf-templates', { headers });
    templates.value = res.data;
    // Render thumbnails after list is loaded
    for (const t of res.data) {
      renderThumbnail(t._id);
    }
  } catch (e) {
    console.error('Fehler beim Laden der Vorlagen', e);
  } finally {
    loading.value = false;
  }
}

async function renderThumbnail(id) {
  try {
    const res = await axios.get(`/api/pdf-templates/${id}/pdf`, {
      headers,
      responseType: 'arraybuffer'
    });
    const doc = await pdfjsLib.getDocument({ data: res.data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 0.4 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    thumbnails.value = { ...thumbnails.value, [id]: canvas.toDataURL() };
  } catch {}
}

async function deleteTemplate(t) {
  if (!confirm(`Vorlage "${t.name}" wirklich löschen?`)) return;
  await axios.delete(`/api/pdf-templates/${t._id}`, { headers });
  await fetchTemplates();
}

async function submitUpload() {
  if (uploading.value) return;
  uploading.value = true;
  try {
    const fd = new FormData();
    fd.append('pdf', uploadForm.value.file);
    fd.append('name', uploadForm.value.name);
    fd.append('description', uploadForm.value.description);
    await axios.post('/api/pdf-templates', fd, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' }
    });
    uploadForm.value = { name: '', description: '', file: null };
    await fetchTemplates();
    view.value = 'list';
  } catch (e) {
    alert('Fehler beim Hochladen: ' + (e.response?.data?.message || e.message));
  } finally {
    uploading.value = false;
  }
}

async function saveFields() {
  if (saving.value) return;
  saving.value = true;
  try {
    await axios.put(`/api/pdf-templates/${currentTemplate.value._id}`, { fields: fields.value }, { headers });
    currentTemplate.value.fields = [...fields.value];
    // Update in list
    const idx = templates.value.findIndex(t => t._id === currentTemplate.value._id);
    if (idx !== -1) templates.value[idx].fields = [...fields.value];
    alert('Felder gespeichert!');
  } catch (e) {
    alert('Fehler beim Speichern: ' + (e.response?.data?.message || e.message));
  } finally {
    saving.value = false;
  }
}

// ── File Handling ─────────────────────────────────────────────────────────
function onPdfFileChange(e) {
  uploadForm.value.file = e.target.files[0] || null;
}

function onDropPdf(e) {
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') uploadForm.value.file = file;
}

// ── Editor ────────────────────────────────────────────────────────────────
async function openEditor(id) {
  try {
    const res = await axios.get(`/api/pdf-templates/${id}`, { headers });
    currentTemplate.value = res.data;
    fields.value = res.data.fields ? res.data.fields.map(f => ({ ...f })) : [];
    currentPage.value = 0;
    selectedFieldId.value = null;
    view.value = 'editor';
    await nextTick();
    await loadPdfPage(currentPage.value);
  } catch (e) {
    alert('Fehler beim Öffnen der Vorlage');
  }
}

function leaveEditor() {
  pdfDoc = null;
  currentTemplate.value = null;
  fields.value = [];
  view.value = 'list';
}

async function loadPdfPage(pageIdx) {
  if (!currentTemplate.value) return;

  // Load PDF if not yet loaded
  if (!pdfDoc) {
    const res = await axios.get(`/api/pdf-templates/${currentTemplate.value._id}/pdf`, {
      headers,
      responseType: 'arraybuffer'
    });
    pdfDoc = await pdfjsLib.getDocument({ data: res.data }).promise;
  }

  const page = await pdfDoc.getPage(pageIdx + 1); // 1-indexed
  const naturalViewport = page.getViewport({ scale: 1 });
  pageNaturalHeight.value = naturalViewport.height; // pt = page height in PDF points
  const scale = 1.5;
  const viewport = page.getViewport({ scale });

  const canvas = pdfCanvas.value;
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
}

async function goToPage(idx) {
  currentPage.value = idx;
  await loadPdfPage(idx);
}

// ── Field Operations ──────────────────────────────────────────────────────
function addField(type) {
  const field = {
    id: generateId(),
    type,
    label: type === 'text' ? 'Textfeld' : type === 'date' ? 'Datum' : 'Checkbox',
    page: currentPage.value,
    x: 10,
    y: 10,
    width: type === 'checkbox' ? 4 : 25,
    height: type === 'checkbox' ? 3 : 4,
    fontSize: 11,
    defaultValue: ''
  };
  fields.value.push(field);
  selectedFieldId.value = field.id;
}

function removeField(id) {
  fields.value = fields.value.filter(f => f.id !== id);
  if (selectedFieldId.value === id) selectedFieldId.value = null;
}

function changeFieldType(id, type) {
  const f = fields.value.find(f => f.id === id);
  if (!f) return;
  f.type = type;
  f.label = type === 'text' ? 'Textfeld' : type === 'date' ? 'Datum' : 'Checkbox';
  if (type === 'checkbox') { f.width = 4; f.height = 3; }
  else { f.width = 25; f.height = 4; }
}

// ── Context Menu ──────────────────────────────────────────────────────────
function onCanvasRightClick(e) {
  const rect = pdfCanvas.value.getBoundingClientRect();
  const containerRect = canvasContainer.value.getBoundingClientRect();
  const x = e.clientX - containerRect.left;
  const y = e.clientY - containerRect.top;
  // Percentages relative to actual canvas display size
  const pct = {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top)  / rect.height) * 100,
  };

  const menuW = 160, menuH = 130;
  const mx = x + menuW > containerRect.width  ? x - menuW : x;
  const my = y + menuH > containerRect.height ? y - menuH : y;

  contextMenu.value = { visible: true, x: mx, y: my, fieldId: null, pct };
}

function onFieldRightClick(e, field) {
  const containerRect = canvasContainer.value.getBoundingClientRect();
  const x = e.clientX - containerRect.left;
  const y = e.clientY - containerRect.top;

  const menuW = 160, menuH = 160;
  const mx = x + menuW > containerRect.width  ? x - menuW : x;
  const my = y + menuH > containerRect.height ? y - menuH : y;

  selectedFieldId.value = field.id;
  contextMenu.value = { visible: true, x: mx, y: my, fieldId: field.id, pct: null };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

function addFieldAt(type, pct) {
  const field = {
    id: generateId(),
    type,
    label: type === 'text' ? 'Textfeld' : type === 'date' ? 'Datum' : 'Checkbox',
    page: currentPage.value,
    x: Math.max(0, Math.min(75, pct.x - 10)),
    y: Math.max(0, Math.min(95, pct.y - 2)),
    width: type === 'checkbox' ? 4 : 25,
    height: type === 'checkbox' ? 3 : 4,
    fontSize: 11,
    defaultValue: ''
  };
  fields.value.push(field);
  selectedFieldId.value = field.id;
}

// ── Drag Logic ────────────────────────────────────────────────────────────
let dragState = null;

function startDrag(e, field) {
  const rect = pdfCanvas.value.getBoundingClientRect();

  dragState = {
    fieldId: field.id,
    startX: e.clientX,
    startY: e.clientY,
    origX: field.x,
    origY: field.y,
    containerW: rect.width,
    containerH: rect.height
  };

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!dragState) return;
  const dx = ((e.clientX - dragState.startX) / dragState.containerW) * 100;
  const dy = ((e.clientY - dragState.startY) / dragState.containerH) * 100;
  const field = fields.value.find(f => f.id === dragState.fieldId);
  if (field) {
    field.x = Math.max(0, Math.min(100 - field.width, dragState.origX + dx));
    field.y = Math.max(0, Math.min(100 - field.height, dragState.origY + dy));
  }
}

function onDragEnd() {
  dragState = null;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
}

// ── Resize Logic ──────────────────────────────────────────────────────────
let resizeState = null;

function startResize(e, field, corner) {
  const rect = pdfCanvas.value.getBoundingClientRect();
  resizeState = {
    fieldId: field.id,
    corner,
    startX: e.clientX,
    startY: e.clientY,
    origX: field.x,
    origY: field.y,
    origW: field.width,
    origH: field.height,
    containerW: rect.width,
    containerH: rect.height,
  };
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(e) {
  if (!resizeState) return;
  const dx = ((e.clientX - resizeState.startX) / resizeState.containerW) * 100;
  const dy = ((e.clientY - resizeState.startY) / resizeState.containerH) * 100;
  const field = fields.value.find(f => f.id === resizeState.fieldId);
  if (!field) return;
  const MIN = 0.5;
  const { origX, origY, origW, origH, corner } = resizeState;
  const hasManualHeight = field.type === 'checkbox';

  if (corner === 'se') {
    field.width  = Math.max(MIN, origW + dx);
    if (hasManualHeight) field.height = Math.max(MIN, origH + dy);
  } else if (corner === 'sw') {
    const newW = Math.max(MIN, origW - dx);
    field.x     = origX + origW - newW;
    field.width  = newW;
    if (hasManualHeight) field.height = Math.max(MIN, origH + dy);
  } else if (corner === 'ne') {
    field.width  = Math.max(MIN, origW + dx);
    if (hasManualHeight) {
      const newH = Math.max(MIN, origH - dy);
      field.y      = origY + origH - newH;
      field.height = newH;
    }
  } else if (corner === 'nw') {
    const newW = Math.max(MIN, origW - dx);
    field.x      = origX + origW - newW;
    field.width  = newW;
    if (hasManualHeight) {
      const newH = Math.max(MIN, origH - dy);
      field.y      = origY + origH - newH;
      field.height = newH;
    }
  }
}

function onResizeEnd() {
  resizeState = null;
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  fetchTemplates();
  window.addEventListener('click', closeContextMenu);
});

onUnmounted(() => { window.removeEventListener('click', closeContextMenu); });
</script>

<style scoped lang="scss">
.window { padding: 24px; max-width: 1400px; }
h1 { display: flex; align-items: center; gap: 10px; font-size: 1.5rem; margin-bottom: 20px; }

/* ── List view ─────────────────────────────────────────────────────────── */
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.info-text { color: var(--text-muted); font-size: 14px; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.template-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 200ms;
  &:hover { border-color: var(--primary); }
}
.template-preview {
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 4;
  overflow: hidden;
}
.preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}
.preview-placeholder {
  font-size: 2.5rem;
  color: #9ca3af;
}
.template-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}
.template-info { flex: 1; min-width: 0; }
.template-name { font-weight: 600; font-size: 14px; }
.template-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.template-desc { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.template-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.btn-action {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
  background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-muted); font-size: 12px; cursor: pointer; white-space: nowrap;
  transition: all 150ms; font-family: inherit;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &.btn-danger:hover { border-color: #dc2626; color: #dc2626; }
}

.empty-state, .loading-state {
  text-align: center; padding: 60px 20px; color: var(--text-muted);
  display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 14px;
}

/* ── Upload view ───────────────────────────────────────────────────────── */
.upload-view { max-width: 520px; }
.upload-form { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.drop-zone {
  border: 2px dashed var(--border); border-radius: 8px; padding: 28px 16px;
  text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px;
  font-size: 14px; color: var(--text-muted); transition: border-color 200ms;
  i { font-size: 1.8rem; }
  &:hover, &.has-file { border-color: var(--primary); color: var(--text); }
}
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }

/* ── Editor view ───────────────────────────────────────────────────────── */
.section-nav {
  display: flex; align-items: center; gap: 16px; margin-bottom: 20px;
  h2 { flex: 1; font-size: 1.1rem; margin: 0; }
}
.nav-actions { display: flex; align-items: center; gap: 12px; }
.page-nav { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-muted); }

.editor-body { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }

.canvas-wrapper { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.canvas-instructions { font-size: 12px; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; }

.canvas-container {
  position: relative; display: inline-block; overflow: hidden;
  border: 1px solid var(--border); border-radius: 6px;
  user-select: none;
  max-width: 100%;
  line-height: 0; /* prevent inline gap below canvas */
  cursor: crosshair;
}
.pdf-canvas {
  display: block; max-width: 100%; height: auto;
  background: #fff;
}

.field-overlay {
  position: absolute;
  border: 2px solid var(--primary);
  background: rgba(255, 140, 0, 0.12);
  border-radius: 3px;
  cursor: move;
  display: flex;
  align-items: flex-end;  /* text sits at bottom edge */
  justify-content: flex-start; /* left-aligned */
  gap: 3px;
  padding: 0 4px;
  font-size: 10px;
  overflow: hidden;
  transition: background 150ms;
  &:hover, &.selected { background: rgba(255, 140, 0, 0.25); }
  &.field-type-checkbox {
    border-color: #5a67d8; background: rgba(90, 103, 216, 0.12);
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  &.field-type-date { border-color: #38a169; background: rgba(56, 161, 105, 0.12); }
}
.field-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%; font-weight: 600; color: #333; }
.field-type-badge { font-size: 9px; color: #666; background: rgba(255,255,255,.7); border-radius: 2px; padding: 1px 3px; margin-left: auto; flex-shrink: 0; }
.field-x {
  font-size: 13px; font-weight: 700; color: #5a67d8; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; pointer-events: none;
}

/* Resize handles */
.resize-handle {
  position: absolute;
  width: 8px; height: 8px;
  background: #fff;
  border: 2px solid var(--primary);
  border-radius: 2px;
  z-index: 20;
  box-shadow: 0 1px 3px rgba(0,0,0,.25);
}
.rh-nw { top: -4px; left: -4px; cursor: nw-resize; }
.rh-ne { top: -4px; right: -4px; cursor: ne-resize; }
.rh-sw { bottom: -4px; left: -4px; cursor: sw-resize; }
.rh-se { bottom: -4px; right: -4px; cursor: se-resize; }
.field-type-checkbox .resize-handle { border-color: #5a67d8; }
.field-type-date .resize-handle { border-color: #38a169; }

/* ── Context Menu ──────────────────────────────────────────────────────── */
.ctx-menu {
  position: absolute;
  z-index: 100;
  background: var(--surface, #fff);
  opacity: 1;
  backdrop-filter: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.18);
  min-width: 150px;
  padding: 4px;
  user-select: none;
}
.ctx-section {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  padding: 5px 10px 3px;
  font-weight: 600;
}
.ctx-divider { height: 1px; background: var(--border); margin: 4px 0; }
.ctx-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 10px; border: none; border-radius: 5px;
  background: transparent; color: var(--text); font-size: 13px; cursor: pointer;
  text-align: left; transition: background 120ms; font-family: inherit;
  &:hover { background: var(--bg); }
  &.active { color: var(--primary); font-weight: 600; }
  &.ctx-danger { color: #dc2626; &:hover { background: rgba(220,38,38,.08); } }
}

/* ── Field panel ───────────────────────────────────────────────────────── */
.field-panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px; display: flex; flex-direction: column; gap: 12px; align-self: start;
  h3 { font-size: 14px; margin: 0; }
}
.no-fields { font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0; }
.fields-list { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow-y: auto; }
.field-list-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px;
  font-size: 13px; cursor: pointer; transition: background 150ms;
  &:hover { background: var(--bg); }
  &.selected { background: color-mix(in srgb, var(--primary) 10%, var(--surface)); }
  &.other-page { opacity: .65; }
}
.field-list-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field-list-page { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }

.field-editor-title { font-size: 13px; font-weight: 600; padding-top: 8px; border-top: 1px solid var(--border); }
.field-editor { display: flex; flex-direction: column; gap: 10px; }
.fe-row { display: flex; flex-direction: column; gap: 4px; label { font-size: 12px; color: var(--text-muted); } }
.fe-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* ── Shared ────────────────────────────────────────────────────────────── */
.form-row { display: flex; flex-direction: column; gap: 6px; label { font-size: 13px; font-weight: 500; } }
.form-input {
  border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px;
  background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit;
  &:focus { outline: none; border-color: var(--primary); }
}
.required { color: var(--primary); }

.btn-primary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 13px;
  cursor: pointer; transition: opacity 200ms; font-family: inherit;
  &:hover { opacity: .85; }
  &:disabled { opacity: .5; cursor: not-allowed; }
}
.btn-secondary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; cursor: pointer; transition: border-color 200ms; font-family: inherit;
  &:hover { border-color: var(--text); }
}
.btn-back {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
  background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; cursor: pointer; white-space: nowrap; font-family: inherit;
  &:hover { color: var(--text); border-color: var(--text); }
}
.btn-icon {
  background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-muted); padding: 5px 8px; cursor: pointer; transition: all 150ms; font-size: 13px;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &:disabled { opacity: .4; cursor: not-allowed; }
  &.btn-danger:hover { border-color: #dc2626; color: #dc2626; }
}
</style>
