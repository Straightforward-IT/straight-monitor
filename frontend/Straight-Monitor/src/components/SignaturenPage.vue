<template>
  <div class="window">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 data-page-title><font-awesome-icon :icon="['fas', 'file-signature']" /> Signaturen</h1>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: activeTab === tab.key }"
        type="button"
        @click="activeTab = tab.key"
      >
        <font-awesome-icon :icon="tab.icon" />
        {{ tab.label }}
      </button>
    </div>

    <!-- ───────────── TAB: SIGNATUREN ───────────── -->
    <template v-if="activeTab === 'signaturen'">
      <!-- Search + inline filter + count -->
      <Toolbar class="sig-toolbar">
        <ToolbarFilter v-model="filterExpanded" :active-count="activeFilterCount">
          <FilterGroup label="Standort">
            <FilterChip
              v-for="s in standortOptions"
              :key="s.key"
              :active="filters.standort === s.key"
              @click="toggleFilter('standort', s.key)"
            >{{ s.label }}</FilterChip>
          </FilterGroup>
          <FilterDivider />
          <FilterGroup label="Status">
            <FilterChip
              v-for="s in statusOptions"
              :key="s.key"
              :active="filters.status === s.key"
              @click="toggleFilter('status', s.key)"
            >{{ s.label }}</FilterChip>
          </FilterGroup>
          <FilterDivider />
          <FilterGroup label="Verknüpfung">
            <FilterChip :active="filters.entity === 'kunde'" @click="toggleFilter('entity', 'kunde')">Kunde</FilterChip>
            <FilterChip :active="filters.entity === 'mitarbeiter'" @click="toggleFilter('entity', 'mitarbeiter')">Mitarbeiter</FilterChip>
          </FilterGroup>
        </ToolbarFilter>
        <div class="sig-inner">
          <SearchBar v-model="search" placeholder="Suchen…" class="toolbar-search" />
          <ToolbarLabel>{{ filteredVorgaenge.length }} {{ filteredVorgaenge.length === 1 ? 'Eintrag' : 'Einträge' }}</ToolbarLabel>
          <ToolbarGroup push-right>
            <ToolbarButton variant="secondary" @click="openNewSignature">
              <font-awesome-icon :icon="['fas', 'plus']" /> Neue Signatur
            </ToolbarButton>
          </ToolbarGroup>
        </div>
      </Toolbar>

      <!-- Type pills -->
      <div class="type-pills">
        <FilterChip :active="filters.typKey === null" @click="filters.typKey = null">Alle</FilterChip>
        <FilterChip
          v-for="t in typen"
          :key="t._id"
          :active="filters.typKey === t.key"
          @click="filters.typKey = filters.typKey === t.key ? null : t.key"
        >{{ t.label }}</FilterChip>
        <button v-if="isAdmin" class="type-pill-add" type="button" title="Neuen Typ anlegen" @click="showTypModal = true">
          <font-awesome-icon :icon="['fas', 'plus']" />
        </button>
      </div>

      <!-- Grid -->
      <div v-if="loading" class="state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
        <p>Lade Signaturen…</p>
      </div>
      <div v-else-if="filteredVorgaenge.length === 0" class="state">
        <font-awesome-icon :icon="['fas', 'file-signature']" size="2x" />
        <p>Keine Signaturen gefunden.</p>
        <button class="btn-primary" type="button" @click="openNewSignature">
          <font-awesome-icon :icon="['fas', 'plus']" /> Neue Signatur
        </button>
      </div>
      <div v-else class="sig-grid">
        <SignaturCard
          v-for="v in filteredVorgaenge"
          :key="v._id"
          :vorgang="v"
          :starred="starred.includes(v._id)"
          @toggle-star="toggleStar"
          @cancelled="onCancelled"
          @refreshed="onRefreshed"
          @edit-draft="onEditDraft"
        />
      </div>
    </template>

    <!-- ───────────── TAB: TEMPLATES ───────────── -->
    <template v-else>
      <Toolbar>
        <SearchBar v-model="templateSearch" placeholder="Vorlage suchen…" class="toolbar-search" />
        <ToolbarGroup push-right>
          <ToolbarButton variant="secondary" @click="createTemplate">
            <font-awesome-icon :icon="['fas', 'plus']" /> Neue Vorlage
          </ToolbarButton>
        </ToolbarGroup>
      </Toolbar>

      <div v-if="templatesLoading" class="state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
        <p>Lade Vorlagen…</p>
      </div>
      <div v-else-if="filteredTemplates.length === 0" class="state">
        <font-awesome-icon :icon="['fas', 'file-lines']" size="2x" />
        <p>Keine Vorlagen vorhanden.</p>
        <button class="btn-primary" type="button" @click="createTemplate">
          <font-awesome-icon :icon="['fas', 'plus']" /> Neue Vorlage
        </button>
      </div>
      <div v-else class="template-grid">
        <div
          v-for="t in filteredTemplates"
          :key="t.id"
          class="template-card"
          @click="editTemplate(t)"
        >
          <div class="tc-icon"><font-awesome-icon :icon="['fas', 'file-lines']" /></div>
          <div class="tc-info">
            <template v-if="renamingId === t.id">
              <input
                ref="renameInput"
                v-model="renamingValue"
                class="tc-rename-input"
                type="text"
                @keydown.enter.prevent="confirmRename(t)"
                @keydown.esc.prevent="renamingId = null"
                @blur="confirmRename(t)"
                @click.stop
              />
            </template>
            <template v-else>
              <div class="tc-name">{{ t.name }}</div>
            </template>
            <div class="tc-meta">{{ (t.fields && t.fields.length) || 0 }} Felder · {{ formatDate(t.created_at) }}</div>
          </div>
          <!-- Context menu trigger -->
          <div class="tc-menu-wrap" @click.stop>
            <button class="tc-menu-btn" type="button" title="Optionen" @click.stop="toggleMenu(t.id, $event)">
              <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <SignaturTypAnlegenModal v-model="showTypModal" @created="onTypCreated" />

    <!-- Template context menu — teleported to body to escape overflow clipping -->
    <Teleport to="body">
      <transition name="ctx-fade">
        <div
          v-if="openMenuId !== null"
          class="tc-dropdown-portal"
          :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }"
          @click.stop
        >
          <template v-for="t in filteredTemplates" :key="t.id">
            <template v-if="openMenuId === t.id">
              <button type="button" @click="editTemplate(t); openMenuId = null">
                <font-awesome-icon :icon="['fas', 'pen-ruler']" /> Bearbeiten
              </button>
              <button type="button" @click="startRename(t); openMenuId = null">
                <font-awesome-icon :icon="['fas', 'pencil']" /> Umbenennen
              </button>
              <button type="button" @click="newSignatureFromTemplate(t); openMenuId = null">
                <font-awesome-icon :icon="['fas', 'file-signature']" /> Neue Signatur
              </button>
              <div class="tc-dropdown-divider" />
              <button type="button" class="tc-dropdown--danger" @click="archiveTemplate(t); openMenuId = null">
                <font-awesome-icon :icon="['fas', 'box-archive']" /> Archivieren
              </button>
            </template>
          </template>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faFileSignature, faPlus, faSpinner, faFileLines, faPenRuler, faListCheck, faBoxArchive, faEllipsisVertical, faPencil } from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useSignaturModal } from '@/stores/signaturModal';
