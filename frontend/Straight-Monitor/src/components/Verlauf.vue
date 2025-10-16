<template>
  <div class="window">
    <div class="controls">
      <div class="control-group">
        <label for="search-input" class="group-label">Suchen:</label>
        <input
          id="search-input"
          type="text"
          v-model="searchQuery"
          @input="groupLogs"
          placeholder="in Anmerkungen & Items..."
        />
      </div>

      <div class="control-group">
        <label class="group-label">Gruppieren nach:</label>
        <div class="checkbox-options">
          <label>
            <input type="checkbox" v-model="groupBy.standort" @change="groupLogs" />
            Standort
          </label>
          <label>
            <input type="checkbox" v-model="groupBy.monat" @change="groupLogs" />
            Monat
          </label>
          <label>
            <input type="checkbox" v-model="groupBy.tag" @change="groupLogs" />
            Tag
          </label>
          <label>
            <input type="checkbox" v-model="groupBy.benutzer" @change="groupLogs" />
            Benutzer
          </label>
          <label>
            <input type="checkbox" v-model="groupBy.art" @change="groupLogs" />
            Art
          </label>
        </div>
      </div>

      <div class="control-group">
        <label for="date-filter" class="group-label">Datum filtern:</label>
        <div class="date-filter-container">
          <input
            id="date-filter"
            type="date"
            v-model="dateFilter"
            @change="groupLogs"
            class="date-input"
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
      </div>

      <div class="control-group">
        <label for="sort-select" class="group-label">Sortieren nach:</label>
        <select id="sort-select" v-model="sortBy" @change="groupLogs">
          <option value="timestamp_desc">Neueste zuerst</option>
          <option value="timestamp_asc">Älteste zuerst</option>
        </select>
      </div>
    </div>

    <div v-if="Object.keys(groupedLogs).length > 0">
      <verlauf-group
        :grouped-data="groupedLogs"
        :active-groups="activeGroupsArray"
        :level="0"
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
</template>

<script>
import api from "@/utils/api";
import VerlaufGroup from "./VerlaufGroup.vue";
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

export default {
  name: "Verlauf",
  components: { VerlaufGroup, FontAwesomeIcon },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      logs: [],
      groupBy: { standort: true, monat: true, tag: false, benutzer: false, art: false },
      sortBy: "timestamp_desc",
      searchQuery: "",
      dateFilter: "",
      groupedLogs: {},
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
          return annotationMatch || itemMatch;
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
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchLogs();
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

.controls{
  display:flex; flex-direction:column; gap:2rem;
  padding:1.5rem;
  margin-bottom:2rem;
  background: var(--c-bg);
  border:1px solid var(--c-border);
  border-radius:10px;
}

.control-group{
  display:flex; align-items:center; flex-wrap:wrap; gap:1rem 1.5rem;
}

.group-label{
  font-size:1.05rem; font-weight:600; color: var(--c-text-primary);
  flex-shrink:0; width:150px; text-align:right;
}

.checkbox-options{ display:flex; flex-wrap:wrap; gap:1rem 2rem; align-items:center; }

.controls label{
  display:flex; align-items:center; gap:.7rem;
  font-size:1rem; color: var(--c-text-secondary); cursor:pointer; user-select:none;
}
.controls label:hover{ color: var(--c-text-primary); }

input[type="text"], select{
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
}

select {
  background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23666" d="M2 0L0 2h4zm0 5L0 3h4z"/></svg>');
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px;
  padding-right: 40px;
  cursor: pointer;
}

input[type="text"]:hover,
select:hover{
  border-color: color-mix(in oklab, var(--c-primary) 35%, var(--c-border));
}
input[type="text"]:focus,
select:focus{
  outline:none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c-primary) 25%, transparent);
}

input[type="text"]{ max-width: 360px; }

.date-filter-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-grow: 1;
}

.date-input {
  width: 140px;
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

.date-input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(var(--c-primary-rgb), 0.1);
  transform: translateY(-1px);
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

input[type="checkbox"]{
  appearance:none;
  height:1.2em; width:1.2em; margin:0;
  background: var(--c-surface);
  border:1px solid var(--c-border);
  border-radius:4px; cursor:pointer; display:grid; place-content:center;
  transition: all .2s ease-in-out;
}
input[type="checkbox"]::before{
  content:"";
  width:.65em; height:.65em; transform: scale(0);
  transition: .12s transform ease-in-out;
  box-shadow: inset 1em 1em var(--c-primary);
  mask-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m2 8 4 4 8-8"/></svg>');
  mask-size: cover; -webkit-mask-size: cover;
}
input[type="checkbox"]:checked{
  background: var(--c-primary); border-color: var(--c-primary);
}
input[type="checkbox"]:checked::before{ transform: scale(1); }

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
  
  .controls {
    padding: 10px;
    gap: 1rem;
    margin-bottom: 12px;
  }
  
  .control-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  
  .group-label {
    width: auto;
    text-align: left;
    font-size: 0.95rem;
    margin-bottom: 4px;
  }
  
  .checkbox-options {
    gap: 8px 16px;
  }
  
  .controls label {
    font-size: 0.9rem;
    gap: 8px;
  }
  
  input[type="text"], select {
    padding: 8px 10px;
    font-size: 14px;
    max-width: none;
    width: 100%;
    box-sizing: border-box;
  }
  
  select {
    padding-right: 32px;
    background-size: 10px;
    background-position: right 10px center;
  }
  
  input[type="text"] {
    max-width: calc(100vw - 60px); /* Verhindere Überschneidung */
  }
  
  .date-filter-container {
    width: 100%;
  }
  
  .date-input {
    max-width: none;
    flex: 1;
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
  
  .calendar-icon {
    width: 36px;
    height: 36px;
    font-size: 14px;
    color: var(--c-primary);
  }
  
  input[type="checkbox"] {
    width: 1.1em;
    height: 1.1em;
  }
  
  .no-logs-message {
    margin-top: 2rem;
    padding: 1.5rem;
    font-size: 0.9rem;
  }
}
</style>
