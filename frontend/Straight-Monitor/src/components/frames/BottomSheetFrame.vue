<template>
  <Teleport to="body">
    <Transition name="bsf">
      <div v-if="modelValue" class="bsf-backdrop" @click.self="onBackdrop">
        <section ref="sheetRef" class="bsf-sheet" role="dialog" aria-modal="true" tabindex="-1">
          <div class="bsf-sheet__handle" />
          <header v-if="hasHeader" class="bsf-sheet__header">
            <div class="bsf-sheet__heading">
              <slot name="header">
                <h3 v-if="title">{{ title }}</h3>
                <span v-if="subtitle" class="bsf-sheet__subtitle">{{ subtitle }}</span>
              </slot>
            </div>
            <button v-if="showClose" type="button" class="bsf-sheet__close" aria-label="Schließen" @click="close">
              <font-awesome-icon icon="fa-solid fa-xmark" />
            </button>
          </header>
          <div class="bsf-sheet__body"><slot /></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch, useSlots } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  showClose: { type: Boolean, default: true },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEscape: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue', 'close']);
const slots = useSlots();
const sheetRef = ref(null);
const hasHeader = computed(() => props.title || props.subtitle || slots.header || props.showClose);

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function onBackdrop() {
  if (props.closeOnBackdrop) close();
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.closeOnEscape && props.modelValue) close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onKeydown);
      nextTick(() => sheetRef.value?.focus());
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped lang="scss">
.bsf-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.4);
}

.bsf-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 88vh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow: hidden;
  border-radius: 16px 16px 0 0;
  background: var(--surface, #fff);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
}

.bsf-sheet__handle { width: 36px; height: 4px; flex-shrink: 0; margin: 8px auto 4px; border-radius: 2px; background: rgba(0, 0, 0, 0.15); }
.bsf-sheet__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 16px 10px; border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06)); }
.bsf-sheet__heading { min-width: 0; }
.bsf-sheet__heading h3 { margin: 0; color: var(--text, #222); font-size: 1rem; font-weight: 600; }
.bsf-sheet__subtitle { display: block; margin-top: 2px; color: var(--text-muted, #888); font-size: 0.78rem; }
.bsf-sheet__close { width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--text-muted, #888); cursor: pointer; }
.bsf-sheet__close:active { background: rgba(0, 0, 0, 0.05); }
.bsf-sheet__body { display: flex; flex: 1; flex-direction: column; gap: 8px; min-height: 0; padding: 12px 16px 20px; overflow-y: auto; }

.bsf-enter-active, .bsf-leave-active { transition: opacity 0.2s ease; }
.bsf-enter-active .bsf-sheet, .bsf-leave-active .bsf-sheet { transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
.bsf-enter-from, .bsf-leave-to { opacity: 0; }
.bsf-enter-from .bsf-sheet, .bsf-leave-to .bsf-sheet { transform: translateY(100%); }
</style>