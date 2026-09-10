<template>
  <Teleport
    :to="embeddedTarget"
    :disabled="!embedded"
  >
    <Transition name="cdf-slide">
      <aside
        v-if="modelValue"
        ref="drawerRef"
        class="cdf-drawer"
        :class="{
          'cdf-drawer--collapsed': collapsed,
          'cdf-drawer--with-side-panel': sidePanelOpen,
          'cdf-drawer--embedded': embedded,
          'cdf-drawer--desktop-only': desktopOnly,
        }"
        :style="drawerStyle"
        role="complementary"
        :aria-label="title"
      >
        <header
          class="cdf-header"
          @click="toggleCollapsed"
        >
          <div
            v-if="resizable && !collapsed && !embedded"
            class="cdf-resize-handle"
            title="Größe ändern"
            @mousedown.stop="startResize"
            @click.stop
          />
          <div class="cdf-title">
            <slot
              name="title"
              :collapsed="collapsed"
            >
              <font-awesome-icon
                v-if="icon"
                :icon="icon"
              />
              <strong>{{ title }}</strong>
              <span
                v-if="count != null"
                class="cdf-count"
              >{{ count }}</span>
              <span
                v-if="contextTitle"
                class="cdf-context-title"
              >{{ contextTitle }}</span>
            </slot>
          </div>
          <div class="cdf-actions">
            <slot
              name="actions"
              :collapsed="collapsed"
            />
            <button
              v-if="collapsible"
              type="button"
              class="cdf-icon-btn"
              :title="collapsed ? 'Ausklappen' : 'Einklappen'"
              @click.stop="toggleCollapsed"
            >
              <font-awesome-icon :icon="['fas', collapsed ? 'chevron-up' : 'chevron-down']" />
            </button>
            <button
              v-if="showClose"
              type="button"
              class="cdf-icon-btn"
              title="Schließen"
              @click.stop="close"
            >
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </div>
        </header>
        <template v-if="!collapsed">
          <div class="cdf-body">
            <div class="cdf-body-content">
              <slot />
            </div>
          </div>
          <footer
            v-if="$slots.footer"
            class="cdf-footer"
          >
            <slot name="footer" />
          </footer>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faChevronDown, faChevronUp, faXmark } from '@fortawesome/free-solid-svg-icons';

library.add(faChevronDown, faChevronUp, faXmark);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: [String, Array, Object], default: null },
  count: { type: Number, default: null },
  contextTitle: { type: String, default: '' },
  sidePanelOpen: { type: Boolean, default: false },
  sidePanelSelector: { type: String, default: '.sp-panel' },
  embedded: { type: Boolean, default: false },
  embeddedTarget: { type: String, default: 'body' },
  storageKey: { type: String, default: 'companion_drawer' },
  defaultHeight: { type: Number, default: 320 },
  minHeight: { type: Number, default: 120 },
  topBoundarySelector: { type: String, default: '' },
  leftOffset: { type: String, default: '0px' },
  collapsible: { type: Boolean, default: true },
  resizable: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  desktopOnly: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'update:collapsed', 'close']);
const drawerRef = ref(null);
const sidePanelOffset = ref('0px');
const naturalHeight = ref(0);

function readStoredValue(suffix, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  return localStorage.getItem(`${props.storageKey}_${suffix}`) ?? fallback;
}

const height = ref(Number.parseInt(readStoredValue('height', String(props.defaultHeight)), 10));
const collapsed = ref(readStoredValue('collapsed', '0') === '1');
const drawerStyle = computed(() => ({
  ...(collapsed.value ? {} : { height: `${Math.min(height.value, naturalHeight.value || height.value)}px` }),
  '--cdf-left-offset': props.leftOffset,
  '--cdf-side-panel-offset': sidePanelOffset.value,
}));

watch(height, value => localStorage.setItem(`${props.storageKey}_height`, String(value)));
watch(collapsed, (value) => {
  localStorage.setItem(`${props.storageKey}_collapsed`, value ? '1' : '0');
  emit('update:collapsed', value);
});
watch(
  () => [props.modelValue, props.sidePanelOpen, props.embedded],
  () => nextTick(syncLayout),
  { immediate: true },
);

let dragging = false;
let startY = 0;
let startHeight = 0;
let sidePanelObserver = null;
let observedSidePanel = null;
let contentObserver = null;

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function toggleCollapsed() {
  if (props.collapsible) collapsed.value = !collapsed.value;
}

function startResize(event) {
  dragging = true;
  startY = event.clientY;
  startHeight = drawerRef.value?.getBoundingClientRect().height || height.value;
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', stopResize);
}

function getMaxHeight() {
  const boundary = props.topBoundarySelector
    ? document.querySelector(props.topBoundarySelector)
    : null;
  const topLimit = boundary?.getBoundingClientRect().top ?? 80;
  const availableHeight = Math.max(props.minHeight, window.innerHeight - topLimit - 1);
  return naturalHeight.value
    ? Math.min(availableHeight, naturalHeight.value)
    : availableHeight;
}

