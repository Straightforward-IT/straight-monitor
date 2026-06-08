<template>
  <div class="capacity-page">
    <LoadingSpinner v-if="authLoading" label="Login wird geprüft..." class="full-page-loader" />

    <div v-else-if="pageError" class="error-state">
      <div class="error-icon">!</div>
      <h2>Fehler</h2>
      <p>{{ pageError }}</p>
      <button class="retry-btn" @click="retryLoad">
        <font-awesome-icon icon="fa-solid fa-rotate-right" />
        Erneut laden
      </button>
    </div>

    <div v-else class="content">
      <header class="capacity-header">
        <div class="brand">
          <img :src="logoSrc" class="logo" alt="Straightforward" />
          <div>
            <h1>Capacity Counter</h1>
            <p v-if="email">{{ email }}</p>
          </div>
        </div>
        <button class="icon-btn" :disabled="loadingEvents || loadingState" aria-label="Aktualisieren" @click="retryLoad">
          <font-awesome-icon icon="fa-solid fa-rotate-right" :spin="loadingEvents || loadingState" />
        </button>
      </header>

      <main class="page-body">
        <LoadingSpinner v-if="loadingEvents" label="Events werden geladen..." class="inline-loader" />

        <section v-else-if="events.length === 0" class="empty-state">
          <div class="empty-icon"><font-awesome-icon icon="fa-solid fa-calendar" /></div>
          <h2>Keine Events</h2>
          <p>Für dich sind heute und demnächst keine Einsätze verfügbar.</p>
        </section>

        <template v-else>
          <section class="event-picker-section">
            <label for="capacity-event">Event</label>
            <div class="select-wrap">
              <select id="capacity-event" :value="selectedAuftragNr || ''" @change="handleEventChange">
                <option v-for="event in events" :key="event.auftragNr" :value="event.auftragNr">
                  {{ formatEventOption(event) }}
                </option>
              </select>
              <font-awesome-icon icon="fa-solid fa-chevron-down" />
            </div>
          </section>

          <LoadingSpinner v-if="loadingState" label="Auftrag wird geladen..." class="inline-loader" />

          <template v-else-if="state">
            <section class="auftrag-section">
              <div class="section-heading">
                <h2>{{ auftrag.eventTitel || `Auftrag #${auftrag.auftragNr}` }}</h2>
                <span class="auftrag-number">#{{ auftrag.auftragNr }}</span>
              </div>

              <div class="detail-list">
                <div class="detail-row">
                  <span class="detail-icon"><font-awesome-icon icon="fa-solid fa-calendar" /></span>
                  <div>
                    <span class="detail-label">Datum</span>
                    <strong>{{ formatDateRange(auftrag.vonDatum, auftrag.bisDatum) }}</strong>
                  </div>
                </div>
                <div v-if="eventLocationText" class="detail-row">
                  <span class="detail-icon"><font-awesome-icon icon="fa-solid fa-location-dot" /></span>
                  <div>
                    <span class="detail-label">Location</span>
                    <strong>{{ eventLocationText }}</strong>
                    <small v-if="eventAddressText">{{ eventAddressText }}</small>
                  </div>
                </div>
                <div v-if="auftrag.labels?.length" class="labels-row">
                  <span
                    v-for="label in auftrag.labels"
                    :key="label._id || label.name"
                    class="label-pill"
                    :style="{ borderColor: label.color, color: label.color, background: `${label.color}18` }"
                  >
                    {{ label.name }}
                  </span>
                </div>
              </div>
            </section>

            <section class="counter-panel">
              <div class="counter-status">
                <span class="live-pill" :class="{ connected: streamConnected }">
                  <span class="live-dot"></span>
                  {{ streamConnected ? 'Live' : 'Verbinde...' }}
                </span>
                <span v-if="capacity.updatedAt" class="updated-at">{{ formatUpdatedAt(capacity.updatedAt) }}</span>
              </div>

              <div class="counter-grid">
                <div class="counter-box counter-box--total">
                  <span class="counter-label">Gesamt Gäste</span>
                  <strong>{{ capacity.totalGuests }}</strong>
                </div>
                <div class="counter-box counter-box--mine">
                  <span class="counter-label">Meine Gäste</span>
                  <strong>{{ capacity.myGuests }}</strong>
                </div>
              </div>

              <div class="counter-actions">
                <button class="round-btn round-btn--minus" :disabled="adjusting || capacity.myGuests <= 0" aria-label="Gast auschecken" @click="adjustGuests(-1)">
                  <font-awesome-icon icon="fa-solid fa-minus" />
                </button>
                <button class="round-btn round-btn--plus" :disabled="adjusting" aria-label="Gast einchecken" @click="adjustGuests(1)">
                  <font-awesome-icon icon="fa-solid fa-plus" />
                </button>
              </div>

              <p v-if="adjustError" class="adjust-error">{{ adjustError }}</p>
            </section>

            <section class="section">
              <div class="section-heading section-heading--compact">
                <h2>Team</h2>
                <span class="count-pill">{{ otherContributorsTotal }} Gäste</span>
              </div>

              <div v-if="otherContributors.length === 0" class="empty-inline">Noch keine Beiträge von anderen Mitarbeitern.</div>
              <div v-else class="contributors-table" role="table" aria-label="Beiträge anderer Mitarbeiter">
                <div class="contributors-row contributors-row--head" role="row">
                  <span role="columnheader">Mitarbeiter</span>
                  <span role="columnheader">Gäste</span>
                </div>
                <div v-for="contributor in otherContributors" :key="contributor.personalNr" class="contributors-row" role="row">
                  <div class="contributor-person" role="cell">
                    <div class="contributor-avatar">{{ initials(contributor) }}</div>
                    <div>
                      <strong>{{ formatContributorName(contributor) }}</strong>
                      <small v-if="contributor.updatedAt">{{ formatUpdatedAt(contributor.updatedAt) }}</small>
                    </div>
                  </div>
                  <strong class="contributor-count" role="cell">{{ contributor.guestCount }}</strong>
                </div>
              </div>
            </section>
          </template>
        </template>
      </main>

      <PublicFooter />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import LoadingSpinner from '@/components/ui-elements/LoadingSpinner.vue';
