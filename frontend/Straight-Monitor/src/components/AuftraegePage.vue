<template>
  <div class="auftraege-page" :class="{ 'sidebar-open': selectedEvent }">
    <div class="main-content">
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

    <FilterPanel v-model:expanded="filtersExpanded" title="Filter Optionen">
          <!-- GeschSt Filter -->
          <FilterGroup label="Geschäftsstelle">
            <FilterChip
              :active="filters.geschSt === '1'"
              @click="setGeschStFilter('1')"
            >
              Berlin
            </FilterChip>
            <FilterChip
              :active="filters.geschSt === '2'"
              @click="setGeschStFilter('2')"
            >
              Hamburg
            </FilterChip>
            <FilterChip
              :active="filters.geschSt === '3'"
              @click="setGeschStFilter('3')"
            >
              Köln
            </FilterChip>
             <FilterChip
              :active="!filters.geschSt"
              @click="setGeschStFilter(null)"
            >
              Alle
            </FilterChip>
          </FilterGroup>

          <FilterDivider />

          <!-- Bediener Filter -->
          <FilterGroup label="Bediener">
            <FilterDropdown :has-value="filters.bediener.length > 0">
              <template #label>
                <span v-if="filters.bediener.length === 0">Alle Bediener</span>
                <span v-else>{{ filters.bediener.length }} ausgewählt</span>
              </template>
              
              <div v-if="filterOptions.bediener.length === 0" class="no-options">Keine Bediener gefunden</div>
              <label v-for="bed in filterOptions.bediener" :key="bed" class="dropdown-item">
                <input 
                  type="checkbox" 
                  :checked="filters.bediener.includes(bed)"
                  @change="toggleBedienerFilter(bed)"
                >
                <span class="label-text">{{ bed }}</span>
              </label>
            </FilterDropdown>
          </FilterGroup>

          <FilterDivider />
          
           <!-- Reset Button -->
          <FilterChip class="reset-chip" @click="resetAllFilters" title="Alle Filter zurücksetzen">
            <font-awesome-icon icon="fa-solid fa-rotate-left" />
            Zurücksetzen
          </FilterChip>
      </FilterPanel>

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
      <button class="nav-btn calendar-btn" @click="openDatePicker" title="Zu Woche springen (Datum wählen)">
        <font-awesome-icon icon="fa-solid fa-calendar" />
      </button>
      <input 
        ref="datePicker" 
        type="date" 
        class="hidden-date-input" 
        @change="handleDatePick"
      >
    </div>

    <!-- Mobile View -->
    <div v-if="isMobile" class="mobile-calendar-view">
      <div class="mobile-nav">
        <button class="nav-btn-mobile" @click="prevDay">
          <font-awesome-icon icon="fa-solid fa-chevron-left" />
        </button>
        
        <div class="mobile-date-display" v-if="weekDays[mobileDayIndex]">
          <span class="day-name">{{ weekDays[mobileDayIndex].name }}</span>
          <span class="day-date">{{ formatDayDate(weekDays[mobileDayIndex].date) }}</span>
        </div>
        
        <button class="nav-btn-mobile" @click="nextDay">
            <font-awesome-icon icon="fa-solid fa-chevron-right" />
        </button>
      </div>

      <div class="mobile-day-content" v-if="weekDays[mobileDayIndex]">
        <!-- Reuse existing methods -->
        <div class="day-stats" style="text-align: center; margin-bottom: 10px;">
          {{ getEventsForDay(weekDays[mobileDayIndex].date).length }} Aufträge • {{ getTotalPositionsForDay(weekDays[mobileDayIndex].date) }} Pos.
        </div>
        
        <div v-if="getEventsForDay(weekDays[mobileDayIndex].date).length === 0" class="empty-day-state">
            Keine Aufträge heute
        </div>
        
        <div 
          v-for="event in getEventsForDay(weekDays[mobileDayIndex].date)" 
          :key="event._id"
          class="event-card-mobile"
          :class="getEventStatusClass(event)"
          @click="selectEvent(event)"
        >
            <div class="event-header">
              <span v-if="event.auftStatus !== 2" class="event-status">{{ getStatusText(event.auftStatus) }}</span>
            </div>
            
            <div class="event-title">{{ event.eventTitel || 'Kein Titel' }}</div>
            
            <div class="event-details">
              <div class="detail-row">
                  <font-awesome-icon icon="fa-solid fa-user" class="icon" />
                  <span>{{ event.kundeData?.kundName || '-' }}</span>
              </div>
              <div class="detail-row">
                  <font-awesome-icon icon="fa-solid fa-location-dot" class="icon" />
                  <span>{{ event.eventOrt || '-' }}</span>
              </div>
            </div>
        </div>
      </div>
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

      <div v-if="loading" class="loading-body">
        <span>Lade Aufträge...</span>
      </div>

      <div v-else class="calendar-body">
        <div class="kw-cell kw-number">{{ currentKW }}</div>
        <div 
          v-for="day in weekDays" 
          :key="day.key" 
          class="day-column"
          :class="{ 'is-today': isToday(day.date) }"
        >
          <div class="day-stats">
            {{ getEventsForDay(day.date).length }} Aufträge • {{ getTotalPositionsForDay(day.date) }} Pos.
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
            <div class="event-einsaetze" v-if="event.einsaetzeCount">
              {{ event.einsaetzeCount }} Einsätze
            </div>
          </div>
        </div>
      </div>
    </div>
    </div><!-- End main-content -->

    <!-- Sidebar for Event Details -->
    <transition name="sidebar-slide">
      <div v-if="selectedEvent" class="detail-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title-area">
            <span v-if="selectedEvent.auftStatus !== 2" class="sidebar-status" :class="getEventStatusClass(selectedEvent)">{{ getStatusText(selectedEvent.auftStatus) }}</span>
            <h2>{{ selectedEvent.eventTitel || 'Auftrag Details' }}</h2>
          </div>
          <button class="close-btn" @click="selectedEvent = null" title="Schließen (Esc)">×</button>
        </div>
        
        <div class="sidebar-body">
          <!-- Compact Info Grid -->
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Auftrag</span>
              <span class="info-value">#{{ selectedEvent.auftragNr }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Kunde</span>
              <span class="info-value highlight">{{ selectedEvent.kundeData?.kundName || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Zeitraum</span>
              <span class="info-value">{{ formatDateRange(new Date(selectedEvent.vonDatum), new Date(selectedEvent.bisDatum)) }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">Adresse</span>
              <span class="info-value">
                <template v-if="selectedEvent.eventLocation">{{ selectedEvent.eventLocation }}<br></template>
                {{ selectedEvent.eventStrasse || '' }} {{ selectedEvent.eventPlz || '' }} {{ selectedEvent.eventOrt || '' }}
              </span>
            </div>
          </div>

          <!-- Schichten Section -->
          <div class="schichten-section" v-if="selectedEvent.einsaetze?.length">
            <div class="section-header">
              <h3>Schichten</h3>
              <span class="section-count">{{ Object.keys(preparedSchichten).length }}</span>
            </div>
            
            <div class="schichten-list">
              <div 
                v-for="(schichtData, schichtId) in preparedSchichten" 
                :key="schichtId"
                class="schicht-card"
              >
                <!-- Schicht Header with Times & Bedarf -->
                <div class="schicht-header-compact">
                  <div class="schicht-time-info">
                    <span class="schicht-time" v-if="schichtData.meta.uhrzeitVon">
                      <font-awesome-icon icon="fa-solid fa-clock" />
                      {{ formatTime(schichtData.meta.uhrzeitVon) }}<template v-if="schichtData.meta.uhrzeitBis"> - {{ formatTime(schichtData.meta.uhrzeitBis) }}</template>
                    </span>
                    <span class="schicht-name" v-if="schichtData.meta.schichtBezeichnung">{{ schichtData.meta.schichtBezeichnung }}</span>
                  </div>
                  <div 
                    class="bedarf-badge" 
                    :class="schichtData.meta.bedarfMet ? 'met' : 'unmet'"
                    :title="`${schichtData.einsaetze.length} von ${schichtData.meta.bedarf || '?'} Mitarbeitern geplant`"
                  >
                    {{ schichtData.einsaetze.length }}/{{ schichtData.meta.bedarf || '?' }}
                  </div>
                </div>

                <!-- Schicht Meta Row (Treffpunkt, Ansprechpartner) -->
                <div class="schicht-meta" v-if="schichtData.meta.treffpunkt || schichtData.meta.ansprechpartnerName">
                  <span class="meta-item" v-if="schichtData.meta.treffpunkt">
                    <font-awesome-icon icon="fa-solid fa-location-dot" />
                    Treffpunkt: {{ formatTime(schichtData.meta.treffpunkt) }}
                  </span>
                  <span class="meta-item ansprechpartner" v-if="schichtData.meta.ansprechpartnerName">
                    <font-awesome-icon icon="fa-solid fa-user-tie" />
                    {{ schichtData.meta.ansprechpartnerName }}
                    <template v-if="schichtData.meta.ansprechpartnerTelefon">
                      <a :href="'tel:' + schichtData.meta.ansprechpartnerTelefon" class="contact-link">{{ schichtData.meta.ansprechpartnerTelefon }}</a>
                    </template>
                  </span>
                </div>

                <!-- Badges Row (Quali wenn gemeinsam) -->
                <div class="schicht-badges" v-if="getCommonQualifikation(schichtData.einsaetze)">
                  <span v-if="getCommonQualifikation(schichtData.einsaetze)" class="badge quali">
                    <font-awesome-icon icon="fa-solid fa-graduation-cap" />
                    {{ getCommonQualifikation(schichtData.einsaetze).designation }}
                  </span>
                </div>

                <!-- Mitarbeiter List (Compact) -->
                <div class="mitarbeiter-list">
                  <div 
                    v-for="einsatz in schichtData.einsaetze" 
                    :key="einsatz._id"
                    class="mitarbeiter-row"
                  >
                    <div class="ma-info">
                      <template v-if="einsatz.mitarbeiterData">
                        <a 
                          href="#" 
                          class="ma-name"
                          @click.prevent="openMitarbeiterCard(einsatz.mitarbeiterData)"
                        >
                          {{ einsatz.mitarbeiterData.vorname }} {{ einsatz.mitarbeiterData.nachname }}
                        </a>
                        <span v-if="isTeamleiter(einsatz.mitarbeiterData)" class="tl-tag">TL</span>
                      </template>
                      <template v-else>
                        <span class="ma-placeholder">Personalnr: {{ einsatz.personalNr || '-' }}</span>
                      </template>
                    </div>
                    <div class="ma-badges" v-if="!getCommonQualifikation(schichtData.einsaetze)">
                      <span v-if="einsatz.qualifikationData && !getCommonQualifikation(schichtData.einsaetze)" class="badge quali small">
                        {{ einsatz.qualifikationData.designation }}
                      </span>
                    </div>
                  </div>
                  
                  <!-- Empty State if no Mitarbeiter -->
                  <div v-if="schichtData.einsaetze.length === 0" class="no-mitarbeiter">
                    Keine Mitarbeiter geplant
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No Einsätze State -->
          <div v-else class="no-einsaetze">
            <font-awesome-icon icon="fa-solid fa-calendar-xmark" />
            <span>Keine Schichten/Einsätze vorhanden</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- Sidebar Overlay for mobile only -->
    <div v-if="selectedEvent && isMobile" class="sidebar-overlay" @click="selectedEvent = null"></div>

    <!-- Mitarbeiter Card Modal -->
    <div v-if="selectedMitarbeiter" class="modal-overlay" @click.self="selectedMitarbeiter = null">
      <div class="modal-content modal-employee">
        <div class="modal-header">
          <h2>Mitarbeiter Details</h2>
          <button class="close-btn" @click="selectedMitarbeiter = null">×</button>
        </div>
        <div class="modal-body modal-employee-body">
          <EmployeeCard
            v-if="fullMitarbeiterData"
            :ma="fullMitarbeiterData"
            :initiallyExpanded="true"
            :showCheckbox="false"
          />
          <div v-else class="loading-employee">
            <font-awesome-icon icon="fa-solid fa-spinner" spin />
            <span>Lade Mitarbeiter...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// Add imports for icons used in mobile view
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faChevronLeft, faChevronRight, faUser, faLocationDot, faCalendar, faUserTie, faClock, faBriefcase, faGraduationCap, faCalendarXmark } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(faChevronLeft, faChevronRight, faUser, faLocationDot, faCalendar, faUserTie, faClock, faBriefcase, faGraduationCap, faCalendarXmark);

import api from "../utils/api";
import { mapState } from 'pinia';
import { useAuth } from '../stores/auth';
import { useFlipAll } from '../stores/flipAll';
import FilterPanel from '@/components/FilterPanel.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import FilterChip from '@/components/FilterChip.vue';
import FilterDivider from '@/components/FilterDivider.vue';
import FilterDropdown from '@/components/FilterDropdown.vue';
import EmployeeCard from '@/components/EmployeeCard.vue';


export default {
  name: "AuftraegePage",
  components: { FilterPanel, FilterGroup, FilterChip, FilterDivider, FilterDropdown, EmployeeCard },
  data() {
    // Load filter settings from sessionStorage or use defaults
    const savedFilters = sessionStorage.getItem('auftraege_filters');
    let filterDefaults = {
      geschSt: null,
      bediener: []
    };

    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        filterDefaults = { ...filterDefaults, ...parsed };
      } catch (e) {
        console.warn('Could not parse saved auftraege filters:', e);
      }
    }

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
      filters: filterDefaults,
      isMobile: false,
      mobileDayIndex: 0,
      selectedMitarbeiter: null,
      fullMitarbeiterData: null,
      preparedSchichten: {} // Lazy loaded schichten data
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
    }
  },
  methods: {
    // Determine shifts and metadata from event details (Lazy Load)
    calculateSchichten(event) {
      if (!event?.einsaetze) return {};
      const grouped = {};
      
      event.einsaetze.forEach(e => {
        const key = e.idAuftragArbeitsschichten || 'none';
        if (!grouped[key]) {
          grouped[key] = {
            einsaetze: [],
            meta: {
              schichtBezeichnung: e.schichtBezeichnung || null,
              treffpunkt: e.treffpunkt || null,
              ansprechpartnerName: e.ansprechpartnerName || null,
              ansprechpartnerTelefon: e.ansprechpartnerTelefon || null,
              ansprechpartnerEmail: e.ansprechpartnerEmail || null,
              uhrzeitVon: e.uhrzeitVon || null,
              uhrzeitBis: e.uhrzeitBis || null,
              bedarf: e.bedarf || null,
              bedarfMet: false
            }
          };
        }
        grouped[key].einsaetze.push(e);
      });
      
      // Calculate bedarfMet for each schicht and sort employees (Teamleiter first)
      Object.values(grouped).forEach(schicht => {
        const bedarf = schicht.meta.bedarf;
        const actual = schicht.einsaetze.length;
        schicht.meta.bedarfMet = bedarf ? actual >= bedarf : true;

        // Sort: Teamleiter first, then alphabetical by name
        schicht.einsaetze.sort((a, b) => {
          const isTLa = this.isTeamleiter(a.mitarbeiterData);
          const isTLb = this.isTeamleiter(b.mitarbeiterData);
          
          if (isTLa && !isTLb) return -1;
          if (!isTLa && isTLb) return 1;
          
          // Same status, sort by name
          const nameA = (a.mitarbeiterData?.nachname || "").toLowerCase();
          const nameB = (b.mitarbeiterData?.nachname || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      });
      
      return grouped;
    },

    // Check if all einsaetze in a schicht have the same beruf
    getCommonBeruf(einsaetze) {
      if (!einsaetze || einsaetze.length === 0) return null;
      const firstBeruf = einsaetze[0].berufData;
      if (!firstBeruf) return null;
      
      const allSame = einsaetze.every(e => 
        e.berufData?.jobKey === firstBeruf.jobKey
      );
      
      return allSame ? firstBeruf : null;
    },
    
    // Check if all einsaetze in a schicht have the same qualifikation
    getCommonQualifikation(einsaetze) {
      if (!einsaetze || einsaetze.length === 0) return null;
      const firstQuali = einsaetze[0].qualifikationData;
      if (!firstQuali) return null;
      
      const allSame = einsaetze.every(e => 
        e.qualifikationData?.qualificationKey === firstQuali.qualificationKey
      );
      
      return allSame ? firstQuali : null;
    },
    checkMobile() {
      this.isMobile = window.innerWidth <= 768;
    },
    async prevDay() {
      if (this.mobileDayIndex > 0) {
        this.mobileDayIndex--;
      } else {
        await this.previousWeek();
        this.mobileDayIndex = 6;
      }
    },
    async nextDay() {
      if (this.mobileDayIndex < 6) {
        this.mobileDayIndex++;
      } else {
        await this.nextWeek();
        this.mobileDayIndex = 0;
      }
    },
    initializeWeek() {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as first day
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      this.currentWeekStart = monday;
      
      // Set to today
      this.mobileDayIndex = (dayOfWeek + 6) % 7;
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
      // Only set defaults if no saved filters in sessionStorage
      const savedFilters = sessionStorage.getItem('auftraege_filters');
      if (savedFilters) {
        // Filters already loaded from storage in data()
        return;
      }

      // 1=Berlin, 2=Hamburg, 3=Köln
      // Check both standort (legacy) and location (model)
      const userLoc = this.user?.location || this.user?.standort;
      
      if (userLoc) {
        const loc = userLoc.toLowerCase();
        if (loc.includes('berlin')) this.filters.geschSt = '1';
        else if (loc.includes('hamburg')) this.filters.geschSt = '2';
        else if (loc.includes('köln') || loc.includes('koeln')) this.filters.geschSt = '3';
      }
    },
    saveFiltersToStorage() {
      const filters = {
        geschSt: this.filters.geschSt,
        bediener: this.filters.bediener
      };
      sessionStorage.setItem('auftraege_filters', JSON.stringify(filters));
    },
    toggleFilters() {
      this.filtersExpanded = !this.filtersExpanded;
    },
    setGeschStFilter(val) {
      if (this.filters.geschSt === val) return;
      this.filters.geschSt = val;
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    toggleBedienerFilter(val) {
      const idx = this.filters.bediener.indexOf(val);
      if (idx === -1) {
        this.filters.bediener.push(val);
      } else {
        this.filters.bediener.splice(idx, 1);
      }
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    resetAllFilters() {
      this.filters.geschSt = null;
      this.filters.bediener = [];
      // Clear storage on reset, then apply user defaults
      sessionStorage.removeItem('auftraege_filters');
      // Set defaults based on user location
      const userLoc = this.user?.location || this.user?.standort;
      if (userLoc) {
        const loc = userLoc.toLowerCase();
        if (loc.includes('berlin')) this.filters.geschSt = '1';
        else if (loc.includes('hamburg')) this.filters.geschSt = '2';
        else if (loc.includes('köln') || loc.includes('koeln')) this.filters.geschSt = '3';
      }
      this.saveFiltersToStorage();
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
    openDatePicker() {
      if (this.$refs.datePicker) {
        // showPicker() is supported in modern browsers to open the dialog directly
        if (typeof this.$refs.datePicker.showPicker === 'function') {
          this.$refs.datePicker.showPicker();
        } else {
          this.$refs.datePicker.click();
        }
      }
    },
    async handleDatePick(event) {
      const val = event.target.value;
      if (!val) return;
      
      const date = new Date(val);
      // Calculate start of that week (Monday)
      const Day = date.getDay() || 7; // Sunday is 0 -> make it 7
      date.setDate(date.getDate() - Day + 1); // Set to Monday
      
      this.currentWeekStart = date;
      await this.ensureMonthLoaded(date);
      
      // Reset picker
      event.target.value = '';
    },
    getTotalPositionsForDay(date) {
      const events = this.getEventsForDay(date);
      return events.reduce((sum, event) => {
        let count = 0;
        if (typeof event.einsaetzeCount === 'number') {
          count = event.einsaetzeCount;
        } else if (Array.isArray(event.einsaetze)) {
          count = event.einsaetze.length;
        }
        return sum + count;
      }, 0);
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
        this.preparedSchichten = this.calculateSchichten(this.selectedEvent);
      } catch (error) {
        console.error('Error loading event details:', error);
        this.selectedEvent = event; // fallback to basic data
        this.preparedSchichten = this.calculateSchichten(event);
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
      const map = { 1: 'Unbestätigt', 2: 'Bestätigt', 3: 'Abgeschlossen' };
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
      
      // If it looks like HH:MM or HH:MM:SS already, just return the first 5 chars
      if (typeof dateStr === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateStr)) {
          return dateStr.substring(0, 5);
      }

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr; // Fallback if invalid date
      
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
    },
    async openMitarbeiterCard(mitarbeiterBasic) {
      this.selectedMitarbeiter = mitarbeiterBasic;
      this.fullMitarbeiterData = null;
      
      try {
        // Load full mitarbeiter data
        const response = await api.get(`/api/personal/mitarbeiter/${mitarbeiterBasic._id}`);
        const mitarbeiterData = response.data.data;
        
        // Load Flip profile if flip_id exists
        if (mitarbeiterData.flip_id) {
          try {
            const flipResponse = await api.get(`/api/personal/flip/by-id/${mitarbeiterData.flip_id}`);
            mitarbeiterData.flip = flipResponse.data;
          } catch (flipError) {
            console.warn('Could not load Flip profile:', flipError);
            mitarbeiterData.flip = null;
          }
        }
        
        this.fullMitarbeiterData = mitarbeiterData;
      } catch (error) {
        console.error('Error loading mitarbeiter details:', error);
        // Fallback to basic data
        this.fullMitarbeiterData = mitarbeiterBasic;
      }
    },
    
    // Check if a mitarbeiter is a Teamleiter based on qualification 50055
    isTeamleiter(mitarbeiter) {
      if (!mitarbeiter?.qualifikationen?.length) return false;
      return mitarbeiter.qualifikationen.some(q => {
        const key = parseInt(String(q.qualificationKey || q), 10);
        return key === 50055;
      });
    },

    handleEscapeKey(event) {
      if (event.key !== 'Escape') return;

      // Close modals in order of priority (topmost = last opened)
      if (this.selectedMitarbeiter) {
        this.selectedMitarbeiter = null;
        this.fullMitarbeiterData = null;
      } else if (this.selectedEvent) {
        this.selectedEvent = null;
      }
    }
  },
  async mounted() {
    this.checkMobile();
    window.addEventListener('resize', this.checkMobile);
    document.addEventListener('keydown', this.handleEscapeKey);
    await this.fetchFilterOptions();
    this.setDefaultFilters();
    this.initializeWeek();
    await this.loadInitialData();
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.checkMobile);
    document.removeEventListener('keydown', this.handleEscapeKey);
  }
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.auftraege-page {
  /* Variable Mappings to match new components */
  --bg: var(--bg);
  --surface: var(--panel);
  --soft: var(--hover);
  --border: var(--border);
  --muted: var(--muted);
  --text: var(--text);
  --brand: var(--primary);
  
  display: flex;
  height: calc(100vh - 88px);
  overflow: hidden;
  
  &.sidebar-open {
    .main-content {
      margin-right: 420px;
      
      @media (max-width: 1200px) {
        margin-right: 0;
      }
    }
  }
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  transition: margin-right 0.3s ease;
}

/* Sidebar Styles */
.detail-sidebar {
  position: fixed;
  top: 88px; /* Increased to ensure it sits below header */
  right: 0;
  width: 420px;
  height: calc(100vh - 88px);
  background: var(--tile-bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  box-shadow: -4px 0 20px rgba(0,0,0,0.1);
  
  @media (max-width: 1200px) {
    width: 100%;
    max-width: 450px;
  }
  
  @media (max-width: 600px) {
    width: 100%;
    max-width: 100%;
  }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  
  .sidebar-title-area {
    flex: 1;
    min-width: 0;
    
    h2 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  
  .sidebar-status {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
    
    &.status-draft { background: #fef3c7; color: #92400e; }
    &.status-confirmed { background: #d1fae5; color: #065f46; }
    &.status-completed { background: #dbeafe; color: #1e40af; }
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.6rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    margin-left: 12px;
    
    &:hover { color: var(--text); }
  }
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.sidebar-overlay {
  display: none;
  
  @media (max-width: 1200px) {
    display: block;
    position: fixed;
    top: 88px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 99;
  }
}

/* Sidebar Animation */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.3s ease;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
}

/* Info Grid in Sidebar */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    
    &.full-width {
      grid-column: 1 / -1;
    }
    
    .info-label {
      font-size: 0.7rem;
      color: var(--muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .info-value {
      font-size: 0.9rem;
      color: var(--text);
      
      &.highlight {
        color: var(--primary);
        font-weight: 600;
      }
    }
  }
}

/* Schichten Section */
.schichten-section {
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    
    h3 {
      margin: 0;
      font-size: 0.95rem;
      color: var(--text);
    }
    
    .section-count {
      background: var(--primary);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }
  }
}

.schichten-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schicht-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.schicht-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--hover);
  border-bottom: 1px solid var(--border);
  gap: 10px;
  
  .schicht-time-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
    
    .schicht-time {
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--text);
      
      svg { color: var(--primary); font-size: 0.75rem; }
    }
    
    .schicht-name {
      font-size: 0.8rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.bedarf-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  
  &.met {
    background: #d1fae5;
    color: #065f46;
  }
  
  &.unmet {
    background: #fef3c7;
    color: #92400e;
  }
}

.schicht-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 12px;
  background: color-mix(in oklab, var(--hover) 50%, transparent);
  border-bottom: 1px solid var(--border);
  font-size: 0.78rem;
  color: var(--muted);
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
    
    svg { color: var(--primary); font-size: 0.7rem; }
    
    &.ansprechpartner {
      .contact-link {
        color: var(--primary);
        text-decoration: none;
        margin-left: 4px;
        
        &:hover { text-decoration: underline; }
      }
    }
  }
}

.schicht-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.badge {
  font-size: 0.7rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  
  svg { font-size: 0.6rem; }
  
  &.beruf {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #fff;
  }
  
  &.quali {
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    color: #fff;
  }
  
  &.small {
    font-size: 0.65rem;
    padding: 2px 6px;
  }
}

.mitarbeiter-list {
  padding: 6px 0;
}

.mitarbeiter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent);
  
  &:last-child { border-bottom: none; }
  
  .ma-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    
    .ma-name {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.85rem;
      
      &:hover { text-decoration: underline; }
    }
    
    .ma-placeholder {
      color: var(--muted);
      font-size: 0.8rem;
    }
    
    .tl-tag {
      font-size: 0.6rem;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2px 5px;
      border-radius: 4px;
    }
  }
  
  .ma-badges {
    display: flex;
    gap: 4px;
  }
}

.no-mitarbeiter,
.no-einsaetze {
  text-align: center;
  padding: 20px;
  color: var(--muted);
  font-size: 0.85rem;
  
  svg {
    display: block;
    margin: 0 auto 8px;
    font-size: 1.5rem;
    opacity: 0.5;
  }
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

.nav-btn.calendar-btn:hover {
  background-color: var(--primary); /* Uses component mapped variable */
  color: #fff;
  border-color: var(--primary);
}

.current-range {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  min-width: 250px;
  text-align: center;
}

.loading-body {
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.schicht-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  
  .beruf-badge,
  .quali-badge {
    font-size: 0.7rem;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    
    svg {
      font-size: 0.65rem;
    }
  }
  
  .beruf-badge {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
  }
  
  .quali-badge {
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(52, 211, 153, 0.3);
  }
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
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    .mitarbeiter-link {
      color: var(--primary);
      text-decoration: none;
      transition: all 0.2s ease;
      
      &:hover {
        text-decoration: underline;
        color: color-mix(in srgb, var(--primary) 80%, black);
      }
    }
    
    .personalnr-badge {
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--muted);
      background: var(--hover);
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      width: fit-content;
    }
    
    .tl-badge {
      font-size: 0.7rem;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 3px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      width: fit-content;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
      
      svg {
        font-size: 0.65rem;
      }
    }
  }

  .einsatz-bezeichnung {
    flex: 1;
    color: var(--text);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  
  .beruf-badge,
  .quali-badge {
    font-size: 0.7rem;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    
    svg {
      font-size: 0.65rem;
    }
  }
  
  .beruf-badge {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
  }
  
  .quali-badge {
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(52, 211, 153, 0.3);
  }

  .einsatz-zeit {
    color: var(--muted);
    font-size: 0.8rem;
  }
}

/* Filter Section Styles */

.reset-chip {
  color: #ff4d4f !important;
  border-color: #ff4d4f !important;
  
  &:hover {
    background: rgba(255, 77, 79, 0.1) !important;
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
    display: none; /* Hide standard navigation in mobile view */
  }
}

/* Mobile Calendar Styles */
.mobile-calendar-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.mobile-date-display {
  text-align: center;
  display: flex;
  flex-direction: column;
}

.mobile-date-display .day-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mobile-date-display .day-date {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text);
}

.nav-btn-mobile {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.nav-btn-mobile:active {
  background: var(--soft);
  transform: scale(0.95);
}

.mobile-day-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-day-state {
  text-align: center;
  padding: 40px;
  color: var(--muted);
  background: var(--surface);
  border-radius: 12px;
  border: 1px dashed var(--border);
}

.event-card-mobile {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
}

.event-card-mobile.status-draft { border-left: 4px solid #f59e0b; }
.event-card-mobile.status-confirmed { border-left: 4px solid #22c55e; }
.event-card-mobile.status-completed { border-left: 4px solid #3b82f6; }

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-time-badge {
  background: var(--bg);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  border: 1px solid var(--border);
}

.event-status {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 600;
}

.event-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 0.9rem;
}

.detail-row .icon {
  width: 16px;
  text-align: center;
  color: var(--primary);
}

.hidden-date-input {
  position: absolute;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}

/* Employee Modal */
.modal-employee {
  max-width: 900px;
  width: 95%;
}

.modal-employee-body {
  padding: 0;
  max-height: 80vh;
}

.loading-employee {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--muted);
  
  svg {
    font-size: 2rem;
  }
}
</style>
