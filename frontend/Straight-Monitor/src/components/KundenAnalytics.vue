<template>
  <div class="kunden-analytics">

    <!-- Filter Row 1: Zeitraum + Standort -->
    <div class="filter-section">
      <div class="filter-row top-row">
        <!-- Date Slider -->
        <div class="control-group slider-group">
          <label class="control-label">Zeitraum: {{ formatSliderLabel(sliderRange[0]) }} – {{ formatSliderLabel(sliderRange[1]) }}</label>
          <DoubleRangeSlider
            :min="0"
            :max="totalMonths"
            v-model="sliderRange"
            :format-label="formatSliderLabel"
          />
        </div>

        <div class="filter-separator"></div>

        <!-- Standort Filter -->
        <div class="control-group">
          <label class="control-label">Standort</label>
          <div class="chip-row">
            <FilterChip :active="!selectedGeschSt" @click="setGeschSt(null)">Alle</FilterChip>
            <FilterChip :active="selectedGeschSt === '1'" @click="setGeschSt('1')">Berlin</FilterChip>
            <FilterChip :active="selectedGeschSt === '2'" @click="setGeschSt('2')">Hamburg</FilterChip>
            <FilterChip :active="selectedGeschSt === '3'" @click="setGeschSt('3')">Köln</FilterChip>
          </div>
        </div>
      </div>

      <!-- Filter Row 2: Multi-Select Kunden -->
      <div class="filter-row">
        <div class="control-group control-group-wide">
          <label class="control-label">Kunden vergleichen <span class="hint">(optional – für Aufschlüsselung)</span></label>
          <div class="multi-select-wrapper" ref="dropdownRef">
            <div class="multi-select-trigger" @click="dropdownOpen = !dropdownOpen">
              <div class="selected-tags" v-if="selectedKundenNrs.length > 0">
                <span v-for="nr in selectedKundenNrs" :key="nr" class="tag">
                  {{ getKundeName(nr) }}
                  <font-awesome-icon :icon="['fas', 'times']" class="tag-remove" @click.stop="removeKunde(nr)" />
                </span>
              </div>
              <span v-else class="placeholder-text">Alle Kunden (Gesamt)</span>
              <font-awesome-icon :icon="['fas', dropdownOpen ? 'chevron-up' : 'chevron-down']" class="trigger-icon" />
            </div>

            <div v-if="dropdownOpen" class="dropdown-panel">
              <input v-model="kundenSearch" type="text" class="dropdown-search" placeholder="Suchen…" />
              <div class="dropdown-list">
                <label 
                  v-for="k in filteredKundenList" 
                  :key="k.kundenNr" 
                  class="dropdown-item"
                  :class="{ selected: selectedKundenNrs.includes(k.kundenNr) }"
                >
                  <input 
                    type="checkbox" 
                    :checked="selectedKundenNrs.includes(k.kundenNr)"
                    @change="toggleKunde(k.kundenNr)"
                  />
                  <span class="item-name">{{ k.kundName }}</span>
                  <span class="item-status" :class="getStatusClass(k.kundStatus)">{{ getStatusLabel(k.kundStatus) }}</span>
                </label>
                <div v-if="filteredKundenList.length === 0" class="dropdown-empty">
                  Keine Kunden gefunden
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Area -->
    <div class="chart-wrapper">
      <!-- Drill-down Header -->
      <div v-if="drillMonth" class="drill-header">
        <button class="back-btn" @click="closeDrill">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
          Zurück zur Monatsübersicht
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
      <Bar v-else :data="chartData" :options="chartOptions" :key="chartKey" @click="handleChartClick" ref="monthChartRef" />
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
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
import FilterChip from './FilterChip.vue';
import DoubleRangeSlider from './DoubleRangeSlider.vue'; // Import Slider
import { useDataCache } from '@/stores/dataCache';
import { useTheme } from '@/stores/theme';
import api from '@/utils/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Custom Tooltip Positioner: Follows mouse
Tooltip.positioners.followMouse = function(elements, eventPosition) {
  return {
    x: eventPosition.x,
    y: eventPosition.y
  };
};

