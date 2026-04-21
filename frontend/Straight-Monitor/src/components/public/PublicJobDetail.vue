<template>
  <div class="job-detail-view">

    <!-- Job Header -->
    <div class="job-header">
      <h2 class="job-title">
        {{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `Auftrag #${einsatz.auftragNr}` }}
      </h2>
      <div class="job-badges">
        <span v-if="einsatz.schichtBezeichnung" class="badge">
          <font-awesome-icon icon="fa-solid fa-clipboard" /> {{ einsatz.schichtBezeichnung }}
        </span>
        <span
          v-for="label in (einsatz.auftrag?.labels || [])"
          :key="label._id"
          class="badge badge-label"
          :style="{ background: label.color + '22', borderColor: label.color, color: label.color }"
        >
          {{ label.name }}
        </span>
      </div>
      <!-- Notes button for Teamleiter -->
      <div v-if="isTeamleiter" class="job-notes-row">
        <button class="job-notes-btn" :class="{ 'job-notes-btn--active': !!getJobNote() }" @click="openNotiz()">
          <font-awesome-icon icon="fa-solid fa-comment" />
          {{ getJobNote() ? 'Notizen bearbeiten' : 'Notizen' }}
          <span v-if="getJobNote()" class="job-notes-dot"></span>
        </button>
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
            :href="'tel:' + cleanPhone(einsatz.ansprechpartnerTelefon)"
            class="info-link"
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

      <LoadingSpinner v-if="loadingMa" label="Mitarbeiter werden geladen..." class="inline-loader" />

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
              :class="{ 'checked-in': ma.checkedIn && !ma.noShow, 'nicht-erschienen': ma.noShow, 'is-teamleiter': ma.isTeamleiter }"
            >
              <TlBadge v-if="ma.isTeamleiter" class="tl-badge--corner" />
              <div v-if="ma.einsatzNr" class="job-nr-badge" :class="jobTierClass(ma.einsatzNr)" :title="`Einsatz ${ma.einsatzNr}`">
                <span class="job-nr-text">{{ ma.einsatzNr }}. Job</span>
              </div>
              <div v-if="isTeamleiter" class="ma-check" :class="{ 'ma-check--noshow': ma.noShow }" @click="toggleCheckIn(ma)">
                <font-awesome-icon :icon="ma.noShow ? 'fa-solid fa-circle-xmark' : ma.checkedIn ? 'fa-solid fa-circle-check' : ['far', 'circle']" />
              </div>
              <div class="ma-info">
                <span class="ma-name">{{ ma.vorname }} {{ ma.nachname }}</span>
                <span class="ma-role" v-if="ma.bezeichnung">{{ ma.bezeichnung }}</span>
                <!-- Annotation badges -->
                <span v-if="isTeamleiter" class="ma-annot-badges">
                  <span v-if="getAnnotation(ma.personalNr).verspaetung" class="ma-annot-badge ma-annot-badge--delay">
                    <font-awesome-icon icon="fa-solid fa-clock" /> {{ getAnnotation(ma.personalNr).verspaetung }} min
                  </span>
                </span>
              </div>
              <a
                v-if="isTeamleiter && ma.telefon"
                :href="'tel:' + cleanPhone(ma.telefon)"
                class="ma-phone"
              >
                <font-awesome-icon icon="fa-solid fa-phone" />
                <span class="ma-phone-number">{{ ma.telefon }}</span>
              </a>
              <!-- Three-dot menu trigger -->
              <button
                v-if="isTeamleiter"
                class="ma-menu-btn"
                @click.stop="openActionSheet(ma)"
                aria-label="Optionen"
              >
                <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Teamleiter: Action Buttons -->
    <div v-if="isTeamleiter" class="action-bar">
      <button
        class="action-btn"
        :class="{ 'action-btn--done': hasReport }"
        :disabled="hasReport"
        @click="!hasReport && $emit('write-report', einsatz)"
      >
        <img :src="imgEventreport" class="action-btn-icon" alt="" />
        {{ hasReport ? 'Bericht wurde bereits geschrieben' : 'Event Report schreiben' }}
      </button>
    </div>

    <!-- MA Action Sheet -->
    <Transition name="calmodal">
      <div v-if="actionSheet.open" class="calmodal-overlay" @click.self="actionSheet.open = false">
        <div class="calmodal-sheet annot-actionsheet">
          <div class="calmodal-handle"></div>
          <p class="annot-actionsheet-name">{{ actionSheet.ma?.vorname }} {{ actionSheet.ma?.nachname }}</p>
          <button v-if="isTeamleiter" class="annot-action-item" @click="openVerspaetung(actionSheet.ma)">
            <span class="annot-action-icon annot-action-icon--delay"><font-awesome-icon icon="fa-solid fa-clock" /></span>
            Verspätung eintragen
            <span v-if="actionSheet.ma && getAnnotation(actionSheet.ma.personalNr).verspaetung" class="annot-action-badge">
              {{ getAnnotation(actionSheet.ma.personalNr).verspaetung }} min
            </span>
          </button>
          <button v-if="isTeamleiter" class="annot-action-item" @click="toggleNichtErschienen(actionSheet.ma)">
            <span class="annot-action-icon annot-action-icon--noshow"><font-awesome-icon icon="fa-solid fa-user-xmark" /></span>
            {{ actionSheet.ma?.noShow ? 'Nicht Erschienen aufheben' : 'Nicht Erschienen' }}
            <span v-if="actionSheet.ma?.noShow" class="annot-action-badge annot-action-badge--noshow">
              <font-awesome-icon icon="fa-solid fa-check" />
            </span>
          </button>
          <button class="calmodal-btn calmodal-btn--cancel annot-cancel-btn" @click="actionSheet.open = false">Abbrechen</button>
        </div>
      </div>
    </Transition>

    <!-- Verspätung Modal -->
    <Transition name="calmodal">
      <div v-if="verspaetungModal.open" class="calmodal-overlay" @click.self="verspaetungModal.open = false">
        <div class="calmodal-sheet">
          <div class="calmodal-handle"></div>
          <div class="calmodal-icon" style="background: rgba(234,88,12,0.12); border-color: rgba(234,88,12,0.3); color: #ea580c;">
            <font-awesome-icon icon="fa-solid fa-clock" />
          </div>
          <h3 class="calmodal-title">Verspätung eintragen</h3>
          <p class="calmodal-hint" style="margin-bottom: 0.75rem;">{{ verspaetungModal.ma?.vorname }} {{ verspaetungModal.ma?.nachname }}</p>
          <div class="verspaetung-input-wrap">
            <input
              class="verspaetung-input"
              type="number"
              inputmode="numeric"
              min="0"
              max="240"
              placeholder="0"
              v-model.number="verspaetungModal.value"
            />
            <span class="verspaetung-unit">min</span>
          </div>
          <p class="calmodal-hint">Wird beim Schreiben des Event Reports automatisch vorausgefüllt.</p>
          <div class="calmodal-actions">
            <button class="calmodal-btn calmodal-btn--cancel" @click="verspaetungModal.open = false">Abbrechen</button>
            <button class="calmodal-btn calmodal-btn--confirm" @click="saveVerspaetung">Speichern</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Notiz Modal -->
    <Transition name="calmodal">
      <div v-if="notizModal.open" class="calmodal-overlay" @click.self="notizModal.open = false">
        <div class="calmodal-sheet notiz-sheet">
          <div class="calmodal-handle"></div>
          <h3 class="calmodal-title">Notizen</h3>
          <textarea
            class="notiz-textarea"
            v-model="notizModal.text"
            placeholder="…"
            rows="5"
            autofocus
          ></textarea>
          <div class="calmodal-actions">
            <button class="calmodal-btn calmodal-btn--cancel" @click="notizModal.open = false">Abbrechen</button>
            <button class="calmodal-btn calmodal-btn--confirm" @click="saveNotiz">Speichern</button>
          </div>
        </div>
      </div>
    </Transition>


  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTheme } from '@/stores/theme';
