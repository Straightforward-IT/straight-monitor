<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
  useMinimizeDock,
  useModalDock,
  useModalDockOptions,
} from '../composables/useModalDock'
import { createModalDockThemeStyle } from '../core/theme'
import type { ModalDockTheme } from '../core/types'

interface DockItem {
  readonly key: string
  readonly id: string
  readonly title: string
  readonly source: 'modal' | 'region'
}

const props = defineProps<{
  /** Overrides app-wide plugin theme tokens for this dock instance. */
  theme?: ModalDockTheme
}>()

const modalManager = useModalDock()
const regionManager = useMinimizeDock()
const options = useModalDockOptions()
const minimizedItems = computed<readonly DockItem[]>(() => {
  const modalItems = modalManager.minimizedModals.value.map(modal => ({
    key: `modal:${modal.id}`,
    id: modal.id,
    title: modal.title,
    source: 'modal' as const,
  }))
  const modalIds = new Set(modalItems.map(item => item.id))
  const regionItems = regionManager.minimizedItems.value
    .filter(item => !modalIds.has(item.id))
    .map(item => ({
      key: `region:${item.id}`,
      id: item.id,
      title: item.title,
      source: 'region' as const,
    }))
  return [...modalItems, ...regionItems]
})
const announcement = ref('')
const restoreButtons = new Map<string, HTMLButtonElement>()
const themeStyle = computed(() =>
  createModalDockThemeStyle(options.theme, props.theme),
)

function setRestoreButton(key: string, element: Element | null): void {
  if (element instanceof HTMLButtonElement) restoreButtons.set(key, element)
  else restoreButtons.delete(key)
}

function restore(item: DockItem): void {
  const restored =
    item.source === 'modal'
      ? modalManager.restore(item.id)
      : regionManager.restore(item.id)
  if (!restored) return
  announcement.value = `${item.title} restored.`
}

async function remove(item: DockItem): Promise<void> {
  const index = minimizedItems.value.findIndex(candidate => candidate.key === item.key)
  const removed =
    item.source === 'modal'
      ? modalManager.remove(item.id)
      : regionManager.remove(item.id)
  if (!removed) return

  announcement.value = `${item.title} closed.`
  await nextTick()
  const nextItem = minimizedItems.value[
    Math.min(index, minimizedItems.value.length - 1)
  ]
  if (nextItem) restoreButtons.get(nextItem.key)?.focus()
}
</script>

<template>
  <div
    class="vmd-workspace vmd-headless-workspace"
    :style="themeStyle"
  >
    <Transition name="vmd-dock">
      <nav
        v-if="minimizedItems.length"
        class="vmd-dock"
        aria-label="Minimized items"
      >
        <TransitionGroup name="vmd-dock-item" tag="div" class="vmd-dock__track">
          <div
            v-for="item in minimizedItems"
            :key="item.key"
            class="vmd-dock__item"
          >
            <button
              :ref="element => setRestoreButton(item.key, element as Element | null)"
              class="vmd-dock__restore"
              type="button"
              :aria-label="`Restore ${item.title}`"
              :title="`Restore ${item.title}`"
              @click="restore(item)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="5" width="16" height="14" rx="2" />
              </svg>
              <span>{{ item.title }}</span>
            </button>
            <button
              class="vmd-dock__close"
              type="button"
              :aria-label="`Close ${item.title}`"
              :title="`Close ${item.title}`"
              @click="remove(item)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          </div>
        </TransitionGroup>
        <span class="vmd-visually-hidden" aria-live="polite">
          {{ announcement }}
        </span>
      </nav>
    </Transition>
  </div>
</template>
