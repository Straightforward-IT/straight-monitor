<template>
  <div class="ma-einsatz-chart">
    <div class="chart-section-divider"></div>

    <div class="chart-section-header">
      <h4 class="chart-section-title">
        <font-awesome-icon icon="fa-solid fa-chart-bar" class="chart-section-icon" />
        Einsatz-Verlauf
      </h4>
    </div>

    <!-- Controls (hidden during drill-down) -->
    <div v-if="!drillMonth" class="chart-controls">
      <div class="control-row">
        <div class="control-group">
          <span class="control-label">Ansicht</span>
          <div class="chip-row">
            <FilterChip :active="viewMode === 'monat'" @click="viewMode = 'monat'">Monate</FilterChip>
            <FilterChip :active="viewMode === 'jahr'" @click="viewMode = 'jahr'">Jahre</FilterChip>
          </div>
        </div>
        <div class="control-group">
          <span class="control-label">Metrik</span>
          <div class="chip-row">
            <FilterChip :active="metric === 'tage'" @click="metric = 'tage'">Arbeitstage</FilterChip>
            <FilterChip :active="metric === 'stunden'" @click="metric = 'stunden'">Stunden</FilterChip>
          </div>
        </div>
        <div class="control-group">
          <span class="control-label">Prognose</span>
          <div class="chip-row">
            <FilterChip :active="showForecast" @click="toggleForecast">
              <font-awesome-icon icon="fa-solid fa-eye" />
              Zukünftige Jobs
            </FilterChip>
          </div>
        </div>
      </div>
      <div v-if="viewMode === 'monat'" class="slider-row">
        <div class="slider-inputs-row">
          <input
            class="slider-month-input"
            type="text"
            :value="idxToGermanDate(sliderRange[0])"
            placeholder="1.1.2024"
            @change="e => onDateTextChange(e, 0)"
            @focus="e => e.target.select()"
          />
          <span class="slider-inputs-sep">—</span>
          <input
            class="slider-month-input"
            type="text"
            :value="idxToGermanDate(sliderRange[1])"
            placeholder="1.12.2026"
            @change="e => onDateTextChange(e, 1)"
            @focus="e => e.target.select()"
          />
        </div>
        <DoubleRangeSlider :min="0" :max="sliderMax" v-model="sliderRange" :formatLabel="formatSliderLabel" />
      </div>
    </div>

    <!-- Drill-down header -->
    <div v-if="drillMonth" class="drill-header">
      <button class="back-btn" @click="closeDrillDown">
        <font-awesome-icon icon="fa-solid fa-arrow-left" />
        Zurück
      </button>
      <span class="drill-title">{{ drillMonthLabel }}</span>
      <div class="chip-row drill-metric-chips">
        <FilterChip :active="metric === 'tage'" @click="metric = 'tage'">Arbeitstage</FilterChip>
        <FilterChip :active="metric === 'stunden'" @click="metric = 'stunden'">Stunden</FilterChip>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading || drillLoading" class="chart-loading">
      <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
      Lade Daten…
    </div>

    <!-- Main chart -->
    <div v-else-if="!drillMonth && hasData" class="chart-wrapper">
      <Bar :key="chartKey" :data="chartData" :options="chartOptions" :plugins="activePlugins" />
    </div>

    <!-- Drill-down daily chart -->
    <div v-else-if="drillMonth && drillDayData.length" class="chart-wrapper">
      <Bar
        :key="'drill-' + drillMonth.year + '-' + drillMonth.month + '-' + metric"
        :data="drillChartData"
        :options="drillChartOptions"
        :plugins="drillPlugins"
      />
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && !drillLoading" class="chart-empty">
      <font-awesome-icon icon="fa-solid fa-chart-bar" class="empty-icon" />
      <p>{{ drillMonth ? 'Keine Einsätze in diesem Monat' : 'Keine Einsätze im gewählten Zeitraum' }}</p>
    </div>

    <!-- Summary row (main view only) -->
    <div v-if="!drillMonth && hasData && !loading" class="chart-summary-row">
      <div class="summary-card">
        <span class="summary-value">{{ totalCount }}</span>
        <span class="summary-label">Einsätze gesamt</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{{ totalHours }}h</span>
        <span class="summary-label">Arbeitsstunden</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{{ avgPerMonth }}</span>
        <span class="summary-label">Ø pro Monat</span>
      </div>
      <div v-if="peakMonthLabel" class="summary-card">
        <span class="summary-value">{{ peakMonthLabel }}</span>
        <span class="summary-label">Stärkster Monat</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import FilterChip from './ui-elements/FilterChip.vue';
