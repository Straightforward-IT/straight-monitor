<template>
  <div class="job-detail-view">

    <!-- Back Button -->
    <button class="back-btn" @click="$emit('back')">
      <font-awesome-icon icon="fa-solid fa-arrow-left" /> Zurück
    </button>

    <!-- Job Header -->
    <div class="job-header">
      <h2 class="job-title">
        {{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `Auftrag #${einsatz.auftragNr}` }}
      </h2>
      <div class="job-badges">
        <span v-if="einsatz.schichtBezeichnung" class="badge">
          <font-awesome-icon icon="fa-solid fa-clipboard" /> {{ einsatz.schichtBezeichnung }}
        </span>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-section">
      <div class="info-card">
        <div class="info-icon"><font-awesome-icon icon="fa-solid fa-calendar" /></div>
        <div class="info-content">
          <span class="info-label">Datum</span>
          <span class="info-value">{{ formatZeitraum(einsatz.datumVon, einsatz.datumBis) }}</span>
        </div>
      </div>

      <div v-if="einsatz.uhrzeitVon" class="info-card">
        <div class="info-icon"><font-awesome-icon icon="fa-solid fa-clock" /></div>
        <div class="info-content">
          <span class="info-label">Uhrzeit</span>
          <span class="info-value">{{ formatTime(einsatz.uhrzeitVon) }}{{ einsatz.uhrzeitBis ? ' – ' + formatTime(einsatz.uhrzeitBis) : '' }}</span>
        </div>
      </div>

      <div v-if="einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt" class="info-card">
        <div class="info-icon"><font-awesome-icon icon="fa-solid fa-location-dot" /></div>
        <div class="info-content">
          <span class="info-label">Location</span>
          <span class="info-value">{{ einsatz.auftrag?.eventLocation }}</span>
          <span v-if="einsatz.auftrag?.eventOrt" class="info-sub">{{ einsatz.auftrag.eventOrt }}</span>
        </div>
      </div>

      <div v-if="einsatz.treffpunkt" class="info-card">
        <div class="info-icon"><font-awesome-icon icon="fa-solid fa-map-pin" /></div>
        <div class="info-content">
          <span class="info-label">Treffpunkt</span>
          <span class="info-value">{{ formatTreffpunkt(einsatz.treffpunkt) }}</span>
        </div>
      </div>

      <div v-if="einsatz.ansprechpartnerName" class="info-card">
        <div class="info-icon"><font-awesome-icon icon="fa-solid fa-user" /></div>
        <div class="info-content">
          <span class="info-label">Ansprechpartner</span>
          <span class="info-value">{{ einsatz.ansprechpartnerName }}</span>
          <a
            v-if="isTeamleiter && einsatz.ansprechpartnerTelefon"
            :href="'tel:' + einsatz.ansprechpartnerTelefon"
            class="info-link"
            @click="copyPhone(einsatz.ansprechpartnerTelefon, $event)"
          >
            <font-awesome-icon icon="fa-solid fa-phone" /> {{ einsatz.ansprechpartnerTelefon }}
          </a>
          <a
            v-if="isTeamleiter && einsatz.ansprechpartnerEmail"
            :href="'mailto:' + einsatz.ansprechpartnerEmail"
            class="info-link"
          >
            <font-awesome-icon icon="fa-solid fa-envelope" /> {{ einsatz.ansprechpartnerEmail }}
          </a>
        </div>
      </div>
    </div>

    <!-- Mitarbeiter List grouped by Schicht -->
    <div class="section">
      <h3 class="section-title">
        <font-awesome-icon icon="fa-solid fa-users" /> Mitarbeiter
        <span class="count">{{ totalMitarbeiter }}</span>
      </h3>

      <div v-if="loadingMa" class="loading-ma">
        <div class="mini-spinner"></div>
        Mitarbeiter werden geladen...
      </div>

      <div v-else-if="schichtGruppen.length === 0" class="empty">
        Keine Mitarbeiter für diesen Auftrag gefunden.
      </div>

      <div v-else>
        <div v-for="schicht in schichtGruppen" :key="schicht.id" class="schicht-group">
          <!-- Schicht Header -->
          <div class="schicht-header">
            <span class="schicht-name">{{ schicht.bezeichnung || 'Schicht ' + schicht.id }}</span>
            <span class="schicht-time" v-if="schicht.uhrzeitVon">
              {{ formatTime(schicht.uhrzeitVon) }}{{ schicht.uhrzeitBis ? ' – ' + formatTime(schicht.uhrzeitBis) : '' }}
            </span>
            <span class="schicht-count">{{ schicht.mitarbeiter.length }}</span>
          </div>
          <!-- Mitarbeiter in dieser Schicht -->
          <div class="ma-list">
            <div
              v-for="ma in schicht.mitarbeiter"
              :key="ma.personalNr"
              class="ma-card"
              :class="{ 'checked-in': ma.checkedIn }"
            >
              <div v-if="isTeamleiter && !isPast" class="ma-check" @click="toggleCheckIn(ma)">
                <font-awesome-icon :icon="ma.checkedIn ? 'fa-solid fa-circle-check' : ['far', 'circle']" />
              </div>
              <div class="ma-info">
                <span class="ma-name">{{ ma.vorname }} {{ ma.nachname }}</span>
                <span class="ma-role" v-if="ma.bezeichnung">{{ ma.bezeichnung }}</span>
              </div>
              <a v-if="isTeamleiter && ma.telefon" :href="'tel:' + cleanPhone(ma.telefon)" class="ma-phone" @click.stop="copyPhone(ma.telefon, $event)">
                <font-awesome-icon icon="fa-solid fa-phone" />
                <span class="ma-phone-number">{{ ma.telefon }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Teamleiter: Event Report Button -->
    <div v-if="isTeamleiter" class="action-bar">
      <button class="action-btn" @click="$emit('write-report', einsatz)">
        <img :src="imgEventreport" class="action-btn-icon" alt="" /> Event Report schreiben
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTheme } from '@/stores/theme';
import { showToast } from '@getflip/bridge';
import eventreportLight from '@/assets/eventreport.png';
import eventreportDark from '@/assets/eventreport-dark.png';
const theme = useTheme();
const imgEventreport = computed(() => theme.isDark ? eventreportDark : eventreportLight);

