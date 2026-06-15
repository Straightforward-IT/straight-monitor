<template>
  <teleport to="body">
    <div class="report-overlay" @click.self="$emit('close')">
      <div class="report-modal">

        <!-- Header -->
        <div class="report-header">
          <div class="report-title">
            <font-awesome-icon :icon="['fas', 'binoculars']" class="title-icon" />
            <span>Watchlist-Bericht</span>
          </div>
          <button class="close-btn" @click="$emit('close')">
            <font-awesome-icon :icon="['fas', 'times']" />
          </button>
        </div>

        <!-- Config bar -->
        <div class="report-config">
          <div class="config-field">
            <label>Ende Monat</label>
            <select v-model="selectedMonth" class="config-select">
              <option v-for="(name, idx) in MONTH_NAMES" :key="idx" :value="idx + 1">{{ name }}</option>
            </select>
          </div>
          <div class="config-field">
            <label>Jahr</label>
            <input v-model.number="selectedYear" type="number" min="2000" max="2100" class="config-input" />
          </div>
          <button class="btn-generate" :disabled="loading" @click="generate">
            <font-awesome-icon :icon="['fas', loading ? 'spinner' : 'magnifying-glass']" :spin="loading" />
            {{ loading ? 'Lädt…' : 'Generieren' }}
          </button>
        </div>

        <!-- Empty watchlist -->
        <div v-if="!loading && reportData && reportData.kunden.length === 0" class="report-empty">
          <font-awesome-icon :icon="['fas', 'binoculars']" class="empty-icon" />
          <p>Keine Kunden auf der Watchlist.</p>
        </div>

        <!-- Error -->
        <div v-if="error" class="report-error">{{ error }}</div>

        <!-- Report Table -->
        <div v-if="reportData && reportData.kunden.length > 0" class="report-body">
          <p class="report-subtitle">
            {{ reportData.periodLabel }}
            <span class="muted">
              — Vergleich mit {{ reportData.comparison.previousYear.periodLabel }}
            </span>
          </p>

          <div class="summary-grid">
            <div class="summary-tile">
              <span class="summary-value">{{ formatNumber(reportData.totals.current.bedarfCount) }}</span>
              <span class="summary-label">Bedarf</span>
            </div>
            <div class="summary-tile">
              <span class="summary-value">{{ formatNumber(reportData.totals.current.einsaetzeCount) }}</span>
              <span class="summary-label">Besetzte Einsätze</span>
            </div>
            <div class="summary-tile">
              <span class="summary-value">{{ formatNumber(reportData.totals.current.offenCount) }}</span>
              <span class="summary-label">Offen</span>
            </div>
            <div class="summary-tile">
              <span class="summary-value">{{ formatPercent(reportData.totals.current.besetzungsquote) }}</span>
              <span class="summary-label">Quote</span>
            </div>
          </div>

          <div class="ranking-grid">
            <RankingList title="Winners ggü. Vorjahr" :items="reportData.yoyWinners" empty-text="Keine Gewinner" />
            <RankingList title="Losers ggü. Vorjahr" :items="reportData.yoyLosers" empty-text="Keine Verlierer" />
          </div>

          <div class="table-wrapper">
            <table class="report-table">
              <thead>
                <tr>
                  <th class="col-kunde th-sortable" @click="setSort('kundName')">
                    Kunde
                    <font-awesome-icon v-if="sortKey === 'kundName'" :icon="['fas', sortAsc ? 'chevron-up' : 'chevron-down']" class="sort-icon" />
                    <font-awesome-icon v-else :icon="['fas', 'sort']" class="sort-icon muted" />
                  </th>
                  <th class="col-metric th-sortable" @click="setSort('bedarfCount')">
                    Bedarf
                    <font-awesome-icon v-if="sortKey === 'bedarfCount'" :icon="['fas', sortAsc ? 'chevron-up' : 'chevron-down']" class="sort-icon" />
                    <font-awesome-icon v-else :icon="['fas', 'sort']" class="sort-icon muted" />
                  </th>
                  <th class="col-metric th-sortable" @click="setSort('einsaetzeCount')">
                    Einsätze
                    <font-awesome-icon v-if="sortKey === 'einsaetzeCount'" :icon="['fas', sortAsc ? 'chevron-up' : 'chevron-down']" class="sort-icon" />
                    <font-awesome-icon v-else :icon="['fas', 'sort']" class="sort-icon muted" />
                  </th>
                  <th class="col-metric th-sortable" @click="setSort('offenCount')">
                    Offen
                    <font-awesome-icon v-if="sortKey === 'offenCount'" :icon="['fas', sortAsc ? 'chevron-up' : 'chevron-down']" class="sort-icon" />
                    <font-awesome-icon v-else :icon="['fas', 'sort']" class="sort-icon muted" />
                  </th>
                  <th class="col-metric th-sortable" @click="setSort('besetzungsquote')">
                    Quote
                    <font-awesome-icon v-if="sortKey === 'besetzungsquote'" :icon="['fas', sortAsc ? 'chevron-up' : 'chevron-down']" class="sort-icon" />
                    <font-awesome-icon v-else :icon="['fas', 'sort']" class="sort-icon muted" />
                  </th>
                  <th class="col-metric th-sortable" @click="setSort('auftraegeCount')">
                    Aufträge
                    <font-awesome-icon v-if="sortKey === 'auftraegeCount'" :icon="['fas', sortAsc ? 'chevron-up' : 'chevron-down']" class="sort-icon" />
                    <font-awesome-icon v-else :icon="['fas', 'sort']" class="sort-icon muted" />
                  </th>
                  <th class="col-delta th-sortable" @click="setSort('prevYearBedarf')">
                    Vorjahr (3 Mon.)
                    <font-awesome-icon v-if="sortKey === 'prevYearBedarf'" :icon="['fas', sortAsc ? 'chevron-up' : 'chevron-down']" class="sort-icon" />
                    <font-awesome-icon v-else :icon="['fas', 'sort']" class="sort-icon muted" />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="k in sortedKunden" :key="k.kundenNr">
                  <td class="col-kunde">
                    <span class="kunde-name">{{ k.kundName }}</span>
                    <span v-if="k.kuerzel" class="kunde-kuerzel">{{ k.kuerzel }}</span>
                  </td>
                  <td class="col-metric">
                    <MetricCell :current="k.current.bedarfCount" :prev="k.prevYear?.bedarfCount ?? 0" prev-label="VJ" />
                  </td>
                  <td class="col-metric">
                    <MetricCell :current="k.current.einsaetzeCount" :prev="k.prevYear?.einsaetzeCount ?? 0" prev-label="VJ" />
                  </td>
                  <td class="col-metric">
                    {{ formatNumber(k.current.offenCount) }}
                  </td>
                  <td class="col-metric">
                    {{ formatPercent(k.current.besetzungsquote) }}
                  </td>
                  <td class="col-metric">
                    {{ formatNumber(k.current.auftraegeCount) }}
                  </td>
                  <td class="col-delta">
                    <DeltaStack :delta="k.deltaPrevYear" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer actions -->
        <div class="report-footer">
          <span v-if="sendSuccess" class="send-success">
            <font-awesome-icon :icon="['fas', 'circle-check']" /> {{ sendSuccess }}
          </span>
          <div class="footer-actions">
            <button
              v-if="reportData && reportData.kunden.length > 0"
              class="btn-send"
              :disabled="sending"
              @click="sendReport"
            >
              <font-awesome-icon :icon="['fas', sending ? 'spinner' : 'envelope']" :spin="sending" />
              {{ sending ? 'Wird gesendet…' : 'Per E-Mail senden' }}
            </button>
            <button class="btn-close" @click="$emit('close')">Schließen</button>
          </div>
        </div>

      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, h, computed } from 'vue';
