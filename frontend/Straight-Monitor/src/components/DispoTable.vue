<template>
  <div class="dispo-page">
    <div class="page-header">
      <div class="header-title-group">
        <h1>Dispo</h1>
      </div>
      <div class="header-controls">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Mitarbeiter suchen…"
          />
        </div>
      </div>
    </div>

    <FilterPanel v-model:expanded="filterExpanded">
      <!-- Standort Filter -->
      <FilterGroup label="Standort">
        <FilterChip :active="filters.standort === '1'" @click="setStandort('1')">Berlin</FilterChip>
        <FilterChip :active="filters.standort === '2'" @click="setStandort('2')">Hamburg</FilterChip>
        <FilterChip :active="filters.standort === '3'" @click="setStandort('3')">Köln</FilterChip>
        <FilterChip :active="!filters.standort" @click="setStandort(null)">Alle</FilterChip>
      </FilterGroup>

      <FilterDivider />

      <!-- Zeitraum Filter -->
      <FilterGroup label="Zeitraum">
        <FilterDropdown :has-value="filters.tage !== 30">
          <template #label>{{ filters.tage }} Tage</template>
          <div
            v-for="opt in [30, 90, 120, 150, 240, 365]"
            :key="opt"
            class="dropdown-item clickable"
            :class="{ selected: filters.tage === opt }"
            @click="setTage(opt)"
          >
            {{ opt }} Tage
          </div>
        </FilterDropdown>
      </FilterGroup>

      <FilterDivider />

      <!-- Reset Button -->
      <FilterChip class="reset-chip" @click="resetFilters" title="Alle Filter zurücksetzen">
        <font-awesome-icon icon="fa-solid fa-rotate-left" />
        Zurücksetzen
      </FilterChip>
    </FilterPanel>

    <!-- Selection Bar (always reserves space) -->
    <div class="selection-bar">
      <transition name="sel-chip">
        <span v-if="selectedCells.size > 0" class="selection-chip">
          <font-awesome-icon icon="fa-solid fa-table-cells" />
          <strong>{{ selectedCells.size }}</strong> ausgewählt
          <template v-if="selectionMaCount > 1"> · {{ selectionMaCount }} MA</template>
          <button class="sel-chip-clear" @click="clearSelection" title="Auswahl aufheben">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </span>
      </transition>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <font-awesome-icon icon="fa-solid fa-spinner" spin /> Lade Dispo-Daten…
    </div>

    <!-- Table -->
    <div v-else class="dispo-table-wrapper" ref="tableWrapper">
      <div class="dispo-split-layout">
        
        <!-- Linker Bereich: Fester Name -->
        <div class="dispo-left-pane">
          <table class="dispo-table">
            <thead>
              <tr>
                <th 
                  class="col-nachname sortable-th" 
                  :style="{ width: colWidths.nachname + 'px', minWidth: colWidths.nachname + 'px', maxWidth: colWidths.nachname + 'px' }"
                  @click="toggleSort('nachname')"
                >
                  <span class="th-content">
                    Nachname
                    <font-awesome-icon
                      v-if="sortField === 'nachname'"
                      :icon="sortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'"
                      class="sort-icon"
                    />
                    <font-awesome-icon v-else icon="fa-solid fa-sort" class="sort-icon muted" />
                  </span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'nachname')"></div>
                </th>
                <th 
                  class="col-vorname sortable-th" 
                  :style="{ width: colWidths.vorname + 'px', minWidth: colWidths.vorname + 'px', maxWidth: colWidths.vorname + 'px' }"
                  @click="toggleSort('vorname')"
                >
                  <span class="th-content">
                    Vorname
                    <font-awesome-icon
                      v-if="sortField === 'vorname'"
                      :icon="sortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'"
                      class="sort-icon"
                    />
                    <font-awesome-icon v-else icon="fa-solid fa-sort" class="sort-icon muted" />
                  </span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'vorname')"></div>
                </th>
                <th class="col-bereich">
                  <span class="th-content">Bereich</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ma in filteredMitarbeiter" 
                :key="`l-${ma._id}`"
                @mouseenter="hoveredMaId = ma._id"
                @mouseleave="hoveredMaId = null"
                :class="{ 'row-hovered': hoveredMaId === ma._id }"
                @click.stop="openNameMenu($event, ma)"
                style="cursor: pointer"
              >
                <!-- Nachname -->
                <td class="col-nachname" :style="{ width: colWidths.nachname + 'px', minWidth: colWidths.nachname + 'px', maxWidth: colWidths.nachname + 'px' }">
                  <div class="ma-name-cell">
                    <button
                      class="star-btn"
                      :class="{ active: starredIds.has(ma._id) }"
                      @click="toggleStar(ma._id)"
                      :title="starredIds.has(ma._id) ? 'Favorit entfernen' : 'Als Favorit markieren'"
                    >
                      <font-awesome-icon :icon="starredIds.has(ma._id) ? 'fa-solid fa-star' : 'fa-regular fa-star'" />
                    </button>
                    <span class="ma-name">{{ ma.nachname }}</span>
                    <TlBadge v-if="isTeamleiter(ma)" />
                  </div>
                </td>
                <!-- Vorname -->
                <td class="col-vorname" :style="{ width: colWidths.vorname + 'px', minWidth: colWidths.vorname + 'px', maxWidth: colWidths.vorname + 'px' }">
                  <span class="ma-name">{{ ma.vorname }}</span>
                </td>
                <!-- Bereich -->
                <td class="col-bereich">
                  <span v-if="getMaBereich(ma)" class="bereich-badge">{{ getMaBereich(ma) }}</span>
                </td>
              </tr>
              <tr v-if="filteredMitarbeiter.length === 0">
                <td colspan="3" class="empty-row text-center">
                  --
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Rechter Bereich: Daten (Scrollbar) -->
        <div class="dispo-right-pane">
          <table class="dispo-table">
            <thead>
              <tr>
                <th
                  v-for="day in days"
                  :key="day.iso"
                  class="col-day"
                  :class="{
                    'is-today': day.isToday,
                    'is-weekend': day.isWeekend,
                  }"
                >
                  <div class="day-header">
                    <span class="day-name">{{ day.weekday }}</span>
                    <span class="day-date">{{ day.label }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ma in filteredMitarbeiter" 
                :key="`r-${ma._id}`"
                @mouseenter="hoveredMaId = ma._id"
                @mouseleave="hoveredMaId = null"
                :class="{ 'row-hovered': hoveredMaId === ma._id }"
              >
                <!-- Day cells -->
                <td
                  v-for="day in days"
                  :key="day.iso"
                  class="col-day"
                  :class="[
                    cellClass(ma._id, day.iso),
                    getRunClass(ma._id, day.iso),
                    {
                      'is-today': day.isToday,
                      'is-weekend': day.isWeekend,
                      'is-active': ctxMenu.open && ctxMenu.ma?._id === ma._id && ctxMenu.day === day.iso,
                      'cell-selected': isCellSelected(ma._id, day.iso),
                    },
                  ]"
                  @contextmenu.prevent="onCellRightClick($event, ma, day)"
                  @click="isMobile ? onCellClick(ma, day) : null"
                  @mousedown="onCellMouseDown(ma, day, $event)"
                  @mouseenter="onCellMouseEnter(ma, day)"
                  @mouseleave="onCellMouseLeave()"
                  @mousemove.passive="onCellMouseMove(ma, day, $event)"
                >
                <div class="cell-fill">
                  <div class="cell-inner">
                    <span v-if="cellKuerzel(ma._id, day.iso)" class="cell-label">{{ cellKuerzel(ma._id, day.iso) }}</span>
                    <font-awesome-icon v-else-if="cellIcon(ma._id, day.iso)" :icon="cellIcon(ma._id, day.iso)" class="cell-icon" />
                  </div>
                  <span v-if="getCellNote(ma._id, day.iso)" class="note-dot">i</span>
                </div>
            </td>
          </tr>
          <tr v-if="filteredMitarbeiter.length === 0">
            <td :colspan="days.length" class="empty-row">
              Keine Mitarbeiter gefunden.
            </td>
          </tr>
        </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Cell Tooltip -->
    <teleport to="body">
      <div
        v-if="cellTooltipState.visible"
        class="dispo-cell-tooltip"
        :style="{ top: cellTooltipState.y + 20 + 'px', left: cellTooltipState.x + 'px' }"
      >{{ cellTooltipState.text }}</div>
    </teleport>

    <!-- Name Context Menu -->
    <teleport to="body">
      <div v-if="nameMenu.open" class="ctx-overlay" @click="closeNameMenu" @contextmenu.prevent="closeNameMenu">
        <div
          class="ctx-menu name-ctx-menu"
          :style="{ top: nameMenu.y + 'px', left: nameMenu.x + 'px' }"
          @click.stop
        >
          <div class="ctx-header">{{ nameMenu.ma?.vorname }} {{ nameMenu.ma?.nachname }}</div>
          <div class="ctx-divider"></div>
          <button class="ctx-item" @click="openKarte">
            <font-awesome-icon icon="fa-solid fa-address-card" class="ctx-item-icon" /> Karte Öffnen
          </button>
        </div>
      </div>
    </teleport>

    <!-- Employee Card Modal -->
    <EmployeeCardModal
      :mitarbeiterId="cardModal.open ? cardModal.mitarbeiterId : null"
      @close="closeCardModal"
    />

    <!-- Notes Modal -->
    <teleport to="body">
      <div v-if="notesModal.open" class="modal-overlay" @click="closeNotes">
        <div class="notes-modal" @click.stop>
          <div class="notes-modal-header">
            <h3>Notizen — {{ notesModal.ma?.vorname }} {{ notesModal.ma?.nachname }}</h3>
            <button class="close-btn" @click="closeNotes">
              <font-awesome-icon icon="fa-solid fa-times" />
            </button>
          </div>
          <div class="notes-modal-body">
            <div v-if="notesModal.notes.length" class="notes-list">
              <div v-for="note in notesModal.notes" :key="note._id" class="note-item">
                <div class="note-text">{{ note.text }}</div>
                <div class="note-meta">
                  {{ formatDate(note.datumVon) }}
                  <button class="delete-note-btn" @click="deleteNote(note._id)">
                    <font-awesome-icon icon="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            </div>
            <p v-else class="no-notes">Noch keine Notizen vorhanden.</p>
            <div class="note-add">
              <textarea
                v-model="notesModal.newText"
                placeholder="Neue Notiz…"
                rows="3"
              ></textarea>
              <button class="add-note-btn" @click="addNote" :disabled="!notesModal.newText.trim()">
                <font-awesome-icon icon="fa-solid fa-plus" /> Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Cell Note Modal -->
    <teleport to="body">
      <div v-if="cellNoteModal.open" class="modal-overlay" @click="closeCellNote">
        <div class="cell-note-modal" @click.stop>
          <div class="cell-note-modal-header">
            <span>Notiz · {{ cellNoteModal.ma?.vorname }} {{ cellNoteModal.ma?.nachname }} · {{ formatIsoDate(cellNoteModal.day) }}</span>
            <button class="close-btn" @click="closeCellNote"><font-awesome-icon icon="fa-solid fa-times" /></button>
          </div>
          <textarea
            v-model="cellNoteModal.text"
            class="cell-note-textarea"
            placeholder="Notiz eingeben…"
            rows="5"
            autofocus
          ></textarea>
          <div class="cell-note-modal-actions">
            <button class="btn-cancel" @click="closeCellNote">Abbrechen</button>
            <button class="btn-save" @click="saveCellNote" :disabled="!cellNoteModal.text.trim()">Speichern</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Cell Context Menu -->
    <teleport to="body">
      <div v-if="ctxMenu.open" class="ctx-overlay" @click="closeCtxMenu" @contextmenu.prevent="closeCtxMenu">
        <div
          class="ctx-menu"
          :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }"
          @click.stop
        >
          <div class="ctx-header">
            <template v-if="ctxMenu.isMulti">
              <span v-if="selectionMaCount > 1">{{ selectionMaCount }} Mitarbeiter</span>
              <span v-else>{{ ctxMenu.ma?.vorname }} {{ ctxMenu.ma?.nachname }}</span>
              <span class="ctx-multi-label">
                {{ selectedCells.size }} Felder
                <template v-if="selectionDateRange && selectionDateRange.from !== selectionDateRange.to">
                  &nbsp;·&nbsp;{{ formatIsoDate(selectionDateRange.from) }} – {{ formatIsoDate(selectionDateRange.to) }}
                </template>
                <template v-else-if="selectionDateRange">
                  &nbsp;·&nbsp;{{ formatIsoDate(selectionDateRange.from) }}
                </template>
              </span>
            </template>
            <template v-else>
              {{ ctxMenu.ma?.vorname }} {{ ctxMenu.ma?.nachname }}
            </template>
          </div>

          <!-- Existing entries -->
          <template v-if="ctxMenu.entries.length">
            <div v-for="entry in ctxMenu.entries" :key="entry._id" class="ctx-entry">
              <span>
                <font-awesome-icon v-if="entryIcon(entry)" :icon="entryIcon(entry)" class="ctx-entry-icon" />
                {{ entryLabel(entry) }}
              </span>
              <button v-if="entry._source !== 'einsatz'" class="ctx-delete-btn" @click="deleteEntry(entry._id); closeCtxMenu()">
                <font-awesome-icon icon="fa-solid fa-trash" />
              </button>
            </div>
            <template v-if="ctxMenu.entries.some(e => e._source === 'einsatz' || e.typ === 'planned')">
              <div class="ctx-divider"></div>
              <button
                v-for="entry in ctxMenu.entries.filter(e => e._source === 'einsatz' || e.typ === 'planned')"
                :key="'open-' + entry._id"
                class="ctx-item ctx-item--open"
                @click="openEinsatz(entry)"
              >
                <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" class="ctx-item-icon" />
                Einsatz öffnen
              </button>
            </template>
            <div class="ctx-divider"></div>
          </template>

          <!-- Status options -->
          <button
            v-for="opt in statusOptions"
            :key="opt.value"
            :class="['ctx-item', `ctx-item--${opt.value}`]"
            @click="setStatus(opt.value)"
          >
            <font-awesome-icon :icon="opt.icon" class="ctx-item-icon" /> {{ opt.label }}
          </button>

          <div class="ctx-divider"></div>

          <!-- Absence options -->
          <button
            v-for="opt in absenceOptions"
            :key="opt.value"
            class="ctx-item"
            @click="setAbsence(opt.value)"
          >
            <font-awesome-icon :icon="opt.icon" class="ctx-item-icon" /> {{ opt.label }}
          </button>

          <div class="ctx-divider"></div>

          <button class="ctx-item ctx-item--clear" @click="clearStatus">
            <font-awesome-icon icon="fa-solid fa-eraser" class="ctx-item-icon" /> Löschen
          </button>

          <template v-if="!ctxMenu.isMulti">
            <div class="ctx-divider"></div>
            <button class="ctx-item" @click="openCellNote(ctxMenu.ma, { iso: ctxMenu.day })">
              <font-awesome-icon icon="fa-solid fa-note-sticky" class="ctx-item-icon" />
              {{ ctxMenu.entries.some(e => e.typ === 'notiz') ? 'Notiz bearbeiten' : 'Notiz schreiben' }}
            </button>
          </template>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import { useDataCache } from '@/stores/dataCache';
