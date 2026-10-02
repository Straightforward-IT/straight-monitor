<template>
  <AppButton
    v-bind="$attrs"
    class="toolbar-btn"
    :class="`toolbar-btn--${variant}`"
    :variant="appVariant"
    type="button"
  >
    <slot />
  </AppButton>
</template>

<script setup>
import { computed } from 'vue';
import AppButton from '@/components/ui-elements/AppButton.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    // 'primary' | 'secondary' | 'outlined' | 'menu'
  },
});

const appVariant = computed(() => props.variant === 'menu' ? 'secondary' : props.variant);
</script>

<style scoped lang="scss">
.toolbar-btn {
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