import DoubleRangeSlider from './DoubleRangeSlider.vue';
import { useTheme } from '@/stores/theme';
import api from '@/utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const props = defineProps({
  mitarbeiterId: { type: String, default: null },
  eintrittsdatum: { type: String, default: null },
});
const theme = useTheme();

// ─── Constants ────────────────────────────────────────────────────────────────
const FALLBACK_START = new Date(2022, 0, 1);
const now = new Date();
const FUTURE_MONTHS = 6;

// Derived from eintrittsdatum prop; falls back to Jan 2022
const startDate = computed(() => {
  if (props.eintrittsdatum) {
    const d = new Date(props.eintrittsdatum);
    if (!isNaN(d)) return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  return FALLBACK_START;
});

const currentMonthIdx = computed(() =>
  (now.getFullYear() - startDate.value.getFullYear()) * 12 +
  (now.getMonth() - startDate.value.getMonth())
);
const monthNames     = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const monthNamesFull = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// ─── State ────────────────────────────────────────────────────────────────────
const loading      = ref(false);
const istData      = ref([]);
const forecastData = ref([]);
const viewMode     = ref('monat');
const metric       = ref('tage');
const showForecast = ref(true);
const chartKey     = ref(0);
const sliderRange  = ref([0, currentMonthIdx.value + FUTURE_MONTHS]);
// Drill-down
const drillMonth   = ref(null);
const drillDayData = ref([]);
const drillLoading = ref(false);

// ─── sameMonthPlugin ──────────────────────────────────────────────────────────
const sameMonthPlugin = {
  id: 'maSameMonthHighlight',
  afterEvent(chart, args) {
    const e = args.event;
    if (e.type === 'mousemove') {
      const els = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, false);
      const nm = els.length ? (chart.data.labels[els[0].index] || '').split(' ')[0] : null;
      if (nm !== chart.$sameMonth) { chart.$sameMonth = nm || null; args.changed = true; }
    } else if (e.type === 'mouseout' && chart.$sameMonth) {
      chart.$sameMonth = null; args.changed = true;
    }
  },
  beforeDatasetsDraw(chart) {
    const month = chart.$sameMonth; if (!month) return;
    const indices = chart.data.labels.reduce((a, l, i) => { if (l && l.split(' ')[0] === month) a.push(i); return a; }, []);
    if (indices.length < 2) return;
    const ctx = chart.ctx, { top, bottom } = chart.chartArea, meta = chart.getDatasetMeta(0);
    if (!meta.data.length) return;
    const sw = meta.data.length > 1 ? meta.data[1].x - meta.data[0].x : meta.data[0].width * 2;
    ctx.save(); ctx.fillStyle = 'rgba(99,179,237,0.07)';
    indices.forEach(i => { const b = meta.data[i]; if (b) ctx.fillRect(b.x - sw/2, top, sw, bottom - top); });
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const month = chart.$sameMonth; if (!month) return;
    const points = [];
    chart.data.labels.forEach((label, idx) => {
      if (!label || label.split(' ')[0] !== month) return;
      let topY = chart.chartArea.bottom, total = 0;
      for (let di = 0; di < chart.data.datasets.length; di++) {
        const dm = chart.getDatasetMeta(di); if (dm.hidden) continue;
        const b = dm.data[idx]; if (b && b.y < topY) topY = b.y;
        total += chart.data.datasets[di].data[idx] || 0;
      }
      let x = null;
      for (let di = 0; di < chart.data.datasets.length; di++) {
        const dm = chart.getDatasetMeta(di); if (dm.hidden) continue;
        const b = dm.data[idx]; if (b) { x = b.x; break; }
      }
      if (x != null) points.push({ x, y: topY, value: total });
    });
    if (points.length < 2) return;
    const ctx = chart.ctx; ctx.save();
    ctx.beginPath(); ctx.strokeStyle = 'rgba(99,179,237,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([6,4]);
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke(); ctx.setLineDash([]);
    points.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(99,179,237,1)'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 1; i < points.length; i++) {
      const prev = points[i-1], curr = points[i];
      if (prev.value === 0 && curr.value === 0) continue;
      let txt, pos = true;
      if (prev.value === 0) { txt = 'neu'; } else {
        const ch = ((curr.value - prev.value) / prev.value) * 100;
        pos = ch >= 0; txt = `${ch >= 0 ? '+' : ''}${Math.round(ch)}%`;
      }
      const mx = (prev.x + curr.x) / 2, ph = 20;
      const my = Math.max(chart.chartArea.top + ph/2 + 2, (prev.y + curr.y)/2 - 14);
      const pw = ctx.measureText(txt).width + 14, rx = mx - pw/2, ry = my - ph/2, r = 6;
      ctx.fillStyle = pos ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)';
      ctx.beginPath();
      ctx.moveTo(rx+r, ry); ctx.lineTo(rx+pw-r, ry); ctx.arcTo(rx+pw, ry, rx+pw, ry+r, r);
      ctx.lineTo(rx+pw, ry+ph-r); ctx.arcTo(rx+pw, ry+ph, rx+pw-r, ry+ph, r);
      ctx.lineTo(rx+r, ry+ph); ctx.arcTo(rx, ry+ph, rx, ry+ph-r, r);
      ctx.lineTo(rx, ry+r); ctx.arcTo(rx, ry, rx+r, ry, r);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(txt, mx, my);
    }
    ctx.restore();
  }
};

