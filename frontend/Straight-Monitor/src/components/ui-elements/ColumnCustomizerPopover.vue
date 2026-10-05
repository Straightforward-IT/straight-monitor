<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="column-customizer-overlay"
      @pointerdown.self="close"
    >
      <section
        ref="panelRef"
        class="column-customizer"
        :style="{ top: `${anchor.y}px`, left: `${anchor.x}px` }"
        role="dialog"
        :aria-label="title"
        tabindex="-1"
        @keydown.esc.stop.prevent="close"
      >
        <header class="column-customizer__header">
          <span>{{ title }}</span>
          <AppIconButton
            variant="ghost"
            size="sm"
            :label="`${title} schließen`"
            @click="close"
          >
            <FontAwesomeIcon :icon="faXmark" />
          </AppIconButton>
        </header>

        <p v-if="!columns.length" class="column-customizer__empty">Keine Spalten verfügbar.</p>
        <div v-for="(column, index) in columns" :key="column.id" class="column-customizer__row">
          <label class="column-customizer__label">
            <input
              type="checkbox"
              :checked="column.visible"
              @change="emit('toggle', column.id)"
            >
            {{ column.label }}
          </label>
          <div class="column-customizer__order">
            <AppIconButton
              variant="ghost"
              size="sm"
              :label="`${column.label} nach oben`"
              :disabled="index === 0"
              @click="emit('move', index, -1)"
            >
              <FontAwesomeIcon :icon="faArrowUp" />
            </AppIconButton>
            <AppIconButton
              variant="ghost"
              size="sm"
              :label="`${column.label} nach unten`"
              :disabled="index === columns.length - 1"
              @click="emit('move', index, 1)"
            >
              <FontAwesomeIcon :icon="faArrowDown" />
            </AppIconButton>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowDown, faArrowUp, faXmark } from '@fortawesome/free-solid-svg-icons';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Spalten anpassen' },
  columns: { type: Array, default: () => [] },
  anchor: { type: Object, default: () => ({ x: 0, y: 0 }) },
  returnFocusTo: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'toggle', 'move']);
const panelRef = ref(null);

function close() {
  emit('update:modelValue', false);
}

watch(() => props.modelValue, async (open) => {
  await nextTick();
  if (open) panelRef.value?.focus();
  else props.returnFocusTo?.focus?.();
});
</script>

<style scoped lang="scss">
.column-customizer-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover, 9000);
}

.column-customizer {
  position: fixed;
  min-width: 240px;
  max-width: min(360px, calc(100vw - 24px));
  padding: 4px 0;
  transform: translateX(-100%);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--modal-bg);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.14);
  outline: none;
}

.column-customizer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px 6px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.column-customizer__header .app-icon-button,
.column-customizer__order .app-icon-button {
  --action-ghost-text: var(--muted);
  --app-button-icon-size: 28px;
  min-height: 28px;
}

.column-customizer__empty {
  margin: 0;
  padding: 10px 14px;
  color: var(--muted);
  font-size: 0.82rem;
}

.column-customizer__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 8px 5px 14px;
}
.column-customizer__row:hover { background: var(--hover); }

.column-customizer__label {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text);
  cursor: pointer;
  font-size: 0.85rem;
}
.column-customizer__label input { width: 14px; height: 14px; accent-color: var(--primary); cursor: pointer; }
.column-customizer__order { display: flex; gap: 2px; }

@media (max-width: 768px) {
  .column-customizer {
    inset: auto 0 0;
    width: 100vw;
    max-width: none;
    max-height: 80dvh;
    box-sizing: border-box;
    overflow-y: auto;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    transform: none;
    border-radius: 16px 16px 0 0;
  }
}
</style>
