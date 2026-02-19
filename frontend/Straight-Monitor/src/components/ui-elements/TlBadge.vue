<template>
  <span class="tl-badge">
    <font-awesome-icon icon="fa-solid fa-user-tie" class="tl-badge__icon" />
    TL
  </span>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
</script>

<style scoped>
.tl-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);
  vertical-align: middle;
  white-space: nowrap;
}

.tl-badge__icon {
  font-size: 10px;
}
</style>
