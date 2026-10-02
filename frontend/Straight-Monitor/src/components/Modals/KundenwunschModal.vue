<template>
  <ModalFrame
    v-if="open"
    :model-value="open"
    title="Kundenwunsch hinzufügen"
    size="sm"
    class="kundenwunsch-modal"
    style="--mf-max-width: min(380px, 92vw); --mf-body-padding: 16px 18px; --mf-header-padding: 14px 18px; --mf-title-size: 0.875rem"
    :show-close="!saving"
    :close-on-backdrop="!saving"
    :close-on-escape="!saving"
    @close="requestClose"
  >
    <div class="kundenwunsch-modal__content" :inert="saving">
      <div class="kundenwunsch-modal__choices" role="group" aria-label="Art des Kundenwunschs">
        <AppButton
          variant="secondary"
          size="sm"
          class="kundenwunsch-modal__choice"
          :class="{ 'kundenwunsch-modal__choice--positive': typ === 'positiv' }"
          :aria-pressed="typ === 'positiv'"
          :disabled="saving"
          @click="typ = 'positiv'"
        >🤝 Positiv</AppButton>
        <AppButton
          variant="secondary"
          size="sm"
          class="kundenwunsch-modal__choice"
          :class="{ 'kundenwunsch-modal__choice--negative': typ === 'negativ' }"
          :aria-pressed="typ === 'negativ'"
          :disabled="saving"
          @click="typ = 'negativ'"
        >🚫 Negativ</AppButton>
      </div>

      <label for="kundenwunsch-kunde">Kunde auswählen</label>
      <KundeSearch
        ref="searchRef"
        input-id="kundenwunsch-kunde"
        :location-v2="locationV2"
        :mitarbeiter-id="mitarbeiterId"
        :disabled="saving"
        @select="selectKunde"
      />

      <p v-if="saving" class="kundenwunsch-modal__status" role="status">Kundenwunsch wird gespeichert…</p>
      <p v-if="error" class="kundenwunsch-modal__error" role="alert">{{ error }}</p>
      <AppButton
        v-if="error && selectedKunde"
        variant="secondary"
        size="sm"
        :disabled="saving"
        @click="submitSelected"
      >Erneut versuchen</AppButton>
    </div>
  </ModalFrame>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import KundeSearch from '@/components/ui-elements/KundeSearch.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  mitarbeiterId: { type: String, default: null },
  locationV2: { type: String, default: null },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
});
const emit = defineEmits(['close', 'submit', 'clear-error']);

const typ = ref('positiv');
const selectedKunde = ref(null);
const searchRef = ref(null);

watch(() => props.open, async (open) => {
  if (!open) return;
  typ.value = 'positiv';
  selectedKunde.value = null;
  await nextTick();
  searchRef.value?.focus?.();
}, { immediate: true });

function selectKunde(kunde) {
  if (props.saving) return;
  selectedKunde.value = kunde?._id ? kunde : null;
  if (!selectedKunde.value) emit('clear-error');
  submitSelected();
}

function submitSelected() {
  if (!props.open || props.saving || !selectedKunde.value) return;
  emit('submit', { kunde: selectedKunde.value, typ: typ.value });
}

function requestClose() {
  if (!props.saving) emit('close');
}
</script>

<style scoped lang="scss">
.kundenwunsch-modal__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kundenwunsch-modal__choices {
  display: flex;
  gap: 8px;
}

.kundenwunsch-modal__choice {
  flex: 1;
  min-width: 0;
}

.kundenwunsch-modal__choice--positive {
  --app-button-background: color-mix(in srgb, var(--status-success-text) 10%, var(--surface));
  --app-button-border: var(--status-success-text);
  --app-button-color: var(--text);
}

.kundenwunsch-modal__choice--negative {
  --app-button-background: color-mix(in srgb, var(--status-danger-text) 10%, var(--surface));
  --app-button-border: var(--status-danger-text);
  --app-button-color: var(--text);
}

label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
}

.kundenwunsch-modal__error {
  margin: 0;
  color: var(--status-danger-text);
  font-size: 0.8rem;
}

.kundenwunsch-modal__status {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}
</style>
