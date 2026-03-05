<template>
  <DashboardWidget
    title="Bestand-Logs"
    :icon="['fas', 'timeline']"
    :loading="loading"
  >
    <template #actions>
      <select v-model="selectedStandort" class="wp-select">
        <option value="Alle">Alle</option>
        <option value="Hamburg">HH</option>
        <option value="Berlin">B</option>
        <option value="Köln">K</option>
      </select>
    </template>

    <ul class="wm-list">
      <li v-for="log in recentLogs" :key="log._id" class="wm-item">
        <RouterLink
          :to="{ path: '/verlauf', query: { highlight: log._id } }"
          class="wm-link"
        >
          <div class="wm-info">
            <div class="wm-top">
              <span class="wm-title">{{ log.mitarbeiterName || log.benutzerMail }}</span>
              <span :class="['wm-art', `wm-art--${log.art}`]">{{ artLabel(log.art) }}</span>
            </div>
            <div class="wm-meta">
              <span v-if="log.mitarbeiterName" class="wm-sub">{{ log.benutzerMail }}</span>
              <span v-if="log.items?.length" class="wm-count">{{ log.items.length }} Item{{ log.items.length !== 1 ? 's' : '' }}</span>
              <span class="wm-date">{{ formatDate(log.timestamp) }} · {{ formatTime(log.timestamp) }}</span>
            </div>
          </div>
          <font-awesome-icon :icon="['fas', 'chevron-right']" class="wm-arrow" />
        </RouterLink>
      </li>

      <li v-if="!loading && recentLogs.length === 0" class="wm-empty">
        Keine Einträge für diesen Standort.
      </li>
    </ul>
  </DashboardWidget>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import { useAuth } from "@/stores/auth";
import DashboardWidget from "./DashboardWidget.vue";

const auth = useAuth();

const selectedStandort = ref("Alle");
const recentLogs = ref([]);
const loading = ref(false);

// Format time as HH:MM
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
};

// Format date as DD.MM.YYYY
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("de-DE");
};

// Art labels in German
const artLabel = (art) => {
  const labels = {
    zugang: "Zugang",
    entnahme: "Entnahme",
    änderung: "Änderung",
  };
  return labels[art] || art;
};

// Load recent logs
const loadRecentLogs = async () => {
  try {
    loading.value = true;
    const params = {
      count: 3,
      ...(selectedStandort.value !== "Alle" && { standort: selectedStandort.value }),
    };
    const { data } = await api.get("/api/monitoring/recent", { params });
    recentLogs.value = data;
  } catch (error) {
    console.error("Fehler beim Laden der Monitoring-Logs:", error);
    recentLogs.value = [];
  } finally {
    loading.value = false;
  }
};

// Init standort from user location
watch(
  () => auth.user,
  (u) => {
    if (u?.location) {
      const validLocations = ["Hamburg", "Berlin", "Köln"];
      if (validLocations.includes(u.location)) {
        selectedStandort.value = u.location;
      }
    }
  },
  { immediate: true }
);

// Reload when standort changes
watch(selectedStandort, () => loadRecentLogs());

onMounted(() => {
  loadRecentLogs();
});
</script>

<style scoped lang="scss">
:deep(.dash-widget__icon) {
  color: var(--muted);
}

.wm-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wm-item {
  list-style: none;
}

.wm-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px;
  border-radius: 7px;
  text-decoration: none;
  color: inherit;
  transition: background 0.12s;

  &:hover {
    background: var(--hover);
    .wm-arrow { opacity: 1; }
  }
}

.wm-arrow {
  font-size: 10px;
  color: var(--muted);
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.12s;
}

.wm-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.wm-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wm-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  flex: 1;
}

.wm-art {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;

  &--zugang {
    background: color-mix(in srgb, #10b981 15%, var(--hover));
    color: #10b981;
  }

  &--entnahme {
    background: color-mix(in srgb, #ef4444 15%, var(--hover));
    color: #ef4444;
  }

  &--änderung {
    background: color-mix(in srgb, #3b82f6 15%, var(--hover));
    color: #3b82f6;
  }
}

.wm-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.wm-sub {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

.wm-count {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.wm-date {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.wm-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 16px 0;
  text-align: center;
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
</style>