import TlBadge from '@/components/ui-elements/TlBadge.vue';
import LoadingSpinner from '@/components/ui-elements/LoadingSpinner.vue';
import { showToast } from '@getflip/bridge';
import eventreportLight from '@/assets/eventreport.png';
import eventreportDark from '@/assets/eventreport-dark.png';
const theme = useTheme();
const imgEventreport = computed(() => theme.isDark ? eventreportDark : eventreportLight);

const props = defineProps({
  einsatz: { type: Object, required: true },
  isTeamleiter: { type: Boolean, default: false },
  isPast: { type: Boolean, default: false },
  api: { type: [Object, Function], required: true },
  mitarbeiter: { type: Object, default: null },
  email: { type: String, default: '' },
});

const hasReport = computed(() => {
  if (!props.mitarbeiter?.eventreports || !props.einsatz?.auftragNr) return false;
  return props.mitarbeiter.eventreports.some(
    r => r?.auftragnummer && String(r.auftragnummer) === String(props.einsatz.auftragNr)
  );
});

defineEmits(['back', 'write-report']);

const loadingMa = ref(false);
const schichtGruppen = ref([]);

// MA Annotation state
const actionSheet = ref({ open: false, ma: null });
const verspaetungModal = ref({ open: false, ma: null, value: 0 });
const notizModal = ref({ open: false, text: '' });
// Reactivity trigger for annotation badges
const annotationTick = ref(0);

