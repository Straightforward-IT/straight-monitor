<template>
  <div ref="container" class="ma-select" :style="{ 'anchor-name': dropdownAnchorName }">
    <button v-if="selected" type="button" class="ma-select__selected" @click="clear">
      <span v-if="selected.personalnr" class="ma-select__nr">{{ selected.personalnr }}</span>
      {{ formatName(selected) }}
      <font-awesome-icon :icon="['fas', 'times']" class="ma-select__clear" />
    </button>

    <div v-else class="ma-select__input-wrap">
      <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="ma-select__icon" />
      <input
        ref="inputEl"
        v-model="query"
        type="search"
        :placeholder="placeholder"
        class="ma-select__input"
        autocomplete="off"
        @input="onInput"
        @keydown.down.prevent="moveDown"
        @keydown.up.prevent="moveUp"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="close"
        @focus="openSuggestions"
      />
      <span v-if="loading" class="ma-select__spinner" />
    </div>

    <Teleport to="body">
      <ul v-if="showDropdown && results.length" :class="['ma-select__dropdown', { 'ma-select__dropdown--dropup': dropup }]" :style="dropdownStyle" role="listbox">
        <li
          v-for="(employee, index) in results"
          :key="employee._id"
          :class="['ma-select__item', { 'ma-select__item--active': index === highlighted }]"
          role="option"
          @mousedown.prevent="select(employee)"
          @mouseover="highlighted = index"
        >
          <span class="ma-select__name">
            <span v-if="employee.personalnr" class="ma-select__nr">{{ employee.personalnr }}</span>
            {{ formatName(employee) }}
          </span>
          <span v-if="employee.email" class="ma-select__email">{{ employee.email }}</span>
        </li>
      </ul>

      <p v-if="showDropdown && !results.length && !loading && query.trim()" class="ma-select__empty" :style="dropdownStyle">
        Keine Treffer
      </p>
    </Teleport>
  </div>
</template>

<script setup>
import { getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import { useMitarbeiterNameFormatter } from '@/utils/mitarbeiterName';

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  placeholder: { type: String, default: 'Mitarbeiter suchen (Name, Nr.)...' },
  dropup: { type: Boolean, default: false },
  includeInactive: { type: Boolean, default: false },
  requirePersonalnr: { type: Boolean, default: false },
  preferActive: { type: Boolean, default: false },
  selectedItem: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'select']);
const { formatName } = useMitarbeiterNameFormatter();
const dropdownAnchorName = `--ma-select-${getCurrentInstance()?.uid}`;
const supportsAnchorPositioning = typeof CSS !== 'undefined'
  && CSS.supports('anchor-name: --ma-select')
  && CSS.supports('position-anchor: --ma-select')
  && CSS.supports('top: anchor(bottom)');

const query = ref('');
const results = ref([]);
const selected = ref(null);
const loading = ref(false);
const showDropdown = ref(false);
const highlighted = ref(0);
const container = ref(null);
const inputEl = ref(null);
const dropdownStyle = ref({});
let debounceTimer = null;
let requestId = 0;

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
  dropdownStyle.value = props.dropup
    ? { position: 'fixed', bottom: `${window.innerHeight - rect.top + 3}px`, left: `${rect.left}px`, width: `${rect.width}px` }
    : { position: 'fixed', top: `${rect.bottom + 3}px`, left: `${rect.left}px`, width: `${rect.width}px` };
}

async function fetchResults() {
  const currentRequest = ++requestId;
  if (query.value.trim().length < 2) {
    results.value = [];
    loading.value = false;
    showDropdown.value = false;
    return;
  }
  loading.value = true;
  try {
    const { data } = await api.get('/api/personal/search', { params: {
      q: query.value.trim(),
      includeInactive: props.includeInactive,
      requirePersonalnr: props.requirePersonalnr,
      preferActive: props.preferActive,
      nameOnly: true,
    } });
    if (currentRequest !== requestId) return;
    results.value = data || [];
    highlighted.value = 0;
    updateDropdownPosition();
    showDropdown.value = true;
  } catch {
    if (currentRequest === requestId) results.value = [];
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

function onInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchResults, 280);
}

function select(employee) {
  selected.value = employee;
  query.value = '';
  results.value = [];
  showDropdown.value = false;
  emit('update:modelValue', employee._id);
  emit('select', employee);
}

function clear() {
  selected.value = null;
  emit('update:modelValue', null);
  emit('select', null);
  inputEl.value?.focus();
}

function openSuggestions() {
  updateDropdownPosition();
  if (query.value.trim().length >= 2) fetchResults();
}
function close() { showDropdown.value = false; }
function moveDown() { if (highlighted.value < results.value.length - 1) highlighted.value += 1; }
function moveUp() { if (highlighted.value > 0) highlighted.value -= 1; }
function selectHighlighted() { if (results.value[highlighted.value]) select(results.value[highlighted.value]); }
function onClickOutside(event) { if (container.value && !container.value.contains(event.target)) close(); }

onMounted(() => {
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

watch(() => props.modelValue, (value) => {
  if (!value) {
    selected.value = null;
    query.value = '';
  }
});
watch(() => props.selectedItem, (item) => {
  if (item && String(item._id) === String(props.modelValue)) selected.value = item;
}, { immediate: true });

defineExpose({ focus: () => inputEl.value?.focus() });
</script>

<style scoped lang="scss">
.ma-select { position: relative; width: 100%; }
.ma-select__input-wrap, .ma-select__selected { display: flex; align-items: center; width: 100%; min-height: 34px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; background: var(--tile-bg); color: var(--text); font: inherit; }
.ma-select__input-wrap { gap: 6px; &:focus-within { border-color: var(--primary); } }
.ma-select__selected { gap: 5px; color: var(--primary); cursor: pointer; text-align: left; }
.ma-select__icon { flex: 0 0 auto; color: var(--muted); font-size: 11px; }
.ma-select__input { flex: 1; min-width: 0; border: 0; outline: 0; padding: 6px 0; background: transparent; color: var(--text); font: inherit; font-size: 12.5px; &::placeholder { color: var(--muted); opacity: .6; } }
.ma-select__spinner { width: 12px; height: 12px; flex: 0 0 auto; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: ma-select-spin .6s linear infinite; }
.ma-select__dropdown { z-index: 9999; max-height: 200px; margin: 0; padding: 4px 0; overflow-y: auto; list-style: none; border: 1px solid var(--border); border-radius: 7px; background: var(--tile-bg); box-shadow: 0 6px 20px rgba(0, 0, 0, .12); }
.ma-select__dropdown--dropup { box-shadow: 0 -6px 20px rgba(0, 0, 0, .12); }
.ma-select__item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer; font-size: 12.5px; &:hover, &--active { background: var(--hover); } }
.ma-select__name { flex: 1; min-width: 0; }
.ma-select__nr { margin-right: 3px; font-family: monospace; font-size: 10px; opacity: .55; }
.ma-select__email { overflow: hidden; color: var(--muted); font-size: 10.5px; opacity: .65; text-overflow: ellipsis; white-space: nowrap; }
.ma-select__clear { margin-left: auto; font-size: 9px; opacity: .65; }
.ma-select__empty { z-index: 9999; margin: 4px 0 0; padding: 8px 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--tile-bg); color: var(--muted); font-size: 11.5px; }
@keyframes ma-select-spin { to { transform: rotate(360deg); } }
</style>