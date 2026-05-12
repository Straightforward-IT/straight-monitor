<template>
  <div class="lead-board">
    <div
      v-for="col in columns"
      :key="col.value"
      class="lb-col"
      :class="`lb-col--${col.value}`"
    >
      <header class="lb-col-header">
        <span class="lb-col-dot" :class="`stufe-${col.value}`"></span>
        <span class="lb-col-title">{{ col.label }}</span>
        <span class="lb-col-count">{{ groupedLeads[col.value].length }}</span>
      </header>

      <div
        v-if="groupedLeads[col.value].length === 0"
        class="lb-col-empty"
      >
        Keine Leads
      </div>

      <draggable
        :model-value="groupedLeads[col.value]"
        :group="{ name: 'leads', pull: true, put: true }"
        item-key="_id"
        class="lb-col-body"
        :animation="180"
        ghost-class="lb-card-ghost"
        chosen-class="lb-card-chosen"
        drag-class="lb-card-drag"
        @change="(evt) => onChange(col.value, evt)"
      >
        <template #item="{ element }">
          <LeadCard
            :lead="element"
            :is-active="activeLeadId === element._id"
            :custom-labels="customLabels"
            :show-created="showCreated"
            :quelle-options="quelleOptions"
            @open="$emit('open', element)"
            @toggle-favorite="$emit('toggle-favorite', element)"
            @row-menu="(e, l) => $emit('row-menu', e, l)"
          />
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';
import LeadCard from './LeadCard.vue';

const props = defineProps({
  leads: { type: Array, required: true },
  activeLeadId: { type: String, default: null },
  customLabels: { type: Array, default: () => [] },
  showCreated: { type: Boolean, default: false },
  quelleOptions: { type: Array, default: () => [] },
});

const emit = defineEmits(['open', 'toggle-favorite', 'row-menu', 'stage-change']);

const columns = [
  { value: 'neu',          label: 'Neu' },
  { value: 'qualifiziert', label: 'Qualifiziert' },
  { value: 'angebot',      label: 'Angebot' },
  { value: 'verhandlung',  label: 'Verhandlung' },
  { value: 'gewonnen',     label: 'Gewonnen' },
  { value: 'verloren',     label: 'Verloren' },
];

const groupedLeads = computed(() => {
  const groups = Object.fromEntries(columns.map(c => [c.value, []]));
  for (const lead of props.leads) {
    const stufe = groups[lead.stufe] ? lead.stufe : 'neu';
    groups[stufe].push(lead);
  }
  // Favorites pinned to top within each column
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  }
  return groups;
});

function onChange(toStufe, evt) {
  // Only react to inter-column moves; within-column reorder is local-only.
  if (evt.added) {
    const lead = evt.added.element;
    const fromStufe = lead.stufe;
    if (fromStufe !== toStufe) {
      emit('stage-change', { lead, fromStufe, toStufe });
    }
  }
}
</script>

<style scoped lang="scss">
.lead-board {
  display: flex;
  gap: 12px;
  padding: 12px;
  overflow-x: auto;
  align-items: stretch;
  // Fill remaining vertical space; parent supplies height context.
  flex: 1;
  min-height: 0;
  height: 100%;
}

.lb-col {
  flex: 1 1 0;
  min-width: 240px;
  max-width: 360px;
  background: var(--surface-bg, #f9fafb);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  min-height: 200px;
  overflow: hidden;

}

.lb-col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #111827);
  background: var(--card-bg, #fff);
}

.lb-col-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  &.stufe-neu          { background: #6366f1; }
  &.stufe-qualifiziert { background: #06b6d4; }
  &.stufe-angebot      { background: #f59e0b; }
  &.stufe-verhandlung  { background: #f97316; }
  &.stufe-gewonnen     { background: #10b981; }
  &.stufe-verloren     { background: #ef4444; }
}

.lb-col-title { flex: 1; }

.lb-col-count {
  font-size: 11px;
  background: var(--hover-bg, #f3f4f6);
  color: var(--text-muted, #6b7280);
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 600;
}

.lb-col-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 60px;
}

.lb-col-empty {
  padding: 20px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #9ca3af);
  font-style: italic;
}

// Vuedraggable visual states
.lb-card-ghost {
  opacity: 0.4;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}
.lb-card-chosen {
  cursor: grabbing;
}
.lb-card-drag {
  transform: rotate(2deg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
</style>
