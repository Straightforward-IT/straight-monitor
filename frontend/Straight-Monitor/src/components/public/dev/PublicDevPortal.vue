<template>
  <div class="dev-portal">
    <PublicHeader
      :current-view="detailView ? 'dev-detail' : 'dashboard'"
      :email="email"
      :debug-tl-active="debugTlActive"
      :debug-dev-active="true"
      :public-menu-options="['dev-mode']"
      :hide-menu="true"
      :title-override="detailView ? pageTitle : ''"
      @back="closeDetail"
      @toggle-debug-dev="$emit('exit')"
      @toggle-debug-tl="$emit('toggle-debug-tl')"
    >
      <template #navigation>
        <nav v-if="!detailView" class="desktop-nav" aria-label="Hauptnavigation">
          <button v-for="item in navigation" :key="item.id" type="button" :class="{ active: activeTab === item.id }" @click="selectTab(item.id)">
            <img v-if="item.id === 'profile' && profileImageUrl" :src="profileImageUrl" class="profile-avatar profile-avatar--nav" alt="" />
            <span v-else-if="item.id === 'profile'" class="profile-avatar profile-avatar--nav">{{ initials }}</span>
            <font-awesome-icon v-else :icon="item.icon" />
            <span>{{ item.label }}</span>
            <i v-if="item.badge">{{ item.badge }}</i>
          </button>
        </nav>
      </template>
    </PublicHeader>
    <main class="dev-main">
      <template v-if="detailView === 'calendar-job' && selectedCalendarJob">
        <PublicJobDetail
          :einsatz="selectedCalendarJob"
          :is-teamleiter="isTeamleiter"
          :is-past="false"
          :api="api"
          :email="email"
          :mitarbeiter="mitarbeiter"
          :token="token"
          @write-report="$emit('write-report', $event)"
        />
      </template>

      <template v-else-if="detailView === 'job' && selectedJob">
        <section class="job-hero">
          <span class="date-kicker">{{ formatLongDate(selectedJob.dateFrom) }}</span>
          <h2>{{ selectedJob.title }}</h2>
          <p>{{ selectedJob.role || 'Tätigkeit noch offen' }}</p>
        </section>
        <section class="detail-list">
          <div class="detail-row"><span>Zeit</span><strong>{{ jobTime(selectedJob) }}</strong></div>
          <div class="detail-row"><span>Treffpunkt</span><strong>{{ meetingPoint(selectedJob) }}</strong></div>
          <div class="detail-row"><span>Ort</span><strong>{{ selectedJob.address || selectedJob.city || 'Noch nicht angegeben' }}</strong></div>
          <div class="detail-row"><span>Dresscode</span><strong>{{ selectedJob.dressCode || 'Noch nicht angegeben' }}</strong></div>
          <div class="detail-row"><span>Vergütung</span><strong>{{ selectedJob.hourlyWage || 'Noch nicht angegeben' }}</strong></div>
          <div class="detail-row"><span>Freie Plätze</span><strong>{{ selectedJob.openPlaces }}</strong></div>
        </section>
        <div v-if="selectedJob.isFixture" class="fixture-note">Beispieldaten für die Layout-Erprobung</div>
        <div class="sticky-action">
          <button v-if="!applicationStatus(selectedJob.id)" class="primary-button" type="button" @click="setApplication(selectedJob.id, 'submitted')">Bewerben</button>
          <template v-else>
            <div class="status-panel" :class="`status-${applicationStatus(selectedJob.id)}`">
              <font-awesome-icon icon="fa-solid fa-circle-check" />
              <strong>{{ applicationLabel(applicationStatus(selectedJob.id)) }}</strong>
            </div>
            <div class="scenario-actions">
              <span>Status simulieren</span>
              <button type="button" @click="setApplication(selectedJob.id, 'confirmed')">Bestätigt</button>
              <button type="button" @click="setApplication(selectedJob.id, 'waitlist')">Warteliste</button>
              <button type="button" @click="setApplication(selectedJob.id, null)">Zurücksetzen</button>
            </div>
          </template>
        </div>
      </template>

      <template v-else-if="detailView === 'time'">
        <section class="job-hero compact">
          <span class="date-kicker">Heute</span>
          <h2>Hotel Atlantic</h2>
          <p>Service · geplant 17:00 – 02:00</p>
        </section>
        <section class="timer-surface">
          <span class="timer-status">{{ timeStatusLabel }}</span>
          <strong class="timer">{{ formattedElapsed }}</strong>
          <span class="timer-caption">Arbeitszeit</span>
        </section>
        <div class="time-actions">
          <button v-if="timeEntry.status === 'idle'" class="primary-button" type="button" @click="startTime">Einchecken</button>
          <template v-else-if="['running', 'paused'].includes(timeEntry.status)">
            <button class="secondary-button" type="button" @click="togglePause">{{ timeEntry.status === 'paused' ? 'Pause beenden' : 'Pause' }}</button>
            <button class="danger-button" type="button" @click="stopTime">Arbeit beenden</button>
          </template>
          <button v-else-if="timeEntry.status === 'stopped'" class="primary-button" type="button" @click="submitTime">Zeit bestätigen</button>
        </div>
        <section v-if="['stopped', 'submitted', 'approved', 'locked'].includes(timeEntry.status)" class="summary-panel">
          <div><span>Arbeitsbeginn</span><strong>{{ formatClock(timeEntry.startedAt) }}</strong></div>
          <div><span>Arbeitsende</span><strong>{{ formatClock(timeEntry.stoppedAt) }}</strong></div>
          <div><span>Pause</span><strong>{{ Math.round((timeEntry.pauseMs || 0) / 60000) }} min</strong></div>
          <div class="summary-total"><span>Arbeitszeit</span><strong>{{ formattedElapsed }}</strong></div>
        </section>
        <section v-if="['submitted', 'approved', 'locked'].includes(timeEntry.status)" class="workflow-panel">
          <span :class="{ active: timeEntry.status === 'submitted' }">Eingereicht</span><font-awesome-icon icon="fa-solid fa-chevron-right" />
          <span :class="{ active: timeEntry.status === 'approved' }">Office geprüft</span><font-awesome-icon icon="fa-solid fa-chevron-right" />
          <span :class="{ active: timeEntry.status === 'locked' }">Gesperrt</span>
        </section>
        <div v-if="timeEntry.status === 'submitted'" class="scenario-actions full"><span>Office-Status simulieren</span><button type="button" @click="advanceTime('approved')">Freigeben</button></div>
        <div v-if="timeEntry.status === 'approved'" class="scenario-actions full"><span>Payroll-Status simulieren</span><button type="button" @click="advanceTime('locked')">Sperren</button></div>
        <button v-if="['submitted', 'approved'].includes(timeEntry.status)" class="text-button" type="button" @click="showCorrection = !showCorrection">Meine Zeit stimmt nicht</button>
        <form v-if="showCorrection" class="correction-form" @submit.prevent="requestCorrection">
          <label>Richtiges Arbeitsende <input v-model="correctionTime" type="time" required /></label>
          <label>Grund <textarea v-model.trim="correctionReason" rows="3" required /></label>
          <button class="primary-button" type="submit">Korrektur anfragen</button>
        </form>
        <div v-if="timeEntry.correction" class="correction-history">
          <strong>Korrektur angefragt</strong>
          <span>Original: {{ timeEntry.correction.original }} · Gewünscht: {{ timeEntry.correction.requested }}</span>
          <p>{{ timeEntry.correction.reason }}</p>
        </div>
      </template>

      <template v-else-if="detailView === 'document' && selectedDocument">
        <section class="document-preview">
          <font-awesome-icon icon="fa-solid fa-file-pdf" /><h2>{{ selectedDocument.name }}</h2>
          <p>{{ selectedDocument.fileName || 'Noch kein Dokument vorhanden' }}</p><span>Prototyp-Vorschau</span>
        </section>
        <button v-if="selectedDocument.fileName" class="secondary-button wide" type="button" @click="previewMessage = 'Der Download ist im Prototyp deaktiviert.'">Download testen</button>
        <p v-if="previewMessage" class="inline-message">{{ previewMessage }}</p>
      </template>

      <template v-else-if="detailView === 'payroll' && selectedPayroll">
        <section class="document-preview payroll-preview">
          <font-awesome-icon icon="fa-solid fa-file-invoice-dollar" /><h2>Lohnabrechnung {{ selectedPayroll.month }}</h2>
          <p>Bereitgestellt durch den zukünftigen Payroll-Anbieter</p><span>Schreibgeschützte Prototyp-Vorschau</span>
        </section>
        <button class="secondary-button wide" type="button" @click="previewMessage = 'Der Download ist im Prototyp deaktiviert.'">Download testen</button>
        <p v-if="previewMessage" class="inline-message">{{ previewMessage }}</p>
      </template>

      <template v-else-if="activeTab === 'home'">
        <section class="welcome-row"><div><span>{{ formattedToday }}</span><h2>Hallo, {{ vorname }}!</h2></div><span class="prototype-pill">DEV</span></section>
        <section v-if="nextEinsatz" class="today-shift">
          <div class="shift-topline"><span>{{ nextEinsatzDate }} · {{ einsatzTime(nextEinsatz) }}</span><span>{{ nextEinsatzRole }}</span></div>
          <h3>{{ nextEinsatzTitle }}</h3>
          <p><font-awesome-icon icon="fa-solid fa-location-dot" /> {{ nextEinsatzLocation }}</p>
          <button class="primary-button" type="button" @click="openCalendarJob(nextEinsatz)"><font-awesome-icon icon="fa-solid fa-chevron-right" />Einsatz ansehen</button>
        </section>
        <section v-else class="today-shift today-shift--empty">
          <div class="shift-topline"><span>Nächster Einsatz</span></div>
          <h3>Kein Einsatz geplant</h3>
          <p>Deine kommenden Einsätze erscheinen hier.</p>
          <button class="secondary-button wide" type="button" @click="selectTab('calendar')"><font-awesome-icon icon="fa-solid fa-calendar-days" />Kalender öffnen</button>
        </section>
        <PublicUpcomingJobs :einsaetze="einsaetze" @open-job="openCalendarJob" />
        <section class="home-section">
          <div class="section-heading"><h3>Neue Jobs</h3><button type="button" @click="selectTab('jobs')">Alle</button></div>
          <button v-for="job in jobs.slice(0, 2)" :key="job.id" class="compact-job" type="button" @click="openJob(job)"><span class="job-date"><strong>{{ dayNumber(job.dateFrom) }}</strong>{{ monthShort(job.dateFrom) }}</span><span><strong>{{ job.title }}</strong><small>{{ job.role || 'Tätigkeit offen' }} · {{ jobTime(job) }}</small></span><span class="places">{{ job.openPlaces }} frei</span></button>
        </section>
      </template>

      <template v-else-if="activeTab === 'jobs'">
        <div class="intro-row"><div><h2>Jobangebote</h2><p>Finde deinen nächsten Einsatz.</p></div><span v-if="jobsAreFixtures" class="source-badge">Demo</span></div>
        <div class="filter-row"><button type="button" :class="{ active: jobFilter === 'all' }" @click="jobFilter = 'all'">Alle</button><button v-for="role in jobRoles" :key="role" type="button" :class="{ active: jobFilter === role }" @click="jobFilter = role">{{ role }}</button></div>
        <div v-if="jobsLoading" class="loading-row"><font-awesome-icon icon="fa-solid fa-spinner" spin /> Jobs werden geladen</div>
        <div v-else-if="jobsError && !jobs.length" class="empty-state"><strong>Keine Jobs verfügbar</strong><p>{{ jobsError }}</p></div>
        <button v-for="job in filteredJobs" :key="job.id" class="job-card" type="button" @click="openJob(job)">
          <div class="job-card-date"><strong>{{ weekday(job.dateFrom) }}</strong><span>{{ shortDate(job.dateFrom) }}</span></div>
          <div class="job-card-body"><div class="job-card-title"><h3>{{ job.title }}</h3><span v-if="applicationStatus(job.id)" class="mini-status">{{ applicationLabel(applicationStatus(job.id)) }}</span></div><p>{{ job.role || 'Tätigkeit noch offen' }}</p><div class="job-meta"><span><font-awesome-icon icon="fa-solid fa-clock" /> {{ jobTime(job) }}</span><span><font-awesome-icon icon="fa-solid fa-location-dot" /> {{ job.city || job.locationName || 'Ort offen' }}</span></div><div class="job-card-footer"><span>{{ job.hourlyWage || 'Vergütung folgt' }}</span><strong>Noch {{ job.openPlaces }} Plätze</strong></div></div>
          <font-awesome-icon icon="fa-solid fa-chevron-right" />
        </button>
      </template>

      <template v-else-if="activeTab === 'calendar'">
        <PublicKalender
          :einsaetze="einsaetze"
          :is-teamleiter="false"
          @open-job="openCalendarJob"
        />
      </template>

      <template v-else-if="detailView === 'documents'">
        <div class="intro-row"><div><h2>Meine Dokumente</h2><p>Unterlagen und Abrechnungen</p></div></div>
        <div class="sub-tabs"><button type="button" :class="{ active: documentTab === 'documents' }" @click="documentTab = 'documents'">Dokumente</button><button type="button" :class="{ active: documentTab === 'payroll' }" @click="documentTab = 'payroll'">Abrechnungen</button></div>
        <template v-if="documentTab === 'documents'"><div class="document-list"><article v-for="document in demoState.documents" :key="document.id" class="document-row"><button type="button" @click="openDocument(document)"><span class="document-status" :class="document.status"><font-awesome-icon :icon="documentIcon(document.status)" /></span><span><strong>{{ document.name }}</strong><small>{{ documentDescription(document) }}</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button><label v-if="['missing', 'expiring'].includes(document.status)" class="upload-button">{{ document.status === 'missing' ? 'Hochladen' : 'Erneuern' }}<input type="file" accept=".pdf,.jpg,.jpeg,.png" @change="handleLocalUpload($event, document)" /></label></article></div></template>
        <template v-else><button v-for="payroll in payrollDocuments" :key="payroll.id" class="payroll-row" type="button" @click="openPayroll(payroll)"><span><font-awesome-icon icon="fa-solid fa-file-invoice-dollar" /></span><span><strong>{{ payroll.month }}</strong><small>Lohnabrechnung · PDF</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button></template>
      </template>

      <template v-else-if="activeTab === 'profile'">
        <section class="profile-intro">
          <img v-if="profileImageUrl" :src="profileImageUrl" class="profile-avatar profile-avatar--large" alt="" />
          <span v-else class="profile-avatar profile-avatar--large">{{ initials }}</span>
          <div><h2>Profil</h2><strong>{{ vorname }}</strong></div>
        </section>
        <div class="settings-list"><button type="button" @click="openDocuments"><font-awesome-icon icon="fa-solid fa-folder-open" /><span><strong>Dokumente</strong><small>{{ missingDocumentCount }} offen · Unterlagen und Abrechnungen</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button><button type="button" @click="toggleTheme"><font-awesome-icon :icon="theme.isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'" /><span><strong>Darstellung</strong><small>{{ theme.isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln' }}</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button><button type="button" @click="resetPrototype"><font-awesome-icon icon="fa-solid fa-rotate-left" /><span><strong>Prototyp zurücksetzen</strong><small>Alle lokalen Demo-Zustände löschen</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button><button type="button" class="exit-row" @click="$emit('exit')"><font-awesome-icon icon="fa-solid fa-arrow-right-from-bracket" /><span><strong>Prototyp verlassen</strong><small>Zum aktuellen Public Monitor</small></span><font-awesome-icon icon="fa-solid fa-chevron-right" /></button></div>
        <p v-if="resetMessage" class="inline-message">{{ resetMessage }}</p>
      </template>
    </main>

    <nav v-if="!detailView" class="bottom-nav" aria-label="Hauptnavigation"><button v-for="item in navigation" :key="item.id" type="button" :class="{ active: activeTab === item.id }" @click="selectTab(item.id)"><span class="nav-icon"><img v-if="item.id === 'profile' && profileImageUrl" :src="profileImageUrl" class="profile-avatar profile-avatar--nav" alt="" /><span v-else-if="item.id === 'profile'" class="profile-avatar profile-avatar--nav">{{ initials }}</span><font-awesome-icon v-else :icon="item.icon" /><i v-if="item.badge">{{ item.badge }}</i></span><span>{{ item.label }}</span></button></nav>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowRightFromBracket,
  faBriefcase,
  faCalendarDays,
  faChevronRight,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faCircleXmark,
  faClock,
  faEllipsis,
  faFileCircleExclamation,
  faFileInvoiceDollar,
  faFilePdf,
  faFlask,
  faFolderOpen,
  faHouse,
  faLocationDot,
  faMoon,
  faRotateLeft,
  faSpinner,
  faSun,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '@/stores/theme';
import PublicHeader from '../PublicHeader.vue';
import PublicJobDetail from '../PublicJobDetail.vue';
import PublicKalender from '../PublicKalender.vue';
import PublicUpcomingJobs from '../PublicUpcomingJobs.vue';
import { createDemoJobs, usePublicDevDemo } from './usePublicDevDemo';

library.add(
  faArrowRightFromBracket, faBriefcase, faCalendarDays, faChevronRight,
  faCircleCheck, faCircleExclamation, faCircleInfo, faCircleXmark, faClock, faEllipsis,
  faFileCircleExclamation, faFileInvoiceDollar, faFilePdf, faFlask, faFolderOpen,
  faHouse, faLocationDot, faMoon, faRotateLeft, faSpinner, faSun, faTriangleExclamation,
);

const props = defineProps({
  vorname: { type: String, default: '' },
  email: { type: String, default: '' },
  api: { type: Function, required: true },
  einsaetze: { type: Array, default: () => [] },
  mitarbeiter: { type: Object, required: true },
  token: { type: String, required: true },
  isTeamleiter: { type: Boolean, default: false },
  debugTlActive: { type: Boolean, default: false },
});
defineEmits(['exit', 'write-report', 'toggle-debug-tl']);

const theme = useTheme();
const { state: demoState, reset } = usePublicDevDemo(props.email);
const activeTab = ref('home');
const detailView = ref(null);
const selectedJob = ref(null);
const selectedCalendarJob = ref(null);
const selectedDocument = ref(null);
const selectedPayroll = ref(null);
const returnDetailView = ref(null);
const documentTab = ref('documents');
const jobFilter = ref('all');
const jobs = ref([]);
const jobsLoading = ref(true);
const jobsError = ref('');
const jobsAreFixtures = ref(false);
const nowTick = ref(Date.now());
const showCorrection = ref(false);
const correctionTime = ref('');
const correctionReason = ref('');
const previewMessage = ref('');
const resetMessage = ref('');
const profileImageUrl = ref('');
let timer = null;

const payrollDocuments = [{ id: '2026-08', month: 'August 2026' }, { id: '2026-07', month: 'Juli 2026' }, { id: '2026-06', month: 'Juni 2026' }];
const timeEntry = computed(() => demoState.timeEntry);
const missingDocumentCount = computed(() => demoState.documents.filter((item) => ['missing', 'expiring'].includes(item.status)).length);
const submittedApplications = computed(() => Object.keys(demoState.applications).length);
const openActionCount = computed(() => 2 + (submittedApplications.value ? 1 : 0));
const formattedToday = computed(() => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }));
const initials = computed(() => (props.vorname || 'PM').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase());
const jobRoles = computed(() => [...new Set(jobs.value.map((job) => job.role).filter(Boolean))]);
const filteredJobs = computed(() => jobFilter.value === 'all' ? jobs.value : jobs.value.filter((job) => job.role === jobFilter.value));
const nextEinsatz = computed(() => {
  const now = new Date();
  return [...props.einsaetze]
    .filter((einsatz) => einsatzEnd(einsatz) >= now.getTime())
    .sort((left, right) => einsatzStart(left) - einsatzStart(right))[0] || null;
});
const nextEinsatzDate = computed(() => formatEinsatzDate(nextEinsatz.value?.datumVon));
const nextEinsatzTitle = computed(() => nextEinsatz.value?.auftrag?.eventTitel || nextEinsatz.value?.bezeichnung || `Auftrag #${nextEinsatz.value?.auftragNr}`);
const nextEinsatzRole = computed(() => nextEinsatz.value?.bezeichnung || nextEinsatz.value?.schichtBezeichnung || 'Einsatz');
const nextEinsatzLocation = computed(() => {
  const einsatz = nextEinsatz.value;
  if (!einsatz) return '';
  const location = einsatz.auftrag?.eventLocation || einsatz.auftrag?.eventOrt;
  const meeting = [normalizedTime(einsatz.treffpunkt), einsatz.treffpunktOrt].filter(Boolean).join(' · ');
  return meeting || location || 'Ort noch nicht angegeben';
});
const navigation = computed(() => [
  { id: 'home', label: 'Home', icon: 'fa-solid fa-house' }, { id: 'jobs', label: 'Jobs', icon: 'fa-solid fa-briefcase', badge: jobs.value.length || null },
  { id: 'calendar', label: 'Kalender', icon: 'fa-solid fa-calendar-days' }, { id: 'profile', label: 'Profil', icon: 'fa-solid fa-ellipsis' },
]);
const pageTitle = computed(() => ({ 'calendar-job': 'Job Details', job: 'Job ansehen', time: 'Arbeitszeit', documents: 'Meine Dokumente', document: 'Dokument', payroll: 'Abrechnung' }[detailView.value] || 'Mitarbeiterportal'));
const elapsedMs = computed(() => { const entry = timeEntry.value; return entry.status === 'running' && entry.startedAt ? Math.max(0, nowTick.value - new Date(entry.startedAt).getTime() - (entry.pauseMs || 0)) : entry.elapsedMs || 0; });
const formattedElapsed = computed(() => formatDuration(elapsedMs.value));
const timeStatusLabel = computed(() => ({ idle: 'Noch nicht eingecheckt', running: 'Eingecheckt', paused: 'Pause läuft', stopped: 'Arbeit beendet', submitted: 'Zeit eingereicht', approved: 'Durch Office freigegeben', locked: 'Für Payroll gesperrt' }[timeEntry.value.status]));

