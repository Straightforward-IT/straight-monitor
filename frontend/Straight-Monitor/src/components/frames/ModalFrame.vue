<template>
  <component
    :is="PassThrough"
    v-if="open"
  >
    <Teleport
      to="body"
      :disabled="canMinimize && !teleport"
    >
      <Transition
        name="mf"
        :appear="minimizable"
      >
        <div
          v-if="open"
          ref="overlayRef"
          class="mf-overlay"
          :class="{ 'mf-overlay--elevated': layer === 'elevated', 'mf-overlay--full-bleed': fullBleed }"
          @mousedown.self="onBackdrop"
        >
          <section
            ref="dialogRef"
            class="mf-dialog"
            :class="[`mf-dialog--${size}`, { 'mf-dialog--full-bleed': fullBleed }]"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="title ? titleId : undefined"
            v-bind="$attrs"
          >
            <header
              v-if="hasHeader"
              class="mf-header"
            >
              <div class="mf-header-main">
                <slot
                  name="header"
                  :title-id="titleId"
                >
                  <div class="mf-titles">
                    <p
                      v-if="subtitle"
                      class="mf-subtitle"
                    >
                      {{ subtitle }}
                    </p>
                    <h3
                      v-if="title"
                      :id="titleId"
                      class="mf-title"
                    >
                      {{ title }}
                    </h3>
                  </div>
                </slot>
              </div>
              <div
                class="mf-controls"
                data-pdf-ignore
              >
                <slot name="actions" />
                <CustomTooltip
                  v-if="pdfExport"
                  text="Als PDF exportieren"
                >
                  <AppIconButton
                    class="mf-pdf"
                    variant="ghost"
                    size="sm"
                    label="Als PDF exportieren"
                    @click="exportToPdf()"
                  >
                    <font-awesome-icon icon="fa-solid fa-file-pdf" />
                  </AppIconButton>
                </CustomTooltip>
                <CustomTooltip
                  v-if="canMinimize"
                  text="Minimieren"
                >
                  <MinimizeButton class="mf-minimize" />
                </CustomTooltip>
                <CustomTooltip
                  v-if="showClose"
                  text="Schließen"
                >
                  <AppIconButton
                    class="mf-close"
                    variant="ghost"
                    size="sm"
                    label="Schließen"
                    @click="requestClose"
                  >
                    <font-awesome-icon icon="fa-solid fa-xmark" />
                  </AppIconButton>
                </CustomTooltip>
              </div>
            </header>
            <!-- Header-less minimizable modals (content renders its own header) -->
            <MinimizeButton
              v-else-if="canMinimize"
              class="mf-minimize mf-minimize--floating"
              data-pdf-ignore
            />

            <div class="mf-body">
              <slot />
            </div>

            <footer
              v-if="$slots.footer"
              class="mf-footer"
            >
              <slot name="footer" />
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </component>
</template>

<script>
import {
  MinimizeButton,
  useCurrentDockedModal,
} from '@bleck-it/vue-modal-dock';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faXmark, faFilePdf } from '@fortawesome/free-solid-svg-icons';

library.add(faXmark, faFilePdf);

// Renders its slot without a wrapper element (non-minimizable branch)
const PassThrough = (_, { slots }) => slots.default?.();
PassThrough.inheritAttrs = false;

// Shared across all frame instances
let uidCounter = 0;
const openStack = [];
let lockCount = 0;
</script>

