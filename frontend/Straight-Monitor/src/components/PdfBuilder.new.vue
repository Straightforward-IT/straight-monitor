<template>
  <div class="window">
    <!-- ══ LIST VIEW ══════════════════════════════════════════════════ -->
    <div v-if="view === 'list'" class="list-view">
      <div class="list-header">
        <h1><font-awesome-icon :icon="['fas', 'file-alt']" /> PDF-Vorlagen</h1>
        <button class="btn-primary" @click="openCreateDialog">
          <font-awesome-icon :icon="['fas', 'plus']" /> Neue Vorlage
        </button>
      </div>
      <div v-if="loading" class="loading-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
        <p>Lade Vorlagen…</p>
      </div>
      <div v-else-if="templates.length === 0" class="empty-state">
        <font-awesome-icon :icon="['fas', 'file-circle-plus']" size="2x" />
        <p>Noch keine Vorlagen erstellt.</p>
      </div>
      <div v-else class="template-grid">
        <div v-for="t in templates" :key="t._id" class="template-card">
          <div class="template-thumb">
            <img v-if="thumbnails[t._id]" :src="thumbnails[t._id]" class="thumb-img" />
            <font-awesome-icon v-else :icon="['fas', 'file-pdf']" class="thumb-placeholder" />
          </div>
          <div class="template-body">
            <div class="template-name">{{ t.name }}</div>
            <div class="template-meta">
              <span>{{ t.pdfs?.length ?? 0 }} PDF{{ t.pdfs?.length !== 1 ? 's' : '' }}</span>
              <span>·</span>
              <span>{{ t.bookmarks?.length ?? 0 }} Textmarken</span>
            </div>
            <p v-if="t.description" class="template-desc">{{ t.description }}</p>
            <div class="template-actions">
              <button class="btn-action" @click="openEditor(t._id)">
                <font-awesome-icon :icon="['fas', 'pencil']" /> Editor
              </button>
              <button class="btn-action" @click="$router.push(`/pdf-vorgaenge?templateId=${t._id}`)">
                <font-awesome-icon :icon="['fas', 'layer-group']" /> Vorgänge
              </button>
              <button class="btn-action btn-danger" @click="deleteTemplate(t)">
                <font-awesome-icon :icon="['fas', 'trash']" /> Löschen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ EDITOR VIEW ══════════════════════════════════════════════════ -->
    <div v-else-if="view === 'editor' && currentTemplate" class="editor-view">
      <div class="editor-topbar">
        <button class="btn-back" @click="leaveEditor">
          <font-awesome-icon :icon="['fas', 'arrow-left']" /> Vorlagen
        </button>
        <div class="editor-title-block">
          <input v-model="currentTemplate.name" class="title-input" placeholder="Vorlagenname" />
          <input v-model="currentTemplate.description" class="desc-input" placeholder="Beschreibung (optional)" />
        </div>
        <button class="btn-primary" :disabled="saving" @click="saveTemplate">
          <font-awesome-icon v-if="saving" :icon="['fas', 'spinner']" spin />
          <font-awesome-icon v-else :icon="['fas', 'floppy-disk']" />
          Speichern
        </button>
        <button class="btn-secondary" @click="$router.push(`/pdf-vorgaenge?templateId=${currentTemplate._id}`)">
          <font-awesome-icon :icon="['fas', 'layer-group']" /> Vorgänge
        </button>
      </div>

      <div class="editor-body">
        <!-- LEFT: bookmark panel -->
        <div class="bookmark-panel">
          <div class="panel-header">
            <h3><font-awesome-icon :icon="['fas', 'bookmark']" /> Textmarken</h3>
            <button class="btn-icon-sm" title="Neue Textmarke" @click="addBookmark">
              <font-awesome-icon :icon="['fas', 'plus']" />
            </button>
          </div>
          <p class="panel-hint">Wähle eine Textmarke aus, dann Rechtsklick auf der Seite zum Platzieren.</p>
          <div class="bookmark-list">
            <div
              v-for="bm in bookmarks"
              :key="bm.id"
              class="bookmark-item"
              :class="{ selected: selectedBookmarkId === bm.id }"
              @click="selectedBookmarkId = bm.id"
            >
              <template v-if="editingBookmarkId === bm.id">
                <div class="bm-edit">
                  <input v-model="bm.label" class="bm-input" placeholder="Bezeichnung" @keydown.enter="editingBookmarkId = null" />
                  <div class="bm-edit-row">
                    <select v-model="bm.fillRole" class="bm-select">
                      <option value="bediener">Bediener</option>
                      <option value="mitarbeiter">Mitarbeiter</option>
                    </select>
                    <select v-model="bm.dataType" class="bm-select">
                      <option value="text">Text</option>
                      <option value="date">Datum</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>
                  <input v-model="bm.defaultValue" class="bm-input" placeholder="Standardwert (optional)" />
                  <button class="bm-done-btn" @click="editingBookmarkId = null">
                    <font-awesome-icon :icon="['fas', 'check']" /> Fertig
                  </button>
                </div>
              </template>
              <template v-else>
                <font-awesome-icon :icon="bookmarkIcon(bm.dataType)" class="bm-type-icon" />
                <span class="bm-label">{{ bm.label }}</span>
                <span class="bm-role-badge" :class="`role-${bm.fillRole}`">{{ bm.fillRole === 'bediener' ? 'Bed.' : 'MA' }}</span>
                <span class="bm-count">×{{ placementCountOf(bm.id) }}</span>
                <button class="bm-edit-btn" @click.stop="editingBookmarkId = bm.id" title="Bearbeiten">
                  <font-awesome-icon :icon="['fas', 'pen']" />
                </button>
                <button class="bm-del-btn" @click.stop="removeBookmark(bm.id)" title="Löschen">
                  <font-awesome-icon :icon="['fas', 'xmark']" />
                </button>
              </template>
            </div>
            <p v-if="bookmarks.length === 0" class="no-items-hint">Noch keine Textmarken.</p>
          </div>
        </div>

        <!-- CENTER: canvas -->
        <div class="canvas-col">
          <div class="page-nav-bar">
            <button class="btn-icon-sm" :disabled="currentGlobalPage === 0" @click="changePage(-1)">
              <font-awesome-icon :icon="['fas', 'chevron-left']" />
            </button>
            <span class="page-label">
              <template v-if="currentPageInfo">
                Seite {{ currentGlobalPage + 1 }} / {{ allPages.length }}
                <span class="page-sub">({{ orderedPdfs[currentPageInfo.pdfIdx]?.filename ?? '' }}, S. {{ currentPageInfo.localPage + 1 }})</span>
              </template>
              <template v-else>Keine Seiten</template>
            </span>
            <button class="btn-icon-sm" :disabled="currentGlobalPage >= allPages.length - 1" @click="changePage(1)">
              <font-awesome-icon :icon="['fas', 'chevron-right']" />
            </button>
          </div>

          <p v-if="allPages.length === 0" class="no-pdf-hint">
            <font-awesome-icon :icon="['fas', 'info-circle']" />
            Noch keine PDFs. Füge rechts PDFs hinzu.
          </p>

          <div
            v-else
            ref="canvasContainer"
            class="canvas-container"
            @contextmenu.prevent="onCanvasRightClick"
            @click="closeCtxMenu"
          >
            <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>

            <div
              v-for="pl in placementsOnCurrentPage"
              :key="pl.id"
              class="placement-overlay"
              :class="[`plt-${bookmarkDataType(pl.bookmarkId)}`, `plt-role-${bookmarkRole(pl.bookmarkId)}`, { selected: selectedPlacementId === pl.id }]"
              :style="placementStyle(pl)"
              @mousedown.prevent="startDrag($event, pl)"
              @contextmenu.prevent.stop="onPlacementRightClick($event, pl)"
            >
              <span class="plt-label">{{ bookmarkLabel(pl.bookmarkId) }}</span>
              <span class="plt-role-chip" :class="`rc-${bookmarkRole(pl.bookmarkId)}`">{{ bookmarkRole(pl.bookmarkId) === 'bediener' ? 'Bed.' : 'MA' }}</span>
              <div class="rh rh-nw" @mousedown.stop.prevent="startResize($event, pl, 'nw')"></div>
              <div class="rh rh-ne" @mousedown.stop.prevent="startResize($event, pl, 'ne')"></div>
              <div class="rh rh-sw" @mousedown.stop.prevent="startResize($event, pl, 'sw')"></div>
              <div class="rh rh-se" @mousedown.stop.prevent="startResize($event, pl, 'se')"></div>
            </div>

            <div v-if="ctxMenu.visible" class="ctx-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
              <template v-if="ctxMenu.placementId">
                <div class="ctx-section">Platzierung</div>
                <button class="ctx-item ctx-danger" @click="removePlacement(ctxMenu.placementId); closeCtxMenu()">
                  <font-awesome-icon :icon="['fas', 'trash']" /> Entfernen
                </button>
              </template>
              <template v-else>
                <div class="ctx-section">Textmarke platzieren</div>
                <div v-if="bookmarks.length === 0" class="ctx-empty">Keine Textmarken erstellt</div>
                <button
                  v-for="bm in bookmarks"
                  :key="bm.id"
                  class="ctx-item"
                  :class="{ active: selectedBookmarkId === bm.id }"
                  @click="addPlacementAt(bm.id, ctxMenu.pct); closeCtxMenu()"
                >
                  <font-awesome-icon :icon="bookmarkIcon(bm.dataType)" />
                  {{ bm.label }}
                  <span class="ctx-role-chip" :class="`rc-${bm.fillRole}`">{{ bm.fillRole === 'bediener' ? 'Bed.' : 'MA' }}</span>
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- RIGHT: PDF management + placement props -->
        <div class="pdf-panel">
          <div class="panel-header">
            <h3><font-awesome-icon :icon="['fas', 'file-pdf']" /> PDFs</h3>
          </div>
          <div class="pdf-list">
            <div v-for="(pdf, idx) in orderedPdfs" :key="pdf.id" class="pdf-list-item">
              <font-awesome-icon :icon="['fas', 'grip-vertical']" class="grip-icon" />
              <div class="pdf-info">
                <span class="pdf-filename">{{ pdf.filename }}</span>
                <span class="pdf-pages">{{ pdf.pageCount }} Seite{{ pdf.pageCount !== 1 ? 'n' : '' }}</span>
              </div>
              <div class="pdf-item-actions">
                <button class="btn-icon-xs" :disabled="idx === 0" title="Nach oben" @click="movePdf(pdf.id, -1)">
                  <font-awesome-icon :icon="['fas', 'chevron-up']" />
                </button>
                <button class="btn-icon-xs" :disabled="idx === orderedPdfs.length - 1" title="Nach unten" @click="movePdf(pdf.id, 1)">
                  <font-awesome-icon :icon="['fas', 'chevron-down']" />
                </button>
                <button class="btn-icon-xs btn-danger" title="Entfernen" @click="removePdf(pdf.id)">
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </button>
              </div>
            </div>
            <p v-if="orderedPdfs.length === 0" class="no-items-hint">Noch keine PDFs.</p>
          </div>
          <label class="pdf-upload-btn" :class="{ uploading: uploadingPdf }">
            <font-awesome-icon v-if="uploadingPdf" :icon="['fas', 'spinner']" spin />
            <font-awesome-icon v-else :icon="['fas', 'upload']" />
            {{ uploadingPdf ? 'Hochladen…' : 'PDF hinzufügen' }}
            <input type="file" accept="application/pdf" style="display:none" @change="onPdfFileChange" />
          </label>

          <template v-if="selectedPlacement">
            <div class="panel-header" style="margin-top:16px">
              <h3><font-awesome-icon :icon="['fas', 'sliders']" /> Auswahl</h3>
            </div>
            <div class="fe-row">
              <label class="fe-label">Schriftgröße</label>
              <input v-model.number="selectedPlacement.fontSize" type="number" min="6" max="72" class="fe-input" />
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ══ CREATE DIALOG ════════════════════════════════════════════════ -->
    <div v-if="createDialog.visible" class="modal-overlay" @click.self="createDialog.visible = false">
      <div class="modal-box">
        <h2>Neue Vorlage erstellen</h2>
        <div class="modal-fields">
          <label>Name <span class="required">*</span></label>
          <input v-model="createDialog.name" class="form-input" placeholder="Vorlagenname" @keydown.enter="confirmCreate" />
          <label>Beschreibung</label>
          <input v-model="createDialog.description" class="form-input" placeholder="Optionale Beschreibung" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="createDialog.visible = false">Abbrechen</button>
          <button class="btn-primary" :disabled="!createDialog.name.trim()" @click="confirmCreate">Erstellen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
