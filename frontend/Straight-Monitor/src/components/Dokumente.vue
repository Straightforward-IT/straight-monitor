<template>
  <RouterPageLayout
    :tabs="reportTabs"
    default-tab="dokumente"
    aria-label="Dokumentenansicht"
    width="full"
    content-variant="surface"
  >
    <DocumentsOverviewTab />
  </RouterPageLayout>
</template>

<script setup>
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { reportTabs } from '@/components/layout/pageTabDefinitions';
import DocumentsOverviewTab from '@/components/DocumentsOverviewTab.vue';
</script>
