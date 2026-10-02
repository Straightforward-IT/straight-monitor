<template>
  <AppIconButton
    variant="secondary"
    size="sm"
    class="order-hours-visibility"
    :class="{ 'is-excluded': !included }"
    :label="`${subject}: Aufnahme in Stundenliste`"
    :title="`${subject} ${included ? 'aus Stundenliste ausschließen' : 'in Stundenliste aufnehmen'}`"
    :active="included"
    :loading="pending"
    @click.stop="emit('toggle')"
  >
    <font-awesome-icon
      v-if="!pending"
      :icon="included ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'"
    />
    <font-awesome-icon
      v-if="!pending"
      class="order-hours-signature-icon"
      icon="fa-solid fa-file-signature"
    />
  </AppIconButton>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faEye, faEyeSlash, faFileSignature } from '@fortawesome/free-solid-svg-icons';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
library.add(faEye, faEyeSlash, faFileSignature);
defineProps({
  included: { type: Boolean, default: true },
  pending: { type: Boolean, default: false },
  subject: { type: String, required: true },
});
const emit = defineEmits(['toggle']);
</script>

<style scoped>
.order-hours-visibility.app-button--sm { --app-button-icon-size: 40px; --action-secondary-text: var(--action-accent-text); min-height: 26px; padding: 0; gap: 3px; flex: 0 0 auto; }
.order-hours-visibility.is-excluded { --action-secondary-text: var(--muted); }
.order-hours-signature-icon { font-size: .7em; }
</style>
