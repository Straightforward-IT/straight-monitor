<template>
  <span v-if="count > 0" class="count-badge" :class="colorClass">
    {{ display }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  count: { type: Number, default: 0 },
  max: { type: Number, default: 99 },
  color: { type: String, default: 'red' } // red | orange | blue | green
});

const display = computed(() =>
  props.count > props.max ? `${props.max}+` : String(props.count)
);

const colorClass = computed(() => `badge--${props.color}`);
</script>

<style scoped>
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  flex-shrink: 0;
}

/* Color variants */
.badge--red {
  background: #ef4444;
}

.badge--orange {
  background: var(--primary, #ff7518);
}

.badge--blue {
  background: #3b82f6;
}

.badge--green {
  background: #10b981;
}
</style>