import { useSignaturBuilder } from '@/stores/signaturBuilder';
import { useAuth } from '@/stores/auth';
import FilterGroup from '@/components/FilterGroup.vue';
import FilterDivider from '@/components/ui-elements/FilterDivider.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';
import ToolbarLabel from '@/components/ui-elements/ToolbarLabel.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import SignaturCard from '@/components/SignaturCard.vue';
import SignaturTypAnlegenModal from '@/components/SignaturTypAnlegenModal.vue';

library.add(faFileSignature, faPlus, faSpinner, faFileLines, faPenRuler, faListCheck, faBoxArchive, faEllipsisVertical, faPencil);

const modal = useSignaturModal();
const builder = useSignaturBuilder();
const auth = useAuth();

const isAdmin = computed(() => {
  const u = auth.user || {};
  return (Array.isArray(u.roles) && u.roles.includes('ADMIN')) || u.role === 'ADMIN';
});

const STAR_KEY = 'signatur_starred';

const tabs = [
  { key: 'signaturen', label: 'Signaturen', icon: ['fas', 'list-check'] },
  { key: 'templates',  label: 'Templates',  icon: ['fas', 'file-lines'] },
];
const activeTab = ref('signaturen');

const standortOptions = [
  { key: 'hamburg', label: 'Hamburg' },
  { key: 'berlin', label: 'Berlin' },
  { key: 'koeln', label: 'Köln' },
];
const statusOptions = [
  { key: 'draft', label: 'Entwurf' },
  { key: 'open', label: 'Offen' },
  { key: 'completed', label: 'Abgeschlossen' },
  { key: 'cancelled', label: 'Storniert' },
];

