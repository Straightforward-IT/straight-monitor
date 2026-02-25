<template>
  <div class="export-backdrop" @click.self="$emit('close')">
    <div class="export-modal">
      <!-- Header -->
      <header class="export-header">
        <div class="export-title">
          <font-awesome-icon icon="fa-solid fa-table" class="title-icon" />
          <div>
            <h3>Excel-Export</h3>
            <span class="export-subtitle">{{ mitarbeiterList.length }} Mitarbeiter</span>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">
          <font-awesome-icon icon="fa-solid fa-times" />
        </button>
      </header>

      <div class="export-body">
        <!-- Left: Field Selector -->
        <div class="field-panel">
          <div class="panel-header">
            <span class="panel-title">Felder auswählen & sortieren</span>
            <div class="panel-actions">
              <button class="link-btn" @click="selectAll">Alle</button>
              <span class="sep">·</span>
              <button class="link-btn" @click="selectNone">Keine</button>
            </div>
          </div>

          <div class="field-list" ref="fieldList">
            <div
              v-for="(field, idx) in orderedFields"
              :key="field.key"
              class="field-item"
              :class="{ dragging: dragIdx === idx, 'drag-over': dragOverIdx === idx }"
              draggable="true"
              @dragstart="onDragStart(idx)"
              @dragover.prevent="onDragOver(idx)"
              @dragleave="onDragLeave"
              @drop="onDrop(idx)"
              @dragend="onDragEnd"
            >
              <font-awesome-icon icon="fa-solid fa-grip-vertical" class="drag-handle" />
              <label class="field-label">
                <input
                  type="checkbox"
                  :checked="selectedKeys.includes(field.key)"
                  @change="toggleField(field.key)"
                  class="field-checkbox"
                />
                <span class="field-name">{{ field.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Right: Preview -->
        <div class="preview-panel">
          <div class="panel-header">
            <span class="panel-title">Vorschau (erste {{ previewRows.length }} Zeilen)</span>
          </div>

          <div class="preview-scroll">
            <table v-if="selectedKeys.length > 0" class="preview-table">
              <thead>
                <tr>
                  <th v-for="key in selectedKeys" :key="key">
                    {{ labelFor(key) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in previewRows" :key="i">
                  <td v-for="key in selectedKeys" :key="key">
                    {{ row[key] }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="preview-empty">
              Keine Felder ausgewählt.
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="export-footer">
        <span class="footer-info">
          <font-awesome-icon icon="fa-solid fa-table-columns" />
          {{ selectedKeys.length }} Spalten · {{ mitarbeiterList.length }} Zeilen
        </span>
        <div class="footer-actions">
          <button class="btn btn-ghost" @click="$emit('close')">Abbrechen</button>
          <button
            class="btn btn-export"
            :disabled="selectedKeys.length === 0"
            @click="doExport"
          >
            <font-awesome-icon icon="fa-solid fa-download" />
            Excel exportieren
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faTable, faTimes, faGripVertical, faDownload, faTableColumns
} from '@fortawesome/free-solid-svg-icons';

library.add(faTable, faTimes, faGripVertical, faDownload, faTableColumns);

const props = defineProps({
  mitarbeiterList: {
    type: Array,
    default: () => []
  }
});

defineEmits(['close']);

// ── Field definitions ─────────────────────────────────────────────────────────
const PERSGRUPPE_MAP = { 101: 'Festi (101)', 110: 'KZF (110)', 109: 'Mini (109)', 106: 'Werkst. (106)' };

const ALL_FIELDS = [
  { key: 'vorname',                 label: 'Vorname',                    get: (ma) => ma.vorname || '' },
  { key: 'nachname',                label: 'Nachname',                   get: (ma) => ma.nachname || '' },
  { key: 'personalnr',              label: 'Personalnr',                 get: (ma) => ma.personalnr || '' },
  { key: 'email',                   label: 'E-Mail',                     get: (ma) => ma.email || '' },
  { key: 'additionalEmails',        label: 'Weitere E-Mails',            get: (ma) => (ma.additionalEmails || []).join(', ') },
  { key: 'telefon',                 label: 'Telefon',                    get: (ma) => ma.telefon || '' },
  { key: 'isActive',                label: 'Status',                     get: (ma) => ma.isActive ? 'Aktiv' : 'Inaktiv' },
  { key: 'persgruppe',              label: 'Personengruppe',             get: (ma) => ma.persgruppe ? (PERSGRUPPE_MAP[ma.persgruppe] || String(ma.persgruppe)) : '' },
  { key: 'erstellt_von',            label: 'Erstellt von',               get: (ma) => ma.erstellt_von || '' },
  { key: 'austrittsdatum',          label: 'Austrittsdatum',             get: (ma) => ma.austrittsdatum ? formatDate(ma.austrittsdatum) : '' },
  { key: 'berufe',                  label: 'Berufe',                     get: (ma) => (ma.berufe || []).map(b => b.designation || b).filter(Boolean).join(', ') },
  { key: 'qualifikationen',         label: 'Qualifikationen',            get: (ma) => (ma.qualifikationen || []).map(q => q.designation || q).filter(Boolean).join(', ') },
  { key: 'asana_id',               label: 'Asana ID',                   get: (ma) => ma.asana_id || '' },
  { key: 'flip_id',                label: 'Flip ID',                    get: (ma) => ma.flip_id || '' },
  { key: 'dateCreated',             label: 'Erstellt am',                get: (ma) => ma.dateCreated ? formatDate(ma.dateCreated) : (ma.createdAt ? formatDate(ma.createdAt) : '') },
  { key: 'updatedAt',              label: 'Zuletzt aktualisiert',       get: (ma) => ma.updatedAt ? formatDate(ma.updatedAt) : '' },
];

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(d);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
const orderedFields = ref([...ALL_FIELDS]);

// Default selection: most useful fields
const DEFAULT_KEYS = ['vorname', 'nachname', 'personalnr', 'email', 'telefon', 'isActive', 'persgruppe', 'berufe', 'qualifikationen'];
const selectedKeys = ref([...DEFAULT_KEYS]);

// ── Drag ──────────────────────────────────────────────────────────────────────
const dragIdx     = ref(null);
const dragOverIdx = ref(null);

function onDragStart(idx) { dragIdx.value = idx; }
function onDragOver(idx)  { dragOverIdx.value = idx; }
function onDragLeave()    { dragOverIdx.value = null; }

function onDrop(targetIdx) {
  if (dragIdx.value === null || dragIdx.value === targetIdx) return;
  const arr = [...orderedFields.value];
  const [moved] = arr.splice(dragIdx.value, 1);
  arr.splice(targetIdx, 0, moved);
  orderedFields.value = arr;
  dragIdx.value     = null;
  dragOverIdx.value = null;
}

function onDragEnd() {
  dragIdx.value     = null;
  dragOverIdx.value = null;
}

// ── Field toggle ──────────────────────────────────────────────────────────────
function toggleField(key) {
  const idx = selectedKeys.value.indexOf(key);
  if (idx >= 0) {
    selectedKeys.value.splice(idx, 1);
  } else {
    // Insert in the same position as orderedFields
    const orderIdx = orderedFields.value.findIndex(f => f.key === key);
    // Find insertion point to maintain visual order
    let insertAt = selectedKeys.value.length;
    for (let i = 0; i < selectedKeys.value.length; i++) {
      const existingOrder = orderedFields.value.findIndex(f => f.key === selectedKeys.value[i]);
      if (existingOrder > orderIdx) { insertAt = i; break; }
    }
    selectedKeys.value.splice(insertAt, 0, key);
  }
}

function selectAll()  { selectedKeys.value = orderedFields.value.map(f => f.key); }
function selectNone() { selectedKeys.value = []; }

function labelFor(key) {
  return orderedFields.value.find(f => f.key === key)?.label ?? key;
}

function getterFor(key) {
  return orderedFields.value.find(f => f.key === key)?.get ?? ((ma) => ma[key] ?? '');
}

// ── Preview ───────────────────────────────────────────────────────────────────
const PREVIEW_LIMIT = 8;

const previewRows = computed(() => {
  return props.mitarbeiterList.slice(0, PREVIEW_LIMIT).map(ma => {
    const row = {};
    selectedKeys.value.forEach(key => { row[key] = getterFor(key)(ma); });
    return row;
  });
});

// ── Export ────────────────────────────────────────────────────────────────────
function doExport() {
  const headers = selectedKeys.value.map(k => labelFor(k));
  const rows = props.mitarbeiterList.map(ma =>
    selectedKeys.value.map(k => getterFor(k)(ma))
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto column widths
  const colWidths = headers.map((h, colIdx) => {
    let max = h.length;
    rows.forEach(r => { if (r[colIdx]) max = Math.max(max, String(r[colIdx]).length); });
    return { wch: Math.min(max + 2, 60) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mitarbeiter');

  const date = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
  XLSX.writeFile(wb, `Mitarbeiter_Export_${date}.xlsx`);
}
</script>

<style scoped lang="scss">
.export-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.export-modal {
  background: var(--panel, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 1100px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  color: var(--text, #111);
  overflow: hidden;
}

// ── Header ──────────────────────────────────────────────────────────────────
.export-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.export-title {
  display: flex;
  align-items: center;
  gap: 12px;

  .title-icon {
    font-size: 22px;
    color: #1d6f42;
  }

  h3 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
  }
}

.export-subtitle {
  font-size: 12px;
  color: var(--muted, #6b7280);
  font-weight: 500;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  font-size: 16px;
  transition: all 0.15s;
  &:hover { background: var(--hover, #f0f0f0); color: var(--text); }
}

// ── Body ─────────────────────────────────────────────────────────────────────
.export-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

// ── Shared panel ─────────────────────────────────────────────────────────────
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--hover, #f9fafb);
  flex-shrink: 0;
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}

.panel-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--primary, #f97316);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
  &:hover { background: color-mix(in srgb, var(--primary, #f97316) 10%, transparent); }
}

.sep { color: var(--muted); }

// ── Field panel ──────────────────────────────────────────────────────────────
.field-panel {
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.field-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 0;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  cursor: grab;
  transition: background 0.1s;
  user-select: none;
  border-left: 3px solid transparent;

  &:hover { background: var(--hover, #f5f5f5); }

  &.dragging {
    opacity: 0.4;
    cursor: grabbing;
  }

  &.drag-over {
    background: color-mix(in srgb, var(--primary, #f97316) 10%, transparent);
    border-left-color: var(--primary, #f97316);
  }
}

.drag-handle {
  color: var(--muted);
  font-size: 12px;
  flex-shrink: 0;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
}

.field-checkbox {
  accent-color: var(--primary, #f97316);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.field-name {
  font-size: 13px;
  color: var(--text);
}

// ── Preview panel ─────────────────────────────────────────────────────────────
.preview-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-scroll {
  flex: 1;
  overflow-x: scroll;
  overflow-y: auto;
  padding: 0;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  thead tr {
    background: var(--hover, #f9fafb);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th {
    padding: 8px 12px;
    text-align: left;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--muted);
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
  }

  td {
    padding: 7px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  tbody tr:hover { background: var(--hover, #f5f5f5); }
}

.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--muted);
  font-size: 14px;
  font-style: italic;
}

// ── Footer ────────────────────────────────────────────────────────────────────
.export-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--hover, #f9fafb);
  flex-shrink: 0;
  gap: 12px;
}

.footer-info {
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-actions {
  display: flex;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  &:hover { background: var(--hover, #f0f0f0); }
}

.btn-export {
  background: #1d6f42;
  color: #fff;
  &:hover:not(:disabled) { background: #155c35; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

// ── Responsive ───────────────────────────────────────────────────────────────
@media (max-width: 700px) {
  .export-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .field-panel {
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 220px;
  }
}
</style>
