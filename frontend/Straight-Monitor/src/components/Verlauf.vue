<template>
  <PageLayout
    v-model="activeTab"
    class="verlauf-page"
    :tabs="pageTabs"
    aria-label="Verlaufsbereiche"
    width="full"
    content-variant="surface"
  >
    <template v-if="activeTab === 'history'">
      <Toolbar wrap>
        <ToolbarFilter
          v-model="filtersExpanded"
          :active-count="activeFilterCount"
          :active-filter-labels="activeFilterLabels"
          @reset="resetFilters"
        >
          <FilterGroup class="verlauf-filter-group grouping-group" label="Gruppieren">
            <div class="verlauf-chip-row">
              <FilterChip :active="groupBy.standort" @click="toggleGroupBy('standort')">Standort</FilterChip>
              <FilterChip :active="groupBy.monat" @click="toggleGroupBy('monat')">Monat</FilterChip>
              <FilterChip :active="groupBy.tag" @click="toggleGroupBy('tag')">Tag</FilterChip>
              <FilterChip :active="groupBy.benutzer" @click="toggleGroupBy('benutzer')">Benutzer</FilterChip>
              <FilterChip :active="groupBy.art" @click="toggleGroupBy('art')">Art</FilterChip>
            </div>
          </FilterGroup>

          <FilterGroup class="verlauf-filter-group date-group" label="Datum">
            <div class="date-filter-container">
              <input id="date-filter" v-model="dateFilter" type="date" class="date-input" aria-label="Datum filtern" @change="groupLogs" />
              <button v-if="dateFilter" type="button" class="clear-date-btn" title="Datums-Filter löschen" @click="clearDateFilter">
                <font-awesome-icon :icon="['fas', 'times']" />
              </button>
            </div>
          </FilterGroup>

          <FilterGroup class="verlauf-filter-group sort-group" label="Sortieren">
            <select id="sort-select" v-model="sortBy" class="panel-select" aria-label="Sortierung auswählen" @change="groupLogs">
              <option value="timestamp_desc">Neueste zuerst</option>
              <option value="timestamp_asc">Älteste zuerst</option>
            </select>
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
          @revert-log="revertLog"
          @revert-item="revertItem"
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
    </template>

    <KeepAlive v-else>
      <InventoryHistoryGraph />
    </KeepAlive>
  </PageLayout>

  <EmployeeCardModal
    :mitarbeiterId="selectedMitarbeiterId"
    @close="closeMitarbeiterModal"
  />
</template>

<script>
import api from "@/utils/api";
import VerlaufGroup from "./VerlaufGroup.vue";
import EmployeeCardModal from "@/components/Modals/EmployeeCardModal.vue";
import FilterChip from "./ui-elements/FilterChip.vue";
import FilterGroup from "./FilterGroup.vue";
import SearchBar from "./SearchBar.vue";
import Toolbar from "@/components/ui-elements/Toolbar.vue";
import ToolbarFilter from "@/components/ui-elements/ToolbarFilter.vue";
import PageLayout from "@/components/layout/PageLayout.vue";
import { inventoryPageTabs } from "@/components/layout/inventoryPageTabs";
import InventoryHistoryGraph from "@/components/InventoryHistoryGraph.vue";
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