pdfjsLib.GlobalWorkerOptions.verbosity = 0;

const router = useRouter();
const token = localStorage.getItem('token');
const headers = { 'x-auth-token': token };

// ── State ────────────────────────────────────────────────────────────────
const view            = ref('list');
const templates       = ref([]);
const loading         = ref(false);
const saving          = ref(false);
const uploadingPdf    = ref(false);
const thumbnails      = ref({});
const currentTemplate = ref(null);
const currentPdfs     = ref([]);
const bookmarks       = ref([]);
const placements      = ref([]);
const selectedBookmarkId  = ref(null);
const selectedPlacementId = ref(null);
const editingBookmarkId   = ref(null);
const currentGlobalPage   = ref(0);
const pageNaturalHeight   = ref(841);
const pdfCanvas           = ref(null);
const canvasContainer     = ref(null);
const createDialog = ref({ visible: false, name: '', description: '' });
const ctxMenu      = ref({ visible: false, x: 0, y: 0, pct: null, placementId: null });

// per-page PDF.js document cache: Map<pdfIndex, pdfDoc>
const pdfDocCache = new Map();

// ── Computed ──────────────────────────────────────────────────────────────
const orderedPdfs = computed(() =>
  [...currentPdfs.value].sort((a, b) => a.order - b.order)
);