import api from '@/utils/api';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

defineEmits(['close']);

const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const now = new Date();
const defaultReportDate = new Date(now.getFullYear(), now.getMonth(), 0);
const selectedMonth = ref(defaultReportDate.getMonth() + 1);
const selectedYear  = ref(defaultReportDate.getFullYear());

const loading    = ref(false);
const sending    = ref(false);
const reportData = ref(null);
const error      = ref(null);
const sendSuccess = ref('');

const sortKey = ref('bedarfCount');
const sortAsc = ref(false);

function setSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = false;
  }
}

const sortedKunden = computed(() => {
  if (!reportData.value?.kunden) return [];
  const arr = [...reportData.value.kunden];
  const key = sortKey.value;
  const dir = sortAsc.value ? 1 : -1;
  arr.sort((a, b) => {
    let av, bv;
    if (key === 'kundName') {
      av = (a.kundName || '').toLowerCase();
      bv = (b.kundName || '').toLowerCase();
    } else if (key === 'prevYearBedarf') {
      av = a.deltaPrevYear?.bedarfCount?.absolute ?? 0;
      bv = b.deltaPrevYear?.bedarfCount?.absolute ?? 0;
    } else {
      av = a.current?.[key] ?? 0;
      bv = b.current?.[key] ?? 0;
    }
    if (av < bv) return -dir;
    if (av > bv) return dir;
    return 0;
  });
  return arr;
});

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value) {
  if (value === null || value === undefined) return '–';
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDelta(delta) {
  if (!delta) return '–';
  if (delta.absolute === 0) return '0';
  const sign = delta.absolute > 0 ? '+' : '';
  const pct = delta.percent !== null ? ` (${sign}${formatPercent(delta.percent)})` : '';
  return `${sign}${formatNumber(delta.absolute)}${pct}`;
}

async function generate() {
  loading.value = true;
  error.value   = null;
  sendSuccess.value = '';
  try {
    const { data } = await api.get('/api/users/me/kunden-watchlist/report', {
      params: { month: selectedMonth.value, year: selectedYear.value }
    });
    reportData.value = data;
  } catch (e) {
    error.value = e.response?.data?.msg || e.response?.data?.message || 'Fehler beim Generieren des Berichts.';
  } finally {
    loading.value = false;
  }
}

async function sendReport() {
  sending.value = true;
  sendSuccess.value = '';
  try {
    const { data } = await api.post('/api/users/me/kunden-watchlist/report/send', {
      month: selectedMonth.value,
      year:  selectedYear.value
    });
    sendSuccess.value = data.msg;
    if (data.report) reportData.value = data.report;
  } catch (e) {
    error.value = e.response?.data?.msg || e.response?.data?.message || 'Fehler beim Senden.';
  } finally {
    sending.value = false;
  }
}

// ── MetricCell as inline component (render fn — no runtime compiler needed) ──
const deltaClass = (delta) => {
  if (!delta || delta.absolute === 0) return 'flat';
  return delta.absolute > 0 ? 'up' : 'down';
};

const MetricCell = {
  props: { current: Number, prev: { type: Number, default: 0 }, prevLabel: { type: String, default: 'VM' } },
  setup(props) {
    return () => {
      const current = Number(props.current || 0);
      const prev = Number(props.prev || 0);
      const delta = { absolute: current - prev, percent: prev > 0 ? ((current - prev) / prev) * 100 : null };
      const curr = h('span', { class: 'metric-curr' }, formatNumber(current));
      const rest = [
        h('span', { class: ['metric-delta', deltaClass(delta)] }, formatDelta(delta)),
        h('span', { class: 'metric-prev' }, `${props.prevLabel}: ${formatNumber(prev)}`)
      ];
      return h('div', { class: 'metric-cell' }, [curr, ...rest]);
    };
  }
};

const DeltaStack = {
  props: { delta: Object },
  setup(props) {
    return () => {
      const bedarfDelta = props.delta?.bedarfCount;
      const einsatzDelta = props.delta?.einsaetzeCount;
      return h('div', { class: 'delta-stack' }, [
        h('span', { class: ['delta-main', deltaClass(bedarfDelta)] }, `Bedarf ${formatDelta(bedarfDelta)}`),
        h('span', { class: ['delta-sub', deltaClass(einsatzDelta)] }, `Einsätze ${formatDelta(einsatzDelta)}`)
      ]);
    };
  }
};

const RankingList = {
  props: { title: String, items: Array, emptyText: String },
  setup(props) {
    return () => h('div', { class: 'ranking-card' }, [
      h('div', { class: 'ranking-title' }, props.title),
      ...(props.items?.length
        ? props.items.map((item) => h('div', { class: 'ranking-row', key: item.kundenNr }, [
            h('span', { class: 'ranking-name' }, item.kundName || `#${item.kundenNr}`),
            h('span', { class: ['ranking-delta', deltaClass(item.delta)] }, formatDelta(item.delta))
          ]))
        : [h('div', { class: 'ranking-empty' }, props.emptyText || 'Keine Veränderung')])
    ]);
  }
};
</script>

<style scoped>
.report-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.report-modal {
  background: var(--modal-bg);
  border-radius: 14px;
  border: 1px solid var(--border);
  box-shadow: 0 24px 64px rgba(0,0,0,0.2);
  width: 100%;
  max-width: min(1440px, calc(100vw - 40px));
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
}

.report-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.title-icon { color: var(--primary); }

.close-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s;
}

