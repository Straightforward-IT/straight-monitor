<template>
  <div class="widget-prefs">
    <p v-if="showHint" class="widget-prefs__hint">
      Wähle sichtbare Widgets und ziehe sie in die gewünschte Reihenfolge.
    </p>

    <ul class="widget-prefs__list">
      <li
        v-for="(widget, index) in prefs.allowedWidgetOrder"
        :key="widget.id"
        class="widget-prefs__item"
        :class="{
          'widget-prefs__item--off': !widget.visible,
          'widget-prefs__item--drag-over': dragOverIndex === index,
        }"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="onDragOver(index)"
        @dragleave="dragOverIndex = null"
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
      >
        <font-awesome-icon :icon="['fas', 'grip-vertical']" class="widget-prefs__grip" />
        <div class="widget-prefs__info">
          <font-awesome-icon
            :icon="definitionFor(widget.id)?.icon || ['fas', 'cube']"
            class="widget-prefs__icon"
          />
          <div>
            <strong>{{ definitionFor(widget.id)?.title || widget.id }}</strong>
            <small>{{ definitionFor(widget.id)?.description }}</small>
          </div>
        </div>
        <label class="widget-prefs__toggle">
          <input
            type="checkbox"
            :checked="widget.visible"
            :aria-label="`${definitionFor(widget.id)?.title || widget.id} anzeigen`"
            @change="prefs.setVisible(widget.id, $event.target.checked)"
          >
          <span class="widget-prefs__toggle-track" />
        </label>
      </li>
    </ul>

    <AppButton v-if="showReset" variant="ghost" size="sm" class="widget-prefs__reset" @click="prefs.resetToDefaults()">
      <font-awesome-icon :icon="['fas', 'rotate-left']" />
      Zurücksetzen
    </AppButton>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useDashboardPrefs } from '@/stores/dashboardPrefs';
import { WIDGET_DEFINITIONS } from './widgetRegistry';
import AppButton from '@/components/ui-elements/AppButton.vue';

defineProps({
  showHint: { type: Boolean, default: true },
  showReset: { type: Boolean, default: true },
});

const prefs = useDashboardPrefs();
const dragSourceId = ref(null);
const dragOverIndex = ref(null);
const definitionFor = (id) => WIDGET_DEFINITIONS.find((definition) => definition.id === id);

function onDragStart(index, event) {
  dragSourceId.value = prefs.allowedWidgetOrder[index]?.id ?? null;
  event.dataTransfer.effectAllowed = 'move';
}

function onDragOver(index) {
  if (!dragSourceId.value || prefs.allowedWidgetOrder[index]?.id === dragSourceId.value) return;
  dragOverIndex.value = index;
}

function onDrop(index) {
  const targetId = prefs.allowedWidgetOrder[index]?.id;
  if (dragSourceId.value && targetId && dragSourceId.value !== targetId) {
    prefs.reorderWidgetByIds(dragSourceId.value, targetId);
  }
  onDragEnd();
}

function onDragEnd() {
  dragSourceId.value = null;
  dragOverIndex.value = null;
}
</script>

<style scoped lang="scss">
.widget-prefs { display: grid; gap: 12px; min-height: 0; }
.widget-prefs__hint { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.widget-prefs__list { display: grid; gap: 6px; min-height: 0; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.widget-prefs__item { display: flex; align-items: center; gap: 12px; min-height: 58px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--hover); cursor: grab; transition: opacity .2s ease, border-color .15s ease, background .15s ease; }
.widget-prefs__item:active { cursor: grabbing; }
.widget-prefs__item--off { opacity: .5; }
.widget-prefs__item--drag-over { border-color: var(--primary); background: color-mix(in srgb, var(--hover) 80%, var(--primary)); }
.widget-prefs__grip { flex: 0 0 auto; color: var(--muted); opacity: .55; }
.widget-prefs__info { display: flex; flex: 1; align-items: center; min-width: 0; gap: 12px; }
.widget-prefs__info strong, .widget-prefs__info small { display: block; }
.widget-prefs__info strong { color: var(--text); font-size: 14px; }
.widget-prefs__info small { margin-top: 2px; color: var(--muted); font-size: 12px; }
.widget-prefs__icon { width: 20px; flex: 0 0 auto; color: var(--primary); text-align: center; }
.widget-prefs__toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex: 0 0 auto; cursor: pointer; }
.widget-prefs__toggle input { position: absolute; width: 0; height: 0; opacity: 0; }
.widget-prefs__toggle-track { position: absolute; inset: 0; border-radius: 11px; background: var(--border); transition: background .2s ease; }
.widget-prefs__toggle-track::after { position: absolute; bottom: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; content: ''; transition: transform .2s ease; }
.widget-prefs__toggle input:checked + .widget-prefs__toggle-track { background: var(--primary); }
.widget-prefs__toggle input:checked + .widget-prefs__toggle-track::after { transform: translateX(18px); }
.widget-prefs__toggle input:focus-visible + .widget-prefs__toggle-track { outline: 2px solid var(--primary); outline-offset: 2px; }
.widget-prefs__reset { width: fit-content; justify-self: start; --action-ghost-text: var(--muted); }
</style>
