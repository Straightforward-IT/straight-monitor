<template>
  <div class="kunden-analytics-embed">

    <!-- Slider Row -->
    <div class="filter-row">
      <div class="control-group slider-group">
        <label class="control-label">
          Zeitraum: {{ formatSliderLabel(sliderRange[0]) }} – {{ formatSliderLabel(sliderRange[1]) }}
        </label>
        <DoubleRangeSlider
          :min="0"
          :max="totalMonths"
          v-model="sliderRange"
          :format-label="formatSliderLabel"
        />
      </div>

      <!-- Month Comparison Toggle -->
      <div class="control-group">
        <label class="control-label">Monatsvergleich</label>
        <div class="chip-row">
          <FilterChip :active="showMonthComparison" @click="showMonthComparison = true">An</FilterChip>
          <FilterChip :active="!showMonthComparison" @click="showMonthComparison = false">Aus</FilterChip>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="chart-wrapper">
      <!-- Drill-down Header -->
      <div v-if="drillMonth" class="drill-header">
        <button class="back-btn" @click="closeDrill">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
          Zurück
        </button>
        <span class="drill-title">{{ drillMonthLabel }}</span>
      </div>

      <div v-if="loading" class="empty-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin class="empty-icon" />
        <p>Daten werden geladen…</p>
      </div>

      <div v-else-if="drillMonth && !hasDrillData" class="empty-state">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="empty-icon" />
        <p>Keine Einsätze in diesem Monat</p>
      </div>

      <div v-else-if="!drillMonth && !hasData" class="empty-state">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="empty-icon" />
        <p>Keine Einsätze im gewählten Zeitraum</p>
      </div>

      <Bar v-else-if="drillMonth" :data="drillChartData" :options="drillChartOptions" :key="'drill-' + chartKey" @click="handleDrillChartClick" ref="drillChartRef" />
      <Bar v-else :data="chartData" :options="chartOptions" :plugins="monthChartPlugins" :key="chartKey" @click="handleChartClick" ref="monthChartRef" />
    </div>

    <!-- Summary -->
    <div v-if="!drillMonth && hasData" class="summary-row">
      <div class="summary-card">
        <span class="summary-value">{{ totalEinsaetze }}</span>
        <span class="summary-label">Einsätze gesamt</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{{ avgPerMonth }}</span>
        <span class="summary-label">Ø pro Monat</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{{ peakMonth }}</span>
        <span class="summary-label">Stärkster Monat</span>
      </div>
    </div>

    <!-- Link to full analytics -->
    <div class="analytics-link-row">
      <a href="#" class="analytics-link" @click.prevent="goToFullAnalytics">
        <font-awesome-icon :icon="['fas', 'external-link-alt']" />
        Ausführliche Analytics öffnen
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import DoubleRangeSlider from './DoubleRangeSlider.vue';
import FilterChip from './FilterChip.vue';
import { useTheme } from '@/stores/theme';
import api from '@/utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Custom Tooltip Positioner
if (!Tooltip.positioners.followMouse) {
  Tooltip.positioners.followMouse = function(elements, eventPosition) {
    return { x: eventPosition.x, y: eventPosition.y };
  };
}

