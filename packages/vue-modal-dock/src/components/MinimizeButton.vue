<script setup lang="ts">
import { computed, inject } from 'vue'
import {
  useMinimizeDock,
  useModalDock,
  useModalDockOptions,
} from '../composables/useModalDock'
import { createModalDockThemeStyle } from '../core/theme'
import type { ModalDockTheme } from '../core/types'
import { dockedModalInjectionKey } from '../dockedModalInjection'
import { minimizableRegionInjectionKey } from '../minimizableInjection'

const props = defineProps<{
  for?: string
  label?: string
  /** Overrides app-wide plugin theme tokens for this button instance. */
  theme?: ModalDockTheme
}>()

const regionManager = useMinimizeDock()
const modalManager = useModalDock()
const options = useModalDockOptions()
const region = inject(minimizableRegionInjectionKey, null)
const dockedModal = inject(dockedModalInjectionKey, null)
const targetId = computed(
  () => props.for?.trim() || region?.id.value || dockedModal?.id.value || '',
)
const targetTitle = computed(
  () =>
    regionManager.get(targetId.value)?.title ||
    modalManager.get(targetId.value)?.title ||
    region?.title.value ||
    dockedModal?.title.value ||
    'item',
)
const accessibleLabel = computed(
  () => props.label?.trim() || `Minimize ${targetTitle.value}`,
)
const themeStyle = computed(() =>
  createModalDockThemeStyle(options.theme, props.theme),
)

function minimize(): void {
  if (!targetId.value) {
    throw new Error(
      'MinimizeButton requires a for prop or a parent MinimizableRegion.',
    )
  }

  if (props.for?.trim()) {
    if (regionManager.minimize(targetId.value)) return
    modalManager.minimize(targetId.value)
    return
  }

  if (region) {
    region.minimize()
    return
  }

  dockedModal?.minimize()
}
</script>

<template>
  <button
    class="vmd-minimize-button"
    type="button"
    :aria-label="accessibleLabel"
    :title="accessibleLabel"
    :style="themeStyle"
    @click="minimize"
  >
    <slot>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17h14" />
      </svg>
    </slot>
  </button>
</template>
