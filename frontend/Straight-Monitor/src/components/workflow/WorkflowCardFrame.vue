<template>
  <article
    class="workflow-card"
    :class="{ 'workflow-card--active': active, 'workflow-card--draggable': draggable }"
    :tabindex="interactive ? 0 : undefined"
    :role="interactive ? 'button' : undefined"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <header v-if="$slots.header" class="workflow-card__header"><slot name="header" /></header>
    <div v-if="$slots.meta" class="workflow-card__meta"><slot name="meta" /></div>
    <div v-if="$slots.default" class="workflow-card__body"><slot /></div>
    <footer v-if="$slots.footer" class="workflow-card__footer"><slot name="footer" /></footer>
  </article>
</template>

<script setup>
const props = defineProps({
  active: { type: Boolean, default: false },
  draggable: { type: Boolean, default: true },
  interactive: { type: Boolean, default: true },
});

const emit = defineEmits(['open']);
function open() {
  if (props.interactive) emit('open');
}
</script>

<style scoped lang="scss">
.workflow-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  transition: box-shadow .15s, border-color .15s, transform .05s;
  user-select: none;
}
.workflow-card--draggable { cursor: grab; }
.workflow-card--draggable:active { cursor: grabbing; }
.workflow-card:hover { border-color: color-mix(in srgb, var(--border) 55%, var(--text)); box-shadow: 0 6px 16px rgba(0, 0, 0, .16); }
.workflow-card--active { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent); }
.workflow-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.workflow-card__header, .workflow-card__meta, .workflow-card__body, .workflow-card__footer { min-width: 0; }
.workflow-card__footer { border-top: 1px solid var(--border); padding-top: 6px; }
</style>
