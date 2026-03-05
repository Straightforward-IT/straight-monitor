<template>
  <DashboardWidget
    title="Aufträge"
    :icon="['fas', 'calendar-days']"
    :loading="loading"
  >
    <template #actions>
      <div class="wa-date-nav">
        <button class="wa-nav-btn" @click="shiftDay(-1)" title="Vorheriger Tag">
          <font-awesome-icon :icon="['fas', 'chevron-left']" />
        </button>
        <button class="wa-date-label" @click="resetToToday" :title="isToday ? '' : 'Zurück zu Heute'">
          {{ dateLabel }}
        </button>
        <button class="wa-nav-btn" @click="shiftDay(1)" title="Nächster Tag">
          <font-awesome-icon :icon="['fas', 'chevron-right']" />
        </button>
      </div>
      <select v-model="geschSt" class="wa-select">
        <option value="">Alle</option>
        <option v-for="loc in LOCATIONS" :key="loc.value" :value="loc.value">
          {{ loc.label }}
        </option>
      </select>
    </template>

    <ul class="wa-list">
      <li v-for="auftrag in dayFiltered" :key="auftrag._id" class="wa-item">
        <RouterLink
          :to="{ path: '/auftraege', query: { auftragnr: auftrag.auftragNr, focusDate: selectedISO } }"
          class="wa-link"
        >
          <div class="wa-info">
            <span class="wa-title">{{ auftrag.eventTitel || auftrag.eventOrt || auftrag.eventLocation || '—' }}</span>
            <div class="wa-meta">
              <span v-if="auftrag.kundeData?.kundName" class="wa-kunde">
                <font-awesome-icon :icon="['fas', 'user']" class="wa-meta-icon" />
                {{ auftrag.kundeData.kundName }}
              </span>
              <span v-if="auftrag.einsaetzeCount != null" class="wa-count">
                {{ auftrag.einsaetzeCount }} Pos.
              </span>
            </div>
          </div>
          <font-awesome-icon :icon="['fas', 'chevron-right']" class="wa-arrow" />
        </RouterLink>
      </li>

      <li v-if="!loading && !dayFiltered.length" class="wa-empty">
        Keine Aufträge am {{ dateLabel }}.
      </li>
    </ul>
  </DashboardWidget>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useDataCache } from "@/stores/dataCache";
import { useAuth } from "@/stores/auth";
import DashboardWidget from "./DashboardWidget.vue";

// geschSt mapping: '1' = Berlin, '2' = Hamburg, '3' = Köln (matches AuftraegePage)
const LOCATIONS = [
  { label: "HH", value: "2" },
  { label: "B",  value: "1" },
  { label: "K",  value: "3" },
];

const USER_LOC_MAP = { berlin: "1", hamburg: "2", "köln": "3", koeln: "3" };

const cache = useDataCache();
const auth  = useAuth();

const loading = computed(() => cache.loading.auftraege && cache.auftraege.length === 0);

const geschSt = ref("");
const _initialized = ref(false);
watch(
  () => auth.user,
  (u) => {
    if (!_initialized.value && u?.location) {
      const key = u.location.toLowerCase();
      const mapped = USER_LOC_MAP[key] ?? Object.entries(USER_LOC_MAP).find(([k]) => key.includes(k))?.[1];
      if (mapped) geschSt.value = mapped;
      _initialized.value = true;
    }
  },
  { immediate: true }
);

// ── Date navigation ──────────────────────────────────────────────────────────
const selectedDate = ref(new Date());
selectedDate.value.setHours(0, 0, 0, 0);

const selectedISO = computed(() => selectedDate.value.toISOString().slice(0, 10));

const isToday = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return selectedDate.value.getTime() === today.getTime();
});

const dateLabel = computed(() => {
  if (isToday.value) return "Heute";
  return selectedDate.value.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
});

function shiftDay(delta) {
  const d = new Date(selectedDate.value);
  d.setDate(d.getDate() + delta);
  selectedDate.value = d;
}

function resetToToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  selectedDate.value = d;
}

const dayFiltered = computed(() => {
  const dayStart = new Date(selectedDate.value);
  const dayEnd   = new Date(selectedDate.value); dayEnd.setHours(23, 59, 59, 999);

  let list = cache.auftraege.filter((a) => {
    const von = a.vonDatum ? new Date(a.vonDatum) : null;
    const bis = a.bisDatum ? new Date(a.bisDatum) : null;
    return von && bis && von <= dayEnd && bis >= dayStart;
  });
  if (geschSt.value) {
    list = list.filter((a) => a.geschSt === geschSt.value);
  }
  return list.sort((a, b) => new Date(a.vonDatum) - new Date(b.vonDatum));
});

onMounted(() => {
  cache.loadAuftraege().then(() => {
    // If cached data is missing enriched fields (old cache), force a full refresh
    const sample = cache.auftraege[0];
    if (sample && sample.einsaetzeCount === undefined && sample.kundeData === undefined) {
      cache.loadAuftraege(true);
    }
  });
});
</script>

<style scoped lang="scss">
:deep(.dash-widget__icon) {
  color: var(--muted);
}

.wa-select {
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  outline: none;
}

.wa-date-nav {
  display: flex;
  align-items: center;
  gap: 1px;
}

.wa-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  font-size: 9px;
  transition: color 0.12s, border-color 0.12s;

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
}

.wa-date-label {
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s;

  &:hover {
    color: var(--primary);
  }
}

.wa-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wa-item {
  list-style: none;
}

.wa-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px;
  border-radius: 7px;
  text-decoration: none;
  transition: background 0.12s;

  &:hover {
    background: var(--hover);
    .wa-arrow { opacity: 1; }
  }
}

.wa-arrow {
  font-size: 10px;
  color: var(--muted);
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.12s;
}

.wa-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.wa-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.wa-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.wa-meta-icon {
  font-size: 9px;
  color: var(--muted);
  margin-right: 2px;
}

.wa-kunde {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

.wa-count {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.wa-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 16px 0;
  text-align: center;
}
</style>