const router = useRouter();
const dataCache = useDataCache();
const theme = useTheme();

// --- State ---
const loading = ref(false);
const rawTotal = ref([]);          // Gesamt-Daten pro Monat
const rawBreakdown = ref([]);      // Per-Kunde-Breakdown
const activeKundenIds = ref(new Set()); // IDs von Kunden mit Aufträgen
const selectedGeschSt = ref(null);
const selectedKundenNrs = ref([]);
const dropdownOpen = ref(false);
const dropdownRef = ref(null);
const kundenSearch = ref('');
const chartKey = ref(0);
const monthChartRef = ref(null);

// --- Drill-down state ---
const drillMonth = ref(null); // { year, month } or null
const drillTotal = ref([]);
const drillAuftraege = ref([]); // Per-Auftrag breakdown
const drillChartRef = ref(null);

// Default: Set arbitrary start date (assume Jan 2022) until today
const startDate = new Date(2022, 0, 1);
const now = new Date(); // Today

// We'll manage slider as months-since-startDate (index 0 = Jan 2022)
const startMonthIndex = 0;
// Calculate total months until now:
const totalMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());

const sliderRange = ref([0, totalMonths]); // [min, max] selected

// Watch for slider changes to trigger fetch
watch(sliderRange, () => {
  fetchData();
});

// Helper to convert index to "YYYY-MM"
function indexToMonthStr(idx) {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + idx, 1);
  return formatMonthInput(d);
}

// Convert index to readable label (e.g. "Jan 22")
function formatSliderLabel(idx) {
  const d = new Date(startDate.getFullYear(), startDate.getMonth() + idx, 1);
  const m = d.toLocaleDateString('de-DE', { month: 'short' });
  const y = d.toLocaleDateString('de-DE', { year: '2-digit' });
  return `${m} '${y}`;
}

// --- Color palette for stacked bars ---
const COLORS = [
  'rgba(238, 175, 103, 0.85)', // Primary / Gold
  'rgba(99, 179, 237, 0.85)',  // Blue
  'rgba(129, 199, 132, 0.85)', // Green
  'rgba(239, 131, 131, 0.85)', // Red
  'rgba(186, 147, 219, 0.85)', // Purple
  'rgba(255, 183, 77, 0.85)',  // Orange
  'rgba(77, 208, 225, 0.85)',  // Cyan
  'rgba(240, 147, 174, 0.85)', // Pink
  'rgba(165, 214, 167, 0.85)', // Light green
  'rgba(144, 164, 174, 0.85)', // Slate
];

// --- Computed ---

// Kunden-Liste gefiltert nach Standort (für Dropdown)
const kundenByStandort = computed(() => {
  let list = [...(dataCache.kunden || [])].filter(k => k.kundenNr);

  // Determine Parents who have active children
  const parentNrsWithActiveChildren = new Set();
  list.forEach(k => {
    // If this customer has orders AND has a parent, the parent is relevant
    if (activeKundenIds.value.has(k.kundenNr) && k.parentKunde) {
       const pNr = typeof k.parentKunde === 'object' ? k.parentKunde.kundenNr : null;
       // Note: assumes parentKunde is populated. If it's just ID, we can't get Nr easily unless we look it up.
       // Our API populates it.
       if (pNr) parentNrsWithActiveChildren.add(pNr);
    }
  });
  
  // Filter logic
  list = list.filter(k => {
     // A) If filtered by orders, check if 'k' is active OR is a parent of active child
     // AND B) Hide children (customers who have a parent)
     
     if (k.parentKunde) return false; // Hide children

     const isActiveSelf = activeKundenIds.value.has(k.kundenNr);
     const isActiveParent = parentNrsWithActiveChildren.has(k.kundenNr);
     
     // Only show if relevant
     return (activeKundenIds.value.size === 0) || isActiveSelf || isActiveParent;
  });

  // Filter 2: Standort
  if (selectedGeschSt.value) {
    list = list.filter(k => k.geschSt == selectedGeschSt.value);
  }
  return list.sort((a, b) => {
    const aAct = a.kundStatus === 2 ? 0 : 1;
    const bAct = b.kundStatus === 2 ? 0 : 1;
    if (aAct !== bAct) return aAct - bAct;
    return (a.kundName || '').localeCompare(b.kundName || '');
  });
});

