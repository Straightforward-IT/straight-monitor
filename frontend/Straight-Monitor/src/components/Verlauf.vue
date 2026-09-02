<template>
  <RouterPageLayout
    :tabs="inventoryTabs"
    default-tab="history"
    aria-label="Bestandsbereiche"
    width="full"
    content-variant="surface"
  >
    <template #default="{ activeTab }">
      <KeepAlive>
        <InventoryHistoryTab v-if="activeTab === 'history'" />
        <InventoryHistoryGraph v-else-if="activeTab === 'graph'" />
      </KeepAlive>
    </template>
  </RouterPageLayout>
</template>

<script setup>
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { inventoryTabs } from '@/components/layout/pageTabDefinitions';
import InventoryHistoryTab from '@/components/InventoryHistoryTab.vue';
import InventoryHistoryGraph from '@/components/InventoryHistoryGraph.vue';
</script>
