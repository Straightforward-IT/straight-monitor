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
        <section v-else-if="activeTab === 'graph'" class="graph-views">
          <div class="graph-views__tabs" aria-label="Graphansicht">
            <FilterChip :active="graphView === 'items'" @click="graphView = 'items'">Einzelne Artikel</FilterChip>
            <FilterChip :active="graphView === 'packages'" @click="graphView = 'packages'">Paketvorlagen</FilterChip>
          </div>
          <InventoryHistoryGraph v-if="graphView === 'items'" />
          <PackageTemplateHistoryGraph v-else />
        </section>
      </KeepAlive>
    </template>
  </RouterPageLayout>
</template>

<script setup>
import { ref } from 'vue';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { inventoryTabs } from '@/components/layout/pageTabDefinitions';
import InventoryHistoryTab from '@/components/InventoryHistoryTab.vue';
import InventoryHistoryGraph from '@/components/InventoryHistoryGraph.vue';
import PackageTemplateHistoryGraph from '@/components/PackageTemplateHistoryGraph.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';

const graphView = ref('items');
</script>

<style scoped>
.graph-views { display: flex; flex-direction: column; gap: 16px; }
.graph-views__tabs { display: flex; gap: 8px; }
</style>
