<template>
  <div class="graph-view">
    <line-chart :data="chartData" :options="chartOptions"></line-chart>

    <div class="time-range-dropdown">
      <label for="time-range">Zeitraum:</label>
      <select id="time-range" v-model="selectedTimeRange" @change="applyFilters">
        <option value="today">Heute</option>
        <option value="last3days">Letzte 3 Tage</option>
        <option value="lastWeek">Letzte Woche</option>
        <option value="last30days">Letzte 30 Tage</option>
        <option value="last3months">Letzte 3 Monate</option>
        <option value="last6months">Letzte 6 Monate</option>
        <option value="lastYear">Letztes Jahr</option>
        <option value="custom">Benutzerdefiniert</option>
      </select>
      <div v-if="selectedTimeRange === 'custom'" class="date-range">
        <input type="date" v-model="customStartDate" /> bis
        <input type="date" v-model="customEndDate" />
      </div>
    </div>

    <button class="filter-button" @click="openFilterModal">Erweiterte Filter</button>

    <div v-if="isFilterModalOpen" class="filter-modal">
      <div class="modal-content">
        <h3>Filter & Sortieren</h3>

        <!-- User-Based Filtering -->
        <div class="filter-section">
          <label for="user-filter">Benutzername:</label>
          <input type="text" v-model="userNameFilter" placeholder="Benutzernamen eingeben" />

          <label for="email-filter">E-Mail:</label>
          <input type="text" v-model="userEmailFilter" placeholder="E-Mail-Adresse eingeben" />

          <label for="user-id-filter">Benutzer-ID:</label>
          <input type="text" v-model="userIdFilter" placeholder="Benutzer-ID eingeben" />
        </div>

        <!-- Filter by Location -->
        <div class="filter-section">
          <label>Standort:</label>
          <div v-for="location in availableLocations" :key="location">
            <input type="checkbox" :value="location" v-model="locationFilter" />
            <label>{{ location }}</label>
          </div>
        </div>

        <!-- Filter by Type -->
        <div class="filter-section">
          <label>Art:</label>
          <div v-for="type in availableTypes" :key="type">
            <input type="checkbox" :value="type" v-model="typeFilter" />
            <label>{{ type }}</label>
          </div>
        </div>

        <!-- Filter by Quantity Range -->
        <div class="filter-section">
          <label>Menge (Quantity):</label>
          <input type="number" v-model.number="quantityMin" placeholder="Min" />
          <input type="number" v-model.number="quantityMax" placeholder="Max" />
        </div>

        <!-- Text Search -->
        <div class="filter-section">
          <label>Suche in Anmerkungen:</label>
          <input type="text" v-model="searchText" placeholder="Suchbegriff eingeben" />
        </div>

        <!-- Sorting Options -->
        <div class="filter-section">
          <label for="sort-option">Sortieren nach:</label>
          <select v-model="sortOption">
            <option value="timestampAsc">Datum (Aufsteigend)</option>
            <option value="timestampDesc">Datum (Absteigend)</option>
            <option value="quantityAsc">Menge (Aufsteigend)</option>
            <option value="quantityDesc">Menge (Absteigend)</option>
            <option value="userName">Benutzername</option>
            <option value="location">Standort (Alphabetisch)</option>
          </select>
        </div>

        <p class="preview-count">{{ filteredMonitorings.length }} Einträge entsprechen den Filtern</p>
        <button @click="applyFilters">Anwenden</button>
        <button @click="clearFilters">Filter Zurücksetzen</button>
        <button @click="closeFilterModal">Schließen</button>
      </div>
    </div>
  </div>
</template>

<script>
import { Line } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, Filler, LineElement, CategoryScale, LinearScale, PointElement, TimeScale } from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(Title, Tooltip, Legend, Filler, LineElement, CategoryScale, LinearScale, PointElement, TimeScale);