const allPages = computed(() => {
  const pages = [];
  orderedPdfs.value.forEach((pdf, pdfIdx) => {
    for (let p = 0; p < (pdf.pageCount || 1); p++) {
      pages.push({ pdfIdx, localPage: p });
    }
  });
  return pages;
});

const currentPageInfo = computed(() => allPages.value[currentGlobalPage.value] ?? null);

const placementsOnCurrentPage = computed(() => {
  const info = currentPageInfo.value;
  if (!info) return [];
  return placements.value.filter(pl => pl.pdfIndex === info.pdfIdx && pl.page === info.localPage);
});

const selectedPlacement = computed(() =>
  placements.value.find(pl => pl.id === selectedPlacementId.value) ?? null
);

// ── Helpers ───────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 11); }
function bookmarkById(id)   { return bookmarks.value.find(b => b.id === id); }
function bookmarkLabel(id)  { return bookmarkById(id)?.label   ?? '?'; }
function bookmarkRole(id)   { return bookmarkById(id)?.fillRole ?? 'bediener'; }
function bookmarkDataType(id) { return bookmarkById(id)?.dataType ?? 'text'; }
function placementCountOf(bmId) {
  return placements.value.filter(pl => pl.bookmarkId === bmId).length;
}
function bookmarkIcon(dataType) {
  const map = { text: ['fas', 'font'], date: ['fas', 'calendar'], checkbox: ['fas', 'check'] };
  return map[dataType] || ['fas', 'font'];
}

