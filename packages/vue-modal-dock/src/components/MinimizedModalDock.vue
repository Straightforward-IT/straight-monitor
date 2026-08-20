<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useModalDock } from '../composables/useModalDock'

const manager = useModalDock()
const minimizedModals = manager.minimizedModals
const announcement = ref('')
const restoreButtons = new Map<string, HTMLButtonElement>()

function setRestoreButton(id: string, element: Element | null): void {
  if (element instanceof HTMLButtonElement) restoreButtons.set(id, element)
  else restoreButtons.delete(id)
}

function restore(id: string, title: string): void {
  if (!manager.restore(id)) return
  announcement.value = `${title} restored.`
}

async function remove(id: string, title: string): Promise<void> {
  const index = minimizedModals.value.findIndex(modal => modal.id === id)
  if (!manager.remove(id)) return

  announcement.value = `${title} closed.`
  await nextTick()
  const nextModal = minimizedModals.value[
    Math.min(index, minimizedModals.value.length - 1)
  ]
  if (nextModal) restoreButtons.get(nextModal.id)?.focus()
}
</script>

<template>
  <Transition name="vmd-dock">
    <nav
      v-if="minimizedModals.length"
      class="vmd-dock"
      aria-label="Minimized modals"
    >
      <TransitionGroup name="vmd-dock-item" tag="div" class="vmd-dock__track">
        <div
          v-for="modal in minimizedModals"
          :key="modal.id"
          class="vmd-dock__item"
        >
          <button
            :ref="element => setRestoreButton(modal.id, element as Element | null)"
            class="vmd-dock__restore"
            type="button"
            :aria-label="`Restore ${modal.title}`"
            :title="`Restore ${modal.title}`"
            @click="restore(modal.id, modal.title)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" rx="2" />
            </svg>
            <span>{{ modal.title }}</span>
          </button>
          <button
            class="vmd-dock__close"
            type="button"
            :aria-label="`Close ${modal.title}`"
            :title="`Close ${modal.title}`"
            @click="remove(modal.id, modal.title)"
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
</template>
