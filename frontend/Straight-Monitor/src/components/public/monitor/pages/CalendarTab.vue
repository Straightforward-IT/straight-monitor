<template>
  <section class="public-monitor-page public-monitor-calendar-tab">
    <PublicKalender
      :einsaetze="einsaetze"
      :is-teamleiter="false"
      :api="api"
      :email="email"
      @open-job="$emit('open-job', $event)"
    />
  </section>
</template>

<script setup>
import PublicKalender from '@/components/public/PublicKalender.vue';

defineProps({
  api: { type: [Function, Object], required: true },
  einsaetze: { type: Array, default: () => [] },
  email: { type: String, default: '' },
});

defineEmits(['open-job']);
</script>
