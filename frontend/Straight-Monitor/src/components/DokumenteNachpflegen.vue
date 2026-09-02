<template>
  <RouterPageLayout
    :tabs="reportTabs"
    default-tab="nachpflege"
    aria-label="Dokumentenbereich"
    width="full"
    content-variant="surface"
  >
    <RouterPageLayout
      :tabs="documentMaintenanceTabs"
      default-tab="laufzettel"
      aria-label="Dokumenttyp auswählen"
      width="standard"
      content-variant="flush"
    >
      <template #default="{ activeTab }">
        <KeepAlive>
          <component :is="tabComponents[activeTab]" />
        </KeepAlive>
      </template>
    </RouterPageLayout>
  </RouterPageLayout>
</template>

<script setup>
import { markRaw } from 'vue';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { documentMaintenanceTabs, reportTabs } from '@/components/layout/pageTabDefinitions';
import DocumentRunSheetTab from '@/components/DocumentRunSheetTab.vue';
import DocumentEvaluationTab from '@/components/DocumentEvaluationTab.vue';
import DocumentEventReportTab from '@/components/DocumentEventReportTab.vue';

const tabComponents = {
  laufzettel: markRaw(DocumentRunSheetTab),
  evaluierung: markRaw(DocumentEvaluationTab),
  eventreport: markRaw(DocumentEventReportTab),
};
</script>
