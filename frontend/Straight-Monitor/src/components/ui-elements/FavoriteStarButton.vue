<template>
  <button
    class="favorite-star-button"
    :class="{ active }"
    :title="active ? activeTitle : inactiveTitle"
    type="button"
    @click.stop="$emit('toggle', $event)"
  >
    <font-awesome-icon :icon="active ? 'fa-solid fa-star' : 'fa-regular fa-star'" />
  </button>
</template>

<script setup>
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  activeTitle: {
    type: String,
    default: 'Favorit entfernen',
  },
  inactiveTitle: {
    type: String,
    default: 'Als Favorit markieren',
  },
});

defineEmits(['toggle']);
</script>

<style scoped>
.favorite-star-button {
  flex-shrink: 0;
  padding: 2px;
  border: none;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  transition: color 0.15s, transform 0.15s;
}

.favorite-star-button.active,
.favorite-star-button:hover {
  color: var(--primary);
}

.favorite-star-button:hover {
  transform: scale(1.2);
}
</style>
