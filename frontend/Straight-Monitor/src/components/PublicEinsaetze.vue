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
      <PublicHeader :vorname="mitarbeiter.vorname" />

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
          :received="laufzettelReceived"
          :submitted="laufzettelSubmitted"
          @back="navigateTo('dashboard')"
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
          :einsaetze="einsaetze"
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
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import apiPublic from '@/utils/api-public';

import PublicHeader from './PublicHeader.vue';
import PublicDashboard from './public/PublicDashboard.vue';
import PublicKalender from './public/PublicKalender.vue';
import PublicLaufzettel from './public/PublicLaufzettel.vue';
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

// Navigation
const currentView = ref('dashboard');
const previousView = ref('dashboard');
const selectedJob = ref(null);
const reportPrefillEinsatz = ref(null);

// Laufzettel data (from Mitarbeiter refs)
const laufzettelReceived = computed(() => mitarbeiter.value?.laufzettel_received || []);
const laufzettelSubmitted = computed(() => mitarbeiter.value?.laufzettel_submitted || []);

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

onMounted(() => loadData());
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
