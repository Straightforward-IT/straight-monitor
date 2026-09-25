<template>
  <div class="dashboard">
    <div class="greeting">
      <h1>Hallo, {{ vorname }}!</h1>
      <p class="subtitle">Was möchtest du tun?</p>
    </div>

    <ModalFrame
      v-if="needsApparelSizes"
      title="Konfektionsgrößen"
      size="sm"
      :show-close="false"
      :close-on-backdrop="false"
      :close-on-escape="false"
      class="apparel-modal"
    >
      <form class="apparel-form" @submit.prevent="saveApparelSizes">
        <p>Wir benötigen noch deine Konfektions- und Schuhgröße.</p>

        <fieldset>
          <legend>Geschlecht</legend>
          <div class="apparel-options apparel-options--two">
            <label v-for="option in genderOptions" :key="option.value" :class="{ active: gender === option.value }">
              <input v-model="gender" type="radio" name="gender" :value="option.value" />
              {{ option.label }}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Konfektionsgröße</legend>
          <div class="apparel-options apparel-options--sizes">
            <button
              v-for="size in clothingSizes"
              :key="size"
              type="button"
              :class="{ active: clothingSize === size }"
              @click="clothingSize = size"
            >{{ size }}</button>
          </div>
        </fieldset>

        <label class="shoe-size-field">
          <span>Schuhgröße</span>
          <input v-model.trim="shoeSize" type="text" inputmode="decimal" pattern="[0-9]+([.,][0-9]+)?" maxlength="4" placeholder="z. B. 42" />
        </label>

        <p v-if="apparelError" class="apparel-error">{{ apparelError }}</p>
        <ToolbarButton :disabled="apparelSaving || !canSaveApparel" @click="saveApparelSizes">
          {{ apparelSaving ? 'Speichert ...' : 'Speichern' }}
        </ToolbarButton>
      </form>
    </ModalFrame>

    <div class="tiles">
      <!-- Tiles for ALL employees -->
      <div v-if="hasPublicMenuOption('meine-daten')" class="tile" @click="$emit('navigate', 'meine-daten')">
        <div class="tile-icon tile-icon--orange">
          <font-awesome-icon icon="fa-solid fa-folder-open" />
        </div>
        <div class="tile-content">
          <div class="tile-title-row">
            <h3>Meine Daten</h3>
            <CountBadge :count="personalDataTodoCount" color="orange" />
          </div>
          <p>Lohnabrechnungen, Dokumente & ToDos</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <div v-if="hasPublicMenuOption('jobangebote')" class="tile" @click="$emit('navigate', 'jobangebote')">
        <div class="tile-icon tile-icon--blue">
          <font-awesome-icon icon="fa-solid fa-briefcase" />
        </div>
        <div class="tile-content">
          <h3>Jobangebote</h3>
          <p>Auf Jobs bewerben & Bewerbungen verwalten</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <div v-if="hasPublicMenuOption('einsatzzeiten')" class="tile" @click="$emit('navigate', 'einsatzzeiten')">
        <div class="tile-icon tile-icon--green">
          <font-awesome-icon icon="fa-solid fa-clock" />
        </div>
        <div class="tile-content">
          <div class="tile-title-row">
            <h3>Einsatzzeiten eintragen</h3>
            <CountBadge :count="openTimeEntryCount" color="orange" />
          </div>
          <p>{{ openTimeEntryCount ? `Offene Zeiten: ${openTimeEntryCount}` : 'Hier gibt es gerade nichts zu tun' }}</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <div v-if="isTeamleiter" class="tile tile--availability" @click="$emit('navigate', 'kalender')">
        <div class="tile-icon tile-icon--blue">
          <img :src="imgCalender" class="tile-img" alt="Kalender" />
        </div>
        <div class="tile-content">
          <h3>Kalender</h3>
          <p>Update: Verfügbarkeiten eintragen</p>
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
            <CountBadge class="laufzettel-badge" :count="openLaufzettelCount" color="orange" />
          </div>
          <p>Laufzettel ausfüllen (Evaluierungen)</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <div class="tile" @click="$emit('navigate', 'vergangene-jobs')">
        <div class="tile-icon tile-icon--green">
          <img :src="imgTasks" class="tile-img" alt="Alte Jobs" />
          </div>
          <div class="tile-content">
          <h3>Alte Jobs</h3>
          <p>{{ einsaetze.length }} vergangene Einsätze</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

      <!-- Teamleiter only -->
      <div v-if="isTeamleiter" class="tile" @click="$emit('navigate', 'eventreport')">
        <div class="tile-icon tile-icon--orange">
          <img :src="imgEventreport" class="tile-img" alt="Event Report" />
        </div>
        <div class="tile-content">
          <h3>Event Report</h3>
          <p>Event Reports schreiben & verwalten</p>
        </div>
        <font-awesome-icon icon="fa-solid fa-chevron-right" class="tile-arrow" />
      </div>

    </div>

    <!-- Upcoming jobs (Teamleiter only) -->
    <div v-if="isTeamleiter" class="section">
      <p class="data-hint">
        <span>&#9432;</span> Daten wie Uhrzeiten und Personallisten in dieser App sind nicht Live-Updated und können von denen in der Zvoove Work App abweichen.
      </p>
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
import { computed, ref } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faBriefcase, faClock, faCode, faFolderOpen, faUserTie } from '@fortawesome/free-solid-svg-icons';
import CountBadge from '@/components/ui-elements/CountBadge.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
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
import { isPublicDevUser } from './dev/debugAccess';

