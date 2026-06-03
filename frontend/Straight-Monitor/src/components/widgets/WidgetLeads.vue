<template>
  <DashboardWidget
    title="Leads"
    :icon="['fas', 'bullseye']"
    :loading="loading"
    :title-link-to="{ path: '/kunden', query: { tab: 'leads' } }"
  >
    <template #actions>
      <span class="wld-count">{{ openCount }} offen</span>
    </template>

    <ul class="wld-list">
      <li v-for="lead in visibleLeads" :key="lead._id" class="wld-item">
        <div
          class="wld-link"
          role="button"
          tabindex="0"
          @click="goToLead(lead)"
          @keydown.enter="goToLead(lead)"
        >
          <span class="wld-stage-dot" :style="{ background: stufeColor(lead.stufe) }" />
          <div class="wld-body">
            <div class="wld-top">
              <span class="wld-title">{{ lead.title }}</span>
              <span v-if="lead.wert != null" class="wld-value">
                {{ formatCurrency(lead.wert, lead.waehrung) }}
              </span>
            </div>
            <div class="wld-meta">
              <span v-if="lead.standort" class="wld-standort">{{ standortShort(lead.standort) }}</span>
              <span class="wld-stage">{{ stufeLabel(lead.stufe) }}</span>
              <span v-if="ownerName(lead)" class="wld-owner">· {{ ownerName(lead) }}</span>
            </div>
          </div>
          <font-awesome-icon
            v-if="lead.isFavorite"
            :icon="['fas', 'star']"
            class="wld-fav"
          />
        </div>
      </li>
      <li v-if="!loading && !visibleLeads.length" class="wld-empty">
        <font-awesome-icon :icon="['fas', 'bullseye']" class="wld-empty-icon" />
        Keine offenen Leads
      </li>
    </ul>
  </DashboardWidget>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import DashboardWidget from './DashboardWidget.vue';

const router = useRouter();

const loading = ref(false);
const leads = ref([]);

// ── Stufe metadata (mirrors LeadsTab pipeline stages) ─────────────────────
const STUFE_META = {
  neu:          { label: 'Neu',          color: '#64748b' },
  qualifiziert: { label: 'Qualifiziert', color: '#3b82f6' },
  angebot:      { label: 'Angebot',      color: '#8b5cf6' },
  verhandlung:  { label: 'Verhandlung',  color: '#f59e0b' },
  gewonnen:     { label: 'Gewonnen',     color: '#10b981' },
  verloren:     { label: 'Verloren',     color: '#ef4444' },
};

function stufeLabel(s) { return STUFE_META[s]?.label ?? s ?? '–'; }
function stufeColor(s) { return STUFE_META[s]?.color ?? 'var(--muted)'; }

const STANDORT_SHORT = { Hamburg: 'HH', Berlin: 'B', 'Köln': 'K' };
function standortShort(s) { return STANDORT_SHORT[s] ?? s; }

// ── Open leads, newest first, top 8 ───────────────────────────────────────
const openCount = computed(() => leads.value.length);

const visibleLeads = computed(() =>
  [...leads.value]
    .sort((a, b) => {
      // Favorites first, then newest
      if (!!b.isFavorite !== !!a.isFavorite) return b.isFavorite ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 8)
);

// ── Helpers ───────────────────────────────────────────────────────────────
function ownerName(lead) {
  const o = lead.eigentuemer;
  if (!o || typeof o !== 'object') return '';
  return o.name || o.email || '';
}

function formatCurrency(n, currency = 'EUR') {
  if (n == null) return '';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function goToLead(lead) {
  router.push({ path: '/kunden', query: { tab: 'leads', lead: String(lead._id) } });
}

// ── API ───────────────────────────────────────────────────────────────────
async function fetchLeads() {
  loading.value = true;
  try {
    const { data } = await api.get('/api/leads', { params: { status: 'open' } });
    leads.value = Array.isArray(data) ? data : [];
  } catch {
    leads.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchLeads);
</script>

<style scoped lang="scss">
.wld-count {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(var(--primary-rgb, 238 175 103) / 0.18);
  color: var(--primary);
  border: 1px solid rgba(var(--primary-rgb, 238 175 103) / 0.35);
  white-space: nowrap;
}

.wld-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wld-item {
  border-radius: 8px;
  overflow: hidden;
}

.wld-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text);
  transition: background 0.12s;

  &:hover {
    background: var(--hover);
  }
}

.wld-stage-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.wld-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wld-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  justify-content: space-between;
}

.wld-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wld-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;
}

.wld-meta {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wld-standort {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  line-height: 1.4;
}

.wld-stage {
  font-weight: 500;
}

.wld-owner {
  overflow: hidden;
  text-overflow: ellipsis;
}

.wld-fav {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--primary);
}

.wld-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 10px;
  font-size: 13px;
  color: var(--muted);
}

.wld-empty-icon {
  font-size: 15px;
  opacity: 0.5;
}
</style>
