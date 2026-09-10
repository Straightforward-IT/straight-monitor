<template>
  <CompanionDrawerFrame
    :model-value="true" title="Chronik" :icon="['fas', 'clock-rotate-left']"
    :context-title="`#${auftragNr} · ${orderTitle}`" side-panel-open
    side-panel-selector=".auftraege-page .sp-panel" storage-key="orders_chronik_drawer"
    top-boundary-selector=".auftraege-page" left-offset="73px" :default-height="380" desktop-only
    @close="$emit('close')"
  >
    <OrderChronikTimeline :auftrag-nr="auftragNr" :revision="revision" />
  </CompanionDrawerFrame>
</template>

<script setup>
import CompanionDrawerFrame from '@/components/frames/CompanionDrawerFrame.vue';
import OrderChronikTimeline from './OrderChronikTimeline.vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
library.add(faClockRotateLeft);
defineProps({ auftragNr: { type: [String, Number], required: true }, orderTitle: { type: String, default: '' }, revision: { type: Number, default: 0 } });
defineEmits(['close']);
</script>
