<template>
  <div ref="container" class="customer-search">
    <div v-if="selectedCustomer" class="customer-search__selected">
      <span>{{ selectedCustomer.kundName || `Kunde ${selectedCustomer.kundenNr}` }}</span>
      <small>{{ selectedCustomer.kundenNr }} · {{ selectedCustomer.kuerzel || 'Ohne Kürzel' }}</small>
      <button type="button" title="Kunde entfernen" @click="clear">
        <font-awesome-icon :icon="['fas', 'xmark']" />
      </button>
    </div>
    <div v-else class="customer-search__input-wrap">
      <font-awesome-icon :icon="['fas', 'magnifying-glass']" class="customer-search__icon" />
      <input
        ref="input"
        v-model="query"
        type="search"
        :placeholder="placeholder"
        autocomplete="off"
        @focus="open = true"
        @input="open = true"
        @keydown.down.prevent="moveHighlight(1)"
        @keydown.up.prevent="moveHighlight(-1)"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="open = false"
      />
    </div>
    <ul v-if="open && !selectedCustomer" class="customer-search__results">
      <li
        v-for="(kunde, index) in matchingKunden"
        :key="kunde._id"
        :class="{ active: index === highlightedIndex }"
        @mousedown.prevent="select(kunde)"
        @mouseenter="highlightedIndex = index"
      >
        <strong>{{ kunde.kundName || `Kunde ${kunde.kundenNr}` }}</strong>
        <small>{{ kunde.kundenNr }} · {{ kunde.kuerzel || 'Ohne Kürzel' }}</small>
      </li>
      <li v-if="matchingKunden.length === 0" class="customer-search__empty">Kein Kunde gefunden</li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useDataCache } from '@/stores/dataCache';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  placeholder: { type: String, default: 'Kunde suchen ...' },
});
const emit = defineEmits(['update:modelValue', 'select']);
const dataCache = useDataCache();
const container = ref(null);
const input = ref(null);
const query = ref('');
const open = ref(false);
const highlightedIndex = ref(0);

const selectedCustomer = computed(() => (dataCache.kunden || [])
  .find((kunde) => String(kunde._id) === String(props.modelValue)) || null);
const matchingKunden = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase('de');
  return (dataCache.kunden || []).filter((kunde) => !normalizedQuery || [kunde.kundName, kunde.kuerzel, kunde.kundenNr]
    .some((value) => String(value || '').toLocaleLowerCase('de').includes(normalizedQuery)))
    .sort((first, second) => String(first.kundName || '').localeCompare(String(second.kundName || ''), 'de'))
    .slice(0, 20);
});

function select(kunde) {
  emit('update:modelValue', String(kunde._id));
  emit('select', kunde);
  query.value = '';
  open.value = false;
}

function clear() {
  emit('update:modelValue', '');
  emit('select', null);
  nextTick(() => input.value?.focus());
}

function moveHighlight(direction) {
  if (!open.value) open.value = true;
  const count = matchingKunden.value.length;
  if (!count) return;
  highlightedIndex.value = (highlightedIndex.value + direction + count) % count;
}

function selectHighlighted() {
  const kunde = matchingKunden.value[highlightedIndex.value];
  if (kunde) select(kunde);
}

function onClickOutside(event) {
  if (container.value && !container.value.contains(event.target)) open.value = false;
}

watch(query, () => { highlightedIndex.value = 0; });
onMounted(() => {
  dataCache.loadKunden();
  document.addEventListener('mousedown', onClickOutside);
});
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside));
defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped>
.customer-search { position: relative; width: 100%; }
.customer-search__input-wrap,.customer-search__selected { display:flex; align-items:center; gap:6px; min-height:34px; box-sizing:border-box; padding:0 8px; border:1px solid var(--border); border-radius:6px; background:var(--tile-bg); color:var(--text); font-size:12.5px; }
.customer-search__input-wrap:focus-within { border-color:var(--primary); }
.customer-search__icon { flex:0 0 auto; color:var(--muted); font-size:11px; }
.customer-search input { flex:1; min-width:0; padding:6px 0; border:0; outline:0; background:transparent; color:inherit; font:inherit; }
.customer-search__selected { gap:7px; }
.customer-search__selected span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.customer-search__selected small { margin-left:auto; color:var(--muted); font-size:10px; white-space:nowrap; }
.customer-search__selected button { display:grid; flex:0 0 auto; width:22px; height:22px; place-items:center; padding:0; border:0; background:transparent; color:var(--muted); cursor:pointer; }
.customer-search__selected button:hover { color:var(--primary); }
.customer-search__results { position:absolute; z-index:20; top:calc(100% + 4px); right:0; left:0; max-height:220px; overflow-y:auto; margin:0; padding:0; border:1px solid var(--border); border-radius:6px; background:var(--surface); box-shadow:0 8px 18px rgba(0,0,0,.12); list-style:none; }
.customer-search__results li { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 10px; border-bottom:1px solid var(--border); cursor:pointer; font-size:12px; }
.customer-search__results li:last-child { border-bottom:0; }
.customer-search__results li.active,.customer-search__results li:hover { background:color-mix(in srgb,var(--primary) 8%,transparent); }
.customer-search__results small,.customer-search__empty { color:var(--muted); font-size:11px; }
.customer-search__results .customer-search__empty { display:block; cursor:default; }
</style>
