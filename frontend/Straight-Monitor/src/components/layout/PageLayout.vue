<template>
  <section
    class="page-layout"
    :class="[`page-layout--${width}`, { 'page-layout--tabbed': hasTabs }]"
  >
    <header v-if="title || $slots.header || $slots.actions" class="page-layout__header">
      <div class="page-layout__heading">
        <slot name="header">
          <h1 v-if="title" data-page-title>{{ title }}</h1>
        </slot>
      </div>
      <div v-if="$slots.actions" class="page-layout__actions">
        <slot name="actions" />
      </div>
    </header>

    <nav
      v-if="hasTabs"
      class="page-layout__tabs"
      role="tablist"
      :aria-label="ariaLabel"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        ref="tabButtons"
        type="button"
        role="tab"
        class="page-layout__tab"
        :class="{ 'page-layout__tab--active': modelValue === tab.id }"
        :data-tab-id="tab.id"
        :aria-selected="modelValue === tab.id"
        :tabindex="modelValue === tab.id ? 0 : -1"
        :disabled="tab.disabled"
        @click="selectTab(tab)"
        @keydown="handleTabKeydown(tab, $event)"
      >
        <font-awesome-icon v-if="tab.icon" :icon="tab.icon" aria-hidden="true" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <div class="page-layout__content" :class="`page-layout__content--${contentVariant}`">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const props = defineProps({
  title: { type: String, default: '' },
  tabs: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  ariaLabel: { type: String, default: 'Seitenbereiche' },
  width: {
    type: String,
    default: 'standard',
    validator: (value) => ['standard', 'wide', 'full'].includes(value),
  },
  contentVariant: {
    type: String,
    default: 'surface',
    validator: (value) => ['surface', 'flush'].includes(value),
  },
});

const emit = defineEmits(['update:modelValue']);
const tabButtons = ref([]);
const hasTabs = computed(() => props.tabs.length > 0);
const enabledTabs = computed(() => props.tabs.filter((tab) => !tab.disabled));

function selectTab(tab) {
  if (!tab.disabled && tab.id !== props.modelValue) emit('update:modelValue', tab.id);
}

function focusTab(tab) {
  nextTick(() => {
    tabButtons.value
      .find((button) => button?.dataset?.tabId === String(tab.id))
      ?.focus();
  });
}

function handleTabKeydown(tab, event) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key) || !enabledTabs.value.length) return;

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
.page-layout {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text);
}

.page-layout--standard { max-width: 1200px; }
.page-layout--wide { max-width: 1600px; }
.page-layout--full { max-width: none; }

.page-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.page-layout__heading { min-width: 0; }

.page-layout__heading h1 {
  margin: 0;
  color: var(--text);
  font-size: 24px;
  font-weight: 600;
}

.page-layout__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.page-layout__tabs {
  display: flex;
  gap: 8px;
  min-width: 0;
  padding-bottom: 2px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.page-layout__tabs::-webkit-scrollbar { display: none; }

.page-layout__tab {
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

.page-layout__tab:hover:not(:disabled) {
  border-radius: 6px 6px 0 0;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
}

.page-layout__tab--active {
  border-bottom-color: var(--primary);
  color: var(--primary);
}

.page-layout__tab--active:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 16%, transparent);
}

.page-layout__tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
  border-radius: 6px 6px 0 0;
}

.page-layout__tab:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.page-layout__content {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}

.page-layout__content--surface {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--tile-bg);
  overflow-y: auto;
}

.page-layout__content--flush {
  padding: 0;
  overflow: clip;
}

@media (max-width: 768px) {
  .page-layout { gap: 12px; }

  .page-layout__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-layout__actions {
    width: 100%;
    overflow-x: auto;
  }

  .page-layout__tab {
    min-height: 44px;
    padding: 8px 12px;
  }

  .page-layout__content--surface {
    padding: 16px 12px;
    border-radius: 8px;
  }
}
</style>
