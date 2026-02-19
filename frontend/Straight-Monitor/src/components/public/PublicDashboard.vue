<template>
  <div class="dashboard">
    <div class="greeting">
      <h1>Hallo, {{ vorname }}!</h1>
      <p class="subtitle">Was möchtest du tun?</p>
    </div>

    <div class="tiles">
      <!-- Tiles for ALL employees -->
      <div class="tile" @click="$emit('navigate', 'kalender')">
        <div class="tile-icon tile-icon--blue">
          <img :src="imgCalender" class="tile-img" alt="Kalender" />
        </div>
        <div class="tile-content">
          <h3>Kalender</h3>
          <p>Deine Einsätze im Überblick</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <div v-if="!isTeamleiter" class="tile" @click="$emit('navigate', 'laufzettel')">
        <div class="tile-icon tile-icon--purple">
          <img :src="imgLaufzettel" class="tile-img" alt="Laufzettel" />
        </div>
        <div class="tile-content">
          <h3>Laufzettel</h3>
          <p>Deine Dokumente & Unterlagen</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <div v-if="isTeamleiter" class="tile" @click="$emit('navigate', 'evaluierungen')">
        <div class="tile-icon tile-icon--purple">
          <img :src="imgEvaluierung" class="tile-img" alt="Laufzettel" />
        </div>
        <div class="tile-content">
          <div class="tile-title-row">
            <h3>Laufzettel</h3>
            <CountBadge :count="openLaufzettelCount" color="orange" />
          </div>
          <p>Offene Laufzettel bewerten & verwalten</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <div class="tile" @click="$emit('navigate', 'vergangene-jobs')">
        <div class="tile-icon tile-icon--green">
          <img :src="imgTasks" class="tile-img" alt="Vergangene Jobs" />
        </div>
        <div class="tile-content">
          <h3>Vergangene Jobs</h3>
          <p>{{ einsaetze.length }} vergangene Einsätze</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <!-- Teamleiter only -->
      <div v-if="isTeamleiter" class="tile tile--teamleiter" @click="$emit('navigate', 'eventreport')">
        <div class="tile-icon">
          <img :src="imgEventreport" class="tile-img" alt="Event Report" />
        </div>
        <div class="tile-content">
          <h3>Event Report</h3>
          <p>Event Reports schreiben & verwalten</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>
    </div>

    <!-- Upcoming jobs -->
    <div class="section">
      <h2 class="section-title">Nächste Jobs</h2>
      <div
        v-for="einsatz in upcomingEinsaetze"
        :key="einsatz._id"
        class="soon-card"
        @click="$emit('open-job', einsatz)"
      >
        <div class="soon-card-body">
          <div class="soon-card-header">
            <span class="soon-date">{{ formatShortDate(einsatz.datumVon) }}</span>
            <span class="soon-time" v-if="einsatz.uhrzeitVon">
              {{ formatTime(einsatz.uhrzeitVon) }}{{ einsatz.uhrzeitBis ? ' – ' + formatTime(einsatz.uhrzeitBis) : '' }}
            </span>
            <span class="soon-time muted" v-else>Ganztags</span>
          </div>
          <div class="soon-title">
            {{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `#${einsatz.auftragNr}` }}
          </div>
          <div class="soon-location" v-if="einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt">
            <font-awesome-icon icon="fa-solid fa-location-dot" />
            {{ einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt }}
          </div>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="soon-arrow" />
      </div>
      <p v-if="upcomingEinsaetze.length === 0" class="empty-hint">Keine bevorstehenden Jobs.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import CountBadge from '@/components/ui-elements/CountBadge.vue';
import calenderLight from '@/assets/calender.png';
import calenderDark from '@/assets/calender-dark.png';
import laufzettelLight from '@/assets/laufzettel.png';
import laufzettelDark from '@/assets/laufzettel-dark.png';
import evaluierungLight from '@/assets/evaluierung.png';
import evaluierungDark from '@/assets/evaluierung-dark.png';
import tasksLight from '@/assets/tasks.png';
import tasksDark from '@/assets/tasks-dark.png';
import eventreportLight from '@/assets/eventreport.png';
import eventreportDark from '@/assets/eventreport-dark.png';
// Tiles always use light icons (colored tile backgrounds)
const imgCalender = calenderLight;
const imgLaufzettel = laufzettelLight;
const imgEvaluierung = evaluierungLight;
const imgTasks = tasksLight;
const imgEventreport = eventreportLight;

const props = defineProps({
  vorname: { type: String, default: '' },
  isTeamleiter: { type: Boolean, default: false },
  einsaetze: { type: Array, default: () => [] },
  openLaufzettelCount: { type: Number, default: 0 }
});

defineEmits(['navigate', 'open-job']);

function formatTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatShortDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

const upcomingEinsaetze = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return props.einsaetze
    .filter(e => {
      const bis = new Date(e.datumBis);
      bis.setHours(23, 59, 59, 999);
      return bis >= today;
    })
    .sort((a, b) => new Date(a.datumVon) - new Date(b.datumVon));
});
</script>

<style scoped>
.dashboard {
  padding: 0 0 2rem;
}

.greeting {
  margin-bottom: 1.5rem;
}

.greeting h1 {
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
  color: var(--text);
}

.subtitle {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}

/* Tiles */
.tiles {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.tile {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.tile:active {
  transform: scale(0.98);
  background: var(--hover);
}

.tile--teamleiter {
  border-color: var(--primary);
  background: rgba(255, 117, 24, 0.05);
}

.tile--teamleiter .tile-icon {
  background: var(--primary);
  color: white;
}

.tile-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--text);
  flex-shrink: 0;
}

.tile-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.tile-icon--blue {
  background: #dbeafe;
  color: #2563eb;
}

.tile-icon--purple {
  background: #ede9fe;
  color: #7c3aed;
}

.tile-icon--green {
  background: #dcfce7;
  color: #16a34a;
}

.tile-content {
  flex: 1;
  min-width: 0;
}

.tile-content h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}

.tile-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.15rem;
}

.tile-content p {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0;
}

.tile-arrow {
  color: var(--muted);
  font-size: 0.8rem;
  flex-shrink: 0;
}

/* Section */
.section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

/* Today cards */
.soon-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.75rem 0.75rem 1rem;
  background: var(--tile-bg);
  border-radius: 10px;
  border-left: 3px solid var(--primary);
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.soon-card:active {
  transform: scale(0.98);
}

.soon-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.soon-card-header {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.soon-date {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.soon-time {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--primary);
  white-space: nowrap;
}

.soon-time.muted {
  color: var(--muted);
  font-weight: 400;
}

.soon-arrow {
  color: var(--muted);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.soon-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.soon-location {
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.empty-hint {
  font-size: 0.875rem;
  color: var(--muted);
  text-align: center;
  padding: 0.75rem 0;
}
</style>