import { useFlipAll } from '@/stores/flipAll';
import FilterPanel from '@/components/FilterPanel.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import FilterChip from '@/components/FilterChip.vue';
import FilterDivider from '@/components/FilterDivider.vue';
import FilterDropdown from '@/components/FilterDropdown.vue';
import TlBadge from '@/components/ui-elements/TlBadge.vue';

import EmployeeCardModal from '@/components/EmployeeCardModal.vue';

const auth = useAuth();
const dataCache = useDataCache();
const flip = useFlipAll();
const router = useRouter();

// ─── State ───
const loading = ref(true);
const mitarbeiter = ref([]);
const eintraege = ref([]);
const searchQuery = ref('');
const tableWrapper = ref(null);
const filterExpanded = ref(true);
const isMobile = ref(window.innerWidth <= 768);
const starredIds = ref(new Set());
const hoveredMaId = ref(null);
const hoveredCell = ref(null);
const cellTooltipState = ref({ visible: false, text: '', x: 0, y: 0 });

// ─── Column widths (resizable) ───
const colWidths = reactive({ nachname: 130, vorname: 110 });
let resizeCol = null;
let resizeStartX = 0;
let resizeStartW = 0;
let resizeMoved = false;

function startResize(e, col) {
  resizeCol = col;
  resizeStartX = e.clientX;
  resizeStartW = colWidths[col];
  resizeMoved = false;
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}
function onResizeMove(e) {
  if (!resizeCol) return;
  resizeMoved = true;
  const diff = e.clientX - resizeStartX;
  colWidths[resizeCol] = Math.max(60, resizeStartW + diff);
}
function onResizeEnd() {
  if (resizeMoved) {
    // Swallow the click event that fires right after mouseup so sort isn't triggered
    document.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
  }
  resizeCol = null;
  resizeMoved = false;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

function onResize() { isMobile.value = window.innerWidth <= 768; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const filters = reactive({
  standort: null,
  tage: 30,
});

const statusOptions = [
  { value: 'available', label: 'Verfügbar', icon: 'fa-solid fa-check' },
  { value: 'partially', label: 'Eingeschränkt', icon: 'fa-solid fa-circle-half-stroke' },
  { value: 'blocked', label: 'Blocked', icon: 'fa-solid fa-xmark' },
];

const absenceOptions = [
  { value: 'urlaub', label: 'Urlaub', icon: 'fa-solid fa-umbrella-beach' },
  { value: 'krank', label: 'Krank', icon: 'fa-solid fa-briefcase-medical' },
];

const CELL_ICONS = {
  planned: 'fa-solid fa-clipboard-list',
  available: 'fa-solid fa-check',
  partially: 'fa-solid fa-circle-half-stroke',
  blocked: 'fa-solid fa-xmark',
  urlaub: 'fa-solid fa-umbrella-beach',
  krank: 'fa-solid fa-briefcase-medical',
};

// ─── Sort ───
const sortField = ref('nachname');
const sortDir = ref('asc');

// ─── Notes Modal ───
const notesModal = reactive({
  open: false,
  ma: null,
  notes: [],
  newText: '',
});

// ─── Cell Note Modal ───
const cellNoteModal = reactive({
  open: false,
  ma: null,
  day: null,
  text: '',
  existingNote: null,
});

// ─── Name Context Menu ───
const nameMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  ma: null,
});

