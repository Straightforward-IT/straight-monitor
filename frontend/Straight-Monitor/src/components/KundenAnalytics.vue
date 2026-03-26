<template>
  <div class="kunden-analytics">

    <!-- Tab Navigation -->
    <div class="tab-navigation">
      <FilterChip :active="activeTab === 'saeulen'" @click="activeTab = 'saeulen'">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="tab-icon" /> Säulen
      </FilterChip>
      <FilterChip :active="activeTab === 'kuchen'" @click="activeTab = 'kuchen'">
        <font-awesome-icon :icon="['fas', 'chart-pie']" class="tab-icon" /> Kuchen
      </FilterChip>
      <div class="tab-separator"></div>
      <FilterChip :active="analyticsMode === 'positionen'" @click="analyticsMode = 'positionen'; drillMonth = null; fetchData()">
        <font-awesome-icon :icon="['fas', 'hashtag']" class="tab-icon" /> Positionen
      </FilterChip>
      <FilterChip :active="analyticsMode === 'umsatz'" @click="analyticsMode = 'umsatz'; drillMonth = null; fetchData()">
        <font-awesome-icon :icon="['fas', 'euro-sign']" class="tab-icon" /> Umsatz
      </FilterChip>
    </div>

    <!-- Säulen Tab -->
    <div v-if="activeTab === 'saeulen'" class="tab-content">
    <!-- Filter Row 1: Zeitraum + Standort -->
    <div class="filter-section">
      <div class="filter-row top-row">
        <!-- Date Slider -->
        <div class="control-group slider-group">
          <div class="slider-label-row">
            <label class="control-label">Zeitraum: {{ formatSliderLabel(sliderRange[0]) }} – {{ formatSliderLabel(sliderRange[1]) }}</label>
            <button v-if="sliderRange[0] !== 0 || sliderRange[1] !== currentMonthIdx" class="slider-reset-btn" @click="sliderRange = [0, currentMonthIdx]" title="Zeitraum zurücksetzen">
              <font-awesome-icon :icon="['fas', 'rotate-left']" />
            </button>
          </div>
          <DoubleRangeSlider
            :min="0"
            :max="totalMonths"
            v-model="sliderRange"
            :format-label="formatSliderLabel"
          />
        </div>

        <div class="filter-separator"></div>

        <!-- Standort Filter (hidden when compareMode is standort) -->
        <div v-if="compareMode !== 'standort'" class="control-group">
          <label class="control-label">Standort</label>
          <div class="chip-row">
            <FilterChip :active="!selectedGeschSt" @click="setGeschSt(null)">Alle</FilterChip>
            <FilterChip :active="selectedGeschSt === '1'" @click="setGeschSt('1')">Berlin</FilterChip>
            <FilterChip :active="selectedGeschSt === '2'" @click="setGeschSt('2')">Hamburg</FilterChip>
            <FilterChip :active="selectedGeschSt === '3'" @click="setGeschSt('3')">Köln</FilterChip>
          </div>
        </div>

        <div v-if="compareMode !== 'standort'" class="filter-separator"></div>

        <!-- Compare Mode Toggle -->
        <div class="control-group">
          <label class="control-label">Vergleich</label>
          <div class="chip-row">
            <FilterChip :active="compareMode === 'none'" @click="setCompareMode('none')">Gesamt</FilterChip>
            <FilterChip :active="compareMode === 'kunden'" @click="setCompareMode('kunden')">Kunden</FilterChip>
            <FilterChip :active="compareMode === 'standort'" @click="setCompareMode('standort')">Standort</FilterChip>
          </div>
        </div>

        <div class="filter-separator"></div>

        <!-- Month Comparison Toggle -->
        <div class="control-group">
          <label class="control-label">Monatsvergleich</label>
          <div class="chip-row">
            <FilterChip :active="showMonthComparison" @click="showMonthComparison = true">An</FilterChip>
            <FilterChip :active="!showMonthComparison" @click="showMonthComparison = false">Aus</FilterChip>
          </div>
        </div>

        <div class="filter-separator"></div>

        <!-- Prognose Toggle (nur Positionen) -->
        <div v-if="analyticsMode === 'positionen'" class="control-group">
          <label class="control-label">Prognose</label>
          <div class="chip-row">
            <FilterChip :active="showForecast" @click="toggleForecast">Anzeigen</FilterChip>
          </div>
        </div>
      </div>

      <!-- Filter Row 2: Multi-Select Kunden (only when compareMode is kunden) -->
      <div v-if="compareMode === 'kunden'" class="filter-row">
        <div class="control-group">
          <label class="control-label">Status</label>
          <div class="chip-row">
            <FilterChip :active="kundenStatusFilter === 'aktiv'" @click="setKundenStatusFilter('aktiv')">Aktiv</FilterChip>
            <FilterChip :active="kundenStatusFilter === 'inaktiv'" @click="setKundenStatusFilter('inaktiv')">Inaktiv</FilterChip>
            <FilterChip :active="kundenStatusFilter === 'alle'" @click="setKundenStatusFilter('alle')">Alle</FilterChip>
          </div>
        </div>
        <div class="control-group">
          <label class="control-label">Straightforward</label>
          <div class="chip-row">
            <FilterChip :active="excludeStraightforward" @click="excludeStraightforward = !excludeStraightforward; selectAllByStatus(); fetchData()">Ausschließen</FilterChip>
          </div>
        </div>
        <div class="control-group control-group-wide">
          <label class="control-label">Kunden vergleichen <span class="hint">({{ selectedKundenNrs.length }} ausgewählt)</span></label>
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

    <!-- Chart Area: Positionen -->
    <div v-if="analyticsMode === 'positionen'" class="chart-wrapper">
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

      <Bar v-else-if="drillMonth" :data="drillChartData" :options="drillChartOptions" :plugins="drillPlugins" :key="'drill-' + chartKey" @click="handleDrillChartClick" ref="drillChartRef" />
      <Bar v-else :data="chartData" :options="chartOptions" :plugins="monthChartPlugins" :key="chartKey" @click="handleChartClick" ref="monthChartRef" />
    </div>

    <!-- Chart Area: Umsatz -->
    <div v-if="analyticsMode === 'umsatz'" class="chart-wrapper">
      <div v-if="loading" class="empty-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin class="empty-icon" />
        <p>Daten werden geladen…</p>
      </div>

      <div v-else-if="!umsatzHasData" class="empty-state">
        <font-awesome-icon :icon="['fas', 'chart-bar']" class="empty-icon" />
        <p>Keine Rechnungsdaten im gewählten Zeitraum</p>
      </div>

      <Bar v-else :data="umsatzChartData" :options="umsatzChartOptions" :plugins="umsatzMonthChartPlugins" :key="'ubar-' + chartKey" />
    </div>

    <!-- Summary: Positionen -->
    <div v-if="analyticsMode === 'positionen' && !drillMonth && hasData" class="summary-row">
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

    <!-- Summary: Umsatz -->
    <div v-if="analyticsMode === 'umsatz' && umsatzHasData" class="summary-row">
      <div class="summary-card">
        <span class="summary-value">{{ formatEuro(umsatzTotalSum) }}</span>
        <span class="summary-label">Umsatz gesamt</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{{ formatEuro(umsatzAvgPerMonth) }}</span>
        <span class="summary-label">Ø pro Monat</span>
      </div>
      <div class="summary-card">
        <span class="summary-value">{{ umsatzPeakMonth }}</span>
        <span class="summary-label">Stärkster Monat</span>
      </div>
    </div>
    </div>
    <!-- End Säulen Tab -->

    <!-- Kuchen (Pie) Tab -->
    <div v-if="activeTab === 'kuchen'" class="tab-content">
      <!-- Filter Section -->
      <div class="filter-section">
        <div class="filter-row top-row">
          <!-- Date Slider -->
          <div class="control-group slider-group">
            <div class="slider-label-row">
              <label class="control-label">Zeitraum: {{ formatSliderLabel(sliderRange[0]) }} – {{ formatSliderLabel(sliderRange[1]) }}</label>
              <button v-if="sliderRange[0] !== 0 || sliderRange[1] !== currentMonthIdx" class="slider-reset-btn" @click="sliderRange = [0, currentMonthIdx]" title="Zeitraum zurücksetzen">
                <font-awesome-icon :icon="['fas', 'rotate-left']" />
              </button>
            </div>
            <DoubleRangeSlider
              :min="0"
              :max="totalMonths"
              v-model="sliderRange"
              :format-label="formatSliderLabel"
            />
          </div>

          <div class="filter-separator"></div>

          <!-- Compare Mode Toggle -->
          <div class="control-group">
            <label class="control-label">Vergleich</label>
            <div class="chip-row">
              <FilterChip :active="compareMode === 'standort'" @click="setCompareMode('standort')">Standort</FilterChip>
              <FilterChip :active="compareMode === 'kunden'" @click="setCompareMode('kunden')">Kunden</FilterChip>
            </div>
          </div>
        </div>

        <!-- Filter Row 2: Multi-Select Kunden (only when compareMode is kunden in pie mode) -->
        <div v-if="compareMode === 'kunden'" class="filter-row">
          <div class="control-group">
            <label class="control-label">Standort</label>
            <div class="chip-row">
              <FilterChip :active="!selectedGeschSt" @click="setGeschSt(null)">Alle</FilterChip>
              <FilterChip :active="selectedGeschSt === '1'" @click="setGeschSt('1')">Berlin</FilterChip>
              <FilterChip :active="selectedGeschSt === '2'" @click="setGeschSt('2')">Hamburg</FilterChip>
              <FilterChip :active="selectedGeschSt === '3'" @click="setGeschSt('3')">Köln</FilterChip>
            </div>
          </div>
          <div class="filter-separator"></div>
          <div class="control-group">
            <label class="control-label">Status</label>
            <div class="chip-row">
              <FilterChip :active="kundenStatusFilter === 'aktiv'" @click="setKundenStatusFilter('aktiv')">Aktiv</FilterChip>
              <FilterChip :active="kundenStatusFilter === 'inaktiv'" @click="setKundenStatusFilter('inaktiv')">Inaktiv</FilterChip>
              <FilterChip :active="kundenStatusFilter === 'alle'" @click="setKundenStatusFilter('alle')">Alle</FilterChip>
            </div>
          </div>
          <div class="control-group">
            <label class="control-label">Straightforward</label>
            <div class="chip-row">
              <FilterChip :active="excludeStraightforward" @click="excludeStraightforward = !excludeStraightforward; selectAllByStatus(); fetchData()">Ausschließen</FilterChip>
            </div>
          </div>
          <div class="control-group control-group-wide">
            <label class="control-label">Kunden auswählen <span class="hint">({{ selectedKundenNrs.length }} ausgewählt)</span></label>
            <div class="multi-select-wrapper" ref="dropdownRef">
              <div class="multi-select-trigger" @click="dropdownOpen = !dropdownOpen">
                <div class="selected-tags" v-if="selectedKundenNrs.length > 0">
                  <span v-for="nr in selectedKundenNrs" :key="nr" class="tag">
                    {{ getKundeName(nr) }}
                    <font-awesome-icon :icon="['fas', 'times']" class="tag-remove" @click.stop="removeKunde(nr)" />
                  </span>
                </div>
                <span v-else class="placeholder-text">Top Kunden (automatisch)</span>
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

      <!-- Pie Chart Area -->
      <div class="chart-wrapper pie-wrapper">
        <div v-if="loading" class="empty-state">
          <font-awesome-icon :icon="['fas', 'spinner']" spin class="empty-icon" />
          <p>Daten werden geladen…</p>
        </div>

        <template v-if="analyticsMode === 'positionen'">
          <div v-if="!loading && !hasPieData" class="empty-state">
            <font-awesome-icon :icon="['fas', 'chart-pie']" class="empty-icon" />
            <p>Keine Einsätze im gewählten Zeitraum</p>
          </div>
          <Pie v-else-if="!loading" :data="pieChartData" :options="pieChartOptions" :key="'pie-' + chartKey" />
        </template>

        <template v-if="analyticsMode === 'umsatz'">
          <div v-if="!loading && !rawUmsatzTotal.length && !rawUmsatzStandortBreakdown.length" class="empty-state">
            <font-awesome-icon :icon="['fas', 'chart-pie']" class="empty-icon" />
            <p>Keine Rechnungsdaten im gewählten Zeitraum</p>
          </div>
          <Pie v-else-if="!loading" :data="umsatzPieChartData" :options="pieChartOptions" :key="'upie-' + chartKey" />
        </template>
      </div>

      <!-- Pie Summary: Positionen -->
      <div v-if="analyticsMode === 'positionen' && hasPieData" class="summary-row">
        <div class="summary-card">
          <span class="summary-value">{{ pieTotalEinsaetze }}</span>
          <span class="summary-label">Einsätze gesamt</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ pieSegments }}</span>
          <span class="summary-label">{{ compareMode === 'standort' ? 'Standorte' : 'Kunden' }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ pieLargestSegment }}</span>
          <span class="summary-label">Größter Anteil</span>
        </div>
      </div>

      <!-- Pie Summary: Umsatz -->
      <div v-if="analyticsMode === 'umsatz' && umsatzHasData" class="summary-row">
        <div class="summary-card">
          <span class="summary-value">{{ formatEuro(umsatzTotalSum) }}</span>
          <span class="summary-label">Umsatz gesamt</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ umsatzTotalCount }}</span>
          <span class="summary-label">Rechnungen</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ umsatzPieLargestSegment }}</span>
          <span class="summary-label">Größter Anteil</span>
        </div>
      </div>
    </div>
    <!-- End Kuchen Tab -->

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Bar, Pie } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
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

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// Custom Tooltip Positioner: Follows mouse
Tooltip.positioners.followMouse = function(elements, eventPosition) {
  return {
    x: eventPosition.x,
    y: eventPosition.y
  };
};

