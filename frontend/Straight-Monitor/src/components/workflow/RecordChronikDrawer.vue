<template>
  <CompanionDrawerFrame
    :model-value="show"
    :title="title"
    :icon="icon"
    :count="count"
    :context-title="contextTitle"
    :side-panel-open="sidePanelOpen"
    :side-panel-selector="sidePanelSelector"
    :embedded="embedded"
    :embedded-target="embeddedTarget"
    :storage-key="storageKey"
    :top-boundary-selector="topBoundarySelector"
    :left-offset="leftOffset"
    :body-scrollable="false"
    desktop-only
    @close="$emit('close')"
  >
    <slot />
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </CompanionDrawerFrame>
</template>

<script setup>
import CompanionDrawerFrame from '@/components/frames/CompanionDrawerFrame.vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
library.add(faClockRotateLeft);

defineProps({
  show: { type: Boolean, default: false }, sidePanelOpen: { type: Boolean, default: false }, embedded: { type: Boolean, default: false }, embeddedTarget: { type: String, default: 'body' },
  count: { type: Number, default: null }, contextTitle: { type: String, default: '' }, title: { type: String, default: 'Chronik' }, icon: { type: Array, default: () => ['fas', 'clock-rotate-left'] },
  storageKey: { type: String, required: true }, sidePanelSelector: { type: String, default: '' }, topBoundarySelector: { type: String, default: '' }, leftOffset: { type: String, default: '0px' },
});
defineEmits(['close']);
</script>