export default {
  name: "GraphView",
  components: {
    LineChart: Line,
  },
  props: {
    monitorings: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      chartData: {
        labels: [],
        datasets: [
          {
            label: 'Menge (Quantity)',
            data: [],
            borderColor: '#1d1d1d',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: false,
            tension: 0,
            showLine: false,
            pointRadius: 3,
          },
        ],
      },
      chartOptions: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
            },
            title: {
              display: true,
              text: 'Zeit (Time)',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Menge (Quantity)',
            },
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: context => {
                const log = this.filteredMonitorings[context.dataIndex];
                return `Menge: ${context.raw}, Benutzer: ${log.benutzerMail}, Art: ${log.art}, Standort: ${log.standort}, Anmerkung: ${log.anmerkung || 'Keine'}`;
              },
            },
          },
        },
      },
      selectedTimeRange: 'totalTime',
      isFilterModalOpen: false,
      locationFilter: [],
      typeFilter: [],
      quantityMin: null,
      quantityMax: null,
      searchText: '',
      userNameFilter: '',
      userEmailFilter: '',
      userIdFilter: '',
      sortOption: 'timestampAsc',
      availableLocations: ['Hamburg', 'Berlin', 'Koeln'],
      availableTypes: ['zugabe', 'entnahme', 'änderung'],
      customStartDate: '',
      customEndDate: '',
    };
  },
  computed: {
    filteredMonitorings() {
      let logs = [...this.monitorings];

      // User-based filters
      if (this.userNameFilter) {
        logs = logs.filter(log => log.benutzer && log.benutzer.name.toLowerCase().includes(this.userNameFilter.toLowerCase()));
      }
      if (this.userEmailFilter) {
        logs = logs.filter(log => log.benutzerMail.toLowerCase().includes(this.userEmailFilter.toLowerCase()));
      }
      if (this.userIdFilter) {
        logs = logs.filter(log => log.benutzer && log.benutzer._id === this.userIdFilter);
      }

      // Location-based filters
      if (this.locationFilter.length > 0) {
        logs = logs.filter(log => this.locationFilter.includes(log.standort));
      }

      // Type-based filters
      if (this.typeFilter.length > 0) {
        logs = logs.filter(log => this.typeFilter.includes(log.art));
      }

      // Quantity-based filters
      if (this.quantityMin !== null) {
        logs = logs.filter(log => log.items.reduce((sum, item) => sum + item.anzahl, 0) >= this.quantityMin);
      }
      if (this.quantityMax !== null) {
        logs = logs.filter(log => log.items.reduce((sum, item) => sum + item.anzahl, 0) <= this.quantityMax);
      }

      // Search text filter for anmerkung and item descriptions
      if (this.searchText) {
        logs = logs.filter(log =>
          log.anmerkung.toLowerCase().includes(this.searchText.toLowerCase()) ||
          log.items.some(item => item.bezeichnung.toLowerCase().includes(this.searchText.toLowerCase()))
        );
      }

      // Time range filtering
      logs = this.applyTimeRangeFilter(logs);

      // Sort logs
      logs = this.sortLogs(logs);

      return logs;
    },
  },
  methods: {
    updateChartData() {
      const labels = this.filteredMonitorings.map(log => new Date(log.timestamp));
      const data = this.filteredMonitorings.map(log => {
        return log.items.reduce((total, item) => total + Math.max(0, item.anzahl), 0);
      });

      this.chartData.labels = labels;
      this.chartData.datasets[0].data = data;
    },
    applyTimeRangeFilter(logs) {
      const now = new Date();
      const startDates = {
        today: new Date(now.setHours(0, 0, 0, 0)),
        last3days: new Date(now.setDate(now.getDate() - 3)),
        lastWeek: new Date(now.setDate(now.getDate() - 7)),
        last30days: new Date(now.setDate(now.getDate() - 30)),
        last3months: new Date(now.setMonth(now.getMonth() - 3)),
        last6months: new Date(now.setMonth(now.getMonth() - 6)),
        lastYear: new Date(now.setFullYear(now.getFullYear() - 1)),
        custom: this.customStartDate ? new Date(this.customStartDate) : null,
      };

      if (this.selectedTimeRange !== 'totalTime' && startDates[this.selectedTimeRange]) {
        const startDate = startDates[this.selectedTimeRange];
        const endDate = this.customEndDate ? new Date(this.customEndDate) : new Date();
        logs = logs.filter(log => new Date(log.timestamp) >= startDate && new Date(log.timestamp) <= endDate);
      }

      return logs;
    },
    sortLogs(logs) {
      switch (this.sortOption) {
        case 'quantityAsc':
          return logs.sort((a, b) => a.items.reduce((sum, item) => sum + item.anzahl, 0) - b.items.reduce((sum, item) => sum + item.anzahl, 0));
        case 'quantityDesc':
          return logs.sort((a, b) => b.items.reduce((sum, item) => sum + item.anzahl, 0) - a.items.reduce((sum, item) => sum + item.anzahl, 0));
        case 'timestampDesc':
          return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        default:
          return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
    },
    openFilterModal() {
      this.isFilterModalOpen = true;
    },
    closeFilterModal() {
      this.isFilterModalOpen = false;
    },
    updateTimeRange() {
      this.updateChartData();
    },
  },
  watch: {
    monitorings: {
      immediate: true,
      handler() {
        this.updateChartData();
      },
    },
    selectedTimeRange() {
      this.updateChartData();
    },
    filteredMonitorings() {
      this.updateChartData();
    },
  },
  mounted() {
    this.updateChartData();
  },
};
</script>


<style scoped lang="scss">

.verlauf {
  display: flex;
  width: 100%;
  min-height: 120vh;
  height: auto;
  background: #f8f8f8;
  overflow: hidden;

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background-color: #ffffff;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    width: 220px;
    flex-shrink: 0;

    .back-link {
      color: #555;
      font-size: 16px;
      text-decoration: none;
      cursor: pointer;
      margin-bottom: 20px;
      &:hover {
        text-decoration: underline;
      }
    }

    .controls {
      display: flex;
      flex-direction: column;
      gap: 10px;

      button {
        padding: 10px;
        border: none;
        background-color: #ddd;
        cursor: pointer;
        text-align: left;
        border-radius: 5px;
        transition: background-color 0.3s;
        &.active {
          background-color: #b69de6;
          color: white;
        }
        &:hover {
          background-color: #cbb9e9;
        }
      }
    }
  }

  .view {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    padding: 20px;
    background: #f8f8f8;
    max-width: 1000px; /* Adjusted to ensure the graph takes up most of the width */
    overflow: hidden;

    .graph-view {
      margin: 50px;
      width: 100%;
      height: 600px;
      max-width: 100%;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .time-range-dropdown {
      display: flex;
      margin: 16px;
      gap: 10px;
      align-items: center;
      align-self: end;
      justify-content: flex-end;
      margin-top: 10px;

      label {
        font-weight: bold;
        margin-right: 5px;
      }

      select {
        padding: 5px;
        font-size: 14px;
        border: 1px solid #ddd;
        border-radius: 5px;
      }

      button {
        padding: 5px 10px;
        background-color: #333;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;

        &:hover {
          background-color: #555;
        }
      }
    }
  }
}
</style>