// --- Same-Month Highlight Plugin ---
// On hover: highlights same calendar month across all years, connects them
// with a dashed line, and shows year-over-year % change.
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

  // Draw subtle column highlights behind the bars
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

    // Calculate column slot width from bar spacing
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

  // Draw connecting line, dots, and % change labels
  afterDatasetsDraw(chart) {
    const month = chart.$sameMonth;
    if (!month) return;

    const indices = [];
    chart.data.labels.forEach((label, idx) => {
      if (label && label.split(' ')[0] === month) indices.push(idx);
    });
    if (indices.length < 2) return;

    const ctx = chart.ctx;
    ctx.save();

    if (compareMode.value === 'standort') {
      // ========= STANDORT MODE: per-Standort Verhältnis-Vergleich =========

      // Total per highlighted index (for share/proportion calculation)
      const indexTotals = {};
      indices.forEach(idx => {
        let total = 0;
        for (let dsIdx = 0; dsIdx < chart.data.datasets.length; dsIdx++) {
          const dsMeta = chart.getDatasetMeta(dsIdx);
          if (dsMeta.hidden) continue;
          total += (chart.data.datasets[dsIdx].data[idx] || 0);
        }
        indexTotals[idx] = total;
      });

      // For each dataset (Standort): connecting line + dots
      // Collect all labels first to resolve overlaps
      const allLabels = []; // { x, y, text, color }

      for (let dsIdx = 0; dsIdx < chart.data.datasets.length; dsIdx++) {
        const dsMeta = chart.getDatasetMeta(dsIdx);
        if (dsMeta.hidden) continue;

        const ds = chart.data.datasets[dsIdx];
        const dsColor = ds.backgroundColor;
        const solidColor = typeof dsColor === 'string' ? dsColor.replace('0.85', '1') : dsColor;
        const lineColor = typeof dsColor === 'string' ? dsColor.replace('0.85', '0.5') : dsColor;

        const points = [];
        indices.forEach(idx => {
          const bar = dsMeta.data[idx];
          if (!bar) return;
          const value = ds.data[idx] || 0;
          const total = indexTotals[idx];
          const share = total > 0 ? (value / total) * 100 : 0;
          points.push({ x: bar.x, y: bar.y, value, share });
        });

        if (points.length < 2) continue;

        // Dashed connecting line in Standort color
        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Dots at each point
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = solidColor;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        // Queue labels for later (with collision resolution)
        points.forEach(p => {
          allLabels.push({
            x: p.x,
            y: Math.max(chart.chartArea.top + 12, p.y - 8),
            text: `${Math.round(p.share)}%`,
            color: solidColor
          });
        });
      }

      // Resolve overlapping labels per column (same x)
      const MIN_GAP = 13;
      const columns = {};
      allLabels.forEach(l => {
        const key = Math.round(l.x);
        if (!columns[key]) columns[key] = [];
        columns[key].push(l);
      });
      Object.values(columns).forEach(col => {
        col.sort((a, b) => a.y - b.y);
        for (let i = 1; i < col.length; i++) {
          const diff = col[i].y - col[i - 1].y;
          if (diff < MIN_GAP) {
            // Spread: push current down, pull previous up
            const offset = (MIN_GAP - diff) / 2;
            col[i - 1].y -= Math.ceil(offset);
            col[i].y += Math.ceil(offset);
            // Clamp to chart area
            col[i - 1].y = Math.max(chart.chartArea.top + 6, col[i - 1].y);
          }
        }
      });

      // Draw all labels
      ctx.font = 'bold 10px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      allLabels.forEach(l => {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(l.text, l.x, l.y);
        ctx.fillStyle = l.color;
        ctx.fillText(l.text, l.x, l.y);
      });

    } else {
      // ========= NORMAL / KUNDEN MODE (original) =========

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

      if (points.length < 2) { ctx.restore(); return; }

      // Dashed connecting line
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

      // Dots at each point
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(238, 175, 103, 1)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // % change labels on each line segment
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
    }

    ctx.restore();
  }
};

