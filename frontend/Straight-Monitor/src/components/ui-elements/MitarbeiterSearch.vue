<template>
  <div
    ref="container"
    class="ma-search"
    :style="{ 'anchor-name': dropdownAnchorName }"
  >
    <div v-if="!multiple && selected" class="ma-search__chips">
      <button type="button" class="ma-chip ma-chip--single" @click="clearSingle">
        <span v-if="selected.personalnr" class="ma-chip__nr">{{ selected.personalnr }}</span>
        {{ selected.vorname }} {{ selected.nachname }}
        <font-awesome-icon :icon="['fas', 'times']" class="ma-chip__x" />
      </button>
    </div>

    <div v-if="multiple || !selected" class="ma-search__input-wrap">
      <font-awesome-icon
        v-if="!activeFilters.length && !(multiple && selectedList.length)"
        :icon="['fas', 'magnifying-glass']"
        class="ma-search__icon"
      />
      <button
        v-for="filter in activeFilters"
        :key="filter.key"
        type="button"
        class="ma-filter-pill"
        :aria-label="`${filter.label} entfernen`"
        @click="removeFilter(filter)"
      >
        <span class="ma-filter-pill__category">{{ filter.categoryLabel }}</span>
        <span class="ma-filter-pill__label">{{ filter.label }}</span>
        <font-awesome-icon :icon="['fas', 'times']" />
      </button>
      <button
        v-for="ma in multiple ? selectedList : []"
        :key="ma._id"
        type="button"
        class="ma-chip"
        :aria-label="`${ma.vorname} ${ma.nachname} entfernen`"
        @click="deselect(ma)"
      >
        {{ ma.vorname }} {{ ma.nachname }}
        <font-awesome-icon :icon="['fas', 'times']" class="ma-chip__x" />
      </button>
      <input
        ref="inputEl"
        v-model="query"
        type="search"
        :placeholder="placeholder"
        class="ma-search__input"
        autocomplete="off"
        @input="onInput"
        @keydown.down.prevent="moveDown"
        @keydown.up.prevent="moveUp"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="close"
        @keydown.backspace="removeLastFilter"
        @focus="openSuggestions"
      />
      <span v-if="loading" class="ma-search__spinner" />
    </div>

    <Teleport to="body">
      <ul
        v-if="showDropdown && suggestions.length"
        :class="['ma-search__dropdown', { 'ma-search__dropdown--dropup': dropup }]"
        :style="dropdownStyle"
        role="listbox"
      >
        <li
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.key"
          :class="['ma-search__item', {
            'ma-search__item--active': index === highlighted,
            'ma-search__item--selected': suggestion.type === 'employee' && isSelected(suggestion.employee),
            'ma-search__item--filter': suggestion.type === 'filter',
          }]"
          role="option"
          @mousedown.prevent="selectSuggestion(suggestion)"
          @mouseover="highlighted = index"
        >
          <span class="ma-search__category">{{ suggestion.categoryLabel }}</span>
          <template v-if="suggestion.type === 'filter'">
            <span class="ma-search__item-name">{{ suggestion.label }}</span>
            <span v-if="suggestion.code" class="ma-search__code">{{ suggestion.code }}</span>
            <font-awesome-icon icon="fa-solid fa-plus" class="ma-search__add" />
          </template>
          <template v-else>
            <font-awesome-icon v-if="isSelected(suggestion.employee)" :icon="['fas', 'check']" class="ma-search__check" />
            <span class="ma-search__item-name">
              <span v-if="suggestion.employee.personalnr" class="ma-search__nr">{{ suggestion.employee.personalnr }}</span>
              {{ suggestion.employee.vorname }} {{ suggestion.employee.nachname }}
            </span>
            <span v-if="suggestion.employee.email" class="ma-search__email">{{ suggestion.employee.email }}</span>
          </template>
        </li>
      </ul>

      <p
        v-if="showDropdown && !suggestions.length && !loading && query.trim().length"
        class="ma-search__empty"
        :style="dropdownStyle"
      >
        Keine Treffer
      </p>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import { useToolbarLocationContext } from '@/composables/useToolbarLocationContext';
import { useDataCache } from '@/stores/dataCache';

