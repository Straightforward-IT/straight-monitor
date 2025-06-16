<template>
  <div class="group-container">
    <template v-for="(group, key) in groupedData" :key="key">
      <div class="group-header" @click="toggleExpand(key)">
        <h4 class="group-title">{{ key }}</h4>
        <font-awesome-icon
          class="expand-icon"
          :icon="isExpanded(key) ? 'chevron-down' : 'chevron-right'"
        />
      </div>

      <div v-if="isExpanded(key)" class="group-children">
        <verlauf-group
          v-if="isGroup(group)"
          :grouped-data="group"
          :active-groups="activeGroups"
          :level="level + 1"
        />

        <div v-else class="log-list">
          <div v-for="log in group" :key="log._id" class="log-card">
            <div class="log-card-header" @click="toggleExpandLog(log)">
              <div class="log-meta">
                <span><strong>Benutzer:</strong> {{ log.benutzerMail }}</span>
                <span><strong>Art:</strong> {{ log.art }}</span>
                <span>
                  <strong>Timestamp:</strong>
                  {{ formatTimestamp(log.timestamp) }}
                </span>
              </div>
              <font-awesome-icon
                class="expand-icon small"
                :icon="log.isExpanded ? 'minus' : 'plus'"
              />
            </div>

            <p v-if="log.anmerkung" class="log-annotation"><strong>Anmerkung:</strong> {{ log.anmerkung }}</p>

            <div v-if="log.isExpanded" class="log-details">
              <div
                v-for="(item, index) in log.items"
                :key="item.itemId || index"
                class="item-detail"
              >
                <span class="item-number">#{{ index + 1 }}</span>
                <span class="item-name">{{ item.bezeichnung }}</span>
                <span class="item-info">Größe: {{ item.groesse }}</span>
                <span class="item-info">Anzahl: {{ item.anzahl }}</span>
              </div>
              <p v-if="log.items.length === 0" class="item-info">Keine Items in diesem Log-Eintrag.</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faChevronRight, faChevronDown, faPlus, faMinus } from "@fortawesome/free-solid-svg-icons";

library.add(faChevronRight, faChevronDown, faPlus, faMinus);

export default {
  name: "VerlaufGroup",
  components: {
    FontAwesomeIcon,
  },
  props: {
    groupedData: {
      type: Object,
      required: true,
    },
    activeGroups: {
      type: Array,
      required: true,
    },
    level: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      expandedKeys: new Set(),
    };
  },
  mounted() {
    if (this.level === 0) {
      Object.keys(this.groupedData).forEach(key => {
        this.expandedKeys.add(key);
      });
    }
  },
  methods: {
    isExpanded(key) {
      return this.expandedKeys.has(key);
    },
    toggleExpand(key) {
      if (this.expandedKeys.has(key)) {
        this.expandedKeys.delete(key);
      } else {
        this.expandedKeys.add(key);
      }
      this.$forceUpdate();
    },
    toggleExpandLog(log) {
      log.isExpanded = !log.isExpanded;
    },
    isGroup(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    },
    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleDateString("de-DE", {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
      }) + " - " + date.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }) + " Uhr";
    },
  },
};
</script>

<style scoped lang="scss">
// Definieren Sie Ihre Basisfarben als Sass-Variablen, spiegeln Sie Verlauf.vue
$base-primary: #f69e6f;
$base-secondary-background: #ffffff;
$base-tertiary-bg: #f9f9f9;
$base-border: #e0e0e0; // <-- This is the Sass variable you need
$base-text-primary: #333333;
$base-text-secondary: #555555;



.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem; // Mehr Padding
  margin-top: 1rem; // Mehr Abstand nach oben
  background-color: var(--c-surface);
  border-left: 5px solid var(--c-primary); // Dickerer Primärfarb-Streifen
  border-radius: 0 8px 8px 0; // Abgerundetere Ecken
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    background-color: var(--c-primary-light); // Dies verwendet bereits eine CSS-Variable
    box-shadow: 0 2px 8px rgba(0,0,0,0.05); // Leichter Schatten auf Hover
  }
  // Level-basierte Hintergrundfarbe für Verschachtelung
  @for $i from 0 through 5 {
    &[data-level="#{$i}"] {
      // Verwenden Sie Sass-Variablen für mix() und darken()
      background-color: mix($base-secondary-background, $base-tertiary-bg, $i * 10%);
      border-left: 5px solid darken($base-primary, $i * 5%);
    }
  }
}

.group-title {
  margin: 0;
  font-size: 1.2rem; // Etwas größere Schrift für Gruppentitel
  font-weight: 600;
  color: var(--c-text-primary);
}

.expand-icon {
  color: var(--c-text-secondary);
  transition: transform 0.2s ease;
  &.small {
    font-size: 0.9em; // Etwas größere Icons für Log-Karten
  }
}

.group-children {
  padding-left: 2rem; // Deutlich mehr Einrückung
  padding-top: 0.5rem; // Etwas Abstand oben
  margin-top: 0.5rem;
}

.log-list {
  padding-top: 1rem; // Abstand vor der Liste von Log-Karten
}

.log-card {
  background-color: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 8px; // Abgerundetere Ecken
  margin-bottom: 1.5rem; // Mehr Abstand zwischen Log-Karten
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  overflow: hidden;
  &:hover {
    box-shadow: 0 6px 12px -3px rgba(0,0,0,0.1); // Deutlicherer Schatten
    transform: translateY(-2px); // Leichter "Schwebe"-Effekt
  }
}

.log-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem; // Mehr Padding
  cursor: pointer;
  background-color: var(--c-tertiary-bg); // Leichter Hintergrund für Header
  border-bottom: 1px solid var(--c-border); // Trennlinie zum Inhalt
}

.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2rem; // Mehr Abstand zwischen den Meta-Infos
  span {
    font-size: 0.9rem; // Etwas größere Schrift
    color: var(--c-text-secondary);
    strong {
      color: var(--c-text-primary);
    }
  }
}

.log-annotation {
  font-size: 0.95rem; // Etwas größere Schrift
  padding: 1rem 1.25rem; // Mehr Padding
  margin: 0;
  background: var(--c-primary-light); // Dies verwendet bereits eine CSS-Variable
  color: var(--c-text-primary);
  border-top: 1px solid var(--c-border);
  border-bottom: 1px solid var(--c-border);
  line-height: 1.5; // Bessere Lesbarkeit
}

.log-details {
  padding: 1.25rem; // Mehr Padding
  background-color: var(--c-bg); // Hintergrund aus Farbvariable
}

.item-detail {
  display: flex;
  align-items: center;
  gap: 1.25rem; // Mehr Abstand zwischen Item-Details
  padding: 0.75rem 0; // Mehr vertikales Padding
  font-size: 0.95rem;
  // FIX: Use $base-border for lighten()
  border-bottom: 1px dashed lighten($base-border, 10%); // Gestrichelte, hellere Linie
  &:last-child {
    border-bottom: none;
  }
}

.item-number {
  font-weight: 700; // Fetter
  color: var(--c-primary); // Dies verwendet bereits eine CSS-Variable
  width: 2.5rem; // Feste Breite für Nummer, zur Ausrichtung
  flex-shrink: 0;
}

.item-name {
  flex-grow: 1;
  color: var(--c-text-primary);
}

.item-info {
  color: var(--c-text-secondary);
  white-space: nowrap;
}

.log-details > .item-info { // Für "Keine Items" Nachricht
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  text-align: center;
}
</style>
