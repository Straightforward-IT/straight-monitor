<template>
  <div class="auftraege-page">
    <div class="page-header">
      <h1>Aufträge</h1>
      <div class="header-controls">
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Suchen (Auftrag, Kunde, Ort...)"
            @input="debouncedSearch"
          />
        </div>
      </div>
    </div>

    <div class="filter-section">
      <div class="filter-header" @click="toggleFilters">
        <h3>Filter</h3>
        <button class="collapse-btn" type="button">
          <font-awesome-icon :icon="filtersExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
        </button>
      </div>
      
      <div v-show="filtersExpanded" class="filter-content">
        <div class="filter-chips">
          <!-- GeschSt Filter -->
          <div class="chip-group">
            <span class="chip-label">Geschäftsstelle</span>
            <button
              class="chip"
              :class="{ active: filters.geschSt === '1' }"
              @click="setGeschStFilter('1')"
            >
              Berlin
            </button>
            <button
              class="chip"
              :class="{ active: filters.geschSt === '2' }"
              @click="setGeschStFilter('2')"
            >
              Hamburg
            </button>
            <button
              class="chip"
              :class="{ active: filters.geschSt === '3' }"
              @click="setGeschStFilter('3')"
            >
              Köln
            </button>
             <button
              class="chip"
              :class="{ active: !filters.geschSt }"
              @click="setGeschStFilter(null)"
            >
              Alle
            </button>
          </div>

          <span class="divider" />

          <!-- Bediener Filter -->
          <div class="chip-group dropdown-group">
            <span class="chip-label">Bediener</span>
            <div class="dropdown-trigger" @click.stop="showBedienerDropdown = !showBedienerDropdown">
              <span v-if="filters.bediener.length === 0">Alle Bediener</span>
              <span v-else>{{ filters.bediener.length }} ausgewählt</span>
              <font-awesome-icon icon="fa-solid fa-chevron-down" />
            </div>
            
            <div v-if="showBedienerDropdown" class="dropdown-menu" @click.stop>
              <div v-if="filterOptions.bediener.length === 0" class="no-options">Keine Bediener gefunden</div>
              <label v-for="bed in filterOptions.bediener" :key="bed" class="dropdown-item">
                <input 
                  type="checkbox" 
                  :checked="filters.bediener.includes(bed)"
                  @change="toggleBedienerFilter(bed)"
                >
                <span class="label-text">{{ bed }}</span>
              </label>
            </div>
          </div>

          <span class="divider" />
          
           <!-- Reset Button -->
            <div class="reset-button-container">
              <button class="chip reset-chip" @click="resetAllFilters" title="Alle Filter zurücksetzen">
                <font-awesome-icon icon="fa-solid fa-rotate-left" />
                Zurücksetzen
              </button>
            </div>
        </div>
      </div>
    </div>

    <div class="calendar-navigation">
      <button class="nav-btn" @click="previousWeek">
        <span>← Vorherige Woche</span>
      </button>
      <div class="current-range">
        {{ formatDateRange(currentWeekStart, currentWeekEnd) }}
      </div>
      <button class="nav-btn" @click="nextWeek">
        <span>Nächste Woche →</span>
      </button>
      <button class="nav-btn today-btn" @click="goToToday">Heute</button>
    </div>

    <div v-if="loading" class="loading-state">
      <span>Lade Aufträge...</span>
    </div>

    <div v-else class="calendar-grid">
      <div class="calendar-header">
        <div class="kw-cell">KW</div>
        <div 
          v-for="day in weekDays" 
          :key="day.key" 
          class="day-header"
          :class="{ 'is-today': isToday(day.date) }"
        >
          <div class="day-name">{{ day.name }}</div>
          <div class="day-date">{{ formatDayDate(day.date) }}</div>
        </div>
      </div>

      <div class="calendar-body">
        <div class="kw-cell kw-number">{{ currentKW }}</div>
        <div 
          v-for="day in weekDays" 
          :key="day.key" 
          class="day-column"
          :class="{ 'is-today': isToday(day.date) }"
        >
          <div class="day-stats">
            {{ getEventsForDay(day.date).length }} Aufträge
          </div>
          <div 
            v-for="event in getEventsForDay(day.date)" 
            :key="event._id"
            class="event-card"
            :class="getEventStatusClass(event)"
            @click="selectEvent(event)"
          >
            <div class="event-title">{{ event.eventTitel || 'Kein Titel' }}</div>
            <div class="event-kunde">{{ event.kundeData?.kundName || '-' }}</div>
            <div class="event-location">{{ event.eventOrt || '-' }}</div>
            <div class="event-time">
              {{ formatTime(event.vonDatum) }} - {{ formatTime(event.bisDatum) }}
            </div>
            <div class="event-einsaetze" v-if="event.einsaetzeCount">
              {{ event.einsaetzeCount }} Einsätze
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Detail Modal -->
    <div v-if="selectedEvent" class="modal-overlay" @click.self="selectedEvent = null">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ selectedEvent.eventTitel || 'Auftrag Details' }}</h2>
          <button class="close-btn" @click="selectedEvent = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-row">
              <span class="label">Auftrag Nr:</span>
              <span class="value">{{ selectedEvent.auftragNr }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Kunde:</span>
              <span class="value">{{ selectedEvent.kundeData?.kundName || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Von:</span>
              <span class="value">{{ formatDateTime(selectedEvent.vonDatum) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Bis:</span>
              <span class="value">{{ formatDateTime(selectedEvent.bisDatum) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Location:</span>
              <span class="value">{{ selectedEvent.eventLocation || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Adresse:</span>
              <span class="value">
                {{ selectedEvent.eventStrasse || '' }} 
                {{ selectedEvent.eventPlz || '' }} 
                {{ selectedEvent.eventOrt || '' }}
              </span>
            </div>
            <div class="detail-row">
              <span class="label">Status:</span>
              <span class="value">{{ getStatusText(selectedEvent.auftStatus) }}</span>
            </div>
          </div>

          <div class="einsaetze-section" v-if="selectedEvent.einsaetze?.length">
            <h3>Einsätze ({{ selectedEvent.einsaetze.length }})</h3>
            <div class="einsaetze-grouped">
              <div 
                v-for="(schicht, schichtId) in groupedEinsaetze" 
                :key="schichtId"
                class="schicht-group"
              >
                <div class="schicht-header">Schicht {{ schichtId || 'Ohne Zuordnung' }}</div>
                <div class="einsatz-list">
                  <div 
                    v-for="einsatz in schicht" 
                    :key="einsatz._id"
                    class="einsatz-item"
                  >
                    <span class="einsatz-personal">{{ einsatz.personalNr || '-' }}</span>
                    <span class="einsatz-bezeichnung">{{ einsatz.bezeichnung || '-' }}</span>
                    <span class="einsatz-zeit">
                      {{ formatTime(einsatz.datumVon) }} - {{ formatTime(einsatz.datumBis) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "../utils/api";
import { mapState } from 'pinia';
import { useAuth } from '../stores/auth';

export default {
  name: "AuftraegePage",
  data() {
    return {
      auftraege: [],
      loading: false,
      searchQuery: "",
      currentWeekStart: null,
      selectedEvent: null,
      loadedMonths: new Set(), // Track which months we've loaded
      debounceTimer: null,
      
      // Filter State
      filtersExpanded: false,
      filterOptions: {
        bediener: []
      },
      filters: {
        geschSt: null,
        bediener: []
      },
      showBedienerDropdown: false
    };
  },
  computed: {
    ...mapState(useAuth, ['user']),
    currentWeekEnd() {
      if (!this.currentWeekStart) return null;
      const end = new Date(this.currentWeekStart);
      end.setDate(end.getDate() + 6);
      return end;
    },
    currentKW() {
      if (!this.currentWeekStart) return '';
      return this.getWeekNumber(this.currentWeekStart);
    },
    weekDays() {
      if (!this.currentWeekStart) return [];
      const days = [];
      const dayNames = ['MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG', 'SONNTAG'];
      for (let i = 0; i < 7; i++) {
        const date = new Date(this.currentWeekStart);
        date.setDate(date.getDate() + i);
        days.push({
          key: i,
          name: dayNames[i],
          date: date
        });
      }
      return days;
    },
    filteredAuftraege() {
      if (!this.searchQuery.trim()) return this.auftraege;
      const q = this.searchQuery.toLowerCase();
      return this.auftraege.filter(a => 
        (a.eventTitel && a.eventTitel.toLowerCase().includes(q)) ||
        (a.eventOrt && a.eventOrt.toLowerCase().includes(q)) ||
        (a.kundeData?.kundName && a.kundeData.kundName.toLowerCase().includes(q)) ||
        (a.auftragNr && String(a.auftragNr).includes(q))
      );
    },
    groupedEinsaetze() {
      if (!this.selectedEvent?.einsaetze) return {};
      const grouped = {};
      this.selectedEvent.einsaetze.forEach(e => {
        const key = e.idAuftragArbeitsschichten || 'none';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
      });
      return grouped;
    }
  },
  methods: {
    initializeWeek() {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as first day
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      this.currentWeekStart = monday;
    },
    async loadAuftraege(fromDate, toDate) {
      this.loading = true;
      try {
        const params = new URLSearchParams();
        if (fromDate) params.append('from', fromDate.toISOString());
        if (toDate) params.append('to', toDate.toISOString());
        
        // Add Filters
        if (this.filters.geschSt) {
          params.append('geschSt', this.filters.geschSt);
        }
        if (this.filters.bediener && this.filters.bediener.length > 0) {
          params.append('bediener', this.filters.bediener.join(','));
        }
        
        const response = await api.get(`/api/auftraege?${params.toString()}`);
        
        // Merge with existing, avoiding duplicates
        const existingIds = new Set(this.auftraege.map(a => a._id));
        const newAuftraege = response.data.filter(a => !existingIds.has(a._id));
        this.auftraege = [...this.auftraege, ...newAuftraege];
        
      } catch (error) {
        console.error('Error loading Aufträge:', error);
      } finally {
        this.loading = false;
      }
    },
    async fetchFilterOptions() {
      try {
        const res = await api.get('/api/auftraege/filters');
        this.filterOptions.bediener = res.data.bediener || [];
      } catch (e) {
        console.error("Error fetching filters", e);
      }
    },
    setDefaultFilters() {
      // 1=Berlin, 2=Hamburg, 3=Köln
      if (this.user && this.user.standort) {
        const loc = this.user.standort.toLowerCase();
        if (loc.includes('berlin')) this.filters.geschSt = '1';
        else if (loc.includes('hamburg')) this.filters.geschSt = '2';
        else if (loc.includes('köln') || loc.includes('koeln')) this.filters.geschSt = '3';
      }
    },
    toggleFilters() {
      this.filtersExpanded = !this.filtersExpanded;
    },
    setGeschStFilter(val) {
      if (this.filters.geschSt === val) return;
      this.filters.geschSt = val;
      this.resetAndReload();
    },
    toggleBedienerFilter(val) {
      const idx = this.filters.bediener.indexOf(val);
      if (idx === -1) {
        this.filters.bediener.push(val);
      } else {
        this.filters.bediener.splice(idx, 1);
      }
      this.resetAndReload();
    },
    resetAllFilters() {
      this.filters.geschSt = null;
      this.filters.bediener = [];
      this.setDefaultFilters(); // Or reset to completely empty? User probably wants default
      this.resetAndReload();
    },
    async resetAndReload() {
      this.auftraege = []; // Clear current list
      this.loadedMonths.clear(); // Reset cache
      
      // Reload current view
      // We need to reload based on currentWeekStart
      // Usually current week spans 2 months max, so let's reload a safe range or just use ensureMonthLoaded logic
      const start = new Date(this.currentWeekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      
      // Load current month range
      await this.ensureMonthLoaded(start);
      // If week crosses month boundary
      await this.ensureMonthLoaded(end);
    },
    async loadInitialData() {
      // Load current month and all future
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      await this.loadAuftraege(startOfMonth, null);
      this.loadedMonths.add(`${now.getFullYear()}-${now.getMonth()}`);
    },
    async ensureMonthLoaded(date) {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (this.loadedMonths.has(monthKey)) return;
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      await this.loadAuftraege(startOfMonth, endOfMonth);
      this.loadedMonths.add(monthKey);
    },
    async previousWeek() {
      const newStart = new Date(this.currentWeekStart);
      newStart.setDate(newStart.getDate() - 7);
      this.currentWeekStart = newStart;
      await this.ensureMonthLoaded(newStart);
    },
    async nextWeek() {
      const newStart = new Date(this.currentWeekStart);
      newStart.setDate(newStart.getDate() + 7);
      this.currentWeekStart = newStart;
      await this.ensureMonthLoaded(newStart);
    },
    goToToday() {
      this.initializeWeek();
    },
    getEventsForDay(date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      return this.filteredAuftraege.filter(a => {
        const von = new Date(a.vonDatum);
        const bis = new Date(a.bisDatum);
        // Event spans this day if: vonDatum <= dayEnd AND bisDatum >= dayStart
        return von <= dayEnd && bis >= dayStart;
      }).sort((a, b) => new Date(a.vonDatum) - new Date(b.vonDatum));
    },
    async selectEvent(event) {
      // Load full details including Einsätze
      try {
        const response = await api.get(`/api/auftraege/${event.auftragNr}/details`);
        this.selectedEvent = response.data;
      } catch (error) {
        console.error('Error loading event details:', error);
        this.selectedEvent = event; // fallback to basic data
      }
    },
    getEventStatusClass(event) {
      // Color coding based on status
      const status = event.auftStatus;
      if (status === 1) return 'status-draft';
      if (status === 2) return 'status-confirmed';
      if (status === 3) return 'status-completed';
      return 'status-default';
    },
    getStatusText(status) {
      const map = { 1: 'Entwurf', 2: 'Bestätigt', 3: 'Abgeschlossen' };
      return map[status] || 'Unbekannt';
    },
    getWeekNumber(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },
    isToday(date) {
      const today = new Date();
      return date.toDateString() === today.toDateString();
    },
    formatDateRange(start, end) {
      if (!start || !end) return '';
      const opts = { day: 'numeric', month: 'short', year: 'numeric' };
      return `${start.toLocaleDateString('de-DE', opts)} - ${end.toLocaleDateString('de-DE', opts)}`;
    },
    formatDayDate(date) {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    },
    formatTime(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    },
    formatDateTime(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleString('de-DE', { 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit' 
      });
    },
    debouncedSearch() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        // Search is reactive via computed, no action needed
      }, 300);
    }
  },
  async mounted() {
    await this.fetchFilterOptions();
    this.setDefaultFilters();
    this.initializeWeek();
    await this.loadInitialData();
  }
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.auftraege-page {
  padding: 20px;
  max-width: 100%;
  overflow-x: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;

  h1 {
    font-size: 1.8rem;
    color: var(--text);
    margin: 0;
  }
}

.header-controls {
  display: flex;
  gap: 10px;
}

.search-box input {
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.95rem;
  width: 280px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.calendar-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.nav-btn {
  padding: 8px 16px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: var(--hover);
    border-color: var(--primary);
  }

  &.today-btn {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);

    &:hover {
      filter: brightness(0.95);
    }
  }
}

.current-range {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  min-width: 250px;
  text-align: center;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--muted);
  font-size: 1.1rem;
}

.calendar-grid {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.calendar-header {
  display: grid;
  grid-template-columns: 50px repeat(7, 1fr);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.kw-cell {
  padding: 12px 8px;
  text-align: center;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--muted);
  border-right: 1px solid var(--border);
}

.kw-number {
  font-size: 1rem;
  color: var(--text);
}

.day-header {
  padding: 12px 8px;
  text-align: center;
  border-right: 1px solid var(--border);

  &:last-child {
    border-right: none;
  }

  &.is-today {
    background: color-mix(in oklab, var(--primary) 15%, transparent);
  }

  .day-name {
    font-weight: 700;
    font-size: 0.75rem;
    color: var(--muted);
    margin-bottom: 4px;
  }

  .day-date {
    font-size: 0.9rem;
    color: var(--text);
  }
}

.calendar-body {
  display: grid;
  grid-template-columns: 50px repeat(7, 1fr);
  min-height: 500px;
}

.day-column {
  border-right: 1px solid var(--border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 400px;
  overflow-y: auto;

  &:last-child {
    border-right: none;
  }

  &.is-today {
    background: color-mix(in oklab, var(--primary) 5%, transparent);
  }
}

.day-stats {
  font-size: 0.7rem;
  color: var(--muted);
  text-align: center;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border);
  margin-bottom: 4px;
}

.event-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.75rem;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  &.status-draft {
    border-left: 3px solid #f59e0b;
  }

  &.status-confirmed {
    border-left: 3px solid #22c55e;
    background: color-mix(in oklab, #22c55e 8%, var(--panel));
  }

  &.status-completed {
    border-left: 3px solid #3b82f6;
    opacity: 0.7;
  }

  &.status-default {
    border-left: 3px solid var(--muted);
  }
}

.event-title {
  font-weight: 600;
  color: var(--text);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-kunde {
  color: var(--primary);
  font-weight: 500;
  margin-bottom: 2px;
}

.event-location {
  color: var(--muted);
  font-size: 0.7rem;
}

.event-time {
  color: var(--text);
  font-weight: 500;
  margin-top: 4px;
}

.event-einsaetze {
  margin-top: 4px;
  font-size: 0.65rem;
  color: var(--muted);
  background: var(--hover);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--tile-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h2 {
    margin: 0;
    font-size: 1.3rem;
    color: var(--text);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.8rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;

    &:hover {
      color: var(--text);
    }
  }
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.detail-grid {
  display: grid;
  gap: 12px;
}

.detail-row {
  display: flex;
  gap: 10px;

  .label {
    font-weight: 600;
    color: var(--muted);
    min-width: 100px;
  }

  .value {
    color: var(--text);
  }
}

.einsaetze-section {
  margin-top: 24px;
  
  h3 {
    font-size: 1.1rem;
    margin-bottom: 12px;
    color: var(--text);
  }
}

.schicht-group {
  margin-bottom: 16px;
  background: var(--panel);
  border-radius: 8px;
  overflow: hidden;
}

.schicht-header {
  background: var(--hover);
  padding: 10px 14px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  border-bottom: 1px solid var(--border);
}

.einsatz-list {
  padding: 8px;
}

.einsatz-item {
  display: flex;
  gap: 12px;
  padding: 8px 10px;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border);

  &:last-child {
    border-bottom: none;
  }

  .einsatz-personal {
    font-weight: 600;
    min-width: 80px;
    color: var(--primary);
  }

  .einsatz-bezeichnung {
    flex: 1;
    color: var(--text);
  }

  .einsatz-zeit {
    color: var(--muted);
    font-size: 0.8rem;
  }
}

/* Filter Section Styles */
.filter-section {
  background: var(--tile-bg);
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    cursor: pointer;
    user-select: none;

    h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--text);
    }
    
    .collapse-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 1rem;
    }
  }

  .filter-content {
    padding: 0 20px 20px;
    border-top: 1px solid var(--border);
  }
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 15px;

  .chip-group {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .chip-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted);
      margin-right: 4px;
    }
  }

  .chip {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      border-color: var(--primary);
    }
    
    &.active {
      background: rgba(var(--primary-rgb), 0.1);
      border-color: var(--primary);
      color: var(--primary);
    }
    
    &.reset-chip {
      color: #ff4d4f;
      border-color: #ff4d4f;
       &:hover {
         background: rgba(255, 77, 79, 0.1);
       }
    }
  }

  .divider {
    width: 1px;
    height: 24px;
    background: var(--border);
    margin: 0 8px;
  }
}

/* Dropdown */
.dropdown-group {
  position: relative;
  
  .dropdown-trigger {
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 140px;
    justify-content: space-between;
    color: var(--text);
    
    &:hover {
      border-color: var(--primary);
    }
  }
  
  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: var(--tile-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 100;
    min-width: 200px;
    max-height: 300px;
    overflow-y: auto;
    padding: 8px 0;
    
    .dropdown-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 0.9rem;
      color: var(--text);
      
      &:hover {
        background: var(--bg);
      }
      
      input {
        margin-right: 8px;
      }
      
      .label-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    
    .no-options {
       padding: 8px 12px;
       color: var(--muted);
       font-style: italic;
       font-size: 0.85rem;
    }
  }
}

/* Mobile */
@media (max-width: 1024px) {
  .calendar-header,
  .calendar-body {
    grid-template-columns: 40px repeat(7, minmax(100px, 1fr));
  }

  .day-header .day-name {
    font-size: 0.65rem;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-box input {
    width: 100%;
  }

  .calendar-navigation {
    flex-direction: column;
    gap: 10px;
  }

  .calendar-grid {
    overflow-x: auto;
  }

  .calendar-header,
  .calendar-body {
    min-width: 800px;
  }
}
</style>