const props = defineProps({
  einsatz: { type: Object, required: true },
  isTeamleiter: { type: Boolean, default: false },
  isPast: { type: Boolean, default: false },
  api: { type: Object, required: true }
});

defineEmits(['back', 'write-report']);

const loadingMa = ref(false);
const schichtGruppen = ref([]);

const totalMitarbeiter = computed(() =>
  schichtGruppen.value.reduce((sum, s) => sum + s.mitarbeiter.length, 0)
);

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatZeitraum(von, bis) {
  if (!von) return '—';
  const vonStr = formatDate(von);
  const bisStr = formatDate(bis);
  return vonStr === bisStr ? vonStr : `${vonStr} – ${bisStr}`;
}

// Excel time values come in as Date objects with a 1899 base date.
// We extract only the HH:MM portion regardless of the date part.
function formatTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  // Use UTC to avoid timezone shifting the 1899 base date
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTreffpunkt(val) {
  if (!val) return '';
  // If it looks like a Date object (or ISO string), format as time
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    // Only treat as time if the year is 1899/1900 (Excel time-only value)
    if (d.getUTCFullYear() <= 1900) return `${h}:${m} Uhr`;
  }
  return String(val);
}

function cleanPhone(tel) {
  // Keeps +, digits, and strips everything else so tel: links work reliably
  return tel.replace(/[^\d+]/g, '');
}

