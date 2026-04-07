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
            <label>Monat</label>
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

        <!-- Rechnungen warning -->
        <div v-if="rechnungenWarning" class="rechnungen-warning">
          <font-awesome-icon :icon="['fas', 'circle-exclamation']" />
          Für {{ MONTH_NAMES[selectedMonth - 1] }} {{ selectedYear }} liegen noch keine Rechnungen vor. Der Umsatz im Bericht wird daher leer sein.
        </div>

        <!-- Empty watchlist -->
        <div v-if="!loading && reportData && reportData.kunden.length === 0" class="report-empty">
          <font-awesome-icon :icon="['fas', 'binoculars']" class="empty-icon" />
          <p>Keine Kunden auf der Watchlist oder keine Daten für diesen Monat.</p>
        </div>

        <!-- Error -->
        <div v-if="error" class="report-error">{{ error }}</div>

        <!-- Report Table -->
        <div v-if="reportData && reportData.kunden.length > 0" class="report-body">
          <p class="report-subtitle">
            {{ MONTH_NAMES[reportData.month - 1] }} {{ reportData.year }}
            <span class="muted"> — Vergleich mit {{ MONTH_NAMES[reportData.month - 1] }} {{ reportData.year - 1 }}</span>
          </p>

          <div class="table-wrapper">
            <table class="report-table">
              <thead>
                <tr>
                  <th class="col-kunde">Kunde</th>
                  <th class="col-metric">Aufträge</th>
                  <th class="col-metric">Einsätze</th>
                  <th class="col-umsatz">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="k in reportData.kunden" :key="k.kundenNr">
                  <td class="col-kunde">
                    <span class="kunde-name">{{ k.kundName }}</span>
                    <span v-if="k.kuerzel" class="kunde-kuerzel">{{ k.kuerzel }}</span>
                  </td>
                  <td class="col-metric">
                    <MetricCell :current="k.current.auftraegeCount" :prev="k.prevYear?.auftraegeCount ?? null" />
                  </td>
                  <td class="col-metric">
                    <MetricCell :current="k.current.einsaetzeCount" :prev="k.prevYear?.einsaetzeCount ?? null" />
                  </td>
                  <td class="col-umsatz">
                    <MetricCell :current="k.current.umsatz" :prev="k.prevYear?.umsatz ?? null" currency />
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
import { ref, watch, h } from 'vue';
import api from '@/utils/api';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

defineEmits(['close']);

const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const now = new Date();
const selectedMonth = ref(now.getMonth() + 1);
const selectedYear  = ref(now.getFullYear());

const loading    = ref(false);
const sending    = ref(false);
const reportData = ref(null);
const error      = ref(null);
const sendSuccess = ref('');
const rechnungenWarning = ref(false);

let checkTimeout = null;
async function checkRechnungen() {
  try {
    const { data } = await api.get('/api/users/me/kunden-watchlist/report/check-rechnungen', {
      params: { month: selectedMonth.value, year: selectedYear.value }
    });
    rechnungenWarning.value = !data.available;
  } catch {
    rechnungenWarning.value = false;
  }
}

watch([selectedMonth, selectedYear], () => {
  clearTimeout(checkTimeout);
  rechnungenWarning.value = false;
  checkTimeout = setTimeout(checkRechnungen, 300);
}, { immediate: true });

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
    error.value = e.response?.data?.msg || 'Fehler beim Generieren des Berichts.';
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
  } catch (e) {
    error.value = e.response?.data?.msg || 'Fehler beim Senden.';
  } finally {
    sending.value = false;
  }
}

// ── MetricCell as inline component (render fn — no runtime compiler needed) ──
const MetricCell = {
  props: { current: Number, prev: { type: Number, default: null }, currency: Boolean },
  setup(props) {
    const fmt = (n) => props.currency
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0)
      : (n ?? 0).toLocaleString('de-DE');

    return () => {
      const curr = h('span', { class: 'metric-curr' }, fmt(props.current));
      const rest = props.prev !== null
        ? [
            h('span', { class: ['metric-delta', props.current >= props.prev ? 'up' : 'down'] },
              (props.current >= props.prev ? '▲ ' : '▼ ') +
              (props.prev !== 0 ? Math.abs(((props.current - props.prev) / props.prev) * 100).toFixed(1) + '%' : '')
            ),
            h('span', { class: 'metric-prev' }, 'VJ: ' + fmt(props.prev))
          ]
        : [h('span', { class: 'metric-prev no-prev' }, '–')];
      return h('div', { class: 'metric-cell' }, [curr, ...rest]);
    };
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
  max-width: 820px;
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

.rechnungen-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-top: none;
  color: #b45309;
  font-size: 13px;
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
.col-umsatz { text-align: right; min-width: 130px; }

.report-table thead th.col-metric { text-align: center; }
.report-table thead th.col-umsatz { text-align: right; }

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
.col-umsatz :deep(.metric-cell) { align-items: flex-end; }

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

:deep(.metric-prev) {
  font-size: 10px;
  color: var(--muted);
}

:deep(.metric-prev.no-prev) { color: var(--border); }

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
</style>
