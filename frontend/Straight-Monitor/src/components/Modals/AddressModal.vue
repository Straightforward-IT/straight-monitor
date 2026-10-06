<template>
  <ModalFrame
    :model-value="modelValue"
    :title="title"
    size="sm"
    layer="elevated"
    :close-on-backdrop="!saving"
    :close-on-escape="!saving"
    :show-close="!saving"
    style="--mf-max-width: 400px"
    @close="emit('close')"
  >
    <div class="address-modal-fields" @keydown.enter.prevent="submit">
      <label class="address-modal-field">
        <span>Straße &amp; Hausnummer</span>
        <AppTextInput
          ref="streetInput"
          v-model="draft.street"
          autocomplete="street-address"
          placeholder="Musterstraße 42"
          :disabled="saving"
        />
      </label>
      <div class="address-modal-row">
        <label class="address-modal-field address-modal-field--zip">
          <span>PLZ</span>
          <AppTextInput
            v-model="draft.zip"
            autocomplete="postal-code"
            placeholder="12345"
            :disabled="saving"
          />
        </label>
        <label class="address-modal-field">
          <span>Stadt</span>
          <AppTextInput
            v-model="draft.city"
            autocomplete="address-level2"
            placeholder="Berlin"
            :disabled="saving"
          />
        </label>
      </div>
      <label class="address-modal-field">
        <span>Land</span>
        <AppTextInput
          v-model="draft.country"
          autocomplete="country-name"
          placeholder="Deutschland"
          :disabled="saving"
        />
      </label>
    </div>

    <template #footer>
      <AppButton variant="secondary" :disabled="saving" @click="emit('close')">Abbrechen</AppButton>
      <AppButton :loading="saving" @click="submit">{{ submitLabel }}</AppButton>
    </template>
  </ModalFrame>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  address: { type: Object, default: null },
  title: { type: String, default: 'Adresse eingeben' },
  submitLabel: { type: String, default: 'Speichern' },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'save']);
const streetInput = ref(null);
const draft = reactive({ street: '', zip: '', city: '', country: '' });

watch(() => props.modelValue, async (open) => {
  if (!open) return;
  for (const key of Object.keys(draft)) draft[key] = props.address?.[key] || '';
  await nextTick();
  streetInput.value?.focus();
}, { immediate: true });

function submit() {
  if (props.saving) return;
  emit('save', Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])));
}
</script>

<style scoped lang="scss">
.address-modal-fields { display: grid; gap: 14px; }
.address-modal-row { display: grid; grid-template-columns: minmax(90px, 1fr) minmax(0, 2fr); gap: 12px; }
.address-modal-field { display: grid; min-width: 0; gap: 5px; }
.address-modal-field > span {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

@media (max-width: 420px) {
  .address-modal-row { grid-template-columns: 1fr; }
}
</style>
