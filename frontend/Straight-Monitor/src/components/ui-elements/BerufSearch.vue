<template>
  <div ref="container" class="beruf-search">
    <div v-if="selected.length" class="beruf-search__chips">
      <button v-for="beruf in selected" :key="beruf.jobKey" type="button" class="beruf-search__chip" @click="remove(beruf.jobKey)">
        <span>{{ beruf.designation }}</span>
        <small>{{ beruf.jobKey }}</small>
        <font-awesome-icon :icon="['fas', 'times']" />
      </button>
    </div>
    <div class="beruf-search__input-wrap">
      <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="beruf-search__icon" />
      <input
        ref="input"
        v-model="query"
        type="search"
        :placeholder="placeholder"
        autocomplete="off"
        @input="onInput"
        @focus="fetchResults"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="close"
      />
      <font-awesome-icon v-if="loading" icon="fa-solid fa-spinner" spin class="beruf-search__spinner" />
    </div>
    <Teleport to="body">
      <ul v-if="open && results.length" class="beruf-search__dropdown" :style="dropdownStyle">
        <li
          v-for="(beruf, index) in results"
          :key="beruf.jobKey"
          :class="{ active: index === highlighted, selected: isSelected(beruf.jobKey) }"
          @mousedown.prevent="toggle(beruf)"
          @mouseenter="highlighted = index"
        >
          <span>{{ beruf.designation }}</span><small>{{ beruf.jobKey }}</small>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, onMounted } from 'vue';
import api from '@/utils/api';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Beruf suchen...' },
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

async function fetchResults() {
  const currentRequest = ++request;
  loading.value = true;
  try {
    const { data } = await api.get('/api/auftraege/berufe/search', { params: { q: query.value.trim() } });
    if (currentRequest !== request) return;
    results.value = data || [];
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
  clearTimeout(timer);
  timer = setTimeout(fetchResults, 220);
}
function isSelected(jobKey) { return selected.value.some(beruf => beruf.jobKey === jobKey); }
function toggle(beruf) {
  selected.value = isSelected(beruf.jobKey)
    ? selected.value.filter(item => item.jobKey !== beruf.jobKey)
    : [...selected.value, beruf];
  emit('update:modelValue', selected.value.map(item => item.jobKey));
  query.value = '';
  fetchResults();
}
function remove(jobKey) {
  selected.value = selected.value.filter(beruf => beruf.jobKey !== jobKey);
  emit('update:modelValue', selected.value.map(item => item.jobKey));
}
function move(direction) { highlighted.value = Math.max(0, Math.min(results.value.length - 1, highlighted.value + direction)); }
function selectHighlighted() { if (results.value[highlighted.value]) toggle(results.value[highlighted.value]); }
function close() { open.value = false; }
function onClickOutside(event) { if (container.value && !container.value.contains(event.target)) close(); }

watch(() => props.modelValue, async (keys) => {
  const jobKeys = [...new Set((keys || []).map(Number).filter(Number.isInteger))];
  if (jobKeys.length && (!selected.value.length || selected.value.some(beruf => !jobKeys.includes(beruf.jobKey)))) {
    const { data } = await api.get('/api/auftraege/berufe/search');
    selected.value = (data || []).filter(beruf => jobKeys.includes(beruf.jobKey));
  } else if (!jobKeys.length) selected.value = [];
}, { immediate: true });
onMounted(() => { document.addEventListener('mousedown', onClickOutside); window.addEventListener('resize', updatePosition); window.addEventListener('scroll', updatePosition, true); });
onBeforeUnmount(() => { clearTimeout(timer); document.removeEventListener('mousedown', onClickOutside); window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true); });
defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped lang="scss">
.beruf-search { display: grid; gap: 6px; width: 100%; }
.beruf-search__chips { display: flex; flex-wrap: wrap; gap: 5px; }
.beruf-search__chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 3px 7px; border: 1px solid var(--primary); border-radius: 5px; background: color-mix(in srgb, var(--primary) 8%, transparent); color: var(--primary); cursor: pointer; font: inherit; font-size: .72rem; }
.beruf-search__chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.beruf-search__chip small { opacity: .75; font-family: ui-monospace, monospace; }.beruf-search__chip svg { font-size: .65rem; }
.beruf-search__input-wrap { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--tile-bg); }.beruf-search__input-wrap:focus-within { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 16%, transparent); }
.beruf-search__icon, .beruf-search__spinner { flex: 0 0 auto; color: var(--muted); font-size: .75rem; }.beruf-search__spinner { color: var(--primary); }
input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: .8rem; }input::placeholder { color: var(--muted); opacity: .7; }
.beruf-search__dropdown { z-index: 2000; max-height: 210px; margin: 0; padding: 4px 0; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--tile-bg); box-shadow: 0 8px 22px rgba(0,0,0,.16); list-style: none; }.beruf-search__dropdown li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 10px; color: var(--text); cursor: pointer; font-size: .78rem; }.beruf-search__dropdown li.active { background: var(--hover); }.beruf-search__dropdown li.selected { color: var(--primary); }.beruf-search__dropdown small { color: var(--muted); font-family: ui-monospace, monospace; }
</style>