const vorgaenge = ref([]);
const typen = ref([]);
const loading = ref(false);
const search = ref('');
const filterExpanded = ref(false);
const showTypModal = ref(false);
const starred = ref(loadStarred());

const filters = ref({ standort: null, status: null, entity: null, typKey: null });

const activeFilterCount = computed(() =>
  ['standort', 'status', 'entity', 'typKey'].filter(k => filters.value[k] !== null).length
);

let eventSource = null;

// ── Templates tab ────────────────────────────────────────────────────────────
const templates = ref([]);
const templatesLoading = ref(false);
const templateSearch = ref('');
const filteredTemplates = computed(() => {
  const q = templateSearch.value.trim().toLowerCase();
  if (!q) return templates.value;
  return templates.value.filter(t => (t.name || '').toLowerCase().includes(q));
});

// ── Filtering ────────────────────────────────────────────────────────────────
const filteredVorgaenge = computed(() => {
  const q = search.value.trim().toLowerCase();
  let list = vorgaenge.value.filter(v => {
    if (filters.value.standort && v.standort !== filters.value.standort) return false;
    if (filters.value.status && v.status !== filters.value.status) return false;
    if (filters.value.typKey && v.typKey !== filters.value.typKey) return false;
    if (filters.value.entity === 'kunde' && !v.kunde) return false;
    if (filters.value.entity === 'mitarbeiter' && !v.mitarbeiter) return false;
    if (q) {
      const hay = [
        v.name, v.kundenKuerzel, v.mitarbeiterName, v.docusealTemplateName,
        ...(v.submitters || []).map(s => `${s.name} ${s.email}`),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  // Starred first, then newest
  return [...list].sort((a, b) => {
    const as = starred.value.includes(a._id) ? 0 : 1;
    const bs = starred.value.includes(b._id) ? 0 : 1;
    if (as !== bs) return as - bs;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
});

// ── Actions ──────────────────────────────────────────────────────────────────
function toggleFilter(key, value) {
  filters.value[key] = filters.value[key] === value ? null : value;
}

function openNewSignature() {
  modal.openModal({}, (vorgang) => {
    upsertVorgang(vorgang);
  });
}

function loadStarred() {
  try { return JSON.parse(localStorage.getItem(STAR_KEY) || '[]'); } catch { return []; }
}
function toggleStar(id) {
  const idx = starred.value.indexOf(id);
  if (idx === -1) starred.value.push(id);
  else starred.value.splice(idx, 1);
  localStorage.setItem(STAR_KEY, JSON.stringify(starred.value));
}

function upsertVorgang(v) {
  if (!v || !v._id) return;
  const idx = vorgaenge.value.findIndex(x => x._id === v._id);
  if (idx !== -1) vorgaenge.value[idx] = v;
  else vorgaenge.value.unshift(v);
}

function onCancelled(id) {
  const idx = vorgaenge.value.findIndex(x => x._id === id);
  if (idx !== -1) vorgaenge.value[idx] = { ...vorgaenge.value[idx], status: 'cancelled' };
}
function onRefreshed(v) { upsertVorgang(v); }

function onEditDraft(vorgang) {
  modal.openModal({ draftId: vorgang._id, draftData: vorgang }, (updated) => {
    upsertVorgang(updated);
  });
}

function onTypCreated(typ) {
  typen.value = [...typen.value, typ].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Templates ────────────────────────────────────────────────────────────────
const openMenuId = ref(null);
const menuPos = ref({ top: 0, left: 0 });
const renamingId = ref(null);
const renamingValue = ref('');
const renameInput = ref(null);
let menuBtnEl = null;

function updateMenuPos() {
  if (!menuBtnEl) return;
  const rect = menuBtnEl.getBoundingClientRect();
  menuPos.value = { top: rect.bottom + 6, left: rect.right - 210 };
}

function toggleMenu(id, event) {
  if (openMenuId.value === id) {
    openMenuId.value = null;
    menuBtnEl = null;
    return;
  }
  menuBtnEl = event.currentTarget;
  updateMenuPos();
  openMenuId.value = id;
}

function closeMenuOnOutsideClick(e) {
  if (!e.target.closest('.tc-menu-wrap') && !e.target.closest('.tc-dropdown-portal')) {
    openMenuId.value = null;
    menuBtnEl = null;
  }
}

async function startRename(t) {
  renamingId.value = t.id;
  renamingValue.value = t.name;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

async function confirmRename(t) {
  const newName = renamingValue.value.trim();
  renamingId.value = null;
  if (!newName || newName === t.name) return;
  try {
    await api.patch(`/api/docuseal/templates/${t.id}`, { name: newName });
    const idx = templates.value.findIndex(x => x.id === t.id);
    if (idx !== -1) templates.value[idx] = { ...templates.value[idx], name: newName };
  } catch (e) {
    alert('Umbenennen fehlgeschlagen: ' + (e?.response?.data?.message || e.message));
  }
}

function createTemplate() {
  builder.openBuilder({}, () => loadTemplates());
}
function editTemplate(t) {
  builder.openBuilder({ templateId: t.id, name: t.name }, () => loadTemplates());
}
function newSignatureFromTemplate(t) {
  modal.openModal({ templateId: t.id, templateName: t.name }, (vorgang) => {
    upsertVorgang(vorgang);
    activeTab.value = 'signaturen';
  });
}
async function archiveTemplate(t) {
  if (!confirm(`Vorlage "${t.name}" archivieren? Sie wird aus der Liste entfernt.`)) return;
  try {
    await api.delete(`/api/docuseal/templates/${t.id}`);
    templates.value = templates.value.filter(x => x.id !== t.id);
  } catch (e) {
    alert('Archivieren fehlgeschlagen: ' + (e?.response?.data?.message || e.message));
  }
}

async function loadTemplates() {
  templatesLoading.value = true;
  try {
    const { data } = await api.get('/api/docuseal/templates');
    templates.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Vorlagen laden fehlgeschlagen', e);
  } finally {
    templatesLoading.value = false;
  }
}

// ── Loading ──────────────────────────────────────────────────────────────────
async function loadVorgaenge() {
  loading.value = true;
  try {
    const { data } = await api.get('/api/signaturen?refresh=true');
    vorgaenge.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Signaturen laden fehlgeschlagen', e);
    vorgaenge.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadTypen() {
  try {
    const { data } = await api.get('/api/signatur-typen');
    typen.value = (Array.isArray(data) ? data : []).sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (e) {
    console.error('Typen laden fehlgeschlagen', e);
  }
}

function connectSSE() {
  const token = localStorage.getItem('token');
  if (!token) return;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  eventSource = new EventSource(`${base}/api/signaturen/events?token=${encodeURIComponent(token)}`);
  eventSource.onmessage = (e) => {
    try {
      const { type, payload } = JSON.parse(e.data);
      if ((type === 'vorgang.updated' || type === 'vorgang.created') && payload?._id) {
        upsertVorgang(payload);
      }
    } catch (_) { /* ignore */ }
  };
}

watch(activeTab, (tab) => {
  if (tab === 'templates' && templates.value.length === 0) loadTemplates();
});

onMounted(() => {
  loadVorgaenge();
  loadTypen();
  connectSSE();
  window.addEventListener('click', closeMenuOnOutsideClick);
  window.addEventListener('scroll', updateMenuPos, true);
});
onUnmounted(() => {
  if (eventSource) eventSource.close();
  window.removeEventListener('click', closeMenuOnOutsideClick);
  window.removeEventListener('scroll', updateMenuPos, true);
});
</script>

<style scoped lang="scss">
.window {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  h1 {
    font-size: 1.4rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: none;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  &:hover { background: color-mix(in srgb, var(--primary) 88%, #000); }
}

.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 18px;
}
.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  margin-bottom: -1px;
  &:hover { color: var(--text); }
  &.active { color: var(--primary); border-bottom-color: var(--primary); }
}


.type-pills {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
}
.type-pill-add {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1.5px dashed var(--border);
  background: none;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { border-color: var(--primary); color: var(--primary); }
}

.sig-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sig-toolbar {
  overflow: visible;
}

.sig-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 60px 20px;
  color: var(--muted);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.template-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--tile-bg, var(--surface));
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:hover { border-color: var(--primary); box-shadow: 0 4px 14px rgba(0,0,0,0.07); }

  .tc-icon {
    width: 42px; height: 42px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary); font-size: 1.1rem; flex-shrink: 0;
  }
  .tc-info { flex: 1; min-width: 0; }
  .tc-name { font-size: 0.9rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tc-rename-input {
    width: 100%; font-size: 0.9rem; font-weight: 600; color: var(--text);
    background: none; border: none; border-bottom: 1.5px solid var(--primary);
    outline: none; padding: 0; line-height: 1.3;
  }
  .tc-meta { font-size: 0.74rem; color: var(--muted); }

  .tc-menu-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .tc-menu-btn {
    background: none; border: 1px solid var(--border); border-radius: 8px;
    width: 34px; height: 34px; color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    &:hover { border-color: var(--primary); color: var(--primary); }
  }
  .tc-edit, .tc-archive {
    background: none; border: 1px solid var(--border); border-radius: 8px;
    width: 34px; height: 34px; color: var(--muted); cursor: pointer; flex-shrink: 0;
    &:hover { border-color: var(--primary); color: var(--primary); }
  }
  .tc-archive:hover { border-color: #dc3545 !important; color: #dc3545 !important; }
}

.ctx-fade-enter-active, .ctx-fade-leave-active { transition: opacity 0.12s, transform 0.12s; }
.ctx-fade-enter-from, .ctx-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>

<style lang="scss">
/* Unscoped — portal dropdown is rendered at body level */
.tc-dropdown-portal {
  position: fixed;
  z-index: 9999;
  min-width: 210px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #a4a4a470);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.14);
  padding: 4px;

  button {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 9px 12px;
    background: none;
    border: none;
    border-radius: 7px;
    font-size: 0.85rem;
    font-weight: 300;
    color: var(--text, #222);
    cursor: pointer;
    text-align: left;
    &:hover { background: color-mix(in srgb, var(--primary, #eeaf67) 10%, transparent); color: var(--primary, #eeaf67); }
  }
  .tc-dropdown--danger {
    color: #dc3545;
    &:hover { background: color-mix(in srgb, #dc3545 10%, transparent) !important; color: #dc3545 !important; }
  }
  .tc-dropdown-divider {
    height: 1px;
    background: var(--border, #a4a4a470);
    margin: 4px 8px;
  }
}
</style>