function selectTab(tab) { activeTab.value = tab; detailView.value = null; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeDetail() { const returnView = returnDetailView.value; returnDetailView.value = null; detailView.value = returnView; selectedJob.value = null; selectedCalendarJob.value = null; selectedDocument.value = null; selectedPayroll.value = null; previewMessage.value = ''; showCorrection.value = false; }
function openJob(job) { selectedJob.value = job; detailView.value = 'job'; window.scrollTo(0, 0); }
function openCalendarJob(einsatz) { selectedCalendarJob.value = einsatz; detailView.value = 'calendar-job'; window.scrollTo(0, 0); }
function openTime() { detailView.value = 'time'; window.scrollTo(0, 0); }
function openDocuments() { detailView.value = 'documents'; window.scrollTo(0, 0); }
function openDocument(document) { returnDetailView.value = detailView.value === 'documents' ? 'documents' : null; selectedDocument.value = document; detailView.value = 'document'; }
function openPayroll(payroll) { returnDetailView.value = detailView.value === 'documents' ? 'documents' : null; selectedPayroll.value = payroll; detailView.value = 'payroll'; }
function applicationStatus(id) { return demoState.applications[id] || null; }
function setApplication(id, status) { if (status) demoState.applications[id] = status; else delete demoState.applications[id]; }
function applicationLabel(status) { return ({ submitted: 'Bewerbung eingegangen', confirmed: 'Bestätigt', waitlist: 'Warteliste' }[status] || status); }
function startTime() { Object.assign(timeEntry.value, { status: 'running', startedAt: new Date().toISOString(), stoppedAt: null, elapsedMs: 0, pauseStartedAt: null, pauseMs: 0, correction: null, history: [] }); }
function togglePause() { const entry = timeEntry.value; if (entry.status === 'running') { entry.status = 'paused'; entry.pauseStartedAt = new Date().toISOString(); entry.elapsedMs = elapsedMs.value; } else { entry.pauseMs += Date.now() - new Date(entry.pauseStartedAt).getTime(); entry.pauseStartedAt = null; entry.status = 'running'; } }
function stopTime() { const entry = timeEntry.value; if (entry.status === 'paused' && entry.pauseStartedAt) entry.pauseMs += Date.now() - new Date(entry.pauseStartedAt).getTime(); entry.elapsedMs = elapsedMs.value; entry.stoppedAt = new Date().toISOString(); entry.pauseStartedAt = null; entry.status = 'stopped'; }
function submitTime() { timeEntry.value.status = 'submitted'; }
function advanceTime(status) { timeEntry.value.history.push({ status, at: new Date().toISOString() }); timeEntry.value.status = status; }
function requestCorrection() { timeEntry.value.correction = { original: formatClock(timeEntry.value.stoppedAt), requested: correctionTime.value, reason: correctionReason.value, requestedAt: new Date().toISOString() }; showCorrection.value = false; correctionTime.value = ''; correctionReason.value = ''; }
function handleLocalUpload(event, document) { const file = event.target.files?.[0]; if (!file) return; document.fileName = file.name; document.status = 'in_review'; document.validity = null; event.target.value = ''; }
function resetPrototype() { reset(); resetMessage.value = 'Der lokale Prototyp wurde zurückgesetzt.'; window.setTimeout(() => { resetMessage.value = ''; }, 2500); }
function toggleTheme() { theme.set(theme.isDark ? 'light' : 'dark'); }
function formatDuration(milliseconds) { const seconds = Math.floor(Math.max(0, milliseconds) / 1000); return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function formatClock(value) { return value ? new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–'; }
function normalizedTime(value) { return value ? String(value).slice(0, 5) : null; }
function einsatzStart(einsatz) {
  const start = new Date(einsatz.datumVon);
  const time = normalizedTime(einsatz.uhrzeitVon);
  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    start.setHours(hours, minutes, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
  }
  return Number.isNaN(start.getTime()) ? Number.MAX_SAFE_INTEGER : start.getTime();
}
function einsatzEnd(einsatz) {
  const end = new Date(einsatz.datumBis || einsatz.datumVon);
  if (Number.isNaN(end.getTime())) return Number.MIN_SAFE_INTEGER;
  const time = normalizedTime(einsatz.uhrzeitBis);
  if (!time) {
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  }
  const [hours, minutes] = time.split(':').map(Number);
  end.setHours(hours, minutes, 0, 0);
  if (end.getTime() <= einsatzStart(einsatz)) end.setDate(end.getDate() + 1);
  return end.getTime();
}
function einsatzTime(einsatz) {
  const from = normalizedTime(einsatz?.uhrzeitVon);
  const to = normalizedTime(einsatz?.uhrzeitBis);
  if (!from) return 'Ganztags';
  return `${from}${to ? ` – ${to}` : ''}`;
}
function formatEinsatzDate(value) {
  if (!value) return 'Nächster Einsatz';
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Heute';
  if (date.toDateString() === tomorrow.toDateString()) return 'Morgen';
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\.$/, '');
}
function jobTime(job) { return `${normalizedTime(job.timeFrom) || 'offen'} – ${job.endOpen ? 'Ende offen' : normalizedTime(job.timeTo) || 'offen'}`; }
function meetingPoint(job) { return [normalizedTime(job.meetingTime), job.meetingPlace].filter(Boolean).join(' · ') || 'Noch nicht angegeben'; }
function weekday(value) { return new Date(value).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase(); }
function shortDate(value) { return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }
function dayNumber(value) { return new Date(value).toLocaleDateString('de-DE', { day: '2-digit' }); }
function monthShort(value) { return new Date(value).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '').toUpperCase(); }
function formatLongDate(value) { return new Date(value).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }); }
function documentIcon(status) { return ['approved', 'in_review'].includes(status) ? 'fa-solid fa-circle-check' : status === 'missing' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-triangle-exclamation'; }
function documentDescription(document) { if (document.status === 'approved') return 'Geprüft und vollständig'; if (document.status === 'in_review') return `In Prüfung · ${document.fileName}`; if (document.status === 'missing') return 'Fehlt · bitte hochladen'; return `Gültig bis ${new Date(document.validity).toLocaleDateString('de-DE')}`; }
async function loadJobs() { jobsLoading.value = true; try { const response = await props.api.get('/api/public/prototype/jobs'); jobs.value = response.data.jobs || []; if (!jobs.value.length && import.meta.env.DEV) { jobs.value = createDemoJobs(); jobsAreFixtures.value = true; } } catch (error) { jobsError.value = error.response?.data?.msg || 'Jobs konnten nicht geladen werden.'; if (import.meta.env.DEV) { jobs.value = createDemoJobs(); jobsAreFixtures.value = true; } } finally { jobsLoading.value = false; } }
async function loadProfileImage() {
  try {
    const response = await props.api.get('/api/public/mitarbeiter/profile-picture', {
      params: { email: props.email },
      responseType: 'blob',
    });
    if (response.data?.size) profileImageUrl.value = URL.createObjectURL(response.data);
  } catch {
    profileImageUrl.value = '';
  }
}

onMounted(() => { loadJobs(); loadProfileImage(); timer = window.setInterval(() => { nowTick.value = Date.now(); }, 1000); });
onBeforeUnmount(() => { window.clearInterval(timer); if (profileImageUrl.value) URL.revokeObjectURL(profileImageUrl.value); });
</script>

<style scoped>
.dev-portal { --dev-green:#157f5b; --dev-blue:#1f6f8b; --dev-red:#b84235; min-height:100vh; min-height:100dvh; padding-bottom:calc(76px + env(safe-area-inset-bottom)); background:var(--bg); color:var(--text); font-family:'Avenir Next','Trebuchet MS',sans-serif; }
button,input,textarea { font:inherit; } button { -webkit-tap-highlight-color:transparent; }
.demo-notice { display:flex; align-items:center; justify-content:center; gap:.45rem; padding:.55rem 1rem; background:color-mix(in srgb,var(--primary) 12%,var(--panel)); color:var(--text); font-size:.7rem; text-align:center; }.demo-notice svg { color:var(--primary); }.dev-main { max-width:680px; margin:0 auto; padding:.5rem 1rem 1rem; }.dev-main h2,.dev-main h3,.dev-main p { margin-top:0; }
.welcome-row,.intro-row { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin:.2rem 0 1rem; }.welcome-row span:first-child,.intro-row p { color:var(--muted); font-size:.78rem; }.welcome-row h2,.intro-row h2 { margin:.15rem 0 0; font-size:1.35rem; }.prototype-pill,.source-badge { padding:.22rem .45rem; border:1px solid var(--primary); border-radius:4px; color:var(--primary); font-size:.65rem; font-weight:800; }
.today-shift { padding:1rem; border-left:4px solid var(--primary); background:var(--panel); box-shadow:0 8px 24px rgba(0,0,0,.07); }.today-shift--empty { border-left-color:var(--border); box-shadow:none; }.shift-topline { display:flex; justify-content:space-between; gap:.75rem; color:var(--muted); font-size:.72rem; font-weight:700; text-transform:uppercase; }.shift-topline span:last-child { overflow:hidden; text-align:right; text-overflow:ellipsis; white-space:nowrap; }.today-shift h3 { margin:.6rem 0 .25rem; font-size:1.25rem; }.today-shift p { margin-bottom:1rem; color:var(--muted); font-size:.82rem; }
.primary-button,.secondary-button,.danger-button { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; min-height:46px; padding:.72rem 1rem; border-radius:6px; font-weight:750; cursor:pointer; }.primary-button { border:1px solid var(--primary); background:var(--primary); color:white; }.secondary-button { border:1px solid var(--border); background:var(--surface); color:var(--text); }.danger-button { border:1px solid var(--dev-red); background:transparent; color:var(--dev-red); }.wide,.today-shift .primary-button { width:100%; }
.home-section { margin-top:1.4rem; }.section-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:.5rem; }.section-heading h3 { margin:0; font-size:.95rem; }.section-heading>span { display:grid; width:24px; height:24px; place-items:center; border-radius:50%; background:var(--primary); color:white; font-size:.7rem; }.section-heading button { border:0; background:none; color:var(--primary); font-size:.78rem; cursor:pointer; }
.action-row,.compact-job,.settings-list button { display:grid; width:100%; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.75rem; min-height:62px; padding:.65rem 0; border:0; border-bottom:1px solid var(--border); background:transparent; color:var(--text); text-align:left; cursor:pointer; }.action-row>span:nth-child(2),.compact-job>span:nth-child(2),.settings-list button>span { display:grid; gap:.15rem; }.action-row small,.compact-job small,.settings-list small { color:var(--muted); font-size:.72rem; }.action-row>svg,.settings-list button>svg:last-child { color:var(--muted); font-size:.72rem; }.action-icon { display:grid; width:38px; height:38px; place-items:center; border-radius:6px; }.action-icon.warning { background:#fff0d8; color:#b56200; }.action-icon.calm { background:#dceef3; color:var(--dev-blue); }.action-icon.success { background:#dff3e9; color:var(--dev-green); }
.compact-job { grid-template-columns:45px minmax(0,1fr) auto; }.job-date { display:grid; color:var(--primary); font-size:.65rem; text-align:center; }.job-date strong { font-size:1.1rem; }.places { color:var(--dev-green); font-size:.68rem; font-weight:750; }
.bottom-nav { position:fixed; z-index:50; right:0; bottom:0; left:0; display:grid; grid-template-columns:repeat(4,1fr); min-height:66px; padding:5px max(6px,env(safe-area-inset-right)) calc(5px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left)); background:color-mix(in srgb,var(--panel) 96%,transparent); border-top:1px solid var(--border); backdrop-filter:blur(16px); }.bottom-nav button { display:grid; min-width:0; place-items:center; gap:0; border:0; background:none; color:var(--muted); font-size:.62rem; cursor:pointer; }.bottom-nav button.active { color:var(--primary); }.nav-icon { position:relative; display:grid; width:30px; height:28px; place-items:center; font-size:1.05rem; }.nav-icon i { position:absolute; top:-5px; right:-4px; display:grid; min-width:16px; height:16px; padding:0 3px; place-items:center; border:2px solid var(--panel); border-radius:8px; background:var(--primary); color:white; font-size:.52rem; font-style:normal; }.desktop-nav { display:none; }
.filter-row { display:flex; gap:.45rem; overflow-x:auto; margin:0 -1rem 1rem; padding:0 1rem; scrollbar-width:none; }.filter-row button,.sub-tabs button,.segmented-control button,.scenario-actions button { flex:0 0 auto; min-height:36px; padding:.45rem .75rem; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--muted); cursor:pointer; }.filter-row button.active,.sub-tabs button.active,.segmented-control button.active { border-color:var(--primary); color:var(--primary); }
.job-card { display:grid; width:100%; grid-template-columns:48px minmax(0,1fr) auto; align-items:start; gap:.75rem; margin-bottom:.7rem; padding:.9rem; border:1px solid var(--border); border-radius:8px; background:var(--panel); color:var(--text); text-align:left; cursor:pointer; }.job-card-date { display:grid; gap:.15rem; color:var(--primary); font-size:.68rem; text-align:center; }.job-card-date span { color:var(--text); }.job-card-title { display:flex; align-items:flex-start; justify-content:space-between; gap:.5rem; }.job-card h3 { margin:0; font-size:1rem; }.job-card-body>p { margin:.15rem 0 .6rem; color:var(--muted); font-size:.75rem; }.job-meta { display:flex; flex-wrap:wrap; gap:.65rem; color:var(--muted); font-size:.72rem; }.job-card-footer { display:flex; justify-content:space-between; gap:.5rem; margin-top:.7rem; padding-top:.6rem; border-top:1px solid var(--border); font-size:.7rem; }.job-card-footer strong { color:var(--dev-green); }.job-card>svg { align-self:center; color:var(--muted); font-size:.7rem; }.mini-status { color:var(--primary); font-size:.6rem; font-weight:800; text-transform:uppercase; }.loading-row,.empty-state { padding:2rem 1rem; color:var(--muted); text-align:center; }.loading-row svg { margin-right:.4rem; }
.job-hero { padding:1rem 0 1.2rem; border-bottom:3px solid var(--primary); }.job-hero.compact { padding-top:.35rem; }.date-kicker { color:var(--primary); font-size:.72rem; font-weight:800; text-transform:uppercase; }.job-hero h2 { margin:.35rem 0 .2rem; font-size:1.65rem; }.job-hero p { color:var(--muted); }.detail-list { margin-top:.5rem; }.detail-row { display:grid; grid-template-columns:100px minmax(0,1fr); gap:1rem; padding:.85rem 0; border-bottom:1px solid var(--border); font-size:.82rem; }.detail-row span { color:var(--muted); }.fixture-note,.data-flow-note { margin-top:1rem; padding:.7rem; background:color-mix(in srgb,var(--primary) 9%,var(--panel)); color:var(--muted); font-size:.72rem; }.sticky-action { margin-top:1rem; }.sticky-action>.primary-button { width:100%; }.status-panel { display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:52px; border:1px solid var(--dev-green); color:var(--dev-green); text-transform:uppercase; }.status-waitlist { border-color:#c27a16; color:#c27a16; }.scenario-actions { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:1rem; }.scenario-actions span { width:100%; color:var(--muted); font-size:.68rem; text-transform:uppercase; }.scenario-actions.full button { flex:1; }
.timer-surface { display:grid; min-height:210px; margin:1rem 0; place-items:center; align-content:center; gap:.6rem; background:var(--panel); border:1px solid var(--border); }.timer-status { color:var(--dev-green); font-size:.75rem; font-weight:700; }.timer { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:clamp(2rem,12vw,3.4rem); letter-spacing:0; }.timer-caption { color:var(--muted); font-size:.72rem; }.time-actions { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; }.time-actions>:only-child { grid-column:1/-1; }.summary-panel { margin-top:1rem; }.summary-panel>div { display:flex; justify-content:space-between; padding:.6rem 0; border-bottom:1px solid var(--border); }.summary-panel span { color:var(--muted); }.summary-total { font-size:1.05rem; }.workflow-panel { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; align-items:center; gap:.25rem; margin-top:1rem; font-size:.65rem; text-align:center; }.workflow-panel span { padding:.4rem .2rem; color:var(--muted); }.workflow-panel span.active { color:var(--primary); font-weight:800; }.workflow-panel svg { color:var(--border); }.text-button { margin-top:1rem; border:0; background:none; color:var(--primary); text-decoration:underline; cursor:pointer; }
.correction-form,.availability-editor { display:grid; gap:.8rem; margin-top:1rem; padding:1rem; border:1px solid var(--border); background:var(--panel); }.correction-form label,.availability-editor label { display:grid; gap:.35rem; color:var(--muted); font-size:.75rem; }.correction-form input,.correction-form textarea,.availability-editor input { width:100%; box-sizing:border-box; padding:.65rem; border:1px solid var(--border); border-radius:4px; background:var(--surface); color:var(--text); }.correction-history { display:grid; gap:.3rem; margin-top:1rem; padding:.8rem; border-left:3px solid #c27a16; background:var(--panel); font-size:.75rem; }.correction-history span,.correction-history p { color:var(--muted); }
.availability-list { border-top:1px solid var(--border); }.availability-list>button { display:grid; width:100%; grid-template-columns:74px minmax(0,1fr) auto; align-items:center; gap:.6rem; min-height:62px; padding:.6rem 0; border:0; border-bottom:1px solid var(--border); background:transparent; color:var(--text); text-align:left; cursor:pointer; }.availability-list>button.selected { color:var(--primary); }.availability-date { display:grid; }.availability-date small { color:var(--muted); }.availability-value { display:flex; align-items:center; gap:.4rem; font-size:.8rem; }.availability-value.available { color:var(--dev-green); }.availability-value.unavailable { color:var(--dev-red); }.availability-value.partial { color:#b56200; }.availability-list button>svg { color:var(--muted); font-size:.7rem; }.segmented-control { display:flex; gap:.35rem; overflow-x:auto; }.time-inputs { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; }
.sub-tabs { display:grid; grid-template-columns:1fr 1fr; gap:.4rem; margin-bottom:1rem; }.sub-tabs button { width:100%; }.document-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:.5rem; border-bottom:1px solid var(--border); }.document-row>button,.payroll-row { display:grid; width:100%; grid-template-columns:38px minmax(0,1fr) auto; align-items:center; gap:.7rem; min-height:66px; padding:.55rem 0; border:0; background:transparent; color:var(--text); text-align:left; cursor:pointer; }.document-row>button>span:nth-child(2),.payroll-row>span:nth-child(2) { display:grid; gap:.16rem; }.document-row small,.payroll-row small { color:var(--muted); font-size:.7rem; }.document-row button>svg,.payroll-row>svg { color:var(--muted); font-size:.7rem; }.document-status,.payroll-row>span:first-child { display:grid; width:36px; height:36px; place-items:center; border-radius:6px; background:var(--surface); }.document-status.approved,.document-status.in_review { color:var(--dev-green); }.document-status.missing,.document-status.expiring { color:#b56200; }.upload-button { padding:.4rem .55rem; border:1px solid var(--primary); border-radius:5px; color:var(--primary); font-size:.68rem; font-weight:700; cursor:pointer; }.upload-button input { position:absolute; width:1px; height:1px; opacity:0; }.document-preview { display:grid; min-height:380px; place-items:center; align-content:center; gap:.6rem; margin-bottom:1rem; padding:2rem; border:1px solid var(--border); background:var(--panel); text-align:center; }.document-preview>svg { color:#c6453a; font-size:3rem; }.payroll-preview>svg { color:var(--dev-green); }.document-preview h2,.document-preview p { margin:0; }.document-preview p,.document-preview span { color:var(--muted); font-size:.75rem; }.inline-message { margin-top:.7rem; color:var(--primary); font-size:.75rem; text-align:center; }
.profile-intro { display:flex; align-items:center; gap:.8rem; margin:.2rem 0 1rem; }.profile-intro h2 { margin:0 0 .15rem; font-size:1.35rem; }.profile-intro strong { font-size:.84rem; }.profile-avatar { display:grid; flex:0 0 auto; place-items:center; overflow:hidden; border-radius:50%; background:var(--primary); color:white; font-weight:800; object-fit:cover; }.profile-avatar--large { width:52px; height:52px; }.profile-avatar--nav { width:24px; height:24px; font-size:.65rem; }.settings-list { margin-top:1rem; }.settings-list button>svg:first-child { width:34px; color:var(--primary); }.settings-list .exit-row { color:var(--dev-red); }
@media (min-width:760px) { .desktop-nav { display:flex; flex:1; align-items:center; justify-content:center; gap:.25rem; min-width:0; }.desktop-nav button { position:relative; display:inline-flex; align-items:center; gap:.4rem; min-height:36px; padding:.45rem .7rem; border:0; border-bottom:2px solid transparent; background:transparent; color:var(--muted); font-size:.78rem; cursor:pointer; }.desktop-nav button:hover,.desktop-nav button.active { border-bottom-color:var(--primary); color:var(--primary); }.desktop-nav i { display:grid; min-width:16px; height:16px; padding:0 3px; place-items:center; border-radius:8px; background:var(--primary); color:white; font-size:.55rem; font-style:normal; }.bottom-nav { display:none; }.dev-portal { padding-bottom:0; }.dev-main { padding-top:1.4rem; }.job-card { padding:1rem 1.1rem; } }
@media (max-width:390px) { .dev-main { padding:.85rem; }.bottom-nav button { font-size:.56rem; }.job-card { grid-template-columns:42px minmax(0,1fr) auto; padding:.75rem; }.job-card-footer { flex-direction:column; }.document-row { grid-template-columns:minmax(0,1fr); }.upload-button { justify-self:start; margin:0 0 .6rem 46px; }.detail-row { grid-template-columns:82px minmax(0,1fr); } }
</style>