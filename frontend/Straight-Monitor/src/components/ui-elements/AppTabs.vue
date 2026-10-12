<template>
  <div class="app-tabs-container" :class="{ 'app-tabs-container--scroll-controls': scrollControls }">
    <AppIconButton
      v-if="scrollControls"
      class="app-tabs__scroll-control"
      label="Vorherige Tabs anzeigen"
      variant="ghost"
      :size="size"
      :disabled="!canScrollPrevious"
      @click="scrollTabs(-1)"
    >
      <FontAwesomeIcon :icon="faChevronLeft" aria-hidden="true" />
    </AppIconButton>
    <nav
      v-bind="$attrs"
      ref="tabList"
      class="app-tabs"
      :class="[`app-tabs--${size}`, `app-tabs--${variant}`, { 'app-tabs--wrap': wrap }]"
      role="tablist"
      :aria-label="label"
      @scroll="updateScrollState"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        ref="tabButtons"
        type="button"
        role="tab"
        class="app-tabs__tab"
        :class="{ 'app-tabs__tab--active': modelValue === tab.id }"
        :id="idPrefix ? `${idPrefix}-${tab.id}` : undefined"
        :data-tab-id="tab.id"
        :aria-controls="tab.panelId"
        :aria-selected="modelValue === tab.id"
        :tabindex="!tab.disabled && tab.id === tabStop ? 0 : -1"
        :disabled="tab.disabled"
        @click="selectTab(tab)"
        @keydown="handleTabKeydown(tab, $event)"
      >
        <FontAwesomeIcon v-if="tab.icon" :icon="tab.icon" aria-hidden="true" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
    <AppIconButton
      v-if="scrollControls"
      class="app-tabs__scroll-control"
      label="Weitere Tabs anzeigen"
      variant="ghost"
      :size="size"
      :disabled="!canScrollNext"
      @click="scrollTabs(1)"
    >
      <FontAwesomeIcon :icon="faChevronRight" aria-hidden="true" />
    </AppIconButton>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: '' },
  tabs: { type: Array, default: () => [] },
  label: { type: String, default: 'Seitenbereiche' },
  idPrefix: { type: String, default: '' },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md'].includes(value),
  },
  variant: { type: String, default: 'underline', validator: value => ['underline', 'compact'].includes(value) },
  wrap: { type: Boolean, default: false },
  scrollControls: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const tabList = ref(null);
const tabButtons = ref([]);
const canScrollPrevious = ref(false);
const canScrollNext = ref(false);
let resizeObserver;
const enabledTabs = computed(() => props.tabs.filter((tab) => !tab.disabled));
const tabStop = computed(() => enabledTabs.value.find((tab) => tab.id === props.modelValue)?.id
  ?? enabledTabs.value[0]?.id);

function selectTab(tab) {
  if (!tab.disabled && tab.id !== props.modelValue) emit('update:modelValue', tab.id);
}

function focusTab(tab) {
  nextTick(() => {
    const button = tabButtons.value.find((entry) => entry?.dataset?.tabId === String(tab.id));
    button?.focus({ preventScroll: props.scrollControls });
    revealTab(button);
  });
}

function updateScrollState() {
  const navigation = tabList.value;
  const maxScroll = navigation ? Math.max(0, navigation.scrollWidth - navigation.clientWidth) : 0;
  canScrollPrevious.value = !!navigation && navigation.scrollLeft > 1;
  canScrollNext.value = !!navigation && navigation.scrollLeft < maxScroll - 1;
}

function scrollTo(left, behavior = 'smooth') {
  const navigation = tabList.value;
  if (!navigation) return;
  const maxScroll = Math.max(0, navigation.scrollWidth - navigation.clientWidth);
  const destination = Math.max(0, Math.min(left, maxScroll));
  if (typeof navigation.scrollTo === 'function') navigation.scrollTo({ left: destination, behavior });
  else navigation.scrollLeft = destination;
  updateScrollState();
}

function scrollTabs(direction) {
  const navigation = tabList.value;
  if (!navigation) return;
  scrollTo(navigation.scrollLeft + direction * navigation.clientWidth * 0.8);
}

