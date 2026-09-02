<template>
  <section class="inventory-history">
    <div class="inventory-history__controls">
      <label class="item-selector">
        <span>Artikel</span>
        <select v-model="selectedItemId" :disabled="catalogLoading" @change="loadHistory">
          <option value="">Gegenstand auswählen…</option>
          <option v-for="item in catalogue" :key="item._id" :value="String(item._id)">
            {{ item.bezeichnung }}{{ item.isActive ? '' : ' (inaktiv)' }}
          </option>
        </select>
      </label>

      <div class="mode-selector" aria-label="Graph-Darstellung">
        <span>Darstellung</span>
        <div class="mode-selector__chips">
          <FilterChip :active="mode === 'events'" @click="mode = 'events'">Einzelereignisse</FilterChip>
          <FilterChip :active="mode === 'daily'" @click="mode = 'daily'">Tagesendbestand</FilterChip>
        </div>
      </div>
    </div>

    <div v-if="catalogLoading" class="history-state" role="status">Artikel werden geladen…</div>
    <div v-else-if="catalogError" class="history-state history-state--error" role="alert">
      {{ catalogError }}
      <button type="button" @click="loadCatalogue">Erneut versuchen</button>
    </div>
    <div v-else-if="!selectedItemId" class="history-state">
      Wähle einen Artikel aus, um seinen Bestand seit der Anlage anzuzeigen.
    </div>

    <template v-else>
      <div v-if="historyLoading" class="history-state" role="status">Verlauf wird geladen…</div>
      <div v-else-if="historyError" class="history-state history-state--error" role="alert">
        {{ historyError }}
        <button type="button" @click="loadHistory">Erneut versuchen</button>
      </div>

      <template v-else-if="selectedItem">
        <div class="item-summary">
          <div class="item-summary__identity">
            <strong>{{ selectedItem.bezeichnung }}</strong>
            <span class="status-pill" :class="selectedItem.isActive ? 'status-pill--active' : 'status-pill--inactive'">
              {{ selectedItem.isActive ? 'Aktiv' : 'Inaktiv' }}
            </span>
          </div>
          <dl>
            <div><dt>Angelegt</dt><dd>{{ formatDateTime(selectedItem.createdAt) }}</dd></div>
            <div><dt>Bestand aktuell</dt><dd>{{ currentBestand }}</dd></div>
            <div><dt>Ereignisse</dt><dd>{{ events.length }}</dd></div>
            <div><dt>Entnahme</dt><dd>{{ movementTotals.entnahme }}</dd></div>
            <div><dt>Zugabe</dt><dd>{{ movementTotals.zugabe }}</dd></div>
          </dl>
        </div>

        <div class="chart-panel">
          <div v-if="hasChartData" class="chart-container">
            <Line :data="chartData" :options="chartOptions" />
          </div>
          <div v-else class="history-state history-state--embedded">
            Der Bestandsverlauf für diesen Artikel konnte nicht ermittelt werden.
          </div>
        </div>

        <section class="event-ledger" aria-labelledby="inventory-ledger-title">
          <div class="event-ledger__header">
            <div>
              <h2 id="inventory-ledger-title">Monitoring-Ereignisse</h2>
              <p>Vollständige Details zum ausgewählten Item_New.</p>
            </div>
            <span>{{ events.length }} {{ events.length === 1 ? 'Eintrag' : 'Einträge' }}</span>
          </div>

          <div v-if="!events.length" class="history-state history-state--embedded">
            Seit der Anlage des Artikels wurden keine Monitoring-Ereignisse gefunden.
          </div>

          <div v-else class="ledger-table-wrap">
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Art / Anzahl</th>
                  <th>Bestandszeilen</th>
                  <th>Standort</th>
                  <th>Mitarbeiter</th>
                  <th>Benutzer</th>
                  <th>Paket / Anmerkung</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="event in reversedEvents"
                  :key="event.id"
                  :class="{ 'ledger-row--cancelled': event.cancelled }"
                >
                  <td data-label="Zeitpunkt">{{ formatDateTime(event.timestamp) }}</td>
                  <td data-label="Art / Anzahl">
                    <span class="movement-pill" :class="`movement-pill--${event.art}`">{{ artLabel(event.art) }}</span>
                    <strong>{{ displayQuantity(event) }}</strong>
                  </td>
                  <td data-label="Bestandszeilen">
                    <div v-for="line in event.lines" :key="`${event.id}-${line.index}`" class="stock-line" :class="{ 'stock-line--cancelled': line.cancelled }">
                      <span>{{ line.variation || 'Standard' }} · {{ line.groesse || 'Onesize' }}</span>
                      <small>Anzahl {{ line.quantity }}<template v-if="line.soll != null"> · Soll {{ line.soll }}</template></small>
                    </div>
                  </td>
                  <td data-label="Standort">{{ event.standort || '—' }}</td>
                  <td data-label="Mitarbeiter">
                    <template v-if="event.mitarbeiter">
                      {{ event.mitarbeiter.name || '—' }}
                      <small v-if="event.mitarbeiter.personalnr">PNr. {{ event.mitarbeiter.personalnr }}</small>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td data-label="Benutzer">
                    {{ event.benutzer.name || event.benutzer.email || '—' }}
                    <small v-if="event.benutzer.name && event.benutzer.email">{{ event.benutzer.email }}</small>
                  </td>
                  <td data-label="Paket / Anmerkung">
                    <strong v-if="event.packageTemplateName">{{ event.packageTemplateName }}</strong>
                    <span v-if="event.anmerkung">{{ event.anmerkung }}</span>
                    <template v-if="!event.packageTemplateName && !event.anmerkung">—</template>
                  </td>
                  <td data-label="Status">
                    <span v-if="event.cancelled" class="cancelled-label">Storniert</span>
                    <span v-else-if="event.partiallyCancelled" class="partial-label">Teilweise storniert</span>
                    <span v-else class="effective-label">Wirksam</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { Line } from 'vue-chartjs';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import api from '@/utils/api';
