<template>
  <div class="addr-ac" @focusout="onFocusOut">
    <input
      ref="inputEl"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="choose(active)"
      @keydown.esc="open = false"
    />
    <Teleport to="body">
      <ul v-if="open && list.length" class="addr-ac-list" :style="dropStyle">
        <li
          v-for="(s, i) in list"
          :key="s"
          class="addr-ac-item"
          :class="{ active: i === active }"
          @mousedown.prevent="choose(i)"
          @mouseenter="active = i"
        >
          <font-awesome-icon :icon="['fas', 'location-dot']" /> {{ s }}
        </li>
        <li v-if="loading" class="addr-ac-item addr-ac-item--muted">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Suche…
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLocationDot, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';

library.add(faLocationDot, faSpinner);

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  // Local suggestions (event/office addresses) shown before remote results.
  localSuggestions: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue']);

const inputEl = ref(null);
const open = ref(false);
const active = ref(-1);
const loading = ref(false);
const remote = ref([]);
const dropStyle = ref({});
let debounceTimer = null;
let reqSeq = 0;

const localMatches = computed(() => {
  const q = (props.modelValue || '').trim().toLowerCase();
  if (!q) return props.localSuggestions.slice(0, 5);
  return props.localSuggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 5);
});

const list = computed(() => {
  const seen = new Set();
  const out = [];
  for (const s of [...localMatches.value, ...remote.value]) {
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out.slice(0, 8);
});

function onInput(e) {
  emit('update:modelValue', e.target.value);
  open.value = true;
  active.value = -1;
  nextTick(updatePosition);
  scheduleSearch(e.target.value);
}

// Position the teleported dropdown right under the input (viewport-fixed).
function updatePosition() {
  const el = inputEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  dropStyle.value = {
    position: 'fixed',
    top: `${r.bottom + 2}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    right: 'auto',
  };
}

function onFocus() {
  open.value = true;
  nextTick(updatePosition);
}

function onScrollResize() {
  if (open.value) updatePosition();
}

function scheduleSearch(q) {
  clearTimeout(debounceTimer);
  const query = (q || '').trim();
  if (query.length < 3) { remote.value = []; loading.value = false; return; }
  loading.value = true;
  debounceTimer = setTimeout(() => runSearch(query), 300);
}

async function runSearch(query) {
  const seq = ++reqSeq;
  try {
    const { data } = await api.get('/api/reisekosten/address-search', { params: { q: query } });
    if (seq !== reqSeq) return; // stale response
    remote.value = data.suggestions || [];
  } catch {
    remote.value = [];
  } finally {
    if (seq === reqSeq) loading.value = false;
    nextTick(updatePosition);
  }
}

function move(dir) {
  if (!list.value.length) return;
  open.value = true;
  active.value = (active.value + dir + list.value.length) % list.value.length;
}

function choose(i) {
  const val = i >= 0 ? list.value[i] : null;
  if (val) emit('update:modelValue', val);
  open.value = false;
  active.value = -1;
}

function onFocusOut(e) {
  // Close only when focus leaves the input (list is teleported, so it's not a child).
  if (!e.currentTarget.contains(e.relatedTarget)) open.value = false;
}

watch(() => props.modelValue, (v) => {
  // Reset remote list when cleared externally.
  if (!v) remote.value = [];
});

onMounted(() => {
  window.addEventListener('scroll', onScrollResize, true);
  window.addEventListener('resize', onScrollResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollResize, true);
  window.removeEventListener('resize', onScrollResize);
  clearTimeout(debounceTimer);
});
</script>

<style scoped lang="scss">
.addr-ac { position: relative; }
.addr-ac > input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 9px;
  background: var(--surface, var(--tile-bg));
  color: var(--text);
  font: inherit;
  font-weight: 400;
}
.addr-ac > input:focus { border-color: var(--primary); outline: none; }
</style>

<style lang="scss">
/* Unscoped — the list is teleported to <body>, outside the component's scope. */
.addr-ac-list {
  z-index: 3000;
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 300px;
  overflow-y: auto;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
}
.addr-ac-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--text);
  cursor: pointer;
}
.addr-ac-item svg { color: var(--primary); flex-shrink: 0; }
.addr-ac-item.active { background: color-mix(in srgb, var(--primary) 12%, transparent); }
.addr-ac-item--muted { color: var(--muted); cursor: default; }
</style>