import PublicFooter from './PublicFooter.vue';
import { usePublicOidcAuth } from '@/composables/usePublicOidcAuth';
import { useTheme } from '@/stores/theme';
import darkLogo from '@/assets/SF_000.svg';
import lightLogo from '@/assets/SF_002.png';

const theme = useTheme();
const logoSrc = computed(() => (theme.isDark ? darkLogo : lightLogo));

const {
  api,
  email,
  token,
  loading: authLoading,
  error: authError,
  initializeAuth,
} = usePublicOidcAuth();

const events = ref([]);
const selectedAuftragNr = ref(null);
const state = ref(null);
const loadingEvents = ref(false);
const loadingState = ref(false);
const dataError = ref('');
const adjustError = ref('');
const adjusting = ref(false);
const streamConnected = ref(false);
const eventSource = ref(null);

const pageError = computed(() => authError.value || dataError.value);
const auftrag = computed(() => state.value?.auftrag || {});
const capacity = computed(() => state.value?.capacity || { totalGuests: 0, myGuests: 0, updatedAt: null, contributors: [] });
const currentUser = computed(() => state.value?.currentUser || null);
const otherContributors = computed(() =>
  (capacity.value.contributors || [])
    .filter((contributor) => !contributor.isCurrentUser && Number(contributor.guestCount) > 0)
    .sort((left, right) => Number(right.guestCount) - Number(left.guestCount))
);
const otherContributorsTotal = computed(() =>
  otherContributors.value.reduce((sum, contributor) => sum + Number(contributor.guestCount || 0), 0)
);
const eventLocationText = computed(() => auftrag.value.eventLocation || auftrag.value.eventOrt || '');
const eventAddressText = computed(() => {
  const parts = [auftrag.value.eventStrasse, [auftrag.value.eventPlz, auftrag.value.eventOrt].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
});

onMounted(async () => {
  const authenticated = await initializeAuth();
  if (authenticated) await loadEvents();
});

onUnmounted(() => {
  disconnectStream();
});

async function retryLoad() {
  if (!token.value) {
    const authenticated = await initializeAuth();
    if (!authenticated) return;
  }
  await loadEvents(selectedAuftragNr.value);
}

async function loadEvents(preferredAuftragNr = null) {
  loadingEvents.value = true;
  dataError.value = '';
  adjustError.value = '';
  try {
    const response = await api.get('/api/public/capacity/events', { params: { email: email.value } });
    events.value = response.data || [];

    if (!events.value.length) {
      selectedAuftragNr.value = null;
      state.value = null;
      disconnectStream();
      return;
    }

    const preferred = events.value.find((event) => Number(event.auftragNr) === Number(preferredAuftragNr));
    const today = events.value.find((event) => event.isToday);
    const nextEvent = preferred || today || events.value[0];
    await selectAuftrag(nextEvent.auftragNr);
  } catch (error) {
    dataError.value = error.response?.data?.msg || 'Events konnten nicht geladen werden.';
  } finally {
    loadingEvents.value = false;
  }
}

async function handleEventChange(event) {
  const nextAuftragNr = Number.parseInt(event.target.value, 10);
  if (!Number.isInteger(nextAuftragNr)) return;
  await selectAuftrag(nextAuftragNr);
}

async function selectAuftrag(auftragNr) {
  selectedAuftragNr.value = Number(auftragNr);
  await loadState(selectedAuftragNr.value);
  connectStream(selectedAuftragNr.value);
}

async function loadState(auftragNr) {
  if (!auftragNr) return;
  loadingState.value = true;
  dataError.value = '';
  adjustError.value = '';
  try {
    const response = await api.get('/api/public/capacity/state', { params: { auftragNr, email: email.value } });
    state.value = response.data;
  } catch (error) {
    state.value = null;
    dataError.value = error.response?.data?.msg || 'Auftrag konnte nicht geladen werden.';
  } finally {
    loadingState.value = false;
  }
}

async function adjustGuests(delta) {
  if (adjusting.value || !selectedAuftragNr.value) return;
  if (delta < 0 && capacity.value.myGuests <= 0) return;

  adjusting.value = true;
  adjustError.value = '';
  const previousCapacity = { ...capacity.value };
  state.value = {
    ...state.value,
    capacity: {
      ...capacity.value,
      myGuests: Math.max(0, capacity.value.myGuests + delta),
      totalGuests: Math.max(0, capacity.value.totalGuests + delta),
    },
  };

  try {
    const response = await api.post('/api/public/capacity/adjust', {
      auftragNr: selectedAuftragNr.value,
      delta,
      email: email.value,
    });
    state.value = { ...state.value, capacity: response.data.capacity };
  } catch (error) {
    state.value = { ...state.value, capacity: error.response?.data?.capacity || previousCapacity };
    adjustError.value = error.response?.data?.msg || 'Zähler konnte nicht aktualisiert werden.';
  } finally {
    adjusting.value = false;
  }
}

function connectStream(auftragNr) {
  disconnectStream();
  if (!auftragNr || !token.value) return;

  const base = import.meta.env.VITE_API_BASE_URL || '';
  const params = new URLSearchParams({
    auftragNr: String(auftragNr),
    token: token.value,
    email: email.value,
  });
  const url = `${base}/api/public/capacity/stream?${params}`;
  const source = new EventSource(url);

  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'connected') {
        streamConnected.value = true;
        return;
      }
      if (payload.type !== 'capacity:update' || Number(payload.auftragNr) !== Number(selectedAuftragNr.value)) return;

      const nextCapacity = {
        ...capacity.value,
        totalGuests: payload.totalGuests,
        contributors: payload.contributors || capacity.value.contributors || [],
        updatedAt: payload.updatedAt,
      };
      if (Number(payload.personalNr) === Number(currentUser.value?.personalNr)) {
        nextCapacity.myGuests = payload.myGuests;
      }
      state.value = { ...state.value, capacity: nextCapacity };
    } catch {
      // Ignore malformed SSE payloads.
    }
  };

  source.onerror = () => {
    streamConnected.value = false;
  };

  eventSource.value = source;
}

