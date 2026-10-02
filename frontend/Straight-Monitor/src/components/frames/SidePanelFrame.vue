<template>
  <Transition name="sp">
    <aside
      v-if="modelValue && presentation === 'panel'"
      ref="panelRef"
      class="sp-panel"
      :style="{ '--sp-width': width }"
      role="complementary"
      :aria-labelledby="title ? titleId : undefined"
      tabindex="-1"
      v-bind="$attrs"
    >
      <header
        v-if="hasHeader"
        class="sp-panel__header"
      >
        <div class="sp-panel__heading">
          <slot
            name="header"
            :title-id="titleId"
          >
            <h2
              v-if="title"
              :id="titleId"
              class="sp-panel__title"
            >
              {{ title }}
            </h2>
            <p
              v-if="subtitle"
              class="sp-panel__subtitle"
            >
              {{ subtitle }}
            </p>
          </slot>
        </div>
        <div class="sp-panel__actions">
          <slot name="actions" />
          <CustomTooltip
            v-if="showClose"
            text="Schließen"
          >
            <AppIconButton
              variant="ghost"
              size="sm"
              class="sp-panel__close"
              label="Schließen"
              @click="close"
            >
              <font-awesome-icon icon="fa-solid fa-xmark" />
            </AppIconButton>
          </CustomTooltip>
        </div>
      </header>
      <div class="sp-panel__body">
        <slot />
      </div>
    </aside>
  </Transition>

  <ModalFrame
    v-if="modelValue && presentation === 'modal'"
    :model-value="modelValue"
    :size="modalSize"
    :title="modalTitle || title"
    :aria-labelledby="modalTitle || title ? titleId : undefined"
    :show-close="showClose"
    :close-on-backdrop="closeOnBackdrop"
    :close-on-escape="closeOnEscape"
    :minimizable="modalMinimizable"
    :minimize-title="modalTitle || title"
    v-bind="$attrs"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('close')"
  >
    <template #header>
      <slot
        name="header"
        :title-id="titleId"
      >
        <h2
          v-if="modalTitle || title"
          :id="titleId"
          class="sp-panel__title"
        >
          {{ modalTitle || title }}
        </h2>
        <p
          v-if="subtitle"
          class="sp-panel__subtitle"
        >
          {{ subtitle }}
        </p>
      </slot>
    </template>
    <template #actions>
      <slot name="actions" />
    </template>
    <slot />
    <template
      v-if="$slots['modal-footer']"
      #footer
    >
      <slot name="modal-footer" />
    </template>
  </ModalFrame>

  <Teleport to="body">
    <div
      v-if="modelValue && presentation === 'panel'"
      class="sp-panel__backdrop"
      aria-hidden="true"
      @click="onBackdrop"
    />
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch, useSlots } from 'vue';
import ModalFrame from './ModalFrame.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

  defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  width: { type: String, default: '420px' },
  presentation: {
    type: String,
    default: 'panel',
    validator: (value) => ['panel', 'modal'].includes(value),
  },
  modalSize: { type: String, default: 'lg' },
  modalTitle: { type: String, default: '' },
  modalMinimizable: { type: Boolean, default: false },
  showClose: { type: Boolean, default: true },
  closeOnEscape: { type: Boolean, default: true },
  closeOnBackdrop: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue', 'update:presentation', 'close']);
const slots = useSlots();
const panelRef = ref(null);
const titleId = `side-panel-${Math.random().toString(36).slice(2)}-title`;
const hasHeader = computed(() => props.title || props.subtitle || slots.header || slots.actions || props.showClose);

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function onBackdrop() {
  if (props.closeOnBackdrop) close();
}

function onKeydown(event) {
  if (Array.from(document.querySelectorAll('.mf-overlay')).some(overlay => overlay.getClientRects().length)) return;
  if (event.key === 'Escape' && props.closeOnEscape && props.modelValue && props.presentation === 'panel') close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onKeydown);
      nextTick(() => panelRef.value?.focus({ preventScroll: true }));
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped lang="scss">
.sp-panel {
  position: sticky;
  top: 0;
  display: flex;
  flex: 0 0 var(--sp-width);
  flex-direction: column;
  width: var(--sp-width);
  height: calc(100vh - 48px);
  min-height: 0;
  margin-left: 14px;
  overflow: hidden;
  background: var(--tile-bg);
  border: 1px solid color-mix(in oklab, var(--border) 88%, var(--text));
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.sp-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.sp-panel__heading { min-width: 0; flex: 1; }
.sp-panel__title { margin: 0; color: var(--text); font-size: 1.1rem; }
.sp-panel__subtitle { margin: 3px 0 0; color: var(--muted); font-size: 0.8rem; }
.sp-panel__actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.sp-panel__close {
  --app-button-icon-size: 32px;
  min-height: 32px;
  height: 32px;
}

.sp-panel__body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; }
.sp-panel__backdrop { display: none; }

.sp-enter-active, .sp-leave-active { transition: flex-basis 0.3s cubic-bezier(0.25, 1, 0.5, 1), width 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease; }
.sp-enter-from, .sp-leave-to { flex-basis: 0; width: 0; margin-left: 0; opacity: 0; }

@media (max-width: 1200px) {
  .sp-panel { --sp-width: min(var(--sp-width), 350px); }
}

@media (max-width: 768px) {
  .sp-panel { position: fixed; z-index: 100; top: 0; right: 0; width: 100%; height: 100%; margin-left: 0; border-radius: 0; }
  .sp-panel__backdrop { position: fixed; inset: var(--header-h, 56px) 0 0; z-index: 99; display: block; background: rgba(0, 0, 0, 0.4); }
  .sp-enter-from, .sp-leave-to { transform: translateX(100%); width: 100%; }
  .sp-enter-active, .sp-leave-active { transition: transform 0.25s ease, opacity 0.2s ease; }
}
</style>
