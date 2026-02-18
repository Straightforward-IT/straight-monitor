<template>
  <div class="vergangene-jobs-view">

    <!-- Back Button -->
    <button class="back-btn" @click="$emit('back')">
      <font-awesome-icon icon="fa-solid fa-arrow-left" /> Zurück
    </button>

    <h2 class="view-title">Vergangene Jobs</h2>

    <!-- Search -->
    <div class="search-bar">
      <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
      <input
        v-model="search"
        type="text"
        placeholder="Job suchen..."
      />
    </div>

    <!-- Jobs List -->
    <div v-if="filteredJobs.length === 0" class="empty">
      <font-awesome-icon icon="fa-solid fa-briefcase" />
      <p>Keine vergangenen Jobs gefunden.</p>
    </div>

    <div v-else class="job-list">
      <div
        v-for="einsatz in filteredJobs"
        :key="einsatz._id"
        class="job-card"
        @click="$emit('open-job', einsatz)"
      >
        <div class="job-date-badge">
          <span class="job-day">{{ getDay(einsatz.datumVon) }}</span>
          <span class="job-month">{{ getMonth(einsatz.datumVon) }}</span>
        </div>
        <div class="job-info">
          <span class="job-title">
            {{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `#${einsatz.auftragNr}` }}
          </span>
          <span class="job-meta">
            <span v-if="einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt" class="job-location">
              <font-awesome-icon icon="fa-solid fa-location-dot" />
              {{ einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt }}
            </span>
            <span class="job-range">
              {{ formatDate(einsatz.datumVon) }} – {{ formatDate(einsatz.datumBis) }}
            </span>
          </span>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="job-arrow" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  einsaetze: { type: Array, default: () => [] }
});

defineEmits(['back', 'open-job']);

const search = ref('');

const filteredJobs = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return props.einsaetze;
  return props.einsaetze.filter(e => {
    const title = (e.auftrag?.eventTitel || e.bezeichnung || '').toLowerCase();
    const location = (e.auftrag?.eventLocation || e.auftrag?.eventOrt || '').toLowerCase();
    const nr = String(e.auftragNr);
    return title.includes(q) || location.includes(q) || nr.includes(q);
  });
});

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDay(d) {
  if (!d) return '';
  return new Date(d).getDate();
}

function getMonth(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { month: 'short' }).toUpperCase();
}
</script>

<style scoped>
.vergangene-jobs-view {
  padding: 0 0 2rem;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  -webkit-tap-highlight-color: transparent;
}

.view-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 1rem;
}

/* Search */
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 1rem;
}

.search-bar i {
  color: var(--muted);
  font-size: 0.85rem;
}

.search-bar input {
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.9rem;
  width: 100%;
  outline: none;
  font-family: inherit;
}

.search-bar input::placeholder {
  color: var(--muted);
}

/* Empty */
.empty {
  text-align: center;
  color: var(--muted);
  padding: 3rem 1rem;
  background: var(--tile-bg);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.empty i {
  font-size: 2rem;
  opacity: 0.4;
}

.empty p {
  margin: 0;
  font-size: 0.9rem;
}

/* Job List */
.job-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.job-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s;
}

.job-card:active {
  transform: scale(0.98);
  background: var(--hover);
}

.job-date-badge {
  width: 44px;
  height: 48px;
  border-radius: 10px;
  background: rgba(255, 117, 24, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.job-day {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.1;
}

.job-month {
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.job-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.job-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.job-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.job-location {
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.job-range {
  font-size: 0.7rem;
  color: var(--muted);
  opacity: 0.8;
}

.job-arrow {
  color: var(--muted);
  font-size: 0.7rem;
  flex-shrink: 0;
}
</style>