// ─── Today Line Plugin (daily drill-down) ─────────────────────────────────────
const todayLinePlugin = {
  id: 'maTodayLine',
  afterDraw(chart) {
    const info = chart.config.options?._drillInfo; if (!info) return;
    const t = new Date();
    if (t.getFullYear() !== info.year || (t.getMonth()+1) !== info.month) return;
    const di = t.getDate() - 1, meta = chart.getDatasetMeta(0);
    if (!meta.data.length || !meta.data[di]) return;
    const x = meta.data[di].x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
    ctx.save(); ctx.beginPath(); ctx.setLineDash([6,4]);
    ctx.strokeStyle = 'rgba(238,175,103,0.75)'; ctx.lineWidth = 2;
    ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = 'bold 10px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(238,175,103,0.9)'; ctx.textAlign = 'center';
    ctx.fillText('Heute', x, top - 4); ctx.restore();
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function indexToDate(idx) { return new Date(startDate.value.getFullYear(), startDate.value.getMonth() + idx, 1); }
function indexToMonthStr(idx) { const d = indexToDate(idx); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function formatSliderLabel(idx) {
  const d = indexToDate(idx);
  return `${d.toLocaleDateString('de-DE',{month:'short'})} '${d.toLocaleDateString('de-DE',{year:'2-digit'})}`;
}
function buildMonthRange(from, to) {
  const [fy,fm] = from.split('-').map(Number), [ty,tm] = to.split('-').map(Number);
  const result = []; let year = fy, month = fm;
  while (year < ty || (year === ty && month <= tm)) {
    result.push({ year, month, label: `${monthNames[month-1]} ${year}` });
    if (++month > 12) { month = 1; year++; }
  }
  return result;
}

// ─── Slider ↔ text-date helpers ────────────────────────────────────────────
function idxToGermanDate(idx) {
  const d = indexToDate(idx);
  return `1.${d.getMonth() + 1}.${d.getFullYear()}`;
}
function germanDateToIndex(str) {
  // Accept "1.3.2024" or "3.2024" or "03.2024"
  const parts = str.trim().split('.');
  let month, year;
  if (parts.length === 3) { month = parseInt(parts[1], 10); year = parseInt(parts[2], 10); }
  else if (parts.length === 2) { month = parseInt(parts[0], 10); year = parseInt(parts[1], 10); }
  else return null;
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2000) return null;
  return (year - startDate.value.getFullYear()) * 12 + (month - 1 - startDate.value.getMonth());
}
function onDateTextChange(e, side) {
  const idx = germanDateToIndex(e.target.value);
  if (idx === null) { e.target.value = idxToGermanDate(sliderRange.value[side]); return; }
  const clamped = Math.max(0, Math.min(sliderMax.value, idx));
  const next = [...sliderRange.value];
  next[side] = clamped;
  if (next[0] > next[1]) next[1 - side] = clamped;
  sliderRange.value = next;
  e.target.value = idxToGermanDate(clamped); // normalise display
}
// kept for internal use
function sliderRangeToMonth(idx) {
  const d = indexToDate(idx);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const sliderMax = computed(() => showForecast.value ? currentMonthIdx.value + FUTURE_MONTHS : currentMonthIdx.value);
function toggleForecast() {
  showForecast.value = !showForecast.value;
  if (showForecast.value) {
    sliderRange.value = [sliderRange.value[0], currentMonthIdx.value + FUTURE_MONTHS];
  } else if (sliderRange.value[1] > currentMonthIdx.value) {
    sliderRange.value = [sliderRange.value[0], currentMonthIdx.value];
  }
  chartKey.value++;
}

// ─── Drill-down ───────────────────────────────────────────────────────────────
const drillMonthLabel = computed(() =>
  drillMonth.value ? `${monthNamesFull[drillMonth.value.month - 1]} ${drillMonth.value.year}` : ''
);

async function openDrillDown(year, month) {
  drillMonth.value = { year, month };
  drillLoading.value = true;
  drillDayData.value = [];
  try {
    const { data } = await api.get(
      `/api/personal/${props.mitarbeiterId}/analytics/einsaetze/daily`,
      { params: { year, month } }
    );
    drillDayData.value = data.days || [];
  } catch (err) {
    console.error('Daily analytics fetch error:', err);
  } finally {
    drillLoading.value = false;
  }
}

function closeDrillDown() { drillMonth.value = null; drillDayData.value = []; }

// ─── Main data fetch ──────────────────────────────────────────────────────────
async function fetchData() {
  if (!props.mitarbeiterId) return;
  loading.value = true;
  try {
    const von = startDate.value.toISOString();
    const bis = new Date(now.getFullYear() + 1, now.getMonth() + FUTURE_MONTHS, 0, 23, 59, 59).toISOString();
    const { data } = await api.get(`/api/personal/${props.mitarbeiterId}/analytics/einsaetze`, { params: { von, bis } });
    istData.value = data.ist || [];
    forecastData.value = data.forecast || [];
    chartKey.value++;
  } catch (err) {
    console.error('Einsatz analytics fetch error:', err);
  } finally {
    loading.value = false;
  }
}

watch(() => props.mitarbeiterId, id => { if (id) fetchData(); }, { immediate: true });
watch(startDate, () => {
  sliderRange.value = [0, currentMonthIdx.value + FUTURE_MONTHS];
  fetchData();
});
watch([metric, viewMode, sliderRange, showForecast], () => { chartKey.value++; });

// ─── Computed stats ───────────────────────────────────────────────────────────
const hasData = computed(() => istData.value.length > 0 || (showForecast.value && forecastData.value.length > 0));
const totalCount = computed(() => istData.value.reduce((s, d) => s + d.count, 0));
const totalHours = computed(() => Math.round(istData.value.reduce((s, d) => s + (d.hours || 0), 0)));
const avgPerMonth = computed(() => !istData.value.length ? 0 : Math.round(totalCount.value / istData.value.length));
const peakMonthLabel = computed(() => {
  if (!istData.value.length) return '';
  const key = metric.value === 'stunden' ? 'hours' : 'count';
  const peak = istData.value.reduce((max, d) => (d[key] > max[key] ? d : max), istData.value[0]);
  return `${monthNames[peak.month - 1]} ${peak.year}`;
});
const activePlugins = computed(() => viewMode.value === 'monat' ? [sameMonthPlugin] : []);
const drillPlugins = [todayLinePlugin];

// ─── Main chart data ──────────────────────────────────────────────────────────
const chartData = computed(() => {
  const isDark = theme.isDark;
  const key = metric.value === 'stunden' ? 'hours' : 'count';
  const istColor   = isDark ? 'rgba(99,179,237,0.8)'  : 'rgba(99,179,237,0.85)';
  const forecastBg = isDark ? 'rgba(99,179,237,0.22)' : 'rgba(99,179,237,0.28)';
  const forecastBd = isDark ? 'rgba(99,179,237,0.45)' : 'rgba(99,179,237,0.55)';

  if (viewMode.value === 'jahr') {
    const yMap = {};
    istData.value.forEach(d => { if (!yMap[d.year]) yMap[d.year] = 0; yMap[d.year] += d[key] || 0; });
    const years = [...new Set([...istData.value.map(d => d.year), ...(showForecast.value ? forecastData.value.map(d => d.year) : [])])].sort();
    const datasets = [{ label: metric.value === 'stunden' ? 'Arbeitsstunden' : 'Einsätze', data: years.map(y => Math.round((yMap[y]||0)*10)/10), backgroundColor: istColor, hoverBackgroundColor: istColor.replace('0.8','1').replace('0.85','1'), borderRadius: 6, borderSkipped: false, maxBarThickness: 80, stack: 'ist' }];
    if (showForecast.value) {
      const fMap = {};
      forecastData.value.forEach(d => { if (!fMap[d.year]) fMap[d.year] = 0; fMap[d.year] += d[key]||0; });
      const fVals = years.map(y => Math.round((fMap[y]||0)*10)/10);
      if (fVals.some(v => v > 0)) datasets.push({ label: metric.value === 'stunden' ? 'Prognose Stunden' : 'Prognose Einsätze', data: fVals, backgroundColor: forecastBg, hoverBackgroundColor: forecastBg.replace('0.22','0.42').replace('0.28','0.48'), borderRadius: 6, borderSkipped: false, maxBarThickness: 80, borderWidth: 1, borderColor: forecastBd, isForecast: true, stack: 'forecast' });
    }
    return { labels: years.map(String), datasets };
  }

  const months = buildMonthRange(indexToMonthStr(sliderRange.value[0]), indexToMonthStr(sliderRange.value[1]));
  const yoyColors = months.map(({ year, month }) => {
    const cur = istData.value.find(d => d.year === year && d.month === month);
    const prev = istData.value.find(d => d.year === year-1 && d.month === month);
    if (cur && prev && prev[key] > 0) return cur[key] >= prev[key] ? 'rgba(100,185,100,0.85)' : 'rgba(220,80,80,0.85)';
    return istColor;
  });
  const datasets = [{ label: metric.value === 'stunden' ? 'Arbeitsstunden' : 'Einsätze', data: months.map(({ year, month }) => { const m = istData.value.find(d => d.year===year && d.month===month); return m ? Math.round((m[key]||0)*10)/10 : 0; }), backgroundColor: yoyColors, hoverBackgroundColor: yoyColors.map(c => c === istColor ? istColor.replace('0.8','1').replace('0.85','1') : c.replace('0.85','1')), borderRadius: 6, borderSkipped: false, maxBarThickness: 56, stack: 'ist' }];
  if (showForecast.value) {
    const fVals = months.map(({ year, month }) => { const m = forecastData.value.find(d => d.year===year && d.month===month); return m ? Math.round((m[key]||0)*10)/10 : 0; });
    if (fVals.some(v => v > 0)) datasets.push({ label: metric.value === 'stunden' ? 'Prognose Stunden' : 'Prognose Einsätze', data: fVals, backgroundColor: forecastBg, hoverBackgroundColor: forecastBg.replace('0.22','0.42').replace('0.28','0.48'), borderRadius: 6, borderSkipped: false, maxBarThickness: 56, borderWidth: 1, borderColor: forecastBd, isForecast: true, stack: 'ist' });
  }
  return { labels: months.map(m => m.label), datasets };
});

// ─── Main chart options ───────────────────────────────────────────────────────
const chartOptions = computed(() => {
  const isDark = theme.isDark;
  const textColor = isDark ? '#eaeaea' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const isStacked = showForecast.value && chartData.value.datasets.some(ds => ds.isForecast);
  const isStunden = metric.value === 'stunden';

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
    onClick: (event, elements, chart) => {
      if (!elements.length) return;
      const label = chart.data.labels[elements[0].index];
      if (!label) return;
      if (viewMode.value === 'jahr') {
        const year = Number(label); if (isNaN(year)) return;
        const si = (year - startDate.value.getFullYear()) * 12;
        sliderRange.value = [Math.max(0, si), Math.min(sliderMax.value, si + 11)];
        viewMode.value = 'monat';
      } else if (viewMode.value === 'monat') {
        const parts = label.split(' '); if (parts.length !== 2) return;
        const mi = monthNames.indexOf(parts[0]), year = Number(parts[1]);
        if (mi === -1 || isNaN(year)) return;
        openDrillDown(year, mi + 1);
      }
    },
    plugins: {
      legend: { display: isStacked, position: 'bottom', labels: { color: textColor, padding: 12, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } } },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? '#2a2a2a' : '#fff',
        titleColor: textColor, bodyColor: textColor,
        borderColor: isDark ? '#444' : '#ddd', borderWidth: 1, cornerRadius: 8, padding: 10,
        filter: item => item.parsed.y > 0,
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            if (ctx.dataset.isForecast) return isStunden ? ` Prognose: ${v}h` : ` Prognose: ${v} Einsätze`;
            return isStunden ? ` ${v}h Arbeitsstunden` : ` ${v} Einsätze`;
          },
          footer: () => 'Klicken zum Einzoomen'
        }
      }
    },
    scales: {
      x: { stacked: isStacked, grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
      y: { stacked: isStacked, beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, precision: 0, callback: isStunden ? v => `${v}h` : undefined } }
    }
  };
});

