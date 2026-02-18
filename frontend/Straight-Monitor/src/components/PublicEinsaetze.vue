<template>
  <div class="public-page">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Daten werden geladen...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">!</div>
      <h2>Fehler</h2>
      <p>{{ error }}</p>
    </div>

    <!-- No Access -->
    <div v-else-if="!email || !publicToken" class="error-state">
      <h2>Kein Zugriff</h2>
      <p>Fehlende Zugangsdaten. Bitte öffne diese Seite über die Flip App.</p>
    </div>

    <!-- Loaded -->
    <div v-else-if="mitarbeiter" class="content">
      <PublicHeader
        :vorname="mitarbeiter.vorname"
        :is-teamleiter="isTeamleiter"
        :current-view="currentView"
        @navigate="navigateTo"
      />

      <div class="page-body">
        <!-- Dashboard -->
        <PublicDashboard
          v-if="currentView === 'dashboard'"
          :vorname="mitarbeiter.vorname"
          :is-teamleiter="isTeamleiter"
          :einsaetze="einsaetze"
          @navigate="navigateTo"
          @open-job="openJob"
        />

        <!-- Kalender -->
        <PublicKalender
          v-else-if="currentView === 'kalender'"
          :einsaetze="einsaetze"
          @back="navigateTo('dashboard')"
          @open-job="openJob"
        />

        <!-- Laufzettel -->
        <PublicLaufzettel
          v-else-if="currentView === 'laufzettel'"
          :submitted="laufzettelSubmitted"
          :einsaetze="einsaetze"
          :api="api"
          :email="email"
          @back="navigateTo('dashboard')"
          @laufzettel-submitted="loadData"
        />

        <!-- Evaluierungen (Teamleiter) -->
        <PublicEvaluierungen
          v-else-if="currentView === 'evaluierungen'"
          :received="laufzettelReceived"
          :submitted="evaluierungenSubmitted"
          @back="navigateTo('dashboard')"
          @write-evaluierung="openEvaluierungForm"
        />

        <!-- Evaluierung schreiben -->
        <PublicEvaluierung
          v-else-if="currentView === 'evaluierung' && selectedLaufzettel"
          :laufzettel="selectedLaufzettel"
          :api="api"
          :email="email"
          @back="navigateTo('evaluierungen')"
          @evaluierung-submitted="loadData"
        />

        <!-- Vergangene Jobs -->
        <PublicVergangeneJobs
          v-else-if="currentView === 'vergangene-jobs'"
          :einsaetze="einsaetze"
          @back="navigateTo('dashboard')"
          @open-job="openJob"
        />

        <!-- Job Detail -->
        <PublicJobDetail
          v-else-if="currentView === 'job-detail' && selectedJob"
          :einsatz="selectedJob"
          :is-teamleiter="isTeamleiter"
          :is-past="previousView === 'vergangene-jobs'"
          :api="api"
          @back="goBackFromJob"
          @write-report="writeReportForJob"
        />

        <!-- Event Report (Teamleiter) -->
        <PublicEventReport
          v-else-if="currentView === 'eventreport'"
          :einsaetze="recentEinsaetze"
          :mitarbeiter="mitarbeiter"
          :api="api"
          :email="email"
          :prefill-einsatz="reportPrefillEinsatz"
          @back="goBackFromReport"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import apiPublic from '@/utils/api-public';

import PublicHeader from './PublicHeader.vue';
import PublicDashboard from './public/PublicDashboard.vue';
import PublicKalender from './public/PublicKalender.vue';
import PublicLaufzettel from './public/PublicLaufzettel.vue';
import PublicEvaluierungen from './public/PublicEvaluierungen.vue';
import PublicEvaluierung from './public/PublicEvaluierung.vue';
import PublicVergangeneJobs from './public/PublicVergangeneJobs.vue';
import PublicJobDetail from './public/PublicJobDetail.vue';
import PublicEventReport from './public/PublicEventReport.vue';

const route = useRoute();
const email = computed(() => route.query.email);
const publicToken = computed(() => route.query.token);

const api = apiPublic;
api.interceptors.request.use((config) => {
  if (publicToken.value) {
    config.headers['x-public-token'] = publicToken.value;
  }
  return config;
});

// State
const loading = ref(true);
const error = ref('');
const mitarbeiter = ref(null);
const einsaetze = ref([]);

