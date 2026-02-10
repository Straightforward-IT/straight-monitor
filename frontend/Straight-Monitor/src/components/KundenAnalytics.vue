<template>
  <div class="kunden-analytics">

    <!-- Controls -->
    <div class="controls-row">
      <!-- Customer Selector -->
      <div class="control-group">
        <label class="control-label">Kunde</label>
        <select v-model="selectedKundenNr" class="control-select" @change="fetchData">
          <option :value="null" disabled>Kunde wählen…</option>
          <option
            v-for="k in kundenOptions"
            :key="k.kundenNr"
            :value="k.kundenNr"
          >
            {{ getKundeLabel(k) }}
          </option>
        </select>
      </div>

      <!-- Date Range -->
      <div class="control-group">
        <label class="control-label">Von</label>
        <input type="month" v-model="dateFrom" class="control-input" @change="fetchData" />
      </div>
      <div class="control-group">
        <label class="control-label">Bis</label>
        <input type="month" v-model="dateTo" class="control-input" @change="fetchData" />
      </div>
    </div>

    <!-- Chart Area -->
    <div class="chart-wrapper">
      <div v-if="!selectedKundenNr" class="empty-state">
        <font-awesome-icon :icon="['fas', 'hand-pointer']" class="empty-icon" />
        <p>Bitte einen Kunden auswählen</p>
      </div>

      <div v-else-if="loading" class="empty-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin class="empty-icon" />
        <p>Daten werden geladen…</p>
      </div>

      <div v-else-if="!hasData" class="empty-state">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="empty-icon" />
        <p>Keine Einsätze im gewählten Zeitraum</p>
      </div>

      <Bar v-else :data="chartData" :options="chartOptions" />
    </div>

    <!-- Summary -->
    <div v-if="hasData" class="summary-row">
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
import { ref, computed, onMounted } from 'vue';
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
import { useDataCache } from '@/stores/dataCache';
import { useTheme } from '@/stores/theme';
import api from '@/utils/api';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const dataCache = useDataCache();
const theme = useTheme();

const selectedKundenNr = ref(null);
const loading = ref(false);
const rawData = ref([]);

// Default: last 12 months
const now = new Date();
const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
const dateFrom = ref(formatMonthInput(twelveMonthsAgo));
const dateTo = ref(formatMonthInput(now));

// Customer list for the dropdown (sorted by status then alphabetically)
const kundenOptions = computed(() => {
  return [...(dataCache.kunden || [])]
    .filter(k => k.kundenNr)
    .sort((a, b) => {
      // 1. Sort by Status (Active=2 first)
      const aIsActive = a.kundStatus === 2;
      const bIsActive = b.kundStatus === 2;
      
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // 2. Sort Alphabetically
      return (a.kundName || '').localeCompare(b.kundName || '');
    });
});

function getKundeLabel(k) {
  let statusText = '';
  if (k.kundStatus === 2) statusText = ' (Aktiv)';
  else if (k.kundStatus === 3) statusText = ' (Inaktiv)';
  else if (k.kundStatus === 1) statusText = ' (Potentiell)';
  
  return `${k.kundName}${statusText}`;
}

const hasData = computed(() => rawData.value.length > 0);

const totalEinsaetze = computed(() =>
  rawData.value.reduce((sum, d) => sum + d.count, 0)
);

const avgPerMonth = computed(() => {
  if (!rawData.value.length) return 0;
  return Math.round(totalEinsaetze.value / rawData.value.length);
});

const peakMonth = computed(() => {
  if (!rawData.value.length) return '—';
  const peak = rawData.value.reduce((max, d) => (d.count > max.count ? d : max), rawData.value[0]);
  return peak.label;
});

// Build chart data from raw API response, filling in empty months
const chartData = computed(() => {
  const filled = fillMonths(rawData.value, dateFrom.value, dateTo.value);
  const isDark = theme.current === 'dark';
  const barColor = isDark ? 'rgba(238, 175, 103, 0.8)' : 'rgba(238, 175, 103, 0.85)';
  const barHover = isDark ? 'rgba(238, 175, 103, 1)' : 'rgba(238, 175, 103, 1)';

  return {
    labels: filled.map(d => d.label),
    datasets: [
      {
        label: 'Einsätze',
        data: filled.map(d => d.count),
        backgroundColor: barColor,
        hoverBackgroundColor: barHover,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 48
      }
    ]
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
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#2a2a2a' : '#fff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDark ? '#444' : '#ddd',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: ctx => `${ctx.parsed.y} Einsätze`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 12 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { size: 12 },
          precision: 0
        }
      }
    }
  };
});

// --- Functions ---

async function fetchData() {
  if (!selectedKundenNr.value) return;

  loading.value = true;
  rawData.value = [];

  try {
    // Build query params – send first/last day of chosen months
    const params = { kundenNr: selectedKundenNr.value };
    if (dateFrom.value) {
      const [y, m] = dateFrom.value.split('-');
      params.von = new Date(Number(y), Number(m) - 1, 1).toISOString();
    }
    if (dateTo.value) {
      const [y, m] = dateTo.value.split('-');
      // Last day of the month
      params.bis = new Date(Number(y), Number(m), 0, 23, 59, 59).toISOString();
    }

    const { data } = await api.get('/api/kunden/analytics/einsaetze', { params });
    rawData.value = data.data || [];
  } catch (err) {
    console.error('Analytics fetch error:', err);
  } finally {
    loading.value = false;
  }
}

/**
 * Fill in gaps so every month in the range gets a bar (even if count = 0).
 */
function fillMonths(data, from, to) {
  if (!from || !to) return data;

  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);

  const lookup = {};
  data.forEach(d => { lookup[`${d.year}-${d.month}`] = d.count; });

  const result = [];
  let year = fy;
  let month = fm;

  while (year < ty || (year === ty && month <= tm)) {
    const key = `${year}-${month}`;
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    result.push({
      year,
      month,
      label: `${monthNames[month - 1]} ${year}`,
      count: lookup[key] || 0
    });

    month++;
    if (month > 12) { month = 1; year++; }
  }

  return result;
}

function formatMonthInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
</script>

<style scoped>
.kunden-analytics {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Controls */
.controls-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}

.control-select,
.control-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 14px;
  min-width: 180px;
  transition: border-color 0.2s;
}

.control-select:focus,
.control-input:focus {
  outline: none;
  border-color: var(--primary);
}

/* Chart */
.chart-wrapper {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  min-height: 350px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* Summary */
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
