<template>
  <div class="tooltip-container">
    <div
      ref="triggerRef"
      class="tooltip-trigger"
      tabindex="-1"
      @mouseenter="scheduleShow"
      @mouseleave="scheduleHide"
      @focusin="scheduleShow"
      @focusout="scheduleHide"
      @keydown.esc.prevent="forceHide"
    >
      <slot />

      <transition name="tooltip-fade">
        <template v-if="isVisible">
          <!-- Normale Variante -->
          <div
            v-if="!teleportToBody"
            class="tooltip"
            :class="[position, { interactive }]"
            role="tooltip"
          >
            <slot name="content">
              {{ text }}
            </slot>
          </div>

          <!-- Teleport Variante -->
          <teleport v-else to="body">
            <div
              class="tooltip global"
              :class="[position, { interactive }]"
              role="tooltip"
              :style="{
                position: 'fixed',
                top: coords.top + 'px',
                left: coords.left + 'px',
                transform: transformBy(position)
              }"
            >
              <slot name="content">
                {{ text }}
              </slot>
            </div>
          </teleport>
        </template>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
  position: {
    type: String,
    default: 'top',
    validator: v => ['top', 'bottom', 'left', 'right'].includes(v),
  },
  delayIn: { type: Number, default: 500 },
  delayOut: { type: Number, default: 120 },
  teleportToBody: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
})

const isVisible = ref(false)
const coords = ref({ top: 0, left: 0 })
const triggerRef = ref(null)
let inTimer = null
let outTimer = null

const scheduleShow = () => {
  clearTimeout(outTimer)
  clearTimeout(inTimer)
  inTimer = setTimeout(() => {
    if (props.teleportToBody) {
      if (triggerRef.value) {
        const r = triggerRef.value.getBoundingClientRect()
        const offset = 8
        let top = r.top - offset
        let left = r.left + r.width / 2
        if (props.position === 'bottom') top = r.bottom + offset
        if (props.position === 'left') {
          top = r.top + r.height / 2
          left = r.left - offset
        }
        if (props.position === 'right') {
          top = r.top + r.height / 2
          left = r.right + offset
        }
        coords.value = { top, left }
      }
    }
    isVisible.value = true
  }, props.delayIn)
}

const scheduleHide = () => {
  clearTimeout(inTimer)
  clearTimeout(outTimer)
  outTimer = setTimeout(() => {
    isVisible.value = false
  }, props.delayOut)
}

const forceHide = () => {
  clearTimeout(inTimer)
  clearTimeout(outTimer)
  isVisible.value = false
}

onBeforeUnmount(() => {
  clearTimeout(inTimer)
  clearTimeout(outTimer)
})

const transformBy = pos => {
  if (pos === 'top') return 'translate(-50%, -100%)'
  if (pos === 'bottom') return 'translate(-50%, 0)'
  if (pos === 'left') return 'translate(-100%, -50%)'
  if (pos === 'right') return 'translate(0, -50%)'
  return 'translate(-50%, -100%)'
}
</script>

<style scoped lang="scss">
.tooltip-container {
  display: inline-block;
  position: relative;
}
.tooltip-trigger {
  display: inline-block;
}

.tooltip {
  position: absolute;
  z-index: 1000;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--c-text-primary);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  user-select: none;
  pointer-events: none; /* blockt Maus */

  &.interactive {
    pointer-events: auto; /* erlaubt Klicks */
  }

  &.top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }
  &.bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }
  &.left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }
  &.right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }

  &.global {
    z-index: 9999;
  }
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
