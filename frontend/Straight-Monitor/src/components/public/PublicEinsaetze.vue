<template>
  <div class="public-page">
    <!-- Loading -->
    <LoadingSpinner v-if="loading" label="Daten werden geladen..." class="full-page-loader" />

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">!</div>
      <h2>Fehler</h2>
      <p>{{ error }}</p>
    </div>

    <!-- No Access -->
    <div v-else-if="!email || !activeToken" class="error-state">
      <h2>Kein Zugriff</h2>
      <p>Fehlende Zugangsdaten. Bitte öffne diese Seite über die Flip App.</p>
    </div>

    <!-- Loaded -->
    <div v-else-if="mitarbeiter" class="content">
      <PublicHeader
        :vorname="mitarbeiter.vorname"
        :is-teamleiter="isTeamleiter"
        :current-view="currentView"
        :email="email"
        :debug-tl-active="debugTLMode"
        @navigate="navigateTo"
        @back="handleBack"
        @toggle-debug-tl="toggleDebugTL"
      />

      <div class="page-body">
        <!-- Dashboard -->
        <PublicDashboard
          v-if="currentView === 'dashboard'"
          :vorname="mitarbeiter.vorname"
          :is-teamleiter="isTeamleiter"
          :einsaetze="einsaetze"
          :open-laufzettel-count="openLaufzettelCount"
          :email="email"
          :debug-tl-active="debugTLMode"
          @navigate="navigateTo"
          @open-job="openJob"
          @toggle-debug-tl="toggleDebugTL"
        />

        <!-- Kalender -->
        <PublicKalender
          v-else-if="currentView === 'kalender'"
          :einsaetze="einsaetze"
          :is-teamleiter="isTeamleiter"
          @back="goBack"
          @open-job="openJob"
        />

        <!-- Laufzettel -->
        <PublicLaufzettel
          ref="laufzettelRef"
          v-else-if="currentView === 'laufzettel'"
          :submitted="laufzettelSubmitted"
          :einsaetze="einsaetze"
          :api="api"
          :email="email"
          @back="goBack"
          @laufzettel-submitted="loadData"
        />

        <!-- Evaluierungen (Teamleiter) -->
        <PublicEvaluierungen
          v-else-if="currentView === 'evaluierungen'"
          :received="laufzettelReceived"
          @back="goBack"
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
          @back="goBack"
          @open-job="openJob"
        />

        <!-- Job Detail -->
        <PublicJobDetail
          v-else-if="currentView === 'job-detail' && selectedJob"
          :einsatz="selectedJob"
          :is-teamleiter="isTeamleiter"
          :is-past="previousView === 'vergangene-jobs'"
          :api="api"
          :email="email"
          :mitarbeiter="mitarbeiter"
          @back="goBackFromJob"
          @write-report="writeReportForJob"
        />

        <!-- Event Report (Teamleiter) -->
        <PublicEventReport
          ref="eventReportRef"
          v-else-if="currentView === 'eventreport'"
          :einsaetze="recentEinsaetze"
          :mitarbeiter="mitarbeiter"
          :api="api"
          :email="email"
          :prefill-einsatz="reportPrefillEinsatz"
          @back="goBackFromReport"
        />
      </div>

      <PublicFooter />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import apiPublic from '@/utils/api-public';

import PublicHeader from './PublicHeader.vue';
import LoadingSpinner from '@/components/ui-elements/LoadingSpinner.vue';
import PublicFooter from './PublicFooter.vue';
import PublicDashboard from './PublicDashboard.vue';
import PublicKalender from './PublicKalender.vue';
import PublicLaufzettel from './PublicLaufzettel.vue';
import PublicEvaluierungen from './PublicEvaluierungen.vue';
import PublicEvaluierung from './PublicEvaluierung.vue';
import PublicVergangeneJobs from './PublicVergangeneJobs.vue';
import PublicJobDetail from './PublicJobDetail.vue';
import PublicEventReport from './PublicEventReport.vue';

const route = useRoute();

// ── Auth state ────────────────────────────────────────────────────────────
// Auth can come from two sources (OIDC takes priority over legacy URL params):
//   1. OIDC: POST /api/public/oidc/callback → session JWT stored in sessionStorage
//   2. Legacy: ?email=...&token=... from WPForms redirect (backwards compat)
const oidcEmail = ref('');
const sessionToken = ref('');  // Our session JWT (OIDC flow)

const legacyEmail = computed(() => route.query.email);
const legacyToken = computed(() => route.query.token);

// Unified values used everywhere in this component
const email = computed(() => oidcEmail.value || legacyEmail.value || '');
const activeToken = computed(() => sessionToken.value || legacyToken.value || '');

const api = apiPublic;
api.interceptors.request.use((config) => {
  const t = activeToken.value;
  if (t) config.headers['x-public-token'] = t;
  return config;
});

// ── PKCE helpers (Web Crypto API — no extra packages) ─────────────────────
async function generatePKCE() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge };
}

function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Session storage ───────────────────────────────────────────────────────
const SESSION_KEY = 'oidc_session';

function saveSession(token, emailValue) {
  try {
    // Decode exp from JWT payload without external library
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, email: emailValue, exp: payload.exp }));
  } catch { /* ignore */ }
}

function loadStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const sess = JSON.parse(raw);
    if (!sess.token || !sess.email) return null;
    if (sess.exp && sess.exp < Date.now() / 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return sess;
  } catch { return null; }
}

