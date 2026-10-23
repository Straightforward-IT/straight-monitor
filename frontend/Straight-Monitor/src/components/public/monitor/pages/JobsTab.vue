<template>
  <section class="public-monitor-page public-monitor-jobs-tab">
    <div class="intro-row"><div><h2>Jobangebote</h2><p>Finde deinen nächsten Einsatz.</p></div></div>
    <div class="filter-row">
      <button type="button" :class="{ active: jobFilter === 'new' }" @click="$emit('filter', 'new')">
        Neu <template v-if="newCount > 0">({{ newCount }})</template>
      </button>
      <button type="button" :class="{ active: jobFilter === 'applied' }" @click="$emit('filter', 'applied')">
        Beworben <template v-if="appliedCount > 0">({{ appliedCount }})</template>
      </button>
      <button type="button" :class="{ active: jobFilter === 'rejected' }" @click="$emit('filter', 'rejected')">
        Abgelehnt <template v-if="declinedCount > 0">({{ declinedCount }})</template>
      </button>
    </div>
    <div v-if="qualifications.length" class="filter-row filter-row--qualifications">
      <button type="button" :class="{ active: qualFilter === 'all' }" @click="$emit('qual-filter', 'all')">
        Alle Qualifikationen
      </button>
      <button
        v-for="qual in qualifications"
        :key="qual.key"
        type="button"
        :class="{ active: qualFilter === qual.key }"
        @click="$emit('qual-filter', qual.key)"
      >
        {{ qual.label }}
      </button>
    </div>
    <div v-if="jobsLoading" class="loading-row"><font-awesome-icon icon="fa-solid fa-spinner" spin /> Jobs werden geladen</div>
    <div v-else-if="jobsError && !jobs.length" class="empty-state"><strong>Keine Jobs verfügbar</strong><p>{{ jobsError }}</p></div>
    <div v-else-if="!filteredJobs.length" class="empty-state">
      <strong>{{ emptyStateTitle }}</strong>
      <p>{{ emptyStateDescription }}</p>
    </div>
    <div v-else class="job-card-list">
      <div
        v-for="job in filteredJobs"
        :key="job.id"
        class="job-card"
        :class="{
          'job-card--swiping-out': swipingIds[job.id],
          'job-card--reserve': job.isReserve,
        }"
        role="button"
        tabindex="0"
        @click="$emit('open-job', job)"
        @keydown.enter.prevent="$emit('open-job', job)"
        @keydown.space.prevent="$emit('open-job', job)"
      >
        <div class="job-card-date">
          <span class="job-card-date__wd">{{ weekday(job.dateFrom) }}</span>
          <strong class="job-card-date__day">{{ shortDate(job.dateFrom) }}</strong>
        </div>

        <div class="job-card-body">
          <div class="job-card-top">
            <div class="job-card-heading">
              <h3>{{ job.title }}</h3>
              <span class="job-card-role">
                {{ job.role || 'Tätigkeit noch offen' }}
                <template v-if="job.qualificationDesignation && job.qualificationDesignation !== job.role">
                  · {{ job.qualificationDesignation }}
                </template>
              </span>
            </div>
            <div class="job-card-badges">
              <span v-if="job.isReserve" class="mini-status mini-status--reserve">Reserve</span>
              <span v-if="applicationStatus(job.id)" class="mini-status" :class="`mini-status--${applicationStatus(job.id)}`">
                {{ applicationLabel(applicationStatus(job.id), job.id) }}
              </span>
            </div>
          </div>

          <div class="job-card-bottom">
            <div class="job-meta">
              <span><font-awesome-icon icon="fa-solid fa-clock" /> {{ jobTime(job) }}</span>
              <span><font-awesome-icon icon="fa-solid fa-location-dot" /> {{ job.city || job.locationName || 'Ort offen' }}</span>
            </div>
            <span class="job-card-places">
              Noch {{ job.openPlaces }} {{ Number(job.openPlaces) === 1 ? 'Platz' : 'Plätze' }}
            </span>
          </div>
        </div>

        <button
          v-if="applicationStatus(job.id) === 'rejected'"
          type="button"
          class="job-card-dismiss-x job-card-dismiss-x--restore"
          title="Jobangebot wiederherstellen"
          aria-label="Jobangebot wiederherstellen"
          @click.stop="triggerSwipeAction(job, 'restore-job')"
        >
          <font-awesome-icon icon="fa-solid fa-rotate-left" />
        </button>
        <button
          v-else-if="!['scheduled', 'confirmed'].includes(applicationStatus(job.id))"
          type="button"
          class="job-card-dismiss-x"
          title="Jobangebot ablehnen und ausblenden"
          aria-label="Jobangebot ablehnen"
          @click.stop="triggerSwipeAction(job, 'decline-job')"
        >
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </button>
        <span v-else class="job-card-chevron">
          <font-awesome-icon icon="fa-solid fa-chevron-right" />
        </span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive } from 'vue';

const props = defineProps({
  applicationLabel: { type: Function, required: true },
  applicationStatus: { type: Function, required: true },
  newCount: { type: Number, default: 0 },
  appliedCount: { type: Number, default: 0 },
  declinedCount: { type: Number, default: 0 },
  filteredJobs: { type: Array, default: () => [] },
  jobFilter: { type: String, default: 'new' },
  qualFilter: { type: String, default: 'all' },
  qualifications: { type: Array, default: () => [] },
  jobTime: { type: Function, required: true },
  jobs: { type: Array, default: () => [] },
  jobsError: { type: String, default: '' },
  jobsLoading: { type: Boolean, default: false },
  shortDate: { type: Function, required: true },
  weekday: { type: Function, required: true },
});

const emit = defineEmits(['filter', 'qual-filter', 'open-job', 'decline-job', 'apply-job', 'restore-job']);
const swipingIds = reactive({});

const emptyStateTitle = computed(() => {
  if (props.jobFilter === 'applied') return 'Keine aktiven Bewerbungen';
  if (props.jobFilter === 'rejected') return 'Keine abgelehnten Jobs';
  return 'Keine neuen Jobangebote';
});

const emptyStateDescription = computed(() => {
  if (props.jobFilter === 'applied') return 'Du hast dich aktuell noch auf keinen Job beworben.';
  if (props.jobFilter === 'rejected') return 'Du hast bisher keine Jobangebote abgelehnt.';
  return 'Du hast alle aktuellen Jobangebote bearbeitet.';
});

function triggerSwipeAction(job, eventName) {
  if (!job?.id || swipingIds[job.id]) return;
  swipingIds[job.id] = true;
  window.setTimeout(() => {
    emit(eventName, job);
    delete swipingIds[job.id];
  }, 240);
}
</script>
