<template>
  <CompanionDrawerFrame
    :model-value="show"
    title="Chronik"
    :icon="['fas', 'clock-rotate-left']"
    :count="entryCount"
    :context-title="orderTitle ? `#${auftragNr} · ${orderTitle}` : `#${auftragNr}`"
    :side-panel-open="sidePanelOpen"
    side-panel-selector=".auftraege-page .sp-panel, .auftraege-page .admin-staffing-panel, .auftraege-page .admin-staffing-expand-rail"
    :embedded="embedded"
    :embedded-target="embeddedTarget"
    storage-key="orders_chronik_drawer"
    top-boundary-selector=".auftraege-page"
    left-offset="73px"
    :default-height="380"
    :body-scrollable="false"
    :show-close="false"
    desktop-only
  >
    <template #actions>
      <AppIconButton
        variant="ghost"
        size="sm"
        label="Chronik aktualisieren"
        title="Aktualisieren"
        :disabled="timelineLoading"
        @click.stop="timelineRef?.reload?.()"
      >
        <font-awesome-icon
          :icon="['fas', 'rotate-right']"
          :spin="timelineLoading"
        />
      </AppIconButton>
    </template>
    <OrderChronikTimeline
      v-if="auftragNr != null && String(auftragNr).trim() !== ''"
      ref="timelineRef"
      :auftrag-nr="auftragNr"
      :revision="revision"
      @count-change="entryCount = $event"
      @loading-change="timelineLoading = $event"
    />
  </CompanionDrawerFrame>
</template>

<script setup>
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faClockRotateLeft, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import CompanionDrawerFrame from '@/components/frames/CompanionDrawerFrame.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import OrderChronikTimeline from './OrderChronikTimeline.vue';

library.add(faClockRotateLeft, faRotateRight);

const props = defineProps({
  show: { type: Boolean, default: true },
  sidePanelOpen: { type: Boolean, default: true },
  embedded: { type: Boolean, default: false },
  embeddedTarget: { type: String, default: 'body' },
  auftragNr: { type: [String, Number], default: null },
  orderTitle: { type: String, default: '' },
  revision: { type: Number, default: 0 },
});
defineEmits(['close']);

const timelineRef = ref(null);
const entryCount = ref(null);
const timelineLoading = ref(false);
watch(() => props.auftragNr, (val) => {
  if (val == null || String(val).trim() === '') {
    entryCount.value = null;
    timelineLoading.value = false;
  }
});
</script>