function annotationKey(personalNr) {
  return `maannot_${props.einsatz?.auftragNr}_${personalNr}`;
}

function getAnnotation(personalNr) {
  // eslint-disable-next-line no-unused-expressions
  annotationTick.value; // reactive dependency
  try {
    const raw = localStorage.getItem(annotationKey(personalNr));
    return raw ? JSON.parse(raw) : { verspaetung: null, nichtErschienen: false, note: '' };
  } catch { return { verspaetung: null, nichtErschienen: false, note: '' }; }
}

function saveAnnotation(personalNr, data) {
  localStorage.setItem(annotationKey(personalNr), JSON.stringify(data));
  annotationTick.value++; // trigger reactivity
}

function openActionSheet(ma) {
  actionSheet.value = { open: true, ma };
}

function openVerspaetung(ma) {
  const ann = getAnnotation(ma.personalNr);
  verspaetungModal.value = { open: true, ma, value: ann.verspaetung || 0 };
  actionSheet.value.open = false;
}

function saveVerspaetung() {
  const { ma, value } = verspaetungModal.value;
  const ann = getAnnotation(ma.personalNr);
  ann.verspaetung = value > 0 ? value : null;
  saveAnnotation(ma.personalNr, ann);
  verspaetungModal.value.open = false;
  try { showToast({ text: value > 0 ? `Verspätung: ${value} min gespeichert` : 'Verspätung entfernt', intent: 'success', duration: 2000 }); } catch {}
}

function toggleNichtErschienen(ma) {
  ma.noShow = !ma.noShow;
  actionSheet.value.open = false;
  props.api.post('/api/public/noshow/toggle', {
    auftragNr: props.einsatz.auftragNr,
    personalNr: ma.personalNr,
  }).catch(() => {
    ma.noShow = !ma.noShow; // revert on error
  });
  // Also remove from checkedIn if marking as no-show
  if (ma.noShow) ma.checkedIn = false;
  try { showToast({ text: ma.noShow ? 'Nicht Erschienen markiert' : 'Nicht Erschienen aufgehoben', intent: 'success', duration: 2000 }); } catch {}
}

function jobNoteKey() {
  return `jobnote_${props.einsatz?.auftragNr}`;
}

function getJobNote() {
  annotationTick.value; // reactive dependency
  return localStorage.getItem(jobNoteKey()) || '';
}

function openNotiz() {
  notizModal.value = { open: true, text: getJobNote() };
}

function saveNotiz() {
  const text = notizModal.value.text.trim();
  if (text) {
    localStorage.setItem(jobNoteKey(), text);
  } else {
    localStorage.removeItem(jobNoteKey());
  }
  annotationTick.value++;
  notizModal.value.open = false;
  try { showToast({ text: 'Notiz gespeichert', intent: 'success', duration: 2000 }); } catch {}
}