// ─── Drill-down daily chart data ──────────────────────────────────────────────
const drillChartData = computed(() => {
  if (!drillDayData.value.length) return { labels: [], datasets: [] };
  const isDark = theme.isDark;
  const key = metric.value === 'stunden' ? 'hours' : 'count';
  const colors = drillDayData.value.map(d => {
    if (d.isToday)    return isDark ? 'rgba(238,175,103,0.9)'  : 'rgba(238,175,103,0.95)';
    if (d.isForecast) return isDark ? 'rgba(99,179,237,0.22)'  : 'rgba(99,179,237,0.28)';
    return isDark ? 'rgba(99,179,237,0.8)' : 'rgba(99,179,237,0.85)';
  });
  const hColors = drillDayData.value.map(d => {
    if (d.isToday)    return 'rgba(238,175,103,1)';
    if (d.isForecast) return isDark ? 'rgba(99,179,237,0.42)' : 'rgba(99,179,237,0.48)';
    return 'rgba(99,179,237,1)';
  });
  return {
    labels: drillDayData.value.map(d => `${d.day}.`),
    datasets: [{
      label: metric.value === 'stunden' ? 'Arbeitsstunden' : 'Einsätze',
      data: drillDayData.value.map(d => Math.round((d[key]||0)*10)/10),
      backgroundColor: colors,
      hoverBackgroundColor: hColors,
      borderColor: isDark ? 'rgba(99,179,237,0.45)' : 'rgba(99,179,237,0.55)',
      borderWidth: 1,
      borderRadius: 4, borderSkipped: false, maxBarThickness: 40
    }]
  };
});