export default {
  name: "Verlauf",
  components: {
    VerlaufGroup,
    FontAwesomeIcon,
    EmployeeCardModal,
    FilterChip,
    FilterGroup,
    SearchBar,
    Toolbar,
    ToolbarFilter,
    PageLayout,
    InventoryHistoryGraph,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      activeTab: "history",
      pageTabs: inventoryPageTabs,
      logs: [],
      logsLoaded: false,
      logsLoading: false,
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
    activeFilterCount() {
      const defaultGroupBy = { standort: true, monat: true, tag: false, benutzer: false, art: false };
      return Object.keys(defaultGroupBy).filter((key) => this.groupBy[key] !== defaultGroupBy[key]).length
        + Number(Boolean(this.dateFilter))
        + Number(this.sortBy !== "timestamp_desc");
    },
    activeFilterLabels() {
      const labels = [];
      if (this.dateFilter) labels.push("Datum");
      if (this.sortBy !== "timestamp_desc") labels.push("Älteste zuerst");
      if (this.activeFilterCount > labels.length) labels.push("Gruppierung");
      return labels;
    },
  },
  watch: {
    searchQuery() {
      this.groupLogs();
    },
    activeTab(newTab) {
      if (newTab === "inventory") {
        this.$router.push("/bestand");
        return;
      }

      const nextQuery = { ...this.$route.query };
      if (newTab === "history") delete nextQuery.tab;
      else nextQuery.tab = "graph";

      const currentTabQuery = this.$route.query.tab || "history";
      if (currentTabQuery !== newTab) this.$router.replace({ query: nextQuery });
      if (newTab === "history" && !this.logsLoaded) this.fetchLogs();
    },
    "$route.query.tab"(newTab) {
      const resolved = newTab === "graph" ? "graph" : "history";
      if (this.activeTab !== resolved) this.activeTab = resolved;
    },
  },
  methods: {
    setAxiosAuthToken() { api.defaults.headers.common["x-auth-token"] = this.token; },
    async fetchLogs() {
      if (this.logsLoading) return;
      this.logsLoading = true;
      try {
        const { data } = await api.get("/api/monitoring");
        this.logs = (data || []).map((log) => ({ ...log, isExpanded: false }));
        this.logsLoaded = true;
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
      } finally {
        this.logsLoading = false;
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
    resetFilters() {
      this.groupBy = { standort: true, monat: true, tag: false, benutzer: false, art: false };
      this.sortBy = "timestamp_desc";
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
    async revertLog(log) {
      if (!log?._id || log.storniert) return;
      if (!window.confirm('Gesamten Eintrag zurücksetzen? Die Bestandsänderungen werden rückgängig gemacht.')) return;
      try {
        const { data } = await api.post(`/api/monitoring/${log._id}/revert`);
        const target = this.logs.find(l => String(l._id) === String(data._id));
        if (target) {
          target.storniert = data.storniert;
          target.storniertAt = data.storniertAt;
          data.items?.forEach((item, i) => { if (target.items[i]) target.items[i].storniert = item.storniert; });
          this.groupLogs();
        } else {
          await this.fetchLogs();
        }
      } catch (e) {
        window.alert(e.response?.data?.message || 'Zurücksetzen fehlgeschlagen.');
      }
    },
    async revertItem({ log, index }) {
      if (!log?._id) return;
      const item = log.items?.[index];
      if (!item || item.storniert) return;
      if (!window.confirm(`Item „${item.bezeichnung}“ zurücksetzen?`)) return;
      try {
        const { data } = await api.post(`/api/monitoring/${log._id}/items/${index}/revert`);
        const target = this.logs.find(l => String(l._id) === String(data._id));
        if (target) {
          target.storniert = data.storniert;
          data.items?.forEach((updatedItem, i) => { if (target.items[i]) target.items[i].storniert = updatedItem.storniert; });
          this.groupLogs();
        } else {
          await this.fetchLogs();
        }
      } catch (e) {
        window.alert(e.response?.data?.message || 'Zurücksetzen fehlgeschlagen.');
      }
    },
    handleKeydown(e) {
      if (e.key === 'Escape' && this.selectedMitarbeiterId) this.closeMitarbeiterModal();
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.activeTab = this.$route.query.tab === "graph" ? "graph" : "history";
    // Check for highlight parameter in URL
    const highlightId = this.$route.query.highlight;
    if (highlightId) {
      this.highlightedLogId = highlightId;
    }
    if (this.activeTab === "history") this.fetchLogs();
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
.verlauf-page {
  --c-bg:            var(--bg);
  --c-surface:       var(--tile-bg);
  --c-tertiary-bg:   var(--hover);
  --c-border:        var(--border);
  --c-primary:       var(--primary);
  --c-text-primary:  var(--text);
  --c-text-secondary:var(--muted);

  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  color: var(--c-text-primary);
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
  .verlauf-filter-group {
    width: 100%;
    flex-wrap: wrap;
    align-items: flex-start;
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