const PERSGRUPPEN = [
  { value: 101, label: 'Festangestellt', aliases: 'festi fest festanstellung' },
  { value: 110, label: 'Kurzfristig angestellt', aliases: 'kzf kurzfristige beschäftigung' },
  { value: 109, label: 'Geringfügig angestellt', aliases: 'minijob mini geringfügig 603 euro' },
  { value: 106, label: 'Werkstudent', aliases: 'werkst student studium' },
];
const ARBEITSVERHAELTNISSE = [
  { value: 0, label: 'Vollzeit', aliases: 'voll zeit fulltime' },
  { value: 1, label: 'Teilzeit', aliases: 'teil zeit parttime' },
  { value: 2, label: 'Geringfügig beschäftigt', aliases: 'minijob mini 603 euro' },
  { value: 3, label: 'Kurzfristig beschäftigt', aliases: 'kzf kurzfristige beschäftigung' },
];
const BEWERBER_STATUS = [
  { value: true, label: 'Bewerber', aliases: 'bewerbung applicant kandidat' },
  { value: false, label: 'Mitarbeiter (keine Bewerber)', aliases: 'angestellt beschäftigt kein bewerber' },
];
const AKTIV_STATUS = [
  { value: true, label: 'Aktiv', aliases: 'aktiv beschäftigt angestellt' },
  { value: false, label: 'Inaktiv', aliases: 'inaktiv ausgeschieden deaktiviert' },
];
const FILTER_CATEGORIES = Object.freeze({
  standorte: { label: 'Standort', priority: 1, multiple: true },
  aktivstatus: { label: 'Aktivstatus', priority: 2, multiple: false },
  bewerber: { label: 'Bewerberstatus', priority: 3, multiple: false },
  berufe: { label: 'Beruf', priority: 4, multiple: true },
  arbeitsverhaeltnisse: { label: 'Arbeitsverhältnis', priority: 5, multiple: true },
  persgruppen: { label: 'Persgruppe', priority: 6, multiple: true },
  qualifikationen: { label: 'Qualifikation', priority: 7, multiple: true },
});

const props = defineProps({
  /**
   * Single mode:  modelValue = String (_id) | null
   * Multi mode:   modelValue = Array<Object>  (full MA objects)
   */
  modelValue:  { default: null },
  multiple:    { type: Boolean, default: false },
  label:       { type: String,  default: '' },
  placeholder: { type: String,  default: 'Mitarbeiter suchen (Name, Nr.)…' },
  dropup:      { type: Boolean, default: false },
  includeInactive: { type: Boolean, default: false },
  requirePersonalnr: { type: Boolean, default: false },
  preferActive: { type: Boolean, default: false },
  locationV2: { type: [String, Number], default: null },
  selectedItem: { type: Object, default: null },
  searchValue: { type: String, default: '' },
  filterValues: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'update:searchValue', 'select', 'filters-change']);
const toolbarLocation = useToolbarLocationContext();
const effectiveLocationV2 = computed(() => props.locationV2 || toolbarLocation?.locationV2?.value || null);
const dataCache = useDataCache();
const dropdownAnchorName = `--ma-search-${getCurrentInstance()?.uid}`;
const supportsAnchorPositioning = typeof CSS !== 'undefined'
  && CSS.supports('anchor-name: --ma-search')
  && CSS.supports('position-anchor: --ma-search')
  && CSS.supports('top: anchor(bottom)');

// ── State ──────────────────────────────────────────────────────────────────
const query       = ref('');
const results     = ref([]);
const selected    = ref(null);   // single mode — full object
const selectedList= ref([]);     // multi mode  — array of full objects
const activeFilters = ref([]);
const locations = ref([]);
const loading     = ref(false);
const showDropdown= ref(false);
const highlighted = ref(0);
const container      = ref(null);
const inputEl        = ref(null);
const dropdownStyle  = ref({});
let debounceTimer    = null;
let requestId        = 0;

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('de-DE');

function createFilter(category, item, code = '') {
  const config = FILTER_CATEGORIES[category];
  const label = item.designation || item.label || item.nameFull || item.shortName;
  return {
    type: 'filter',
    key: `${category}:${item._id ?? item.value}`,
    category,
    categoryLabel: config.label,
    priority: config.priority,
    label,
    value: String(item._id ?? item.value),
    code: code ? String(code) : '',
    searchText: normalize(`${config.label} ${label} ${item.shortName || ''} ${item.address?.city || ''} ${item.aliases || ''} ${code}`),
  };
}