// --- Same-Month Highlight Plugin ---
const sameMonthPlugin = {
  id: 'sameMonthHighlight',

  afterEvent(chart, args) {
    const event = args.event;
    if (event.type === 'mousemove') {
      const elements = chart.getElementsAtEventForMode(
        event, 'index', { intersect: false }, false
      );
      let newMonth = null;
      if (elements.length > 0) {
        const idx = elements[0].index;
        const label = chart.data.labels[idx];
        newMonth = label ? label.split(' ')[0] : null;
      }
      if (newMonth !== chart.$sameMonth) {
        chart.$sameMonth = newMonth || null;
        args.changed = true;
      }
    } else if (event.type === 'mouseout') {
      if (chart.$sameMonth) {
        chart.$sameMonth = null;
        args.changed = true;
      }
    }
  },

  beforeDatasetsDraw(chart) {
    const month = chart.$sameMonth;
    if (!month) return;

    const indices = [];
    chart.data.labels.forEach((label, idx) => {
      if (label && label.split(' ')[0] === month) indices.push(idx);
    });
    if (indices.length < 2) return;

    const ctx = chart.ctx;
    const { top, bottom } = chart.chartArea;
    const meta = chart.getDatasetMeta(0);
    if (!meta.data.length) return;

    const slotWidth = meta.data.length > 1
      ? meta.data[1].x - meta.data[0].x
      : meta.data[0].width * 2;

    ctx.save();
    ctx.fillStyle = 'rgba(238, 175, 103, 0.08)';
    indices.forEach(idx => {
      const bar = meta.data[idx];
      if (!bar) return;
      ctx.fillRect(bar.x - slotWidth / 2, top, slotWidth, bottom - top);
    });
    ctx.restore();
  },

  afterDatasetsDraw(chart) {
    const month = chart.$sameMonth;
    if (!month) return;

    const points = [];
    chart.data.labels.forEach((label, idx) => {
      if (!label || label.split(' ')[0] !== month) return;

      let topY = chart.chartArea.bottom;
      let totalValue = 0;

      for (let dsIdx = 0; dsIdx < chart.data.datasets.length; dsIdx++) {
        const dsMeta = chart.getDatasetMeta(dsIdx);
        if (dsMeta.hidden) continue;
        const bar = dsMeta.data[idx];
        if (bar && bar.y < topY) topY = bar.y;
        totalValue += (chart.data.datasets[dsIdx].data[idx] || 0);
      }

      let x = null;
      for (let dsIdx = 0; dsIdx < chart.data.datasets.length; dsIdx++) {
        const dsMeta = chart.getDatasetMeta(dsIdx);
        if (dsMeta.hidden) continue;
        const bar = dsMeta.data[idx];
        if (bar) { x = bar.x; break; }
      }

      if (x != null) {
        points.push({ x, y: topY, value: totalValue });
      }
    });

    if (points.length < 2) return;

    const ctx = chart.ctx;
    ctx.save();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(238, 175, 103, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(238, 175, 103, 1)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (prev.value === 0 && curr.value === 0) continue;

      let percentText;
      let isPositive = true;
      if (prev.value === 0) {
        percentText = 'neu';
      } else {
        const change = ((curr.value - prev.value) / prev.value) * 100;
        isPositive = change >= 0;
        const sign = change >= 0 ? '+' : '';
        percentText = `${sign}${Math.round(change)}%`;
      }

      const midX = (prev.x + curr.x) / 2;
      const ph = 20;
      const rawMidY = (prev.y + curr.y) / 2 - 14;
      const midY = Math.max(chart.chartArea.top + ph / 2 + 2, rawMidY);

      const metrics = ctx.measureText(percentText);
      const pw = metrics.width + 14;
      const rx = midX - pw / 2;
      const ry = midY - ph / 2;
      const r = 6;

      ctx.fillStyle = isPositive
        ? 'rgba(16, 185, 129, 0.95)'
        : 'rgba(239, 68, 68, 0.95)';

      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + pw - r, ry);
      ctx.arcTo(rx + pw, ry, rx + pw, ry + r, r);
      ctx.lineTo(rx + pw, ry + ph - r);
      ctx.arcTo(rx + pw, ry + ph, rx + pw - r, ry + ph, r);
      ctx.lineTo(rx + r, ry + ph);
      ctx.arcTo(rx, ry + ph, rx, ry + ph - r, r);
      ctx.lineTo(rx, ry + r);
      ctx.arcTo(rx, ry, rx + r, ry, r);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.fillText(percentText, midX, midY);
    }

    ctx.restore();
  }
};

const props = defineProps({
  kundenNr: { type: Number, required: true }
});

const emit = defineEmits(['navigate']);

const router = useRouter();
const theme = useTheme();

// --- State ---
const loading = ref(false);
const rawTotal = ref([]);
const chartKey = ref(0);
const monthChartRef = ref(null);
const previousSliderRange = ref(null);
const showMonthComparison = ref(true);

// Drill-down state
const drillMonth = ref(null);
const drillTotal = ref([]);
const drillAuftraege = ref([]);
const drillChartRef = ref(null);

// Time range slider
const startDate = new Date(2022, 0, 1);
const now = new Date();
const totalMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
const sliderRange = ref([0, totalMonths]);

watch(sliderRange, () => { fetchData(); });
watch(showMonthComparison, () => { chartKey.value++; });

// --- Helpers ---

function indexToMonthStr(idx) {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + idx, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatSliderLabel(idx) {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + idx, 1);
  const m = d.toLocaleDateString('de-DE', { month: 'short' });
  const y = d.toLocaleDateString('de-DE', { year: '2-digit' });
  return `${m} '${y}`;
}

