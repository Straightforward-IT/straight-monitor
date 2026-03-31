<template>
  <div class="kunde-search" ref="container">

    <!-- Single-select: ausgewählter Chip -->
    <div v-if="!multiple && selected" class="kunde-search__chips">
      <span class="kunde-chip kunde-chip--single" @click="clearSingle">
        <span v-if="selected.kundenNr" class="kunde-chip__nr">{{ selected.kundenNr }}</span>
        {{ selected.kundName }}
        <font-awesome-icon :icon="['fas', 'times']" class="kunde-chip__x" />
      </span>
    </div>

    <!-- Multi-select: Chips der ausgewählten Kunden -->
    <div v-if="multiple && selectedList.length" class="kunde-search__chips">
      <span
        v-for="k in selectedList"
        :key="k._id"
        class="kunde-chip"
        @click="deselect(k)"
      >
        {{ k.kundName }}
        <font-awesome-icon :icon="['fas', 'times']" class="kunde-chip__x" />
      </span>
    </div>

    <!-- Eingabefeld -->
    <div v-if="multiple || !selected" class="kunde-search__input-wrap">
      <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="kunde-search__icon" />
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        :placeholder="placeholder"
        class="kunde-search__input"
        autocomplete="off"
        @input="onInput"
        @keydown.down.prevent="moveDown"
        @keydown.up.prevent="moveUp"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="close"
        @focus="if (results.length > 0) { updateDropdownPosition(); showDropdown = true; }"
      />
      <span v-if="loading" class="kunde-search__spinner" />
    </div>

    <!-- Dropdown -->
    <ul v-if="showDropdown && results.length" :class="['kunde-search__dropdown', { 'kunde-search__dropdown--dropup': dropup }]" :style="dropdownStyle">
      <li
        v-for="(k, i) in results"
        :key="k._id"
        :class="['kunde-search__item', {
          'kunde-search__item--active': i === highlighted,
          'kunde-search__item--selected': isSelected(k),
        }]"
        @mousedown.prevent="select(k)"
        @mouseover="highlighted = i"
      >
        <font-awesome-icon v-if="isSelected(k)" :icon="['fas', 'check']" class="kunde-search__check" />
        <span class="kunde-search__item-name">
          <span v-if="k.kuerzel" class="kunde-search__kuerzel">{{ k.kuerzel }}</span>
          <span v-if="k.kundenNr" class="kunde-search__nr">{{ k.kundenNr }}</span>
          {{ k.kundName }}
        </span>
      </li>
    </ul>

    <p v-if="showDropdown && !results.length && !loading && query.length >= 2" class="kunde-search__empty">
      Keine Treffer
    </p>

  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';

const props = defineProps({
  modelValue:  { default: null },
  multiple:    { type: Boolean, default: false },
  placeholder: { type: String,  default: 'Kunde suchen (Name, Nr., Kürzel)…' },
  dropup:      { type: Boolean, default: false },
  standort:    { type: String,  default: null },
});
const emit = defineEmits(['update:modelValue', 'select']);

const query       = ref('');
const results     = ref([]);
const selected    = ref(null);
const selectedList= ref([]);
const loading     = ref(false);
const showDropdown= ref(false);
const highlighted = ref(0);
const container   = ref(null);
const inputEl     = ref(null);
const dropdownStyle = ref({});
let debounceTimer   = null;

function updateDropdownPosition() {
  if (!container.value) return;
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

function onInput() {
  clearTimeout(debounceTimer);
  if (query.value.length < 2) { results.value = []; showDropdown.value = false; return; }
  loading.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      const params = { q: query.value };
      if (props.standort) params.standort = props.standort;
      const { data } = await api.get('/api/kunden/search', { params });
      results.value = data;
      highlighted.value = 0;
      if (data.length > 0) {
        updateDropdownPosition();
        showDropdown.value = true;
      } else {
        showDropdown.value = false;
      }
    } catch { results.value = []; }
    finally { loading.value = false; }
  }, 280);
}

function isSelected(k) {
  if (props.multiple) return selectedList.value.some(s => s._id === k._id);
  return selected.value?._id === k._id;
}

function select(k) {
  if (props.multiple) {
    const idx = selectedList.value.findIndex(s => s._id === k._id);
    if (idx === -1) selectedList.value.push(k);
    else            selectedList.value.splice(idx, 1);
    emit('update:modelValue', [...selectedList.value]);
    emit('select', [...selectedList.value]);
    query.value = '';
    results.value = [];
    showDropdown.value = false;
  } else {
    selected.value = k;
    query.value = '';
    showDropdown.value = false;
    emit('update:modelValue', k._id);
    emit('select', k);
  }
}

function deselect(k) {
  selectedList.value = selectedList.value.filter(s => s._id !== k._id);
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

function focus() { inputEl.value?.focus(); }

function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) close();
}
onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
  window.addEventListener('scroll', updateDropdownPosition, true);
  window.addEventListener('resize', updateDropdownPosition);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
  window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
});

watch(() => props.modelValue, (val) => {
  if (!val || (Array.isArray(val) && val.length === 0)) {
    selected.value = null;
    selectedList.value = [];
    query.value = '';
  }
});

defineExpose({ focus, clearSingle });
</script>

<style scoped lang="scss">
.kunde-search {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}

.kunde-chip {
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

  &__nr {
    font-size: 10px;
    opacity: 0.55;
    font-family: monospace;
    letter-spacing: 0.2px;
  }
  &__x { font-size: 9px; opacity: 0.65; }
}

.kunde-search__input-wrap {
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

.kunde-search__icon {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.kunde-search__input {
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

.kunde-search__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: kunde-spin 0.6s linear infinite;
  flex-shrink: 0;
}

.kunde-search__dropdown {
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

.kunde-search__item {
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

.kunde-search__check {
  font-size: 10px;
  color: var(--primary);
  flex-shrink: 0;
}

.kunde-search__item-name { flex: 1; }

.kunde-search__kuerzel {
  font-size: 10px;
  font-weight: 600;
  color: var(--primary);
  margin-right: 4px;
}

.kunde-search__nr {
  font-size: 10px;
  opacity: 0.5;
  font-family: monospace;
  margin-right: 3px;
}

.kunde-search__empty {
  font-size: 11.5px;
  color: var(--muted);
  margin: 4px 0 0;
  padding: 0;
  opacity: 0.7;
}

@keyframes kunde-spin { to { transform: rotate(360deg); } }
</style>
