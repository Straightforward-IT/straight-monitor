<template>
  <aside class="ip-panel" :class="{ 'ip-panel--collapsed': collapsed }" :style="{ '--ip-width': width }">
    <button
      type="button"
      class="ip-panel__toggle"
      :aria-expanded="String(!collapsed)"
      :aria-label="collapsed ? `${label} ausklappen` : `${label} einklappen`"
      :title="collapsed ? `${label} ausklappen` : `${label} einklappen`"
      @click="emit('update:collapsed', !collapsed)"
    >
      <font-awesome-icon :icon="collapsed ? 'fa-solid fa-chevron-left' : 'fa-solid fa-chevron-right'" />
    </button>
    <div class="ip-panel__surface">
      <header v-if="hasHeader" class="ip-panel__header">
        <div class="ip-panel__heading">
          <slot name="header">
            <h2 v-if="title" class="ip-panel__title">{{ title }}</h2>
            <p v-if="subtitle" class="ip-panel__subtitle">{{ subtitle }}</p>
          </slot>
        </div>
        <div class="ip-panel__actions">
          <slot name="actions" />
          <button
            v-if="showClose"
            type="button"
            class="ip-panel__close"
            aria-label="Schließen"
            title="Schließen"
            @click="emit('close')"
          >
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
      </header>
      <div class="ip-panel__content">
        <slot />
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, useSlots } from 'vue';

const props = defineProps({
  collapsed: { type: Boolean, default: false },
  width: { type: String, default: '310px' },
  label: { type: String, default: 'Seitenleiste' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  showClose: { type: Boolean, default: true },
});

const emit = defineEmits(['update:collapsed', 'close']);
const slots = useSlots();
const hasHeader = computed(() => props.title || props.subtitle || slots.header || slots.actions || props.showClose);
</script>

<style scoped lang="scss">
.ip-panel {
  display: flex;
  flex: 0 0 calc(var(--ip-width) + 20px);
  min-width: 20px;
  overflow: hidden;
  transition: flex-basis 0.25s ease;
}

.ip-panel--collapsed { flex-basis: 20px; }

.ip-panel__toggle {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  padding: 0;
  border: 0;
  border-right: 1px solid var(--border);
  border-left: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.ip-panel__toggle:hover { background: var(--hover); color: var(--primary); }
.ip-panel__toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }

.ip-panel__surface {
  display: flex;
  flex: 0 0 var(--ip-width);
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border-radius: 0 0 14px 0;
  background: var(--bg);
}

.ip-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.ip-panel__heading { min-width: 0; flex: 1; }
.ip-panel__title { margin: 0; color: var(--text); font-size: 1.1rem; }
.ip-panel__subtitle { margin: 3px 0 0; color: var(--muted); font-size: 0.8rem; }
.ip-panel__actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.ip-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  cursor: pointer;
}

.ip-panel__close:hover { background: var(--hover); border-color: var(--border); color: var(--text); }
.ip-panel__close:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }

.ip-panel__content { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.ip-panel__content > :deep(*) { flex: 1; min-width: 0; min-height: 0; }
</style>