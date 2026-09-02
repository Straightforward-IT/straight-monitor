<template>
  <RouterPageLayout
    :tabs="signatureTabs"
    default-tab="signaturen"
    aria-label="Signaturansicht"
    width="full"
    content-variant="surface"
  >
    <template #default="{ activeTab }">
      <KeepAlive>
        <component :is="tabComponents[activeTab]" />
      </KeepAlive>
    </template>
  </RouterPageLayout>
</template>

<script setup>
import { markRaw } from 'vue';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import { signatureTabs } from '@/components/layout/pageTabDefinitions';
import SignaturesListTab from '@/components/SignaturesListTab.vue';
import SignatureTemplatesTab from '@/components/SignatureTemplatesTab.vue';
import SignatureArchiveTab from '@/components/SignatureArchiveTab.vue';

const tabComponents = {
  signaturen: markRaw(SignaturesListTab),
  templates: markRaw(SignatureTemplatesTab),
  ablage: markRaw(SignatureArchiveTab),
};
</script>
