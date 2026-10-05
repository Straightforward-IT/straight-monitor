<template>
  <textarea
    ref="textareaRef"
    v-bind="$attrs"
    class="app-textarea"
    :value="modelValue"
    @input="onInput"
    @compositionstart="composing = true"
    @compositionend="onCompositionEnd"
  />
</template>

<script setup>
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: String, default: '' },
  modelModifiers: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue']);
const textareaRef = ref(null);
let composing = false;

defineExpose({
  focus: () => textareaRef.value?.focus(),
  select: () => textareaRef.value?.select(),
});

function onInput(event) {
  if (composing) return;
  const value = props.modelModifiers.trim ? event.target.value.trim() : event.target.value;
  emit('update:modelValue', value);
}

function onCompositionEnd(event) {
  if (!composing) return;
  composing = false;
  onInput(event);
}
</script>

<style scoped lang="scss">
.app-textarea {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 86px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--control-input-border, var(--border));
  border-radius: var(--control-radius, 8px);
  background: var(--control-input-bg, var(--panel));
  color: var(--text);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.4;
  resize: vertical;

  &::placeholder { color: var(--muted); opacity: 1; }

  &:focus {
    border-color: var(--primary);
    outline: 2px solid var(--control-focus-ring, color-mix(in srgb, var(--primary) 42%, transparent));
    outline-offset: 1px;
  }

  &:disabled {
    border-color: var(--control-disabled-border, var(--border));
    background: var(--control-disabled-bg, var(--hover));
    color: var(--control-disabled-text, var(--muted));
    cursor: not-allowed;
  }
}
</style>
