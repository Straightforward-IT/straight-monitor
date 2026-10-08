<template>
  <RouterPageLayout title="Tarife" :tabs="tariffTabs" default-tab="overview" aria-label="Tarifbereiche" width="full">
    <template #default="{ activeTab }"><TarifeWorkspace :active-tab="activeTab" /></template>
  </RouterPageLayout>
</template>

<script setup>
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { tariffTabs } from '@/components/layout/pageTabDefinitions';
import TarifeWorkspace from '@/components/tariffs/TarifeWorkspace.vue';
</script>
