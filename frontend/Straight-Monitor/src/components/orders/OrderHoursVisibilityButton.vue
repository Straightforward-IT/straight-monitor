<template>
  <AppIconButton
    variant="secondary"
    size="sm"
    class="order-hours-visibility"
    :class="{ 'is-excluded': !included }"
    :label="`${subject}: Aufnahme in Stundenliste`"
    :title="nativeTitle ? `${subject} ${included ? 'aus Stundenliste ausschließen' : 'in Stundenliste aufnehmen'}` : null"
    :aria-pressed="included"
    :loading="pending"
    @click.stop="emit('toggle')"
  >
    <font-awesome-icon
      v-if="!pending"
      :icon="included ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'"
    />
  </AppIconButton>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
library.add(faEye, faEyeSlash);
defineProps({
  included: { type: Boolean, default: true },
  pending: { type: Boolean, default: false },
  subject: { type: String, required: true },
  nativeTitle: { type: Boolean, default: true },
});
const emit = defineEmits(['toggle']);
</script>

<style scoped>
.order-hours-visibility.app-button--sm,
.order-hours-visibility.app-button--sm.app-icon-button--active:not(:disabled) {
  --app-button-icon-size: 26px;
  --control-radius: 0 5px 5px 0;
  --action-secondary: color-mix(in srgb, var(--surface) 70%, var(--panel));
  --action-secondary-border: var(--border);
  --action-secondary-text: var(--muted);
  width: 26px;
  height: 22px;
  min-height: 22px;
  padding: 0;
  gap: 2px;
  flex: 0 0 auto;
  border-color: var(--border);
  border-left: 0;
  border-radius: 0 5px 5px 0;
  background: color-mix(in srgb, var(--surface) 70%, var(--panel));
  color: var(--muted);
  font-size: 0.62rem;
}
.order-hours-visibility.app-button--sm:hover:not(:disabled),
.order-hours-visibility.app-button--sm.app-icon-button--active:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--tile-bg);
  color: var(--primary);
}
</style>
