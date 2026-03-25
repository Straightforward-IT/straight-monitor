<template>
  <div class="dispo-page">
    <div class="page-header">
      <div class="header-title-group">
      </div>
      <div class="header-controls">
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

      <!-- Planung Filter -->
      <FilterGroup label="Planung">
        <FilterChip :active="!filters.planungFilter" @click="filters.planungFilter = null">Alle</FilterChip>
        <FilterChip :active="filters.planungFilter === 'eingeplant'" @click="filters.planungFilter = 'eingeplant'">Eingeplante</FilterChip>
        <FilterChip :active="filters.planungFilter === 'ungeplant'" @click="filters.planungFilter = 'ungeplant'">Ungeplante</FilterChip>
      </FilterGroup>

      <FilterDivider />

      <!-- Reset Button -->
      <FilterChip class="reset-chip" @click="resetFilters" title="Alle Filter zurücksetzen">
        <font-awesome-icon icon="fa-solid fa-rotate-left" />
        Zurücksetzen
      </FilterChip>

      <!-- Search Box -->
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Mitarbeiter suchen…"
        />
      </div>
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
      <button class="help-btn" style="margin-left: auto" @click="showHelp = true" title="Hilfe">
        <font-awesome-icon icon="fa-solid fa-circle-question" />
      </button>
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
                <th
                  class="col-bereich"
                  :class="{ 'bereich-filter-active': bereichFilter !== null }"
                  @click.stop="onBereichHeaderClick"
                >
                  <span class="th-content">
                    Bereich
                    <font-awesome-icon v-if="!bereichFilter" icon="fa-solid fa-filter" class="bereich-filter-icon" />
                    <span v-if="bereichFilter" class="bereich-filter-label">{{ bereichFilter }}</span>
                    <span v-if="bereichFilter" class="bereich-filter-clear" @click.stop="bereichFilter = null">✕</span>
                  </span>
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
                @contextmenu.prevent.stop="openNameMenu($event, ma)"
                style="cursor: context-menu"
              >
                <!-- Nachname -->
                <td class="col-nachname" :style="{ width: colWidths.nachname + 'px', minWidth: colWidths.nachname + 'px', maxWidth: colWidths.nachname + 'px' }">
                  <div class="ma-name-cell">
                    <div v-if="isTeamleiter(ma)" class="tl-corner-wrapper"><TlBadge /></div>
                    <button
                      class="star-btn"
                      :class="{ active: starredIds.has(ma._id) }"
                      @click="toggleStar(ma._id)"
                      :title="starredIds.has(ma._id) ? 'Favorit entfernen' : 'Als Favorit markieren'"
                    >
                      <font-awesome-icon :icon="starredIds.has(ma._id) ? 'fa-solid fa-star' : 'fa-regular fa-star'" />
                    </button>
                    <span class="ma-name">{{ ma.nachname }}</span>
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
                  <span v-if="getCellComments(ma._id, day.iso).length" class="comment-bubble">
                    <font-awesome-icon icon="fa-solid fa-comment" class="comment-bubble-icon" />
                    <span v-if="getCellUnreadCount(ma._id, day.iso) > 0" class="comment-badge">{{ getCellUnreadCount(ma._id, day.iso) }}</span>
                  </span>
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

    <!-- Help Modal -->
    <teleport to="body">
      <div v-if="showHelp" class="modal-overlay" @click="showHelp = false">
        <div class="help-modal" @click.stop>
          <div class="help-modal-header">
            <h3><font-awesome-icon icon="fa-solid fa-circle-question" /> Dispo-Tabelle — Hilfe</h3>
            <button class="close-btn" @click="showHelp = false"><font-awesome-icon icon="fa-solid fa-times" /></button>
          </div>
          <div class="help-modal-body">
            <div class="help-section">
              <h4>Zellen-Status setzen</h4>
              <p><strong>Rechtsklick</strong> auf eine Zelle öffnet das Kontextmenü — dort kannst du Verfügbarkeit, Abwesenheit setzen oder löschen.</p>
            </div>
            <div class="help-section">
              <h4>Mehrfachauswahl</h4>
              <p>Halte <kbd>⌘ Cmd</kbd> (Mac) gedrückt und klicke oder ziehe über mehrere Zellen. Danach <strong>Rechtsklick</strong> auf die Auswahl, um den Status für alle gleichzeitig zu setzen.</p>
              <p><kbd>Esc</kbd> hebt die Auswahl auf.</p>
            </div>
            <div class="help-section">
              <h4>Kommentare</h4>
              <p>Über das Kontextmenü (Rechtsklick) → <em>Kommentare</em> kannst du Notizen zu einer Zelle hinterlassen. Ungelesene Kommentare werden mit einem roten Badge angezeigt.</p>
            </div>
            <div class="help-section">
              <h4>Favoriten</h4>
              <p>Klicke auf den <font-awesome-icon icon="fa-regular fa-star" /> Stern neben einem Namen, um den Mitarbeiter als Favorit zu markieren. Favoriten werden oben in der Liste angezeigt.</p>
            </div>
            <div class="help-section">
              <h4>Mitarbeiter-Karte</h4>
              <p><strong>Rechtsklick</strong> auf den Namen eines Mitarbeiters öffnet ein Menü mit der Option <em>Karte Öffnen</em>.</p>
            </div>
            <div class="help-section">
              <h4>Legende</h4>
              <div class="help-legend">
                <div class="help-legend-item"><span class="legend-dot legend-available"></span> Verfügbar</div>
                <div class="help-legend-item"><span class="legend-dot legend-partially"></span> Eingeschränkt</div>
                <div class="help-legend-item"><span class="legend-dot legend-blocked"></span> Blocked / Abwesend</div>
                <div class="help-legend-item"><span class="legend-dot legend-planned"></span> Eingeplant (Einsatz)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Bereich Filter Menu -->
    <teleport to="body">
      <div v-if="bereichMenuOpen" class="ctx-overlay" @click="bereichMenuOpen = false" @contextmenu.prevent="bereichMenuOpen = false">
        <div class="ctx-menu bereich-filter-menu" :style="{ top: bereichMenuPos.y + 'px', left: bereichMenuPos.x + 'px' }" @click.stop>
          <div class="ctx-item" :class="{ active: bereichFilter === 'S' }" @click="bereichFilter = 'S'; bereichMenuOpen = false">Service (S)</div>
          <div class="ctx-item" :class="{ active: bereichFilter === 'L' }" @click="bereichFilter = 'L'; bereichMenuOpen = false">Logistik (L)</div>
          <div v-if="bereichFilter" class="ctx-item ctx-item-remove" @click="bereichFilter = null; bereichMenuOpen = false">Filter entfernen</div>
        </div>
      </div>
    </teleport>

    <!-- Cell Tooltip -->
    <teleport to="body">
      <div
        v-if="cellTooltipState.visible"
        class="dispo-cell-tooltip"
        :class="{ 'dispo-cell-tooltip--comments': cellTooltipState.comments.length }"
        :style="{ top: cellTooltipState.y + 20 + 'px', left: cellTooltipState.x + 'px' }"
      >
        <template v-if="cellTooltipState.comments.length">
          <div v-for="c in cellTooltipState.comments" :key="c._id" class="tooltip-comment">
            <div class="tooltip-comment-header">
              <span class="tooltip-comment-author">{{ c.author }}</span>
              <span class="tooltip-comment-time">{{ formatDateTime(c.timestamp) }}</span>
            </div>
            <p class="tooltip-comment-text">{{ c.text }}</p>
          </div>
        </template>
        <template v-else>{{ cellTooltipState.text }}</template>
      </div>
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

    <!-- Comment Thread Modal -->
    <teleport to="body">
      <div v-if="chatModal.open" class="modal-overlay" @click="closeChatModal">
        <div class="chat-modal" @click.stop>
          <div class="chat-modal-header">
            <div class="chat-modal-title">
              <font-awesome-icon icon="fa-solid fa-comments" />
              <span>{{ chatModal.ma?.vorname }} {{ chatModal.ma?.nachname }} · {{ formatIsoDate(chatModal.day) }}</span>
            </div>
            <button class="close-btn" @click="closeChatModal"><font-awesome-icon icon="fa-solid fa-times" /></button>
          </div>
          <div class="chat-thread" ref="chatThreadRef">
            <p v-if="!chatModal.comments.length" class="chat-empty">Noch keine Kommentare.</p>
            <div
              v-for="c in chatModal.comments"
              :key="c._id"
              class="chat-message"
              :class="{ 'chat-message--own': isOwnComment(c) }"
            >
              <div class="chat-message-meta">
                <span class="chat-message-author">{{ c.author }}</span>
                <span class="chat-message-time">{{ formatDateTime(c.timestamp) }}</span>
                <button v-if="isOwnComment(c) || isAdmin" class="chat-delete-btn" @click="deleteKommentar(c._id)" title="Löschen">
                  <font-awesome-icon icon="fa-solid fa-trash" />
                </button>
              </div>
              <p class="chat-message-text">{{ c.text }}</p>
            </div>
          </div>
          <div class="chat-input-row">
            <textarea
              v-model="chatModal.newText"
              class="chat-textarea"
              placeholder="Kommentar schreiben… (Ctrl+Enter senden)"
              rows="2"
              @keydown.ctrl.enter.prevent="postComment"
              @keydown.meta.enter.prevent="postComment"
            ></textarea>
            <button class="chat-send-btn" @click="postComment" :disabled="!chatModal.newText.trim() || chatModal.loading">
              <font-awesome-icon icon="fa-solid fa-paper-plane" />
            </button>
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

          <template v-if="!ctxMenu.isMulti">
            <div class="ctx-divider"></div>
            <button class="ctx-item" @click="openChatModal(ctxMenu.ma, { iso: ctxMenu.day })">
              <font-awesome-icon icon="fa-solid fa-comments" class="ctx-item-icon" />
              Kommentare
              <span v-if="getCellUnreadCount(ctxMenu.ma?._id, ctxMenu.day) > 0" class="ctx-unread-badge">
                {{ getCellUnreadCount(ctxMenu.ma?._id, ctxMenu.day) }}
              </span>
            </button>
          </template>

          <div class="ctx-divider"></div>

          <button class="ctx-item ctx-item--clear" @click="clearStatus">
            <font-awesome-icon icon="fa-solid fa-eraser" class="ctx-item-icon" /> Löschen
          </button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue';
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
const mitarbeiter = shallowRef([]);
const eintraege = shallowRef([]);
const kommentare = shallowRef([]);
const searchQuery = ref('');
const tableWrapper = ref(null);
const chatThreadRef = ref(null);
const filterExpanded = ref(true);
const isMobile = ref(window.innerWidth <= 768);
const starredIds = ref(new Set());
const hoveredMaId = ref(null);
const hoveredCell = ref(null);
const cellTooltipState = ref({ visible: false, text: '', comments: [], x: 0, y: 0 });
const bereichFilter = ref(null); // null | 'S' | 'L'
const bereichMenuOpen = ref(false);
const bereichMenuPos = ref({ x: 0, y: 0 });
const showHelp = ref(false);

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
  planungFilter: null,
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