const filterCatalog = computed(() => [
  ...locations.value.map((item) => createFilter('standorte', item, item.shortName)),
  ...AKTIV_STATUS.map((item) => createFilter('aktivstatus', item)),
  ...BEWERBER_STATUS.map((item) => createFilter('bewerber', item)),
  ...dataCache.berufe.map((item) => createFilter('berufe', item, item.jobKey)),
  ...ARBEITSVERHAELTNISSE.map((item) => createFilter('arbeitsverhaeltnisse', item)),
  ...PERSGRUPPEN.map((item) => createFilter('persgruppen', item)),
  ...dataCache.qualifikationen.map((item) => createFilter('qualifikationen', item, item.qualificationKey)),
].sort((first, second) => first.priority - second.priority || first.label.localeCompare(second.label, 'de')));

const filterSuggestions = computed(() => {
  const terms = normalize(query.value).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const selectedKeys = new Set(activeFilters.value.map((filter) => filter.key));
  return filterCatalog.value
    .filter((filter) => !selectedKeys.has(filter.key) && terms.every((term) => filter.searchText.includes(term)))
    .slice(0, 10);
});

const suggestions = computed(() => [
  ...filterSuggestions.value,
  ...results.value.map((employee) => ({
    type: 'employee',
    key: `employee:${employee._id}`,
    categoryLabel: 'Mitarbeiter',
    employee,
  })),
]);

function sortResults(list) {
  if (!effectiveLocationV2.value) return list;
  return [...list].sort((first, second) => {
    const firstIsLocal = String(first.locationV2?._id || first.locationV2 || '') === String(effectiveLocationV2.value);
    const secondIsLocal = String(second.locationV2?._id || second.locationV2 || '') === String(effectiveLocationV2.value);
    return Number(secondIsLocal) - Number(firstIsLocal);
  });
}

function updateDropdownPosition() {
  if (!container.value) return;
  if (supportsAnchorPositioning) {
    dropdownStyle.value = {
      position: 'fixed',
      positionAnchor: dropdownAnchorName,
      top: props.dropup ? 'auto' : 'calc(anchor(bottom) + 3px)',
      bottom: props.dropup ? 'calc(100dvh - anchor(top) + 3px)' : 'auto',
      left: 'anchor(left)',
      width: 'anchor-size(width)',
    };
    return;
  }
  const rect = container.value.getBoundingClientRect();
  if (props.dropup) {
    dropdownStyle.value = {
      position: 'fixed',
      bottom: `${window.innerHeight - rect.top + 3}px`,
      top: 'auto',
      left:  `${rect.left}px`,
      width: `${rect.width}px`,
    };
  } else {
    dropdownStyle.value = {
      position: 'fixed',
      top:   `${rect.bottom + 3}px`,
      left:  `${rect.left}px`,
      width: `${rect.width}px`,
    };
  }
}

// ── Search ─────────────────────────────────────────────────────────────────
function filterParams() {
  const values = (category) => activeFilters.value
    .filter((filter) => filter.category === category)
    .map((filter) => filter.value);
  const singleValue = (category) => activeFilters.value.find((filter) => filter.category === category)?.value ?? '';
  return {
    berufe: values('berufe').join(','),
    qualifikationen: values('qualifikationen').join(','),
    persgruppen: values('persgruppen').join(','),
    arbeitsverhaeltnisse: values('arbeitsverhaeltnisse').join(','),
    standorte: values('standorte').join(','),
    isActive: singleValue('aktivstatus'),
    bewerber: singleValue('bewerber'),
  };
}

