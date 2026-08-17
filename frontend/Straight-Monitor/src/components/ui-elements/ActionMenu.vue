<template>
  <teleport to="body">
    <div
      v-if="open"
      class="action-menu-overlay"
      @click="closeMenu"
      @contextmenu.prevent="closeMenu"
    >
      <div
        class="action-menu"
        :class="[`action-menu--${variant}`]"
        :style="menuStyle"
        @click.stop
      >
        <slot name="header">
          <div v-if="title" class="action-menu__header">{{ title }}</div>
        </slot>

        <template v-if="Array.isArray(items) && items.length">
          <template v-for="(group, groupIndex) in normalizedGroups" :key="group.key ?? groupIndex">
            <div v-if="group.label" class="action-menu__group-label">
              {{ group.label }}
            </div>

            <template v-for="(item, itemIndex) in group.items" :key="item.id ?? item.value ?? item.label ?? `${groupIndex}-${itemIndex}`">
              <div v-if="item.type === 'divider'" class="action-menu__divider" />
              <button
                v-else
                type="button"
                class="action-menu__item"
                :class="[
                  item.className,
                  item.variant && `action-menu__item--${item.variant}`,
                  item.color && 'action-menu__item--custom',
                  item.active && 'is-active'
                ]"
                :style="item.color ? { '--action-menu-item-color': item.color } : undefined"
                :disabled="item.disabled"
                @click="onItemClick(item, $event)"
              >
                <font-awesome-icon v-if="item.icon" :icon="item.icon" class="action-menu__icon" />
                <span class="action-menu__label">{{ item.label }}</span>
                <span v-if="item.badge !== undefined && item.badge !== null" class="action-menu__badge">{{ item.badge }}</span>
                <font-awesome-icon
                  v-else-if="item.iconRight"
                  :icon="item.iconRight"
                  class="action-menu__icon action-menu__icon--right"
                />
              </button>
            </template>
          </template>
        </template>

        <slot />
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  x: {
    type: Number,
    default: 0,
  },
  y: {
    type: Number,
    default: 0,
  },
  title: {
    type: String,
    default: '',
  },
  width: {
    type: [Number, String],
    default: 200,
  },
  variant: {
    type: String,
    default: 'default',
  },
  items: {
    type: Array,
    default: () => [],
  },
  groupBy: {
    type: [String, Boolean],
    default: 'group',
  },
  closeOnSelect: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['close', 'item-click']);

const menuStyle = computed(() => ({
  top: `${props.y}px`,
  left: `${props.x}px`,
  minWidth: typeof props.width === 'number' ? `${props.width}px` : props.width,
}));

const normalizedGroups = computed(() => {
  const source = Array.isArray(props.items) ? props.items : [];

  if (!source.length) return [];

  if (props.groupBy === false) {
    return [{ key: 'default', label: '', items: source }];
  }

  const groups = new Map();

  for (const item of source) {
    if (item?.type === 'divider') {
      const key = `divider-${groups.size}`;
      if (!groups.has(key)) {
        groups.set(key, { key, label: '', items: [] });
      }
      groups.get(key).items.push(item);
      continue;
    }

    const key = item?.group ?? item?.groupKey ?? 'default';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: item?.groupLabel ?? '',
        items: [],
      });
    }

    groups.get(key).items.push(item);
  }

  return [...groups.values()];
});

function closeMenu() {
  emit('close');
}

function onItemClick(item, event) {
  if (item?.disabled) return;
  emit('item-click', { item, event });
  if (props.closeOnSelect) {
    closeMenu();
  }
}
</script>

<style scoped>
.action-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.action-menu {
  position: fixed;
  background: var(--modal-bg, #fff);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 1001;
  padding: 4px 0;
  overflow: hidden;
}

.action-menu__header {
  padding: 6px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  pointer-events: none;
}

.action-menu__group-label {
  padding: 8px 14px 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.action-menu__divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.action-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 14px;
  background: transparent;
  border: none;
  font-size: 13px;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;
}

.action-menu__item:hover {
  background: var(--hover);
}

.action-menu__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-menu__item.is-active {
  color: var(--primary);
  font-weight: 600;
}

.action-menu__item--success { color: #10b981; }
.action-menu__item--warning { color: #f59e0b; }
.action-menu__item--danger { color: #ef4444; }
.action-menu__item--purple { color: #a855f7; }
.action-menu__item--primary { color: var(--primary); }
.action-menu__item--muted { color: var(--muted); }
.action-menu__item--custom {
  color: var(--action-menu-item-color, var(--primary));
}

.action-menu__label {
  flex: 1;
  min-width: 0;
}

.action-menu__icon {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.action-menu__icon--right {
  margin-left: auto;
  opacity: 0.6;
}

.action-menu__badge {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  font-size: 10px;
  font-weight: 700;
}
</style>
