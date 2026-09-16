<template>
  <RouterPageLayout
    :tabs="orderTabs"
    default-tab="calendar"
    aria-label="Auftragsansicht"
    width="full"
    content-variant="surface"
  >
    <template #default="{ activeTab }">
      <AuftragKalender :view-mode="activeTab" />
    </template>
  </RouterPageLayout>
</template>

<script setup>
import RouterPageLayout from "@/components/layout/RouterPageLayout.vue";
import { orderTabs } from "@/components/layout/pageTabDefinitions";
import AuftragKalender from "@/components/AuftragKalender.vue";
</script>