// --- Today Line Plugin for Drill-Down ---
const todayLinePlugin = {
  id: 'todayLine',
  afterDraw(chart) {
    const drillInfo = chart.config.options?._drillMonth;
    if (!drillInfo) return;

    const now = new Date();
    const { year, month } = drillInfo;
    // Only draw if drill month is current month
    if (now.getFullYear() !== year || (now.getMonth() + 1) !== month) return;

    const todayDay = now.getDate();
    const labelIdx = todayDay - 1; // labels are 0-indexed ("1.", "2.", ...)
    if (labelIdx < 0 || labelIdx >= chart.data.labels.length) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta.data.length || !meta.data[labelIdx]) return;

    const x = meta.data[labelIdx].x;
    const { top, bottom } = chart.chartArea;

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(238, 175, 103, 0.7)';
    ctx.lineWidth = 2;
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label "Heute"
    ctx.font = 'bold 10px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(238, 175, 103, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('Heute', x, top - 4);

    ctx.restore();
  }
};

const router = useRouter();
const route = useRoute();
const dataCache = useDataCache();
const theme = useTheme();

// --- State ---
const loading = ref(false);
const rawTotal = ref([]);          // Gesamt-Daten pro Monat
const rawBreakdown = ref([]);      // Per-Kunde-Breakdown
const rawStandortBreakdown = ref([]); // Per-Standort-Breakdown
const activeKundenIds = ref(new Set()); // IDs von Kunden mit Aufträgen
const selectedGeschSt = ref(null);
const selectedKundenNrs = ref([]);
const dropdownOpen = ref(false);
const dropdownRef = ref(null);
const kundenSearch = ref('');
const chartKey = ref(0);
const monthChartRef = ref(null);
const previousSliderRange = ref(null);
const showMonthComparison = ref(true);
const showForecast = ref(false);
const activeTab = ref('saeulen');
const analyticsMode = ref('positionen'); // 'positionen' | 'umsatz'
const compareMode = ref('none'); // 'none' | 'kunden' | 'standort'
const kundenStatusFilter = ref('aktiv'); // 'aktiv' | 'inaktiv' | 'alle'
const excludeStraightforward = ref(true);

