<template>
  <div class="window">
    <Toolbar class="verlauf-search-toolbar">
      <ToolbarFilter v-model="filtersExpanded" :active-count="activeFilterCount" @reset="resetFilters">
        <FilterGroup label="Gruppieren">
          <FilterChip :active="groupBy.standort" @click="toggleGroupBy('standort')">Standort</FilterChip>
          <FilterChip :active="groupBy.monat" @click="toggleGroupBy('monat')">Monat</FilterChip>
          <FilterChip :active="groupBy.tag" @click="toggleGroupBy('tag')">Tag</FilterChip>
          <FilterChip :active="groupBy.benutzer" @click="toggleGroupBy('benutzer')">Benutzer</FilterChip>
          <FilterChip :active="groupBy.art" @click="toggleGroupBy('art')">Art</FilterChip>
        </FilterGroup>
        <FilterDivider />
        <FilterGroup label="Datum">
          <div class="verlauf-date-filter">
            <input type="date" v-model="dateFilter" @change="groupLogs" class="verlauf-date-input" aria-label="Datum filtern" />
            <button v-if="dateFilter" @click="clearDateFilter" class="verlauf-date-clear" type="button" title="Datum löschen">
              <font-awesome-icon :icon="['fas', 'times']" />
            </button>
          </div>
        </FilterGroup>
        <FilterDivider />
        <FilterGroup label="Sortieren">
          <FilterChip :active="sortBy === 'timestamp_desc'" @click="sortBy = 'timestamp_desc'; groupLogs()">Neueste zuerst</FilterChip>
          <FilterChip :active="sortBy === 'timestamp_asc'" @click="sortBy = 'timestamp_asc'; groupLogs()">Älteste zuerst</FilterChip>
        </FilterGroup>
      </ToolbarFilter>
      <SearchBar
        class="toolbar-search"
        v-model="searchQuery"
        placeholder="in Anmerkungen, Items, Mitarbeiter..."
        aria-label="Verlauf durchsuchen"
      />
    </Toolbar>

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
import FilterChip from "./ui-elements/FilterChip.vue";
import FilterGroup from "./FilterGroup.vue";
import FilterDivider from "./ui-elements/FilterDivider.vue";
import SearchBar from "./SearchBar.vue";
import Toolbar from "@/components/ui-elements/Toolbar.vue";
import ToolbarFilter from "@/components/ui-elements/ToolbarFilter.vue";
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

export default {
  name: "Verlauf",
  components: {
    VerlaufGroup,
    FontAwesomeIcon,
    EmployeeCardModal,
    FilterChip,
    FilterGroup,
    FilterDivider,
    SearchBar,
    Toolbar,
    ToolbarFilter,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      logs: [],
      // EmployeeCard modal
      selectedMitarbeiterId: null,
      filtersExpanded: false,
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
    activeFilterCount() {
      let count = 0;
      if (this.dateFilter) count++;
      if (this.sortBy !== 'timestamp_desc') count++;
      return count;
    },
    processedLogs() {
      let processed = [...this.logs];
      const searchTerm = this.searchQuery.trim().toLowerCase();

      // Text-Filter
      if (searchTerm) {
        processed = processed.filter((log) => {
          const searchableFields = [
            log.anmerkung,
            log.mitarbeiterName,
            log.mitarbeiterPersonalnr,
            log.benutzerMail,
            log.standort,
            log.art,
            ...(Array.isArray(log.items)
              ? log.items.flatMap((item) => [item.bezeichnung, item.groesse, item.anzahl, item.soll])
              : []),
          ];

          return searchableFields.some((value) =>
            String(value ?? "").toLowerCase().includes(searchTerm)
          );
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
  watch: {
    searchQuery() {
      this.groupLogs();
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
    resetFilters() {
      this.dateFilter = '';
      this.sortBy = 'timestamp_desc';
      this.groupLogs();
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

.verlauf-search-toolbar {
  overflow: visible;

  :deep(.toolbar-search) {
    max-width: none;
  }
}

.verlauf-date-filter {
  display: flex;
  align-items: center;
  gap: 6px;
}

.verlauf-date-input {
  padding: 3px 8px;
  font-size: 0.78rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s;
  &:focus { outline: none; border-color: var(--primary); }
  &:hover { border-color: var(--primary); }
}

.verlauf-date-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  transition: border-color 0.15s, color 0.15s;
  &:hover { border-color: var(--primary); color: var(--primary); }
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