async function copyPhone(tel, event) {
  event?.preventDefault();
  try {
    await navigator.clipboard.writeText(tel);
  } catch {
    const el = document.createElement('input');
    el.value = tel;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  try {
    await showToast({ text: 'Telefonnummer kopiert.', intent: 'success', duration: 2500 });
  } catch {
    // showToast not available outside Flip context
  }
}

function storageKey(auftragNr) {
  return `checkin_${auftragNr}`;
}

function loadCheckIns(auftragNr) {
  try {
    const raw = localStorage.getItem(storageKey(auftragNr));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCheckIns(auftragNr, gruppen) {
  const state = {};
  gruppen.forEach(s => s.mitarbeiter.forEach(ma => {
    if (ma.checkedIn) state[ma.personalNr] = true;
  }));
  localStorage.setItem(storageKey(auftragNr), JSON.stringify(state));
}

function toggleCheckIn(ma) {
  ma.checkedIn = !ma.checkedIn;
  saveCheckIns(props.einsatz.auftragNr, schichtGruppen.value);
}

async function loadMitarbeiter() {
  if (!props.einsatz?.auftragNr) return;
  loadingMa.value = true;
  try {
    const res = await props.api.get('/api/public/einsatz-mitarbeiter', {
      params: { auftragNr: props.einsatz.auftragNr }
    });
    const saved = loadCheckIns(props.einsatz.auftragNr);
    schichtGruppen.value = (res.data || []).map(schicht => ({
      ...schicht,
      mitarbeiter: schicht.mitarbeiter.map(ma => ({ ...ma, checkedIn: !!saved[ma.personalNr] }))
    }));
  } catch (err) {
    console.error('Error loading Mitarbeiter for job:', err);
    schichtGruppen.value = [];
  } finally {
    loadingMa.value = false;
  }
}

onMounted(() => loadMitarbeiter());

watch(() => props.einsatz?._id, () => {
  loadMitarbeiter();
});
</script>

<style scoped>
.job-detail-view {
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

/* Job Header */
.job-header {
  margin-bottom: 1.25rem;
}

.job-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.5rem;
}

.job-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  background: var(--hover);
  color: var(--text);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

/* Info Section */
.info-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.info-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.info-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 117, 24, 0.1);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.info-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.info-sub {
  font-size: 0.8rem;
  color: var(--muted);
}

.info-link {
  font-size: 0.8rem;
  color: var(--primary);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
}

/* Section */
.section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.count {
  background: var(--hover);
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
}

.loading-ma {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1rem;
}

.mini-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1.25rem;
  background: var(--tile-bg);
  border-radius: 10px;
  font-style: italic;
}

/* Schicht Groups */
.schicht-group {
  margin-bottom: 1rem;
}

.schicht-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  margin-bottom: 0.4rem;
  background: var(--hover);
  border-radius: 8px;
}

.schicht-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text);
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.schicht-time {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--primary);
  white-space: nowrap;
}

.schicht-count {
  background: var(--border);
  color: var(--text);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 8px;
}

/* Mitarbeiter List */
.ma-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.ma-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all 0.15s;
}

.ma-card.checked-in {
  border-color: #28a745;
  background: rgba(40, 167, 69, 0.05);
}

.ma-check {
  font-size: 1.3rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  color: var(--muted);
  flex-shrink: 0;
}

.ma-card.checked-in .ma-check {
  color: #28a745;
}

.ma-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.ma-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.ma-role {
  font-size: 0.75rem;
  color: var(--muted);
}

.ma-phone {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  background: rgba(40, 167, 69, 0.08);
  color: #28a745;
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.ma-phone:active {
  background: rgba(40, 167, 69, 0.2);
}

.ma-phone-number {
  font-size: 0.75rem;
}

/* Action Bar */
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem 1rem;
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--border);
  z-index: 40;
  display: flex;
  justify-content: center;
}

.action-btn {
  width: auto;
  max-width: 100%;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s;
}

.action-btn-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.action-btn:active {
  transform: scale(0.98);
  filter: brightness(1.1);
}
</style>