const filteredKundenList = computed(() => {
  const q = kundenSearch.value.toLowerCase();
  if (!q) return kundenByStandort.value;
  return kundenByStandort.value.filter(k =>
    (k.kundName || '').toLowerCase().includes(q)
  );
});

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

// --- Chart Data ---

const chartData = computed(() => {
  const fromStr = indexToMonthStr(sliderRange.value[0]);
  const toStr = indexToMonthStr(sliderRange.value[1]);
  
  const months = buildMonthLabels(fromStr, toStr);
  const isDark = theme.current === 'dark';

  // Stacked mode: individual customers selected
  if (selectedKundenNrs.value.length > 0) {
    // 1. Calculate totals for sorting (descending)
    // We want the customer with the HIGHEST total volume to be at the bottom (index 0)
    // or top depending on preference. "Viel = Unten" means High Volume = Bottom of stack.
    // Chart.js draws dataset 0 at the bottom.
    // So we sort by total volume DESC.
    
    // Create datasets but don't finalize them yet
    const rawDatasets = selectedKundenNrs.value.map(nr => {
      const dataArr = months.map(m => {
        const match = rawBreakdown.value.find(b =>
          b.kundenNr === nr && b.year === m.year && b.month === m.month
        );
        return match ? match.count : 0;
      });
      const auftragCountArr = months.map(m => {
        const match = rawBreakdown.value.find(b =>
          b.kundenNr === nr && b.year === m.year && b.month === m.month
        );
        return match ? (match.auftragCount || 0) : 0;
      });
      const total = dataArr.reduce((a, b) => a + b, 0);
      return { kundenNr: nr, dataArr, auftragCountArr, total };
    });

    // Sort by Total Descending
    rawDatasets.sort((a, b) => b.total - a.total);

    // Map to Chart.js structure
    const datasets = rawDatasets.map((d, idx) => {
      const color = COLORS[idx % COLORS.length];
      const hoverColor = color.replace('0.85', '1');
      const name = getKundeName(d.kundenNr);

      return {
        label: name,
        data: d.dataArr,
        auftragCounts: d.auftragCountArr, // Custom data for tooltip
        backgroundColor: color,
        hoverBackgroundColor: hoverColor,
        borderRadius: 0,
        borderSkipped: false,
        maxBarThickness: 56
      };
    });

    return { labels: months.map(m => m.label), datasets };
  }

  // Default mode: single total bar
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
      auftragCounts: auftragCountArr, // Custom data for tooltip
      backgroundColor: barColor,
      hoverBackgroundColor: barColor.replace('0.8', '1').replace('0.85', '1'),
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 56
    }]
  };
});