const totalMitarbeiter = computed(() =>
  schichtGruppen.value.reduce((sum, s) => sum + s.mitarbeiter.length, 0)
);

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return 'Heute';
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatZeitraum(von, bis) {
  if (!von) return '—';
  const vonStr = formatDate(von);
  const bisStr = formatDate(bis);
  return vonStr === bisStr ? vonStr : `${vonStr} – ${bisStr}`;
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

function jobTierClass(n) {
  if (n >= 1000) return 'job-tier-immortal';
  if (n >= 500) return 'job-tier-legend';
  if (n >= 201) return 'job-tier-rainbow';
  if (n >= 101) return 'job-tier-onyx';
  if (n >= 51)  return 'job-tier-diamond';
  if (n >= 21)  return 'job-tier-gold';
  if (n >= 6)   return 'job-tier-silver';
  return 'job-tier-bronze';
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

async function loadCheckIns(auftragNr) {
  try {
    const res = await props.api.get('/api/public/checkins', { params: { auftragNr } });
    const checkedIn = res.data?.checkedIn || [];
    const noShow = res.data?.noShow || [];
    return {
      checkedIn: Object.fromEntries(checkedIn.map(nr => [nr, true])),
      noShow: Object.fromEntries(noShow.map(nr => [nr, true])),
    };
  } catch { return { checkedIn: {}, noShow: {} }; }
}

async function toggleCheckIn(ma) {
  // If "nicht erschienen": click clears that state first via API
  if (ma.noShow) {
    ma.noShow = false;
    props.api.post('/api/public/noshow/toggle', {
      auftragNr: props.einsatz.auftragNr,
      personalNr: ma.personalNr,
    }).catch(() => {
      ma.noShow = true; // revert on error
    });
    return;
  }
  ma.checkedIn = !ma.checkedIn;
  try {
    await props.api.post('/api/public/checkins/toggle', {
      auftragNr: props.einsatz.auftragNr,
      personalNr: ma.personalNr,
    });
  } catch {
    ma.checkedIn = !ma.checkedIn; // revert on error
  }
}

async function loadMitarbeiter() {
  if (!props.einsatz?.auftragNr) return;
  loadingMa.value = true;
  try {
    const res = await props.api.get('/api/public/einsatz-mitarbeiter', {
      params: { auftragNr: props.einsatz.auftragNr }
    });
    const saved = await loadCheckIns(props.einsatz.auftragNr);
    schichtGruppen.value = (res.data || []).map(schicht => ({
      ...schicht,
      mitarbeiter: schicht.mitarbeiter.map(ma => ({
        ...ma,
        checkedIn: !!saved.checkedIn[ma.personalNr],
        noShow: !!saved.noShow[ma.personalNr],
      }))
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

/* Debug bar */
.debug-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding: 0.4rem 0.6rem;
  background: rgba(255, 200, 0, 0.1);
  border: 1px dashed rgba(255, 200, 0, 0.5);
  border-radius: 8px;
  flex-wrap: wrap;
}
.debug-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #b45309;
  flex: 1;
}
.debug-btn {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.3rem 0.65rem;
  border: 1px solid #b45309;
  border-radius: 6px;
  background: transparent;
  color: #b45309;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.debug-btn:disabled { opacity: 0.5; }

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

.inline-loader {
  padding: 0.75rem 1rem;
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all 0.15s;
}

.tl-badge--corner {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 9px 0 6px 0 !important;
}

.ma-card.checked-in {
  border-color: #28a745;
  background: rgba(40, 167, 69, 0.05);
}

.ma-card.nicht-erschienen {
  border-color: #dc2626;
  background: rgba(220, 38, 38, 0.05);
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

.ma-check--noshow {
  color: #dc2626 !important;
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

.ma-card.is-teamleiter {
  border-color: rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.04);
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

.info-share-btn {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  align-self: center;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s;
}

.info-share-btn:active {
  background: var(--hover);
  color: var(--primary);
  border-color: var(--primary);
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

.action-btn--done {
  color: var(--muted);
  border-color: var(--border);
  cursor: default;
  opacity: 0.65;
}

.action-btn--done:active {
  transform: none;
  filter: none;
}

/* Calendar Export Modal */
.calmodal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.calmodal-sheet {
  width: 100%;
  background: var(--panel);
  border-radius: 20px 20px 0 0;
  padding: 0.75rem 1.25rem 2rem;
  padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.calmodal-handle {
  width: 36px;
  height: 4px;
  border-radius: 4px;
  background: var(--border);
  margin-bottom: 0.25rem;
}

.calmodal-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(255, 117, 24, 0.12);
  border: 1.5px solid rgba(255, 117, 24, 0.3);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}

.calmodal-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.calmodal-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  text-align: center;
}

.calmodal-event {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.calmodal-date {
  font-size: 0.8rem;
  color: var(--muted);
}

.calmodal-hint {
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
  margin: 0;
  line-height: 1.4;
  max-width: 300px;
}

.calmodal-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.25rem;
}

.calmodal-btn {
  flex: 1;
  padding: 0.8rem;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s;
}

.calmodal-btn:active { opacity: 0.75; }
.calmodal-btn:disabled { opacity: 0.5; }

.calmodal-btn--cancel {
  background: var(--hover);
  color: var(--muted);
}

.calmodal-btn--confirm {
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

/* Transition */
.calmodal-enter-active { transition: opacity 0.2s; }
.calmodal-leave-active { transition: opacity 0.15s; }
.calmodal-enter-from, .calmodal-leave-to { opacity: 0; }
.calmodal-enter-active .calmodal-sheet { transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
.calmodal-leave-active .calmodal-sheet { transition: transform 0.2s ease-in; }
.calmodal-enter-from .calmodal-sheet, .calmodal-leave-to .calmodal-sheet { transform: translateY(100%); }

.badge-label {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1.5px solid;
}

/* MA three-dot menu button */
.ma-menu-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 8px;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.15s, background 0.15s;
}
.ma-menu-btn:active {
  color: var(--text);
  background: var(--hover);
}

/* Annotation badges on MA cards */
.ma-annot-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
}
.ma-annot-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
}
.ma-annot-badge--delay {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
  border: 1px solid rgba(234, 88, 12, 0.3);
}
.ma-annot-badge--noshow {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  border: 1px solid rgba(220, 38, 38, 0.3);
}


/* Action Sheet */
.annot-actionsheet {
  gap: 0;
  padding-top: 0.5rem;
}
.annot-actionsheet-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
  margin: 0 0 0.75rem;
  text-align: center;
}
.annot-action-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.annot-action-item:active {
  background: var(--hover);
}
.annot-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.annot-action-icon--delay {
  background: rgba(234, 88, 12, 0.12);
  color: #ea580c;
}
.annot-action-icon--noshow {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}
.annot-action-badge {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 8px;
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}
.annot-action-badge--noshow {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.annot-cancel-btn {
  width: 100%;
  margin-top: 0.25rem;
  font-size: 0.95rem;
}

/* Verspätung Input */
.verspaetung-input-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0.25rem 0 0.75rem;
}
.verspaetung-input {
  width: 120px;
  text-align: center;
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--text);
  background: var(--tile-bg);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 0.5rem 0.75rem;
  outline: none;
  appearance: textfield;
  -webkit-appearance: none;
  -moz-appearance: textfield;
}
.verspaetung-input:focus {
  border-color: var(--primary);
}
.verspaetung-input::-webkit-inner-spin-button,
.verspaetung-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.verspaetung-unit {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--muted);
}

/* Notes button in header */
.job-notes-row {
  margin-top: 0.6rem;
}
.job-notes-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s, color 0.15s;
}
.job-notes-btn--active {
  border-color: #0ea5e9;
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.07);
}
.job-notes-btn:active {
  opacity: 0.75;
}
.job-notes-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0ea5e9;
  flex-shrink: 0;
}

/* Notiz Sheet */
.notiz-sheet {
  align-items: stretch;
}
.notiz-textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--tile-bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 0.75rem;
  font-size: 0.9rem;
  color: var(--text);
  font-family: inherit;
  resize: none;
  outline: none;
  line-height: 1.5;
}
.notiz-textarea:focus {
  border-color: var(--primary);
}

