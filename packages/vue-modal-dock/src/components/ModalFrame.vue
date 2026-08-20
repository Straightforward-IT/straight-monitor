<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import type { ModalRecord } from '../core/types'

const props = withDefaults(
  defineProps<{
    modal: ModalRecord
    minimized?: boolean
    stackIndex?: number
  }>(),
  {
    minimized: false,
    stackIndex: 0,
  },
)

const emit = defineEmits<{
  minimize: [id: string]
  remove: [id: string]
}>()

const frameRef = ref<HTMLElement | null>(null)
const instanceId = getCurrentInstance()?.uid ?? props.modal.id
const titleId = `vmd-modal-title-${instanceId}`

async function focusFrame(): Promise<void> {
  await nextTick()
  frameRef.value?.focus()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  emit('remove', props.modal.id)
}

watch(
  () => props.minimized,
  minimized => {
    if (!minimized) void focusFrame()
  },
)

onMounted(() => {
  if (!props.minimized) void focusFrame()
})
</script>

<template>
  <section
    v-show="!minimized"
    ref="frameRef"
    class="vmd-frame"
    :style="{
      '--vmd-stack-index': stackIndex,
      '--vmd-stack-offset': `${Math.min(stackIndex, 5) * 12}px`,
    }"
    role="dialog"
    :aria-labelledby="titleId"
    tabindex="-1"
    @keydown="handleKeydown"
    @pointerdown.self="frameRef?.focus()"
  >
    <h2 :id="titleId" class="vmd-visually-hidden">{{ modal.title }}</h2>

    <div class="vmd-frame__actions" aria-label="Modal controls">
      <button
        class="vmd-icon-button"
        type="button"
        :aria-label="`Minimize ${modal.title}`"
        :title="`Minimize ${modal.title}`"
        @click="emit('minimize', modal.id)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 17h14" />
        </svg>
      </button>
      <button
        class="vmd-icon-button"
        type="button"
        :aria-label="`Close ${modal.title}`"
        :title="`Close ${modal.title}`"
        @click="emit('remove', modal.id)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <div class="vmd-frame__content">
      <slot />
    </div>
  </section>
</template>