// ─── Chat Modal (Comment Thread) ───
const chatModal = reactive({
  open: false,
  ma: null,
  day: null,
  comments: [],
  newText: '',
  loading: false,
});

const isAdmin = computed(() => auth.user?.roles?.includes('ADMIN'));

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
  if (bereichFilter.value) {
    const f = bereichFilter.value;
    list = list.filter((m) => {
      const b = getMaBereich(m);
      return b === f || b === 'S+L';
    });
  }
  if (filters.planungFilter) {
    const todayIso = toIso((() => { const d = new Date(); d.setHours(0,0,0,0); return d; })());
    const eingeplantSet = new Set(
      eintraege.value
        .filter((e) => e.typ === 'planned' && (e.datumBis || e.datumVon) >= todayIso)
        .map((e) => String(typeof e.mitarbeiter === 'object' ? e.mitarbeiter._id || e.mitarbeiter : e.mitarbeiter))
    );
    if (filters.planungFilter === 'eingeplant') {
      list = list.filter((m) => eingeplantSet.has(String(m._id)));
    } else if (filters.planungFilter === 'ungeplant') {
      list = list.filter((m) => !eingeplantSet.has(String(m._id)));
    }
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

// Cached iso list for fast index lookup
const dayIsos = computed(() => days.value.map((d) => d.iso));
const dayIsoIndex = computed(() => {
  const map = {};
  dayIsos.value.forEach((iso, i) => { map[iso] = i; });
  return map;
});

// Pre-compute cellClass results into a map for O(1) template lookups
const cellDataMap = computed(() => {
  const map = {};
  const isos = dayIsos.value;
  const maList = filteredMitarbeiter.value;
  for (const ma of maList) {
    for (const iso of isos) {
      const entries = getEntriesForCell(ma._id, iso);
      if (!entries.length) continue;
      const key = `${ma._id}_${iso}`;
      let cls = '';
      let icon = null;
      let kuerzel = null;
      if (entries.some((e) => e.typ === 'planned')) {
        cls = 'cell-planned';
        icon = CELL_ICONS.planned;
        const planned = entries.find((e) => e.typ === 'planned');
        kuerzel = planned.kuerzel || (planned.bezeichnung ? planned.bezeichnung.substring(0, 6) : null);
      } else if (entries.some((e) => e.verfuegbarkeit === 'blocked')) {
        cls = 'cell-blocked';
        icon = CELL_ICONS.blocked;
      } else if (entries.some((e) => e.typ === 'abwesenheit')) {
        cls = 'cell-blocked';
        const a = entries.find((e) => e.typ === 'abwesenheit');
        icon = CELL_ICONS[a.abwesenheitsKategorie] || CELL_ICONS.sonstiges;
      } else if (entries.some((e) => e.verfuegbarkeit === 'partially')) {
        cls = 'cell-partially';
        icon = CELL_ICONS.partially;
      } else if (entries.some((e) => e.verfuegbarkeit === 'available')) {
        cls = 'cell-available';
        icon = CELL_ICONS.available;
      }
      if (cls) map[key] = { cls, icon, kuerzel };
    }
  }
  return map;
});

const hoveredRunKeys = computed(() => {
  if (!hoveredCell.value) return new Set();
  const { maId, iso } = hoveredCell.value;
  const data = cellDataMap.value[`${maId}_${iso}`];
  if (!data) return new Set();
  const cls = data.cls;
  const isos = dayIsos.value;
  const idx = dayIsoIndex.value[iso];
  if (idx === undefined) return new Set([`${maId}_${iso}`]);
  let start = idx;
  while (start > 0 && cellDataMap.value[`${maId}_${isos[start - 1]}`]?.cls === cls) start--;
  let end = idx;
  while (end < isos.length - 1 && cellDataMap.value[`${maId}_${isos[end + 1]}`]?.cls === cls) end++;
  const keys = new Set();
  for (let i = start; i <= end; i++) keys.add(`${maId}_${isos[i]}`);
  return keys;
});

function getRunClass(maId, iso) {
  // Only compute for the hovered row
  if (!hoveredCell.value || hoveredCell.value.maId !== maId) return null;
  const key = `${maId}_${iso}`;
  if (!hoveredRunKeys.value.has(key)) return null;
  const isos = dayIsos.value;
  const idx = dayIsoIndex.value[iso];
  const hasLeft = idx > 0 && hoveredRunKeys.value.has(`${maId}_${isos[idx - 1]}`);
  const hasRight = idx < isos.length - 1 && hoveredRunKeys.value.has(`${maId}_${isos[idx + 1]}`);
  if (!hasLeft && !hasRight) return 'run-only';
  if (!hasLeft) return 'run-start';
  if (!hasRight) return 'run-end';
  return 'run-middle';
}

// Fast O(1) lookups using pre-computed cellDataMap
function cellClass(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.cls || '';
}

function cellKuerzel(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.kuerzel || null;
}

function cellIcon(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.icon || null;
}

function getCellTooltip(maId, iso) {
  const entries = getEntriesForCell(maId, iso);
  if (!entries.length) return null;
  return entries
    .map((e) => {
      if (e.typ === 'planned') return `Einsatz: ${e.bezeichnung || 'Auftrag ' + e.auftragNr}${e.uhrzeitVon ? ' (' + e.uhrzeitVon + '–' + e.uhrzeitBis + ')' : ''}`;
      if (e.typ === 'verfuegbarkeit') return null;
      if (e.typ === 'abwesenheit') return null;
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

// ─── Comment index: mitarbeiterId_iso → comments (O(1) lookup) ───
const kommentarMap = computed(() => {
  const map = {};
  for (const k of kommentare.value) {
    const key = `${k.mitarbeiter}_${k.datum}`;
    if (!map[key]) map[key] = [];
    map[key].push(k);
  }
  return map;
});

function getCellComments(maId, iso) {
  return kommentarMap.value[`${maId}_${iso}`] || [];
}

function getCellUnreadCount(maId, iso) {
  if (!maId || !iso) return 0;
  const userId = auth.user?._id;
  if (!userId) return 0;
  const userIdStr = String(userId);
  return getCellComments(maId, iso).filter(
    (k) => String(k.authorId) !== userIdStr && !k.readBy?.map(String).includes(userIdStr)
  ).length;
}

function isOwnComment(comment) {
  const userId = auth.user?._id;
  return !!userId && String(comment.authorId) === String(userId);
}

function formatDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) +
    ' ' +
    dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
}

function getRunNote(maId, iso) {
  const cls = cellClass(maId, iso);
  if (!cls) return getCellNote(maId, iso);
  const isos = dayIsos.value;
  const idx = dayIsoIndex.value[iso];
  if (idx === undefined) return getCellNote(maId, iso);
  let start = idx;
  while (start > 0 && cellClass(maId, isos[start - 1]) === cls) start--;
  let end = idx;
  while (end < isos.length - 1 && cellClass(maId, isos[end + 1]) === cls) end++;
  for (let i = start; i <= end; i++) {
    const note = getCellNote(maId, isos[i]);
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
  // also refresh comments for visible range
  fetchKommentare();
}

async function fetchKommentare() {
  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + filters.tage);
    const von = today.toISOString().slice(0, 10);
    const bis = endDate.toISOString().slice(0, 10);
    const { data } = await api.get(`/api/dispo-kommentare?von=${von}&bis=${bis}`);
    kommentare.value = data || [];
  } catch (err) {
    console.error('Kommentare laden fehlgeschlagen:', err);
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
  filters.planungFilter = null;
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

let _tooltipRafId = null;
function onCellMouseMove(ma, day, event) {
  const x = event.clientX;
  const y = event.clientY;
  if (_tooltipRafId) return; // skip until next frame
  _tooltipRafId = requestAnimationFrame(() => {
    _tooltipRafId = null;
    const cellComments = getCellComments(ma._id, day.iso);
    const text = cellComments.length ? null : getCellTooltip(ma._id, day.iso);
    cellTooltipState.value = {
      visible: !!(cellComments.length || text),
      text: text || '',
      comments: cellComments,
      x,
      y,
    };
  });
}

function onCellMouseLeave() {
  hoveredCell.value = null;
  cellTooltipState.value = { ...cellTooltipState.value, visible: false };
}

function onBereichHeaderClick(event) {
  bereichMenuPos.value = { x: event.clientX, y: event.clientY + 8 };
  bereichMenuOpen.value = true;
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

// ─── Chat Modal Actions ───
async function openChatModal(ma, day) {
  closeCtxMenu();
  chatModal.ma = ma;
  chatModal.day = day.iso;
  chatModal.comments = getCellComments(ma._id, day.iso);
  chatModal.newText = '';
  chatModal.open = true;
  // mark all current comments in this cell as read
  const unread = chatModal.comments
    .filter((c) => !c.readBy?.map(String).includes(String(auth.user?._id)))
    .map((c) => c._id);
  if (unread.length) {
    try {
      await api.post('/api/dispo-kommentare/mark-read', { ids: unread });
      const unreadSet = new Set(unread.map(String));
      const uid = String(auth.user?._id);
      kommentare.value = kommentare.value.map((c) => {
        if (!unreadSet.has(String(c._id))) return c;
        return { ...c, readBy: [...(c.readBy || []), uid] };
      });
      chatModal.comments = getCellComments(ma._id, day.iso);
    } catch (_) { /* silent */ }
  }
  // scroll thread to bottom
  nextTick(() => {
    if (chatThreadRef.value) chatThreadRef.value.scrollTop = chatThreadRef.value.scrollHeight;
  });
}

function closeChatModal() {
  chatModal.open = false;
  chatModal.ma = null;
  chatModal.day = null;
  chatModal.comments = [];
  chatModal.newText = '';
}

async function postComment() {
  const text = chatModal.newText.trim();
  if (!text || chatModal.loading) return;
  chatModal.loading = true;
  try {
    const { data } = await api.post('/api/dispo-kommentare', {
      mitarbeiterId: chatModal.ma._id,
      datum: chatModal.day,
      text,
    });
    chatModal.newText = '';
    kommentare.value = [...kommentare.value, data];
    chatModal.comments = getCellComments(chatModal.ma._id, chatModal.day);
    nextTick(() => {
      if (chatThreadRef.value) chatThreadRef.value.scrollTop = chatThreadRef.value.scrollHeight;
    });
  } catch (err) {
    console.error('Kommentar senden fehlgeschlagen:', err);
  } finally {
    chatModal.loading = false;
  }
}

async function deleteKommentar(id) {
  try {
    await api.delete(`/api/dispo-kommentare/${id}`);
    kommentare.value = kommentare.value.filter((c) => String(c._id) !== String(id));
    chatModal.comments = getCellComments(chatModal.ma._id, chatModal.day);
  } catch (err) {
    console.error('Kommentar löschen fehlgeschlagen:', err);
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
  padding: 0.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
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

.help-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  font-size: 1.1rem;
  padding: 6px 10px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
}

.help-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.help-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.help-modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.help-section {
  h4 {
    margin: 0 0 6px;
    font-size: 0.95rem;
    color: var(--text);
  }

  p {
    margin: 0 0 4px;
    font-size: 0.88rem;
    color: var(--muted);
    line-height: 1.5;
  }

  kbd {
    display: inline-block;
    padding: 1px 6px;
    font-size: 0.8rem;
    font-family: inherit;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
  }
}

.help-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
}

.help-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-available { background: #10b98140; border: 1px solid #10b981; }
.legend-partially { background: #f59e0b40; border: 1px solid #f59e0b; }
.legend-blocked   { background: #ef444440; border: 1px solid #ef4444; }
.legend-planned   { background: #6366f140; border: 1px solid #6366f1; }

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

  .dispo-table thead th {
    position: sticky;
    top: 0;
    z-index: 3;
    background: var(--panel);
  }
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
    padding: 6px 8px;
    text-align: center;
    overflow: hidden;
    cursor: pointer;

    .th-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      line-height: 1.2;
    }

    &.bereich-filter-active {
      color: var(--primary);
      box-shadow: inset 0 -2px 0 var(--primary);
    }

    .bereich-filter-icon {
      font-size: 9px;
      opacity: 0.45;
      margin-left: 2px;
      vertical-align: middle;
    }

    &:hover .bereich-filter-icon {
      opacity: 0.8;
    }

    .bereich-filter-label {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      color: var(--primary);
      background: rgba(238, 175, 103, 0.15);
      border-radius: 3px;
      padding: 0 3px;
      margin-left: 3px;
    }

    .bereich-filter-clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: var(--primary);
      margin-left: 2px;
      cursor: pointer;
      opacity: 0.8;
      &:hover { opacity: 1; }
    }
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
    cursor: pointer;
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

.tl-inline-badge {
  flex-shrink: 0;
  font-size: 9px;
  padding: 1px 4px;
}

.tl-corner-badge {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 0 0 6px 0;
  z-index: 1;
}

.tl-corner-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  line-height: 0;

  :deep(.tl-badge) {
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 0 0 6px 0;
  }
}

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
  justify-content: space-between;
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

.comment-bubble {
  position: absolute;
  top: 2px;
  right: 3px;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  pointer-events: none;

  .comment-bubble-icon {
    font-size: 10px;
    color: var(--primary);
    opacity: 0.85;
    filter: drop-shadow(0 0 3px rgba(238,175,103,0.4));
  }

  .comment-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 13px;
    height: 13px;
    background: #ef4444;
    color: white;
    border-radius: 99px;
    font-size: 8px;
    font-weight: 700;
    padding: 0 3px;
    line-height: 1;
  }
}

.dispo-cell-tooltip--comments {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 220px;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}

.tooltip-comment {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &:not(:last-child) {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .tooltip-comment-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .tooltip-comment-author {
    font-size: 10px;
    font-weight: 700;
    color: var(--primary);
  }

  .tooltip-comment-time {
    font-size: 10px;
    color: var(--muted);
  }

  .tooltip-comment-text {
    font-size: 12px;
    color: var(--text);
    margin: 0;
    white-space: pre-wrap;
  }
}

// ─── Chat Modal ───
.chat-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
}

.chat-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .chat-modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);

    svg { color: var(--primary); }
  }
}

.chat-thread {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
  max-height: 360px;
}

.chat-empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  margin: 0;
  padding: 16px 0;
}

