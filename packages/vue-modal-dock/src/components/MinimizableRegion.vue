<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
} from 'vue'
import { useMinimizeDock } from '../composables/useModalDock'
import { minimizableRegionInjectionKey } from '../minimizableInjection'

const props = withDefaults(
  defineProps<{
    id: string
    title: string
    persistOnUnmount?: boolean
    restoreRequest?: () => void
  }>(),
  { persistOnUnmount: false, restoreRequest: undefined },
)

const emit = defineEmits<{
  remove: [id: string]
}>()

const manager = useMinimizeDock()
const removed = ref(false)
const id = computed(() => props.id.trim())
const title = computed(() => props.title.trim())
const record = computed(() =>
  manager.items.value.find(candidate => candidate.id === id.value),
)
const minimized = computed(() => record.value?.status === 'minimized')

function register(): void {
  removed.value = false
  manager.register({
    id: id.value,
    title: title.value,
    onRestoreRequest: props.restoreRequest,
    onRemove: removedId => {
      removed.value = true
      emit('remove', removedId)
    },
  })
}

function minimize(): boolean {
  return manager.minimize(id.value)
}

function restore(): boolean {
  return manager.restore(id.value)
}

function remove(): boolean {
  return manager.remove(id.value)
}

provide(minimizableRegionInjectionKey, { id, title, minimize, restore, remove })

onMounted(register)

watch(
  () => [props.id, props.title, props.restoreRequest] as const,
  (current, previous) => {
    if (current[0].trim() !== previous[0].trim()) {
      manager.unregister(previous[0].trim())
    }
    register()
  },
)

onBeforeUnmount(() => {
  if (props.persistOnUnmount) manager.release(id.value)
  else manager.unregister(id.value)
})
</script>

<template>
  <div
    v-show="!minimized && !removed"
    class="vmd-minimizable-region"
    :data-vmd-minimizable-id="id"
  >
    <slot
      :minimized="minimized"
      :minimize="minimize"
      :restore="restore"
      :remove="remove"
    />
  </div>
</template>