const chartOptions = computed(() => {
  const isDark = theme.current === 'dark';
  const textColor = isDark ? '#eaeaea' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const isStacked = selectedKundenNrs.value.length > 0;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    plugins: {
      legend: {
        display: isStacked,
        position: 'bottom',
        labels: {
          color: textColor,
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 12,
          font: { size: 12 }
        }
      },
      tooltip: {
        position: 'followMouse', // Follow mouse cursor
        yAlign: 'top', // Arrow at top -> Tooltip body below mouse
        xAlign: 'center', // Center horizontally to mouse
        caretPadding: 15,
        backgroundColor: isDark ? '#2a2a2a' : '#fff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDark ? '#444' : '#ddd',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        filter: (item) => item.parsed.y > 0, // Hide 0 entries
        callbacks: {
          label: ctx => {
            const count = ctx.parsed.y;
            const ac = ctx.dataset.auftragCounts ? ctx.dataset.auftragCounts[ctx.dataIndex] : 0;
            const auftragText = ac === 1 ? 'Auftrag' : 'Aufträgen';
            return ` ${ctx.dataset.label}: ${count} Einsätze in ${ac} ${auftragText}`;
          },
          footer: () => 'Klicken für Tagesansicht'
        }
      }
    },
    scales: {
      x: {
        stacked: isStacked,
        grid: { display: false },
        ticks: { color: textColor, font: { size: 12 } }
      },
      y: {
        stacked: isStacked,
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 12 }, precision: 0 }
      }
    }
  };
});

// --- Functions ---

function setGeschSt(val) {
  selectedGeschSt.value = val;
  // Remove selected customers that no longer belong to this standort
  if (val) {
    const validNrs = kundenByStandort.value.map(k => k.kundenNr);
    selectedKundenNrs.value = selectedKundenNrs.value.filter(nr => validNrs.includes(nr));
  }
  fetchData();
  // Re-fetch drill-down if open
  if (drillMonth.value) {
    openDrill(drillMonth.value.year, drillMonth.value.month);
  }
}

function toggleKunde(nr) {
  const idx = selectedKundenNrs.value.indexOf(nr);
  if (idx >= 0) {
    selectedKundenNrs.value.splice(idx, 1);
  } else {
    selectedKundenNrs.value.push(nr);
  }
  fetchData();
}

function removeKunde(nr) {
  selectedKundenNrs.value = selectedKundenNrs.value.filter(n => n !== nr);
  fetchData();
}

function getKundeName(nr) {
  const k = (dataCache.kunden || []).find(k => k.kundenNr === nr);
  return k ? k.kundName : `#${nr}`;
}

function getStatusLabel(s) {
  if (s === 2) return 'Aktiv';
  if (s === 3) return 'Inaktiv';
  if (s === 1) return 'Potentiell';
  return '';
}

function getStatusClass(s) {
  if (s === 2) return 'st-active';
  if (s === 3) return 'st-inactive';
  return 'st-lead';
}

async function fetchActiveKunden() {
  try {
    const { data } = await api.get('/api/kunden/active-list');
    // data is array of numbers
    activeKundenIds.value = new Set(data);
  } catch (err) {
    console.error('Fetch active customers failed:', err);
  }
}

async function fetchData() {
  loading.value = true;
  rawTotal.value = [];
  rawBreakdown.value = [];

  try {
    const params = {};
    
    // Convert slider indices to Date Strings
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
    if (selectedGeschSt.value) {
      params.geschSt = selectedGeschSt.value;
    }
    if (selectedKundenNrs.value.length > 0) {
      params.kundenNr = selectedKundenNrs.value.join(',');
    }

    const { data } = await api.get('/api/kunden/analytics/einsaetze', { params });
    rawTotal.value = data.data || [];
    rawBreakdown.value = data.breakdown || [];
    chartKey.value++;
  } catch (err) {
    console.error('Analytics fetch error:', err);
  } finally {
    loading.value = false;
  }
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

function formatMonthInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

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
  // Reconstruct which month was clicked from labels
  const fromStr = indexToMonthStr(sliderRange.value[0]);
  const toStr = indexToMonthStr(sliderRange.value[1]);
  const months = buildMonthLabels(fromStr, toStr);
  if (idx >= months.length) return;

  const clicked = months[idx];
  openDrill(clicked.year, clicked.month);
}

