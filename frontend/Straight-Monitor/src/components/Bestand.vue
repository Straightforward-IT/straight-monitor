<template>
  <RouterPageLayout
    :tabs="inventoryTabs"
    default-tab="inventory"
    aria-label="Bestandsbereiche"
    width="full"
    content-variant="surface"
  >
    <InventoryOverviewTab />
  </RouterPageLayout>
</template>

<script setup>
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { inventoryTabs } from '@/components/layout/pageTabDefinitions';
import InventoryOverviewTab from '@/components/InventoryOverviewTab.vue';
</script>
