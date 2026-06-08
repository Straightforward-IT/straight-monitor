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

            <section class="counter-panel" :class="{ 'counter-panel--over-limit': capacity.isOverLimit }">
              <div class="counter-status">
                <span class="live-pill" :class="{ connected: streamConnected }">
                  <span class="live-dot"></span>
                  {{ streamConnected ? 'Live' : 'Verbinde...' }}
                </span>
                <span v-if="capacity.updatedAt" class="updated-at">{{ formatUpdatedAt(capacity.updatedAt) }}</span>
              </div>

              <div class="counter-grid">
                <div class="counter-box counter-box--total" :class="{ 'counter-box--over': capacity.isOverLimit }">
                  <span class="counter-label">Gesamt</span>
                  <strong>{{ capacity.totalGuests }}</strong>
                </div>
                <div class="counter-box counter-box--mine">
                  <span class="counter-label">Meine Gäste</span>
                  <strong>{{ capacity.myGuests }}</strong>
                </div>
              </div>

              <div class="capacity-limit-card" :class="{ 'capacity-limit-card--over': capacity.isOverLimit, 'capacity-limit-card--unset': !hasCapacityLimit }">
                <div class="limit-summary">
                  <div>
                    <span class="limit-label">Kapazität</span>
                    <strong>{{ capacityLimitDisplay }}</strong>
                  </div>
                  <span class="limit-status">{{ capacityLimitStatus }}</span>
                </div>
                <div class="limit-meter" aria-hidden="true">
                  <span :style="{ width: `${capacityLimitPercent}%` }"></span>
                </div>

                <form v-if="canSetCapacityLimit" class="limit-editor" @submit.prevent="saveCapacityLimit">
                  <input
                    v-model="limitInput"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    placeholder="Grenze"
                    aria-label="Kapazitätsgrenze"
                    :disabled="savingLimit"
                  />
                  <button class="small-action-btn" type="submit" :disabled="savingLimit">Setzen</button>
                  <button v-if="hasCapacityLimit" class="small-action-btn small-action-btn--ghost" type="button" :disabled="savingLimit" @click="clearCapacityLimit">Entfernen</button>
                </form>
                <p v-if="limitError" class="limit-error">{{ limitError }}</p>
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

            <section class="section chat-section">
              <div class="section-heading section-heading--compact">
                <h2>Livechat</h2>
                <span class="count-pill">{{ chatMessages.length }}</span>
              </div>

              <div ref="chatListRef" class="chat-list">
                <div v-if="chatMessages.length === 0" class="empty-inline">Noch keine Nachrichten.</div>
                <article v-for="message in chatMessages" :key="message.id" class="chat-message" :class="{ 'chat-message--mine': message.isCurrentUser }">
                  <div class="chat-bubble">
                    <div class="chat-meta">
                      <strong>{{ formatContributorName(message) }}</strong>
                      <span>{{ formatChatTime(message.createdAt) }}</span>
                    </div>
                    <p>{{ message.body }}</p>
                  </div>
                </article>
              </div>

              <form class="chat-form" @submit.prevent="sendChatMessage">
                <input
                  v-model="chatDraft"
                  maxlength="500"
                  placeholder="Nachricht schreiben"
                  aria-label="Chatnachricht"
                  :disabled="sendingChat"
                />
                <button class="chat-send-btn" type="submit" :disabled="sendingChat || !chatDraft.trim()" aria-label="Nachricht senden">
                  <font-awesome-icon :icon="sendingChat ? 'fa-solid fa-spinner' : 'fa-solid fa-paper-plane'" :spin="sendingChat" />
                </button>
              </form>
              <p v-if="chatError" class="chat-error">{{ chatError }}</p>
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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
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
} = usePublicOidcAuth({
  sessionKey: 'capacity_oidc_session',
  configPath: '/api/oidc/capacity-config',
  callbackPath: '/api/oidc/capacity-callback',
  pkceKeyPrefix: 'capacity_oidc',
});

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
const limitInput = ref('');
const savingLimit = ref(false);
const limitError = ref('');
const chatDraft = ref('');
const sendingChat = ref(false);
const chatError = ref('');
const chatListRef = ref(null);

