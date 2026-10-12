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

    <AppTabs
      v-if="hasTabs"
      class="page-layout__tabs"
      :tabs="tabs"
      :model-value="modelValue"
      :label="ariaLabel"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <div class="page-layout__content" :class="`page-layout__content--${contentVariant}`">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import AppTabs from '@/components/ui-elements/AppTabs.vue';

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
const hasTabs = computed(() => props.tabs.length > 0);
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

  .page-layout__content--surface {
    padding: 16px 12px;
    border-radius: 8px;
  }
}
</style>
