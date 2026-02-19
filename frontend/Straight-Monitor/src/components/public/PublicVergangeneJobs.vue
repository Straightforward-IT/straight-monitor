<template>
  <div class="vergangene-jobs-view">

    <!-- Back Button -->
    <button class="back-btn" @click="$emit('back')">
      <font-awesome-icon icon="fa-solid fa-arrow-left" /> Zurück
    </button>

    <h2 class="view-title">Vergangene Jobs</h2>

    <!-- Search -->
    <SearchBar v-model="search" placeholder="Job suchen..." class="search-bar-margin" />

    <!-- Jobs List -->
    <div v-if="filteredJobs.length === 0" class="empty">
      <font-awesome-icon icon="fa-solid fa-briefcase" />
      <p>Keine vergangenen Jobs gefunden.</p>
    </div>

    <div v-else>
      <!-- Grouped by month -->
      <div v-for="group in visibleGroups" :key="group.key" class="month-group">
        <div class="month-header">
          <span class="month-label">{{ group.label }}</span>
          <span class="month-count">{{ group.jobs.length }}</span>
        </div>
        <div class="job-list">
          <div
            v-for="einsatz in group.jobs"
            :key="einsatz._id"
            class="job-card"
            @click="$emit('open-job', einsatz)"
          >
            <div class="job-date-badge">
              <span class="job-day">{{ getDay(einsatz.datumVon) }}</span>
              <span class="job-month-short">{{ getMonthShort(einsatz.datumVon) }}</span>
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

      <!-- Show More -->
      <div v-if="hasMore" class="show-more-row">
        <button class="show-more-btn" @click="showMore">
          <font-awesome-icon icon="fa-solid fa-chevron-down" />
          Mehr anzeigen
          <span class="show-more-hint">{{ visibleCount }} / {{ filteredJobs.length }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import SearchBar from '@/components/ui-elements/SearchBar.vue';

const props = defineProps({
  einsaetze: { type: Array, default: () => [] }
});

defineEmits(['back', 'open-job']);

const INITIAL = 30;
const search = ref('');
const visibleCount = ref(INITIAL);

// Reset pagination when search changes
watch(search, () => { visibleCount.value = INITIAL; });

const filteredJobs = computed(() => {
  const q = search.value.toLowerCase().trim();
  const sorted = [...props.einsaetze].sort((a, b) => new Date(b.datumVon) - new Date(a.datumVon));
  if (!q) return sorted;
  return sorted.filter(e => {
    const title = (e.auftrag?.eventTitel || e.bezeichnung || '').toLowerCase();
    const location = (e.auftrag?.eventLocation || e.auftrag?.eventOrt || '').toLowerCase();
    const nr = String(e.auftragNr);
    return title.includes(q) || location.includes(q) || nr.includes(q);
  });
});

const hasMore = computed(() => visibleCount.value < filteredJobs.value.length);

function showMore() {
  visibleCount.value *= 2;
}

// Group visible slice of jobs by year-month
const visibleGroups = computed(() => {
  const slice = filteredJobs.value.slice(0, visibleCount.value);
  const groupMap = new Map();

  slice.forEach(e => {
    const d = e.datumVon ? new Date(e.datumVon) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'unknown';
    const label = d
      ? d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      : 'Unbekannt';
    if (!groupMap.has(key)) groupMap.set(key, { key, label, jobs: [] });
    groupMap.get(key).jobs.push(e);
  });

  return [...groupMap.values()];
});

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDay(d) {
  if (!d) return '';
  return new Date(d).getDate();
}

function getMonthShort(d) {
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

.search-bar-margin {
  margin-bottom: 1rem;
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

.empty p {
  margin: 0;
  font-size: 0.9rem;
}

/* Month Groups */
.month-group {
  margin-bottom: 1.25rem;
}

.month-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0 0.1rem;
}

.month-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.month-count {
  background: var(--border);
  color: var(--muted);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
}

/* Job List */
.job-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
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

.job-month-short {
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

/* Show More */
.show-more-row {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.show-more-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s, color 0.15s;
  font-family: inherit;
  width: 100%;
  justify-content: center;
}

.show-more-btn:active {
  border-color: var(--primary);
  color: var(--primary);
}

.show-more-hint {
  font-size: 0.7rem;
  color: var(--muted);
  font-weight: 500;
  margin-left: 0.15rem;
}
</style>