const drillChartOptions = computed(() => {
  const isDark = theme.isDark;
  const textColor = isDark ? '#eaeaea' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const isStunden = metric.value === 'stunden';
  const info = drillMonth.value || {};
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    _drillInfo: info,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: isDark ? '#2a2a2a' : '#fff',
        titleColor: textColor, bodyColor: textColor,
        borderColor: isDark ? '#444' : '#ddd', borderWidth: 1, cornerRadius: 8, padding: 10,
        filter: item => item.parsed.y > 0,
        callbacks: {
          title: items => {
            if (!items || !items.length || items[0] == null) return '';
            const d = drillDayData.value[items[0].dataIndex]; if (!d) return '';
            return new Date(info.year, info.month - 1, d.day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
          },
          label: ctx => {
            const v = ctx.parsed.y;
            const d = drillDayData.value[ctx.dataIndex];
            const tag = d?.isForecast ? ' (Prognose)' : '';
            return isStunden ? ` ${v}h Arbeitsstunden${tag}` : ` ${v} Einsätze${tag}`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, precision: 0, callback: isStunden ? v => `${v}h` : undefined } }
    }
  };
});
</script>

<style scoped>
.ma-einsatz-chart { padding-top: 4px; }

.chart-section-divider {
  height: 1px;
  background: color-mix(in srgb, var(--border) 60%, transparent);
  margin: 12px 0 14px;
}

