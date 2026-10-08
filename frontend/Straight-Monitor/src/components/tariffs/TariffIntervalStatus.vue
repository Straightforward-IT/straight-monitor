<template>
  <span class="tariff-interval-status" :class="{ 'tariff-interval-status--ineffective': status === 'INEFFECTIVE' }">
    {{ status === 'INEFFECTIVE' ? 'Unwirksam · Ende vor Beginn' : 'Gültiger Zeitraum' }}
  </span>
</template>

<script setup>
defineProps({ status: { type: String, default: 'VALID' } });
</script>

<style scoped>
.tariff-interval-status { display: inline-block; padding: 4px 7px; border: 1px solid var(--border); border-radius: var(--control-radius, 8px); color: var(--text); font-size: .78rem; line-height: 1.4; }
.tariff-interval-status--ineffective { border-color: var(--warning, #c38d20); background: color-mix(in srgb, var(--warning, #c38d20) 12%, var(--panel)); font-weight: 600; }
</style>