const pageError = computed(() => authError.value || dataError.value);
const auftrag = computed(() => state.value?.auftrag || {});
const capacity = computed(() => state.value?.capacity || { totalGuests: 0, myGuests: 0, updatedAt: null, contributors: [], limit: null, remainingCapacity: null, isOverLimit: false });
const currentUser = computed(() => state.value?.currentUser || null);
const canSetCapacityLimit = computed(() => !!currentUser.value?.canSetCapacityLimit);
const hasCapacityLimit = computed(() => Number.isInteger(capacity.value.limit));
const capacityLimitPercent = computed(() => {
  if (!hasCapacityLimit.value) return 0;
  if (capacity.value.limit <= 0) return capacity.value.totalGuests > 0 ? 100 : 0;
  return Math.min(100, Math.round((capacity.value.totalGuests / capacity.value.limit) * 100));
});
const capacityLimitDisplay = computed(() => hasCapacityLimit.value ? `${capacity.value.totalGuests} / ${capacity.value.limit}` : `${capacity.value.totalGuests} Gäste`);
const capacityLimitStatus = computed(() => {
  if (!hasCapacityLimit.value) return 'Keine Grenze';
  if (capacity.value.isOverLimit) return `${Math.abs(capacity.value.remainingCapacity || 0)} drüber`;
  if (capacity.value.remainingCapacity === 0) return 'Voll';
  return `${capacity.value.remainingCapacity} frei`;
});
const chatMessages = computed(() => state.value?.chatMessages || []);
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
  limitError.value = '';
  chatError.value = '';
  chatDraft.value = '';
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
    syncLimitInput();
    await scrollChatToBottom();
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

function syncLimitInput() {
  limitInput.value = hasCapacityLimit.value ? String(capacity.value.limit) : '';
}

async function saveCapacityLimit() {
  if (!selectedAuftragNr.value || savingLimit.value) return;
  const trimmed = String(limitInput.value || '').trim();
  const nextLimit = trimmed === '' ? null : Number.parseInt(trimmed, 10);
  if (trimmed !== '' && (!Number.isInteger(nextLimit) || nextLimit < 0)) {
    limitError.value = 'Bitte eine gueltige Zahl eingeben.';
    return;
  }

  await submitCapacityLimit(nextLimit);
}

async function clearCapacityLimit() {
  if (!selectedAuftragNr.value || savingLimit.value) return;
  limitInput.value = '';
  await submitCapacityLimit(null);
}

async function submitCapacityLimit(limit) {
  savingLimit.value = true;
  limitError.value = '';
  try {
    const response = await api.post('/api/public/capacity/limit', {
      auftragNr: selectedAuftragNr.value,
      limit,
      email: email.value,
    });
    state.value = { ...state.value, capacity: response.data.capacity };
    syncLimitInput();
  } catch (error) {
    limitError.value = error.response?.data?.msg || 'Grenze konnte nicht gespeichert werden.';
  } finally {
    savingLimit.value = false;
  }
}

async function sendChatMessage() {
  if (!selectedAuftragNr.value || sendingChat.value) return;
  const message = chatDraft.value.trim();
  if (!message) return;

  sendingChat.value = true;
  chatError.value = '';
  try {
    const response = await api.post('/api/public/capacity/chat', {
      auftragNr: selectedAuftragNr.value,
      message,
      email: email.value,
    });
    appendChatMessage(response.data.message);
    chatDraft.value = '';
  } catch (error) {
    chatError.value = error.response?.data?.msg || 'Nachricht konnte nicht gesendet werden.';
  } finally {
    sendingChat.value = false;
  }
}

function appendChatMessage(message) {
  if (!message?.id) return;
  const normalized = {
    ...message,
    isCurrentUser: Number(message.personalNr) === Number(currentUser.value?.personalNr),
  };
  const existing = chatMessages.value.some((entry) => entry.id === normalized.id);
  if (existing) return;
  state.value = {
    ...state.value,
    chatMessages: [...chatMessages.value, normalized].slice(-50),
  };
  scrollChatToBottom();
}

async function scrollChatToBottom() {
  await nextTick();
  if (!chatListRef.value) return;
  chatListRef.value.scrollTop = chatListRef.value.scrollHeight;
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
      if (Number(payload.auftragNr) !== Number(selectedAuftragNr.value)) return;

      if (payload.type === 'chat:message') {
        appendChatMessage(payload.message);
        return;
      }

      if (payload.type === 'capacity:limit') {
        state.value = { ...state.value, capacity: payload.capacity || capacity.value };
        syncLimitInput();
        return;
      }

      if (payload.type !== 'capacity:update') return;

      const nextCapacity = {
        ...capacity.value,
        totalGuests: payload.totalGuests,
        limit: payload.limit,
        remainingCapacity: payload.remainingCapacity,
        isOverLimit: payload.isOverLimit,
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

function formatChatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
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
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  overscroll-behavior-y: contain;
}

.capacity-page,
.capacity-page * {
  box-sizing: border-box;
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
  min-height: 52px;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 14px 8px;
  background: var(--panel);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}

.brand h1 {
  font-size: 1rem;
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
  width: 38px;
  height: 38px;
  border-radius: 8px;
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
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 0.85rem 0.85rem max(1rem, env(safe-area-inset-bottom, 0px));
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
  border-radius: 8px;
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
  border-radius: 8px;
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
  margin-bottom: 0.75rem;
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
  min-height: 46px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--text);
  padding: 0.75rem 2.4rem 0.75rem 0.9rem;
  font-size: 16px;
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
  border-radius: 8px;
  padding: 0.9rem;
  margin-bottom: 0.75rem;
}