// ── API: templates list ───────────────────────────────────────────────────
async function fetchTemplates() {
  loading.value = true;
  try {
    const res = await axios.get('/api/pdf-templates', { headers });
    templates.value = res.data;
    for (const t of res.data) renderThumbnail(t);
  } finally {
    loading.value = false;
  }
}

async function renderThumbnail(t) {
  if (!t.pdfs || t.pdfs.length === 0) return;
  try {
    const res  = await axios.get(`/api/pdf-templates/${t._id}/pdfs/0`, { headers, responseType: 'arraybuffer' });
    const doc  = await pdfjsLib.getDocument({ data: res.data, verbosity: 0 }).promise;
    const page = await doc.getPage(1);
    const vp   = page.getViewport({ scale: 0.35 });
    const canvas = document.createElement('canvas');
    canvas.width  = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    thumbnails.value = { ...thumbnails.value, [t._id]: canvas.toDataURL() };
  } catch {}
}

function openCreateDialog() {
  createDialog.value = { visible: true, name: '', description: '' };
}

async function confirmCreate() {
  const { name, description } = createDialog.value;
  if (!name.trim()) return;
  const res = await axios.post('/api/pdf-templates', { name: name.trim(), description }, { headers });
  createDialog.value.visible = false;
  templates.value.unshift(res.data);
  openEditor(res.data._id);
}

async function deleteTemplate(t) {
  if (!confirm(`Vorlage "${t.name}" wirklich löschen?`)) return;
  await axios.delete(`/api/pdf-templates/${t._id}`, { headers });
  templates.value = templates.value.filter(x => x._id !== t._id);
}

// ── API: editor ───────────────────────────────────────────────────────────
async function openEditor(id) {
  const res = await axios.get(`/api/pdf-templates/${id}`, { headers });
  currentTemplate.value = { _id: res.data._id, name: res.data.name, description: res.data.description };
  currentPdfs.value   = res.data.pdfs       ? [...res.data.pdfs]      : [];
  bookmarks.value     = res.data.bookmarks   ? [...res.data.bookmarks]  : [];
  placements.value    = res.data.placements  ? [...res.data.placements] : [];
  selectedBookmarkId.value  = null;
  selectedPlacementId.value = null;
  editingBookmarkId.value   = null;
  currentGlobalPage.value   = 0;
  pdfDocCache.clear();
  view.value = 'editor';
  await nextTick();
  if (allPages.value.length > 0) await loadPdfPage(0);
}

function leaveEditor() {
  pdfDocCache.clear();
  currentTemplate.value = null;
  currentPdfs.value     = [];
  bookmarks.value       = [];
  placements.value      = [];
  view.value = 'list';
  fetchTemplates();
}

async function saveTemplate() {
  if (saving.value || !currentTemplate.value) return;
  saving.value = true;
  try {
    await axios.put(`/api/pdf-templates/${currentTemplate.value._id}`, {
      name:        currentTemplate.value.name,
      description: currentTemplate.value.description,
      bookmarks:   bookmarks.value,
      placements:  placements.value,
    }, { headers });
  } finally {
    saving.value = false;
  }
}

// ── Canvas / PDF rendering ────────────────────────────────────────────────
async function getPdfDoc(pdfIdx) {
  if (pdfDocCache.has(pdfIdx)) return pdfDocCache.get(pdfIdx);
  const id  = currentTemplate.value._id;
  const res = await axios.get(`/api/pdf-templates/${id}/pdfs/${pdfIdx}`, { headers, responseType: 'arraybuffer' });
  const doc = await pdfjsLib.getDocument({ data: res.data, verbosity: 0 }).promise;
  pdfDocCache.set(pdfIdx, doc);
  return doc;
}

