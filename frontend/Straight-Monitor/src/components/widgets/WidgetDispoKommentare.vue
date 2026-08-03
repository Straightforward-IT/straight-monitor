<template>
  <DashboardWidget
    title="Kommentare"
    :icon="['fas', 'comment-dots']"
    :loading="loading"
  >
    <template #actions>
      <select v-model="selectedLocation" class="wdk-select">
        <option value="Alle">Alle</option>
        <option v-for="location in locations" :key="location._id" :value="location._id">
          {{ location.shortName || location.nameFull }}
        </option>
      </select>
    </template>

    <ul class="wdk-list">
      <li v-for="item in visibleItems" :key="item._id" class="wdk-item">
        <div class="wdk-link" role="button" tabindex="0" @click="goToDispo(item)" @keydown.enter="goToDispo(item)">
          <div class="wdk-body">
            <div class="wdk-top">
              <span class="wdk-name">{{ item.maName }}</span>
              <span class="wdk-scope">{{ scopeLabel(item.scope) }}</span>
              <span v-if="item.datum" class="wdk-date">{{ formatDate(item.datum) }}</span>
            </div>
            <p class="wdk-text">{{ truncate(item.text, 70) }}</p>
            <span class="wdk-author">von {{ item.author }}</span>
          </div>
          <span class="wdk-badge">Neu</span>
        </div>
      </li>
      <li v-if="!loading && !visibleItems.length" class="wdk-empty">
        <font-awesome-icon :icon="['fas', 'check-circle']" class="wdk-empty-icon" />
        Keine ungelesenen Kommentare
      </li>
    </ul>

  </DashboardWidget>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import { useDataCache } from '@/stores/dataCache';
import { useComments } from '@/stores/comments';
import DashboardWidget from './DashboardWidget.vue';

const auth = useAuth();
const cache = useDataCache();
const store = useComments();
const router = useRouter();

const loading = computed(
  () => store.loading || (cache.loading?.mitarbeiter && cache.mitarbeiter.length === 0)
);

// ── Standort filter — defaults to user's location ─────────────────────────
const locations = ref([]);
const selectedLocation = ref('Alle');
const _locationInitialized = ref(false);
watch(
  () => auth.user,
  (u) => {
    if (!_locationInitialized.value && u?.locationV2) {
      selectedLocation.value = String(u.locationV2?._id || u.locationV2);
      _locationInitialized.value = true;
    }
  },
  { immediate: true }
);

// ── MA index for O(1) name + standort lookup ──────────────────────────────
const maMap = computed(() => {
  const map = {};
  for (const ma of cache.mitarbeiter) {
    map[String(ma._id)] = ma;
  }
  return map;
});

function getMaName(maId) {
  const ma = maMap.value[String(maId)];
  if (!ma) return 'Unbekannt';
  return `${ma.vorname} ${ma.nachname}`;
}

// ── Unread filter ─────────────────────────────────────────────────────────
const unreadKommentare = computed(() => {
  const userId = String(auth.user?._id ?? '');
  if (!userId) return [];
  return store.items.filter((c) => {
    const isOwn = String(c.authorId) === userId;
    const isRead = (c.readBy ?? []).map(String).includes(userId);
    return !isOwn && !isRead;
  });
});

// ── Standort filter ───────────────────────────────────────────────────────
const filteredKommentare = computed(() => {
  if (selectedLocation.value === 'Alle') return unreadKommentare.value;
  return unreadKommentare.value.filter((c) => {
    const maId = c.context?.mitarbeiter;
    const ma = maMap.value[String(maId)];
    const location = c.locationV2 || ma?.locationV2;
    return String(location?._id || location) === selectedLocation.value;
  });
});

const totalUnread = computed(() => filteredKommentare.value.length);

// ── Visible items — enriched with MA name, sorted newest first ────────────
const visibleItems = computed(() =>
  [...filteredKommentare.value]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map((c) => ({ ...c, mitarbeiter: c.context?.mitarbeiter, datum: c.context?.datum, timestamp: c.createdAt, maName: getMaName(c.context?.mitarbeiter) }))
);

// ── Helpers ───────────────────────────────────────────────────────────────
const SCOPE_LABELS = { dispo_day: 'Dispo', chronik: 'Chronik', event_report: 'Event' };
function scopeLabel(scope) { return SCOPE_LABELS[scope] ?? scope; }

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.`;
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function goToDispo(item) {
  const ma = maMap.value[String(item.mitarbeiter)];
  const query = { resetPlanung: '1', showHidden: '1' };
  const location = item.locationV2 || ma?.locationV2;
  if (location) query.locationV2 = String(location?._id || location);
  if (item.datum) query.datum = item.datum;
  if (item.mitarbeiter) query.maId = String(item.mitarbeiter);
  router.push({ path: '/dispo', query });
}

// ── API ───────────────────────────────────────────────────────────────────
async function fetchKommentare() {
  if (!store.items.length) {
    const today = new Date();
    const von = new Date(today);
    von.setDate(von.getDate() - 14);
    const bis = new Date(today);
    bis.setDate(bis.getDate() + 30);
    const vonStr = von.toISOString().slice(0, 10);
    const bisStr = bis.toISOString().slice(0, 10);
    await Promise.all([
      store.fetch({ scope: 'dispo_day', von: vonStr, bis: bisStr }),
      store.fetch({ scope: 'chronik' }),
    ]);
  }
}

onMounted(() => {
  Promise.all([
    cache.loadMitarbeiter(),
    fetchKommentare(),
    api.get('/api/locations').then(({ data }) => { locations.value = data || []; }),
  ]);
});
</script>

<style scoped lang="scss">
.wdk-select {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}

.wdk-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wdk-item {
  border-radius: 8px;
  overflow: hidden;
  transition: background 0.12s;
}

.wdk-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  text-decoration: none;
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: var(--hover);
  }
}

.wdk-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wdk-top {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.wdk-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wdk-date {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.wdk-scope {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--hover);
  border: 1px solid var(--border);
  color: var(--muted);
  flex-shrink: 0;
  margin-left: 4px;
}

.wdk-text {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.wdk-author {
  font-size: 10px;
  color: color-mix(in srgb, var(--muted) 70%, transparent);
}

.wdk-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
  background: rgba(var(--primary-rgb, 238 175 103) / 0.18);
  color: var(--primary);
  border: 1px solid rgba(var(--primary-rgb, 238 175 103) / 0.35);
  letter-spacing: 0.03em;
}

.wdk-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 10px;
  font-size: 13px;
  color: var(--muted);
}

.wdk-empty-icon {
  color: #10b981;
  font-size: 15px;
}
</style>
