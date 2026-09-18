<template>
  <div v-if="totalItems > 0" class="toolbar-page-controls">
    <slot name="sort" />
    <span class="toolbar-page-controls__summary">{{ start }}-{{ end }} von {{ totalItems }}</span>
    <select
      :value="itemsPerPage"
      class="toolbar-page-controls__select"
      :aria-label="itemsPerPageLabel"
      @change="updateItemsPerPage"
    >
      <option v-for="size in pageOptions" :key="size" :value="size">{{ size }}</option>
    </select>
    <button
      v-if="totalPages > 1"
      class="toolbar-page-controls__button"
      type="button"
      title="Vorherige Seite"
      aria-label="Vorherige Seite"
      :disabled="page === 1"
      @click="emit('update:page', page - 1)"
    >
      <FontAwesomeIcon :icon="faChevronLeft" />
    </button>
    <span v-if="totalPages > 1" class="toolbar-page-controls__page">{{ page }} / {{ totalPages }}</span>
    <button
      v-if="totalPages > 1"
      class="toolbar-page-controls__button"
      type="button"
      title="Nächste Seite"
      aria-label="Nächste Seite"
      :disabled="page === totalPages"
      @click="emit('update:page', page + 1)"
    >
      <FontAwesomeIcon :icon="faChevronRight" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

const props = defineProps({
  page: { type: Number, required: true },
  itemsPerPage: { type: Number, required: true },
  totalItems: { type: Number, required: true },
  pageOptions: { type: Array, default: () => [25, 50, 100] },
  itemsPerPageLabel: { type: String, default: 'Einträge pro Seite' },
});
const emit = defineEmits(['update:page', 'update:itemsPerPage']);
const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.itemsPerPage)));
const start = computed(() => (props.totalItems ? (props.page - 1) * props.itemsPerPage + 1 : 0));
const end = computed(() => Math.min(props.page * props.itemsPerPage, props.totalItems));

function updateItemsPerPage(event) {
  emit('update:itemsPerPage', Number(event.target.value));
}
</script>

<style scoped lang="scss">
.toolbar-page-controls {
  position: absolute;
  top: 100%;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  white-space: nowrap;

  :deep(.sort-menu__trigger),
  &__select,
  &__button {
    height: 24px;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 0 0 5px 5px;
    background: var(--tile-bg);
    color: var(--text);
    font: inherit;
    font-size: 0.72rem;
    box-shadow: none;
  }

  :deep(.sort-menu__trigger) { gap: 5px; padding: 0 8px; }
  &__select { min-width: 48px; padding: 0 5px; cursor: pointer; }
  &__button { display: inline-flex; width: 28px; align-items: center; justify-content: center; padding: 0; color: var(--muted); cursor: pointer; }
  :deep(.sort-menu__trigger:hover), &__select:hover, &__button:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
  &__button:disabled { cursor: default; opacity: .45; }
  &__summary, &__page { color: var(--muted); font-size: 0.72rem; }
  &__page { min-width: 38px; text-align: center; }
}

@media (max-width: 560px) {
  .toolbar-page-controls { right: 6px; gap: 3px; }
  .toolbar-page-controls__summary { display: none; }
}
</style>