<script setup>
import {
  computed,
  ref,
  watch,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  useSlots,
} from 'vue';
import { exportElementToPdf } from '@/utils/htmlToPdfService';
import CustomTooltip from '@/components/CustomTooltip.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  /** Visibility. Defaults to true so parents can also mount/unmount via v-if. */
  modelValue: { type: Boolean, default: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  /** Max-width preset; fine-tune via --mf-max-width. */
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'xl', 'full'].includes(v),
  },
  /** 'elevated' stacks above regular modals (nested dialogs). */
  layer: {
    type: String,
    default: 'base',
    validator: (v) => ['base', 'elevated'].includes(v),
  },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEscape: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  lockScroll: { type: Boolean, default: true },
  /** Opt-in integration with @bleck-it/vue-modal-dock. */
  minimizable: { type: Boolean, default: false },
  minimizeId: { type: String, default: '' },
  minimizeTitle: { type: String, default: '' },
  /** Shows a PDF export button in the header controls. */
  pdfExport: { type: Boolean, default: false },
  /** Renders a minimizable modal above app-shell stacking contexts. */
  teleport: { type: Boolean, default: false },
  /** Removes the overlay inset and fills the available viewport. */
  fullBleed: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'close']);
const slots = useSlots();
const dockedModal = useCurrentDockedModal();

const uid = `mf-${++uidCounter}`;
const titleId = `${uid}-title`;

const overlayRef = ref(null);
const dialogRef = ref(null);
const open = computed(() => props.modelValue !== false);
const canMinimize = computed(() => props.minimizable && !!dockedModal);
if (import.meta.env.DEV && props.minimizable && !dockedModal) {
  console.warn('Dockable ModalFrame must be opened through the global modal host.');
}

/** Export the whole modal content as a readable, text-selectable PDF. */
async function exportToPdf(options = {}) {
  if (!dialogRef.value) return;
  await exportElementToPdf(dialogRef.value, {
    title: props.title || props.minimizeTitle || 'Dokument',
    ...options,
  });
}

defineExpose({ exportToPdf });

const hasHeader = computed(
  () =>
    !!(props.title || props.subtitle || slots.header || slots.actions || props.showClose)
);

const releaseCloseHandler = canMinimize.value
  ? dockedModal.setCloseHandler(requestClose)
  : undefined;
onBeforeUnmount(() => releaseCloseHandler?.());

function requestClose() {
  emit('update:modelValue', false);
  emit('close');
}

function onBackdrop() {
  if (props.closeOnBackdrop) requestClose();
}

/* ── Escape handling + scroll lock (shared across all frames) ── */
function isVisible() {
  return overlayRef.value && overlayRef.value.getClientRects().length > 0;
}

function onKeydown(e) {
  if (e.key !== 'Escape' || !props.closeOnEscape || !open.value) return;
  if (openStack[openStack.length - 1] !== uid) return;
  if (!isVisible()) return;
  requestClose();
}

let didLock = false;

function lockBodyScroll() {
  if (didLock) return;
  if (++lockCount === 1) document.body.style.overflow = 'hidden';
  didLock = true;
}

function unlockBodyScroll() {
  if (!didLock) return;
  didLock = false;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = '';
}

function deactivateFrame() {
  const idx = openStack.indexOf(uid);
  if (idx !== -1) openStack.splice(idx, 1);
  window.removeEventListener('keydown', onKeydown);
  unlockBodyScroll();
}

function activateFrame() {
  if (!open.value) return;
  const existingIndex = openStack.indexOf(uid);
  if (existingIndex !== -1) openStack.splice(existingIndex, 1);
  openStack.push(uid);
  window.addEventListener('keydown', onKeydown);
  // Minimizable modals keep the page usable while docked, so no scroll lock
  if (props.lockScroll && !props.minimizable) lockBodyScroll();
}

watch(open, val => (val ? activateFrame() : deactivateFrame()), {
  immediate: true,
});

// DockedModalHost uses KeepAlive: deactivated frames leave the active stack,
// restored frames return at the top without losing component state.
onActivated(activateFrame);
onDeactivated(deactivateFrame);
onBeforeUnmount(deactivateFrame);
</script>

<style scoped lang="scss">
.mf-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--mf-z, var(--z-modal, 1000));
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--mf-overlay-padding, 20px);
  background: var(--mf-overlay-bg, var(--overlay, rgba(0, 0, 0, 0.45)));
}