// --- Umsatz state ---
const rawUmsatzTotal = ref([]);
const rawUmsatzBreakdown = ref([]);
const rawUmsatzStandortBreakdown = ref([]);
const umsatzDrillTotal = ref([]);         // [{ day, sum, count }]
const umsatzDrillKunden = ref([]);        // [{ kundenNr, kundName, days, total }]

// All top-level non-Straightforward customer NRs (used to always exclude SF in Gesamt/Standort mode)
const nonSFKundenNrs = computed(() =>
  (dataCache.kunden || [])
    .filter(k => k.kundenNr && !k.parentKunde)
    .filter(k => !(k.kundName || '').toLowerCase().includes('straightforward'))
    .map(k => k.kundenNr)
);

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
// Calculate total months until now + 2 for forecast
const currentMonthIdx = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
const totalMonths = currentMonthIdx + 2;

const sliderRange = ref([0, currentMonthIdx]); // [min, max] selected

// Watch for slider changes to trigger fetch
watch(sliderRange, () => {
  fetchData();
});

// Watch for month comparison toggle to re-render chart
watch(showMonthComparison, () => {
  chartKey.value++;
});

// Toggle forecast: extend slider range to include future months
function toggleForecast() {
  showForecast.value = !showForecast.value;
  if (showForecast.value) {
    // Extend slider end to max (current + 2 months) if not already
    if (sliderRange.value[1] < totalMonths) {
      sliderRange.value = [sliderRange.value[0], totalMonths];
    }
  } else {
    // Snap slider back to current month if it's beyond
    if (sliderRange.value[1] > currentMonthIdx) {
      sliderRange.value = [sliderRange.value[0], currentMonthIdx];
    }
  }
  chartKey.value++;
}

// Switch compareMode default when switching tabs
watch(activeTab, (newTab) => {
  if (newTab === 'kuchen' && compareMode.value === 'none') {
    compareMode.value = 'standort';
    fetchData();
  }
});

// Reset analytics mode drills when switching mode
watch(analyticsMode, () => {
  drillMonth.value = null;
  previousSliderRange.value = null;
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
  let list = kundenByStandort.value;
  // Filter by status
  if (kundenStatusFilter.value === 'aktiv') {
    list = list.filter(k => k.kundStatus === 2);
  } else if (kundenStatusFilter.value === 'inaktiv') {
    list = list.filter(k => k.kundStatus === 3);
  }
  // Filter out Straightforward internal customers
  if (excludeStraightforward.value) {
    list = list.filter(k => !(k.kundName || '').toLowerCase().includes('straightforward'));
  }
  // Filter by search
  const q = kundenSearch.value.toLowerCase();
  if (q) {
    list = list.filter(k => (k.kundName || '').toLowerCase().includes(q));
  }
  return list;
});

const hasData = computed(() => rawTotal.value.length > 0);

const hasForecastTotal = computed(() =>
  rawTotal.value.some(d => (d.forecast || 0) > 0)
);

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

const umsatzMonthChartPlugins = computed(() => {
  return showMonthComparison.value ? [sameMonthPlugin] : [];
});

const drillPlugins = computed(() => {
  return showForecast.value ? [todayLinePlugin] : [todayLinePlugin];
});

// --- Chart Data ---

// Standort label helper
const STANDORT_LABELS = { '1': 'Berlin', '2': 'Hamburg', '3': 'Köln' };
const STANDORT_COLORS = {
  '1': 'rgba(99, 179, 237, 0.85)',   // Blue - Berlin
  '2': 'rgba(238, 175, 103, 0.85)',  // Gold - Hamburg
  '3': 'rgba(129, 199, 132, 0.85)',  // Green - Köln
  'unbekannt': 'rgba(144, 164, 174, 0.85)' // Slate
};

