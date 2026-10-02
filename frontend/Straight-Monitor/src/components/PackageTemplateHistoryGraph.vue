<template>
  <section class="package-history">
    <div class="package-history__controls">
      <label class="control-field">
        <span>Paketvorlage</span>
        <select v-model="selectedTemplateId">
          <option value="">Paketvorlage auswählen…</option>
          <option v-for="template in templates" :key="template._id" :value="String(template._id)">{{ template.name }}</option>
        </select>
      </label>

      <label v-if="selectedTemplateId" class="control-field control-field--compact">
        <span>Standort</span>
        <select v-model="selectedLocationId" :disabled="locationOptions.length <= 1">
          <option value="">Alle Standorte</option>
          <option v-for="location in locationOptions" :key="location.id" :value="location.id">{{ location.name }}</option>
        </select>
      </label>

      <div v-if="selectedTemplateId" class="mode-selector" aria-label="Graph-Darstellung">
        <span>Darstellung</span>
        <div class="mode-selector__chips">
          <FilterChip :active="mode === 'events'" @click="mode = 'events'">Einzelereignisse</FilterChip>
          <FilterChip :active="mode === 'daily'" @click="mode = 'daily'">Tagesendbestand</FilterChip>
        </div>
      </div>

      <div v-if="selectedTemplate && timelineDayCount > 0" class="date-range-selector">
        <div class="date-range-selector__header">
          <span>Zeitraum</span>
          <strong>{{ selectedRangeLabel }}</strong>
          <button v-if="!isDateRangeReset" type="button" @click="resetDateRange">Zurücksetzen</button>
        </div>
        <DoubleRangeSlider v-model="dateRange" :min="0" :max="timelineDayCount" :format-label="formatRangeSliderLabel" />
      </div>
    </div>

    <div v-if="loadingTemplates || loadingHistory" class="history-state" role="status">Paketverlauf wird geladen…</div>
    <div v-else-if="error" class="history-state history-state--error" role="alert">{{ error }}</div>
    <div v-else-if="!selectedTemplateId" class="history-state">Wähle eine Paketvorlage aus, um ihre Buchungen auszuwerten.</div>

    <template v-else-if="selectedTemplate">
      <div class="summary-row">
        <div><span>Paketvorlage</span><strong>{{ selectedTemplate.name }}</strong></div>
        <div><span>Ereignisse</span><strong>{{ visibleEvents.length }}</strong></div>
        <div><span>Entnahmen im Zeitraum</span><strong class="summary-row__withdrawal">{{ movementTotals.entnahme }}</strong></div>
        <div><span>Zugaben im Zeitraum</span><strong class="summary-row__addition">{{ movementTotals.zugabe }}</strong></div>
      </div>

      <div class="chart-panel">
        <div v-if="hasChartData" class="chart-container"><Line :data="chartData" :options="chartOptions" /></div>
        <div v-else class="history-state history-state--embedded">Für diese Paketvorlage gibt es im gewählten Zeitraum keine Buchungen.</div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
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
import DoubleRangeSlider from '@/components/DoubleRangeSlider.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';

ChartJS.register(CategoryScale, LinearScale, TimeScale, LineController, LineElement, PointElement, Filler, Title, Tooltip, Legend);

