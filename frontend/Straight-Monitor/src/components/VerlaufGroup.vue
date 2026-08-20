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
            position="top"
            :delay-in="400"
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
          :highlight-id="highlightId"
          @open-mitarbeiter="$emit('open-mitarbeiter', $event)"
          @revert-log="$emit('revert-log', $event)"
          @revert-item="$emit('revert-item', $event)"
        />
        <div v-else class="log-list">
          <div 
            v-for="log in group"
            :key="log._id"
            :id="highlightId && log._id === highlightId ? `highlight-${log._id}` : undefined"
            :class="['log-card', { 'log-card--highlighted': highlightId && log._id === highlightId, 'log-card--storniert': log.storniert }]"
          >
            <div class="log-card-header" @click="toggleExpandLog(log)">
              <div class="log-meta">
                <span><strong>Benutzer:</strong> {{ log.benutzerMail }}</span>
                <span><strong>Art:</strong> {{ log.art }}</span>
                <span><strong>Timestamp:</strong> {{ formatTimestamp(log.timestamp) }}</span>
                <custom-tooltip
                  v-if="log.mitarbeiterName"
                  text="Mitarbeiter öffnen"
                  position="top"
                  :delay-in="400"
                  :disabled="!log.mitarbeiter"
                >
                  <span
                    class="ma-badge"
                    :class="{ 'ma-badge--clickable': log.mitarbeiter }"
                    @click.stop="log.mitarbeiter && $emit('open-mitarbeiter', log.mitarbeiter)"
                  >
                    <font-awesome-icon :icon="['fas', 'user']" class="ma-badge__icon" />
                    <span v-if="log.mitarbeiterPersonalnr" class="ma-badge__nr">{{ log.mitarbeiterPersonalnr }}</span>
                    {{ log.mitarbeiterName }}
                  </span>
                </custom-tooltip>
                <span v-if="log.storniert" class="storniert-badge">
                  <font-awesome-icon :icon="['fas', 'ban']" /> Storniert
                </span>
              </div>
              <div class="log-card-actions">
                <custom-tooltip
                  v-if="!log.storniert"
                  text="Gesamten Eintrag zurücksetzen"
                  position="top"
                  :delay-in="400"
                >
                  <button class="action-btn action-btn--revert" @click.stop="$emit('revert-log', log)">
                    <font-awesome-icon :icon="['fas', 'rotate-left']" />
                  </button>
                </custom-tooltip>
                <font-awesome-icon class="expand-icon small" :icon="['fas', log.isExpanded ? 'eye-slash' : 'eye']" />
              </div>
            </div>

            <p v-if="log.packageTemplateName || annotationText(log)" class="log-annotation">
              <template v-if="log.packageTemplateName"><strong>Paket:</strong> {{ log.packageTemplateName }}</template>
              <template v-if="log.packageTemplateName && annotationText(log)"> · </template>
              <template v-if="annotationText(log)"><strong>Anmerkung:</strong> {{ annotationText(log) }}</template>
            </p>

            <div v-if="log.isExpanded" class="log-details">
              <div
                v-for="(item, index) in log.items"
                :key="item.itemId || index"
                class="item-detail"
                :class="{ 'item-detail--storniert': item.storniert }"
              >
                <span class="item-number">#{{ index + 1 }}</span>
                <span class="item-name">{{ item.bezeichnung }}</span>
                <span class="item-info">Größe: {{ item.groesse }}</span>
                <span class="item-info">Anzahl: {{ item.anzahl }}</span>
                <span v-if="item.storniert" class="storniert-badge storniert-badge--sm">
                  <font-awesome-icon :icon="['fas', 'ban']" /> Storniert
                </span>
                <custom-tooltip
                  v-else
                  text="Dieses Item zurücksetzen"
                  position="top"
                  :delay-in="400"
                >
                  <button class="action-btn action-btn--revert item-revert-btn" @click.stop="$emit('revert-item', { log, index })">
                    <font-awesome-icon :icon="['fas', 'rotate-left']" />
                  </button>
                </custom-tooltip>
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
import { faChevronRight, faChevronDown, faEye, faEyeSlash, faUser, faRotateLeft, faBan } from "@fortawesome/free-solid-svg-icons";
import CustomTooltip from './CustomTooltip.vue';
library.add(faChevronRight, faChevronDown, faEye, faEyeSlash, faUser, faRotateLeft, faBan);