const chartData = computed(() => {
  const fromStr = indexToMonthStr(sliderRange.value[0]);
  const toStr = indexToMonthStr(sliderRange.value[1]);
  
  const months = buildMonthLabels(fromStr, toStr);
  const isDark = theme.current === 'dark';

  // Standort comparison mode
  if (compareMode.value === 'standort') {
    // Get unique standort keys from breakdown
    const standortKeys = [...new Set(rawStandortBreakdown.value.map(b => b.geschSt))];
    if (standortKeys.length === 0) {
      return { labels: months.map(m => m.label), datasets: [] };
    }

    const datasets = [];
    standortKeys.forEach((st, idx) => {
      const color = STANDORT_COLORS[st] || COLORS[idx % COLORS.length];
      const hoverColor = color.replace('0.85', '1');
      const dataArr = months.map(m => {
        const match = rawStandortBreakdown.value.find(b =>
          b.geschSt === st && b.year === m.year && b.month === m.month
        );
        return match ? match.count : 0;
      });
      const auftragCountArr = months.map(m => {
        const match = rawStandortBreakdown.value.find(b =>
          b.geschSt === st && b.year === m.year && b.month === m.month
        );
        return match ? (match.auftragCount || 0) : 0;
      });

      datasets.push({
        label: STANDORT_LABELS[st] || `Standort ${st}`,
        data: dataArr,
        auftragCounts: auftragCountArr,
        backgroundColor: color,
        hoverBackgroundColor: hoverColor,
        borderRadius: 0,
        borderSkipped: false,
        maxBarThickness: 56,
        stack: 'ist'
      });

      // Forecast dataset per standort
      if (showForecast.value) {
        const forecastArr = months.map(m => {
          const match = rawStandortBreakdown.value.find(b =>
            b.geschSt === st && b.year === m.year && b.month === m.month
          );
          return match ? (match.forecast || 0) : 0;
        });
        if (forecastArr.some(v => v > 0)) {
          const paleColor = color.replace('0.85', '0.3');
          datasets.push({
            label: `${STANDORT_LABELS[st] || `Standort ${st}`} (Prognose)`,
            data: forecastArr,
            backgroundColor: paleColor,
            hoverBackgroundColor: paleColor.replace('0.3', '0.5'),
            borderRadius: 0,
            borderSkipped: false,
            maxBarThickness: 56,
            borderWidth: 1,
            borderColor: color.replace('0.85', '0.5'),
            borderDash: [4, 4],
            stack: 'ist',
            isForecast: true
          });
        }
      }
    });

    return { labels: months.map(m => m.label), datasets };
  }

  // Kunden comparison mode — no forecast
  if (compareMode.value === 'kunden' && selectedKundenNrs.value.length > 0) {
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

    rawDatasets.sort((a, b) => b.total - a.total);

    const datasets = rawDatasets.map((d, idx) => {
      const color = COLORS[idx % COLORS.length];
      const hoverColor = color.replace('0.85', '1');
      const name = getKundeName(d.kundenNr);

      return {
        label: name,
        data: d.dataArr,
        auftragCounts: d.auftragCountArr,
        backgroundColor: color,
        hoverBackgroundColor: hoverColor,
        borderRadius: 0,
        borderSkipped: false,
        maxBarThickness: 56
      };
    });

    return { labels: months.map(m => m.label), datasets };
  }

  // Default mode: single total bar + forecast
  const barColor = isDark ? 'rgba(238, 175, 103, 0.8)' : 'rgba(238, 175, 103, 0.85)';
  const dataArr = months.map(m => {
    const match = rawTotal.value.find(d => d.year === m.year && d.month === m.month);
    return match ? match.count : 0;
  });
  const auftragCountArr = months.map(m => {
    const match = rawTotal.value.find(d => d.year === m.year && d.month === m.month);
    return match ? (match.auftragCount || 0) : 0;
  });

  const datasets = [{
    label: 'Einsätze',
    data: dataArr,
    auftragCounts: auftragCountArr,
    backgroundColor: barColor,
    hoverBackgroundColor: barColor.replace('0.8', '1').replace('0.85', '1'),
    borderRadius: 6,
    borderSkipped: false,
    maxBarThickness: 56,
    stack: 'ist'
  }];

  // Forecast dataset
  if (showForecast.value) {
    const forecastArr = months.map(m => {
      const match = rawTotal.value.find(d => d.year === m.year && d.month === m.month);
      return match ? (match.forecast || 0) : 0;
    });
    if (forecastArr.some(v => v > 0)) {
      const paleColor = isDark ? 'rgba(238, 175, 103, 0.25)' : 'rgba(238, 175, 103, 0.3)';
      datasets.push({
        label: 'Prognose (Bedarf)',
        data: forecastArr,
        backgroundColor: paleColor,
        hoverBackgroundColor: isDark ? 'rgba(238, 175, 103, 0.4)' : 'rgba(238, 175, 103, 0.5)',
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 56,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(238, 175, 103, 0.4)' : 'rgba(238, 175, 103, 0.5)',
        stack: 'ist',
        isForecast: true
      });
    }
  }

  return {
    labels: months.map(m => m.label),
    datasets
  };
});