import { useTheme } from '@/stores/theme';
import FilterChip from '@/components/ui-elements/FilterChip.vue';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  LineController,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

const theme = useTheme();
const catalogue = ref([]);
const catalogLoading = ref(false);
const catalogError = ref('');
const selectedItemId = ref('');
const selectedItem = ref(null);
const events = ref([]);
const historyLoading = ref(false);
const historyError = ref('');
const mode = ref('daily');
let requestSequence = 0;

const reversedEvents = computed(() => [...events.value].reverse());

const movementTotals = computed(() => events.value.reduce((totals, event) => {
  if (event.art === 'entnahme' || event.art === 'zugabe') totals[event.art] += Number(event.quantity || 0);
  return totals;
}, { entnahme: 0, zugabe: 0 }));

const currentBestand = computed(() => Number(selectedItem.value?.currentBestand || 0));

function movementDelta(event) {
  const quantity = Number(event.quantity || 0);
  if (event.art === 'zugabe') return quantity;
  if (event.art === 'entnahme') return -quantity;
  return 0;
}

const initialBestand = computed(() => {
  const netMovement = events.value.reduce((total, event) => total + movementDelta(event), 0);
  return currentBestand.value - netMovement;
});

function localDayKey(value) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dayDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

const inventoryPoints = computed(() => {
  if (!selectedItem.value?.createdAt) return [];

  const sortedEvents = [...events.value].sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
  const points = [{
    x: new Date(selectedItem.value.createdAt),
    y: initialBestand.value,
    events: [],
    markerLabel: 'Bestand bei Artikelanlage',
  }];
  let balance = initialBestand.value;

  if (mode.value === 'events') {
    for (const event of sortedEvents) {
      balance += movementDelta(event);
      points.push({ x: new Date(event.timestamp), y: balance, events: [event] });
    }
  } else {
    const days = new Map();
    for (const event of sortedEvents) {
      const key = localDayKey(event.timestamp);
      const entry = days.get(key) || { events: [], delta: 0 };
      entry.delta += movementDelta(event);
      entry.events.push(event);
      days.set(key, entry);
    }

    for (const [key, entry] of days) {
      balance += entry.delta;
      points.push({ x: dayDate(key), y: balance, events: entry.events });
    }
  }

  const latestTimestamp = sortedEvents.reduce((latest, event) => {
    const timestamp = new Date(event.timestamp).getTime();
    return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
  }, 0);
  points.push({
    x: new Date(Math.max(Date.now(), latestTimestamp)),
    y: currentBestand.value,
    events: [],
    markerLabel: 'Aktueller Bestand',
  });

  return points;
});

function pointColor(context) {
  const pointEvents = context.raw?.events || [];
  const hasWithdrawal = pointEvents.some((event) => event.art === 'entnahme' && Number(event.quantity) > 0);
  const hasAddition = pointEvents.some((event) => event.art === 'zugabe' && Number(event.quantity) > 0);
  if (hasWithdrawal && !hasAddition) return 'rgb(190, 55, 55)';
  if (hasAddition && !hasWithdrawal) return 'rgb(22, 163, 74)';
  return 'rgb(224, 145, 66)';
}

