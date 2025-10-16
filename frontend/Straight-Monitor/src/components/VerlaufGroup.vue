<template>
  <div class="group-container">
    <template v-for="(group, key) in groupedData" :key="key">
      <div class="group-header" :data-level="level">
        <div class="group-title-area" @click="toggleExpand(key)">
          <h4 class="group-title">{{ key }}</h4>
          <font-awesome-icon
            class="expand-icon"
            :icon="isExpanded(key) ? 'chevron-down' : 'chevron-right'"
          />
        </div>
        <div v-if="!isGroup(groupedData[key])" class="group-actions">
          <custom-tooltip
            :text="areLogsExpanded(group) ? 'Alle Details ausblenden' : 'Alle Details anzeigen'"
            position="left"
            :delay="500"
          >
            <button class="action-btn" @click.stop="toggleAllLogs(group)">
              <font-awesome-icon :icon="['fas', areLogsExpanded(group) ? 'eye-slash' : 'eye']" />
            </button>
          </custom-tooltip>
        </div>
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
                <span><strong>Timestamp:</strong> {{ formatTimestamp(log.timestamp) }}</span>
              </div>
              <font-awesome-icon class="expand-icon small" :icon="['fas', log.isExpanded ? 'eye-slash' : 'eye']" />
            </div>

            <p v-if="log.anmerkung" class="log-annotation">
              <strong>Anmerkung:</strong> {{ log.anmerkung }}
            </p>

            <div v-if="log.isExpanded" class="log-details">
              <div v-for="(item, index) in log.items" :key="item.itemId || index" class="item-detail">
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
import { faChevronRight, faChevronDown, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import CustomTooltip from './CustomTooltip.vue';
library.add(faChevronRight, faChevronDown, faEye, faEyeSlash);

export default {
  name: "VerlaufGroup",
  components: { FontAwesomeIcon, CustomTooltip },
  props: {
    groupedData: { type: Object, required: true },
    activeGroups: { type: Array, required: true },
    level: { type: Number, default: 0 },
  },
  data() {
    return { expandedKeys: new Set() };
  },
  mounted() {
    if (this.level === 0) {
      Object.keys(this.groupedData).forEach((k) => this.expandedKeys.add(k));
    }
  },
  methods: {
    isExpanded(key) { return this.expandedKeys.has(key); },
    toggleExpand(key) {
      if (this.expandedKeys.has(key)) this.expandedKeys.delete(key);
      else this.expandedKeys.add(key);
      this.$forceUpdate();
    },
    toggleExpandLog(log) { log.isExpanded = !log.isExpanded; },
    areLogsExpanded(logs) {
      return Array.isArray(logs) && logs.length > 0 && logs.every(log => log.isExpanded);
    },
    toggleAllLogs(logs) {
      if (Array.isArray(logs)) {
        const shouldExpand = !this.areLogsExpanded(logs);
        logs.forEach(log => log.isExpanded = shouldExpand);
      }
    },
    isGroup(v) { return typeof v === "object" && v !== null && !Array.isArray(v); },
    formatTimestamp(ts) {
      const d = new Date(ts);
      return d.toLocaleDateString("de-DE", { year: "2-digit", month: "2-digit", day: "2-digit" })
        + " - " +
        d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
        + " Uhr";
    },
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

/* Theme-Mapping für dieses Teil */
.group-container{
  --c-surface:       var(--tile-bg);
  --c-bg:            var(--bg);
  --c-tertiary-bg:   var(--hover);
  --c-border:        var(--border);
  --c-primary:       var(--primary);
  --c-text-primary:  var(--text);
  --c-text-secondary:var(--muted);
  color: var(--c-text-primary);
}

.group-header{
  display:flex; justify-content:space-between; align-items:center;
  padding: 1rem 1.25rem;
  margin-top: 1rem;
  background: var(--c-surface);
  border:1px solid var(--c-border);
  border-left: 5px solid var(--c-primary);
  border-radius: 0 8px 8px 0;
  cursor:pointer;
  transition: background-color .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.group-header:hover{
  background: color-mix(in oklab, var(--c-primary) 12%, var(--c-surface));
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}

.group-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  cursor: pointer;
}

.group-actions {
  display: flex;
  gap: 8px;
  margin-left: 16px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  color: var(--c-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--c-tertiary-bg);
    border-color: var(--c-primary);
    color: var(--c-text-primary);
  }
}

/* Level-Schattierung über data-level, Theme-aware */
.group-header[data-level="0"]{ background: var(--c-surface); }
.group-header[data-level="1"]{ background: color-mix(in oklab, var(--c-tertiary-bg) 55%, var(--c-surface)); }
.group-header[data-level="2"]{ background: color-mix(in oklab, var(--c-tertiary-bg) 70%, var(--c-surface)); }
.group-header[data-level="3"]{ background: color-mix(in oklab, var(--c-tertiary-bg) 80%, var(--c-surface)); }
.group-header[data-level="4"]{ background: color-mix(in oklab, var(--c-tertiary-bg) 88%, var(--c-surface)); }
.group-header[data-level="5"]{ background: color-mix(in oklab, var(--c-tertiary-bg) 92%, var(--c-surface)); }

.group-title{
  margin:0; font-size:1.1rem; font-weight:600; color: var(--c-text-primary);
}

.expand-icon{ color: var(--c-text-secondary); transition: transform .2s ease; }
.expand-icon.small{ font-size:.9em; }

.group-children{ padding-left: 2rem; padding-top:.5rem; margin-top:.5rem; }

.log-list{ padding-top: 1rem; }

.log-card{
  background: var(--c-surface);
  border:1px solid var(--c-border);
  border-radius:8px; margin-bottom: 1.2rem;
  transition: box-shadow .2s ease, transform .2s ease;
  overflow:hidden;
}
.log-card:hover{ box-shadow: 0 6px 12px -3px rgba(0,0,0,.10); transform: translateY(-2px); }

.log-card-header{
  display:flex; justify-content:space-between; align-items:center;
  padding: 1rem 1.25rem;
  cursor:pointer;
  background: var(--c-tertiary-bg);
  border-bottom:1px solid var(--c-border);
}

.log-meta{
  display:flex; flex-wrap:wrap; gap:.75rem 1.5rem;
}
.log-meta span{ font-size:.92rem; color: var(--c-text-secondary); }
.log-meta span strong{ color: var(--c-text-primary); }

.log-annotation{
  font-size:.95rem;
  padding: .9rem 1.25rem; margin:0;
  background: color-mix(in oklab, var(--c-primary) 14%, var(--c-surface));
  color: var(--c-text-primary);
  border-top:1px solid var(--c-border); border-bottom:1px solid var(--c-border);
  line-height:1.5;
}

.log-details{
  padding: 1.1rem 1.25rem;
  background: var(--c-bg);
}

.item-detail{
  display:flex; align-items:center; gap:1.1rem;
  padding:.6rem 0; font-size:.95rem;
  border-bottom:1px dashed color-mix(in oklab, var(--c-border) 70%, transparent);
}
.item-detail:last-child{ border-bottom: none; }

.item-number{
  font-weight:700; color: var(--c-primary);
  width: 2.5rem; flex-shrink:0;
}
.item-name{ flex-grow:1; color: var(--c-text-primary); }
.item-info{ color: var(--c-text-secondary); white-space:nowrap; }

.log-details > .item-info{ padding:.4rem 0; text-align:center; }

/* Mobile Optimierungen */
@media (max-width: 768px) {
  .group-header {
    padding: 8px 12px;
    margin-top: 8px;
    border-left-width: 3px;
    min-height: 36px; /* Reduziere von standardmäßig ~44px */
  }
  
  .group-title {
    font-size: 0.95rem;
    line-height: 1.2;
    margin: 0;
  }
  
  .group-children {
    padding-left: 12px;
    padding-top: 8px;
    margin-top: 8px;
  }
  
  .log-card {
    margin-bottom: 12px;
  }
  
  .log-card-header {
    padding: 12px 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .log-meta {
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }
  
  .log-meta span {
    font-size: 0.85rem;
  }
  
  .log-annotation {
    padding: 12px 16px;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  
  .log-details {
    padding: 12px 16px;
  }
  
  .item-detail {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 8px 0;
    font-size: 0.9rem;
  }
  
  .item-number {
    width: auto;
    font-size: 0.85rem;
  }
  
  .item-name {
    font-weight: 500;
  }
  
  .item-info {
    font-size: 0.8rem;
    white-space: normal;
  }
  
  .action-btn {
    width: 28px;
    height: 28px;
    margin-left: 8px;
  }
  
  .expand-icon {
    margin-left: auto;
  }
  
  /* Bessere Touch-Targets auf Mobile */
  .group-title-area {
    padding: 2px 0;
    min-height: 32px; /* Reduziert von 44px */
    align-items: center;
  }
  
  .log-card-header {
    min-height: 44px;
  }
}
</style>
