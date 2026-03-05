<template>
  <DashboardWidget
    title="Teamleiter Auswertung"
    :icon="['fas', 'user-tie']"
    :loading="loading"
  >
    <template #actions>
      <select v-model="standort" class="wt-select">
        <option value="">Alle</option>
        <option v-for="loc in LOCATIONS" :key="loc.value" :value="loc.value">{{ loc.label }}</option>
      </select>
    </template>

    <ul class="wt-list">
      <li v-for="tl in filtered" :key="tl._id" class="wt-row">
        <RouterLink :to="deepLink(tl)" class="wt-link">
          <span class="wt-name">{{ tl.vorname }} {{ tl.nachname }}</span>
          <span class="wt-stats">
            <span class="wt-fraction">{{ tl.reportCount }}/{{ tl.einsatzCount }}</span>
            <span class="wt-badge" :style="{ background: quoteColor(tl.quote) }">
              {{ tl.quote }}%
            </span>
          </span>
        </RouterLink>
      </li>
      <li v-if="!loading && !filtered.length" class="wt-empty">
        Keine Daten für diesen Monat.
      </li>
    </ul>
  </DashboardWidget>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useAuth } from "@/stores/auth";
import api from "@/utils/api";
import DashboardWidget from "./DashboardWidget.vue";

const LOCATIONS = [
  { label: "HH", value: "2" },
  { label: "B",  value: "1" },
  { label: "K",  value: "3" },
];

const USER_LOC_MAP = { hamburg: "2", berlin: "1", "köln": "3", koeln: "3" };

const auth    = useAuth();
const list    = ref([]);
const loading = ref(true);
const standort  = ref("");
const _initDone = ref(false);

watch(
  () => auth.user,
  (u) => {
    if (!_initDone.value && u?.location) {
      const key = u.location.toLowerCase().replace(/ö/g, "o");
      standort.value = Object.entries(USER_LOC_MAP).find(([k]) => k === key)?.[1] ?? "";
      _initDone.value = true;
    }
  },
  { immediate: true }
);

// Current month params
const now   = new Date();
const year  = String(now.getFullYear());
const month = String(now.getMonth() + 1).padStart(2, "0");

const filtered = computed(() => {
  let data = list.value;
  if (standort.value) {
    data = data.filter((tl) => String(tl.personalnr).charAt(0) === standort.value);
  }
  return [...data].sort((a, b) => b.quote - a.quote); // best first
});

const quoteColor = (q) => {
  if (q >= 75) return "#02b504";
  if (q >= 50) return "#47ff49";
  if (q >= 25) return "#ffd647";
  return "#fb2a2a";
};

const deepLink = (tl) => ({
  path: "/teamleiter-auswertung",
  query: {
    year,
    month,
    ...(standort.value ? { standort: standort.value } : {}),
    expanded: tl._id,
  },
});

onMounted(async () => {
  try {
    const res = await api.get("/api/personal/teamleiter-stats", {
      params: { month, year },
    });
    list.value = (res.data ?? []).map((tl) => ({
      ...tl,
      quote: tl.einsatzCount ? Math.round((tl.reportCount / tl.einsatzCount) * 100) : 0,
    }));
  } catch (e) {
    console.error("WidgetTeamleiter fetch error:", e);
  } finally {
    loading.value = false;
  }
});
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

.wt-select {
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  outline: none;
}

.wt-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
}

.wt-row {
  border-bottom: 1px solid var(--border);
  &:last-child { border-bottom: none; }
}

.wt-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  text-decoration: none;
  border-radius: 7px;
  transition: background 0.12s;

  &:hover { background: var(--hover); }
}

.wt-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.wt-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.wt-fraction {
  font-size: 11px;
  color: var(--muted);
}

.wt-badge {
  font-size: 10px;
  font-weight: 700;
  color: #000;
  border-radius: 4px;
  padding: 1px 5px;
  min-width: 34px;
  text-align: center;
}

.wt-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 16px 0;
  text-align: center;
}
</style>
