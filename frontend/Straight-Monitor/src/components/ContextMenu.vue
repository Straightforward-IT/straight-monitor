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
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  min-width: 150px;

  .context-menu-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;

    &:hover {
      background: #f0f0f0;
    }

    &:first-child {
      border-radius: 4px 4px 0 0;
    }

    &:last-child {
      border-radius: 0 0 4px 4px;
    }
  }
}
</style>
