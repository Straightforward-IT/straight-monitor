<template>
  <span v-if="count > 0" class="comment-bubble-badge">
    <font-awesome-icon icon="fa-solid fa-comment" class="comment-bubble-badge__icon" />
    <span class="comment-bubble-badge__num">{{ count > 99 ? '99+' : count }}</span>
  </span>
</template>

<script setup>
defineProps({
  count: {
    type: Number,
    required: true,
  },
});
</script>

<style scoped lang="scss">
.comment-bubble-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
  pointer-events: none;

  &__icon {
    color: #e53935;
    font-size: 1em; // scales with the parent font-size
    display: block;
  }

  &__num {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%); // -60% to account for the tail at the bottom
    color: #fff;
    font-size: 0.45em;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }
}
</style>
