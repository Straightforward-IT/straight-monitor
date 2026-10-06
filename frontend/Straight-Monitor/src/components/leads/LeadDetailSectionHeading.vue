<template>
  <h4 class="section-title" :class="{ 'section-title--mobile-clickable': mobile }">
    <button
      v-if="mobile"
      type="button"
      class="section-disclosure"
      :aria-expanded="expanded"
      @click="$emit('toggle')"
    >
      <font-awesome-icon :icon="icon" aria-hidden="true" />
      <span>{{ title }}</span>
      <span v-if="count" class="section-count">{{ count }}</span>
      <font-awesome-icon class="section-chevron" :icon="['fas', expanded ? 'chevron-up' : 'chevron-down']" aria-hidden="true" />
    </button>
    <template v-else>
      <font-awesome-icon :icon="icon" aria-hidden="true" />
      {{ title }}
      <span v-if="count" class="section-count">{{ count }}</span>
    </template>
  </h4>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

defineProps({
  title: { type: String, required: true },
  icon: { type: Array, required: true },
  mobile: { type: Boolean, default: false },
  expanded: { type: Boolean, default: true },
  count: { type: Number, default: 0 },
});

defineEmits(['toggle']);
</script>

<style scoped lang="scss">
.section-title--mobile-clickable { min-height: 44px; }

.section-disclosure {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  text-transform: inherit;

  &:hover { background: var(--action-ghost-hover); }
  &:focus-visible { outline: 2px solid var(--control-focus-ring); outline-offset: 2px; }
}

.section-chevron { margin-left: auto; color: var(--muted); font-size: 12px; }
.section-count {
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--action-ghost-hover);
  color: var(--action-accent-text);
  font-size: 0.7rem;
  font-weight: 600;
}
</style>
