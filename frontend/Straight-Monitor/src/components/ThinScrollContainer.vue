<template>
  <div class="thin-scroll" :style="containerStyle">
    <slot />
  </div>
</template>

<script>
export default {
  name: 'ThinScrollContainer',
  props: {
    height:    { type: String, default: '100%' },
    maxHeight: { type: String, default: undefined },
    axis:      { type: String, default: 'y' }, // 'y' | 'x' | 'both'
  },
  computed: {
    containerStyle() {
      return {
        height:     this.height,
        maxHeight:  this.maxHeight,
        overflowY:  this.axis !== 'x' ? 'auto' : 'hidden',
        overflowX:  this.axis !== 'y' ? 'auto' : 'hidden',
      };
    },
  },
};
</script>

<style scoped>
.thin-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--primary, #eeaf67) transparent;
}
.thin-scroll::-webkit-scrollbar {
  width: 3px;
  height: 3px;
}
.thin-scroll::-webkit-scrollbar-thumb {
  background: var(--primary, #eeaf67);
  border-radius: 999px;
  opacity: 0.7;
}
.thin-scroll::-webkit-scrollbar-track {
  background: transparent;
}
</style>