const recentEinsaetze = computed(() => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return einsaetze.value.filter(e => e.datumVon && new Date(e.datumVon) >= cutoff);
});

// Navigation
const currentView = ref('dashboard');
const previousView = ref('dashboard');
const selectedJob = ref(null);
const reportPrefillEinsatz = ref(null);
const selectedLaufzettel = ref(null);

// Persist nav state to localStorage
function navStateKey() {
  const nr = mitarbeiter.value?.personalnr || email.value || 'public';
  return `nav_state_${nr}`;
}
function saveNavState() {
  try {
    localStorage.setItem(navStateKey(), JSON.stringify({
      currentView: currentView.value,
      previousView: previousView.value,
      selectedJobId: selectedJob.value?._id || null
    }));
  } catch {}
}
function restoreNavState() {
  try {
    const raw = localStorage.getItem(navStateKey());
    if (!raw) return;
    const state = JSON.parse(raw);
    // Only restore non-sensitive views (not job-detail/eventreport without data)
    if (state.currentView && ['dashboard', 'kalender', 'laufzettel', 'vergangene-jobs', 'evaluierungen'].includes(state.currentView)) {
      currentView.value = state.currentView;
      previousView.value = state.previousView || 'dashboard';
    } else if (state.currentView === 'job-detail' && state.selectedJobId) {
      const job = einsaetze.value.find(e => e._id === state.selectedJobId);
      if (job) {
        selectedJob.value = job;
        currentView.value = 'job-detail';
        previousView.value = state.previousView || 'dashboard';
      }
    } else if (state.currentView === 'eventreport') {
      currentView.value = 'eventreport';
      previousView.value = state.previousView || 'dashboard';
    }
  } catch {}
}
watch([currentView, selectedJob], saveNavState, { deep: true });

// Laufzettel data (from Mitarbeiter refs)
const laufzettelReceived = computed(() => mitarbeiter.value?.laufzettel_received || []);
const laufzettelSubmitted = computed(() => mitarbeiter.value?.laufzettel_submitted || []);
const evaluierungenSubmitted = computed(() => mitarbeiter.value?.evaluierungen_submitted || []);

// Teamleiter detection
const isTeamleiter = computed(() => {
  const ma = mitarbeiter.value;
  if (!ma) return false;
  // TODO: Determine teamleiter status from backend field
  return (ma.eventreports && ma.eventreports.length > 0) || ma.isTeamleiter === true;
});

function navigateTo(view) {
  previousView.value = currentView.value;
  currentView.value = view;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openJob(einsatz) {
  previousView.value = currentView.value;
  selectedJob.value = einsatz;
  currentView.value = 'job-detail';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackFromJob() {
  currentView.value = previousView.value || 'dashboard';
  selectedJob.value = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openEvaluierungForm(lz) {
  selectedLaufzettel.value = lz;
  navigateTo('evaluierung');
}

function writeReportForJob(einsatz) {
  reportPrefillEinsatz.value = einsatz;
  previousView.value = 'job-detail';
  currentView.value = 'eventreport';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackFromReport() {
  if (previousView.value === 'job-detail' && selectedJob.value) {
    currentView.value = 'job-detail';
  } else {
    currentView.value = 'dashboard';
  }
  reportPrefillEinsatz.value = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadData() {
  if (!email.value || !publicToken.value) {
    loading.value = false;
    return;
  }

  try {
    const maRes = await api.get('/api/public/mitarbeiter', {
      params: { email: email.value }
    });
    mitarbeiter.value = maRes.data;

    if (mitarbeiter.value.personalnr) {
      const eRes = await api.get('/api/public/einsaetze', {
        params: { personalNr: mitarbeiter.value.personalnr }
      });
      einsaetze.value = eRes.data;
    }
  } catch (err) {
    console.error('Load error:', err);
    if (err.response?.status === 404) {
      error.value = 'Mitarbeiter mit dieser E-Mail nicht gefunden.';
    } else {
      error.value = 'Daten konnten nicht geladen werden.';
    }
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadData();
  restoreNavState();
});
</script>

<style scoped>
.public-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: var(--muted);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  text-align: center;
  color: var(--muted);
  padding: 1rem;
}

.error-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  font-size: 1.8rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.content {
  max-width: 600px;
  margin: 0 auto;
}

.page-body {
  padding: 1rem;
  padding-bottom: calc(2rem + env(safe-area-inset-bottom));
}
</style>
