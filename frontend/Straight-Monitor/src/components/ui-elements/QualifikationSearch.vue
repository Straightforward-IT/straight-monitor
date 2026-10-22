<template>
  <div
    ref="container"
    class="quali-search"
  >
    <div
      v-if="selected.length"
      class="quali-search__chips"
    >
      <button
        v-for="quali in selected"
        :key="quali.qualificationKey"
        type="button"
        class="quali-search__chip"
        :disabled="disabled"
        @click="remove(quali.qualificationKey)"
      >
        <span>{{ quali.designation }}</span>
        <small>{{ quali.qualificationKey }}</small>
        <font-awesome-icon :icon="['fas', 'times']" />
      </button>
    </div>
    <div class="quali-search__input-wrap">
      <font-awesome-icon
        :icon="['fas', 'magnifying-glass']"
        class="quali-search__icon"
      />
      <input
        :id="inputId || undefined"
        ref="input"
        v-model="query"
        :disabled="disabled"
        type="search"
        :placeholder="placeholder"
        autocomplete="off"
        @input="onInput"
        @focus="fetchResults"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="close"
      >
      <font-awesome-icon
        v-if="loading"
        icon="fa-solid fa-spinner"
        spin
        class="quali-search__spinner"
      />
    </div>
    <Teleport to="body">
      <ul
        v-if="open && results.length"
        class="quali-search__dropdown"
        :style="dropdownStyle"
      >
        <li
          v-for="(quali, index) in results"
          :key="quali.qualificationKey"
          :class="{ active: index === highlighted, selected: isSelected(quali.qualificationKey) }"
          @mousedown.prevent="toggle(quali)"
          @mouseenter="highlighted = index"
        >
          <span>{{ quali.designation }}</span><small>{{ quali.qualificationKey }}</small>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, onMounted } from 'vue';
import api from '@/utils/api';

const props = defineProps({
  inputId: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  multiple: { type: Boolean, default: true },
  modelValue: { type: [Array, String, Number], default: () => [] },
  placeholder: { type: String, default: 'Qualifikation suchen...' },
});
const emit = defineEmits(['update:modelValue']);
const container = ref(null);
const input = ref(null);
const query = ref('');
const results = ref([]);
const selected = ref([]);
const open = ref(false);
const loading = ref(false);
const highlighted = ref(0);
const dropdownStyle = ref({});
let timer;
let request = 0;

function updatePosition() {
  const rect = container.value?.getBoundingClientRect();
  if (!rect) return;
  dropdownStyle.value = { position: 'fixed', top: `${rect.bottom + 3}px`, left: `${rect.left}px`, width: `${rect.width}px` };
}

function sortByQualificationKey(items) {
  return [...(items || [])].sort((a, b) => Number(a.qualificationKey) - Number(b.qualificationKey));
}

async function fetchResults() {
  if (props.disabled) return;
  const currentRequest = ++request;
  loading.value = true;
  try {
    const { data } = await api.get('/api/auftraege/qualifikationen/search', { params: { q: query.value.trim() } });
    if (currentRequest !== request) return;
    results.value = sortByQualificationKey(data);
    highlighted.value = 0;
    updatePosition();
    open.value = results.value.length > 0;
  } catch {
    if (currentRequest === request) { results.value = []; open.value = false; }
  } finally {
    if (currentRequest === request) loading.value = false;
  }
}

function onInput() {
  if (props.disabled) return;
  clearTimeout(timer);
  timer = setTimeout(fetchResults, 220);
}
function isSelected(qualificationKey) {
  return selected.value.some(quali => Number(quali.qualificationKey) === Number(qualificationKey));
}
function emitSelection() {
  if (!props.multiple) {
    const first = selected.value[0];
    emit('update:modelValue', first ? String(first.qualificationKey) : '');
    return;
  }
  emit('update:modelValue', selected.value.map(item => item.qualificationKey));
}
function toggle(quali) {
  if (props.disabled) return;
  if (!props.multiple) {
    selected.value = isSelected(quali.qualificationKey) ? [] : [quali];
    emitSelection();
    query.value = '';
    close();
    return;
  }
  selected.value = isSelected(quali.qualificationKey)
    ? selected.value.filter(item => Number(item.qualificationKey) !== Number(quali.qualificationKey))
    : [...selected.value, quali];
  emitSelection();
  query.value = '';
  fetchResults();
}
function remove(qualificationKey) {
  if (props.disabled) return;
  selected.value = selected.value.filter(quali => Number(quali.qualificationKey) !== Number(qualificationKey));
  emitSelection();
}
function move(direction) { highlighted.value = Math.max(0, Math.min(results.value.length - 1, highlighted.value + direction)); }
function selectHighlighted() { if (results.value[highlighted.value]) toggle(results.value[highlighted.value]); }
function close() { open.value = false; }
watch(() => props.disabled, disabled => {
  if (!disabled) return;
  ++request;
  clearTimeout(timer);
  close();
  loading.value = false;
});
function onClickOutside(event) { if (container.value && !container.value.contains(event.target)) close(); }

watch(() => props.modelValue, async (val) => {
  const rawList = Array.isArray(val) ? val : val !== null && val !== undefined && val !== '' ? [val] : [];
  const qualKeys = [...new Set(rawList.map(Number).filter(Number.isInteger))];
  if (qualKeys.length && (!selected.value.length || selected.value.some(quali => !qualKeys.includes(Number(quali.qualificationKey))))) {
    const { data } = await api.get('/api/auftraege/qualifikationen/search');
    selected.value = (data || []).filter(quali => qualKeys.includes(Number(quali.qualificationKey)));
  } else if (!qualKeys.length) selected.value = [];
}, { immediate: true });
onMounted(() => { document.addEventListener('mousedown', onClickOutside); window.addEventListener('resize', updatePosition); window.addEventListener('scroll', updatePosition, true); });
onBeforeUnmount(() => { clearTimeout(timer); document.removeEventListener('mousedown', onClickOutside); window.removeEventListener('resize', updatePosition); window.addEventListener('scroll', updatePosition, true); });
defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped lang="scss">
.quali-search { display: grid; gap: 6px; width: 100%; }
.quali-search__chips { display: flex; flex-wrap: wrap; gap: 5px; }
.quali-search__chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 3px 7px; border: 1px solid var(--primary); border-radius: 5px; background: color-mix(in srgb, var(--primary) 8%, transparent); color: var(--primary); cursor: pointer; font: inherit; font-size: .72rem; }
.quali-search__chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.quali-search__chip small { opacity: .75; font-family: ui-monospace, monospace; }.quali-search__chip svg { font-size: .65rem; }
.quali-search__input-wrap { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--tile-bg); }.quali-search__input-wrap:focus-within { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 16%, transparent); }
.quali-search__icon, .quali-search__spinner { flex: 0 0 auto; color: var(--muted); font-size: .75rem; }.quali-search__spinner { color: var(--primary); }
input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: .8rem; }input::placeholder { color: var(--muted); opacity: .7; }
.quali-search__dropdown { z-index: 2000; max-height: 210px; margin: 0; padding: 4px 0; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--tile-bg); box-shadow: 0 8px 22px rgba(0,0,0,.16); list-style: none; }.quali-search__dropdown li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 10px; color: var(--text); cursor: pointer; font-size: .78rem; }.quali-search__dropdown li.active { background: var(--hover); }.quali-search__dropdown li.selected { color: var(--primary); }.quali-search__dropdown small { color: var(--muted); font-family: ui-monospace, monospace; }
</style>
