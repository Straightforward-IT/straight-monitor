<template>
  <span class="filter-divider"></span>
</template>

<script>
export default {
  name: "FilterDivider"
};
</script>

<style scoped>
.filter-divider {
  width: 2px;
  height: 32px;
  background: linear-gradient(to bottom, 
    transparent 0%,
    var(--border) 20%,
    var(--border) 80%,
    transparent 100%);
  border-radius: 1px;
  margin: 0 4px;
  display: inline-block;
  vertical-align: middle;
}
</style>
