<template>
  <DashboardWidget
    title="Letzte Imports"
    :icon="['fas', 'file-import']"
    :loading="loading"
  >
    <ul class="wi-list">
      <li v-for="log in logs" :key="log._id" class="wi-row">
        <div class="wi-icon-wrap">
          <font-awesome-icon :icon="statusIcon(log.status)" :class="['wi-icon', `wi-icon--${log.status}`]" />
        </div>
        <div class="wi-info">
          <span class="wi-type">{{ typeLabel(log.type) }}</span>
          <span class="wi-meta">
            <span v-if="log.importedBy?.name" class="wi-by">{{ log.importedBy.name }}</span>
            <span v-else-if="log.importedBy?.email" class="wi-by">{{ log.importedBy.email }}</span>
            <span class="wi-dot" v-if="log.importedBy">·</span>
            <span class="wi-date">{{ formatDate(log.timestamp) }}</span>
          </span>
        </div>
      </li>

      <li v-if="!loading && !logs.length" class="wi-empty">
        Noch keine Imports vorhanden.
      </li>
    </ul>
  </DashboardWidget>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import DashboardWidget from "./DashboardWidget.vue";

const logs    = ref([]);
const loading = ref(true);

const TYPE_LABELS = {
  'einsatz-komplett': 'Zvoove Komplett',
  personal:           'Personal',
  beruf:              'Berufe',
  qualifikation:      'Qualifikationen',
  auftrag:            'Aufträge',
  kunde:              'Kunden',
  einsatz:            'Einsätze',
  personal_quali:     'Personal Quali',
  other:              'Sonstige',
};

const typeLabel = (t) => TYPE_LABELS[t] ?? t;

const statusIcon = (s) => {
  if (s === 'success') return ['fas', 'circle-check'];
  if (s === 'warning') return ['fas', 'triangle-exclamation'];
  return ['fas', 'circle-xmark'];
};

const formatDate = (d) =>
  d ? new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d)) : '—';

onMounted(async () => {
  try {
    const res = await api.get('/api/import/recent?limit=3');
    logs.value = res.data?.data ?? [];
  } catch (e) {
    console.error('WidgetImports fetch error:', e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="scss">
:deep(.dash-widget__icon) {
  color: var(--muted);
}

.wi-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wi-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border);

  &:last-child { border-bottom: none; }
}

.wi-icon-wrap {
  flex-shrink: 0;
  width: 22px;
  display: flex;
  justify-content: center;
}

.wi-icon {
  font-size: 14px;

  &--success { color: #22c55e; }
  &--warning { color: #f59e0b; }
  &--failed  { color: #ef4444; }
}

.wi-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wi-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.wi-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}

.wi-dot {
  opacity: 0.4;
}

.wi-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  background: var(--hover);
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
}

.wi-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 16px 0;
  text-align: center;
}
</style>