.close-btn:hover { color: var(--text); }

/* Config */
.report-config {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-field label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}

.config-select,
.config-input {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 13px;
}

.config-input { width: 80px; }

.btn-generate {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-generate:hover { opacity: 0.85; }
.btn-generate:disabled { opacity: 0.5; cursor: not-allowed; }

/* Body */
.report-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 8px;
}

.report-subtitle {
  padding: 14px 0 10px;
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
}

.report-subtitle .muted { color: var(--muted); font-weight: 400; }

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.summary-tile {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-value {
  color: var(--text);
  font-size: 19px;
  font-weight: 600;
}

.summary-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.ranking-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

:deep(.ranking-card) {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--tile-bg);
}

:deep(.ranking-title) {
  color: var(--text);
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}

:deep(.ranking-row) {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  font-size: 12px;
}

:deep(.ranking-name) {
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.ranking-delta) {
  font-weight: 600;
  white-space: nowrap;
}

:deep(.ranking-empty) {
  color: var(--muted);
  font-size: 12px;
}

.table-wrapper { overflow-x: auto; }

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.report-table thead tr {
  background: var(--panel);
}

.report-table th {
  padding: 9px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--muted);
  white-space: nowrap;
}

.col-kunde  { text-align: left; min-width: 180px; }
.col-metric { text-align: center; min-width: 100px; }

