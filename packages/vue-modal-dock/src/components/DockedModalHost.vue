<script setup lang="ts">
import { useModalDock } from '../composables/useModalDock'
import DockedModalInstance from './DockedModalInstance.vue'

const manager = useModalDock()
const modals = manager.modals
</script>

<template>
  <DockedModalInstance
    v-for="modal in modals"
    :key="modal.id"
    :modal="modal"
  />
</template>