async function loadPdfPage(globalIdx) {
  const info = allPages.value[globalIdx];
  if (!info) return;
  const doc  = await getPdfDoc(info.pdfIdx);
  const page = await doc.getPage(info.localPage + 1);
  const baseVp = page.getViewport({ scale: 1 });
  pageNaturalHeight.value = baseVp.height;
  const wrapper = canvasContainer.value;
  const availW  = wrapper ? wrapper.clientWidth - 2 : 800;
  const scale   = Math.min(1.6, availW / baseVp.width);
  const vp      = page.getViewport({ scale });
  const canvas  = pdfCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
}

async function changePage(delta) {
  const next = currentGlobalPage.value + delta;
  if (next < 0 || next >= allPages.value.length) return;
  currentGlobalPage.value = next;
  await loadPdfPage(next);
}

// ── PDF file management ───────────────────────────────────────────────────
async function onPdfFileChange(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  uploadingPdf.value = true;
  try {
    const fd = new FormData();
    fd.append('pdf', file);
    const res = await axios.post(`/api/pdf-templates/${currentTemplate.value._id}/pdfs`, fd, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' },
    });
    currentPdfs.value.push(res.data);
  } finally {
    uploadingPdf.value = false;
  }
}

async function removePdf(pdfId) {
  if (!confirm('Dieses PDF aus der Vorlage entfernen? Platzierungen auf diesen Seiten werden gelöscht.')) return;
  await axios.delete(`/api/pdf-templates/${currentTemplate.value._id}/pdfs/${pdfId}`, { headers });
  currentPdfs.value = currentPdfs.value.filter(p => p.id !== pdfId);
  pdfDocCache.clear();
  const maxPage = allPages.value.length - 1;
  if (currentGlobalPage.value > maxPage) currentGlobalPage.value = Math.max(0, maxPage);
  if (allPages.value.length > 0) await loadPdfPage(currentGlobalPage.value);
}

async function movePdf(pdfId, direction) {
  const idx     = orderedPdfs.value.findIndex(p => p.id === pdfId);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= orderedPdfs.value.length) return;
  const a = currentPdfs.value.find(p => p.id === orderedPdfs.value[idx].id);
  const b = currentPdfs.value.find(p => p.id === orderedPdfs.value[swapIdx].id);
  if (!a || !b) return;
  [a.order, b.order] = [b.order, a.order];
  const newOrder = orderedPdfs.value.map(p => p.id);
  try {
    await axios.put(`/api/pdf-templates/${currentTemplate.value._id}/pdfs/reorder`, { order: newOrder }, { headers });
  } catch {}
  pdfDocCache.clear();
  if (allPages.value.length > 0) await loadPdfPage(currentGlobalPage.value);
}

// ── Bookmarks ─────────────────────────────────────────────────────────────
function addBookmark() {
  const bm = { id: uid(), label: 'Neue Textmarke', fillRole: 'bediener', dataType: 'text', defaultValue: '' };
  bookmarks.value.push(bm);
  selectedBookmarkId.value = bm.id;
  editingBookmarkId.value  = bm.id;
}

function removeBookmark(id) {
  bookmarks.value  = bookmarks.value.filter(b => b.id !== id);
  placements.value = placements.value.filter(pl => pl.bookmarkId !== id);
  if (selectedBookmarkId.value === id) selectedBookmarkId.value = null;
}

// ── Placements ────────────────────────────────────────────────────────────
function placementStyle(pl) {
  const bm = bookmarkById(pl.bookmarkId);
  const h  = bm?.dataType === 'checkbox'
    ? pl.height
    : (((pl.fontSize || 11) * 1.5) / pageNaturalHeight.value) * 100;
  return { left: `${pl.x}%`, top: `${pl.y}%`, width: `${pl.width}%`, height: `${h}%` };
}

function addPlacementAt(bookmarkId, pct) {
  const info = currentPageInfo.value;
  if (!info || !pct) return;
  const bm = bookmarkById(bookmarkId);
  const pl = {
    id: uid(), bookmarkId,
    pdfIndex:  info.pdfIdx,
    page:      info.localPage,
    x:         pct.x,
    y:         pct.y,
    width:     bm?.dataType === 'checkbox' ? 4 : 25,
    height:    bm?.dataType === 'checkbox' ? 4 : 5,
    fontSize:  11,
  };
  placements.value.push(pl);
  selectedPlacementId.value = pl.id;
}

function removePlacement(id) {
  placements.value = placements.value.filter(pl => pl.id !== id);
  if (selectedPlacementId.value === id) selectedPlacementId.value = null;
}

// ── Context menu ──────────────────────────────────────────────────────────
function onCanvasRightClick(e) {
  const rect = canvasContainer.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const pct = { x: (x / rect.width) * 100, y: (y / rect.height) * 100 };
  const mw = 180, mh = 200;
  ctxMenu.value = {
    visible: true,
    x: x + mw > rect.width  ? x - mw : x,
    y: y + mh > rect.height ? y - mh : y,
    pct, placementId: null,
  };
}

