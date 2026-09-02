<template>
  <PageLayout
    :title="title"
    :tabs="tabs"
    :model-value="activeTab"
    :aria-label="ariaLabel"
    :width="width"
    :content-variant="contentVariant"
    @update:model-value="navigateToTab"
  >
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    <slot :active-tab="activeTab" />
  </PageLayout>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageLayout from '@/components/layout/PageLayout.vue';

const props = defineProps({
  title: { type: String, default: '' },
  tabs: { type: Array, required: true },
  defaultTab: { type: String, default: '' },
  ariaLabel: { type: String, default: 'Seitenbereiche' },
  width: { type: String, default: 'standard' },
  contentVariant: { type: String, default: 'surface' },
});

const route = useRoute();
const router = useRouter();

const activeTab = computed(() => {
  const match = props.tabs.find((tab) => tab.isActive?.(route));
  return match?.id || props.defaultTab || props.tabs[0]?.id || '';
});

async function navigateToTab(tabId) {
  const tab = props.tabs.find((entry) => entry.id === tabId);
  if (!tab || tab.disabled || !tab.to) return;

  const target = typeof tab.to === 'function' ? tab.to(route) : tab.to;
  if (router.resolve(target).fullPath !== route.fullPath) await router.push(target);
}
</script>