function openNameMenu(event, ma) {
  const menuW = 180;
  const menuH = 80;
  const x = event.clientX + menuW > window.innerWidth ? event.clientX - menuW : event.clientX;
  const y = event.clientY + menuH > window.innerHeight ? event.clientY - menuH : event.clientY;
  nameMenu.x = x;
  nameMenu.y = y;
  nameMenu.ma = ma;
  nameMenu.open = true;
}

function closeNameMenu() {
  nameMenu.open = false;
  nameMenu.ma = null;
}

// ─── Employee Card Modal ───
const cardModal = reactive({ open: false, mitarbeiterId: null });

function openKarte() {
  const id = nameMenu.ma._id;
  closeNameMenu();
  cardModal.mitarbeiterId = String(id);
  cardModal.open = true;
}

function closeCardModal() {
  cardModal.open = false;
  cardModal.mitarbeiterId = null;
}

// ─── Cell Context Menu ───
const ctxMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  ma: null,
  day: null,
  entries: [],
  isMulti: false,
});

// ─── Multi-cell Selection (cumulative Set of "maId_iso" keys) ───
const selectedCells = ref(new Set());
let dragMode = null; // 'add' | 'remove'
let dragCovered = null; // cells already toggled in current drag

function isCellSelected(maId, iso) {
  return selectedCells.value.has(`${maId}_${iso}`);
}

function clearSelection() {
  selectedCells.value = new Set();
  dragMode = null;
  dragCovered = null;
}

// Returns array of { maId, ranges: [{ from, to }] } grouped by MA
function getGroupedSelection() {
  if (selectedCells.value.size === 0) return [];
  const byMa = new Map();
  for (const key of selectedCells.value) {
    const idx = key.indexOf('_');
    const maId = key.slice(0, idx);
    const iso = key.slice(idx + 1);
    if (!byMa.has(maId)) byMa.set(maId, []);
    byMa.get(maId).push(iso);
  }
  const result = [];
  for (const [maId, isos] of byMa) {
    isos.sort();
    const ranges = [];
    let rangeStart = isos[0];
    let rangeEnd = isos[0];
    for (let i = 1; i < isos.length; i++) {
      const prev = new Date(rangeEnd + 'T00:00:00');
      const curr = new Date(isos[i] + 'T00:00:00');
      if ((curr - prev) / 86400000 === 1) {
        rangeEnd = isos[i];
      } else {
        ranges.push({ from: rangeStart, to: rangeEnd });
        rangeStart = isos[i];
        rangeEnd = isos[i];
      }
    }
    ranges.push({ from: rangeStart, to: rangeEnd });
    result.push({ maId, ranges });
  }
  return result;
}

function onDocMouseUp() {
  dragMode = null;
  dragCovered = null;
}

function onKeyDown(e) {
  if (e.key === 'Escape') clearSelection();
}

