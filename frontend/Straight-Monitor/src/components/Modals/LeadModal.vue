<template>
  <ModalFrame
    :title="lead.title || 'Lead'"
    size="lg"
    minimizable
    :minimize-title="lead.title || 'Lead'"
    class="lead-modal"
    @close="currentModal?.remove()"
  >
    <template #header="{ titleId }">
      <h2 :id="titleId" class="lead-modal__title">{{ lead.title || 'Lead' }}</h2>
      <div class="lead-modal__meta">
        <span>{{ leadDetails?.stufeLabel(lead.stufe) || lead.stufe }}</span>
        <span v-if="ownerLabel">{{ ownerLabel }}</span>
      </div>
    </template>
    <template #actions>
      <AppIconButton
        variant="ghost"
        size="sm"
        label="Lead-Aktionen"
        title="Lead-Aktionen"
        :disabled="!leadDetails || leadDetails.savingDetail"
        @click="leadDetails?.openSidebarActionMenu($event)"
      >
        <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
      </AppIconButton>
      <ContextMenu
        v-if="leadDetails?.sidebarActionMenu.open"
        :x="leadDetails.sidebarActionMenu.x"
        :y="leadDetails.sidebarActionMenu.y"
        title="Lead"
        :width="200"
        :options="leadDetails.sidebarActionMenuOptions"
        @close="leadDetails.sidebarActionMenu.open = false"
        @select="leadDetails.handleSidebarAction"
      />
    </template>
    <LeadsTab
      ref="leadDetails"
      :hosted-lead="hostedLead"
      :hosted-form="hostedForm"
      :can-dock="canDock"
      :on-dock="onDock"
    />
    <template #footer>
      <div :id="`lead-chronik-modal-${hostedLead._id}`" class="lead-modal__chronik" />
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useCurrentDockedModal, useDockedModals } from '@bleck-it/vue-modal-dock';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import LeadsTab from '@/components/LeadsTab.vue';

const props = defineProps({
  hostedLead: { type: Object, required: true },
  hostedForm: { type: Object, default: null },
  canDock: { type: Function, default: undefined },
  onDock: { type: Function, default: undefined },
});

const leadDetails = ref(null);
const currentModal = useCurrentDockedModal();
const manager = useDockedModals();
const lead = computed(() => leadDetails.value?.selectedLead || props.hostedLead);
const ownerLabel = computed(() => lead.value.eigentuemer?.name || lead.value.eigentuemer?.email || '');

watch(() => lead.value.title, title => {
  if (currentModal) manager.updateTitle(currentModal.id.value, title || 'Lead');
}, { immediate: true });
</script>

<style scoped lang="scss">
:global(.lead-modal) {
  --mf-footer-padding: 0;
  --mf-footer-border: none;
}

.lead-modal__title {
  margin: 0 0 6px;
  font-size: 1.1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.lead-modal__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 0.8rem;
}

.lead-modal__chronik {
  width: 100%;
  min-width: 0;
}
</style>