const chartOptions = computed(() => {
  const isDark = theme.current === 'dark';
  const textColor = isDark ? '#fff' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';
  const isStacked = (compareMode.value === 'kunden' && selectedKundenNrs.value.length > 0) || compareMode.value === 'standort' || showForecast.value;
  const isStandort = compareMode.value === 'standort';
  const hasForecastData = showForecast.value && chartData.value.datasets.some(ds => ds.isForecast);

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
          font: { size: 12 },
          filter: (item) => {
            // Optionally style forecast entries differently
            return true;
          }
        }
      },
      tooltip: {
        enabled: !isStandort,
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
        filter: (item) => item.parsed.y > 0,
        callbacks: {
          label: ctx => {
            const count = ctx.parsed.y;
            if (ctx.dataset.isForecast) {
              return ` ${ctx.dataset.label}: ${count} (Bedarf)`;
            }
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

function setCompareMode(mode) {
  compareMode.value = mode;
  // Reset standort filter when switching to standort mode
  if (mode === 'standort') {
    selectedGeschSt.value = null;
    selectedKundenNrs.value = [];
  }
  // Auto-select all active customers when switching to kunden mode
  if (mode === 'kunden') {
    selectAllByStatus();
  }
  // Reset kunden selection when switching away from kunden mode
  if (mode !== 'kunden') {
    selectedKundenNrs.value = [];
  }
  // Default pie to standort if no mode
  if (activeTab.value === 'kuchen' && mode === 'none') {
    compareMode.value = 'standort';
  }
  fetchData();
}

function setKundenStatusFilter(status) {
  kundenStatusFilter.value = status;
  selectAllByStatus();
  fetchData();
}

function selectAllByStatus() {
  let list = kundenByStandort.value;
  if (kundenStatusFilter.value === 'aktiv') {
    list = list.filter(k => k.kundStatus === 2);
  } else if (kundenStatusFilter.value === 'inaktiv') {
    list = list.filter(k => k.kundStatus === 3);
  }
  if (excludeStraightforward.value) {
    list = list.filter(k => !(k.kundName || '').toLowerCase().includes('straightforward'));
  }
  selectedKundenNrs.value = list.map(k => k.kundenNr);
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
  rawStandortBreakdown.value = [];

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

    if (analyticsMode.value === 'umsatz') {
      // ── Umsatz mode: query Rechnung endpoints ──────────────────────────────
      rawUmsatzTotal.value = [];
      rawUmsatzBreakdown.value = [];
      rawUmsatzStandortBreakdown.value = [];

      if (compareMode.value === 'standort') {
        const stParams = { ...params };
        if (selectedKundenNrs.value.length > 0) {
          stParams.kundenNr = selectedKundenNrs.value.join(',');
        } else if (excludeStraightforward.value && nonSFKundenNrs.value.length > 0) {
          stParams.kundenNr = nonSFKundenNrs.value.join(',');
        }
        const { data } = await api.get('/api/kunden/analytics/rechnungen/standort', { params: stParams });
        rawUmsatzTotal.value = data.data || [];
        rawUmsatzStandortBreakdown.value = data.standortBreakdown || [];
      } else {
        if (selectedGeschSt.value) params.geschSt = selectedGeschSt.value;
        if (selectedKundenNrs.value.length > 0) {
          params.kundenNr = selectedKundenNrs.value.join(',');
        } else if (compareMode.value === 'none' && excludeStraightforward.value && nonSFKundenNrs.value.length > 0) {
          params.kundenNr = nonSFKundenNrs.value.join(',');
        }
        const { data } = await api.get('/api/kunden/analytics/rechnungen', { params });
        rawUmsatzTotal.value = data.data || [];
        rawUmsatzBreakdown.value = data.breakdown || [];
      }
    } else {
      // ── Positionen mode: query Einsatz endpoints (existing) ───────────────
      if (compareMode.value === 'standort') {
        const stParams = { ...params };
        if (selectedKundenNrs.value.length > 0) {
          stParams.kundenNr = selectedKundenNrs.value.join(',');
        } else if (excludeStraightforward.value && nonSFKundenNrs.value.length > 0) {
          stParams.kundenNr = nonSFKundenNrs.value.join(',');
        }
        const { data } = await api.get('/api/kunden/analytics/einsaetze/standort', { params: stParams });
        rawTotal.value = data.data || [];
        rawStandortBreakdown.value = data.standortBreakdown || [];
      } else {
        if (selectedGeschSt.value) {
          params.geschSt = selectedGeschSt.value;
        }
        if (selectedKundenNrs.value.length > 0) {
          params.kundenNr = selectedKundenNrs.value.join(',');
        } else if (compareMode.value === 'none' && excludeStraightforward.value && nonSFKundenNrs.value.length > 0) {
          params.kundenNr = nonSFKundenNrs.value.join(',');
        }
        const { data } = await api.get('/api/kunden/analytics/einsaetze', { params });
        rawTotal.value = data.data || [];
        rawBreakdown.value = data.breakdown || [];
      }
    }

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

const hasDrillData = computed(() => drillTotal.value.length > 0 || (showForecast.value && drillAuftraege.value.some(a => a.forecastDays && a.forecastDays.length > 0)));

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
    const params = { year, month };
    if (selectedGeschSt.value) params.geschSt = selectedGeschSt.value;
    if (selectedKundenNrs.value.length > 0) {
      params.kundenNr = selectedKundenNrs.value.join(',');
    } else if (excludeStraightforward.value && nonSFKundenNrs.value.length > 0) {
      params.kundenNr = nonSFKundenNrs.value.join(',');
    }

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

// --- Drill-down Chart Data ---

const drillChartData = computed(() => {
  if (!drillMonth.value) return { labels: [], datasets: [] };

  const { year, month } = drillMonth.value;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const auftraege = drillAuftraege.value;
  if (!auftraege.length) return { labels: days.map(d => `${d}.`), datasets: [] };

  const datasets = [];

  // IST datasets (actual counts)
  auftraege.forEach((a, idx) => {
    const color = COLORS[idx % COLORS.length];
    const dataArr = days.map(day => {
      const match = a.days.find(d => d.day === day);
      return match ? match.count : 0;
    });

    datasets.push({
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
      vonDatum: a.vonDatum,
      stack: 'ist'
    });
  });

  // Forecast datasets (if enabled)
  if (showForecast.value) {
    auftraege.forEach((a, idx) => {
      if (!a.forecastDays || !a.forecastDays.length) return;
      const color = COLORS[idx % COLORS.length];
      const paleColor = color.replace('0.85', '0.3');
      const forecastArr = days.map(day => {
        const match = a.forecastDays.find(d => d.day === day);
        return match ? match.forecast : 0;
      });
      if (forecastArr.some(v => v > 0)) {
        datasets.push({
          label: `${a.eventTitel} (Prognose)`,
          data: forecastArr,
          backgroundColor: paleColor,
          hoverBackgroundColor: paleColor.replace('0.3', '0.5'),
          borderRadius: 0,
          borderSkipped: false,
          borderWidth: 1,
          borderColor: color.replace('0.85', '0.5'),
          maxBarThickness: 28,
          auftragNr: a.auftragNr,
          vonDatum: a.vonDatum,
          stack: 'ist',
          isForecast: true
        });
      }
    });
  }

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
  const textColor = isDark ? '#fff' : '#333';
  const gridColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';
  const hasMultiple = drillAuftraege.value.length > 1 || (showForecast.value && drillChartData.value.datasets.some(ds => ds.isForecast));

  return {
    responsive: true,
    maintainAspectRatio: false,
    _drillMonth: drillMonth.value,
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
        filter: (item) => item.parsed.y > 0,
        callbacks: {
          title: ctx => {
            if (!ctx || !ctx.length) return '';
            const day = ctx[0].label;
            return `${day} ${drillMonthLabel.value}`;
          },
          label: ctx => {
            if (ctx.dataset.isForecast) {
              return ` ${ctx.dataset.label}: ${ctx.parsed.y} (Bedarf)`;
            }
            return ` ${ctx.dataset.label}: ${ctx.parsed.y} Einsätze`;
          },
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

// --- Pie Chart Data ---

const hasPieData = computed(() => {
  if (compareMode.value === 'standort') {
    return rawStandortBreakdown.value.length > 0;
  }
  // Kunden mode: use rawBreakdown or rawTotal
  return rawTotal.value.length > 0;
});

const pieChartData = computed(() => {
  const isDark = theme.current === 'dark';

  if (compareMode.value === 'standort') {
    // Aggregate standort breakdown across all months in range
    const totals = {};
    rawStandortBreakdown.value.forEach(b => {
      if (!totals[b.geschSt]) totals[b.geschSt] = 0;
      totals[b.geschSt] += b.count;
    });
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([st]) => STANDORT_LABELS[st] || `Standort ${st}`),
      datasets: [{
        data: entries.map(([, count]) => count),
        backgroundColor: entries.map(([st], idx) => STANDORT_COLORS[st] || COLORS[idx % COLORS.length]),
        hoverBackgroundColor: entries.map(([st], idx) => (STANDORT_COLORS[st] || COLORS[idx % COLORS.length]).replace('0.85', '1')),
        borderWidth: 2,
        borderColor: isDark ? '#1a1a1a' : '#fff'
      }]
    };
  }

  // Kunden mode
  if (selectedKundenNrs.value.length > 0) {
    // Aggregate per customer
    const totals = {};
    rawBreakdown.value.forEach(b => {
      if (!totals[b.kundenNr]) totals[b.kundenNr] = 0;
      totals[b.kundenNr] += b.count;
    });
    const entries = Object.entries(totals)
      .map(([nr, count]) => ({ nr: Number(nr), count }))
      .sort((a, b) => b.count - a.count);
    return {
      labels: entries.map(e => getKundeName(e.nr)),
      datasets: [{
        data: entries.map(e => e.count),
        backgroundColor: entries.map((_, idx) => COLORS[idx % COLORS.length]),
        hoverBackgroundColor: entries.map((_, idx) => COLORS[idx % COLORS.length].replace('0.85', '1')),
        borderWidth: 2,
        borderColor: isDark ? '#1a1a1a' : '#fff'
      }]
    };
  }

  // No specific kunden selected in kunden mode – show total (single segment)
  const total = rawTotal.value.reduce((s, d) => s + d.count, 0);
  return {
    labels: ['Gesamt'],
    datasets: [{
      data: [total],
      backgroundColor: [COLORS[0]],
      hoverBackgroundColor: [COLORS[0].replace('0.85', '1')],
      borderWidth: 2,
      borderColor: isDark ? '#1a1a1a' : '#fff'
    }]
  };
});

const pieChartOptions = computed(() => {
  const isDark = theme.current === 'dark';
  const textColor = isDark ? '#fff' : '#333';

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: textColor,
          padding: 12,
          usePointStyle: true,
          pointStyleWidth: 12,
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#2a2a2a' : '#fff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDark ? '#444' : '#ddd',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const value = ctx.parsed;
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${value} Einsätze (${pct}%)`;
          }
        }
      }
    }
  };
});

const pieTotalEinsaetze = computed(() => {
  if (compareMode.value === 'standort') {
    return rawStandortBreakdown.value.reduce((s, b) => s + b.count, 0);
  }
  return rawTotal.value.reduce((s, d) => s + d.count, 0);
});

const pieSegments = computed(() => {
  if (compareMode.value === 'standort') {
    return new Set(rawStandortBreakdown.value.map(b => b.geschSt)).size;
  }
  if (selectedKundenNrs.value.length > 0) {
    return new Set(rawBreakdown.value.map(b => b.kundenNr)).size;
  }
  return 1;
});

const pieLargestSegment = computed(() => {
  if (compareMode.value === 'standort') {
    const totals = {};
    rawStandortBreakdown.value.forEach(b => {
      if (!totals[b.geschSt]) totals[b.geschSt] = 0;
      totals[b.geschSt] += b.count;
    });
    const entries = Object.entries(totals);
    if (!entries.length) return '—';
    const max = entries.reduce((a, b) => b[1] > a[1] ? b : a, entries[0]);
    return STANDORT_LABELS[max[0]] || `Standort ${max[0]}`;
  }

  if (selectedKundenNrs.value.length > 0) {
    const totals = {};
    rawBreakdown.value.forEach(b => {
      if (!totals[b.kundenNr]) totals[b.kundenNr] = 0;
      totals[b.kundenNr] += b.count;
    });
    const entries = Object.entries(totals).map(([nr, c]) => ({ nr: Number(nr), count: c }));
    if (!entries.length) return '—';
    const max = entries.reduce((a, b) => b.count > a.count ? b : a, entries[0]);
    return getKundeName(max.nr);
  }

  return '—';
});

// --- Umsatz Computeds ---

function formatEuro(val) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

const umsatzHasData = computed(() => rawUmsatzTotal.value.length > 0);

const umsatzTotalSum = computed(() =>
  rawUmsatzTotal.value.reduce((s, d) => s + (d.sum || 0), 0)
);
const umsatzTotalCount = computed(() =>
  rawUmsatzTotal.value.reduce((s, d) => s + (d.count || 0), 0)
);
const umsatzAvgPerMonth = computed(() => {
  if (!rawUmsatzTotal.value.length) return 0;
  return Math.round(umsatzTotalSum.value / rawUmsatzTotal.value.length);
});
const umsatzPeakMonth = computed(() => {
  if (!rawUmsatzTotal.value.length) return '—';
  const peak = rawUmsatzTotal.value.reduce(
    (max, d) => (d.sum > max.sum ? d : max),
    rawUmsatzTotal.value[0]
  );
  const names = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${names[peak.month - 1]} ${peak.year}`;
});

const umsatzChartData = computed(() => {
  const fromStr = indexToMonthStr(sliderRange.value[0]);
  const toStr = indexToMonthStr(sliderRange.value[1]);
  const months = buildMonthLabels(fromStr, toStr);
  if (!months.length) return { labels: [], datasets: [] };

  if (compareMode.value === 'standort') {
    const standorte = [...new Set(rawUmsatzStandortBreakdown.value.map(b => b.geschSt))].sort();
    const datasets = standorte.map((geschSt, idx) => {
      const color = COLORS[idx % COLORS.length];
      return {
        label: STANDORT_LABELS[geschSt] || `Standort ${geschSt}`,
        data: months.map(({ year, month }) => {
          const entry = rawUmsatzStandortBreakdown.value.find(
            b => b.geschSt === geschSt && b.year === year && b.month === month
          );
          return entry ? entry.sum : 0;
        }),
        backgroundColor: color,
        borderRadius: 4,
        stack: 'stack',
      };
    });
    return { labels: months.map(m => m.label), datasets };
  }

  if (compareMode.value === 'kunden' && selectedKundenNrs.value.length > 0) {
    const kNrs = [...new Set(rawUmsatzBreakdown.value.map(b => b.kundenNr))];
    const datasets = kNrs.map((nr, idx) => {
      const color = COLORS[idx % COLORS.length];
      return {
        label: getKundeName(nr),
        data: months.map(({ year, month }) => {
          const entry = rawUmsatzBreakdown.value.find(
            b => b.kundenNr === nr && b.year === year && b.month === month
          );
          return entry ? entry.sum : 0;
        }),
        backgroundColor: color,
        borderRadius: 4,
        stack: 'stack',
      };
    });
    return { labels: months.map(m => m.label), datasets };
  }

  // Single total bar — color by YoY when Monatsvergleich is active
  const yoyColors = months.map(({ year, month }) => {
    const cur  = rawUmsatzTotal.value.find(d => d.year === year     && d.month === month);
    const prev = rawUmsatzTotal.value.find(d => d.year === year - 1 && d.month === month);
    if (showMonthComparison.value && cur && prev && prev.sum > 0) {
      return cur.sum >= prev.sum
        ? 'rgba(100, 185, 100, 0.85)'   // green — better than last year
        : 'rgba(220, 80, 80, 0.85)';    // red   — worse than last year
    }
    return 'var(--primary)';
  });

  return {
    labels: months.map(m => m.label),
    datasets: [{
      label: 'Umsatz (€)',
      data: months.map(({ year, month }) => {
        const entry = rawUmsatzTotal.value.find(d => d.year === year && d.month === month);
        return entry ? entry.sum : 0;
      }),
      backgroundColor: yoyColors,
      borderRadius: 4,
    }],
  };
});

const umsatzChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: compareMode.value !== 'none' },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const fromStr = indexToMonthStr(sliderRange.value[0]);
          const toStr   = indexToMonthStr(sliderRange.value[1]);
          const months  = buildMonthLabels(fromStr, toStr);
          const m       = months[ctx.dataIndex];
          const entry   = m ? rawUmsatzTotal.value.find(d => d.year === m.year && d.month === m.month) : null;
          const count   = entry ? entry.count : '';
          let label = `${ctx.dataset.label}: ${formatEuro(ctx.raw)} (${count} Rechnungen)`;

          if (showMonthComparison.value && m) {
            const prev = rawUmsatzTotal.value.find(d => d.year === m.year - 1 && d.month === m.month);
            if (prev && prev.sum > 0) {
              const diff  = ctx.raw - prev.sum;
              const pct   = ((diff / prev.sum) * 100).toFixed(1);
              const sign  = diff >= 0 ? '+' : '';
              label += `  |  VJ: ${formatEuro(prev.sum)} (${sign}${pct}%)`;
            }
          }
          return label;
        },
      },
    },
  },
  scales: {
    x: { stacked: true, grid: { display: false } },
    y: {
      stacked: true,
      ticks: {
        callback: (v) => formatEuro(v),
      },
    },
  },
}));

