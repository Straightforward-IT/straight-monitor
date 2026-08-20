<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useModalDockOptions } from '../composables/useModalDock'
import { createModalDockThemeStyle } from '../core/theme'
import type { ModalDockTheme } from '../core/types'
import MinimizedModalDock from './MinimizedModalDock.vue'
import ModalHost from './ModalHost.vue'

const props = defineProps<{
  teleportTo?: string
  /** Overrides app-wide plugin theme tokens for this workspace instance. */
  theme?: ModalDockTheme
}>()

const options = useModalDockOptions()
const mounted = ref(false)
const target = computed(() => props.teleportTo?.trim() || options.teleportTo)
const themeStyle = computed(() =>
  createModalDockThemeStyle(options.theme, props.theme),
)

onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <Teleport v-if="mounted" :to="target">
    <div
      class="vmd-workspace"
      :style="themeStyle"
      data-vue-modal-dock-workspace
    >
      <ModalHost />
      <MinimizedModalDock />
    </div>
  </Teleport>
</template>