async function fetchResults() {
  const currentRequest = ++requestId;
  const hasFilters = activeFilters.value.length > 0;
  const hasQuery = query.value.trim().length > 0;
  if (query.value.trim().length < 2 && !hasFilters) {
    results.value = [];
    loading.value = false;
    showDropdown.value = hasQuery && filterSuggestions.value.length > 0;
    return;
  }
  loading.value = true;
  try {
    const { data } = await api.get('/api/personal/search', { params: {
      q: query.value.trim(),
      includeInactive: props.includeInactive,
      requirePersonalnr: props.requirePersonalnr,
      preferActive: props.preferActive,
      ...filterParams(),
    } });
    if (currentRequest !== requestId) return;
    results.value = sortResults(data || []);
    highlighted.value = 0;
    updateDropdownPosition();
    showDropdown.value = hasQuery && suggestions.value.length > 0;
  } catch {
    if (currentRequest === requestId) results.value = [];
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

function onInput() {
  clearTimeout(debounceTimer);
  requestId++;
  updateDropdownPosition();
  showDropdown.value = query.value.trim().length > 0 && filterSuggestions.value.length > 0;
  debounceTimer = setTimeout(fetchResults, 280);
}

// ── Selection ───────────────────────────────────────────────────────────────
function isSelected(ma) {
  if (props.multiple) return selectedList.value.some(m => m._id === ma._id);
  return selected.value?._id === ma._id;
}

function select(ma) {
  if (props.multiple) {
    const idx = selectedList.value.findIndex(m => m._id === ma._id);
    if (idx === -1) selectedList.value.push(ma);
    else            selectedList.value.splice(idx, 1);
    emit('update:modelValue', [...selectedList.value]);
    emit('select', [...selectedList.value]);
    // keep dropdown open for multi
    query.value = '';
    results.value = [];
    showDropdown.value = false;
  } else {
    selected.value = ma;
    query.value = '';
    showDropdown.value = false;
    emit('update:modelValue', ma._id);
    emit('select', ma);
  }
}

function deselect(ma) {
  selectedList.value = selectedList.value.filter(m => m._id !== ma._id);
  emit('update:modelValue', [...selectedList.value]);
  emit('select', [...selectedList.value]);
}

function clearSingle() {
  selected.value = null;
  emit('update:modelValue', null);
  emit('select', null);
}

function addFilter(filter) {
  if (!FILTER_CATEGORIES[filter.category]?.multiple) {
    activeFilters.value = activeFilters.value.filter((item) => item.category !== filter.category);
  }
  if (!activeFilters.value.some((item) => item.key === filter.key)) activeFilters.value.push(filter);
  query.value = '';
  results.value = [];
  emit('filters-change', activeFilters.value.map(({ category, label, value }) => ({ category, label, value })));
  fetchResults();
  inputEl.value?.focus();
}

function removeFilter(filter) {
  activeFilters.value = activeFilters.value.filter((item) => item.key !== filter.key);
  emit('filters-change', activeFilters.value.map(({ category, label, value }) => ({ category, label, value })));
  fetchResults();
  inputEl.value?.focus();
}

function removeLastFilter(event) {
  if (query.value || !activeFilters.value.length) return;
  event.preventDefault();
  removeFilter(activeFilters.value[activeFilters.value.length - 1]);
}

function selectSuggestion(suggestion) {
  if (suggestion.type === 'filter') addFilter(suggestion);
  else select(suggestion.employee);
}

function openSuggestions() {
  updateDropdownPosition();
  if (!query.value.trim()) {
    showDropdown.value = false;
    return;
  }
  if (activeFilters.value.length) fetchResults();
  else showDropdown.value = suggestions.value.length > 0;
}

function close() { showDropdown.value = false; }

function moveDown() { if (highlighted.value < suggestions.value.length - 1) highlighted.value++; }
function moveUp()   { if (highlighted.value > 0) highlighted.value--; }
function selectHighlighted() { if (suggestions.value[highlighted.value]) selectSuggestion(suggestions.value[highlighted.value]); }

// ── Click-outside ───────────────────────────────────────────────────────────
function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) close();
}
onMounted(() => {
  Promise.allSettled([
    dataCache.loadBerufe(),
    dataCache.loadQualifikationen(),
    api.get('/api/locations').then(({ data }) => { locations.value = (data || []).filter((location) => location.isActive !== false); }),
  ]);
  document.addEventListener('mousedown', onClickOutside);
  if (!supportsAnchorPositioning) window.addEventListener('scroll', updateDropdownPosition, true);
  window.addEventListener('resize', updateDropdownPosition);
});
onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
  document.removeEventListener('mousedown', onClickOutside);
  if (!supportsAnchorPositioning) window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
});

// ── External reset ──────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => {
  if (!val || (Array.isArray(val) && val.length === 0)) {
    selected.value = null;
    selectedList.value = [];
    query.value = '';
  }
});

watch(() => props.selectedItem, (item) => {
  if (!props.multiple && item && String(item._id) === String(props.modelValue)) selected.value = item;
}, { immediate: true });