const chartData = computed(() => ({
  datasets: [
    {
      label: 'Bestand',
      data: inventoryPoints.value,
      parsing: { xAxisKey: 'x', yAxisKey: 'y' },
      backgroundColor: 'rgba(224, 145, 66, 0.15)',
      borderColor: 'rgb(224, 145, 66)',
      borderWidth: 2,
      fill: true,
      stepped: 'before',
      tension: 0,
      pointBackgroundColor: pointColor,
      pointBorderColor: pointColor,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
  ],
}));

const hasChartData = computed(() => chartData.value.datasets.some((dataset) => dataset.data.length));

function tooltipDetails(event) {
  const delta = movementDelta(event);
  const details = [`${artLabel(event.art)}: ${delta > 0 ? '+' : ''}${delta}`];
  if (event.standort) details.push(`Standort: ${event.standort}`);
  for (const line of event.lines) {
    details.push(`${line.variation || 'Standard'} · ${line.groesse || 'Onesize'}: ${line.quantity}${line.cancelled ? ' (storniert)' : ''}${line.soll == null ? '' : ` · Soll ${line.soll}`}`);
  }
  if (event.mitarbeiter?.name) details.push(`Mitarbeiter: ${event.mitarbeiter.name}${event.mitarbeiter.personalnr ? ` (${event.mitarbeiter.personalnr})` : ''}`);
  if (event.benutzer?.name || event.benutzer?.email) details.push(`Benutzer: ${event.benutzer.name || event.benutzer.email}`);
  if (event.packageTemplateName) details.push(`Paket: ${event.packageTemplateName}`);
  if (event.anmerkung) details.push(`Anmerkung: ${event.anmerkung}`);
  if (event.cancelled) details.push('Status: storniert');
  if (event.partiallyCancelled) details.push('Status: teilweise storniert');
  return details;
}

const chartOptions = computed(() => {
  const dark = theme.isDark;
  const textColor = dark ? '#d2d2d2' : '#374151';
  const gridColor = dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
  const createdAt = selectedItem.value?.createdAt ? new Date(selectedItem.value.createdAt) : undefined;
  const latestEventAt = events.value.reduce((latest, event) => {
    const timestamp = new Date(event.timestamp).getTime();
    return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
  }, 0);
  const visibleEnd = Math.max(Date.now(), latestEventAt);
  const timelineDuration = createdAt ? Math.max(visibleEnd - createdAt.getTime(), 0) : 0;
  const rightPadding = Math.max(24 * 60 * 60 * 1000, timelineDuration * 0.04);

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: mode.value === 'daily' ? 'index' : 'nearest' },
    scales: {
      x: {
        type: 'time',
        min: createdAt,
        max: new Date(visibleEnd + rightPadding),
        time: {
          unit: mode.value === 'daily' ? 'day' : undefined,
          tooltipFormat: mode.value === 'daily' ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm',
          displayFormats: { hour: 'dd.MM. HH:mm', day: 'dd.MM.yy', month: 'MMM yy' },
        },
        ticks: { color: textColor, maxTicksLimit: 12, maxRotation: 0 },
        grid: { color: gridColor },
        title: { display: true, text: `Seit ${formatDateTime(selectedItem.value?.createdAt)}`, color: textColor },
      },
      y: {
        beginAtZero: true,
        ticks: { color: textColor, precision: 0 },
        grid: { color: gridColor },
        title: { display: true, text: 'Bestand', color: textColor },
      },
    },
    plugins: {
      legend: { labels: { color: textColor, usePointStyle: true } },
      tooltip: {
        backgroundColor: dark ? '#262626' : '#ffffff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: dark ? '#525252' : '#d1d5db',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => `Bestand: ${context.parsed.y}`,
          afterLabel: (context) => {
            const pointEvents = context.raw?.events || [];
            const prefix = mode.value === 'daily' && pointEvents.length > 1 ? [`${pointEvents.length} Ereignisse:`] : [];
            const marker = context.raw?.markerLabel ? [context.raw.markerLabel] : [];
            return [...marker, ...prefix, ...pointEvents.flatMap(tooltipDetails)];
          },
        },
      },
    },
  };
});

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function artLabel(art) {
  return { entnahme: 'Entnahme', zugabe: 'Zugabe', änderung: 'Änderung' }[art] || art || 'Unbekannt';
}

function displayQuantity(event) {
  if (event.cancelled) return `${event.recordedQuantity} storniert`;
  if (event.partiallyCancelled) return `${event.quantity} wirksam / ${event.recordedQuantity} erfasst`;
  return event.recordedQuantity;
}

async function loadCatalogue() {
  catalogLoading.value = true;
  catalogError.value = '';
  try {
    const { data } = await api.get('/api/inventory/items');
    catalogue.value = [...(data || [])]
      .filter((item) => item.isActive)
      .sort((left, right) => left.bezeichnung.localeCompare(right.bezeichnung, 'de'));
  } catch (error) {
    catalogError.value = error.response?.data?.message || 'Die Artikelliste konnte nicht geladen werden.';
  } finally {
    catalogLoading.value = false;
  }
}

