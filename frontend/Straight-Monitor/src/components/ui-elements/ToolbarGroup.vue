<template>
  <div class="toolbar-group" :class="{ 'toolbar-group--push-right': pushRight }">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  pushRight: { type: Boolean, default: false },
});
</script>

<style scoped lang="scss">
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;

  &--push-right {
    margin-left: auto;
  }
}
</style>