const umsatzPieChartData = computed(() => {
  const MONTH_NAMES = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  if (compareMode.value === 'standort') {
    const totals = {};
    rawUmsatzStandortBreakdown.value.forEach(b => {
      if (!totals[b.geschSt]) totals[b.geschSt] = 0;
      totals[b.geschSt] += b.sum || 0;
    });
    const entries = Object.entries(totals).sort(([, a], [, b]) => b - a);
    return {
      labels: entries.map(([g]) => STANDORT_LABELS[g] || `Standort ${g}`),
      datasets: [{
        data: entries.map(([, s]) => s),
        backgroundColor: entries.map((_, i) => COLORS[i % COLORS.length]),
      }],
    };
  }

  if (compareMode.value === 'kunden' && selectedKundenNrs.value.length > 0) {
    const totals = {};
    rawUmsatzBreakdown.value.forEach(b => {
      if (!totals[b.kundenNr]) totals[b.kundenNr] = 0;
      totals[b.kundenNr] += b.sum || 0;
    });
    const entries = Object.entries(totals).sort(([, a], [, b]) => b - a);
    return {
      labels: entries.map(([nr]) => getKundeName(Number(nr))),
      datasets: [{
        data: entries.map(([, s]) => s),
        backgroundColor: entries.map((_, i) => COLORS[i % COLORS.length]),
      }],
    };
  }

  // Monthly distribution
  const entries = [...rawUmsatzTotal.value].sort((a, b) => b.sum - a.sum);
  return {
    labels: entries.map(e => `${MONTH_NAMES[e.month - 1]} ${e.year}`),
    datasets: [{
      data: entries.map(e => e.sum || 0),
      backgroundColor: entries.map((_, i) => COLORS[i % COLORS.length]),
    }],
  };
});

