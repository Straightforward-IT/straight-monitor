<template>
  <div class="window">
    <div class="page-header">
      <div class="header-left">
        <h1><font-awesome-icon :icon="['fas', 'file-signature']" /> Signaturen</h1>
      </div>
      <div class="header-stats" v-if="!loading">
        <span class="stat-chip stat-pending">{{ pendingCount }} Ausstehend</span>
        <span class="stat-chip stat-done">{{ completedCount }} Abgeschlossen</span>
      </div>
      <button class="btn-icon" title="Alle ausstehenden Status aktualisieren" :disabled="refreshingAll" @click="refreshAll">
        <font-awesome-icon :icon="['fas', 'rotate']" :spin="refreshingAll" />
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
        <span class="tab-count">{{ countForTab(tab.value) }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
      <p>Lade Signaturen…</p>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="empty-state">
      <font-awesome-icon :icon="['fas', 'file-signature']" size="2x" />
      <p>Keine Einträge vorhanden.</p>
    </div>

    <!-- Table -->
    <div v-else class="table-wrapper">
      <table class="sig-table">
        <thead>
          <tr>
            <th>Dokument</th>
            <th>Auftrag</th>
            <th>Unterzeichner</th>
            <th>Status</th>
            <th>Erstellt</th>
            <th class="th-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in filtered" :key="v._id" :class="`row-${v.status}`">
            <td>
              <div class="td-name">{{ v.name }}</div>
              <div class="td-template" v-if="v.docusealTemplateName">{{ v.docusealTemplateName }}</div>
            </td>
            <td>
              <span v-if="v.auftragNr" class="auftrag-badge">{{ v.auftragNr }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <div class="submitters-list">
                <div
                  v-for="s in v.submitters"
                  :key="s.slug || s.email"
                  class="submitter-row"
                  :class="`submitter-${s.status}`"
                  :title="s.email"
                >
                  <font-awesome-icon
                    :icon="submitterIcon(s.status)"
                    class="submitter-status-icon"
                  />
                  <span class="submitter-name">{{ s.name || s.email }}</span>
                  <span class="submitter-role">({{ s.role }})</span>
                </div>
              </div>
            </td>
            <td>
              <span class="status-badge" :class="`status-${v.status}`">
                <font-awesome-icon :icon="statusIcon(v.status)" />
                {{ statusLabel(v.status) }}
              </span>
            </td>
            <td class="td-date">{{ formatDate(v.createdAt) }}</td>
            <td class="td-actions">
              <div class="actions-wrap">
                <button
                  v-if="v.status === 'pending'"
                  class="btn-icon-sm"
                  title="Status aktualisieren"
                  :disabled="refreshing[v._id]"
                  @click="refreshOne(v)"
                >
                  <font-awesome-icon :icon="['fas', 'rotate']" :spin="refreshing[v._id]" />
                </button>
                <button
                  v-if="v.status === 'completed' && v.signedPdfKey"
                  class="btn-icon-sm btn-download"
                  title="Unterschriebenes PDF herunterladen"
                  :disabled="downloading[v._id]"
                  @click="downloadSigned(v)"
                >
                  <font-awesome-icon :icon="['fas', 'download']" :spin="downloading[v._id]" />
                </button>
                <a
                  v-if="v.auditLogUrl"
                  :href="v.auditLogUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-icon-sm"
                  title="Audit Log öffnen"
                >
                  <font-awesome-icon :icon="['fas', 'shield-halved']" />
                </a>
                <button
                  v-if="v.status !== 'archived'"
                  class="btn-icon-sm btn-danger"
                  title="Archivieren"
                  @click="archive(v)"
                >
                  <font-awesome-icon :icon="['fas', 'box-archive']" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const vorgaenge = ref([]);
const loading = ref(false);
const refreshing = ref({});
const refreshingAll = ref(false);
const downloading = ref({});

const activeTab = ref('all');
const tabs = [
  { label: 'Alle',          value: 'all' },
  { label: 'Ausstehend',    value: 'pending' },
  { label: 'Abgeschlossen', value: 'completed' },
  { label: 'Archiviert',    value: 'archived' },
];

const pendingCount   = computed(() => vorgaenge.value.filter(v => v.status === 'pending').length);
const completedCount = computed(() => vorgaenge.value.filter(v => v.status === 'completed').length);

function countForTab(tab) {
  if (tab === 'all') return vorgaenge.value.length;
  return vorgaenge.value.filter(v => v.status === tab).length;
}

const filtered = computed(() => {
  if (activeTab.value === 'all') return vorgaenge.value;
  return vorgaenge.value.filter(v => v.status === activeTab.value);
});

function statusLabel(s) {
  return { pending: 'Ausstehend', completed: 'Abgeschlossen', expired: 'Abgelaufen', archived: 'Archiviert' }[s] || s;
}
function statusIcon(s) {
  return {
    pending:   ['fas', 'clock'],
    completed: ['fas', 'circle-check'],
    expired:   ['fas', 'clock-rotate-left'],
    archived:  ['fas', 'box-archive'],
  }[s] || ['fas', 'circle'];
}
function submitterIcon(s) {
  return {
    completed: ['fas', 'circle-check'],
    awaiting:  ['fas', 'hourglass-half'],
    declined:  ['fas', 'circle-xmark'],
    opened:    ['fas', 'eye'],
    sent:      ['fas', 'envelope'],
  }[s] || ['fas', 'hourglass-half'];
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadAll() {
  loading.value = true;
  try {
    const { data } = await axios.get('/api/docuseal/');
    vorgaenge.value = Array.isArray(data) ? data : [];
    if (!Array.isArray(data)) console.error('Unexpected response from /api/docuseal/:', data);
  } catch (err) {
    console.error('Fehler beim Laden der Signaturen:', err);
    vorgaenge.value = [];
  } finally {
    loading.value = false;
  }
}

async function refreshOne(v) {
  refreshing.value = { ...refreshing.value, [v._id]: true };
  try {
    const { data } = await axios.get(`/api/docuseal/${v._id}?refresh=true`);
    const idx = vorgaenge.value.findIndex(x => x._id === v._id);
    if (idx !== -1) vorgaenge.value[idx] = data;
  } catch (err) {
    console.error('Fehler beim Aktualisieren:', err);
  } finally {
    refreshing.value = { ...refreshing.value, [v._id]: false };
  }
}

async function refreshAll() {
  refreshingAll.value = true;
  const pending = vorgaenge.value.filter(v => v.status === 'pending');
  await Promise.allSettled(pending.map(v => refreshOne(v)));
  refreshingAll.value = false;
}

async function downloadSigned(v) {
  downloading.value = { ...downloading.value, [v._id]: true };
  try {
    const resp = await axios.get(`/api/docuseal/${v._id}/signed`, { responseType: 'blob' });
    const url = URL.createObjectURL(resp.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${v.name.replace(/[^a-z0-9_\- ]/gi, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Fehler beim Herunterladen:', err);
    alert('Das Dokument konnte nicht heruntergeladen werden.');
  } finally {
    downloading.value = { ...downloading.value, [v._id]: false };
  }
}

async function archive(v) {
  if (!confirm(`„${v.name}" archivieren?`)) return;
  try {
    await axios.delete(`/api/docuseal/${v._id}`);
    const idx = vorgaenge.value.findIndex(x => x._id === v._id);
    if (idx !== -1) vorgaenge.value[idx] = { ...vorgaenge.value[idx], status: 'archived' };
  } catch (err) {
    console.error('Fehler beim Archivieren:', err);
  }
}

onMounted(loadAll);
</script>

<style lang="scss" scoped>
.window {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;

  .header-left { flex: 1; }

  h1 {
    font-size: 1.4rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

.header-stats {
  display: flex;
  gap: 8px;
}

.stat-chip {
  font-size: 0.78rem;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 20px;
  &.stat-pending  { background: color-mix(in srgb, var(--primary) 15%, transparent); color: var(--primary); }
  &.stat-done     { background: color-mix(in srgb, #22c55e 15%, transparent); color: #16a34a; }
}

// ── Filter Tabs ───────────────────────────────────────────────
.filter-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.filter-tab {
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.15s;

  &:hover { color: var(--text); }

  &.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
    font-weight: 500;
  }

  .tab-count {
    background: var(--bg-secondary, rgba(0,0,0,0.06));
    border-radius: 10px;
    padding: 1px 7px;
    font-size: 0.75rem;
  }
}

// ── Table ─────────────────────────────────────────────────────
.table-wrapper {
  overflow-x: auto;
}

.sig-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  th {
    text-align: left;
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  td {
    padding: 12px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  tr:last-child td { border-bottom: none; }

  tr.row-completed { opacity: 0.75; }
  tr.row-archived  { opacity: 0.45; }
}

.td-name {
  font-weight: 500;
  color: var(--text);
}
.td-template {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.auftrag-badge {
  display: inline-block;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.78rem;
  font-weight: 600;
}

.td-date {
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.th-actions { text-align: right; }
.td-actions { text-align: right; }

// ── Submitters ────────────────────────────────────────────────
.submitters-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.submitter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
}

.submitter-status-icon {
  font-size: 0.75rem;
  flex-shrink: 0;
}

.submitter-completed .submitter-status-icon { color: #22c55e; }
.submitter-awaiting  .submitter-status-icon { color: var(--primary); }
.submitter-declined  .submitter-status-icon { color: #ef4444; }
.submitter-opened    .submitter-status-icon { color: #3b82f6; }
.submitter-sent      .submitter-status-icon { color: #a855f7; }

.submitter-name { font-weight: 500; }
.submitter-role { color: var(--text-muted); font-size: 0.78rem; }

// ── Status Badge ──────────────────────────────────────────────
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;

  &.status-pending   { background: color-mix(in srgb, var(--primary) 15%, transparent); color: var(--primary); }
  &.status-completed { background: color-mix(in srgb, #22c55e 15%, transparent); color: #16a34a; }
  &.status-expired   { background: color-mix(in srgb, #f97316 15%, transparent); color: #c2410c; }
  &.status-archived  { background: color-mix(in srgb, #6b7280 15%, transparent); color: #6b7280; }
}

// ── Action Buttons ────────────────────────────────────────────
.actions-wrap {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.btn-icon {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.15s, border-color 0.15s;
  &:hover { color: var(--text); border-color: var(--text-muted); }
  &:disabled { opacity: 0.4; cursor: default; }
}

.btn-icon-sm {
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.82rem;
  transition: color 0.15s, border-color 0.15s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  &:hover { color: var(--text); border-color: var(--text-muted); }
  &:disabled { opacity: 0.4; cursor: default; }
  &.btn-download:hover { color: #16a34a; border-color: #16a34a; }
  &.btn-danger:hover   { color: #ef4444; border-color: #ef4444; }
}

// ── Empty / Loading ───────────────────────────────────────────
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--text-muted);
}

.text-muted { color: var(--text-muted); }
</style>
