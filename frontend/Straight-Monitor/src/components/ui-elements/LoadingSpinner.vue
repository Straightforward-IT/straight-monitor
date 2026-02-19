<template>
  <div class="loading-wrap">
    <div class="spinner" />
    <p v-if="label" class="label">{{ label }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' }
});
</script>

<style scoped>
.loading-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  color: var(--muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.label {
  font-size: 0.85rem;
  margin: 0;
  color: var(--muted);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
