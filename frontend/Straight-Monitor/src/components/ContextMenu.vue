<template>
  <div class="context-menu-overlay" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
    <div 
      ref="menuRef"
      class="context-menu"
      role="menu"
      :aria-label="title || 'Aktionen'"
      :style="{ top: menuPosition.y + 'px', left: menuPosition.x + 'px', minWidth: width + 'px' }"
      @click.stop
      @contextmenu.stop
      @keydown="onMenuKeydown"
    >
      <div v-if="title" class="context-menu__title">{{ title }}</div>
      <template v-for="(option, idx) in options" :key="idx">
        <div v-if="option.type === 'divider'" class="context-menu__divider" />
        <div
          v-else
          class="context-menu-item"
          role="menuitem"
          :tabindex="option.disabled ? -1 : 0"
          :aria-disabled="Boolean(option.disabled)"
          :class="[
            option.variant && `context-menu-item--${option.variant}`,
            {
              'context-menu-item--special': option.special,
              'context-menu-item--disabled': option.disabled,
              'context-menu-item--has-children': hasChildren(option),
            }
          ]"
          :aria-haspopup="hasChildren(option) ? 'menu' : undefined"
          :aria-expanded="hasChildren(option) ? activeSubmenuIndex === idx : undefined"
          @mouseenter="handleOptionHover(idx, $event, option)"
          @click="!option.disabled && handleOptionClick(idx, $event, option)"
          @keydown.enter.prevent="!option.disabled && handleOptionClick(idx, $event, option)"
          @keydown.space.prevent="!option.disabled && handleOptionClick(idx, $event, option)"
          @keydown.arrow-right.prevent="openSubmenu(idx, $event, option, true)"
        >
          <img v-if="option.image" :src="option.image" class="context-menu-item__image" alt="" />
          <FontAwesomeIcon v-if="option.icon" :icon="option.icon" class="context-menu-item__icon" />
          <span>{{ option.label }}</span>
          <FontAwesomeIcon v-if="hasChildren(option)" :icon="['fas', 'chevron-right']" class="context-menu-item__chevron" />

          <div
            v-if="hasChildren(option) && activeSubmenuIndex === idx"
            ref="submenuRef"
            class="context-submenu"
            role="menu"
            :style="submenuStyle"
            @mouseenter="activeSubmenuIndex = idx"
          >
            <template v-for="(child, childIdx) in option.children" :key="childIdx">
              <div v-if="child.type === 'divider'" class="context-menu__divider" />
              <div
                v-else
                class="context-menu-item"
                role="menuitem"
                :tabindex="child.disabled ? -1 : 0"
                :aria-disabled="Boolean(child.disabled)"
                :class="[
                  child.variant && `context-menu-item--${child.variant}`,
                  { 'context-menu-item--special': child.special, 'context-menu-item--disabled': child.disabled }
                ]"
                @click.stop="!child.disabled && selectOption(child)"
                @keydown.enter.prevent.stop="!child.disabled && selectOption(child)"
                @keydown.space.prevent.stop="!child.disabled && selectOption(child)"
                @keydown.arrow-left.prevent.stop="closeSubmenu(idx)"
              >
                <img v-if="child.image" :src="child.image" class="context-menu-item__image" alt="" />
                <FontAwesomeIcon v-if="child.icon" :icon="child.icon" class="context-menu-item__icon" />
                <span>{{ child.label }}</span>
              </div>
            </template>
          </div>
        </div>
      </template>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(faChevronRight);

const props = withDefaults(defineProps<{
  x: number;
  y: number;
  title?: string;
  anchor?: HTMLElement | null;
  followAnchor?: boolean;
  width?: number;
  offset?: number;
  focusOnOpen?: boolean;
  options?: Array<{
    label?: string;
    action?: string;
    type?: 'divider';
    image?: string;
    icon?: string | string[];
    special?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'danger' | 'muted';
    children?: any[];
  }>;
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
const submenuRef = ref<HTMLElement | HTMLElement[] | null>(null);
const activeSubmenuIndex = ref<number | null>(null);
const submenuStyle = ref<Record<string, string>>({});

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

function hasChildren(option: any) {
  return Array.isArray(option.children) && option.children.some(child => child.type !== 'divider');
}

function getSubmenuElement() {
  return Array.isArray(submenuRef.value) ? submenuRef.value[0] : submenuRef.value;
}

async function openSubmenu(index: number, event: MouseEvent | KeyboardEvent, option: any, focusFirst = false) {
  if (!hasChildren(option) || option.disabled) return;
  activeSubmenuIndex.value = index;
  await nextTick();

  const target = event.currentTarget as HTMLElement | null;
  const submenu = getSubmenuElement();
  if (!target || !submenu) return;

  const parentRect = target.getBoundingClientRect();
  const submenuWidth = submenu.offsetWidth;
  const submenuHeight = submenu.offsetHeight;
  const opensLeft = parentRect.right + submenuWidth > window.innerWidth - 8;
  submenuStyle.value = {
    left: opensLeft ? `${-submenuWidth + 4}px` : `${parentRect.width - 4}px`,
    top: `${Math.max(-(parentRect.top - 8), Math.min(0, window.innerHeight - 8 - parentRect.top - submenuHeight))}px`,
  };

  if (focusFirst) {
    submenu.querySelector<HTMLElement>('[role="menuitem"][aria-disabled="false"]')?.focus();
  }
}

function closeSubmenu(index: number) {
  if (activeSubmenuIndex.value === index) activeSubmenuIndex.value = null;
}

function handleOptionHover(index: number, event: MouseEvent, option: any) {
  if (!hasChildren(option)) {
    activeSubmenuIndex.value = null;
    return;
  }
  void openSubmenu(index, event, option);
}

function handleOptionClick(index: number, event: MouseEvent | KeyboardEvent, option: any) {
  if (hasChildren(option)) {
    void openSubmenu(index, event, option, true);
    return;
  }
  selectOption(option);
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
  z-index: 2000;
}

.context-menu {
  position: fixed;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
  color: var(--text);
  z-index: 2001;
  min-width: 164px;
  padding: 2px 0;
  overflow: visible;

  .context-menu__title {
    padding: 4px 12px 5px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    color: var(--muted);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .context-menu__divider {
    height: 1px;
    margin: 2px 0;
    background: color-mix(in srgb, var(--border) 72%, transparent);
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

    &--has-children > span { flex: 1; }
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

  .context-menu-item__chevron {
    width: 10px;
    margin-left: auto;
    color: var(--muted);
    font-size: 0.65rem;
  }

  .context-submenu {
    position: absolute;
    min-width: 164px;
    padding: 2px 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--tile-bg);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
    color: var(--text);
    z-index: 1;
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

  .context-menu-item--primary {
    color: var(--primary);
  }

  .context-menu-item--danger {
    color: #dc3545;
  }
}
</style>
