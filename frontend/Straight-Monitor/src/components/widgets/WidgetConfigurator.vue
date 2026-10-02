<template>
  <ModalFrame
    :model-value="visible"
    title="Dashboard anpassen"
    size="sm"
    style="--mf-max-width: min(480px, calc(100vw - 32px)); --mf-max-height: calc(100dvh - 64px); --mf-body-padding: 0; --mf-header-padding: 20px 24px 12px; --mf-footer-padding: 16px 24px"
    @close="emit('close')"
  >
    <template #header="{ titleId }">
      <h2 :id="titleId" class="cfg__title">
        <font-awesome-icon :icon="['fas', 'sliders']" />
        Dashboard anpassen
      </h2>
    </template>

    <WidgetPreferenceControls class="cfg__controls" />

    <template #footer>
      <AppButton @click="emit('close')">Fertig</AppButton>
    </template>
  </ModalFrame>
</template>

<script setup>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import WidgetPreferenceControls from './WidgetPreferenceControls.vue';

defineProps({ visible: { type: Boolean, default: true } });
const emit = defineEmits(["close"]);
</script>

<style scoped lang="scss">
.cfg__title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 700;
}

.cfg__controls { flex: 1; min-height: 0; padding: 0 24px 12px; overflow: hidden; }

/* ── Mobile ──────────────────────────────────────── */
@media (max-width: 520px) {
  .cfg__controls { padding: 0 16px 10px; }
}
</style>
