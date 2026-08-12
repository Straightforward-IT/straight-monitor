<template>
  <Transition name="public-bottom-sheet">
    <div
      v-if="modelValue"
      class="public-bottom-sheet"
      @click.self="closeOnBackdrop && close()"
    >
      <section
        class="public-bottom-sheet__sheet"
        :class="sheetClass"
        role="dialog"
        aria-modal="true"
      >
        <div class="public-bottom-sheet__handle" aria-hidden="true"></div>
        <slot />
      </section>
    </div>
  </Transition>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  sheetClass: { type: [String, Array, Object], default: '' },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEscape: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue']);

function close() {
  emit('update:modelValue', false);
}

function handleKeydown(event) {
  if (props.modelValue && props.closeOnEscape && event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<style scoped>
.public-bottom-sheet {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.45);
}

.public-bottom-sheet__sheet {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem calc(2rem + env(safe-area-inset-bottom));
  border-radius: 20px 20px 0 0;
  background: var(--panel);
}

.public-bottom-sheet__handle {
  width: 36px;
  height: 4px;
  margin-bottom: 0.25rem;
  border-radius: 4px;
  background: var(--border);
}

.public-bottom-sheet-enter-active {
  transition: opacity 0.2s;
}

.public-bottom-sheet-leave-active {
  transition: opacity 0.15s;
}

.public-bottom-sheet-enter-from,
.public-bottom-sheet-leave-to {
  opacity: 0;
}

.public-bottom-sheet-enter-active .public-bottom-sheet__sheet {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.public-bottom-sheet-leave-active .public-bottom-sheet__sheet {
  transition: transform 0.2s ease-in;
}

.public-bottom-sheet-enter-from .public-bottom-sheet__sheet,
.public-bottom-sheet-leave-to .public-bottom-sheet__sheet {
  transform: translateY(100%);
}
</style>
