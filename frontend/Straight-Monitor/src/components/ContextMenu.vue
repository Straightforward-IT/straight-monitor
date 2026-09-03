<template>
  <div class="context-menu-overlay" @click="$emit('close')">
    <div 
      class="context-menu"
      :style="{ top: y + 'px', left: x + 'px' }"
      @click.stop
    >
      <div v-if="title" class="context-menu__title">{{ title }}</div>
      <div 
        v-for="(option, idx) in options"
        :key="idx"
        class="context-menu-item"
        :class="{ 'context-menu-item--special': option.special }"
        @click="selectOption(option)"
      >
        <img v-if="option.image" :src="option.image" class="context-menu-item__image" alt="" />
        <span>{{ option.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

defineProps<{
  x: number;
  y: number;
  title?: string;
  options: Array<{ label: string; action: string; image?: string; special?: boolean }>;
}>();

const emit = defineEmits<{
  close: [];
  select: [action: string];
}>();

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  emit('close');
}

onMounted(() => window.addEventListener('keydown', onKeydown, true));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true));

function selectOption(option: any) {
  emit('select', option.action);
  emit('close');
}
</script>

<style scoped lang="scss">
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.context-menu {
  position: fixed;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
  color: var(--text);
  z-index: 1001;
  min-width: 164px;
  padding: 4px 0;
  overflow: hidden;

  .context-menu__title {
    padding: 5px 14px 7px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    color: var(--muted);
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .context-menu-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 5px 12px 5px 14px;
    cursor: pointer;
    font-size: 0.82rem;
    line-height: 1.25;
    color: var(--text);
    transition: background 0.15s ease, color 0.15s ease;

    &:hover {
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      color: var(--primary);

      &::before { opacity: 1; }
    }

    &::before {
      position: absolute;
      top: 7px;
      bottom: 7px;
      left: 0;
      width: 2px;
      background: var(--primary);
      content: '';
      opacity: 0;
      transition: opacity 0.15s ease;
    }
  }

  .context-menu-item__image {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }

  .context-menu-item--special {
    margin-bottom: 4px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    color: var(--primary);
    font-weight: 500;

    &:hover {
      color: var(--primary);
    }

    &::before { opacity: 1; }
  }
}
</style>