watch(() => props.searchValue, (value) => {
  if (value !== query.value) query.value = value;
}, { immediate: true });

watch(query, (value) => {
  if (value !== props.searchValue) emit('update:searchValue', value);
});

watch([() => props.filterValues, filterCatalog], ([values, catalog]) => {
  const selectedKeys = new Set(values.map(({ category, value }) => `${category}:${value}`));
  const nextFilters = catalog.filter((filter) => selectedKeys.has(filter.key));
  const currentKeys = activeFilters.value.map((filter) => filter.key).sort().join('|');
  const nextKeys = nextFilters.map((filter) => filter.key).sort().join('|');
  if (currentKeys !== nextKeys) activeFilters.value = nextFilters;
}, { immediate: true, deep: true });

watch(effectiveLocationV2, () => {
  results.value = sortResults(results.value);
  highlighted.value = 0;
});

defineExpose({
  clearFilters: () => {
    activeFilters.value = [];
    results.value = [];
    emit('filters-change', []);
  },
  focus: () => inputEl.value?.focus(),
});
</script>

<style scoped lang="scss">
.ma-search {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;

  // ── Chips row ──────────────────────────────────
  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}

.ma-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 1px solid var(--primary);
  border-radius: 6px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  font-family: inherit;

  &:hover { background: color-mix(in srgb, var(--primary) 15%, transparent); }
  &--single { cursor: pointer; } // redundant but explicit

  &__nr {
    font-size: 10px;
    opacity: 0.55;
    font-family: monospace;
    letter-spacing: 0.2px;
  }
  &__x { font-size: 9px; opacity: 0.65; }
}

// ── Input wrapper ────────────────────────────────
.ma-search__input-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  min-height: 34px;
  padding: 3px 8px;
  background: var(--tile-bg);
  transition: border-color 0.2s;

  &:focus-within { border-color: var(--primary); }
}

.ma-search__icon {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.ma-search__input {
  flex: 1 1 110px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 12.5px;
  padding: 6px 0;
  min-width: 0;
  font-family: inherit;

  &::placeholder { color: var(--muted); opacity: 0.6; }
}

.ma-filter-pill {
  display: inline-flex;
  min-width: 0;
  max-width: 220px;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 3px;
  border: 1px solid color-mix(in srgb, var(--primary) 70%, var(--border));
  border-radius: 5px;
  background: color-mix(in srgb, var(--primary) 9%, var(--tile-bg));
  color: var(--primary);
  cursor: pointer;
  font: inherit;
  font-size: 11px;

  &:hover { background: color-mix(in srgb, var(--primary) 16%, var(--tile-bg)); }

  &__category {
    padding: 1px 4px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--primary) 16%, transparent);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
  }

  &__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  svg { flex: 0 0 auto; font-size: 8px; }
}

.ma-search__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: ma-spin 0.6s linear infinite;
  flex-shrink: 0;
}

// ── Dropdown ─────────────────────────────────────
.ma-search__dropdown {
  position: fixed;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  z-index: 9999;
  list-style: none;
  margin: 0; padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;

  &--dropup {
    box-shadow: 0 -6px 20px rgba(0,0,0,0.12);
  }
}

.ma-search__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12.5px;
  transition: background 0.1s;

  &--active   { background: var(--hover); }
  &--selected { color: var(--primary); }
  &--filter { color: var(--text); }
}

.ma-search__category {
  flex: 0 0 88px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.2px;
  text-transform: uppercase;
}

.ma-search__check {
  font-size: 10px;
  color: var(--primary);
  flex-shrink: 0;
}

.ma-search__item-name { flex: 1; }

.ma-search__nr {
  font-size: 10px;
  opacity: 0.5;
  font-family: monospace;
  margin-right: 3px;
}

.ma-search__email {
  font-size: 10.5px;
  color: var(--muted);
  opacity: 0.65;
}

.ma-search__code {
  color: var(--muted);
  font-family: ui-monospace, monospace;
  font-size: 9.5px;
}

.ma-search__add {
  flex: 0 0 auto;
  color: var(--primary);
  font-size: 10px;
}

.ma-search__empty {
  font-size: 11.5px;
  color: var(--muted);
  margin: 4px 0 0;
  padding: 0;
  opacity: 0.7;
}

@keyframes ma-spin { to { transform: rotate(360deg); } }
</style>