.th-sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.th-sortable:hover { color: var(--text); }

.sort-icon {
  margin-left: 4px;
  font-size: 9px;
  vertical-align: middle;
  opacity: 0.9;
}
.sort-icon.muted { opacity: 0.3; }
.col-delta  { text-align: right; min-width: 140px; }

.report-table thead th.col-metric { text-align: center; }
.report-table thead th.col-delta { text-align: right; }

.report-table tbody tr:last-child td { border-bottom: none; }

.report-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

/* Kunde cell */
.col-kunde td, td.col-kunde {
  text-align: left;
}

.kunde-name { font-weight: 500; color: var(--text); }
.kunde-kuerzel {
  margin-left: 6px;
  font-size: 11px;
  color: var(--primary);
  background: rgba(238,175,103,0.12);
  padding: 1px 5px;
  border-radius: 4px;
}

/* Metric cell (via inline component) */
:deep(.metric-cell) {
  display: flex;
  flex-direction: column;
  align-items: inherit;
  gap: 2px;
  min-width: 70px;
}

.col-metric :deep(.metric-cell) { align-items: center; }

:deep(.metric-curr) {
  font-weight: 500;
  color: var(--text);
  font-size: 14px;
}

:deep(.metric-delta) {
  font-size: 10px;
  font-weight: 600;
}

:deep(.metric-delta.up)   { color: #16a34a; }
:deep(.metric-delta.down) { color: #dc2626; }
:deep(.metric-delta.flat) { color: var(--muted); }

:deep(.metric-prev) {
  font-size: 10px;
  color: var(--muted);
}

:deep(.metric-prev.no-prev) { color: var(--border); }

:deep(.delta-stack) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

:deep(.delta-main) {
  font-weight: 600;
  font-size: 12px;
}

:deep(.delta-sub) {
  font-size: 10px;
}

:deep(.up) { color: #16a34a; }
:deep(.down) { color: #dc2626; }
:deep(.flat) { color: var(--muted); }

/* Empty / Error states */
.report-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  gap: 10px;
  color: var(--muted);
}

.empty-icon { font-size: 36px; opacity: 0.3; }

.report-error {
  margin: 12px 24px;
  padding: 10px 14px;
  background: rgba(220,38,38,0.08);
  border: 1px solid rgba(220,38,38,0.25);
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
}

/* Footer */
.report-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-top: 1px solid var(--border);
  gap: 12px;
}

.footer-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.send-success {
  font-size: 13px;
  color: #16a34a;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-send {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
  border-radius: 7px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-send:hover { background: rgba(238,175,103,0.1); }
.btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-close {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.2s;
}

.btn-close:hover { background: var(--hover); }

@media (max-width: 780px) {
  .report-config,
  .report-footer {
    flex-wrap: wrap;
  }

  .summary-grid,
  .ranking-grid {
    grid-template-columns: 1fr;
  }
}
</style>
