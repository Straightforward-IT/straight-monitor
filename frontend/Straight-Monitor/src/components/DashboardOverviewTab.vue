<template>
  <section class="dash">
    <TransitionGroup name="widget-anim" tag="div" class="widget-grid">
      <component v-for="widget in activeWidgets" :key="widget.id" :is="widget.component" />
      <button key="__add__" class="add-widget-tile" type="button" title="Dashboard anpassen" @click="showConfigurator = true">
        <font-awesome-icon :icon="['fas', 'plus']" />
        <span>Anpassen</span>
      </button>
    </TransitionGroup>
    <WidgetConfigurator :visible="showConfigurator" @close="showConfigurator = false" />
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import WidgetConfigurator from '@/components/widgets/WidgetConfigurator.vue';

defineProps({ activeWidgets: { type: Array, default: () => [] } });
const showConfigurator = ref(false);
</script>

<style scoped lang="scss">
.dash { display: flex; flex-direction: column; gap: 20px; }
.widget-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
.add-widget-tile {
  aspect-ratio: 1 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 4%, transparent); color: var(--primary); transform: translateY(-2px); }
  :deep(svg) { font-size: 32px; opacity: 0.4; transition: opacity 0.2s ease; }
  &:hover :deep(svg) { opacity: 0.8; }
  span { font-size: 13px; font-weight: 500; }
}
.widget-anim-enter-active, .widget-anim-leave-active { transition: all 0.3s ease; }
.widget-anim-enter-from, .widget-anim-leave-to { opacity: 0; transform: scale(0.9); }
.widget-anim-move { transition: transform 0.3s ease; }
@media (max-width: 768px) { .widget-grid { grid-template-columns: 1fr; } }
</style>
