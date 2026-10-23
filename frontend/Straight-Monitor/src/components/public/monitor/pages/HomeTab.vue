<template>
  <section class="public-monitor-page public-monitor-home-tab">
    <section class="welcome-row">
      <div><span>{{ formattedToday }}</span><h2>Hallo, {{ vorname }}!</h2></div>
      <span class="prototype-pill">DEV</span>
    </section>

    <PublicNewsSection
      v-if="newsItems.length || newsLoading || newsError"
      :confirming-id="confirmingNewsId"
      :error="newsError"
      :items="newsItems"
      :loading="newsLoading"
      @confirm="$emit('confirm-news', $event)"
    />

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

    <PublicUpcomingJobs
      v-if="recentJobsWithoutTimeEntry.length"
      :einsaetze="recentJobsWithoutTimeEntry"
      :badge-count="recentJobsWithoutTimeEntry.length"
      completed
      title="Einsatzzeiten eintragen"
      @open-job="$emit('open-calendar-job', $event)"
    />

    <PublicUpcomingJobs :einsaetze="upcomingEinsaetze" @open-job="$emit('open-calendar-job', $event)" />

    <section class="home-section">
      <div class="section-heading"><h3>Jobangebote</h3><button type="button" @click="$emit('select-tab', 'jobs')">Alle</button></div>
      <div class="job-card-list">
        <div
          v-for="job in jobs.slice(0, 2)"
          :key="job.id"
          class="compact-job"
          :class="{ 'job-card--swiping-out': swipingIds[job.id] }"
          role="button"
          tabindex="0"
          @click="$emit('open-job', job)"
          @keydown.enter.prevent="$emit('open-job', job)"
          @keydown.space.prevent="$emit('open-job', job)"
        >
          <span class="job-date"><strong>{{ dayNumber(job.dateFrom) }}</strong>{{ monthShort(job.dateFrom) }}</span>
          <span><strong>{{ job.title }}</strong><small>{{ job.role || 'Tätigkeit offen' }} · {{ jobTime(job) }}</small></span>
          <div class="compact-job-actions" @click.stop>
            <span class="places">{{ job.openPlaces }} frei</span>
            <button
              type="button"
              class="job-card-dismiss-x job-card-dismiss-x--compact"
              title="Jobangebot ablehnen und ausblenden"
              aria-label="Jobangebot ablehnen"
              @click.stop="triggerDecline(job)"
            >
              <font-awesome-icon icon="fa-solid fa-xmark" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { reactive } from 'vue';
import PublicUpcomingJobs from '@/components/public/PublicUpcomingJobs.vue';
import PublicNewsSection from './PublicNewsSection.vue';

defineProps({
  dayNumber: { type: Function, required: true },
  einsatzTime: { type: Function, required: true },
  formattedToday: { type: String, default: '' },
  jobTime: { type: Function, required: true },
  jobs: { type: Array, default: () => [] },
  monthShort: { type: Function, required: true },
  newsError: { type: String, default: '' },
  newsItems: { type: Array, default: () => [] },
  newsLoading: { type: Boolean, default: false },
  confirmingNewsId: { type: String, default: '' },
  nextEinsatz: { type: Object, default: null },
  nextEinsatzDate: { type: String, default: '' },
  nextEinsatzLocation: { type: String, default: '' },
  nextEinsatzRole: { type: String, default: '' },
  nextEinsatzTitle: { type: String, default: '' },
  recentJobsWithoutTimeEntry: { type: Array, default: () => [] },
  upcomingEinsaetze: { type: Array, default: () => [] },
  vorname: { type: String, default: '' },
});

const emit = defineEmits(['confirm-news', 'open-calendar-job', 'open-job', 'decline-job', 'select-tab']);
const swipingIds = reactive({});

function triggerDecline(job) {
  if (!job?.id || swipingIds[job.id]) return;
  swipingIds[job.id] = true;
  window.setTimeout(() => {
    emit('decline-job', job);
    delete swipingIds[job.id];
  }, 240);
}
</script>
