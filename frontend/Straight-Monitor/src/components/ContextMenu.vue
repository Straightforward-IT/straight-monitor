<template>
  <div class="context-menu-overlay" @click="$emit('close')">
    <div 
      class="context-menu"
      :style="{ top: y + 'px', left: x + 'px' }"
      @click.stop
    >
      <div 
        v-for="(option, idx) in options"
        :key="idx"
        class="context-menu-item"
        @click="selectOption(option)"
      >
        <span>{{ option.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  x: number;
  y: number;
  options: Array<{ label: string; action: string }>;
}>();

const emit = defineEmits<{
  close: [];
  select: [action: string];
}>();

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
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
  color: var(--text);
  z-index: 1001;
  min-width: 150px;
  overflow: hidden;

  .context-menu-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text);
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: var(--hover);
      color: var(--text);
    }
  }
}
</style>
