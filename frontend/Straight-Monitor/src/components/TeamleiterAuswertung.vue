<template>
  <RouterPageLayout
    :tabs="reportTabs"
    default-tab="auswertung"
    aria-label="Dokumentenansicht"
    width="full"
    content-variant="surface"
  >
    <ReportsEvaluationTab />
  </RouterPageLayout>
</template>

<script setup>
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { reportTabs } from '@/components/layout/pageTabDefinitions';
import ReportsEvaluationTab from '@/components/ReportsEvaluationTab.vue';
</script>
