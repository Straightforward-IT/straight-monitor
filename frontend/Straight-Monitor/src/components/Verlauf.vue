<template>
  <div class="window">
    <FilterPanel v-model:expanded="filtersExpanded">
      <template #title>Filter &amp; Gruppierung</template>

      <FilterGroup class="verlauf-filter-group grouping-group" label="Gruppieren">
        <div class="verlauf-chip-row">
          <FilterChip :active="groupBy.standort" @click="toggleGroupBy('standort')">
            Standort
          </FilterChip>
          <FilterChip :active="groupBy.monat" @click="toggleGroupBy('monat')">
            Monat
          </FilterChip>
          <FilterChip :active="groupBy.tag" @click="toggleGroupBy('tag')">
            Tag
          </FilterChip>
          <FilterChip :active="groupBy.benutzer" @click="toggleGroupBy('benutzer')">
            Benutzer
          </FilterChip>
          <FilterChip :active="groupBy.art" @click="toggleGroupBy('art')">
            Art
          </FilterChip>
        </div>
      </FilterGroup>

      <FilterGroup class="verlauf-filter-group date-group" label="Datum">
        <div class="date-filter-container">
          <input
            id="date-filter"
            type="date"
            v-model="dateFilter"
            @change="groupLogs"
            class="date-input"
            aria-label="Datum filtern"
          />
          <button
            v-if="dateFilter"
            @click="clearDateFilter"
            class="clear-date-btn"
            type="button"
            title="Datums-Filter löschen"
          >
            <font-awesome-icon :icon="['fas', 'times']" />
          </button>
        </div>
      </FilterGroup>

      <FilterGroup class="verlauf-filter-group sort-group" label="Sortieren">
        <select
          id="sort-select"
          v-model="sortBy"
          @change="groupLogs"
          class="panel-select"
          aria-label="Sortierung auswählen"
        >
          <option value="timestamp_desc">Neueste zuerst</option>
          <option value="timestamp_asc">Älteste zuerst</option>
        </select>
      </FilterGroup>
    </FilterPanel>

    <SearchBar
      class="verlauf-search-bar"
      v-model="searchQuery"
      placeholder="in Anmerkungen, Items, Mitarbeiter..."
      aria-label="Verlauf durchsuchen"
    />

    <div v-if="Object.keys(groupedLogs).length > 0">
      <verlauf-group
        :grouped-data="groupedLogs"
        :active-groups="activeGroupsArray"
        :level="0"
        :highlight-id="highlightedLogId"
        @open-mitarbeiter="openMitarbeiterCard"
      />
    </div>

    <div v-else class="no-logs-message">
      <p v-if="searchQuery && dateFilter">
        Keine Einträge für die Suche nach "{{ searchQuery }}" am {{ formatDisplayDate(dateFilter) }} gefunden.
      </p>
      <p v-else-if="searchQuery">
        Keine Einträge für die Suche nach "{{ searchQuery }}" gefunden.
      </p>
      <p v-else-if="dateFilter">
        Keine Einträge am {{ formatDisplayDate(dateFilter) }} gefunden.
      </p>
      <p v-else>Keine Log-Einträge vorhanden.</p>
    </div>
  </div>

  <EmployeeCardModal
    :mitarbeiterId="selectedMitarbeiterId"
    @close="closeMitarbeiterModal"
  />
</template>

<script>
import api from "@/utils/api";
import VerlaufGroup from "./VerlaufGroup.vue";
import EmployeeCardModal from "./EmployeeCardModal.vue";
import FilterChip from "./FilterChip.vue";
import FilterGroup from "./FilterGroup.vue";
import FilterPanel from "./FilterPanel.vue";
import SearchBar from "./SearchBar.vue";
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

