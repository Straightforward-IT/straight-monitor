<template>
  <RouterPageLayout
    :tabs="visibleTabs"
    default-tab="overview"
    aria-label="Kundenbereiche"
    width="full"
    content-variant="surface"
  >
    <template #default="{ activeTab }">
      <KeepAlive>
        <component :is="tabComponents[activeTab] || CustomerOverviewTab" />
      </KeepAlive>
    </template>
  </RouterPageLayout>
</template>

<script setup>
import { computed, markRaw } from 'vue';
import { useAuth } from '@/stores/auth';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { customerTabs } from '@/components/layout/pageTabDefinitions';
import CustomerOverviewTab from '@/components/CustomerOverviewTab.vue';
import CustomerAnalyticsTab from '@/components/CustomerAnalyticsTab.vue';
import CustomerLeadsTab from '@/components/CustomerLeadsTab.vue';
import CustomerWatchlistTab from '@/components/CustomerWatchlistTab.vue';
import CustomerContactsTab from '@/components/CustomerContactsTab.vue';

const auth = useAuth();
const roles = computed(() => auth.user?.roles || []);
const visibleTabs = computed(() => customerTabs.filter((tab) => !tab.roles || tab.roles.some((role) => roles.value.includes(role))));
const tabComponents = {
  overview: markRaw(CustomerOverviewTab),
  analytics: markRaw(CustomerAnalyticsTab),
  leads: markRaw(CustomerLeadsTab),
  watchlist: markRaw(CustomerWatchlistTab),
  kontakte: markRaw(CustomerContactsTab),
};
</script>
