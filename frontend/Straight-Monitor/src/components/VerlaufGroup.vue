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
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  margin-top: 0.5rem;
  background-color: var(--c-surface);
  border-left: 4px solid var(--c-primary);
  border-radius: 0 6px 6px 0;
  cursor: pointer;
  transition: background-color 0.2s ease;
  &:hover {
    background-color: var(--c-primary-light);
  }
}
.group-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--c-text-primary);
}
.expand-icon {
  color: var(--c-text-secondary);
  transition: transform 0.2s ease;
  &.small {
    font-size: 0.8em;
  }
}
.group-children {
  padding-left: 1.5rem;
  margin-top: 0.5rem;
}
.log-card {
  background-color: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  margin-bottom: 1rem;
  transition: box-shadow 0.2s ease;
  overflow: hidden;
  &:hover {
    box-shadow: 0 4px 10px -2px rgba(0,0,0,0.08);
  }
}
.log-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  background-color: #fdfdfd;
}
.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  span {
    font-size: 0.85rem;
    color: var(--c-text-secondary);
    strong {
      color: var(--c-text-primary);
    }
  }
}
.log-annotation {
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  margin: 0;
  background: var(--c-primary-light);
  color: var(--c-text-primary);
  border-top: 1px solid var(--c-border);
  border-bottom: 1px solid var(--c-border);
}
.log-details {
  padding: 1rem;
  background-color: var(--c-bg);
}
.item-detail {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  font-size: 0.9rem;
  border-bottom: 1px solid var(--c-border);
  &:last-child {
    border-bottom: none;
  }
}
.item-number {
  font-weight: 600;
  color: var(--c-text-secondary);
}
.item-name {
  flex-grow: 1;
  color: var(--c-text-primary);
}
.item-info {
  color: var(--c-text-secondary);
  white-space: nowrap;
}
</style>
