<template>
  <div class="search-bar">
    <font-awesome-icon icon="fa-solid fa-magnifying-glass" class="search-icon" />
    <input
      :value="modelValue"
      :placeholder="placeholder"
      type="text"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <button v-if="modelValue" class="clear-btn" @click="$emit('update:modelValue', '')">
      <font-awesome-icon icon="fa-solid fa-xmark" />
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue:  { type: String, default: '' },
  placeholder: { type: String, default: 'Suchen…' }
});
defineEmits(['update:modelValue']);
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
</style>
