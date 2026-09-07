<template>
  <div v-bind="$attrs" class="search-bar" :class="{ 'search-bar--compact': compact }">
    <font-awesome-icon icon="fa-solid fa-magnifying-glass" class="search-icon" />
    <input
      ref="input"
      :value="modelValue"
      :placeholder="placeholder"
      :type="inputType"
      :autocomplete="autocomplete"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <slot name="trailing" />
    <button v-if="clearable && modelValue" type="button" class="clear-btn" @click="$emit('update:modelValue', '')">
      <font-awesome-icon icon="fa-solid fa-xmark" />
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });
defineProps({
  modelValue:  { type: String, default: '' },
  placeholder: { type: String, default: 'Suchen…' },
  inputType: { type: String, default: 'text' },
  autocomplete: { type: String, default: 'off' },
  clearable: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);

const input = ref(null);
defineExpose({ focus: () => input.value?.focus() });
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.search-icon {
  color: var(--muted);
  flex-shrink: 0;
  font-size: 0.85rem;
}

input {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.9rem;
  width: 100%;
  outline: none;
  font-family: inherit;
}

input::placeholder {
  color: var(--muted);
}

.clear-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  display: flex;
  font-size: 0.8rem;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.clear-btn:hover {
  color: var(--text);
}

.search-bar--compact {
  min-height: 34px;
  box-sizing: border-box;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12.5px;
}

.search-bar--compact input {
  padding: 6px 0;
  font-size: inherit;
}
</style>