.chart-section-header { margin-bottom: 10px; }

.chart-section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 700; color: var(--text);
  text-transform: uppercase; letter-spacing: 0.04em; margin: 0;
}

.chart-section-icon { font-size: 14px; color: var(--primary); flex-shrink: 0; }

.chart-controls { margin-bottom: 10px; }

.control-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }

.control-group { display: flex; flex-direction: column; gap: 4px; }

.control-label {
  font-size: 11px; font-weight: 600; color: var(--muted, #888);
  text-transform: uppercase; letter-spacing: 0.04em;
}

.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }

.slider-row { margin-top: 12px; }

.slider-inputs-row {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 6px;
}

.slider-month-input {
  font-size: 11px;
  color: var(--text);
  background: var(--tile-bg, #fff);
  border: 1px solid var(--border, #ccc);
  border-radius: 6px;
  padding: 2px 8px;
  height: 24px;
  width: 80px;
  text-align: center;
  cursor: text;
  outline: none;
  transition: border-color 0.15s;
  &:focus { border-color: var(--primary); }
}

.slider-inputs-sep { font-size: 11px; color: var(--muted, #888); }

/* ── Drill-down header ── */
.drill-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 10px; flex-wrap: wrap;
}

.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); color: var(--text);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: border-color 0.15s, background 0.15s; font-family: inherit;
}
.back-btn:hover {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
}

.drill-title { font-size: 14px; font-weight: 700; color: var(--text); flex: 1; }

.drill-metric-chips { margin-left: auto; }

/* ── Chart ── */
.chart-wrapper { position: relative; width: 100%; height: 260px; margin-top: 12px; }

.chart-wrapper :deep(canvas) { width: 100% !important; height: 100% !important; }

.chart-loading {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; height: 120px; color: var(--muted, #888); font-size: 13px;
}

.chart-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; height: 100px; color: var(--muted, #888); font-size: 13px;
}

.empty-icon { font-size: 24px; opacity: 0.35; }

/* ── Summary ── */
.chart-summary-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }

.summary-card {
  flex: 1; min-width: 90px; display: flex; flex-direction: column; align-items: center;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.summary-value { font-size: 15px; font-weight: 700; color: var(--primary); }

.summary-label {
  font-size: 10px; font-weight: 500; color: var(--muted, #888);
  text-transform: uppercase; letter-spacing: 0.04em; text-align: center; margin-top: 2px;
}

@media (max-width: 600px) {
  .control-row { gap: 10px; }
  .chart-wrapper { height: 200px; }
  .summary-card { min-width: 70px; padding: 6px 8px; }
  .drill-metric-chips { margin-left: 0; }
}
</style>
