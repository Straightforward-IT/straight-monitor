<template>
  <div class="ma-search" ref="container">

    <!-- Single-select: ausgewählter Chip -->
    <div v-if="!multiple && selected" class="ma-search__chips">
      <span class="ma-chip ma-chip--single" @click="clearSingle">
        <span v-if="selected.personalnr" class="ma-chip__nr">{{ selected.personalnr }}</span>
        {{ selected.vorname }} {{ selected.nachname }}
        <font-awesome-icon :icon="['fas', 'times']" class="ma-chip__x" />
      </span>
    </div>

    <!-- Multi-select: Chips der ausgewählten MA -->
    <div v-if="multiple && selectedList.length" class="ma-search__chips">
      <span
        v-for="ma in selectedList"
        :key="ma._id"
        class="ma-chip"
        @click="deselect(ma)"
      >
        {{ ma.vorname }} {{ ma.nachname }}
        <font-awesome-icon :icon="['fas', 'times']" class="ma-chip__x" />
      </span>
    </div>

    <!-- Eingabefeld (immer sichtbar bei multi, versteckt bei single wenn ausgewählt) -->
    <div v-if="multiple || !selected" class="ma-search__input-wrap">
      <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="ma-search__icon" />
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        :placeholder="placeholder"
        class="ma-search__input"
        autocomplete="off"
        @input="onInput"
        @keydown.down.prevent="moveDown"
        @keydown.up.prevent="moveUp"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="close"
        @focus="showDropdown = results.length > 0"
      />
      <span v-if="loading" class="ma-search__spinner" />
    </div>

    <!-- Dropdown -->
    <ul v-if="showDropdown && results.length" class="ma-search__dropdown">
      <li
        v-for="(ma, i) in results"
        :key="ma._id"
        :class="['ma-search__item', {
          'ma-search__item--active': i === highlighted,
          'ma-search__item--selected': isSelected(ma),
        }]"
        @mousedown.prevent="select(ma)"
        @mouseover="highlighted = i"
      >
        <font-awesome-icon v-if="isSelected(ma)" :icon="['fas', 'check']" class="ma-search__check" />
        <span class="ma-search__item-name">
          <span v-if="ma.personalnr" class="ma-search__nr">{{ ma.personalnr }}</span>
          {{ ma.vorname }} {{ ma.nachname }}
        </span>
        <span v-if="ma.email" class="ma-search__email">{{ ma.email }}</span>
      </li>
    </ul>

    <p v-if="showDropdown && !results.length && !loading && query.length >= 2" class="ma-search__empty">
      Keine Treffer
    </p>

  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';

const props = defineProps({
  /**
   * Single mode:  modelValue = String (_id) | null
   * Multi mode:   modelValue = Array<Object>  (full MA objects)
   */
  modelValue:  { default: null },
  multiple:    { type: Boolean, default: false },
  label:       { type: String,  default: '' },
  placeholder: { type: String,  default: 'Mitarbeiter suchen (Name, Nr.)…' },
});
const emit = defineEmits(['update:modelValue', 'select']);

// ── State ──────────────────────────────────────────────────────────────────
const query       = ref('');
const results     = ref([]);
const selected    = ref(null);   // single mode — full object
const selectedList= ref([]);     // multi mode  — array of full objects
const loading     = ref(false);
const showDropdown= ref(false);
const highlighted = ref(0);
const container   = ref(null);
let debounceTimer = null;

// ── Search ─────────────────────────────────────────────────────────────────
function onInput() {
  clearTimeout(debounceTimer);
  if (query.value.length < 2) { results.value = []; showDropdown.value = false; return; }
  loading.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      const { data } = await api.get('/api/personal/search', { params: { q: query.value } });
      results.value = data;
      highlighted.value = 0;
      showDropdown.value = data.length > 0;
    } catch { results.value = []; }
    finally { loading.value = false; }
  }, 280);
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

function close() { showDropdown.value = false; }

function moveDown() { if (highlighted.value < results.value.length - 1) highlighted.value++; }
function moveUp()   { if (highlighted.value > 0) highlighted.value--; }
function selectHighlighted() { if (results.value[highlighted.value]) select(results.value[highlighted.value]); }

// ── Click-outside ───────────────────────────────────────────────────────────
function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) close();
}
onMounted(()        => document.addEventListener('mousedown', onClickOutside));
onBeforeUnmount(()  => document.removeEventListener('mousedown', onClickOutside));

// ── External reset ──────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => {
  if (!val || (Array.isArray(val) && val.length === 0)) {
    selected.value = null;
    selectedList.value = [];
    query.value = '';
  }
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
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0 8px;
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
  flex: 1;
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
  position: absolute;
  top: calc(100% + 3px);
  left: 0; right: 0;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  z-index: 9999;
  list-style: none;
  margin: 0; padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;
}

.ma-search__item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12.5px;
  transition: background 0.1s;

  &--active   { background: var(--hover); }
  &--selected { color: var(--primary); }
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

.ma-search__empty {
  font-size: 11.5px;
  color: var(--muted);
  margin: 4px 0 0;
  padding: 0;
  opacity: 0.7;
}

@keyframes ma-spin { to { transform: rotate(360deg); } }
</style>