function revealTab(button) {
  const navigation = tabList.value;
  if (!props.scrollControls || props.wrap || !navigation || !button || !navigation.clientWidth) return;
  const viewport = navigation.getBoundingClientRect();
  const tab = button.getBoundingClientRect();
  if (tab.left < viewport.left) scrollTo(navigation.scrollLeft + tab.left - viewport.left, 'auto');
  else if (tab.right > viewport.right) scrollTo(navigation.scrollLeft + tab.right - viewport.right, 'auto');
}

function observeTabs() {
  resizeObserver?.disconnect();
  if (!props.scrollControls || !tabList.value) return;
  resizeObserver?.observe(tabList.value);
  tabButtons.value.forEach(button => resizeObserver?.observe(button));
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(updateScrollState);
  window.addEventListener('resize', updateScrollState);
  observeTabs();
  updateScrollState();
  revealTab(tabButtons.value.find(button => button?.dataset?.tabId === props.modelValue));
});

watch(() => [props.tabs, props.size, props.variant, props.wrap, props.scrollControls], () => {
  observeTabs();
  updateScrollState();
}, { deep: true, flush: 'post' });

watch(() => props.modelValue, () => {
  revealTab(tabButtons.value.find(button => button?.dataset?.tabId === props.modelValue));
}, { flush: 'post' });

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updateScrollState);
});

function handleTabKeydown(tab, event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (tab.disabled || !keys.includes(event.key) || !enabledTabs.value.length) return;

  event.preventDefault();
  const currentIndex = Math.max(0, enabledTabs.value.findIndex((entry) => entry.id === tab.id));
  let nextTab;

  if (event.key === 'Home') nextTab = enabledTabs.value[0];
  else if (event.key === 'End') nextTab = enabledTabs.value[enabledTabs.value.length - 1];
  else {
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + enabledTabs.value.length) % enabledTabs.value.length;
    nextTab = enabledTabs.value[nextIndex];
  }

  emit('update:modelValue', nextTab.id);
  focusTab(nextTab);
}
</script>

<style scoped>
.app-tabs-container { display: contents; }
.app-tabs-container--scroll-controls { display: flex; align-items: center; gap: 4px; min-width: 0; }
.app-tabs-container--scroll-controls .app-tabs { flex: 1 1 auto; }
.app-tabs__scroll-control { flex: 0 0 auto; }
.app-tabs-container :deep(.app-tabs__scroll-control) { border: 0; }

.app-tabs {
  display: flex;
  gap: 8px;
  min-width: 0;
  padding-bottom: 2px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.app-tabs::-webkit-scrollbar { display: none; }
.app-tabs--wrap { flex-wrap: wrap; overflow-x: visible; }

.app-tabs__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 8px 16px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
}

.app-tabs__tab:hover:not(:disabled) {
  border-radius: 6px 6px 0 0;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
}

.app-tabs__tab--active {
  border-bottom-color: var(--primary);
  color: var(--primary);
}

.app-tabs__tab--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 16%, transparent);
}

.app-tabs__tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  border-radius: 6px 6px 0 0;
}

.app-tabs__tab:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.app-tabs--sm { gap: 4px; }
.app-tabs--sm .app-tabs__tab { min-height: 32px; gap: 6px; padding: 7px 10px; font-size: 11px; }

.app-tabs--compact { gap: 4px; }
.app-tabs--compact .app-tabs__tab { min-height: 0; padding: 4px 8px; border: 1px solid transparent; border-radius: 4px; color: var(--muted); background: transparent; font-size: 11px; font-weight: 400; line-height: normal; }
.app-tabs--compact .app-tabs__tab:hover:not(:disabled) { border-radius: 4px; background: var(--hover); color: var(--text); }
.app-tabs--compact .app-tabs__tab[aria-selected=true],
.app-tabs--compact .app-tabs__tab[aria-selected=true]:hover:not(:disabled) { border-color: var(--border); color: var(--primary); background: var(--hover); }
.app-tabs--compact .app-tabs__tab:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }

@media (max-width: 768px) {
  .app-tabs--md .app-tabs__tab {
    min-height: 44px;
    padding: 8px 12px;
  }
}
</style>
