<template>
  <DashboardWidget
    title="Zuletzt erstellt"
    :icon="['fas', 'file-alt']"
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
      <li v-for="doc in recentFiltered" :key="doc._id" class="wp-item">
        <router-link 
          :to="{ path: '/dokumente', query: { docId: doc._id } }" 
          class="wp-link"
        >
          <div class="wp-info">
            <div class="doc-header">
              <span class="doc-type">{{ doc.docType }}</span>
              <span class="doc-date">{{ formatDate(doc.datum) }}</span>
            </div>
            <div class="wp-meta">
              <div v-if="doc.details?.name_teamleiter" class="wp-tl-row">
                <TlBadge />
                <span class="wp-tl-name">{{ doc.details.name_teamleiter }}</span>
              </div>
              <span v-if="doc.details?.kunde || doc.details?.mitarbeiter_job" class="wp-job">
                {{ doc.details?.kunde || doc.details?.mitarbeiter_job || '—' }}
              </span>
            </div>
          </div>
          <font-awesome-icon :icon="['fas', 'chevron-right']" class="wp-arrow" />
        </router-link>
      </li>
      <li v-if="!loading && !recentFiltered.length" class="wp-empty">
        Keine Dokumente für diesen Standort.
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
import TlBadge from "@/components/ui-elements/TlBadge.vue";

const LOCATIONS = [
  { label: "HH", value: "Hamburg" },
  { label: "B",  value: "Berlin"  },
  { label: "K",  value: "Köln"    },
];

const cache = useDataCache();
const auth = useAuth();

const loading = computed(() => cache.loading.documents);

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

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// ── Data ─────────────────────────────────────────────────────────────────────
const recentFiltered = computed(() => {
  let list = [...(cache.documents || [])];
  
  if (standort.value !== "Alle") {
    list = list.filter((doc) => {
      const location = doc.details?.location || doc.bezeichnung;
      return location === standort.value;
    });
  }
  
  return list
    .sort((a, b) => new Date(b.datum || 0) - new Date(a.datum || 0))
    .slice(0, 3);
});

onMounted(() => {
  cache.loadDocuments();
});
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
  gap: 4px;
  flex: 1;
}

.wp-item {
  list-style: none;
}

.wp-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 4px;
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
  align-self: center;
}

.wp-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 4px;
}

.doc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.doc-type {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.doc-date {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}

.wp-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}

.wp-tl-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wp-tl-name {
  color: var(--text);
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.wp-job {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wp-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 12px 0;
  text-align: center;
}
</style>
