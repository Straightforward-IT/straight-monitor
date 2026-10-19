<template>
  <ModalFrame
    v-if="modelValue && item"
    :model-value="Boolean(modelValue && item)"
    :title="item.einsatz?.title || 'Einsatz bestätigen'"
    subtitle="Einsatz bestätigen"
    size="sm"
    :close-on-backdrop="!confirming"
    :close-on-escape="!confirming"
    :show-close="!confirming"
    class="confirmation-modal-frame"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('update:modelValue', false)"
  >
    <template #actions>
      <span v-if="item.confirmation?.currentStep" class="confirmation-modal__progress">
        {{ item.confirmation.currentStep.position }}/{{ item.confirmation.totalSteps }}
      </span>
    </template>

    <div class="confirmation-modal__body">
      <p class="confirmation-modal__meta">
        {{ formatDate(item.einsatz?.dateFrom) }} · {{ formatTime(item.einsatz) }}
      </p>
      <p class="confirmation-modal__location">
        <font-awesome-icon icon="fa-solid fa-location-dot" />
        {{ item.einsatz?.location }}
      </p>

      <div class="confirmation-modal__steps-indicator" aria-hidden="true">
        <span
          v-for="stepNum in (item.confirmation?.totalSteps || 3)"
          :key="stepNum"
          class="confirmation-modal__step-dot"
          :class="{
            active: stepNum === item.confirmation?.currentStep?.position,
            done: stepNum < (item.confirmation?.currentStep?.position || 1),
          }"
        />
      </div>

      <div v-if="item.confirmation?.currentStep" class="confirmation-modal__statement-box">
        <p class="confirmation-modal__statement">
          {{ item.confirmation.currentStep.text }}
        </p>
      </div>

      <p v-if="error" class="confirmation-modal__error">{{ error }}</p>
    </div>

    <template #footer>
      <AppButton
        variant="primary"
        block
        :loading="confirming"
        @click="$emit('confirm', item)"
      >
        Bestätigen
      </AppButton>
    </template>
  </ModalFrame>
</template>

<script setup>
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';

defineProps({
  modelValue: { type: Boolean, default: false },
  item: { type: Object, default: null },
  confirming: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

defineEmits(['update:modelValue', 'confirm']);

function formatDate(value) {
  if (!value) return 'Datum offen';
  return new Date(value).toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).replace(/\.$/, '');
}

function formatTime(einsatz) {
  if (!einsatz) return 'Uhrzeit offen';
  const from = String(einsatz.timeFrom || '').slice(0, 5);
  const to = String(einsatz.timeTo || '').slice(0, 5);
  return from ? `${from}${to ? ` – ${to}` : ''}` : 'Uhrzeit offen';
}
</script>

<style scoped>
.confirmation-modal__body {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.confirmation-modal__progress {
  min-width: 2.1rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 16%, var(--surface));
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
}

.confirmation-modal__meta,
.confirmation-modal__location {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.confirmation-modal__location svg {
  margin-right: 0.25rem;
  color: var(--primary);
}

.confirmation-modal__steps-indicator {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin: 0.45rem 0 0.2rem;
}

.confirmation-modal__step-dot {
  width: 24px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  transition: background 0.2s, width 0.2s;
}

.confirmation-modal__step-dot.done {
  background: color-mix(in srgb, var(--primary) 55%, var(--border));
}

.confirmation-modal__step-dot.active {
  width: 34px;
  background: var(--primary);
}

.confirmation-modal__statement-box {
  margin: 0.25rem 0 0.1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary) 7%, var(--surface));
}

.confirmation-modal__statement {
  margin: 0;
  color: var(--text);
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.45;
  text-align: center;
}

.confirmation-modal__error {
  margin: 0.25rem 0 0;
  color: #dc3545;
  font-size: 0.78rem;
  text-align: center;
}
</style>