async function openDrill(year, month) {
  drillMonth.value = { year, month };
  loading.value = true;
  drillTotal.value = [];
  drillAuftraege.value = [];

  try {
    const params = { year, month };
    if (selectedGeschSt.value) params.geschSt = selectedGeschSt.value;
    if (selectedKundenNrs.value.length > 0) params.kundenNr = selectedKundenNrs.value.join(',');

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
  drillMonth.value = null;
  drillTotal.value = [];
  drillAuftraege.value = [];
}

// --- Drill-down Chart Data ---

const drillChartData = computed(() => {
  if (!drillMonth.value) return { labels: [], datasets: [] };

  const { year, month } = drillMonth.value;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Always stack by Auftrag
  const auftraege = drillAuftraege.value; // Already sorted by total DESC from backend
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
      maxBarThickness: 28,
      auftragNr: a.auftragNr, // Custom prop for click handling
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

  // Navigate to AuftraegePage with the order opened
  const focusDate = dataset.vonDatum || null;
  router.push({
    path: '/auftraege',
    query: {
      auftragnr: dataset.auftragNr,
      ...(focusDate ? { focusDate } : {})
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
        labels: { color: textColor, padding: 16, usePointStyle: true, pointStyleWidth: 12, font: { size: 11 } }
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
        filter: (item) => item.parsed.y > 0, // Hide 0 entries
        callbacks: {
          title: ctx => {
            const day = ctx[0].label;
            return `${day} ${drillMonthLabel.value}`;
          },
          label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} Einsätze`,
          footer: () => 'Klicken → Auftrag öffnen'
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: textColor, font: { size: 11 } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 12 }, precision: 0 }
      }
    }
  };
});

// Close dropdown on outside click
function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    dropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  fetchActiveKunden();
  fetchData();
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<style scoped>
.kunden-analytics {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ---- Filters ---- */
.filter-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-separator {
  width: 1px;
  height: 32px;
  background: var(--border);
  align-self: flex-end;
  margin-bottom: 4px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-group {
  flex: 1;
  min-width: 300px; /* Ensure enough space for the slider */
}

.control-group-wide {
  flex: 1;
  min-width: 300px;
}

.control-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}

.control-label .hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.7;
}

.control-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 14px;
  min-width: 160px;
  transition: border-color 0.2s;
}

.control-input:focus {
  outline: none;
  border-color: var(--primary);
}

.chip-row {
  display: flex;
  gap: 6px;
}

/* ---- Multi-Select Dropdown ---- */
.multi-select-wrapper {
  position: relative;
}

.multi-select-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  cursor: pointer;
  min-height: 40px;
  transition: border-color 0.2s;
}

.multi-select-trigger:hover {
  border-color: var(--primary);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--primary);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.tag-remove {
  cursor: pointer;
  font-size: 10px;
  opacity: 0.8;
}

.tag-remove:hover {
  opacity: 1;
}

.placeholder-text {
  color: var(--muted);
  font-size: 14px;
  flex: 1;
}

.trigger-icon {
  color: var(--muted);
  font-size: 12px;
  margin-left: auto;
}

.dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 100;
  overflow: hidden;
}

.dropdown-search {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.dropdown-list {
  max-height: 220px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--hover);
}

.dropdown-item.selected {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.dropdown-item input[type="checkbox"] {
  accent-color: var(--primary);
}

.item-name {
  flex: 1;
}

.item-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  text-transform: uppercase;
}

.st-active { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.st-inactive { background: rgba(107, 114, 128, 0.2); color: #6b7280; }
.st-lead { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }

.dropdown-empty {
  padding: 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

/* ---- Chart ---- */
.chart-wrapper {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  height: 420px;
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
  gap: 16px;
  margin-bottom: 16px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--hover);
}

.drill-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--muted);
}

.empty-icon {
  font-size: 40px;
  opacity: 0.4;
}

.empty-state p {
  font-size: 14px;
}

/* ---- Summary ---- */
.summary-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.summary-card {
  flex: 1;
  min-width: 140px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary);
}

.summary-label {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
</style>
