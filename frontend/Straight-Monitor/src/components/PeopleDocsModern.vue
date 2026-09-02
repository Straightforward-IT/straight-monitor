<template>
  <RouterPageLayout
    :tabs="personalTabs"
    default-tab="mitarbeiter"
    aria-label="Personalansicht"
    width="full"
    content-variant="surface"
  >
    <template #default="{ activeTab }">
      <KeepAlive>
        <MitarbeiterTab v-if="activeTab === 'mitarbeiter'" />
        <BewerberTab v-else :initial-applicant-id="$route.query.bewerber_id || ''" />
      </KeepAlive>
    </template>
  </RouterPageLayout>
</template>

<script setup>
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { personalTabs } from '@/components/layout/pageTabDefinitions';
import MitarbeiterTab from '@/components/MitarbeiterTab.vue';
import BewerberTab from '@/components/BewerberTab.vue';
</script>