const theme = useTheme();
const templates = ref([]);
const selectedTemplateId = ref('');
const selectedTemplate = ref(null);
const events = ref([]);
const locationOptions = ref([]);
const selectedLocationId = ref('');
const mode = ref('daily');
const dateRange = ref([0, 0]);
const loadingTemplates = ref(false);
const loadingHistory = ref(false);
const error = ref('');

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(value) {
  const date = startOfDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function localDayKey(value) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function dayDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function eventDelta(event) {
  if (event.art === 'zugabe') return Number(event.quantity || 0);
  if (event.art === 'entnahme') return -Number(event.quantity || 0);
  return 0;
}

const scopedEvents = computed(() => events.value.filter((event) => !selectedLocationId.value || event.locationId === selectedLocationId.value));
const timelineStart = computed(() => selectedTemplate.value?.createdAt ? startOfDay(selectedTemplate.value.createdAt) : null);
const timelineEnd = computed(() => startOfDay(Math.max(Date.now(), ...scopedEvents.value.map((event) => new Date(event.timestamp).getTime()))));
const timelineDayCount = computed(() => timelineStart.value ? Math.max(0, Math.round((timelineEnd.value - timelineStart.value) / 86_400_000)) : 0);
const selectedRangeStart = computed(() => timelineStart.value && addDays(timelineStart.value, dateRange.value[0]));
const selectedRangeEnd = computed(() => timelineStart.value && addDays(timelineStart.value, dateRange.value[1]));
const selectedRangeLabel = computed(() => selectedRangeStart.value && selectedRangeEnd.value ? `${selectedRangeStart.value.toLocaleDateString('de-DE')} – ${selectedRangeEnd.value.toLocaleDateString('de-DE')}` : '');
const isDateRangeReset = computed(() => dateRange.value[0] === 0 && dateRange.value[1] === timelineDayCount.value);
const visibleEvents = computed(() => scopedEvents.value.filter((event) => {
  const date = startOfDay(event.timestamp).getTime();
  return date >= selectedRangeStart.value?.getTime() && date <= selectedRangeEnd.value?.getTime();
}));
const movementTotals = computed(() => visibleEvents.value.reduce((totals, event) => {
  if (event.art === 'entnahme' || event.art === 'zugabe') totals[event.art] += Number(event.quantity || 0);
  return totals;
}, { entnahme: 0, zugabe: 0 }));
const balanceAtRangeStart = computed(() => scopedEvents.value
  .filter((event) => new Date(event.timestamp) < selectedRangeStart.value)
  .reduce((balance, event) => balance + eventDelta(event), 0));

const packagePoints = computed(() => {
  if (!selectedRangeStart.value) return [];
  const points = [{ x: selectedRangeStart.value, y: balanceAtRangeStart.value, events: [], markerLabel: 'Paketsaldo zum Zeitraumstart' }];
  let balance = balanceAtRangeStart.value;
  const sortedEvents = [...visibleEvents.value].sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
  if (mode.value === 'events') {
    sortedEvents.forEach((event) => {
      balance += eventDelta(event);
      points.push({ x: new Date(event.timestamp), y: balance, events: [event] });
    });
  } else {
    const daily = new Map();
    sortedEvents.forEach((event) => {
      const key = localDayKey(event.timestamp);
      const entry = daily.get(key) || { events: [], delta: 0 };
      entry.events.push(event);
      entry.delta += eventDelta(event);
      daily.set(key, entry);
    });
    daily.forEach((entry, key) => {
      balance += entry.delta;
      points.push({ x: dayDate(key), y: balance, events: entry.events });
    });
  }
  const rangeEnd = endOfDay(selectedRangeEnd.value);
  if (rangeEnd.getTime() > (points.at(-1)?.x?.getTime() || 0)) {
    points.push({ x: rangeEnd, y: balance, events: [], markerLabel: 'Paketsaldo zum Zeitraumende' });
  }
  return points;
});

function pointColor(context) {
  const pointEvents = context.raw?.events || [];
  if (pointEvents.some((event) => event.art === 'entnahme')) return 'rgb(190, 55, 55)';
  if (pointEvents.some((event) => event.art === 'zugabe')) return 'rgb(22, 163, 74)';
  return 'rgb(107, 114, 128)';
}

const chartData = computed(() => ({ datasets: [{
  label: 'Gebuchte Pakete (Saldo)',
  data: packagePoints.value,
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
}] }));
const hasChartData = computed(() => chartData.value.datasets[0].data.length > 1);

const chartOptions = computed(() => {
  const dark = theme.isDark;
  const textColor = dark ? '#d2d2d2' : '#374151';
  const gridColor = dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: mode.value === 'daily' ? 'index' : 'nearest' },
    scales: {
      x: { type: 'time', min: selectedRangeStart.value, max: endOfDay(selectedRangeEnd.value), time: { unit: mode.value === 'daily' ? 'day' : undefined, tooltipFormat: mode.value === 'daily' ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm' }, ticks: { color: textColor, maxTicksLimit: 12, maxRotation: 0 }, grid: { color: gridColor }, title: { display: true, text: selectedRangeLabel.value, color: textColor } },
      y: { ticks: { color: textColor, precision: 0 }, grid: { color: gridColor }, title: { display: true, text: 'Gebuchte Pakete (Saldo)', color: textColor } },
    },
    plugins: {
      legend: { labels: { color: textColor, usePointStyle: true } },
      tooltip: { backgroundColor: dark ? '#262626' : '#ffffff', titleColor: textColor, bodyColor: textColor, borderColor: dark ? '#525252' : '#d1d5db', borderWidth: 1, padding: 12, callbacks: { label: (context) => `Paketsaldo: ${context.parsed.y}`, afterLabel: (context) => (context.raw?.events || []).map((event) => `${event.art === 'zugabe' ? 'Zugabe' : 'Entnahme'}: ${event.quantity} · ${event.standort || 'Unbekannter Standort'}`) } },
    },
  };
});

function formatRangeSliderLabel(offset) {
  return addDays(timelineStart.value, offset).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
}

function resetDateRange() {
  dateRange.value = [0, timelineDayCount.value];
}

async function loadTemplates() {
  loadingTemplates.value = true;
  try {
    const { data } = await api.get('/api/paket-vorlagen');
    templates.value = [...(data || [])].filter((template) => template.isActive).sort((left, right) => left.name.localeCompare(right.name, 'de'));
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Paketvorlagen konnten nicht geladen werden.';
  } finally {
    loadingTemplates.value = false;
  }
}

async function loadHistory() {
  if (!selectedTemplateId.value) return;
  loadingHistory.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/api/monitoring/package-template/${selectedTemplateId.value}`);
    selectedTemplate.value = data.template;
    events.value = data.events || [];
    locationOptions.value = data.locations || [];
    selectedLocationId.value = '';
    dateRange.value = [0, timelineDayCount.value];
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Der Paketverlauf konnte nicht geladen werden.';
  } finally {
    loadingHistory.value = false;
  }
}

watch(selectedTemplateId, () => {
  selectedTemplate.value = null;
  events.value = [];
  locationOptions.value = [];
  loadHistory();
});

watch(selectedLocationId, () => {
  dateRange.value = [0, timelineDayCount.value];
});

onMounted(loadTemplates);
</script>

<style scoped>
.package-history { display: flex; flex-direction: column; gap: 20px; min-width: 0; color: var(--text); }
.package-history__controls { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 20px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); }
.control-field, .mode-selector { display: flex; flex: 1 1 320px; flex-direction: column; gap: 8px; color: var(--muted); font-size: 13px; font-weight: 600; }
.control-field--compact { flex-basis: 180px; }
.control-field select { width: 100%; min-height: 42px; padding: 8px 38px 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg); color: var(--text); font: inherit; }
.mode-selector { flex: 0 1 auto; }
.mode-selector__chips { display: flex; gap: 8px; }
.date-range-selector { display: grid; flex: 1 1 100%; gap: 4px; min-width: 0; }
.date-range-selector__header { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; font-weight: 600; }
.date-range-selector__header strong { color: var(--text); }
.date-range-selector__header button { margin-left: auto; border: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; }
.history-state { padding: 40px 20px; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); text-align: center; }
.history-state--embedded { border: 0; }
.history-state--error { color: #c3423f; }
.summary-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.summary-row > div { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 8px; background: var(--hover); }
.summary-row span { color: var(--muted); font-size: 11px; }
.summary-row strong { font-size: 16px; }
.summary-row__withdrawal { color: #c3423f; }
.summary-row__addition { color: #16a34a; }
.chart-panel { min-width: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--tile-bg); }
.chart-container { height: 390px; padding: 18px 14px 10px; }
@media (max-width: 900px) { .summary-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 768px) { .package-history__controls { padding: 12px; } .mode-selector__chips { flex-wrap: wrap; } .chart-container { height: 330px; padding: 12px 4px 8px; } }
</style>