export default {
  name: "VerlaufGroup",
  components: { FontAwesomeIcon, CustomTooltip },
  emits: ['open-mitarbeiter', 'revert-log', 'revert-item'],
  props: {
    groupedData: { type: Object, required: true },
    activeGroups: { type: Array, required: true },
    level: { type: Number, default: 0 },
    highlightId: { type: String, default: null },
  },
  data() {
    return { expandedKeys: new Set() };
  },
  mounted() {
    if (this.level === 0) {
      // At root level, start with all groups expanded
      Object.keys(this.groupedData).forEach((k) => this.expandedKeys.add(k));
    }
    // At ANY level: if a highlightId is set, expand relevant groups
    if (this.highlightId) {
      this.expandGroupsForHighlight();
    }
  },
  methods: {
    isExpanded(key) { return this.expandedKeys.has(key); },
    toggleExpand(key) {
      if (this.expandedKeys.has(key)) this.expandedKeys.delete(key);
      else this.expandedKeys.add(key);
      this.$forceUpdate();
    },
    annotationText(log) {
      return String(log.anmerkung || '').replace(/\[Paketvorlage: [a-f\d]{24}\]\s*/i, '').trim();
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
    // Check if a specific group/key contains the highlighted log
    groupContainsHighlight(group) {
      if (!this.highlightId) return false;
      
      if (this.isGroup(group)) {
        // Recursively check nested groups
        return Object.values(group).some(v => this.groupContainsHighlight(v));
      }
      
      if (Array.isArray(group)) {
        // Check if any log in this array has the matching ID
        return group.some(log => log._id === this.highlightId);
      }
      
      return false;
    },
    expandGroupsForHighlight() {
      // Recursively expand all groups that contain the highlighted log
      Object.entries(this.groupedData).forEach(([key, group]) => {
        if (this.groupContainsHighlight(group)) {
          this.expandedKeys.add(key);
          // Also expand the log if it's at the leaf level
          if (Array.isArray(group)) {
            group.forEach(log => {
              if (log._id === this.highlightId) {
                log.isExpanded = true;
              }
            });
          }
        }
      });
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

.action-btn--revert:hover {
  border-color: #c3423f;
  color: #c3423f;
  background: color-mix(in oklab, #c3423f 10%, var(--c-bg));
}

.log-card-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.storniert-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 5px;
  background: color-mix(in oklab, #c3423f 14%, var(--c-surface));
  border: 1px solid color-mix(in oklab, #c3423f 35%, transparent);
  color: #c3423f;
  font-size: .82rem;
  font-weight: 600;
  white-space: nowrap;
}
.storniert-badge--sm {
  font-size: .74rem;
  padding: 1px 6px;
}

.item-revert-btn {
  margin-left: auto;
}
.item-detail > :deep(.tooltip-container) {
  margin-left: auto;
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

.log-card--highlighted {
  border-left: 4px solid var(--c-primary);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--c-primary) 20%, var(--c-bg)), 0 6px 16px -3px rgba(0,0,0,.12);
  transform: translateY(-2px);
}

.log-card--storniert {
  border-left: 4px solid #c3423f;
  opacity: .8;
}

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

.ma-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 5px;
  background: color-mix(in oklab, var(--c-primary) 14%, var(--c-surface));
  border: 1px solid color-mix(in oklab, var(--c-primary) 28%, transparent);
  color: color-mix(in oklab, var(--c-primary) 90%, var(--c-text-primary));
  font-size: .85rem;
  font-weight: 500;
  white-space: nowrap;

  &__icon { font-size: .75rem; opacity: .75; }
  &__nr { font-family: monospace; font-size: .78rem; opacity: .6; letter-spacing: .3px; }
  &--clickable { cursor: pointer; transition: background .15s, border-color .15s; }
  &--clickable:hover {
    background: color-mix(in oklab, var(--c-primary) 25%, var(--c-surface));
    border-color: color-mix(in oklab, var(--c-primary) 55%, transparent);
  }
}

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
.item-detail--storniert{
  opacity: .55;
  text-decoration: line-through;
  text-decoration-color: #c3423f;
}
.item-detail--storniert .storniert-badge{
  text-decoration: none;
  margin-left: auto;
}

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
