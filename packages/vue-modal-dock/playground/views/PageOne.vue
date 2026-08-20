<script setup lang="ts">
import { computed } from 'vue'
import { useDockedModals } from '../../src'
import DemoModal from '../DemoModal.vue'

const modalDock = useDockedModals()
const canCreateMore = computed(() => modalDock.modals.value.length < 20)

function openDemo(): void {
  modalDock.open({
    id: 'foundation-demo',
    title: 'Foundation demo',
    component: DemoModal,
    props: { message: 'The modal is owned by the persistent workspace.' },
  })
}

function createMinimizedModal(): void {
  if (!canCreateMore.value) return

  let sequence = 1
  while (
    modalDock.modals.value.some(modal => modal.id === `minimized-demo-${sequence}`)
  ) {
    sequence += 1
  }
  const id = `minimized-demo-${sequence}`
  modalDock.open({
    id,
    title: `Minimized demo ${sequence}`,
    component: DemoModal,
    props: {
      message: `This is additional minimized modal ${sequence}.`,
    },
  })
  modalDock.minimize(id)
}
</script>

<template>
  <section class="route-card">
    <h2>First route</h2>
    <p>Open a stateful modal, type into it, and minimize it.</p>
    <div class="route-actions">
      <button type="button" @click="openDemo">Open modal</button>
      <button type="button" @click="modalDock.minimize('foundation-demo')">
        Minimize modal
      </button>
      <button
        type="button"
        :disabled="!canCreateMore"
        @click="createMinimizedModal"
      >
        Add minimized modal
      </button>
    </div>
  </section>
</template>
