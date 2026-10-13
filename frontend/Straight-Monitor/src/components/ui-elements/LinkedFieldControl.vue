<template>
  <div class="linked-field-control" :class="{ 'linked-field-control--linked': linked, 'linked-field-control--multiline': multiline }">
    <slot />
    <LinkedScopeToggle
      v-if="linked"
      class="linked-field-control__scope"
      :model-value="modelValue"
      :label="label"
      :disabled="disabled"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup>
import LinkedScopeToggle from '@/components/ui-elements/LinkedScopeToggle.vue';
defineProps({
  linked: { type: Boolean, default: false },
  modelValue: { type: Boolean, default: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  multiline: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
</script>

<style scoped>
.linked-field-control { position: relative; min-width: 0; width: 100%; }
.linked-field-control--linked :deep(.app-text-input),
.linked-field-control--linked :deep(.app-select),
.linked-field-control--linked :deep(.app-textarea) { padding-right: 46px; }
.linked-field-control__scope { position: absolute; top: 50%; right: 6px; transform: translateY(-50%); }
.linked-field-control--multiline .linked-field-control__scope { top: 6px; transform: none; }
</style>
