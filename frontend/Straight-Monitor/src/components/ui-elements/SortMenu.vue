<template>
  <div class="sort-menu">
    <button
      type="button"
      class="sort-menu__trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click.stop="toggleMenu"
    >
      <font-awesome-icon icon="fa-solid fa-arrow-up-wide-short" />
      {{ label }}
    </button>

    <ActionMenu
      :open="open"
      :x="position.x"
      :y="position.y"
      :width="width"
      :title="title"
      :items="menuItems"
      :group-by="false"
      @close="open = false"
      @item-click="handleItemClick"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import ActionMenu from '@/components/ui-elements/ActionMenu.vue';

const props = defineProps({
  modelValue: { type: String, required: true },
  ascending: { type: Boolean, default: true },
  options: { type: Array, required: true },
  label: { type: String, default: 'Sortieren' },
  title: { type: String, default: 'Sortierung' },
  width: { type: [Number, String], default: 220 },
});

const emit = defineEmits(['update:modelValue', 'update:ascending']);
const open = ref(false);
const position = ref({ x: 0, y: 0 });

const menuItems = computed(() => [
  ...props.options.map((option) => ({
    ...option,
    active: option.value === props.modelValue,
  })),
  { type: 'divider' },
  {
    value: 'direction',
    label: `Richtung: ${props.ascending ? 'Aufsteigend' : 'Absteigend'}`,
  },
]);

function toggleMenu(event) {
  if (open.value) {
    open.value = false;
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const menuWidth = typeof props.width === 'number' ? props.width : 220;
  position.value = { x: rect.right - menuWidth, y: rect.bottom + 4 };
  open.value = true;
}

function handleItemClick({ item }) {
  if (item.value === 'direction') {
    emit('update:ascending', !props.ascending);
    return;
  }
  emit('update:modelValue', item.value);
}
</script>

<style scoped>
.sort-menu {
  display: inline-flex;
  flex-shrink: 0;
}

.sort-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.sort-menu__trigger:hover {
  border-color: var(--primary);
  background: var(--hover);
  color: var(--primary);
}
</style>