async function loadHistory() {
  const itemId = selectedItemId.value;
  const sequence = ++requestSequence;
  selectedItem.value = null;
  events.value = [];
  historyError.value = '';
  if (!itemId) return;

  historyLoading.value = true;
  try {
    const { data } = await api.get(`/api/monitoring/inventory-item/${itemId}`);
    if (sequence !== requestSequence) return;
    selectedItem.value = data.item;
    events.value = data.events || [];
  } catch (error) {
    if (sequence !== requestSequence) return;
    historyError.value = error.response?.data?.message || 'Der Artikelverlauf konnte nicht geladen werden.';
  } finally {
    if (sequence === requestSequence) historyLoading.value = false;
  }
}

onMounted(loadCatalogue);
</script>

<style scoped>
.inventory-history {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  color: var(--text);
}

.inventory-history__controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
}

.item-selector,
.mode-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.item-selector { flex: 1 1 420px; }

.item-selector select {
  width: 100%;
  min-height: 42px;
  padding: 8px 38px 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font: inherit;
}

.item-selector select:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.mode-selector__chips { display: flex; gap: 8px; }

.history-state {
  padding: 40px 20px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--muted);
  text-align: center;
}

.history-state--embedded { border: 0; }
.history-state--error { color: #c3423f; }

.history-state button {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
}

.item-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.item-summary__identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.item-summary__identity strong {
  overflow: hidden;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill,
.movement-pill,
.cancelled-label,
.partial-label,
.effective-label {
  display: inline-flex;
  align-items: center;
  width: max-content;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.status-pill--active,
.effective-label,
.movement-pill--zugabe { background: rgba(34, 197, 94, 0.14); color: #16a34a; }
.status-pill--inactive { background: var(--hover); color: var(--muted); }
.movement-pill--entnahme,
.cancelled-label { background: rgba(220, 82, 82, 0.14); color: #c3423f; }
.movement-pill--änderung,
.partial-label { background: rgba(245, 158, 11, 0.16); color: #b36b00; }

.item-summary dl {
  display: grid;
  grid-template-columns: repeat(5, minmax(90px, auto));
  gap: 8px;
  margin: 0;
}

.item-summary dl > div {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--hover);
}

.item-summary dt { color: var(--muted); font-size: 11px; }
.item-summary dd { margin: 2px 0 0; color: var(--text); font-weight: 700; }

.chart-panel {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--tile-bg);
}

.chart-container { height: 390px; padding: 18px 14px 10px; }

.event-ledger {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.event-ledger__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  background: var(--panel);
}

.event-ledger__header h2 { margin: 0; font-size: 17px; }
.event-ledger__header p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
.event-ledger__header > span { color: var(--muted); font-size: 12px; white-space: nowrap; }

.ledger-table-wrap { overflow-x: auto; }

.ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ledger-table th,
.ledger-table td {
  padding: 11px 12px;
  border-top: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.ledger-table th {
  color: var(--muted);
  background: color-mix(in srgb, var(--panel) 70%, var(--tile-bg));
  font-size: 11px;
  text-transform: uppercase;
  white-space: nowrap;
}

.ledger-table td { color: var(--text); }
.ledger-table td > small,
.ledger-table td > span:not(.movement-pill, .cancelled-label, .partial-label, .effective-label) { display: block; margin-top: 3px; color: var(--muted); }
.ledger-table td:nth-child(2) strong { display: block; margin-top: 6px; }
.ledger-row--cancelled { opacity: 0.65; }

.stock-line { display: flex; flex-direction: column; min-width: 145px; }
.stock-line + .stock-line { margin-top: 7px; padding-top: 7px; border-top: 1px dashed var(--border); }
.stock-line small { margin-top: 2px; color: var(--muted); }
.stock-line--cancelled { text-decoration: line-through; }

@media (max-width: 900px) {
  .inventory-history__controls,
  .item-summary { align-items: stretch; flex-direction: column; }
  .item-selector { flex-basis: auto; }
  .item-summary dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 768px) {
  .inventory-history__controls { padding: 12px; }
  .mode-selector__chips { flex-wrap: wrap; }
  .chart-container { height: 330px; padding: 12px 4px 8px; }

  .event-ledger { border: 0; overflow: visible; }
  .event-ledger__header { border: 1px solid var(--border); border-radius: 10px; }
  .ledger-table-wrap { overflow: visible; }
  .ledger-table,
  .ledger-table tbody,
  .ledger-table tr,
  .ledger-table td { display: block; width: 100%; box-sizing: border-box; }
  .ledger-table thead { display: none; }
  .ledger-table tbody { display: grid; gap: 12px; margin-top: 12px; }
  .ledger-table tr { padding: 6px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--tile-bg); }
  .ledger-table td { display: grid; grid-template-columns: minmax(100px, 34%) 1fr; gap: 10px; padding: 8px 0; border-top: 1px dashed var(--border); }
  .ledger-table td:first-child { border-top: 0; }
  .ledger-table td::before { content: attr(data-label); color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; }
}
</style>