function disconnectStream() {
  streamConnected.value = false;
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
  }
}

function formatEventOption(event) {
  const date = formatShortDate(event.vonDatum || event.earliestDatumVon);
  const title = event.eventTitel || `Auftrag #${event.auftragNr}`;
  const location = event.eventLocation || event.eventOrt;
  return [event.isToday ? 'Heute' : date, title, location].filter(Boolean).join(' - ');
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
}

function formatDateRange(from, to) {
  const fromText = formatDate(from);
  const toText = formatDate(to);
  if (fromText && toText && fromText !== toText) return `${fromText} - ${toText}`;
  return fromText || toText || 'Kein Datum';
}

function formatUpdatedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Stand ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })}`;
}

function initials(ma) {
  return `${ma.vorname?.[0] || ''}${ma.nachname?.[0] || ''}`.toUpperCase() || '?';
}

function formatContributorName(contributor) {
  const name = [contributor.vorname, contributor.nachname].filter(Boolean).join(' ').trim();
  return name || `Personal #${contributor.personalNr}`;
}
</script>

<style scoped>
.capacity-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.full-page-loader {
  min-height: 60vh;
}

.content {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.capacity-header {
  position: sticky;
  top: 0;
  z-index: 50;
  min-height: 56px;
  padding: 8px 16px;
  background: var(--panel);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
}

.brand h1 {
  font-size: 1.05rem;
  line-height: 1.2;
  margin: 0;
  color: var(--text);
}

.brand p {
  margin: 0.1rem 0 0;
  color: var(--muted);
  font-size: 0.72rem;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.page-body {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 1rem 1rem 0;
  flex: 1;
}

.error-state,
.empty-state {
  min-height: 55vh;
  padding: 2rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--muted);
}

.error-icon,
.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  font-weight: 800;
  font-size: 1.4rem;
}