library.add(faBriefcase, faClock, faCode, faFolderOpen, faUserTie);

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
  openLaufzettelCount: { type: Number, default: 0 },
  email: { type: String, default: '' },
  debugTlActive: { type: Boolean, default: false },
  debugDevActive: { type: Boolean, default: false },
  publicMenuOptions: { type: Array, default: () => [] },
  personalDataTodoCount: { type: Number, default: 0 },
  openTimeEntryCount: { type: Number, default: 0 },
  konfektionsgroesse: { type: String, default: '' },
  schuhgroesse: { type: String, default: '' },
  api: { type: Object, required: true },
});

const emit = defineEmits(['navigate', 'open-job', 'toggle-debug-tl', 'toggle-debug-dev', 'apparel-sizes-saved']);

const isDebugUser = computed(() => isPublicDevUser(props.email));
const genderOptions = [
  { value: 'female', label: 'Weiblich' },
  { value: 'male', label: 'Männlich' },
];
const clothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const gender = ref('');
const clothingSize = ref('');
const shoeSize = ref('');
const apparelSaving = ref(false);
const apparelError = ref('');
const needsApparelSizes = computed(() => !props.konfektionsgroesse || !props.schuhgroesse);
const canSaveApparel = computed(() => gender.value && clothingSize.value && shoeSize.value);

async function saveApparelSizes() {
  if (!canSaveApparel.value || apparelSaving.value) return;
  apparelSaving.value = true;
  apparelError.value = '';
  try {
    const { data } = await props.api.patch(
      '/api/public/mitarbeiter/kleidungsgroessen',
      {
        gender: gender.value,
        konfektionsgroesse: clothingSize.value,
        schuhgroesse: shoeSize.value,
      },
      { params: { email: props.email } }
    );
    emit('apparel-sizes-saved', data);
  } catch (error) {
    apparelError.value = error.response?.data?.msg || 'Die Angaben konnten nicht gespeichert werden.';
  } finally {
    apparelSaving.value = false;
  }
}

function hasPublicMenuOption(option) {
  return props.publicMenuOptions.includes('*') || props.publicMenuOptions.includes(option);
}

function formatTime(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
    return val.substring(0, 5);
  }
  // Full JS .toString() date string — extract HH:MM directly
  if (typeof val === 'string') {
    const m = val.match(/\d{4} (\d{2}:\d{2}):\d{2}/);
    if (m) return m[1];
  }
  return '';
}

function formatShortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return 'Heute';
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
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

.apparel-form {
  display: grid;
  gap: 20px;

  > p { color: var(--muted); line-height: 1.45; }
  fieldset { display: grid; gap: 8px; padding: 0; border: 0; }
  legend, .shoe-size-field > span { color: var(--text); font-size: 0.85rem; font-weight: 600; }
}

.apparel-options { display: grid; gap: 8px; }
.apparel-options--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.apparel-options--sizes { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.apparel-options label, .apparel-options button {
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  text-align: center;
}
.apparel-options label { display: grid; place-items: center; }
.apparel-options input { position: absolute; opacity: 0; pointer-events: none; }
.apparel-options .active { border-color: var(--primary); color: var(--primary); }
.shoe-size-field { display: grid; gap: 8px; }
.shoe-size-field input { min-height: 42px; padding: 0 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--tile-bg); color: var(--text); font: inherit; }
.shoe-size-field input:focus { outline: 2px solid color-mix(in srgb, var(--primary) 35%, transparent); border-color: var(--primary); }
.apparel-error { color: #dc3545 !important; font-size: 0.85rem; }

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

.tile--availability {
  border-color: var(--primary);
  background: rgba(255, 117, 24, 0.05);
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

.tile-icon--orange {
  background: #ffedd5;
  color: #ea580c;
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

:deep(.count-badge.laufzettel-badge) {
  background: transparent;
  border: 1px solid var(--primary);
  color: var(--primary);
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

.tile--debug {
  border-style: dashed;
  opacity: 0.75;
}

.tile-icon--debug {
  background: #f3f4f6;
  color: #6b7280;
  font-size: 1.1rem;
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

.data-hint {
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.5;
  margin-bottom: 0.75rem;

  span {
    color: var(--primary);
    margin-right: 4px;
  }
}
</style>