.chat-message {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 88%;
  align-self: flex-start;

  &--own {
    align-self: flex-end;

    .chat-message-meta {
      flex-direction: row-reverse;
    }

    .chat-message-text {
      background: rgba(238,175,103,0.18);
      border-color: var(--primary);
    }
  }

  .chat-message-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--muted);
  }

  .chat-message-author {
    font-weight: 700;
    color: var(--primary);
  }

  .chat-message-time {
    color: var(--muted);
  }

  .chat-delete-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 10px;
    padding: 0 2px;
    opacity: 0.6;
    &:hover { color: #ef4444; opacity: 1; }
  }

  .chat-message-text {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 10px;
    font-size: 13px;
    color: var(--text);
    white-space: pre-wrap;
    margin: 0;
    line-height: 1.4;
  }
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;

  .chat-textarea {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text);
    background: var(--bg);
    resize: none;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    line-height: 1.4;

    &:focus { border-color: var(--primary); }
  }

  .chat-send-btn {
    flex-shrink: 0;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: opacity 0.15s;

    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:hover:not(:disabled) { opacity: 0.85; }
  }
}

.ctx-unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  background: #ef4444;
  color: white;
  border-radius: 99px;
  font-size: 9px;
  font-weight: 700;
  padding: 0 4px;
  margin-left: auto;
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
  &.active              { color: var(--primary); font-weight: 600; }
  &.ctx-item-remove     { color: var(--muted); border-top: 1px solid var(--border); margin-top: 2px; padding-top: 6px; }
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

// ─── Shared Modal ───
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
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