.empty-icon {
  background: rgba(255, 117, 24, 0.12);
  color: var(--primary);
}

.error-state h2,
.empty-state h2 {
  color: var(--text);
  margin: 0 0 0.4rem;
  font-size: 1.2rem;
}

.error-state p,
.empty-state p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  max-width: 320px;
}

.retry-btn {
  margin-top: 1rem;
  border: 1px solid var(--primary);
  color: var(--primary);
  background: transparent;
  border-radius: 10px;
  padding: 0.65rem 0.9rem;
  display: inline-flex;
  gap: 0.45rem;
  align-items: center;
  font-weight: 700;
  cursor: pointer;
}

.inline-loader {
  padding: 1.5rem 0;
}

.event-picker-section {
  margin-bottom: 1rem;
}

.event-picker-section label {
  display: block;
  margin: 0 0 0.4rem;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}

.select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.select-wrap select {
  width: 100%;
  min-height: 48px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--text);
  padding: 0.75rem 2.4rem 0.75rem 0.9rem;
  font-size: 0.95rem;
  font-weight: 600;
  appearance: none;
}

.select-wrap svg {
  position: absolute;
  right: 0.9rem;
  pointer-events: none;
  color: var(--muted);
  font-size: 0.8rem;
}

.counter-panel,
.auftrag-section,
.section {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 0.9rem;
}

.counter-panel {
  border-color: rgba(255, 117, 24, 0.35);
  background: linear-gradient(180deg, rgba(255, 117, 24, 0.08), var(--tile-bg) 58%);
}

.counter-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.live-pill,
.updated-at {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--muted);
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #9ca3af;
}

.live-pill.connected .live-dot {
  background: #16a34a;
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.12);
}

.counter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.counter-box {
  border-radius: 10px;
  padding: 0.9rem;
  border: 1px solid var(--border);
  background: var(--surface);
}

.counter-box--total {
  border-color: rgba(37, 99, 235, 0.24);
}

.counter-box--mine {
  border-color: rgba(22, 163, 74, 0.24);
}

.counter-label {
  display: block;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  margin-bottom: 0.3rem;
}

.counter-box strong {
  color: var(--text);
  font-size: 2.25rem;
  line-height: 1;
}

.counter-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.round-btn {
  height: 58px;
  border-radius: 14px;
  border: none;
  color: white;
  font-size: 1.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.round-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.round-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.round-btn--minus {
  background: #ef4444;
}

.round-btn--plus {
  background: var(--primary);
}

.adjust-error {
  margin: 0.75rem 0 0;
  color: #dc2626;
  font-size: 0.82rem;
  text-align: center;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.section-heading--compact {
  align-items: center;
}

.section-heading h2 {
  color: var(--text);
  font-size: 1rem;
  line-height: 1.25;
  margin: 0;
}

.auftrag-number,
.count-pill {
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.55rem;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.detail-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  background: rgba(255, 117, 24, 0.12);
  flex-shrink: 0;
}

.detail-label {
  display: block;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  margin-bottom: 0.1rem;
}

.detail-row strong {
  display: block;
  color: var(--text);
  font-size: 0.9rem;
  line-height: 1.35;
}

.detail-row small {
  display: block;
  color: var(--muted);
  font-size: 0.78rem;
  margin-top: 0.1rem;
}

.labels-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.label-pill {
  border: 1px solid;
  border-radius: 999px;
  padding: 0.22rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.contributors-table {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
}

.contributors-row {
  min-height: 54px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-top: 1px solid var(--border);
}

.contributors-row:first-child {
  border-top: none;
}

.contributors-row--head {
  min-height: 36px;
  background: var(--tile-bg);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.contributor-person {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.contributor-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  flex-shrink: 0;
}

.contributor-person strong {
  display: block;
  color: var(--text);
  font-size: 0.88rem;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contributor-person small {
  display: block;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.25;
  margin-top: 0.1rem;
}

.contributor-count {
  min-width: 36px;
  text-align: right;
  color: var(--primary);
  font-size: 1rem;
}

.empty-inline {
  color: var(--muted);
  font-size: 0.85rem;
  text-align: center;
  padding: 0.85rem 0;
}

.empty-inline--small {
  padding: 0.35rem 0;
  text-align: left;
  font-size: 0.78rem;
}

@media (max-width: 430px) {
  .page-body {
    padding: 0.85rem 0.75rem 0;
  }

  .counter-grid,
  .counter-actions {
    gap: 0.55rem;
  }

  .counter-box {
    padding: 0.75rem;
  }

  .counter-box strong {
    font-size: 2rem;
  }

  .brand p {
    max-width: 170px;
  }
}
</style>
