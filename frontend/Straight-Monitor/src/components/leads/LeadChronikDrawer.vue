<template>
  <transition name="chronik-drawer-slide">
    <aside
      v-if="show"
      class="chronik-drawer"
      :class="{ 'chronik-drawer--collapsed': collapsed, 'chronik-drawer--with-sidebar': sidebarOpen }"
      :style="!collapsed ? { height: height + 'px' } : null"
    >
      <header class="cd-header" @click="collapsed = !collapsed">
        <div
          class="cd-resize-handle"
          v-if="!collapsed"
          @mousedown.stop="startResize"
          @click.stop
          title="Größe ändern"
        ></div>
        <div class="cd-title">
          <font-awesome-icon :icon="['fas', 'clock-rotate-left']" />
          <strong>Chronik</strong>
          <span v-if="count != null" class="cd-count">{{ count }}</span>
          <span v-if="leadTitle" class="cd-lead-title">— {{ leadTitle }}</span>
        </div>
        <div class="cd-actions">
          <button class="cd-icon-btn" :title="collapsed ? 'Ausklappen' : 'Einklappen'" @click.stop="collapsed = !collapsed">
            <font-awesome-icon :icon="['fas', collapsed ? 'chevron-up' : 'chevron-down']" />
          </button>
          <button class="cd-icon-btn" title="Schließen" @click.stop="$emit('close')">
            <font-awesome-icon :icon="['fas', 'xmark']" />
          </button>
        </div>
      </header>
      <div v-if="!collapsed" class="cd-body">
        <slot />
      </div>
    </aside>
  </transition>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faClockRotateLeft, faChevronUp, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';

library.add(faClockRotateLeft, faChevronUp, faChevronDown, faXmark);

const props = defineProps({
  show: { type: Boolean, default: false },
  sidebarOpen: { type: Boolean, default: false },
  count: { type: Number, default: null },
  leadTitle: { type: String, default: '' },
});
defineEmits(['close']);

const STORAGE_KEY_HEIGHT = 'leads_chronik_drawer_height';
const STORAGE_KEY_COLLAPSED = 'leads_chronik_drawer_collapsed';

const height = ref(parseInt(localStorage.getItem(STORAGE_KEY_HEIGHT) || '320', 10));
const collapsed = ref(localStorage.getItem(STORAGE_KEY_COLLAPSED) === '1');

watch(height, v => localStorage.setItem(STORAGE_KEY_HEIGHT, String(v)));
watch(collapsed, v => localStorage.setItem(STORAGE_KEY_COLLAPSED, v ? '1' : '0'));

let dragging = false;
let startY = 0;
let startHeight = 0;

function startResize(e) {
  dragging = true;
  startY = e.clientY;
  startHeight = height.value;
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', stopResize);
}
function getMaxHeight() {
  // Limit drag so the drawer never covers the tab navigation bar
  const tabContent = document.querySelector('.tab-content');
  const topLimit = tabContent ? tabContent.getBoundingClientRect().top : 80;
  return Math.max(160, window.innerHeight - topLimit-1);
}

function onMouseMove(e) {
  if (!dragging) return;
  const delta = startY - e.clientY;
  const newHeight = Math.max(120, Math.min(getMaxHeight(), startHeight + delta));
  height.value = newHeight;
}
function stopResize() {
  dragging = false;
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', stopResize);
}

onUnmounted(stopResize);
</script>

<style scoped lang="scss">
.chronik-drawer {
  position: fixed;
  bottom: 0;
  // Align with main content: 32px (#app) + 16px (.content) + 24px (.kunden-page padding)
  left: 73px;
  right: 0;
  background: var(--tile-bg);
  border-top: 1px solid var(--border);
  border-left: 1px solid var(--border);
  border-top-left-radius: 12px;
  overflow: hidden;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  z-index: 90; // below sidebar (which is typically 100+)
  transition: right 0.25s ease;

  &--with-sidebar {
    // 440px sidebar + 24px page right padding (.kunden-page--wide)
    right: 466px;
  }
  &--collapsed {
    height: 40px !important;
  }
}

.cd-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  background: var(--panel);
}

.cd-resize-handle {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
  &:hover { background: color-mix(in srgb, var(--primary) 20%, transparent); }
}

.cd-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
}
.cd-count {
  background: var(--primary);
  color: #fff;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 600;
}
.cd-lead-title {
  color: var(--muted);
  font-weight: 400;
  font-size: 12px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-actions {
  display: flex;
  gap: 4px;
}
.cd-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  &:hover { background: var(--hover); color: var(--text); }
}

.cd-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 0;
}

.chronik-drawer-slide-enter-active,
.chronik-drawer-slide-leave-active {
  transition: transform 0.25s ease;
}
.chronik-drawer-slide-enter-from,
.chronik-drawer-slide-leave-to {
  transform: translateY(100%);
}
</style>
