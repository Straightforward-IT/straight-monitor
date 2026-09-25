<template>
  <div class="workflow-board" role="region" :aria-label="ariaLabel">
    <section
      v-for="column in columns"
      :key="column.id"
      class="workflow-board__column"
      :class="column.className || `workflow-board__column--${column.id}`"
    >
      <header class="workflow-board__column-header">
        <span v-if="column.color" class="workflow-board__column-dot" :style="{ background: column.color }" />
        <span class="workflow-board__column-title">{{ column.label }}</span>
        <span class="workflow-board__column-count">{{ groupedRecords[column.id].length }}</span>
      </header>
      <p v-if="showEmptyState && groupedRecords[column.id].length === 0" class="workflow-board__empty">
        {{ column.emptyLabel || emptyLabel }}
      </p>
      <draggable
        :model-value="groupedRecords[column.id]"
        :group="dragGroup"
        :item-key="recordKey"
        class="workflow-board__column-body"
        :animation="180"
        ghost-class="workflow-board__card-ghost"
        chosen-class="workflow-board__card-chosen"
        drag-class="workflow-board__card-drag"
        @change="(event) => onChange(column.id, event)"
      >
        <template #item="{ element, index }">
          <slot name="card" :record="element" :column="column" :index="index" />
        </template>
      </draggable>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps({
  records: { type: Array, required: true },
  columns: { type: Array, required: true },
  stageKey: { type: String, default: 'stage' },
  recordKey: { type: String, default: '_id' },
  fallbackColumnId: { type: String, default: '' },
  dragGroup: { type: [String, Object], default: 'workflow-board' },
  emptyLabel: { type: String, default: 'Keine Einträge' },
  showEmptyState: { type: Boolean, default: true },
  ariaLabel: { type: String, default: 'Workflow-Board' },
  sortRecords: { type: Function, default: null },
});

const emit = defineEmits(['move']);
const columnIds = computed(() => new Set(props.columns.map((column) => column.id)));
const defaultColumnId = computed(() => props.fallbackColumnId || props.columns[0]?.id || '');

const groupedRecords = computed(() => {
  const groups = Object.fromEntries(props.columns.map((column) => [column.id, []]));
  for (const record of props.records) {
    const stage = columnIds.value.has(record?.[props.stageKey]) ? record[props.stageKey] : defaultColumnId.value;
    if (groups[stage]) groups[stage].push(record);
  }
  if (props.sortRecords) Object.values(groups).forEach((records) => records.sort(props.sortRecords));
  return groups;
});

function onChange(toColumnId, event) {
  if (!event.added) return;
  const record = event.added.element;
  const fromColumnId = record?.[props.stageKey] || defaultColumnId.value;
  if (fromColumnId !== toColumnId) emit('move', { record, fromColumnId, toColumnId });
}
</script>

<style scoped lang="scss">
.workflow-board { align-items: stretch; display: flex; flex: 1; gap: 12px; height: 100%; min-height: 0; overflow-x: auto; padding: 12px; }
.workflow-board__column { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; display: flex; flex: 1 1 0; flex-direction: column; max-height: 100%; max-width: 360px; min-height: 200px; min-width: 240px; overflow: hidden; }
.workflow-board__column-header { align-items: center; background: var(--tile-bg); border-bottom: 1px solid var(--border); color: var(--text); display: flex; font-size: 13px; font-weight: 600; gap: 8px; padding: 10px 12px; }
.workflow-board__column-dot { border-radius: 50%; flex-shrink: 0; height: 10px; width: 10px; }
.workflow-board__column-title { flex: 1; }
.workflow-board__column-count { background: var(--hover); border-radius: 10px; color: var(--muted); font-size: 11px; font-weight: 600; padding: 2px 7px; }
.workflow-board__column-body { display: flex; flex: 1; flex-direction: column; gap: 8px; min-height: 60px; overflow-y: auto; padding: 8px; }
.workflow-board__empty { color: var(--muted); font-size: 12px; font-style: italic; margin: 0; padding: 20px 12px; text-align: center; }
.workflow-board__card-ghost { background: color-mix(in srgb, var(--primary) 8%, transparent); opacity: .4; }
.workflow-board__card-chosen { cursor: grabbing; }
.workflow-board__card-drag { box-shadow: 0 8px 24px rgba(0, 0, 0, .18); transform: rotate(2deg); }
</style>
