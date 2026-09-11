<template>
  <div class="context-menu-overlay" @click="$emit('close')">
    <div 
      ref="menuRef"
      class="context-menu"
      role="menu"
      :aria-label="title || 'Aktionen'"
      :style="{ top: menuPosition.y + 'px', left: menuPosition.x + 'px', minWidth: width + 'px' }"
      @click.stop
      @keydown="onMenuKeydown"
    >
      <div v-if="title" class="context-menu__title">{{ title }}</div>
      <div
        v-if="options.length"
        v-for="(option, idx) in options"
        :key="idx"
        class="context-menu-item"
        role="menuitem"
        :tabindex="option.disabled ? -1 : 0"
        :aria-disabled="Boolean(option.disabled)"
        :class="{ 'context-menu-item--special': option.special, 'context-menu-item--disabled': option.disabled }"
        @click="!option.disabled && selectOption(option)"
        @keydown.enter.prevent="!option.disabled && selectOption(option)"
        @keydown.space.prevent="!option.disabled && selectOption(option)"
      >
        <img v-if="option.image" :src="option.image" class="context-menu-item__image" alt="" />
        <FontAwesomeIcon v-if="option.icon" :icon="option.icon" class="context-menu-item__icon" />
        <span>{{ option.label }}</span>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const props = withDefaults(defineProps<{
  x: number;
  y: number;
  title?: string;
  anchor?: HTMLElement | null;
  followAnchor?: boolean;
  width?: number;
  offset?: number;
  focusOnOpen?: boolean;
  options?: Array<{ label: string; action: string; image?: string; icon?: string; special?: boolean; disabled?: boolean }>;
}>(), {
  anchor: null,
  followAnchor: false,
  width: 164,
  offset: 4,
  focusOnOpen: false,
  options: () => [],
});

const emit = defineEmits<{
  close: [];
  select: [action: string];
}>();
const menuPosition = ref({ x: props.x, y: props.y });
const menuRef = ref<HTMLElement | null>(null);

function updatePosition() {
  let x = props.x;
  let y = props.y;
  if (props.followAnchor && props.anchor) {
    const rect = props.anchor.getBoundingClientRect();
    x = rect.right - props.width;
    y = rect.bottom + props.offset;
  }
  const height = menuRef.value?.offsetHeight || 0;
  menuPosition.value = {
    x: Math.max(8, Math.min(x, window.innerWidth - props.width - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
  };
}

function onMenuKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const items = Array.from(menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"][aria-disabled="false"]') || []);
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  emit('close');
}

watch(() => [props.x, props.y, props.anchor, props.followAnchor], updatePosition, { immediate: true });

onMounted(() => {
  updatePosition();
  if (props.focusOnOpen) menuRef.value?.querySelector<HTMLElement>('[role="menuitem"][aria-disabled="false"]')?.focus();
  window.addEventListener('keydown', onKeydown, true);
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('scroll', updatePosition, true);
  window.removeEventListener('resize', updatePosition);
});

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
  padding: 2px 0;
  overflow: hidden;

  .context-menu__title {
    padding: 4px 12px 5px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    color: var(--muted);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .context-menu-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 27px;
    padding: 3px 10px 3px 12px;
    cursor: pointer;
    font-size: 0.76rem;
    line-height: 1.25;
    color: var(--text);
    transition: background 0.15s ease, color 0.15s ease;

    &:hover, &:focus-visible {
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      color: var(--primary);

      &::before { opacity: 1; }
    }

    &::before {
      position: absolute;
      top: 5px;
      bottom: 5px;
      left: 0;
      width: 2px;
      background: var(--primary);
      content: '';
      opacity: 0;
      transition: opacity 0.15s ease;
    }
  }

  .context-menu-item__image {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .context-menu-item__icon {
    width: 14px;
    color: var(--muted);
  }

  .context-menu-item:hover .context-menu-item__icon {
    color: var(--primary);
  }

  .context-menu-item--special {
    margin-bottom: 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    color: var(--primary);
    font-weight: 500;

    &:hover {
      color: var(--primary);
    }

    &::before { opacity: 1; }
  }

  .context-menu-item--disabled {
    color: var(--muted);
    cursor: not-allowed;
    opacity: 0.6;

    &:hover {
      background: transparent;
      color: var(--muted);
    }
  }
}
</style>
