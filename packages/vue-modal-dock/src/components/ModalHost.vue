<script setup lang="ts">
import { useModalDock } from '../composables/useModalDock'
import ModalFrame from './ModalFrame.vue'

const manager = useModalDock()
const modals = manager.modals
</script>

<template>
  <div class="vmd-host" aria-label="Open modal windows">
    <ModalFrame
      v-for="(modal, index) in modals"
      :key="modal.id"
      :modal="modal"
      :minimized="modal.status === 'minimized'"
      :stack-index="index"
      @minimize="manager.minimize"
      @remove="manager.remove"
    >
      <component :is="modal.component" v-bind="modal.props" />
    </ModalFrame>
  </div>
</template>