function onMouseMove(event) {
  if (!dragging) return;
  const nextHeight = startHeight + startY - event.clientY;
  const maxHeight = getMaxHeight();
  const minHeight = Math.min(props.minHeight, maxHeight);
  height.value = Math.max(minHeight, Math.min(maxHeight, nextHeight));
}

function stopResize() {
  dragging = false;
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', stopResize);
}

function syncSidePanelOffset() {
  if (!props.sidePanelOpen || !drawerRef.value) {
    sidePanelObserver?.disconnect();
    observedSidePanel = null;
    sidePanelOffset.value = '0px';
    return;
  }

  const sidePanel = document.querySelector(props.sidePanelSelector);
  if (sidePanel !== observedSidePanel) {
    sidePanelObserver?.disconnect();
    observedSidePanel = sidePanel;
    if (sidePanel) {
      sidePanelObserver = new ResizeObserver(syncSidePanelOffset);
      sidePanelObserver.observe(sidePanel);
    }
  }

  sidePanelOffset.value = sidePanel
    ? `${Math.max(0, window.innerWidth - sidePanel.getBoundingClientRect().left)}px`
    : '0px';
}

function syncNaturalHeight() {
  const drawer = drawerRef.value;
  const header = drawer?.querySelector('.cdf-header');
  const body = drawer?.querySelector('.cdf-body');
  const content = drawer?.querySelector('.cdf-body-content');
  if (!header || !body || !content) return;

  const bodyStyle = getComputedStyle(body);
  const footer = drawer.querySelector('.cdf-footer');
  naturalHeight.value = Math.ceil(
    header.offsetHeight
    + content.scrollHeight
    + Number.parseFloat(bodyStyle.paddingTop)
    + Number.parseFloat(bodyStyle.paddingBottom)
    + (footer?.offsetHeight || 0),
  );
}

function observeDrawerContent() {
  contentObserver?.disconnect();
  contentObserver = null;
  if (!drawerRef.value) return;
  contentObserver = new MutationObserver(() => nextTick(syncNaturalHeight));
  contentObserver.observe(drawerRef.value, { childList: true, subtree: true, characterData: true });
}

function syncLayout() {
  syncSidePanelOffset();
  syncNaturalHeight();
  observeDrawerContent();
}

onMounted(() => {
  window.addEventListener('resize', syncLayout);
  nextTick(syncLayout);
});

onBeforeUnmount(() => {
  stopResize();
  sidePanelObserver?.disconnect();
  contentObserver?.disconnect();
  window.removeEventListener('resize', syncLayout);
});
</script>

<style scoped lang="scss">
.cdf-drawer {
  position: fixed;
  z-index: 90;
  right: 0;
  bottom: 0;
  left: var(--cdf-left-offset);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-right: 0;
  border-bottom: 0;
  border-radius: 12px 0 0;
  background: var(--tile-bg);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
  transition: right 0.25s ease;
}

.cdf-drawer--with-side-panel { right: var(--cdf-side-panel-offset); }
.cdf-drawer--collapsed { height: 40px !important; }
.cdf-drawer--embedded {
  position: relative;
  inset: auto;
  z-index: auto;
  width: 100%;
  max-height: min(42vh, 360px);
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 0;
  box-shadow: none;
}

.cdf-header {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  cursor: pointer;
  user-select: none;
}

.cdf-resize-handle {
  position: absolute;
  top: -3px;
  right: 0;
  left: 0;
  height: 6px;
  cursor: ns-resize;
}
.cdf-resize-handle:hover { background: color-mix(in srgb, var(--primary) 20%, transparent); }

.cdf-title { display: flex; min-width: 0; align-items: center; gap: 8px; color: var(--text); font-size: 13px; }
.cdf-count { padding: 2px 7px; border-radius: 10px; background: var(--primary); color: #fff; font-size: 10px; font-weight: 600; }
.cdf-context-title { max-width: 320px; overflow: hidden; color: var(--muted); font-size: 12px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
.cdf-context-title::before { content: "— "; }
.cdf-actions { display: flex; flex-shrink: 0; gap: 4px; }
.cdf-icon-btn { padding: 4px 8px; border: 0; border-radius: 4px; background: none; color: var(--muted); cursor: pointer; font-size: 12px; }
.cdf-icon-btn:hover { background: var(--hover); color: var(--text); }
.cdf-body { flex: 1; min-height: 0; padding: 12px 16px; overflow-y: auto; }
.cdf-body-content { min-height: 0; }
.cdf-footer { flex: 0 0 auto; padding: 0 16px 12px; background: var(--tile-bg); }

@media (max-width: 1100px) {
  .cdf-drawer--desktop-only { display: none; }
}

.cdf-slide-enter-active,
.cdf-slide-leave-active { transition: transform 0.25s ease; }
.cdf-slide-enter-from,
.cdf-slide-leave-to { transform: translateY(100%); }
</style>