function buildMonthLabels(from, to) {
  if (!from || !to) return [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const result = [];
  let year = fy, month = fm;
  while (year < ty || (year === ty && month <= tm)) {
    result.push({ year, month, label: `${monthNames[month - 1]} ${year}` });
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return result;
}

// --- Computed ---

const hasData = computed(() => rawTotal.value.length > 0);

const totalEinsaetze = computed(() =>
  rawTotal.value.reduce((s, d) => s + d.count, 0)
);

const avgPerMonth = computed(() => {
  if (!rawTotal.value.length) return 0;
  return Math.round(totalEinsaetze.value / rawTotal.value.length);
});

const peakMonth = computed(() => {
  if (!rawTotal.value.length) return '—';
  const peak = rawTotal.value.reduce((max, d) => (d.count > max.count ? d : max), rawTotal.value[0]);
  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${monthNames[peak.month - 1]} ${peak.year}`;
});

const monthChartPlugins = computed(() => {
  return showMonthComparison.value ? [sameMonthPlugin] : [];
});

// Link to full analytics page with this customer pre-selected
const fullAnalyticsLink = computed(() => {
  const query = {
    tab: 'analytics',
    kundenNr: String(props.kundenNr),
    von: String(sliderRange.value[0]),
    bis: String(sliderRange.value[1])
  };
  return { path: '/kunden', query };
});

function goToFullAnalytics() {
  emit('navigate');
  router.push(fullAnalyticsLink.value);
}

// --- Chart Data ---

const COLORS = [
  'rgba(238, 175, 103, 0.85)',
  'rgba(99, 179, 237, 0.85)',
  'rgba(129, 199, 132, 0.85)',
  'rgba(239, 131, 131, 0.85)',
  'rgba(186, 147, 219, 0.85)',
];

const chartData = computed(() => {
  const fromStr = indexToMonthStr(sliderRange.value[0]);
  const toStr = indexToMonthStr(sliderRange.value[1]);
  const months = buildMonthLabels(fromStr, toStr);
  const isDark = theme.current === 'dark';

  const barColor = isDark ? 'rgba(238, 175, 103, 0.8)' : 'rgba(238, 175, 103, 0.85)';
  const dataArr = months.map(m => {
    const match = rawTotal.value.find(d => d.year === m.year && d.month === m.month);
    return match ? match.count : 0;
  });
  const auftragCountArr = months.map(m => {
    const match = rawTotal.value.find(d => d.year === m.year && d.month === m.month);
    return match ? (match.auftragCount || 0) : 0;
  });

  return {
    labels: months.map(m => m.label),
    datasets: [{
      label: 'Einsätze',
      data: dataArr,
      auftragCounts: auftragCountArr,
      backgroundColor: barColor,
      hoverBackgroundColor: barColor.replace('0.8', '1').replace('0.85', '1'),
      borderRadius: 0,
      borderSkipped: false,
      maxBarThickness: 56
    }]
  };
});

const chartOptions = computed(() => {
  const isDark = theme.current === 'dark';
  const textColor = isDark ? '#eaeaea' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        position: 'followMouse',
        yAlign: 'top',
        xAlign: 'center',
        caretPadding: 15,
        backgroundColor: isDark ? '#2a2a2a' : '#fff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDark ? '#444' : '#ddd',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: ctx => {
            const count = ctx.parsed.y;
            const ac = ctx.dataset.auftragCounts ? ctx.dataset.auftragCounts[ctx.dataIndex] : 0;
            const auftragText = ac === 1 ? 'Auftrag' : 'Aufträgen';
            return ` ${count} Einsätze in ${ac} ${auftragText}`;
          },
          footer: () => 'Klicken für Tagesansicht'
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, precision: 0 } }
    }
  };
});

// --- Drill-down ---

const drillMonthLabel = computed(() => {
  if (!drillMonth.value) return '';
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${monthNames[drillMonth.value.month - 1]} ${drillMonth.value.year}`;
});

const hasDrillData = computed(() => drillTotal.value.length > 0);

function handleChartClick(event) {
  const chart = monthChartRef.value?.chart;
  if (!chart) return;
  const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
  if (!points.length) return;
  const idx = points[0].index;
  const fromStr = indexToMonthStr(sliderRange.value[0]);
  const toStr = indexToMonthStr(sliderRange.value[1]);
  const months = buildMonthLabels(fromStr, toStr);
  if (idx >= months.length) return;
  const clicked = months[idx];
  openDrill(clicked.year, clicked.month);
}

async function openDrill(year, month) {
  // Store previous slider range and set to drilled month
  if (!previousSliderRange.value) {
    previousSliderRange.value = [...sliderRange.value];
    const monthIndex = (year - startDate.getFullYear()) * 12 + (month - 1);
    // Determine max index possible
    const maxIdx = totalMonths; 
    const targetIdx = Math.min(Math.max(0, monthIndex), maxIdx);
    
    // Set both to same index to show just that month on slider
    sliderRange.value = [targetIdx, targetIdx]; 
  }

  drillMonth.value = { year, month };
  loading.value = true;
  drillTotal.value = [];
  drillAuftraege.value = [];

  try {
    const params = { year, month, kundenNr: String(props.kundenNr) };
    const { data } = await api.get('/api/kunden/analytics/einsaetze/daily', { params });
    drillTotal.value = data.data || [];
    drillAuftraege.value = data.auftragBreakdown || [];
    chartKey.value++;
  } catch (err) {
    console.error('Daily drill-down fetch error:', err);
  } finally {
    loading.value = false;
  }
}

function closeDrill() {
  if (previousSliderRange.value) {
    sliderRange.value = previousSliderRange.value;
    previousSliderRange.value = null;
  }
  drillMonth.value = null;
  drillTotal.value = [];
  drillAuftraege.value = [];
}

const drillChartData = computed(() => {
  if (!drillMonth.value) return { labels: [], datasets: [] };
  const { year, month } = drillMonth.value;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const auftraege = drillAuftraege.value;
  if (!auftraege.length) return { labels: days.map(d => `${d}.`), datasets: [] };

  const datasets = auftraege.map((a, idx) => {
    const color = COLORS[idx % COLORS.length];
    const dataArr = days.map(day => {
      const match = a.days.find(d => d.day === day);
      return match ? match.count : 0;
    });
    return {
      label: a.eventTitel,
      data: dataArr,
      backgroundColor: color,
      hoverBackgroundColor: color.replace('0.85', '1'),
      borderRadius: 0,
      borderSkipped: false,
      borderWidth: 0,
      borderColor: 'transparent',
      maxBarThickness: 28,
      auftragNr: a.auftragNr,
      vonDatum: a.vonDatum
    };
  });

  return { labels: days.map(d => `${d}.`), datasets };
});

function handleDrillChartClick(event) {
  const chart = drillChartRef.value?.chart;
  if (!chart) return;
  const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
  if (!points.length) return;
  const { datasetIndex } = points[0];
  const dataset = drillChartData.value.datasets[datasetIndex];
  if (!dataset?.auftragNr) return;

  router.push({
    path: '/auftraege',
    query: {
      auftragnr: dataset.auftragNr,
      ...(dataset.vonDatum ? { focusDate: dataset.vonDatum } : {})
    }
  });
}

const drillChartOptions = computed(() => {
  const isDark = theme.current === 'dark';
  const textColor = isDark ? '#eaeaea' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const hasMultiple = drillAuftraege.value.length > 1;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    plugins: {
      legend: {
        display: hasMultiple,
        position: 'bottom',
        labels: { color: textColor, padding: 12, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: isDark ? '#2a2a2a' : '#fff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDark ? '#444' : '#ddd',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        position: 'followMouse',
        yAlign: 'top',
        xAlign: 'center',
        caretPadding: 15,
        filter: (item) => item.parsed.y > 0,
        callbacks: {
          title: ctx => {
            if (!ctx || !ctx.length) return '';
            const day = ctx[0].label;
            return `${day} ${drillMonthLabel.value}`;
          },
          label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} Einsätze`,
          footer: () => 'Klicken → Auftrag öffnen'
        }
      }
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
      y: { stacked: true, beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, precision: 0 } }
    }
  };
});

// --- Data Fetching ---

async function fetchData() {
  loading.value = true;
  rawTotal.value = [];

  try {
    const params = {};
    const fromStr = indexToMonthStr(sliderRange.value[0]);
    const toStr = indexToMonthStr(sliderRange.value[1]);

    if (fromStr) {
      const [y, m] = fromStr.split('-');
      params.von = new Date(Number(y), Number(m) - 1, 1).toISOString();
    }
    if (toStr) {
      const [y, m] = toStr.split('-');
      params.bis = new Date(Number(y), Number(m), 0, 23, 59, 59).toISOString();
    }
    params.kundenNr = String(props.kundenNr);

    const { data } = await api.get('/api/kunden/analytics/einsaetze', { params });
    rawTotal.value = data.data || [];
    chartKey.value++;
  } catch (err) {
    console.error('Analytics embed fetch error:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.kunden-analytics-embed {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Slider Row */
.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-group {
  flex: 1;
  min-width: 200px;
}

.control-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}

.chip-row {
  display: flex;
  gap: 6px;
}

/* Chart */
.chart-wrapper {
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  height: 340px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.chart-wrapper canvas {
  width: 100% !important;
  height: 100% !important;
}

.drill-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--hover);
}

.drill-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted);
}

.empty-icon {
  font-size: 28px;
  opacity: 0.4;
}

.empty-state p {
  font-size: 13px;
  margin: 0;
}

/* Summary */
.summary-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-card {
  flex: 1;
  min-width: 100px;
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
}

.summary-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Link */
.analytics-link-row {
  display: flex;
  justify-content: flex-end;
}

.analytics-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
  transition: opacity 0.2s;
}

.analytics-link:hover {
  opacity: 0.8;
  text-decoration: underline;
}
</style>