const umsatzPieLargestSegment = computed(() => {
  if (compareMode.value === 'standort') {
    const totals = {};
    rawUmsatzStandortBreakdown.value.forEach(b => {
      if (!totals[b.geschSt]) totals[b.geschSt] = 0;
      totals[b.geschSt] += b.sum || 0;
    });
    const entries = Object.entries(totals);
    if (!entries.length) return '—';
    const max = entries.reduce((a, b) => b[1] > a[1] ? b : a, entries[0]);
    return STANDORT_LABELS[max[0]] || `Standort ${max[0]}`;
  }
  if (compareMode.value === 'kunden' && selectedKundenNrs.value.length > 0) {
    const totals = {};
    rawUmsatzBreakdown.value.forEach(b => {
      if (!totals[b.kundenNr]) totals[b.kundenNr] = 0;
      totals[b.kundenNr] += b.sum || 0;
    });
    const entries = Object.entries(totals).map(([nr, s]) => ({ nr: Number(nr), sum: s }));
    if (!entries.length) return '—';
    const max = entries.reduce((a, b) => b.sum > a.sum ? b : a, entries[0]);
    return getKundeName(max.nr);
  }
  return '—';
});

// Close dropdown on outside click
function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    dropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);

  // Apply query params from deep link (e.g. from CustomerCard embed)
  const qKundenNr = route.query.kundenNr;
  const qVon = route.query.von;
  const qBis = route.query.bis;
  const qCompareMode = route.query.compareMode;
  const qGeschSt = route.query.geschSt;

  if (qVon != null && qBis != null) {
    const von = parseInt(qVon, 10);
    const bis = parseInt(qBis, 10);
    if (!isNaN(von) && !isNaN(bis) && von >= 0 && bis <= totalMonths) {
      sliderRange.value = [von, bis];
    }
  }

  // Pre-select Standort filter if provided
  if (qGeschSt) {
    selectedGeschSt.value = String(qGeschSt);
  }

  if (qKundenNr) {
    const nr = parseInt(qKundenNr, 10);
    if (!isNaN(nr)) {
      selectedKundenNrs.value = [nr];
    }
  }

  // Set compare mode if provided (e.g. 'kunden' from CustomerCard deep link)
  if (qCompareMode && ['kunden', 'standort'].includes(qCompareMode)) {
    compareMode.value = qCompareMode;
  }

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

/* ---- Tab Navigation ---- */
.tab-navigation {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border);
}

.tab-separator {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 4px;
}

.tab-content {
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

.slider-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.slider-reset-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.15s;

  &:hover {
    color: var(--primary);
  }
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

/* ---- Tab Icons ---- */
.tab-icon {
  margin-right: 4px;
  font-size: 13px;
}

/* ---- Pie Chart ---- */
.pie-wrapper {
  height: 460px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pie-wrapper canvas {
  max-height: 400px !important;
  max-width: 100% !important;
}
</style>
