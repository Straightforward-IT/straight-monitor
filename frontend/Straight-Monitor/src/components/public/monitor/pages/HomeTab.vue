<template>
  <section class="public-monitor-page public-monitor-home-tab">
    <section class="welcome-row">
      <div><span>{{ formattedToday }}</span><h2>Hallo, {{ vorname }}!</h2></div>
      <span class="prototype-pill">DEV</span>
    </section>

    <section v-if="nextEinsatz" class="today-shift">
      <div class="shift-topline"><span>{{ nextEinsatzDate }} · {{ einsatzTime(nextEinsatz) }}</span><span>{{ nextEinsatzRole }}</span></div>
      <h3>{{ nextEinsatzTitle }}</h3>
      <p><font-awesome-icon icon="fa-solid fa-location-dot" /> {{ nextEinsatzLocation }}</p>
      <button class="primary-button" type="button" @click="$emit('open-calendar-job', nextEinsatz)"><font-awesome-icon icon="fa-solid fa-chevron-right" />Einsatz ansehen</button>
    </section>
    <section v-else class="today-shift today-shift--empty">
      <div class="shift-topline"><span>Nächster Einsatz</span></div>
      <h3>Du hast keinen Job heute.</h3>
      <p>Genieß deinen Tag!</p>
      <button class="secondary-button wide" type="button" @click="$emit('select-tab', 'calendar')"><font-awesome-icon icon="fa-solid fa-calendar-days" />Kalender öffnen</button>
    </section>

    <PublicUpcomingJobs :einsaetze="upcomingEinsaetze" @open-job="$emit('open-calendar-job', $event)" />

    <section class="home-section">
      <div class="section-heading"><h3>Jobangebote</h3><button type="button" @click="$emit('select-tab', 'jobs')">Alle</button></div>
      <button v-for="job in jobs.slice(0, 2)" :key="job.id" class="compact-job" type="button" @click="$emit('open-job', job)"><span class="job-date"><strong>{{ dayNumber(job.dateFrom) }}</strong>{{ monthShort(job.dateFrom) }}</span><span><strong>{{ job.title }}</strong><small>{{ job.role || 'Tätigkeit offen' }} · {{ jobTime(job) }}</small></span><span class="places">{{ job.openPlaces }} frei</span></button>
    </section>
  </section>
</template>

<script setup>
import PublicUpcomingJobs from '@/components/public/PublicUpcomingJobs.vue';

defineProps({
  dayNumber: { type: Function, required: true },
  einsatzTime: { type: Function, required: true },
  formattedToday: { type: String, default: '' },
  jobTime: { type: Function, required: true },
  jobs: { type: Array, default: () => [] },
  monthShort: { type: Function, required: true },
  nextEinsatz: { type: Object, default: null },
  nextEinsatzDate: { type: String, default: '' },
  nextEinsatzLocation: { type: String, default: '' },
  nextEinsatzRole: { type: String, default: '' },
  nextEinsatzTitle: { type: String, default: '' },
  upcomingEinsaetze: { type: Array, default: () => [] },
  vorname: { type: String, default: '' },
});

defineEmits(['open-calendar-job', 'open-job', 'select-tab']);
</script>
