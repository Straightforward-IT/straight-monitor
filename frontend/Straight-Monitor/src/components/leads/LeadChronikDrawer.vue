<template>
  <CompanionDrawerFrame
    :model-value="show"
    title="Chronik"
    :icon="['fas', 'clock-rotate-left']"
    :count="count"
    :context-title="leadTitle"
    :side-panel-open="sidebarOpen"
    side-panel-selector=".leads-tab .sp-panel, .leads-tab .detail-sidebar:not(.detail-sidebar--mobile)"
    :embedded="embedded"
    :embedded-target="embeddedTarget"
    storage-key="leads_chronik_drawer"
    top-boundary-selector=".tab-content"
    left-offset="73px"
    desktop-only
    @close="$emit('close')"
  >
    <slot />
    <template
      v-if="$slots.footer"
      #footer
    >
      <slot name="footer" />
    </template>
  </CompanionDrawerFrame>
</template>

<script setup>
import CompanionDrawerFrame from '@/components/frames/CompanionDrawerFrame.vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';

library.add(faClockRotateLeft);

defineProps({
  show: { type: Boolean, default: false },
  sidebarOpen: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
  embeddedTarget: { type: String, default: 'body' },
  count: { type: Number, default: null },
  leadTitle: { type: String, default: '' },
});
defineEmits(['close']);
</script>
