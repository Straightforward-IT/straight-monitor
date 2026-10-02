<template>
  <OrderActionDialog
    :model-value="modelValue"
    title="Label hinzufügen"
    icon="fa-solid fa-tag"
    :saving="saving"
    :busy="!!removingId"
    :can-submit="!!name.trim()"
    submit-label="Hinzufügen"
    close-label="Schließen"
    @close="emit('update:modelValue', false)"
    @submit="emit('create', { name: name.trim(), color })"
  >
    <template #default="{ formId }">
      <div
        v-if="labels.length"
        class="order-dialog-field"
      >
        <span class="order-dialog-label">Aktuelle Labels</span>
        <div class="label-dialog-chips">
          <span
            v-for="label in labels"
            :key="label._id"
            class="label-dialog-chip"
            :style="labelStyle(label.color)"
          >
            {{ label.name }}
            <AppIconButton
              variant="ghost"
              size="sm"
              :label="`Label ${label.name} entfernen`"
              :loading="removingId === label._id"
              @click="emit('remove', label._id)"
            >×</AppIconButton>
          </span>
        </div>
      </div>
      <div
        v-if="availableLabels.length"
        class="order-dialog-field"
      >
        <span class="order-dialog-label">Vorhandene Labels</span>
        <div class="label-dialog-chips">
          <AppButton
            v-for="label in availableLabels"
            :key="label.name"
            variant="outlined"
            size="sm"
            @click="emit('quick-add', label)"
          >
            <span
              class="label-dialog-dot"
              :style="{ background: label.color }"
              aria-hidden="true"
            /> + {{ label.name }}
          </AppButton>
        </div>
      </div>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-name`"
        >Neues Label</label>
        <AppTextInput
          :id="`${formId}-name`"
          :model-value="name"
          required
          maxlength="20"
          placeholder="Name (max. 20 Zeichen)"
          @update:model-value="emit('update:name', $event)"
        />
        <small class="label-dialog-count">{{ name.length }}/20</small>
      </div>
      <div class="order-dialog-field">
        <span class="order-dialog-label">Farbe</span>
        <div class="label-dialog-palette">
          <button
            v-for="value in presetColors"
            :key="value"
            type="button"
            class="label-dialog-swatch"
            :aria-label="`Farbe ${value}`"
            :aria-pressed="color === value"
            :style="{ background: value }"
            @click="emit('update:color', value)"
          />
          <input
            type="color"
            :value="color"
            aria-label="Benutzerdefinierte Label-Farbe"
            @input="emit('update:color', $event.target.value)"
          >
        </div>
      </div>
    </template>
  </OrderActionDialog>
</template>

<script setup>
import OrderActionDialog from './OrderActionDialog.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
defineProps({
  modelValue: { type: Boolean, default: false },
  name: { type: String, default: '' }, color: { type: String, default: '#4f46e5' },
  labels: { type: Array, default: () => [] }, availableLabels: { type: Array, default: () => [] },
  presetColors: { type: Array, default: () => [] }, saving: { type: Boolean, default: false },
  removingId: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'update:name', 'update:color', 'create', 'quick-add', 'remove']);
function labelStyle(color) {
  return { borderColor: color, background: `color-mix(in srgb, ${color} 13%, var(--surface))` };
}
</script>

<style scoped>
.label-dialog-chips, .label-dialog-palette { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.label-dialog-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px 2px 10px; border: 1px solid; border-radius: 20px; color: var(--text); font-size: .8rem; }
.label-dialog-dot { width: 9px; height: 9px; border-radius: 50%; }
.label-dialog-count { color: var(--muted); font-size: .72rem; }
.label-dialog-swatch { width: 24px; height: 24px; padding: 0; border: 2px solid transparent; border-radius: 50%; cursor: pointer; }
.label-dialog-swatch[aria-pressed="true"] { border-color: var(--text); box-shadow: 0 0 0 1px var(--surface); }
.label-dialog-swatch:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
.label-dialog-palette input[type="color"] { width: 28px; height: 28px; padding: 0; border: 0; background: transparent; }
.label-dialog-palette input[type="color"]:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
</style>
