<template>
  <div class="window">
    <a class="discrete" @click="switchToDashboard">Zurück zum Dashboard</a>

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
            <input
              type="checkbox"
              v-model="groupBy.standort"
              @change="groupLogs"
            />
            Standort
          </label>
          <label>
            <input
              type="checkbox"
              v-model="groupBy.monat"
              @change="groupLogs"
            />
            Monat
          </label>
          <label>
            <input type="checkbox" v-model="groupBy.tag" @change="groupLogs" />
            Tag
          </label>
          <label>
            <input
              type="checkbox"
              v-model="groupBy.benutzer"
              @change="groupLogs"
            />
            Benutzer
          </label>
          <label>
            <input type="checkbox" v-model="groupBy.art" @change="groupLogs" />
            Art
          </label>
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
      ></verlauf-group>
    </div>
    <div v-else class="no-logs-message">
      <p v-if="searchQuery">
        Keine Einträge für die Suche nach "{{ searchQuery }}" gefunden.
      </p>
      <p v-else>Keine Log-Einträge vorhanden.</p>
    </div>
  </div>
</template>

<script>
import api from "@/utils/api";
import VerlaufGroup from "./VerlaufGroup.vue";

export default {
  name: "Verlauf",
  components: {
    VerlaufGroup,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      logs: [],
      groupBy: {
        standort: true,
        monat: true,
        tag: false,
        benutzer: false,
        art: false,
      },
      sortBy: "timestamp_desc",
      searchQuery: "", // HINZUGEFÜGT: Zustand für das Suchfeld
      groupedLogs: {},
    };
  },
  computed: {
    // Diese Computed Property führt nun Filtern UND Sortieren aus.
    processedLogs() {
      let processed = [...this.logs];
      const searchTerm = this.searchQuery.trim().toLowerCase();

      // 1. HINZUGEFÜGT: Filter-Logik anwenden
      if (searchTerm) {
        processed = processed.filter((log) => {
          // Suche in der Anmerkung (Groß-/Kleinschreibung ignorieren)
          const annotationMatch =
            log.anmerkung && log.anmerkung.toLowerCase().includes(searchTerm);

          // Suche in den Item-Bezeichnungen
          const itemMatch = log.items.some(
            (item) =>
              item.bezeichnung &&
              item.bezeichnung.toLowerCase().includes(searchTerm)
          );

          return annotationMatch || itemMatch;
        });
      }

      // 2. Bestehende Sortier-Logik auf die (gefilterten) Ergebnisse anwenden
      switch (this.sortBy) {
        case "timestamp_asc":
          processed.sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          break;
        case "timestamp_desc":
        default:
          processed.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          break;
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
    // ... (Methoden bleiben größtenteils unverändert)
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    async fetchLogs() {
      try {
        const response = await api.get("/api/monitoring");
        this.logs = response.data.map((log) => ({ ...log, isExpanded: false }));
        this.groupLogs();
      } catch (error) {
        console.error("Fehler beim Abrufen der Logs:", error);
      }
    },
    activeGroups() {
      return Object.keys(this.groupBy)
        .filter((key) => this.groupBy[key])
        .map((key) => (key === "benutzer" ? "benutzerMail" : key));
    },
    groupByKeys(data, keys) {
      if (keys.length === 0) return data;
      const [key, ...rest] = keys;
      const grouped = {};
      data.forEach((item) => {
        const groupKey =
          key === "monat"
            ? new Date(item.timestamp).toLocaleString("de-DE", {
                month: "long",
                year: "numeric",
              })
            : key === "tag"
            ? new Date(item.timestamp).toLocaleDateString("de-DE")
            : item[key] || "Unbekannt";
        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey].push(item);
      });
      Object.keys(grouped).forEach((groupKey) => {
        grouped[groupKey] = this.groupByKeys(grouped[groupKey], rest);
      });
      return grouped;
    },
    groupLogs() {
      const activeGroups = this.activeGroups();
      const dataToGroup = this.processedLogs; // Verwendet die gefilterte UND sortierte Liste

      if (activeGroups.length > 0 && dataToGroup.length > 0) {
        this.groupedLogs = this.groupByKeys(dataToGroup, activeGroups);
      } else if (dataToGroup.length > 0) {
        this.groupedLogs = { "Alle Ergebnisse": dataToGroup };
      } else {
        this.groupedLogs = {}; // Keine Ergebnisse, leeres Objekt
      }
    },
    switchToDashboard() {
      this.$router.push("/");
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchLogs();
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.window {
  // Jetzt weisen Sie die Sass-Variablen (oder berechnete Sass-Farben) den CSS-Variablen zu
  --c-bg: #f7f7f7; // Kann auch eine Sass-Variable sein, z.B. $base-bg
  --c-surface: #{$base-panel-bg};
  --c-tertiary-bg: #{$base-input-bg};
  --c-border: #{$base-border-color};
  --c-primary: #{$base-primary}; // Zuweisen der Sass-Variable zur CSS-Variable
  --c-primary-light: #{color.adjust($base-primary, $lightness: 20%)};
  --c-text-primary: #{$base-text-dark};
  --c-text-secondary: #{$base-text-notsodark};
  --c-text-light: #{$base-text-medium};

  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; // Konsistente Schriftart
  background-color: var(--c-bg);
  color: var(--c-text-primary);
  min-height: 100vh;
  max-width: 1200px;
  margin: 30px auto; // Oben/Unten mehr Abstand
  padding: 30px; // Mehr Innenabstand
  box-sizing: border-box;
  border-radius: 12px; // Abgerundetere Ecken
  box-shadow: 0px 6px 12px rgba(0, 0, 0, 0.08); // Sanfterer Schatten
}

.discrete {
  display: inline-block;
  padding: 5px 10px;
  color: var(--c-text-medium);
  text-decoration: none; /* No underline by default */
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.2s ease; /* Transition only color */

  &:hover {
    color: var(--c-primary); /* Primary color on hover */
    /* text-decoration: underline; -- Removed as requested */
  }
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 2rem; // Mehr Abstand zwischen den Control-Gruppen
  padding: 2rem; // Mehr Innenabstand
  margin-bottom: 3rem; // Mehr Abstand nach unten
  background-color: var(--c-surface);
  border-radius: 10px; // Abgerundetere Ecken
  border: 1px solid var(--c-border);
  box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.05); // Leichterer Schatten
}

.control-group {
  display: flex;
  align-items: center; // Vertikal zentriert
  flex-wrap: wrap;
  gap: 1.5rem; // Abstand innerhalb der Gruppe
}

.group-label {
  font-size: 1.05rem; // Etwas größere Schrift
  font-weight: 600;
  color: var(--c-text-primary);
  padding-top: 0; // Kein padding-top nötig
  flex-shrink: 0;
  width: 150px; // Etwas breiter für die Labels
  text-align: right; // Rechtsbündig für besseren Fluss
}

.checkbox-options {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem; // Mehr Abstand zwischen Checkboxen
  align-items: center;
}

.controls label {
  display: flex;
  align-items: center;
  gap: 0.8rem; // Mehr Abstand zwischen Checkbox und Text
  font-size: 1rem; // Standard-Schriftgröße
  color: var(--c-text-secondary);
  cursor: pointer;
  user-select: none;
  &:hover {
    color: var(--c-text-primary);
  }
}

input[type="text"],
select {
  flex-grow: 1; // Erlaubt, dass Input Felder den verfügbaren Platz einnehmen
  padding: 0.8rem 1rem; // Mehr Padding
  font-size: 0.95rem; // Etwas größere Schrift
  height: auto; // Automatische Höhe, passt sich Padding an
  border-radius: 8px; // Stärker abgerundet
  border: 1px solid var(--c-border);
  background-color: var(--c-tertiary-bg); // Hintergrund aus Farbvariable
  color: var(--c-text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    // Wenn Sie einen spezifischen Hover-Effekt auf dem Rand wünschen, verwenden Sie eine Sass-Farbe direkt
border-color: color.adjust($base-primary, $lightness: 20%);  }

  &:focus {
    outline: none;
    border-color: var(
      --c-primary
    ); // Verwenden Sie die CSS-Variable für die Primärfarbe zur Laufzeit
    box-shadow: 0 0 0 3px rgba($base-primary, 0.2); // Verwenden Sie die Sass-Variable für die rgba-Farbmanipulation
  }
}

input[type="text"] {
  max-width: 350px;
}

select {
  cursor: pointer;
  // Spezifisches Styling für Select falls benötigt, aber oft sind die Standardeinstellungen in Ordnung
}

input[type="checkbox"] {
  appearance: none;
  height: 1.25em; // Etwas größere Checkbox
  width: 1.25em;
  margin: 0;
  background-color: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 4px; // Etwas weniger rund als Input Felder
  cursor: pointer;
  display: grid;
  place-content: center;
  transition: all 0.2s ease-in-out;
  padding: 0;

  &::before {
    content: "";
    width: 0.65em; // Pass die Größe des Hakens an
    height: 0.65em;
    transform: scale(0);
    transition: 0.12s transform ease-in-out;
    box-shadow: inset 1em 1em var(--c-primary); // Dies funktioniert, da box-shadow CSS-Variablen akzeptiert
    background-color: CanvasText;
    mask-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m2 8 4 4 8-8"/></svg>');
    mask-size: cover;
    -webkit-mask-size: cover;
  }

  &:checked {
    background-color: var(--c-primary);
    border-color: var(--c-primary);

    &::before {
      transform: scale(1);
    }
  }
}

.no-logs-message {
  text-align: center;
  margin-top: 4rem;
  padding: 2rem;
  background-color: var(--c-surface);
  border-radius: 10px; // Konsistente Rundung
  color: var(--c-text-secondary);
  border: 1px solid var(--c-border); // Leichter Rahmen
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.03); // Leichter Schatten
}
</style>