function onPlacementRightClick(e, pl) {
  const rect = canvasContainer.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const mw = 160, mh = 80;
  ctxMenu.value = {
    visible: true,
    x: x + mw > rect.width  ? x - mw : x,
    y: y + mh > rect.height ? y - mh : y,
    pct: null, placementId: pl.id,
  };
}

function closeCtxMenu() { ctxMenu.value.visible = false; }

// ── Drag ──────────────────────────────────────────────────────────────────
let dragState = null;

function startDrag(e, pl) {
  selectedPlacementId.value = pl.id;
  const rect = canvasContainer.value.getBoundingClientRect();
  dragState = {
    placementId: pl.id,
    startX: e.clientX, startY: e.clientY,
    origX: pl.x, origY: pl.y,
    containerW: rect.width, containerH: rect.height,
  };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup',   onDragEnd);
}

function onDragMove(e) {
  if (!dragState) return;
  const dx = ((e.clientX - dragState.startX) / dragState.containerW) * 100;
  const dy = ((e.clientY - dragState.startY) / dragState.containerH) * 100;
  const pl = placements.value.find(p => p.id === dragState.placementId);
  if (pl) {
    pl.x = Math.max(0, Math.min(100 - pl.width, dragState.origX + dx));
    pl.y = Math.max(0, dragState.origY + dy);
  }
}

function onDragEnd() {
  dragState = null;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup',   onDragEnd);
}

// ── Resize ────────────────────────────────────────────────────────────────
let resizeState = null;

function startResize(e, pl, corner) {
  const rect = canvasContainer.value.getBoundingClientRect();
  resizeState = {
    placementId: pl.id, corner,
    startX: e.clientX, startY: e.clientY,
    origX: pl.x, origY: pl.y, origW: pl.width, origH: pl.height,
    containerW: rect.width, containerH: rect.height,
  };
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup',   onResizeEnd);
}

function onResizeMove(e) {
  if (!resizeState) return;
  const MIN = 1;
  const dx = ((e.clientX - resizeState.startX) / resizeState.containerW) * 100;
  const dy = ((e.clientY - resizeState.startY) / resizeState.containerH) * 100;
  const pl = placements.value.find(p => p.id === resizeState.placementId);
  if (!pl) return;
  const { origX, origY, origW, origH, corner } = resizeState;
  const isCheckbox = bookmarkDataType(pl.bookmarkId) === 'checkbox';

  if (corner === 'se') {
    pl.width  = Math.max(MIN, origW + dx);
    if (isCheckbox) pl.height = Math.max(MIN, origH + dy);
  } else if (corner === 'sw') {
    const newW = Math.max(MIN, origW - dx);
    pl.x = origX + (origW - newW);  pl.width = newW;
    if (isCheckbox) pl.height = Math.max(MIN, origH + dy);
  } else if (corner === 'ne') {
    pl.width = Math.max(MIN, origW + dx);
    if (isCheckbox) { const newH = Math.max(MIN, origH - dy); pl.y = origY + (origH - newH); pl.height = newH; }
  } else if (corner === 'nw') {
    const newW = Math.max(MIN, origW - dx);
    pl.x = origX + (origW - newW);  pl.width = newW;
    if (isCheckbox) { const newH = Math.max(MIN, origH - dy); pl.y = origY + (origH - newH); pl.height = newH; }
  }
}

function onResizeEnd() {
  resizeState = null;
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup',   onResizeEnd);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  fetchTemplates();
  window.addEventListener('click', closeCtxMenu);
});
onUnmounted(() => {
  window.removeEventListener('click', closeCtxMenu);
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
});
</script>

<style scoped lang="scss">
.window { padding: 24px; max-width: 1400px; }

