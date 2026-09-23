<template>
  <DashboardWidget
    title="Offene Stundenlisten"
    :icon="['fas', 'file-signature']"
    title-link-to="/signaturen"
    :loading="loading"
  >
    <template #actions>
      <select
        v-model="selectedLocation"
        class="wp-select"
      >
        <option value="Alle">
          Alle
        </option>
        <option
          v-for="location in locations"
          :key="location._id"
          :value="location._id"
        >
          {{ location.shortName || location.nameFull }}
        </option>
      </select>
    </template>

    <ul class="ws-list">
      <li
        v-for="vorgang in stundenlisten"
        :key="vorgang._id"
        class="ws-item"
        :class="`ws-item--${vorgang.status}`"
      >
        <RouterLink
          :to="{ path: '/signaturen', query: { vorgangId: vorgang._id } }"
          class="ws-link"
        >
          <div class="ws-info">
            <span class="ws-title">{{ displayTitle(vorgang) }}</span>
            <div class="ws-meta">
              <span v-if="vorgang.kundenKuerzel">{{ vorgang.kundenKuerzel }}</span>
              <span>{{ formatDate(vorgang.createdAt) }}</span>
            </div>
          </div>
          <div class="ws-side">
            <span
              class="ws-status"
              :class="`ws-status--${vorgang.status}`"
            >
              <span class="ws-status-dot" />
              {{ statusLabel(vorgang) }}
              <span class="ws-status-count">{{ signProgress(vorgang) }}</span>
            </span>
            <font-awesome-icon
              :icon="['fas', 'chevron-right']"
              class="ws-arrow"
            />
          </div>
        </RouterLink>
      </li>
      <li
        v-if="!loading && !stundenlisten.length"
        class="ws-empty"
      >
        Keine offenen Stundenlisten.
      </li>
    </ul>
  </DashboardWidget>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import DashboardWidget from './DashboardWidget.vue';

const auth = useAuth();
const selectedLocation = ref('Alle');
const locations = ref([]);
const vorgaenge = ref([]);
const loading = ref(false);
const locationInitialized = ref(false);

const STATUS_LABELS = { draft: 'Entwurf', open: 'Offen', completed: 'Abgeschlossen', cancelled: 'Storniert' };

const stundenlisten = computed(() => vorgaenge.value
  .filter((vorgang) => vorgang.typKey === 'stundenliste'));

function statusLabel(vorgang) {
  return STATUS_LABELS[vorgang.status] || vorgang.status;
}

function signProgress(vorgang) {
  const submitters = Array.isArray(vorgang.submitters) ? vorgang.submitters : [];
  const signed = vorgang.status === 'completed'
    ? submitters.length
    : submitters.filter((submitter) => submitter.status === 'completed').length;
  return `${signed}/${submitters.length}`;
}

function displayTitle(vorgang) {
  const name = String(vorgang.name || '').replace(/^\s*Stundenliste\s*/i, '').trim();
  return name || `#${vorgang.auftragNr || '—'}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function loadVorgaenge() {
  loading.value = true;
  try {
    const { data } = await api.get('/api/signaturen', {
      params: {
        status: 'open',
        limit: 50,
        ...(selectedLocation.value !== 'Alle' ? { locationV2: selectedLocation.value } : {}),
      },
    });
    vorgaenge.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Offene Stundenlisten konnten nicht geladen werden:', error);
    vorgaenge.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => auth.user,
  (user) => {
    if (!locationInitialized.value && user?.locationV2) {
      selectedLocation.value = String(user.locationV2?._id || user.locationV2);
      locationInitialized.value = true;
    }
  },
  { immediate: true },
);

watch(selectedLocation, loadVorgaenge);

onMounted(async () => {
  const { data } = await api.get('/api/locations');
  locations.value = data || [];
  loadVorgaenge();
});
</script>

<style scoped lang="scss">
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

.ws-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ws-item {
  list-style: none;
  border-left: 3px solid transparent;
  border-radius: 3px;

  &--open { border-left-color: #f59e0b; }
  &--completed { border-left-color: #10b981; }
  &--draft { border-left-color: var(--muted); }
  &--cancelled { border-left-color: #ef4444; }
}

.ws-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 4px 7px 8px;
  border-radius: 0 7px 7px 0;
  color: inherit;
  text-decoration: none;
  transition: background 0.12s;

  &:hover {
    background: var(--hover);

    .ws-arrow {
      opacity: 1;
    }
  }
}

.ws-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
}

.ws-title {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-meta {
  display: flex;
  gap: 7px;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.ws-meta span:not(:last-child)::after {
  margin-left: 7px;
  content: '·';
}

.ws-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ws-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;

  &--open { background: color-mix(in srgb, #f59e0b 16%, transparent); color: #f59e0b; }
  &--completed { background: color-mix(in srgb, #10b981 16%, transparent); color: #10b981; }
  &--draft { background: var(--hover); color: var(--muted); }
  &--cancelled { background: color-mix(in srgb, #ef4444 14%, transparent); color: #ef4444; }
}

.ws-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.ws-status-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.ws-arrow {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 10px;
  opacity: 0;
  transition: opacity 0.12s;
}

.ws-empty {
  padding: 16px 0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}
</style>