.mf-overlay--elevated {
  --mf-z: var(--z-modal-elevated, 1500);
}

.mf-overlay--full-bleed {
  align-items: stretch;
  padding: 0;
}

.mf-dialog {
  --mf-max-width: 640px;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--mf-max-width);
  max-height: var(--mf-max-height, 90vh);
  background: var(--mf-surface, var(--modal-bg, #fff));
  color: var(--mf-text, var(--text, #222));
  border: var(--mf-border, none);
  border-radius: var(--mf-radius, 12px);
  box-shadow: var(--mf-shadow, 0 20px 60px rgba(0, 0, 0, 0.3));
  overflow: hidden;
  overscroll-behavior: contain;
}

.mf-dialog--sm   { --mf-max-width: 440px; }
.mf-dialog--md   { --mf-max-width: 640px; }
.mf-dialog--lg   { --mf-max-width: 900px; }
.mf-dialog--xl   { --mf-max-width: min(1200px, 92vw); }
.mf-dialog--full {
  --mf-max-width: 96vw;
  --mf-max-height: 94vh;
  height: var(--mf-max-height);
}

.mf-dialog--full-bleed {
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  border-radius: 0;
  box-shadow: none;
}

.mf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: var(--mf-header-padding, 16px 20px);
  border-bottom: var(--mf-header-border, 1px solid var(--border, #d1d1d1));
}

.mf-header-main {
  min-width: 0;
  flex: 1;
}

.mf-subtitle {
  display: var(--mf-subtitle-display, block);
  margin: 0 0 2px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--mf-text-muted, var(--muted, #666));
}

.mf-title {
  margin: 0;
  font-size: var(--mf-title-size, 1.1rem);
  font-weight: 600;
  color: inherit;
  line-height: 1.3;
}

.mf-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.mf-close,
.mf-pdf {
  --app-button-icon-size: 32px;
  --action-ghost-text: var(--mf-text-muted, var(--muted, #666));
  width: 32px;
  height: 32px;
  min-height: 32px;
  font-size: 1rem;
}

.mf-close {
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  box-shadow: none;
  color: var(--mf-text-muted, var(--muted, #666));

  &:hover:not(:disabled) {
    color: var(--action-accent-text, var(--text));
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    border-color: color-mix(in srgb, var(--primary) 30%, transparent);
  }

  &:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--primary) 48%, transparent);
    outline-offset: 2px;
  }
}

.mf-controls .mf-minimize {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  box-shadow: none;
  backdrop-filter: none;
  font-size: 1rem;
  color: var(--mf-text-muted, var(--muted, #666));
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: var(--action-accent-text, var(--text));
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    border-color: color-mix(in srgb, var(--primary) 30%, transparent);
  }
}

.mf-minimize--floating {
  position: absolute;
  top: var(--mf-minimize-top, 16px);
  right: var(--mf-minimize-right, 16px);
  z-index: 2;
  background: none;
  border-color: transparent;
  box-shadow: none;
  backdrop-filter: none;
  color: var(--mf-text-muted, var(--muted, #666));
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: var(--action-accent-text, var(--text));
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    border-color: color-mix(in srgb, var(--primary) 30%, transparent);
  }
}

.mf-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: var(--mf-body-overflow, auto);
  padding: var(--mf-body-padding, 20px);
}

.mf-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
  padding: var(--mf-footer-padding, 14px 20px);
  border-top: var(--mf-footer-border, 1px solid var(--border, #d1d1d1));
}

/* Transition: fade backdrop + scale panel */
.mf-enter-active {
  transition: opacity 0.22s ease;

  .mf-dialog {
    transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

.mf-leave-active {
  transition: opacity 0.15s ease;
}

.mf-enter-from {
  opacity: 0;

  .mf-dialog {
    transform: scale(0.96) translateY(8px);
  }
}

.mf-leave-to {
  opacity: 0;
}
</style>
