<template>
  <section class="public-monitor-page public-monitor-jobs-tab">
    <div class="intro-row"><div><h2>Jobangebote</h2><p>Finde deinen nächsten Einsatz.</p></div><span v-if="jobsAreFixtures" class="source-badge">Demo</span></div>
    <div class="filter-row"><button type="button" :class="{ active: jobFilter === 'all' }" @click="$emit('filter', 'all')">Alle</button><button v-for="role in jobRoles" :key="role" type="button" :class="{ active: jobFilter === role }" @click="$emit('filter', role)">{{ role }}</button></div>
    <div v-if="jobsLoading" class="loading-row"><font-awesome-icon icon="fa-solid fa-spinner" spin /> Jobs werden geladen</div>
    <div v-else-if="jobsError && !jobs.length" class="empty-state"><strong>Keine Jobs verfügbar</strong><p>{{ jobsError }}</p></div>
    <button v-for="job in filteredJobs" :key="job.id" class="job-card" type="button" @click="$emit('open-job', job)">
      <div class="job-card-date"><strong>{{ weekday(job.dateFrom) }}</strong><span>{{ shortDate(job.dateFrom) }}</span></div>
      <div class="job-card-body"><div class="job-card-title"><h3>{{ job.title }}</h3><span v-if="applicationStatus(job.id)" class="mini-status">{{ applicationLabel(applicationStatus(job.id)) }}</span></div><p>{{ job.role || 'Tätigkeit noch offen' }}</p><div class="job-meta"><span><font-awesome-icon icon="fa-solid fa-clock" /> {{ jobTime(job) }}</span><span><font-awesome-icon icon="fa-solid fa-location-dot" /> {{ job.city || job.locationName || 'Ort offen' }}</span></div><div class="job-card-footer"><span>{{ job.hourlyWage || 'Vergütung folgt' }}</span><strong>Noch {{ job.openPlaces }} Plätze</strong></div></div>
      <font-awesome-icon icon="fa-solid fa-chevron-right" />
    </button>
  </section>
</template>

<script setup>
defineProps({
  applicationLabel: { type: Function, required: true },
  applicationStatus: { type: Function, required: true },
  filteredJobs: { type: Array, default: () => [] },
  jobFilter: { type: String, default: 'all' },
  jobRoles: { type: Array, default: () => [] },
  jobTime: { type: Function, required: true },
  jobs: { type: Array, default: () => [] },
  jobsAreFixtures: { type: Boolean, default: false },
  jobsError: { type: String, default: '' },
  jobsLoading: { type: Boolean, default: false },
  shortDate: { type: Function, required: true },
  weekday: { type: Function, required: true },
});

defineEmits(['filter', 'open-job']);
</script>