/* ── List ─────────────────────────────────────────────────────────────── */
.list-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;
  h1 { font-size: 1.4rem; margin: 0; display: flex; align-items: center; gap: 10px; }
}
.loading-state, .empty-state {
  text-align: center; padding: 60px 20px; color: var(--text-muted);
  display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 14px;
}
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.template-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  overflow: hidden; display: flex; flex-direction: column; transition: border-color 200ms;
  &:hover { border-color: var(--primary); }
}
.template-thumb {
  background: #e5e7eb; aspect-ratio: 3/4;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.thumb-img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.thumb-placeholder { font-size: 2.5rem; color: #9ca3af; }
.template-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.template-name { font-weight: 600; font-size: 14px; }
.template-meta { font-size: 12px; color: var(--text-muted); display: flex; gap: 5px; }
.template-desc { font-size: 12px; color: var(--text-muted); margin: 0; }
.template-actions { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; }
.btn-action {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
  background: transparent; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-muted); font-size: 12px; cursor: pointer; font-family: inherit; transition: all 150ms;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &.btn-danger:hover { border-color: #dc2626; color: #dc2626; }
}

/* ── Editor topbar ────────────────────────────────────────────────────── */
.editor-topbar { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px; }
.editor-title-block { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.title-input {
  font-size: 1.1rem; font-weight: 600; border: none; border-bottom: 1px solid var(--border);
  background: transparent; color: var(--text); font-family: inherit; padding: 2px 0; outline: none;
  &:focus { border-color: var(--primary); }
}
.desc-input {
  font-size: 12px; border: none; border-bottom: 1px solid transparent;
  background: transparent; color: var(--text-muted); font-family: inherit; padding: 2px 0; outline: none;
  &:focus { border-bottom-color: var(--border); color: var(--text); }
}

/* ── Editor layout ────────────────────────────────────────────────────── */
.editor-body {
  display: grid; grid-template-columns: 260px 1fr 260px; gap: 16px; align-items: start;
  @media (max-width: 1100px) { grid-template-columns: 220px 1fr 220px; }
}

/* ── Shared panel ────────────────────────────────────────────────────── */
.panel-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
  h3 { font-size: 13px; margin: 0; display: flex; align-items: center; gap: 6px; }
}
.panel-hint { font-size: 11px; color: var(--text-muted); margin: 0 0 10px; line-height: 1.4; }
.no-items-hint { font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px 0; }

/* ── Bookmark panel ──────────────────────────────────────────────────── */
.bookmark-panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px; display: flex; flex-direction: column;
}
.bookmark-list {
  display: flex; flex-direction: column; gap: 4px; max-height: 60vh; overflow-y: auto;
}
.bookmark-item {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px;
  cursor: pointer; font-size: 12px; transition: background 120ms; border: 1px solid transparent;
  &:hover { background: var(--bg); }
  &.selected { background: color-mix(in srgb, var(--primary) 10%, var(--surface)); border-color: var(--primary); }
}
.bm-type-icon { width: 12px; flex-shrink: 0; color: var(--text-muted); }
.bm-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-role-badge {
  font-size: 10px; border-radius: 3px; padding: 1px 4px; font-weight: 600; flex-shrink: 0;
  &.role-bediener    { background: rgba(255,140,0,.15); color: var(--primary); }
  &.role-mitarbeiter { background: rgba(56,161,105,.15); color: #38a169; }
}
.bm-count { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
.bm-edit-btn, .bm-del-btn {
  background: none; border: none; cursor: pointer; color: var(--text-muted);
  padding: 2px 4px; font-size: 10px; border-radius: 3px; flex-shrink: 0;
  &:hover { color: var(--text); background: var(--bg); }
}
.bm-del-btn:hover { color: #dc2626 !important; }
.bm-edit { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.bm-edit-row { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.bm-input {
  border: 1px solid var(--border); border-radius: 5px; padding: 5px 7px;
  font-size: 12px; background: var(--bg); color: var(--text); font-family: inherit;
  &:focus { outline: none; border-color: var(--primary); }
}
.bm-select {
  border: 1px solid var(--border); border-radius: 5px; padding: 4px 6px;
  font-size: 11px; background: var(--bg); color: var(--text); font-family: inherit;
  &:focus { outline: none; border-color: var(--primary); }
}
.bm-done-btn {
  align-self: flex-end; font-size: 11px; padding: 4px 10px;
  background: var(--primary); color: #fff; border: none; border-radius: 5px;
  cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 5px;
}

/* ── Canvas col ──────────────────────────────────────────────────────── */
.canvas-col { display: flex; flex-direction: column; gap: 8px; }
.page-nav-bar { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-muted); }
.page-label { flex: 1; text-align: center; }
.page-sub { font-size: 11px; color: var(--text-muted); margin-left: 4px; }
.no-pdf-hint {
  background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  padding: 40px 16px; font-size: 13px; color: var(--text-muted);
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.canvas-container {
  position: relative; display: inline-block;
  border: 1px solid var(--border); border-radius: 6px;
  user-select: none; line-height: 0; cursor: crosshair; max-width: 100%; overflow: visible;
}
.pdf-canvas { display: block; background: #fff; }

/* ── Placements ──────────────────────────────────────────────────────── */
.placement-overlay {
  position: absolute; border: 2px solid var(--primary); background: rgba(255,140,0,0.12);
  border-radius: 3px; cursor: move; display: flex; align-items: flex-end;
  gap: 3px; padding: 0 3px; font-size: 9px; overflow: visible; transition: background 150ms;
  &:hover, &.selected { background: rgba(255,140,0,0.28); }
  &.plt-role-mitarbeiter {
    border-color: #38a169; background: rgba(56,161,105,.12);
    &:hover, &.selected { background: rgba(56,161,105,.25); }
  }
}
.plt-label {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: #222; font-weight: 600; max-width: 70%;
}
.plt-role-chip {
  font-size: 8px; border-radius: 2px; padding: 0 3px; font-weight: 700; flex-shrink: 0; margin-left: auto;
  &.rc-bediener    { background: rgba(255,140,0,.3);  color: #7a4800; }
  &.rc-mitarbeiter { background: rgba(56,161,105,.3); color: #1a5c3a; }
}
.rh {
  position: absolute; width: 8px; height: 8px; background: #fff;
  border: 2px solid var(--primary); border-radius: 2px; z-index: 20; box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.rh-nw { top: -4px;    left: -4px;  cursor: nw-resize; }
.rh-ne { top: -4px;    right: -4px; cursor: ne-resize; }
.rh-sw { bottom: -4px; left: -4px;  cursor: sw-resize; }
.rh-se { bottom: -4px; right: -4px; cursor: se-resize; }
.plt-role-mitarbeiter .rh { border-color: #38a169; }

/* ── Context menu ────────────────────────────────────────────────────── */
.ctx-menu {
  position: absolute; z-index: 200; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,.18); min-width: 160px; padding: 4px; user-select: none;
}
.ctx-section {
  font-size: 10px; text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted); padding: 5px 10px 3px; font-weight: 600;
}
.ctx-item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px;
  border: none; border-radius: 5px; background: transparent; color: var(--text);
  font-size: 12px; cursor: pointer; font-family: inherit;
  &:hover { background: var(--bg); }
  &.active { color: var(--primary); font-weight: 600; }
  &.ctx-danger { color: #dc2626; &:hover { background: rgba(220,38,38,.08); } }
}
.ctx-role-chip {
  margin-left: auto; font-size: 9px; border-radius: 2px; padding: 1px 4px;
  &.rc-bediener    { background: rgba(255,140,0,.2);  color: var(--primary); }
  &.rc-mitarbeiter { background: rgba(56,161,105,.2); color: #38a169; }
}
.ctx-empty { font-size: 12px; color: var(--text-muted); padding: 8px 10px; }

/* ── PDF panel ───────────────────────────────────────────────────────── */
.pdf-panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px; display: flex; flex-direction: column; gap: 0; align-self: start;
}
.pdf-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.pdf-list-item {
  display: flex; align-items: center; gap: 6px; padding: 6px;
  border: 1px solid var(--border); border-radius: 6px; font-size: 12px;
}
.grip-icon { color: var(--text-muted); width: 10px; flex-shrink: 0; cursor: grab; }
.pdf-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pdf-filename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.pdf-pages { font-size: 11px; color: var(--text-muted); }
.pdf-item-actions { display: flex; gap: 2px; flex-shrink: 0; }
.pdf-upload-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px;
  border: 1px dashed var(--border); border-radius: 6px; cursor: pointer;
  font-size: 12px; color: var(--text-muted); transition: all 150ms;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &.uploading { opacity: .6; cursor: default; }
}
.fe-row { display: flex; flex-direction: column; gap: 4px; }
.fe-label { font-size: 11px; color: var(--text-muted); }
.fe-input {
  border: 1px solid var(--border); border-radius: 5px; padding: 5px 8px;
  font-size: 12px; background: var(--bg); color: var(--text); font-family: inherit; width: 100%;
  &:focus { outline: none; border-color: var(--primary); }
}

/* ── Modal ───────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 28px; width: 420px; max-width: 95vw;
  h2 { font-size: 1.1rem; margin: 0 0 20px; }
}
.modal-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.modal-fields label { font-size: 12px; font-weight: 500; color: var(--text-muted); }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.required { color: var(--primary); }
.form-input {
  border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
  background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit;
  &:focus { outline: none; border-color: var(--primary); }
}

/* ── Buttons ─────────────────────────────────────────────────────────── */
.btn-primary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: var(--primary); color: #fff; border: none; border-radius: 6px;
  font-size: 13px; cursor: pointer; font-family: inherit;
  &:hover { opacity: .85; } &:disabled { opacity: .5; cursor: not-allowed; }
}
.btn-secondary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  background: transparent; color: var(--text); border: 1px solid var(--border);
  border-radius: 6px; font-size: 13px; cursor: pointer; font-family: inherit;
  &:hover { border-color: var(--text); }
}
.btn-back {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; flex-shrink: 0;
  background: transparent; color: var(--text-muted); border: 1px solid var(--border);
  border-radius: 6px; font-size: 13px; cursor: pointer; font-family: inherit;
  &:hover { color: var(--text); border-color: var(--text); }
}
.btn-icon-sm {
  background: transparent; border: 1px solid var(--border); border-radius: 5px;
  color: var(--text-muted); padding: 4px 8px; cursor: pointer; font-size: 12px;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &:disabled { opacity: .4; cursor: not-allowed; }
}
.btn-icon-xs {
  background: transparent; border: 1px solid var(--border); border-radius: 4px;
  color: var(--text-muted); padding: 2px 5px; cursor: pointer; font-size: 10px;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &:disabled { opacity: .4; cursor: not-allowed; }
  &.btn-danger:hover { border-color: #dc2626; color: #dc2626; }
}
</style>
