<template>
  <fieldset class="information-card" :class="{ 'information-card--interactive': interactive, 'information-card--highlighted': highlighted, 'information-card--inactive': inactive, 'information-card--without-legend': !$slots.legend }">
    <legend v-if="$slots.legend" class="information-card__legend"><slot name="legend" /></legend>
    <header class="information-card__header">
      <div v-if="$slots.icon" class="information-card__icon"><slot name="icon" /></div>
      <div class="information-card__title"><slot name="title" /></div>
      <div v-if="$slots.actions" class="information-card__actions"><slot name="actions" /></div>
    </header>
    <div class="information-card__body"><slot /></div>
  </fieldset>
</template>

<script setup>
defineProps({
  interactive: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false },
  inactive: { type: Boolean, default: false },
});
</script>

<style scoped>
.information-card {
  min-width: 0;
  margin: 0;
  padding: 12px 16px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.information-card--interactive {
  cursor: pointer;
  transition: border-color 0.15s;
}

.information-card--interactive:hover,
.information-card--highlighted {
  border-color: var(--primary);
}

.information-card--highlighted {
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
}

.information-card--inactive {
  opacity: 0.62;
}

.information-card--without-legend {
  padding-top: 25px;
}

.information-card__legend {
  max-width: calc(100% - 16px);
  padding: 0 7px;
  color: var(--primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.information-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.information-card__icon {
  display: flex;
  flex: 0 0 auto;
}

.information-card__title {
  flex: 1;
  min-width: 0;
  color: var(--text);
  font-weight: 600;
}

.information-card__actions {
  display: flex;
  flex: 0 0 auto;
  margin-left: auto;
}

.information-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
</style>