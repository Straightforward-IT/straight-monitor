<script setup lang="ts">
import { computed, provide } from 'vue'
import type { ModalRecord } from '../core/types'
import { dockedModalInjectionKey } from '../dockedModalInjection'
import { useModalDock } from '../composables/useModalDock'

const props = defineProps<{
  modal: ModalRecord
}>()

const manager = useModalDock()
const record = computed(() => props.modal)
const id = computed(() => props.modal.id)
const title = computed(() => props.modal.title)
const status = computed(() => props.modal.status)
const minimized = computed(() => status.value === 'minimized')
const topmost = computed(
  () => manager.openModals.value.at(-1)?.id === props.modal.id,
)

function minimize(): boolean {
  return manager.minimize(id.value)
}

function restore(): boolean {
  return manager.restore(id.value)
}

function remove(): boolean {
  return manager.remove(id.value)
}

provide(dockedModalInjectionKey, {
  record,
  id,
  title,
  status,
  minimized,
  topmost,
  minimize,
  restore,
  remove,
})
</script>

<template>
  <!--
    KeepAlive retains the component instance and its local state. The hosted
    component owns all visual modal chrome; this provider adds none.
  -->
  <KeepAlive>
    <component
      :is="modal.component"
      v-if="modal.status === 'open'"
      :key="modal.id"
      v-bind="modal.props"
    />
  </KeepAlive>
</template>