onMounted(() => {
  document.addEventListener('mouseup', onDocMouseUp);
  document.addEventListener('keydown', onKeyDown);
});
onUnmounted(() => {
  document.removeEventListener('mouseup', onDocMouseUp);
  document.removeEventListener('keydown', onKeyDown);
});

// ─── Computed ───
const days = computed(() => {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toIso(today);

  for (let i = 0; i < filters.tage; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    result.push({
      date: new Date(d),
      iso: toIso(d),
      weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      label: `${d.getDate()}.${d.getMonth() + 1}.`,
      isToday: toIso(d) === todayIso,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return result;
});

const filteredMitarbeiter = computed(() => {
  let list = mitarbeiter.value;
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (m) =>
        m.vorname.toLowerCase().includes(q) ||
        m.nachname.toLowerCase().includes(q)
    );
  }
  return list.sort((a, b) => {
    const aStarred = starredIds.value.has(a._id) ? 0 : 1;
    const bStarred = starredIds.value.has(b._id) ? 0 : 1;
    if (aStarred !== bStarred) return aStarred - bStarred;
    const field = sortField.value;
    const dir = sortDir.value === 'asc' ? 1 : -1;
    return dir * (a[field] || '').localeCompare(b[field] || '');
  });
});

// ─── Index for fast lookup: mitarbeiterId+iso → entries ───
const eintragMap = computed(() => {
  const map = {};
  for (const e of eintraege.value) {
    const von = new Date(e.datumVon);
    const bis = new Date(e.datumBis || e.datumVon);
    von.setHours(0, 0, 0, 0);
    bis.setHours(0, 0, 0, 0);
    const maId = typeof e.mitarbeiter === 'object' ? e.mitarbeiter._id || e.mitarbeiter : e.mitarbeiter;
    for (let d = new Date(von); d <= bis; d.setDate(d.getDate() + 1)) {
      const key = `${maId}_${toIso(d)}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
  }
  return map;
});

const selectionMaCount = computed(() => {
  const maIds = new Set();
  for (const key of selectedCells.value) maIds.add(key.slice(0, key.indexOf('_')));
  return maIds.size;
});

const selectionDateRange = computed(() => {
  if (selectedCells.value.size === 0) return null;
  const isos = [...selectedCells.value].map((k) => k.slice(k.indexOf('_') + 1)).sort();
  return { from: isos[0], to: isos[isos.length - 1] };
});

// ─── Helpers ───
function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isTeamleiter(ma) {
  return ma.qualifikationen?.some(
    (q) => parseInt(String(q.qualificationKey).trim(), 10) === 50055
  );
}

function getMaBereich(ma) {
  const keys = (ma.berufe || []).map(b => b.jobKey ?? b);
  const hasS = keys.includes(10001);
  const hasL = keys.includes(10002);
  if (hasS && hasL) return 'S+L';
  if (hasS) return 'S';
  if (hasL) return 'L';
  return null;
}

function getEntriesForCell(maId, iso) {
  return eintragMap.value[`${maId}_${iso}`] || [];
}

const hoveredRunKeys = computed(() => {
  if (!hoveredCell.value) return new Set();
  const { maId, iso } = hoveredCell.value;
  const cls = cellClass(maId, iso);
  if (!cls) return new Set();
  const dayIsos = days.value.map((d) => d.iso);
  const idx = dayIsos.indexOf(iso);
  if (idx === -1) return new Set([`${maId}_${iso}`]);
  let start = idx;
  while (start > 0 && cellClass(maId, dayIsos[start - 1]) === cls) start--;
  let end = idx;
  while (end < dayIsos.length - 1 && cellClass(maId, dayIsos[end + 1]) === cls) end++;
  const keys = new Set();
  for (let i = start; i <= end; i++) keys.add(`${maId}_${dayIsos[i]}`);
  return keys;
});

function getRunClass(maId, iso) {
  const key = `${maId}_${iso}`;
  if (!hoveredRunKeys.value.has(key)) return null;
  const dayIsos = days.value.map((d) => d.iso);
  const idx = dayIsos.indexOf(iso);
  const hasLeft = idx > 0 && hoveredRunKeys.value.has(`${maId}_${dayIsos[idx - 1]}`);
  const hasRight = idx < dayIsos.length - 1 && hoveredRunKeys.value.has(`${maId}_${dayIsos[idx + 1]}`);
  if (!hasLeft && !hasRight) return 'run-only';
  if (!hasLeft) return 'run-start';
  if (!hasRight) return 'run-end';
  return 'run-middle';
}

function cellClass(maId, iso) {
  const entries = getEntriesForCell(maId, iso);
  if (!entries.length) return '';
  // Priority: planned > blocked > partially > available > abwesenheit
  if (entries.some((e) => e.typ === 'planned')) return 'cell-planned';
  if (entries.some((e) => e.verfuegbarkeit === 'blocked')) return 'cell-blocked';
  if (entries.some((e) => e.typ === 'abwesenheit')) return 'cell-blocked';
  if (entries.some((e) => e.verfuegbarkeit === 'partially')) return 'cell-partially';
  if (entries.some((e) => e.verfuegbarkeit === 'available')) return 'cell-available';
  return '';
}

function cellKuerzel(maId, iso) {
  const entries = getEntriesForCell(maId, iso);
  const planned = entries.find((e) => e.typ === 'planned');
  if (!planned) return null;
  return planned.kuerzel || (planned.bezeichnung ? planned.bezeichnung.substring(0, 6) : null);
}

function cellIcon(maId, iso) {
  const entries = getEntriesForCell(maId, iso);
  if (!entries.length) return null;
  if (entries.some((e) => e.typ === 'planned')) return CELL_ICONS.planned;
  if (entries.some((e) => e.verfuegbarkeit === 'blocked')) return CELL_ICONS.blocked;
  if (entries.some((e) => e.typ === 'abwesenheit')) {
    const a = entries.find((e) => e.typ === 'abwesenheit');
    return CELL_ICONS[a.abwesenheitsKategorie] || CELL_ICONS.sonstiges;
  }
  if (entries.some((e) => e.verfuegbarkeit === 'partially')) return CELL_ICONS.partially;
  if (entries.some((e) => e.verfuegbarkeit === 'available')) return CELL_ICONS.available;
  return null;
}

function getCellTooltip(maId, iso) {
  const entries = getEntriesForCell(maId, iso);
  if (!entries.length) return null;
  return entries
    .map((e) => {
      if (e.typ === 'planned') return `Einsatz: ${e.bezeichnung || 'Auftrag ' + e.auftragNr}${e.uhrzeitVon ? ' (' + e.uhrzeitVon + '–' + e.uhrzeitBis + ')' : ''}`;
      if (e.typ === 'verfuegbarkeit') {
        const labels = { available: 'Verfügbar', partially: 'Eingeschränkt', blocked: 'Blocked' };
        return labels[e.verfuegbarkeit] + (e.zeitVon ? ` (${e.zeitVon}–${e.zeitBis})` : '');
      }
      if (e.typ === 'abwesenheit') {
        const labels = { urlaub: 'Urlaub', krank: 'Krank', feiertag: 'Feiertag', ueberstunden: 'Überstunden', sonstiges: 'Sonstiges' };
        return labels[e.abwesenheitsKategorie] || 'Abwesend';
      }
      if (e.typ === 'notiz' || e.typ === 'hinweis') return e.text;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function getNotizen(maId) {
  return eintraege.value.filter(
    (e) => {
      const id = typeof e.mitarbeiter === 'object' ? e.mitarbeiter._id || e.mitarbeiter : e.mitarbeiter;
      return id === maId && (e.typ === 'notiz' || e.typ === 'hinweis');
    }
  );
}

function getNotizPreview(maId) {
  const notes = getNotizen(maId);
  return notes.map((n) => n.text).join(' | ').substring(0, 100);
}

function getCellNote(maId, iso) {
  return getEntriesForCell(maId, iso).find((e) => e.typ === 'notiz') || null;
}

function getRunNote(maId, iso) {
  const cls = cellClass(maId, iso);
  if (!cls) return getCellNote(maId, iso);
  const dayIsos = days.value.map((d) => d.iso);
  const idx = dayIsos.indexOf(iso);
  if (idx === -1) return getCellNote(maId, iso);
  let start = idx;
  while (start > 0 && cellClass(maId, dayIsos[start - 1]) === cls) start--;
  let end = idx;
  while (end < dayIsos.length - 1 && cellClass(maId, dayIsos[end + 1]) === cls) end++;
  for (let i = start; i <= end; i++) {
    const note = getCellNote(maId, dayIsos[i]);
    if (note) return note;
  }
  return null;
}

function entryIcon(entry) {
  if (entry.typ === 'planned' || entry._source === 'einsatz') return CELL_ICONS.planned;
  if (entry.typ === 'verfuegbarkeit') return CELL_ICONS[entry.verfuegbarkeit];
  if (entry.typ === 'abwesenheit') return CELL_ICONS[entry.abwesenheitsKategorie] || CELL_ICONS.sonstiges;
  return null;
}

function entryLabel(entry) {
  if (entry.typ === 'planned' || entry._source === 'einsatz') return `Einsatz: ${entry.bezeichnung || entry.auftragNr}`;
  if (entry.typ === 'verfuegbarkeit') {
    const l = { available: 'Verfügbar', partially: 'Eingeschränkt', blocked: 'Blocked' };
    return l[entry.verfuegbarkeit];
  }
  if (entry.typ === 'abwesenheit') {
    const l = { urlaub: 'Urlaub', krank: 'Krank', feiertag: 'Feiertag', ueberstunden: 'Überstunden', sonstiges: 'Sonstiges' };
    return l[entry.abwesenheitsKategorie] || 'Abwesend';
  }
  return entry.text || entry.typ;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('de-DE');
}

function formatIsoDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function toggleSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDir.value = 'asc';
  }
}

// ─── Starred / Favorites ───
async function loadStarred() {
  try {
    const { data } = await api.get('/api/users/me');
    const ids = data.dispoPrefs?.starredMitarbeiter || [];
    starredIds.value = new Set(ids);
  } catch (err) {
    console.error('Starred laden fehlgeschlagen:', err);
  }
}

async function saveStarred() {
  try {
    await api.put('/api/users/me/dispo-prefs', {
      prefs: { starredMitarbeiter: [...starredIds.value] },
    });
  } catch (err) {
    console.error('Starred speichern fehlgeschlagen:', err);
  }
}

function toggleStar(maId) {
  const next = new Set(starredIds.value);
  if (next.has(maId)) next.delete(maId);
  else next.add(maId);
  starredIds.value = next;
  saveStarred();
}

// ─── API ───
async function fetchDispo() {
  loading.value = true;
  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + filters.tage);

    const params = new URLSearchParams({
      von: today.toISOString(),
      bis: endDate.toISOString(),
    });
    if (filters.standort) params.append('standort', filters.standort);

    const { data } = await api.get(`/api/dispo?${params.toString()}`);
    mitarbeiter.value = data.mitarbeiter || [];
    eintraege.value = data.eintraege || [];
  } catch (err) {
    console.error('Dispo laden fehlgeschlagen:', err);
  } finally {
    loading.value = false;
  }
}

// ─── Filters ───
function setStandort(val) {
  filters.standort = val;
  fetchDispo();
}

function setTage(val) {
  filters.tage = val;
  fetchDispo();
}

function setDefaultStandort() {
  const loc = auth.user?.location || auth.user?.standort || '';
  const l = loc.toLowerCase();
  if (l.includes('berlin')) filters.standort = '1';
  else if (l.includes('hamburg')) filters.standort = '2';
  else if (l.includes('köln') || l.includes('koeln')) filters.standort = '3';
}

function resetFilters() {
  filters.standort = null;
  filters.tage = 30;
  searchQuery.value = '';
  setDefaultStandort();
  fetchDispo();
}

// ─── Optimistic local update helpers ───
function localAddEntries(newEntries) {
  const existing = new Set(eintraege.value.map((e) => String(e._id)));
  const toAdd = newEntries.filter((e) => !existing.has(String(e._id)));
  if (toAdd.length) eintraege.value = [...eintraege.value, ...toAdd];
}

function localRemoveEntries(ids) {
  const remove = new Set(ids.map(String));
  eintraege.value = eintraege.value.filter((e) => !remove.has(String(e._id)));
}

// ─── Cell Actions ───
function onCellClick(ma, day) {
  // Mobile: open context menu at center of screen
  const entries = getEntriesForCell(ma._id, day.iso);
  if (entries.length && entries.every((e) => e._source === 'einsatz')) return;
  ctxMenu.x = window.innerWidth / 2 - 100;
  ctxMenu.y = window.innerHeight / 2 - 150;
  ctxMenu.ma = ma;
  ctxMenu.day = day.iso;
  ctxMenu.entries = entries;
  ctxMenu.open = true;
}

function onCellRightClick(event, ma, day) {
  // If clicked cell is in selection → open multi-selection context menu
  if (selectedCells.value.size > 0 && selectedCells.value.has(`${ma._id}_${day.iso}`)) {
    const menuW = 220;
    const menuH = 350;
    const x = event.clientX + menuW > window.innerWidth ? event.clientX - menuW : event.clientX;
    const y = event.clientY + menuH > window.innerHeight ? event.clientY - menuH : event.clientY;
    ctxMenu.x = x;
    ctxMenu.y = y;
    ctxMenu.ma = ma;
    ctxMenu.day = null;
    ctxMenu.entries = [];
    ctxMenu.isMulti = true;
    ctxMenu.open = true;
    return;
  }

  // Right-click outside selection → clear selection and open single-cell menu
  clearSelection();
  const entries = getEntriesForCell(ma._id, day.iso);

  const menuW = 220;
  const menuH = 320;
  const x = event.clientX + menuW > window.innerWidth ? event.clientX - menuW : event.clientX;
  const y = event.clientY + menuH > window.innerHeight ? event.clientY - menuH : event.clientY;

  ctxMenu.x = x;
  ctxMenu.y = y;
  ctxMenu.ma = ma;
  ctxMenu.day = day.iso;
  ctxMenu.entries = entries;
  ctxMenu.isMulti = false;
  ctxMenu.open = true;
}

function closeCtxMenu() {
  ctxMenu.open = false;
  ctxMenu.ma = null;
  ctxMenu.day = null;
  ctxMenu.entries = [];
  ctxMenu.isMulti = false;
}

function openEinsatz(entry) {
  closeCtxMenu();
  const focusDate = entry.datumVon
    ? new Date(entry.datumVon).toISOString().slice(0, 10)
    : ctxMenu.day || undefined;
  router.push({
    name: 'Auftraege',
    query: {
      auftragnr: String(entry.auftragNr),
      ...(focusDate ? { focusDate } : {}),
    },
  });
}

function onCellMouseDown(ma, day, event) {
  if (event.button !== 0) return;
  // Multi-select only with Ctrl/Cmd held – like OS file selection
  if (!event.ctrlKey && !event.metaKey) {
    clearSelection();
    return;
  }
  const entries = getEntriesForCell(ma._id, day.iso);
  if (entries.length && entries.every((e) => e._source === 'einsatz')) return;
  const key = `${ma._id}_${day.iso}`;
  dragMode = selectedCells.value.has(key) ? 'remove' : 'add';
  dragCovered = new Set([key]);
  const next = new Set(selectedCells.value);
  if (dragMode === 'add') next.add(key);
  else next.delete(key);
  selectedCells.value = next;
}

function onCellMouseEnter(ma, day) {
  hoveredCell.value = { maId: ma._id, iso: day.iso };
  if (!dragMode) return;
  const key = `${ma._id}_${day.iso}`;
  if (dragCovered && dragCovered.has(key)) return;
  const entries = getEntriesForCell(ma._id, day.iso);
  if (entries.length && entries.every((e) => e._source === 'einsatz')) return;
  if (dragCovered) dragCovered.add(key);
  const next = new Set(selectedCells.value);
  if (dragMode === 'add') next.add(key);
  else next.delete(key);
  selectedCells.value = next;
}

function onCellMouseMove(ma, day, event) {
  const text = getCellTooltip(ma._id, day.iso);
  cellTooltipState.value = { visible: !!text, text: text || '', x: event.clientX, y: event.clientY };
}

function onCellMouseLeave() {
  hoveredCell.value = null;
  cellTooltipState.value = { ...cellTooltipState.value, visible: false };
}

async function setStatus(status) {
  const isMulti = ctxMenu.isMulti;
  const singleMaId = ctxMenu.ma?._id;
  const singleDay = ctxMenu.day;
  const grouped = isMulti ? getGroupedSelection() : null;
  // Collect existing non-einsatz entries to replace before creating new one
  const toDeleteIds = [];
  if (isMulti) {
    const seen = new Set();
    for (const key of selectedCells.value) {
      const idx = key.indexOf('_');
      const maId = key.slice(0, idx);
      const iso = key.slice(idx + 1);
      for (const e of getEntriesForCell(maId, iso)) {
        if (e._source !== 'einsatz' && !seen.has(String(e._id))) {
          seen.add(String(e._id));
          toDeleteIds.push(e._id);
        }
      }
    }
  } else {
    for (const e of ctxMenu.entries.filter((e) => e._source !== 'einsatz')) {
      toDeleteIds.push(e._id);
    }
  }
  clearSelection();
  closeCtxMenu();
  try {
    if (toDeleteIds.length) {
      await Promise.all(toDeleteIds.map((id) => api.delete(`/api/dispo/${id}`)));
      localRemoveEntries(toDeleteIds);
    }
    const created = [];
    if (isMulti) {
      for (const { maId, ranges } of grouped) {
        for (const { from, to } of ranges) {
          const { data } = await api.post('/api/dispo', {
            mitarbeiter: maId, datumVon: from, datumBis: to,
            typ: 'verfuegbarkeit', verfuegbarkeit: status,
          });
          created.push(data);
        }
      }
    } else {
      const { data } = await api.post('/api/dispo', {
        mitarbeiter: singleMaId, datumVon: singleDay, datumBis: singleDay,
        typ: 'verfuegbarkeit', verfuegbarkeit: status,
      });
      created.push(data);
    }
    localAddEntries(created);
  } catch (err) {
    console.error('Status setzen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

async function setAbsence(kategorie) {
  const isMulti = ctxMenu.isMulti;
  const singleMaId = ctxMenu.ma?._id;
  const singleDay = ctxMenu.day;
  const grouped = isMulti ? getGroupedSelection() : null;
  // Collect existing non-einsatz entries to replace before creating new one
  const toDeleteIds = [];
  if (isMulti) {
    const seen = new Set();
    for (const key of selectedCells.value) {
      const idx = key.indexOf('_');
      const maId = key.slice(0, idx);
      const iso = key.slice(idx + 1);
      for (const e of getEntriesForCell(maId, iso)) {
        if (e._source !== 'einsatz' && !seen.has(String(e._id))) {
          seen.add(String(e._id));
          toDeleteIds.push(e._id);
        }
      }
    }
  } else {
    for (const e of ctxMenu.entries.filter((e) => e._source !== 'einsatz')) {
      toDeleteIds.push(e._id);
    }
  }
  clearSelection();
  closeCtxMenu();
  try {
    if (toDeleteIds.length) {
      await Promise.all(toDeleteIds.map((id) => api.delete(`/api/dispo/${id}`)));
      localRemoveEntries(toDeleteIds);
    }
    const created = [];
    if (isMulti) {
      for (const { maId, ranges } of grouped) {
        for (const { from, to } of ranges) {
          const { data } = await api.post('/api/dispo', {
            mitarbeiter: maId, datumVon: from, datumBis: to,
            typ: 'abwesenheit', abwesenheitsKategorie: kategorie,
          });
          created.push(data);
        }
      }
    } else {
      const { data } = await api.post('/api/dispo', {
        mitarbeiter: singleMaId, datumVon: singleDay, datumBis: singleDay,
        typ: 'abwesenheit', abwesenheitsKategorie: kategorie,
      });
      created.push(data);
    }
    localAddEntries(created);
  } catch (err) {
    console.error('Abwesenheit setzen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

async function clearStatus() {
  const isMulti = ctxMenu.isMulti;
  // Collect IDs to delete before closing
  const toDeleteIds = [];
  if (isMulti) {
    const seen = new Set();
    for (const key of selectedCells.value) {
      const idx = key.indexOf('_');
      const maId = key.slice(0, idx);
      const iso = key.slice(idx + 1);
      for (const e of getEntriesForCell(maId, iso)) {
        if (e._source !== 'einsatz' && !seen.has(String(e._id))) {
          seen.add(String(e._id));
          toDeleteIds.push(e._id);
        }
      }
    }
  } else {
    for (const e of ctxMenu.entries.filter((e) => e._source !== 'einsatz')) {
      toDeleteIds.push(e._id);
    }
  }
  clearSelection();
  closeCtxMenu();
  try {
    await Promise.all(toDeleteIds.map((id) => api.delete(`/api/dispo/${id}`)));
    localRemoveEntries(toDeleteIds);
  } catch (err) {
    console.error('Löschen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

async function deleteEntry(id) {
  ctxMenu.entries = ctxMenu.entries.filter((e) => e._id !== id);
  try {
    await api.delete(`/api/dispo/${id}`);
    localRemoveEntries([id]);
  } catch (err) {
    console.error('Eintrag löschen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

// ─── Notes Actions ───
function openNotes(ma) {
  notesModal.ma = ma;
  notesModal.notes = getNotizen(ma._id);
  notesModal.newText = '';
  notesModal.open = true;
}

function closeNotes() {
  notesModal.open = false;
  notesModal.ma = null;
  notesModal.notes = [];
  notesModal.newText = '';
}

async function addNote() {
  if (!notesModal.newText.trim()) return;
  try {
    const { data } = await api.post('/api/dispo', {
      mitarbeiter: notesModal.ma._id,
      datumVon: new Date().toISOString(),
      typ: 'notiz',
      text: notesModal.newText.trim(),
    });
    notesModal.newText = '';
    localAddEntries([data]);
    notesModal.notes = getNotizen(notesModal.ma._id);
  } catch (err) {
    console.error('Notiz hinzufügen fehlgeschlagen:', err);
  }
}

async function deleteNote(id) {
  try {
    await api.delete(`/api/dispo/${id}`);
    localRemoveEntries([id]);
    if (notesModal.ma) {
      notesModal.notes = getNotizen(notesModal.ma._id);
    }
  } catch (err) {
    console.error('Notiz löschen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

// ─── Cell Note Actions ───
function openCellNote(ma, day) {
  const existing = getCellNote(ma._id, day.iso);
  cellNoteModal.ma = ma;
  cellNoteModal.day = day.iso;
  cellNoteModal.text = existing?.text || '';
  cellNoteModal.existingNote = existing || null;
  cellNoteModal.open = true;
  closeCtxMenu();
}

function closeCellNote() {
  cellNoteModal.open = false;
  cellNoteModal.ma = null;
  cellNoteModal.day = null;
  cellNoteModal.text = '';
  cellNoteModal.existingNote = null;
}

async function saveCellNote() {
  const text = cellNoteModal.text.trim();
  if (!text) return;
  const { ma, day, existingNote } = cellNoteModal;
  closeCellNote();
  try {
    if (existingNote) {
      const { data } = await api.put(`/api/dispo/${existingNote._id}`, { text });
      localRemoveEntries([existingNote._id]);
      localAddEntries([data]);
    } else {
      const { data } = await api.post('/api/dispo', {
        mitarbeiter: ma._id,
        datumVon: day,
        datumBis: day,
        typ: 'notiz',
        text,
      });
      localAddEntries([data]);
    }
  } catch (err) {
    console.error('Notiz speichern fehlgeschlagen:', err);
    await fetchDispo();
  }
}

// ─── Scroll to today ───
function scrollToToday() {
  nextTick(() => {
    const wrapper = tableWrapper.value;
    if (!wrapper) return;
    const todayEl = wrapper.querySelector('.is-today');
    if (todayEl) {
      // Offset for sticky columns (~280px)
      const offset = todayEl.offsetLeft - 280;
      wrapper.scrollLeft = Math.max(0, offset);
    }
  });
}

// ─── Lifecycle ───
onMounted(async () => {
  setDefaultStandort();
  await Promise.all([fetchDispo(), loadStarred()]);
  scrollToToday();
});
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.dispo-page {
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;

  h1 {
    font-size: 1.8rem;
    color: var(--text);
    margin: 0;
  }
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.header-controls {
  display: flex;
  gap: 10px;
}

.search-box input {
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.95rem;
  width: 280px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--muted);
  font-size: 14px;
}

// ─── Table ───
.dispo-table-wrapper {
  overflow: auto; /* Handles both X and Y scrolling */
  max-height: calc(100vh - 200px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  position: relative;
}

/* Neuer Split-Layout Container */
.dispo-split-layout {
  display: flex;
  min-width: min-content;
}

/* Linker Bereich verhält sich sticky innerhalb des wrappers beim scrollen nach rechts */
.dispo-left-pane {
  position: sticky;
  left: 0;
  z-index: 10;
  background: var(--surface);
  flex-shrink: 0;
  /* Fügt eine dezente Trennlinie als Schatten hinzu, wenn rechts gescrollt wird */
  box-shadow: 4px 0 10px rgba(0,0,0,0.06);

  /* Sticky-Top für den Header innerhalb der sticky-left Spalte erzwingen */
  .dispo-table thead th {
    position: sticky;
    top: 0;
    z-index: 12;
    background: var(--panel);
  }

  /* Kombinierter Hover-Rahmen um Nachname + Vorname */
  .dispo-table tr.row-hovered {
    td.col-nachname {
      border-left-color: var(--primary);
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-left-width: 1.5px;
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
    td.col-vorname {
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
    td.col-bereich {
      border-right-color: var(--primary);
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-right-width: 1.5px;
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
  }
}

/* Rechter Bereich nimmt den Rest ein */
.dispo-right-pane {
  flex-grow: 1;
}

.dispo-table {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;

  th, td {
    padding: 0;
    border: 1px solid var(--border);
    font-size: 12px;
    white-space: nowrap;
    
    /* Um Zeilenhöhen beider Tabellen synchron zu halten: */
    height: 44px;
    box-sizing: border-box;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--panel);
    z-index: 2;
    font-weight: 600;
    color: var(--text);
    padding: 6px 4px;
    height: 52px; /* Fixe Header-Höhe */
  }

  /* Sticky Spalten-Logik wird im Split-Layout nicht mehr benötigt! */
  .col-nachname {
    width: 130px;
    min-width: 130px;
    max-width: 130px;
    padding: 6px 10px;
    text-align: left;
    overflow: hidden;
  }

  .col-vorname {
    width: 110px;
    min-width: 110px;
    max-width: 110px;
    padding: 6px 10px;
    text-align: left;
    overflow: hidden;

    .ma-name {
      font-weight: 500;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
  }

  .col-bereich {
    width: 60px;
    min-width: 60px;
    max-width: 60px;
    padding: 4px 6px;
    text-align: center;
    overflow: hidden;
  }

  .bereich-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--primary);
    background: transparent;
    border: 1px solid var(--primary);
    border-radius: 4px;
    padding: 1px 4px;
    line-height: 1.4;
  }

  .col-nachname,
  .col-vorname {
    position: relative; /* Wichtig für col-resize-handle */
  }

  .col-resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 5;
    background: transparent;

    &:hover,
    &:active {
      background: var(--primary);
      opacity: 0.5;
    }
  }

  tr.row-hovered td {
    background: var(--soft);
  }

  .sortable-th {
    cursor: pointer;
    user-select: none;
    transition: color 0.15s;

    &:hover {
      color: var(--primary);
    }

    .th-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sort-icon {
      margin-left: 4px;
      font-size: 10px;

      &.muted {
        opacity: 0.3;
      }
    }
  }

  .col-day {
    min-width: 48px;
    max-width: 48px;
    text-align: center;
    cursor: pointer;
    position: relative;
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

    &:hover,
    &.is-active {
      box-shadow: inset 0 0 0 2px var(--primary);
      transform: scale(1.05);
      z-index: 2;
    }

    &.cell-available:hover,
    &.cell-available.is-active {
      box-shadow: inset 0 0 0 2px #10b981;
    }

    &.cell-partially:hover,
    &.cell-partially.is-active {
      box-shadow: inset 0 0 0 2px #f59e0b;
    }

    &.cell-blocked:hover,
    &.cell-blocked.is-active {
      box-shadow: inset 0 0 0 2px #ef4444;
    }

    &.cell-planned:hover,
    &.cell-planned.is-active {
      box-shadow: inset 0 0 0 2px #6366f1;
    }

    // ─── Run highlight (shared border for same-status ranges) ───
    --run-color: var(--primary);
    &.cell-available { --run-color: #10b981; }
    &.cell-partially { --run-color: #f59e0b; }
    &.cell-blocked   { --run-color: #ef4444; }
    &.cell-planned   { --run-color: #6366f1; }

    &.run-only {
      box-shadow: inset 0 0 0 2px var(--run-color) !important;
      transform: scale(1.03);
      z-index: 2;
    }
    &.run-start {
      box-shadow: inset 2px 2px 0 0 var(--run-color), inset 0 -2px 0 0 var(--run-color) !important;
      transform: none;
      z-index: 2;
    }
    &.run-middle {
      box-shadow: inset 0 2px 0 0 var(--run-color), inset 0 -2px 0 0 var(--run-color) !important;
      transform: none;
      z-index: 2;
    }
    &.run-end {
      box-shadow: inset -2px 2px 0 0 var(--run-color), inset 0 -2px 0 0 var(--run-color) !important;
      transform: none;
      z-index: 2;
    }

    &.is-today {
      .day-header {
        color: var(--primary);
        font-weight: 700;
      }
    }

    &.is-weekend:not(.cell-planned):not(.cell-blocked):not(.cell-partially):not(.cell-available) {
      background: var(--hover);
    }
  }
}

.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.3;

  .day-name {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .day-date {
    font-size: 11px;
    color: var(--muted);
  }
}

.ma-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  overflow: hidden;

  .star-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 13px;
    padding: 2px;
    flex-shrink: 0;
    transition: color 0.15s, transform 0.15s;

    &.active {
      color: var(--primary);
    }

    &:hover {
      color: var(--primary);
      transform: scale(1.2);
    }
  }

  .ma-name {
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.note-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.15s;

  &.has-notes {
    color: var(--primary);
  }

  &:hover {
    color: var(--text);
  }
}

.cell-fill {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 100%;

  .cell-icon {
    font-size: 12px;
  }
}

// ─── Cell Status Colors ───
.cell-available {
  background: #10b98120;
  .cell-icon { color: #10b981; }
}

.cell-partially {
  background: #f59e0b20;
  .cell-icon { color: #f59e0b; }
}

.cell-blocked {
  background: #ef444420;
  .cell-icon { color: #ef4444; }
}

.cell-planned {
  background: #6366f120;
  .cell-icon { color: #6366f1; }
  .cell-label {
    font-size: 10px;
    font-weight: 700;
    color: #6366f1;
    letter-spacing: 0.03em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 44px;
    line-height: 1;
  }
}

// ─── Multi-cell Selection ───
.cell-selected {
  background: rgba(253, 126, 20, 0.18) !important;
  box-shadow: inset 0 0 0 2px var(--primary) !important;

  .cell-icon {
    opacity: 0.8;
  }
}

// ─── Selection Bar ───
.selection-bar {
  height: 28px; // reserved space — never collapses
  display: flex;
  align-items: center;
}

.selection-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 10px;
  background: rgba(253, 126, 20, 0.10);
  border: 1px solid var(--primary);
  border-radius: 20px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 500;

  strong { font-weight: 700; }

  .sel-chip-clear {
    background: none;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    line-height: 1;
    display: flex;
    align-items: center;
    opacity: 0.7;
    transition: opacity 0.15s;

    &:hover { opacity: 1; }
  }
}

.sel-chip-enter-active,
.sel-chip-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.sel-chip-enter-from,
.sel-chip-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.dispo-cell-tooltip {
  position: fixed;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  white-space: pre-line;
  pointer-events: none;
  z-index: 9999;
  max-width: 280px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.note-dot {
  position: absolute;
  top: 2px;
  right: 3px;
  font-size: 13px;
  font-weight: 900;
  font-style: italic;
  color: var(--primary);
  line-height: 1;
  pointer-events: none;
  text-shadow: 0 0 4px rgba(238, 175, 103, 0.5);
}

.cell-note-modal {
  background: var(--surface);
  border-radius: 10px;
  padding: 16px;
  width: 340px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cell-note-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.cell-note-textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg);
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
  outline: none;

  &:focus {
    border-color: var(--primary);
  }
}

.cell-note-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  .btn-cancel {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    cursor: pointer;
    color: var(--muted);
    &:hover { color: var(--text); border-color: var(--text); }
  }

  .btn-save {
    background: var(--primary);
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    cursor: pointer;
    color: white;
    font-weight: 600;
    &:hover { opacity: 0.9; }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }
}

// ─── Notes Modal ───
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.notes-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 440px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.notes-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 15px;
    color: var(--text);
  }
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;

  &:hover { color: var(--text); }
}

.notes-modal-body {
  padding: 16px 20px;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.note-item {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 8px 12px;
  border-radius: 6px;

  .note-text {
    color: var(--text);
    font-size: 13px;
    white-space: pre-wrap;
  }

  .note-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    font-size: 11px;
    color: var(--muted);
  }
}

.delete-note-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;

  &:hover { color: #ef4444; }
}

.no-notes {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 12px;
}

.note-add {
  display: flex;
  flex-direction: column;
  gap: 8px;

  textarea {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
    resize: vertical;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;

    &:focus { border-color: var(--primary); }
  }
}

.add-note-btn {
  align-self: flex-end;
  background: var(--primary);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    filter: brightness(0.9);
  }
}

// ─── Cell Context Menu ───
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.ctx-menu {
  position: fixed;
  background: var(--modal-bg, #fff);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  min-width: 200px;
  z-index: 1001;
  padding: 4px 0;
  overflow: hidden;
}

.ctx-header {
  padding: 6px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  pointer-events: none;
}

.ctx-multi-label {
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: var(--primary);
  text-transform: none;
  letter-spacing: 0;
  margin-top: 1px;
}

.ctx-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 14px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;

  &:hover {
    background: var(--hover);
  }

  &.ctx-item--available { color: #10b981; }
  &.ctx-item--partially { color: #f59e0b; }
  &.ctx-item--blocked   { color: #ef4444; }
  &.ctx-item--clear     { color: var(--muted); }
  &.ctx-item--open      { color: var(--primary); }
}

.ctx-item-icon {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.ctx-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 14px;
  font-size: 12px;
  color: var(--text);
}

.ctx-entry-icon {
  margin-right: 6px;
  opacity: 0.7;
}

.ctx-delete-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;

  &:hover { color: #ef4444; }
}

.empty-row {
  text-align: center;
  padding: 2rem !important;
  color: var(--muted);
  font-size: 14px;
}

.dropdown-item {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  transition: background 0.1s;

  &:hover { background: var(--hover); }
  &.selected { color: var(--primary); font-weight: 600; }
}

// ─── Employee Card Modal ───
.card-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card-modal-container {
  position: relative;
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 14px;
}

.card-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--muted);

  &:hover { color: var(--text); }
}
</style>
