<template>
  <DashboardWidget
    title="Bestand"
    :icon="['fas', 'warehouse']"
    title-link-to="/bestand"
    :loading="loading"
  >
    <template #actions>
      <select v-model="sortMode" class="wb-select">
        <option value="percent">% Soll</option>
        <option value="anzahl">Anzahl</option>
      </select>
      <select v-model="selectedLocation" class="wb-select">
        <option value="">Alle</option>
        <option v-for="location in locations" :key="location._id" :value="location._id">
          {{ location.shortName || location.nameFull }}
        </option>
      </select>
    </template>

    <div class="wb-body">
      <ul v-if="withSoll.length" class="wb-list">
        <li v-for="item in withSoll" :key="item._id" class="wb-row">
          <span class="wb-name">
            {{ item.bezeichnung }}
            <span v-if="item.groesse && item.groesse !== 'onesize'" class="wb-size">{{ item.groesse }}</span>
          </span>
          <span class="wb-nums">{{ item.anzahl }}&thinsp;/&thinsp;{{ item.soll }}</span>
          <span class="wb-badge" :style="{ background: pctColor(item) }">
            {{ pct(item) }}%
          </span>
        </li>
      </ul>

      <template v-if="noSoll.length">
        <div class="wb-section-label">Ohne Soll</div>
        <ul class="wb-list">
          <li v-for="item in noSoll" :key="item._id" class="wb-row wb-row--nosoll">
            <span class="wb-name">
              {{ item.bezeichnung }}
              <span v-if="item.groesse && item.groesse !== 'onesize'" class="wb-size">{{ item.groesse }}</span>
            </span>
            <span class="wb-nums">{{ item.anzahl }}</span>
          </li>
        </ul>
      </template>

      <div v-if="!loading && !withSoll.length && !noSoll.length" class="wb-empty">
        Keine Artikel gefunden.
      </div>
    </div>
  </DashboardWidget>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import api from "@/utils/api";
import { useAuth } from "@/stores/auth";
import DashboardWidget from "./DashboardWidget.vue";

const auth    = useAuth();
const locations = ref([]);
const stocks = ref([]);
const loading = ref(false);

const selectedLocation = ref("");
const sortMode  = ref("percent");
const _initDone = ref(false);

watch(
  () => auth.user,
  (u) => {
    if (!_initDone.value && u?.locationV2) {
      selectedLocation.value = String(u.locationV2?._id || u.locationV2);
      _initDone.value = true;
    }
  },
  { immediate: true }
);

const filtered = computed(() => {
  if (!selectedLocation.value) return stocks.value;
  return stocks.value.filter((stock) => String(stock.locationId) === selectedLocation.value);
});

const pct = (item) =>
  item.soll > 0 ? Math.round((item.anzahl / item.soll) * 100) : 0;

const pctColor = (item) => {
  const p = pct(item);
  if (p >= 75) return "#02b504";
  if (p >= 50) return "#47ff49";
  if (p >= 25) return "#ffd647";
  return "#fb2a2a";
};

const withSoll = computed(() => {
  const list = filtered.value.filter((i) => (i.soll ?? 0) > 0);
  if (sortMode.value === "percent") {
    return [...list].sort((a, b) => pct(a) - pct(b));
  }
  return [...list].sort((a, b) => (b.anzahl ?? 0) - (a.anzahl ?? 0));
});

const noSoll = computed(() => {
  const list = filtered.value.filter((i) => !(i.soll > 0));
  return [...list].sort((a, b) => (b.anzahl ?? 0) - (a.anzahl ?? 0));
});

async function loadData() {
  loading.value = true;
  try {
    const [locationsResponse, stocksResponse] = await Promise.all([
      api.get("/api/locations"),
      api.get("/api/inventory/stocks"),
    ]);
    locations.value = locationsResponse.data || [];
    stocks.value = stocksResponse.data || [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped lang="scss">
:deep(.dash-widget__icon) {
  color: var(--muted);
}

:deep(.dash-widget__content) {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.wb-select {
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  outline: none;
}

.wb-body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 2px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
}

.wb-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wb-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 5px 2px;
  border-bottom: 1px solid var(--border);

  &:last-child { border-bottom: none; }

  &--nosoll .wb-nums {
    color: var(--muted);
    font-size: 11px;
  }
}

.wb-name {
  flex: 1;
  font-size: 12px;
  color: var(--text);
  white-space: normal;
  word-break: break-word;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.wb-size {
  font-size: 10px;
  color: var(--muted);
  background: var(--hover);
  border-radius: 3px;
  padding: 1px 4px;
  flex-shrink: 0;
}

.wb-nums {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.wb-badge {
  font-size: 10px;
  font-weight: 700;
  color: #000;
  border-radius: 4px;
  padding: 1px 5px;
  flex-shrink: 0;
  min-width: 36px;
  text-align: center;
}

.wb-section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 2px 4px;
}

.wb-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 16px 0;
  text-align: center;
}
</style>
