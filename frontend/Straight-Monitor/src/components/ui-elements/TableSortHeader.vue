<template>
  <th scope="col" :aria-sort="sort" class="table-sort-header">
    <button type="button" :title="`${label} ${sort === 'ascending' ? 'absteigend' : 'aufsteigend'} sortieren`" @click="$emit('sort')">
      {{ label }}<span aria-hidden="true">{{ sort === 'ascending' ? '↑' : sort === 'descending' ? '↓' : '↕' }}</span>
    </button>
  </th>
</template>

<script setup>
defineProps({ label: { type: String, required: true }, sort: { type: String, default: 'none' } });
defineEmits(['sort']);
</script>

<style scoped>
.table-sort-header { padding: 0; }
.table-sort-header button { display: inline-flex; align-items: center; justify-content: inherit; gap: 6px; width: 100%; padding: 6px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: inherit; cursor: pointer; }
.table-sort-header button:hover { color: var(--text); background: color-mix(in srgb, var(--primary) 8%, transparent); }
.table-sort-header button:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.table-sort-header span { opacity: .65; font-size: 11px; }
</style>
