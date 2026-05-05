<template>
  <div class="search-bar-root" :class="{ 'search-bar--focused': isFocused }">
    <font-awesome-icon icon="fa-solid fa-magnifying-glass" class="search-bar-icon" />
    <input
      ref="inputEl"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="ariaLabel || placeholder"
      type="text"
      @input="$emit('update:modelValue', $event.target.value)"
      @focus="isFocused = true"
      @blur="isFocused = false"
      @keydown.escape="$emit('update:modelValue', '')"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faMagnifyingGlass);

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Suchen...' },
  ariaLabel: { type: String, default: '' },
});

defineEmits(['update:modelValue']);

const inputEl = ref(null);
const isFocused = ref(false);

function onKeydown(e) {
  if (e.key !== 's' && e.key !== 'S') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  e.preventDefault();
  inputEl.value?.focus();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped lang="scss">
.search-bar-root {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--tile-bg, var(--surface));
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.07), 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: border-color 0.2s, box-shadow 0.2s;

  &.search-bar--focused {
    border-color: var(--primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  .search-bar-icon {
    color: var(--muted);
    flex-shrink: 0;
    font-size: 0.85rem;
  }

  input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 0.9rem;
    outline: none;
    min-width: 0;

    &::placeholder {
      color: var(--muted);
    }
  }
}
</style>