export default {
  name: "Verlauf",
  components: {
    VerlaufGroup,
    FontAwesomeIcon,
    EmployeeCardModal,
    FilterChip,
    FilterGroup,
    FilterPanel,
    SearchBar,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      logs: [],
      // EmployeeCard modal
      selectedMitarbeiterId: null,
      filtersExpanded: true,
      groupBy: { standort: true, monat: true, tag: false, benutzer: false, art: false },
      sortBy: "timestamp_desc",
      searchQuery: "",
      dateFilter: "",
      groupedLogs: {},
      highlightedLogId: null, // For URL parameter highlighting
      highlightScrolled: false, // Track if we've already scrolled to highlight
    };
  },
  computed: {
    processedLogs() {
      let processed = [...this.logs];
      const searchTerm = this.searchQuery.trim().toLowerCase();

      // Text-Filter
      if (searchTerm) {
        processed = processed.filter((log) => {
          const annotationMatch =
            log.anmerkung && log.anmerkung.toLowerCase().includes(searchTerm);
          const itemMatch =
            Array.isArray(log.items) &&
            log.items.some(
              (item) => item.bezeichnung && item.bezeichnung.toLowerCase().includes(searchTerm)
            );
          const maNameMatch = log.mitarbeiterName && log.mitarbeiterName.toLowerCase().includes(searchTerm);
          const maNrMatch = log.mitarbeiterPersonalnr && log.mitarbeiterPersonalnr.toLowerCase().includes(searchTerm);
          return annotationMatch || itemMatch || maNameMatch || maNrMatch;
        });
      }

      // Datums-Filter
      if (this.dateFilter) {
        const filterDate = new Date(this.dateFilter);
        const filterDateStr = filterDate.toLocaleDateString('de-DE');
        
        processed = processed.filter((log) => {
          const logDate = new Date(log.timestamp);
          const logDateStr = logDate.toLocaleDateString('de-DE');
          return logDateStr === filterDateStr;
        });
      }

      // Sortierung
      if (this.sortBy === "timestamp_asc") {
        processed.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      } else {
        processed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }

      return processed;
    },
    activeGroupsArray() {
      return Object.keys(this.groupBy)
        .filter((key) => this.groupBy[key])
        .map((key) => (key === "benutzer" ? "benutzerMail" : key));
    },
  },
  methods: {
    setAxiosAuthToken() { api.defaults.headers.common["x-auth-token"] = this.token; },
    async fetchLogs() {
      try {
        const { data } = await api.get("/api/monitoring");
        this.logs = (data || []).map((log) => ({ ...log, isExpanded: false }));
        this.groupLogs();
        // After render, scroll to highlighted log if present
        if (this.highlightedLogId) {
          this.$nextTick(() => {
            setTimeout(() => {
              const el = document.getElementById(`highlight-${this.highlightedLogId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          });
        }
      } catch (e) {
        console.error("Fehler beim Abrufen der Logs:", e);
      }
    },
    activeGroups() {
      return Object.keys(this.groupBy)
        .filter((key) => this.groupBy[key])
        .map((key) => (key === "benutzer" ? "benutzerMail" : key));
    },
    groupByKeys(data, keys) {
      if (!keys.length) return data;
      const [key, ...rest] = keys;
      const grouped = {};

      data.forEach((item) => {
        const groupKey =
          key === "monat"
            ? new Date(item.timestamp).toLocaleString("de-DE", { month: "long", year: "numeric" })
            : key === "tag"
            ? new Date(item.timestamp).toLocaleDateString("de-DE")
            : item[key] || "Unbekannt";

        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey].push(item);
      });

      Object.keys(grouped).forEach((k) => {
        grouped[k] = this.groupByKeys(grouped[k], rest);
      });
      return grouped;
    },
    groupLogs() {
      const keys = this.activeGroups();
      const dataToGroup = this.processedLogs;

      if (keys.length && dataToGroup.length) {
        this.groupedLogs = this.groupByKeys(dataToGroup, keys);
      } else if (dataToGroup.length) {
        this.groupedLogs = { "Alle Ergebnisse": dataToGroup };
      } else {
        this.groupedLogs = {};
      }
    },
    clearDateFilter() {
      this.dateFilter = "";
      this.groupLogs();
    },
    toggleGroupBy(key) {
      this.groupBy[key] = !this.groupBy[key];
      this.groupLogs();
    },
    formatDisplayDate(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    },
    switchToDashboard() { this.$router.push("/"); },
    openMitarbeiterCard(mitarbeiterId) {
      if (!mitarbeiterId) return;
      // Normalize: handle ObjectId objects vs plain strings
      const id = mitarbeiterId?._id ? String(mitarbeiterId._id) : String(mitarbeiterId);
      if (!id || id === 'null' || id === 'undefined') return;
      this.selectedMitarbeiterId = id;
    },
    closeMitarbeiterModal() {
      this.selectedMitarbeiterId = null;
    },
    handleKeydown(e) {
      if (e.key === 'Escape' && this.selectedMitarbeiterId) this.closeMitarbeiterModal();
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    // Check for highlight parameter in URL
    const highlightId = this.$route.query.highlight;
    if (highlightId) {
      this.highlightedLogId = highlightId;
    }
    this.fetchLogs();
    window.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeydown);
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

/* Mappe auf globale Theme-Variablen für echtes Runtime-Theming */
.window{
  --c-bg:            var(--bg);
  --c-surface:       var(--tile-bg);
  --c-tertiary-bg:   var(--hover);
  --c-border:        var(--border);
  --c-primary:       var(--primary);
  --c-text-primary:  var(--text);
  --c-text-secondary:var(--muted);

  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  background: var(--c-surface);
  color: var(--c-text-primary);
  min-height: 100vh;
  max-width: 1200px;
  margin: 30px auto;
  padding: 30px;
  box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid var(--c-border);
  box-shadow: 0 6px 14px rgba(0,0,0,.06);
}

.discrete{
  display:inline-block;
  padding:6px 10px;
  color: var(--c-text-secondary);
  text-decoration:none;
  font-size:.95rem;
  font-weight:500;
  transition: color .2s ease;
}
.discrete:hover{ color: var(--c-primary); }

.verlauf-filter-group {
  min-height: 44px;
}

.verlauf-filter-group.grouping-group {
  align-items: flex-start;
}

.verlauf-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.filter-panel) {
  --surface: var(--panel);
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  .filter-content {
    border-top-color: transparent;
  }

  .filter-group {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
}

.verlauf-search-bar {
  width: 100%;
  border-radius: 8px;

  :deep(.search-bar-root) {
    border-color: transparent;
  }
}

.panel-select{
  flex-grow:1;
  padding:.8rem 1rem;
  font-size:.95rem;
  border-radius:8px;
  border:1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-primary);
  transition: border-color .2s, box-shadow .2s, background .2s;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  box-sizing: border-box;
  min-width: 220px;
  width: min(260px, 100%);
}

.panel-select {
  width: min(260px, 100%);
  background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23666" d="M2 0L0 2h4zm0 5L0 3h4z"/></svg>');
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px;
  padding-right: 40px;
  cursor: pointer;
}

.panel-select:hover,
.date-input:hover {
  border-color: color-mix(in oklab, var(--c-primary) 35%, var(--c-border));
}

.panel-select:focus,
.date-input:focus {
  outline:none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-primary) 25%, transparent);
}

.date-filter-container {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.date-input {
  width: 170px;
  padding: 8px 12px;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  background: var(--c-surface);
  color: var(--c-text-primary);
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.date-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: invert(55%) sepia(100%) saturate(1500%) hue-rotate(15deg) brightness(1.1);
}

.date-input::-webkit-calendar-picker-indicator:hover {
  filter: invert(45%) sepia(100%) saturate(2000%) hue-rotate(15deg) brightness(1.3);
  transform: scale(1.1);
}

.date-input::-webkit-inner-spin-button {
  display: none;
}

.clear-date-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 12px; /* Weichere, rundere Ränder */
  color: var(--c-text-secondary);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Weichere Animation */
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); /* Subtiler Schatten */
}

.clear-date-btn:hover {
  background: var(--c-tertiary-bg);
  border-color: var(--c-primary);
  color: var(--c-text-primary);
  transform: translateY(-1px); /* Leichter Lift-Effekt */
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.clear-date-btn:active {
  transform: translateY(0); /* Zurück zur ursprünglichen Position beim Klick */
  transition: all 0.15s ease;
}

.no-logs-message{
  text-align:center; margin-top:3rem; padding:2rem;
  background: var(--c-bg);
  border:1px solid var(--c-border);
  border-radius:10px; color: var(--c-text-secondary);
  box-shadow: 0 2px 4px rgba(0,0,0,.03);
}

/* Mobile Optimierungen */
@media (max-width: 768px) {
  .window {
    margin: 12px 8px;
    padding: 16px 12px;
    border-radius: 8px;
  }

  .verlauf-filter-group {
    width: 100%;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .verlauf-search-bar {
    width: 100%;
  }

  .panel-select {
    padding: 8px 10px;
    font-size: 14px;
    max-width: none;
    width: 100%;
    box-sizing: border-box;
  }

  .panel-select {
    padding-right: 32px;
    background-size: 10px;
    background-position: right 10px center;
  }

  .date-filter-container {
    width: 100%;
  }

  .date-input {
    max-width: none;
    flex: 1;
    width: auto;
    padding: 12px 16px; /* Größere Touch-Targets auf Mobile */
    font-size: 16px; /* Verhindert Auto-Zoom auf Mobile */
    border-radius: 12px;
  }

  .clear-date-btn {
    width: 36px; /* Größer für bessere Touch-Bedienung */
    height: 36px;
    font-size: 14px;
    border-radius: 12px;
  }

  .verlauf-chip-row {
    width: 100%;
  }

  .no-logs-message {
    margin-top: 2rem;
    padding: 1.5rem;
    font-size: 0.9rem;
  }
}
</style>

<style lang="scss">
.verlauf-ma-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay, rgba(0, 0, 0, 0.55));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 1rem;
}

.verlauf-ma-modal-content {
  background: var(--tile-bg, #fff);
  border-radius: 12px;
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.verlauf-ma-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 1.3rem;
    color: var(--text);
  }
}

.verlauf-ma-close-btn {
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

.verlauf-ma-modal-body {
  padding: 0;
  max-height: 80vh;
  overflow-y: auto;
}

.verlauf-ma-modal-loading {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: 2rem;
  color: var(--muted, #9ca3af);
  font-size: 1rem;
}
</style>
