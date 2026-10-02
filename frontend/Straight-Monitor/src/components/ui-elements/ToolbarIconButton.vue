<template>
  <AppIconButton
    v-bind="$attrs"
    class="toolbar-icon-btn"
    :class="{ 'toolbar-icon-btn--active': active }"
    :label="label || title"
    :title="title"
    :active="active"
    type="button"
  >
    <slot />
  </AppIconButton>
</template>

<script setup>
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

defineOptions({ inheritAttrs: false });

defineProps({
  active: { type: Boolean, default: null },
  label: { type: String, default: '' },
  title: { type: String, default: '' },
});
</script>

<style scoped lang="scss">
.toolbar-icon-btn {
  --app-button-icon-size: 34px;
  width: 34px;
  height: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 6px;
  flex-shrink: 0;
}
</style>
