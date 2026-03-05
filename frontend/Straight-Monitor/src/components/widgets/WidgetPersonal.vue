<template>
  <DashboardWidget
    title="Zuletzt erstellt"
    :icon="['fas', 'people-line']"
    :loading="loading"
  >
    <template #actions>
      <select v-model="standort" class="wp-select">
        <option value="Alle">Alle</option>
        <option v-for="loc in LOCATIONS" :key="loc.value" :value="loc.value">
          {{ loc.label }}
        </option>
      </select>
    </template>

    <ul class="wp-list">
      <li v-for="ma in recentFiltered" :key="ma._id" class="wp-item">
        <RouterLink :to="{ path: '/personal', query: { mitarbeiter_id: ma._id } }" class="wp-link">
          <div class="wp-info">
            <span class="wp-name">{{ ma.vorname }} {{ ma.nachname }}<span v-if="ma.personalnr" class="wp-pnr-inline"> · {{ ma.personalnr }}</span></span>
            <div class="wp-meta">
              <span v-if="getAbteilung(ma)" class="wp-abt">{{ getAbteilung(ma) }}</span>
            </div>
            <span v-if="ma.erstellt_von" class="wp-by">von {{ ma.erstellt_von }}</span>
            <span v-if="ma.createdAt || ma.dateCreated" class="wp-date">{{ formatDateTime(ma.createdAt ?? ma.dateCreated) }}</span>
          </div>
          <font-awesome-icon :icon="['fas', 'chevron-right']" class="wp-arrow" />
        </RouterLink>
      </li>
      <li v-if="!loading && !recentFiltered.length" class="wp-empty">
        Keine Einträge für diesen Standort.
      </li>
    </ul>
  </DashboardWidget>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useDataCache } from "@/stores/dataCache";
import { useFlipAll } from "@/stores/flipAll";
import { useAuth } from "@/stores/auth";
import DashboardWidget from "./DashboardWidget.vue";

const LOCATIONS = [
  { label: "HH", value: "Hamburg" },
  { label: "B",  value: "Berlin"  },
  { label: "K",  value: "Köln"    },
];

const cache = useDataCache();
const flip  = useFlipAll();
const auth  = useAuth();

const loading = computed(() => cache.loading.mitarbeiter && cache.mitarbeiter.length === 0);

// Default to user's location, fallback to 'Alle'
const standort = ref("Alle");
const _locationInitialized = ref(false);
watch(
  () => auth.user,
  (u) => {
    if (!_locationInitialized.value && u?.location) {
      if (LOCATIONS.some((l) => l.value === u.location)) {
        standort.value = u.location;
      }
      _locationInitialized.value = true;
    }
  },
  { immediate: true }
);

// ── Helpers (mirrors PeopleDocsModern logic) ─────────────────────────────────
const getFlipUser = (ma) =>
  flip.getById(ma.flip_id) ?? (ma.email ? flip.getByEmail(ma.email) : null);

const getLocation = (ma) => {
  const fu = getFlipUser(ma);
  const flipLoc =
    fu?.profile?.location ??
    fu?.attributes?.find((a) => /standort|location/i.test(a.name ?? ""))?.value;
  if (flipLoc) return flipLoc;
  if (ma.standort) return ma.standort;
  const p = String(ma.personalnr ?? "").trim();
  if (p.startsWith("1")) return "Berlin";
  if (p.startsWith("2")) return "Hamburg";
  if (p.startsWith("3")) return "Köln";
  return null;
};

const formatDateTime = (d) =>
  d ? new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d)) : null;

const getAbteilung = (ma) => {
  const fu = getFlipUser(ma);
  return (
    fu?.profile?.department ??
    fu?.attributes?.find((a) => /bereich|abteilung|department/i.test(a.name ?? ""))?.value ??
    ma.abteilung ??
    null
  );
};

// ── Data ─────────────────────────────────────────────────────────────────────
const recentFiltered = computed(() => {
  let list = [...cache.mitarbeiter];
  if (standort.value !== "Alle") {
    list = list.filter((m) => getLocation(m) === standort.value);
  }
  return list
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? b.dateCreated ?? 0) -
        new Date(a.createdAt ?? a.dateCreated ?? 0)
    )
    .slice(0, 3);
});

onMounted(() => cache.loadMitarbeiter());
</script>

<style scoped lang="scss">
// Override icon color to muted (not primary/orange)
:deep(.dash-widget__icon) {
  color: var(--muted);
}

.wp-select {
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  outline: none;

  &:focus {
    border-color: var(--border);
  }
}

.wp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.wp-item {
  list-style: none;
}

.wp-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 7px;
  text-decoration: none;
  transition: background 0.12s;

  &:hover {
    background: var(--hover);

    .wp-arrow { opacity: 1; }
  }
}

.wp-arrow {
  font-size: 10px;
  color: var(--muted);
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.12s;
}

.wp-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.wp-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.wp-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.wp-pnr-inline {
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
}

.wp-abt {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(230, 88, 79, 0.12);
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wp-by {
  font-size: 10px;
  color: var(--muted);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wp-date {
  font-size: 10px;
  color: var(--muted);
  opacity: 0.7;
  margin-top: 1px;
  white-space: nowrap;
}

.wp-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 12px 0;
  text-align: center;
}
</style>
