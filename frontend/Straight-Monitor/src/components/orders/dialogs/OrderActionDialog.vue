<template>
  <ModalFrame
    :model-value="modelValue"
    :title="title"
    size="sm"
    :close-on-backdrop="!locked"
    :close-on-escape="!locked"
    style="--mf-max-width: 480px; --mf-max-height: 90dvh"
    @close="close"
  >
    <template #header="{ titleId }">
      <h2
        :id="titleId"
        class="order-action-title"
      >
        <font-awesome-icon :icon="icon" /> {{ title }}
      </h2>
    </template>
    <form
      :id="formId"
      @submit.prevent="submit"
    >
      <fieldset
        :disabled="locked"
        class="order-action-fields"
      >
        <slot :form-id="formId" />
      </fieldset>
    </form>
    <template #footer>
      <div class="order-action-footer">
        <AppButton
          variant="secondary"
          :disabled="locked"
          @click="close"
        >
          {{ closeLabel }}
        </AppButton>
        <AppButton
          type="submit"
          :form="formId"
          :disabled="!canSubmit || busy"
          :loading="saving"
        >
          <font-awesome-icon icon="fa-solid fa-check" /> {{ submitLabel }}
        </AppButton>
      </div>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, getCurrentInstance } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faTag, faPlus, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';

library.add(faCheck, faTag, faPlus, faUserPlus);
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  icon: { type: [String, Array], required: true },
  busy: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  canSubmit: { type: Boolean, default: false },
  submitLabel: { type: String, required: true },
  closeLabel: { type: String, default: 'Abbrechen' },
});
const emit = defineEmits(['close', 'submit']);
const formId = `order-action-${getCurrentInstance().uid}`;
const locked = computed(() => props.busy || props.saving);
function close() { if (!locked.value) emit('close'); }
function submit() { if (!locked.value && props.canSubmit) emit('submit'); }
</script>

<style scoped>
.order-action-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.05rem; color: var(--text); }
.order-action-title svg { color: var(--action-accent-text); }
.order-action-fields { display: grid; gap: 16px; min-width: 0; margin: 0; padding: 0; border: 0; }
.order-action-footer { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
:deep(.order-dialog-field) { display: grid; gap: 6px; min-width: 0; }
:deep(.order-dialog-label) { font-size: .8rem; color: var(--muted); }
:deep(.order-dialog-row) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
:deep(.order-dialog-native) { box-sizing: border-box; width: 100%; min-width: 0; min-height: 38px; padding: 8px 10px; border: 1px solid var(--control-input-border); border-radius: var(--control-radius); background: var(--control-input-bg); color: var(--text); font: inherit; font-size: .875rem; color-scheme: inherit; }
:deep(.order-dialog-native:focus) { outline: 2px solid var(--control-focus-ring); outline-offset: 1px; }
:deep(.order-dialog-native:disabled) { background: var(--control-disabled-bg); color: var(--control-disabled-text); }
@media (max-width: 420px) { :deep(.order-dialog-row) { grid-template-columns: minmax(0, 1fr); } }
</style>