/* ── Job Number Badge ───────────────────────────────────────── */
.job-nr-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 2;
  border-radius: 6px 0 9px 0;
  font-size: 0.6rem;
  font-weight: 800;
  padding: 0.2rem 0.45rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
  line-height: 1.2;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0,0,0,0.25);
}

/* Bronze (1–5) */
.job-tier-bronze {
  background: linear-gradient(135deg, #cd7f32 0%, #a0522d 50%, #c68642 100%);
  color: #fff8ef;
}

/* Silber (6–20) */
.job-tier-silver {
  background: linear-gradient(135deg, #d0d0d0 0%, #a8a8a8 50%, #c8c8c8 100%);
  color: #2a2a2a;
  text-shadow: none;
}

/* Gold (21–50) */
.job-tier-gold {
  background: linear-gradient(135deg, #ffd700 0%, #daa520 50%, #f5c518 100%);
  color: #4a3000;
  text-shadow: none;
}

/* Diamond (51–100) */
.job-tier-diamond {
  background: linear-gradient(135deg, #a8edff 0%, #7dd3fc 40%, #c7f2ff 70%, #b2e8ff 100%);
  color: #0c4a6e;
  text-shadow: none;
  box-shadow: 0 0 6px rgba(125, 211, 252, 0.6), inset 0 1px 1px rgba(255,255,255,0.5);
}

/* Onyx / Purple Obsidian (101–200) */
@keyframes onyx-bloom {
  0%   { background-position: 0% 0%,   100% 100%, 50% 0%,   0% 0%; }
  20%  { background-position: 80% 20%, 10%  80%,  60% 40%,  0% 0%; }
  40%  { background-position: 60% 100%,40%  10%,  40% 100%, 0% 0%; }
  60%  { background-position: 20% 80%, 80%  60%,  60% 100%, 0% 0%; }
  80%  { background-position: 10% 60%, 90%  40%,  30% 60%,  0% 0%; }
  100% { background-position: 0% 0%,   100% 100%, 50% 0%,   0% 0%; }
}
.job-tier-onyx {
  background-image:
    radial-gradient(ellipse 60% 50% at 20% 30%, rgba(216,180,254,0.55) 0%, transparent 65%),
    radial-gradient(ellipse 45% 65% at 75% 70%, rgba(167,139,250,0.45) 0%, transparent 60%),
    radial-gradient(ellipse 35% 30% at 55% 20%, rgba(255,255,255,0.28) 0%, transparent 55%),
    linear-gradient(135deg, #0d0520 0%, #2e0f6e 40%, #4a1aaa 65%, #180e40 100%);
  background-size: 220% 220%, 220% 220%, 220% 220%, 100% 100%;
  animation: onyx-bloom 6s ease-in-out infinite;
  color: #ede9fe;
}

/* Rainbow Glass (201–500) */
.job-tier-rainbow {
  background: linear-gradient(
    270deg,
    #ff0040, #ff6a00, #ffd000,
    #00e676, #00b0ff, #c040fb,
    #ff0040
  );
  background-size: 600% 600%;
  animation: immortal-shift 5s ease infinite;
  color: #fff;
  text-shadow: 0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(255,255,255,0.4);
}

/* Straight-Legend (500–999) — Fireworks burst */
@keyframes firework-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes firework-glow {
  0%   { box-shadow: none; }
}
.job-nr-text {
  position: relative;
  z-index: 2;
}

.job-tier-legend {
  overflow: hidden;
  background: #0d0d0d;
  color: #ffd700;
  border: 1px solid rgba(255,215,0,0.5);
  text-shadow: 0 0 5px rgba(255,215,0,0.9);
  animation: firework-glow 2s ease infinite;
  letter-spacing: 0.04em;
  z-index: 0;
  box-shadow: none;
}
.job-tier-legend::before {
  content: '';
  position: absolute;
  inset: -150%;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,   rgba(255,215,0,0.95) 2deg,   transparent 5deg,
    transparent 27deg,  rgba(255,150,0,0.85) 29deg,  transparent 32deg,
    transparent 57deg,  rgba(255,255,200,0.95) 59deg, transparent 62deg,
    transparent 87deg,  rgba(255,80,0,0.85) 89deg,   transparent 92deg,
    transparent 117deg, rgba(255,215,0,0.95) 119deg,  transparent 122deg,
    transparent 147deg, rgba(255,200,100,0.85) 149deg,transparent 152deg,
    transparent 177deg, rgba(255,255,255,0.95) 179deg,transparent 182deg,
    transparent 207deg, rgba(255,100,0,0.85) 209deg,  transparent 212deg,
    transparent 237deg, rgba(255,215,0,0.95) 239deg,  transparent 242deg,
    transparent 267deg, rgba(255,150,50,0.85) 269deg, transparent 272deg,
    transparent 297deg, rgba(255,255,200,0.95) 299deg,transparent 302deg,
    transparent 327deg, rgba(255,80,0,0.85) 329deg,   transparent 332deg
  );
  animation: firework-spin 1.8s linear infinite;
  z-index: 1;
}
.job-tier-legend::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.65) 0%, transparent 80%);
  z-index: 1;
}

/* Immortal (1000+) */
@keyframes immortal-shift {
  0%   { background-position: 0% 50%; filter: hue-rotate(0deg) brightness(1.1); }
  33%  { background-position: 60% 20%; filter: hue-rotate(90deg) brightness(1.3); }
  66%  { background-position: 100% 80%; filter: hue-rotate(210deg) brightness(1.15); }
  100% { background-position: 0% 50%; filter: hue-rotate(360deg) brightness(1.1); }
}
/* Immortal (1000+) — Divine Pulsar */
@keyframes immortal-rays {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes immortal-plasma {
  0%   { background-position: 0% 0%,   100% 100%, 50% 50%; }
  33%  { background-position: 100% 50%, 0% 0%,   0% 100%; }
  66%  { background-position: 50% 100%, 50% 0%,  100% 0%; }
  100% { background-position: 0% 0%,   100% 100%, 50% 50%; }
}
@keyframes immortal-heartbeat {
  0%, 100% {
    text-shadow:
      0 0 2px #fff,
      0 0 6px rgba(255,215,0,0.95),
      0 0 12px rgba(255,215,0,0.6);
  }
  50% {
    text-shadow:
      0 0 3px #fff,
      0 0 10px rgba(255,215,0,1),
      0 0 22px rgba(255,215,0,0.85),
      0 0 36px rgba(255,255,255,0.35);
  }
}
.job-tier-immortal {
  background: #0d0420;
  color: #ffffff;
  border: 1px solid rgba(255, 215, 0, 0.8);
  font-weight: 900;
  letter-spacing: 0.05em;
  overflow: hidden;
  isolation: isolate;
}
.job-tier-immortal .job-nr-text {
  position: relative;
  z-index: 3;
  animation: immortal-heartbeat 2s ease-in-out infinite;
}
/* 24 ultra-thin spinning divine rays */
.job-tier-immortal::before {
  content: '';
  position: absolute;
  inset: -180%;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,   rgba(255,255,255,0.92) 0.8deg,  transparent 2deg,
    transparent 13deg,  rgba(255,215,0,0.92)   13.8deg,  transparent 15deg,
    transparent 28deg,  rgba(255,255,255,0.88) 28.8deg,  transparent 30deg,
    transparent 43deg,  rgba(255,215,0,0.92)   43.8deg,  transparent 45deg,
    transparent 58deg,  rgba(255,255,255,0.92) 58.8deg,  transparent 60deg,
    transparent 73deg,  rgba(255,215,0,0.88)   73.8deg,  transparent 75deg,
    transparent 88deg,  rgba(255,255,255,0.92) 88.8deg,  transparent 90deg,
    transparent 103deg, rgba(255,215,0,0.92)  103.8deg,  transparent 105deg,
    transparent 118deg, rgba(255,255,255,0.88)118.8deg,  transparent 120deg,
    transparent 133deg, rgba(255,215,0,0.92)  133.8deg,  transparent 135deg,
    transparent 148deg, rgba(255,255,255,0.92)148.8deg,  transparent 150deg,
    transparent 163deg, rgba(255,215,0,0.88)  163.8deg,  transparent 165deg,
    transparent 178deg, rgba(255,255,255,0.92)178.8deg,  transparent 180deg,
    transparent 193deg, rgba(255,215,0,0.92)  193.8deg,  transparent 195deg,
    transparent 208deg, rgba(255,255,255,0.88)208.8deg,  transparent 210deg,
    transparent 223deg, rgba(255,215,0,0.92)  223.8deg,  transparent 225deg,
    transparent 238deg, rgba(255,255,255,0.92)238.8deg,  transparent 240deg,
    transparent 253deg, rgba(255,215,0,0.88)  253.8deg,  transparent 255deg,
    transparent 268deg, rgba(255,255,255,0.92)268.8deg,  transparent 270deg,
    transparent 283deg, rgba(255,215,0,0.92)  283.8deg,  transparent 285deg,
    transparent 298deg, rgba(255,255,255,0.88)298.8deg,  transparent 300deg,
    transparent 313deg, rgba(255,215,0,0.92)  313.8deg,  transparent 315deg,
    transparent 328deg, rgba(255,255,255,0.92)328.8deg,  transparent 330deg,
    transparent 343deg, rgba(255,215,0,0.88)  343.8deg,  transparent 345deg
  );
  animation: immortal-rays 1s linear infinite;
  z-index: 1;
}
/* Drifting nebula plasma that floats above the rays */
.job-tier-immortal::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 20% 40%, rgba(167,139,250,0.75) 0%, transparent 65%),
    radial-gradient(ellipse 55% 65% at 80% 60%, rgba(56,189,248,0.65) 0%, transparent 60%),
    radial-gradient(ellipse 50% 45% at 55% 25%, rgba(255,215,0,0.40) 0%, transparent 55%);
  background-size: 280% 280%, 280% 280%, 280% 280%;
  animation: immortal-plasma 5s ease-in-out infinite;
  z-index: 2;
}
</style>