// ── OIDC redirect — sends user to Keycloak (prompt=none for silent SSO) ──
async function redirectToOIDC(promptValue = 'none') {
  let authEndpoint, clientId;
  try {
    const res = await api.get('/api/oidc/config');
    authEndpoint = res.data.authorization_endpoint;
    clientId = res.data.client_id;
    if (!clientId) {
      error.value = 'OIDC ist noch nicht konfiguriert. Bitte wende dich an den Administrator.';
      loading.value = false;
      return;
    }
  } catch {
    error.value = 'Login-Konfiguration konnte nicht geladen werden.';
    loading.value = false;
    return;
  }

  const { verifier, challenge } = await generatePKCE();
  const state = generateState();
  const redirectUri = window.location.origin + window.location.pathname;

  sessionStorage.setItem('oidc_pkce_verifier', verifier);
  sessionStorage.setItem('oidc_state', state);
  sessionStorage.setItem('oidc_redirect_uri', redirectUri);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: promptValue,
  });

  window.location.href = `${authEndpoint}?${params}`;
}

// ── OIDC code exchange — called when ?code= is in the URL ─────────────────
async function handleOIDCCallback(code, returnedState) {
  const expectedState = sessionStorage.getItem('oidc_state');
  const verifier = sessionStorage.getItem('oidc_pkce_verifier');
  const redirectUri = sessionStorage.getItem('oidc_redirect_uri');

  sessionStorage.removeItem('oidc_state');
  sessionStorage.removeItem('oidc_pkce_verifier');
  sessionStorage.removeItem('oidc_redirect_uri');

  // Remove ?code= and ?state= from the URL without reloading the page
  window.history.replaceState({}, '', window.location.pathname);

  if (returnedState !== expectedState) {
    error.value = 'Sicherheitsvalidierung fehlgeschlagen. Bitte die Seite neu laden.';
    loading.value = false;
    return;
  }
  if (!verifier || !redirectUri) {
    error.value = 'Sitzungsdaten fehlen. Bitte die Seite neu laden.';
    loading.value = false;
    return;
  }

  try {
    const res = await api.post('/api/oidc/callback', { code, code_verifier: verifier, redirect_uri: redirectUri });
    oidcEmail.value = res.data.email;
    sessionToken.value = res.data.session_token;
    saveSession(res.data.session_token, res.data.email);
  } catch (err) {
    const detail = err.response?.data?.msg || 'Login fehlgeschlagen.';
    error.value = detail;
    loading.value = false;
  }
}

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
const eventReportRef = ref(null);
const laufzettelRef = ref(null);

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
    const allowedViews = ['dashboard', 'laufzettel', 'vergangene-jobs', 'evaluierungen'];
    if (isTeamleiter.value) allowedViews.push('kalender');
    if (state.currentView && allowedViews.includes(state.currentView)) {
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
const openLaufzettelCount = computed(() =>
  laufzettelReceived.value.filter(lz => lz.status !== 'ABGESCHLOSSEN').length
);

// Teamleiter detection
const DEBUG_EMAIL = 'cedricbglx@gmail.com';
const debugTLMode = ref(false);

const isTeamleiter = computed(() => {
  const ma = mitarbeiter.value;
  if (!ma) return false;
  // For the debug user, the toggle exclusively controls TL mode (ignores real isTeamleiter)
  if (email.value === DEBUG_EMAIL) return debugTLMode.value;
  return ma.isTeamleiter === true;
});

function toggleDebugTL() {
  debugTLMode.value = !debugTLMode.value;
}

function goBack() {
  const target = previousView.value || 'dashboard';
  previousView.value = 'dashboard';
  currentView.value = target;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleBack() {
  switch (currentView.value) {
    case 'evaluierung':
      navigateTo('evaluierungen');
      break;
    case 'job-detail':
      goBackFromJob();
      break;
    case 'eventreport':
      if (!eventReportRef.value?.tryGoBack()) goBackFromReport();
      break;
    case 'laufzettel':
      if (!laufzettelRef.value?.tryGoBack()) goBack();
      break;
    default:
      goBack();
  }
}

function navigateTo(view) {
  // Guard: calendar is Teamleiter-only
  if (view === 'kalender' && !isTeamleiter.value) return;
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
  if (!email.value || !activeToken.value) {
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
  const queryCode = route.query.code;
  const queryState = route.query.state;
  const queryError = route.query.error;

  // 1. OIDC authorization code callback (?code= in URL)
  if (queryCode) {
    await handleOIDCCallback(queryCode, queryState);
    if (!error.value) {
      await loadData();
      restoreNavState();
    }
    return;
  }

  // 2. OIDC error returned by Keycloak (e.g. prompt=none but no session)
  if (queryError) {
    window.history.replaceState({}, '', window.location.pathname);
    if (queryError === 'login_required' || queryError === 'interaction_required') {
      // Retry with full login UI (user is not logged into Flip)
      await redirectToOIDC('login');
    } else {
      error.value = `Login-Fehler: ${queryError}`;
      loading.value = false;
    }
    return;
  }

  // 3. Existing valid OIDC session in sessionStorage
  const sess = loadStoredSession();
  if (sess) {
    oidcEmail.value = sess.email;
    sessionToken.value = sess.token;
    await loadData();
    restoreNavState();
    return;
  }

  // 4. Legacy WPForms flow: ?email= + ?token= already in URL
  if (legacyEmail.value && legacyToken.value) {
    await loadData();
    restoreNavState();
    return;
  }

  // 5. No auth info — initiate OIDC silent login
  await redirectToOIDC('none');
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

.full-page-loader {
  min-height: 60vh;
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
  padding-bottom: 2rem;
}

.time-hint {
  font-size: 0.78rem;
  color: var(--muted);
  text-align: center;
  padding: 0.5rem 1rem 1rem;
  line-height: 1.5;

  span {
    color: var(--primary);
    margin-right: 4px;
  }
}
</style>