.counter-panel {
  border-color: rgba(255, 117, 24, 0.35);
  background: linear-gradient(180deg, rgba(255, 117, 24, 0.08), var(--tile-bg) 48%);
}

.counter-panel--over-limit {
  border-color: rgba(239, 68, 68, 0.72);
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.14), var(--tile-bg) 62%);
}

.counter-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
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

.capacity-limit-card {
  border: 1px solid rgba(22, 163, 74, 0.25);
  border-radius: 8px;
  background: rgba(22, 163, 74, 0.08);
  padding: 0.68rem;
  margin-bottom: 0.75rem;
}

.capacity-limit-card--unset {
  border-color: var(--border);
  background: var(--surface);
}

.capacity-limit-card--over {
  border-color: rgba(239, 68, 68, 0.62);
  background: rgba(239, 68, 68, 0.12);
}

.limit-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.limit-label {
  display: block;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 0.15rem;
}

.limit-summary strong {
  display: block;
  color: var(--text);
  font-size: 1.06rem;
  line-height: 1.1;
}

.limit-status {
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.28rem 0.55rem;
}

.capacity-limit-card--unset .limit-status {
  background: rgba(156, 163, 175, 0.12);
  color: var(--muted);
}

.capacity-limit-card--over .limit-status {
  background: rgba(239, 68, 68, 0.14);
  color: #ef4444;
}

.limit-meter {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(156, 163, 175, 0.18);
  margin-top: 0.65rem;
}

.limit-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #16a34a;
  transition: width 180ms ease, background 180ms ease;
}

.capacity-limit-card--unset .limit-meter span {
  background: var(--primary);
}

.capacity-limit-card--over .limit-meter span {
  background: #ef4444;
}

.limit-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.limit-editor input,
.chat-form input {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  min-height: 42px;
  padding: 0.55rem 0.7rem;
  font-size: 16px;
  font-weight: 600;
}

.small-action-btn {
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  min-height: 42px;
  padding: 0 0.75rem;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

.small-action-btn--ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
}

.small-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.counter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}

.counter-box {
  border-radius: 8px;
  padding: 0.82rem;
  border: 1px solid var(--border);
  background: var(--surface);
}

.counter-box--total {
  border-color: rgba(37, 99, 235, 0.24);
}

.counter-box--mine {
  border-color: rgba(22, 163, 74, 0.24);
}

.counter-box--over {
  border-color: rgba(239, 68, 68, 0.46);
}

.counter-box.counter-box--over strong {
  color: #ef4444;
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
  font-size: 2.32rem;
  line-height: 1;
}

.counter-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.round-btn {
  height: 56px;
  border-radius: 10px;
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

.adjust-error,
.limit-error,
.chat-error {
  margin: 0.75rem 0 0;
  color: #dc2626;
  font-size: 0.82rem;
  text-align: center;
}

.limit-error,
.chat-error {
  text-align: left;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.detail-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
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
  grid-column: 1 / -1;
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
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
}

.contributors-row {
  min-height: 50px;
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

.chat-section {
  padding-bottom: 0.8rem;
}

.chat-list {
  max-height: 230px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.1rem 0.1rem 0.65rem;
}

.chat-message {
  display: flex;
  justify-content: flex-start;
}

.chat-message--mine {
  justify-content: flex-end;
}

.chat-bubble {
  max-width: min(86%, 560px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 0.62rem 0.7rem;
}

.chat-message--mine .chat-bubble {
  border-color: rgba(255, 117, 24, 0.35);
  background: rgba(255, 117, 24, 0.1);
}

.chat-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.22rem;
}

.chat-meta strong {
  min-width: 0;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-meta span {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 0.7rem;
}

.chat-bubble p {
  margin: 0;
  color: var(--text);
  font-size: 0.88rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.chat-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 0.55rem;
  margin-top: 0.65rem;
}

.chat-send-btn {
  width: 44px;
  min-height: 42px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  cursor: pointer;
}

.chat-send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
    padding: 0.75rem 0.7rem max(0.9rem, env(safe-area-inset-bottom, 0px));
  }

  .detail-list {
    grid-template-columns: 1fr;
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

  .limit-editor {
    grid-template-columns: 1fr 1fr;
  }

  .limit-editor input {
    grid-column: 1 / -1;
  }

  .chat-bubble {
    max-width: 92%;
  }

  .brand p {
    max-width: 170px;
  }
}
</style>
