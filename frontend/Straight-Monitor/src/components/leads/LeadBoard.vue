<template>
  <WorkflowBoard
    :records="leads"
    :columns="columns"
    stage-key="stufe"
    drag-group="leads"
    fallback-column-id="neu"
    empty-label="Keine Leads"
    aria-label="Lead-Pipeline"
    :sort-records="sortLeads"
    @move="onMove"
  >
    <template #card="{ record }">
      <LeadCard
        :lead="record"
        :is-active="activeLeadId === record._id"
        :custom-labels="customLabels"
        :show-created="showCreated"
        :quelle-options="quelleOptions"
        @open="$emit('open', record)"
        @toggle-favorite="$emit('toggle-favorite', record)"
        @row-menu="(event, lead) => $emit('row-menu', event, lead)"
      />
    </template>
  </WorkflowBoard>
</template>

<script setup>
import WorkflowBoard from '@/components/workflow/WorkflowBoard.vue';
import LeadCard from './LeadCard.vue';

defineProps({
  leads: { type: Array, required: true },
  activeLeadId: { type: String, default: null },
  customLabels: { type: Array, default: () => [] },
  showCreated: { type: Boolean, default: false },
  quelleOptions: { type: Array, default: () => [] },
});

const emit = defineEmits(['open', 'toggle-favorite', 'row-menu', 'stage-change']);

const columns = [
  { id: 'neu', label: 'Neu', color: '#6366f1' },
  { id: 'qualifiziert', label: 'Qualifiziert', color: '#06b6d4' },
  { id: 'angebot', label: 'Angebot', color: '#f59e0b' },
  { id: 'verhandlung', label: 'Verhandlung', color: '#f97316' },
  { id: 'gewonnen', label: 'Gewonnen', color: '#10b981' },
  { id: 'verloren', label: 'Verloren', color: '#ef4444' },
];

function sortLeads(left, right) {
  return (right.isFavorite ? 1 : 0) - (left.isFavorite ? 1 : 0);
}

function onMove({ record, fromColumnId, toColumnId }) {
  emit('stage-change', { lead: record, fromStufe: fromColumnId, toStufe: toColumnId });
}
</script>
