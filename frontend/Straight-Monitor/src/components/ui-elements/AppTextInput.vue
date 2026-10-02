<template>
  <input
    ref="inputRef"
    v-bind="$attrs"
    class="app-text-input"
    :type="type"
    :value="modelValue"
    @input="onInput"
    @compositionstart="composing = true"
    @compositionend="onCompositionEnd"
  >
</template>

<script setup>
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  modelModifiers: { type: Object, default: () => ({}) },
  type: { type: String, default: 'text' },
});

const emit = defineEmits(['update:modelValue']);
const inputRef = ref(null);
let composing = false;

defineExpose({
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select(),
});

function onInput(event) {
  if (composing) return;
  let value = event.target.value;
  if (props.modelModifiers.trim) value = value.trim();
  if (props.modelModifiers.number || props.type === 'number') {
    const number = Number.parseFloat(value);
    // Like native v-model.number, preserve an empty field instead of making it 0.
    if (!Number.isNaN(number)) value = number;
  }
  emit('update:modelValue', value);
}

function onCompositionEnd(event) {
  if (!composing) return;
  composing = false;
  onInput(event);
}
</script>

<style scoped lang="scss">
.app-text-input {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--control-input-border, var(--border));
  border-radius: var(--control-radius, 8px);
  background: var(--control-input-bg, var(--panel));
  color: var(--text);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.25;

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
