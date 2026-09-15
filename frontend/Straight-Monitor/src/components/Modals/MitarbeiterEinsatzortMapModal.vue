<template>
  <ModalFrame
    size="full"
    title="Mitarbeiter- und Einsatzortkarte"
    subtitle="Standorte & Fahrzeiten"
    class="staff-map-modal"
    @close="$emit('close')"
  >
    <div class="staff-map">
      <Toolbar v-if="initialized" v-model:location-v2="locationId" :locations="locations" show-location-filter wrap>
        <template #filter>
          <div class="staff-map__modes" role="group" aria-label="Karteninhalt">
            <button v-for="mode in modes" :key="mode.value" type="button" :aria-pressed="entityType === mode.value" @click="setMode(mode.value)">{{ mode.label }}</button>
          </div>
        </template>
        <button type="button" class="staff-map__refresh" :disabled="loading" @click="loadData()">Aktualisieren</button>
      </Toolbar>

      <div v-if="error" class="staff-map__message staff-map__message--error" role="alert">
        <span>{{ error }}</span>
        <button type="button" :disabled="loading" @click="initialized ? loadData() : initialize()">Erneut versuchen</button>
      </div>
      <div v-if="payload && !payload.configuration.geocodingAvailable" class="staff-map__message" role="status">
        Die Adressauflösung ist noch nicht eingerichtet. Bereits hinterlegte Kartenpunkte werden angezeigt.
      </div>

      <div class="staff-map__layout" :aria-busy="loading">
        <section class="staff-map__map-panel" aria-label="Kartenansicht">
          <EmployeeLocationMap
            ref="mapView"
            :entries="payload?.entries || []"
            :origin="payload?.origin || null"
            :nearest="payload?.nearest?.results || []"
            :center="payload?.center || null"
            :selected-id="selectedId"
            :view-key="`${entityType}:${locationId}:${selectedSiteId}`"
            @select="focusEntry"
            @choose-site="chooseSite"
          />
          <div v-if="loading || pending" class="staff-map__progress" role="status">
            <span class="staff-map__spinner" aria-hidden="true" />
            {{ loading ? 'Kartendaten werden geladen …' : 'Koordinaten und Fahrzeiten werden ergänzt …' }}
          </div>
          <div v-else-if="payload && !payload.summary.mapped && !payload.origin?.coordinates" class="staff-map__empty" role="status">
            {{ payload.summary.total ? 'Für diese Auswahl liegen noch keine Kartenpunkte vor.' : 'Keine aktiven Einträge für diesen Standort.' }}
          </div>
          <div class="staff-map__legend" aria-label="Legende">
            <span><i class="legend-pin">1</i> Hauptadresse</span>
            <span><i class="legend-pin legend-pin--secondary">2</i> Zweitadresse</span>
            <span><i class="legend-pin legend-pin--site">E</i> Einsatzort</span>
            <span><i class="legend-pin legend-pin--nearest" /> Nächste Adressen</span>
            <span v-for="location in locations" :key="location._id"><i class="legend-location" :style="{ background: location.color || '#64748b' }" />{{ location.shortName }}</span>
          </div>
        </section>

        <aside class="staff-map__sidebar" aria-label="Adressen und Fahrzeiten">
          <section v-if="entityType === 'mitarbeiter'" class="staff-map__section">
            <h4>Fahrzeit ab Einsatzort</h4>
            <label for="staff-map-site-search">Einsatzort suchen</label>
            <input id="staff-map-site-search" v-model="siteSearch" type="search" placeholder="Name, Kunde oder Adresse" :disabled="!initialized" />
            <label class="sr-only" for="staff-map-site">Einsatzort auswählen</label>
            <select id="staff-map-site" v-model="selectedSiteId" :disabled="!initialized">
              <option value="">Ohne Fahrzeitvergleich</option>
              <option v-for="site in matchingSites" :key="site.einsatzortId" :value="site.einsatzortId">{{ site.name }}{{ site.customerLabel ? ` · ${site.customerLabel}` : '' }}</option>
            </select>
            <p v-if="!loading && !matchingSites.length" class="staff-map__muted">Keine passenden Einsatzorte im gewählten Standort.</p>
            <p v-if="siteMatchCount > 200" class="staff-map__muted">Bitte die Suche eingrenzen. Es werden 200 Treffer angezeigt.</p>
            <p class="staff-map__muted">PKW-Fahrzeit vom Einsatzort zur Wohnadresse, ohne Live-Verkehr.</p>
          </section>

          <section v-if="payload?.origin" class="staff-map__section staff-map__origin">
            <span class="staff-map__eyebrow">Ausgewählter Einsatzort</span>
            <button type="button" class="staff-map__text-button" @click="focusEntry(payload.origin.id)">{{ payload.origin.name }}</button>
            <p>{{ payload.origin.address }}</p>
            <p v-if="payload.nearest?.error" class="staff-map__muted" role="status">{{ payload.nearest.error.message }}</p>
          </section>

          <section v-if="selectedEntry && selectedEntry.entityType !== 'einsatzort'" class="staff-map__section staff-map__selection">
            <span class="staff-map__eyebrow">Ausgewählte Person</span>
            <h4>{{ selectedEntry.name }}</h4>
            <button v-for="entry in selectedAddresses" :key="entry.id" type="button" class="staff-map__address-link" @click="focusEntry(entry.id)">
              <strong>{{ addressKind(entry) }}</strong>
              <span>{{ entry.address }}</span>
              <small v-if="!entry.coordinates">{{ stateLabel(entry.state) }}</small>
            </button>
          </section>

          <section v-if="payload?.nearest" class="staff-map__section">
            <h4>{{ payload.nearest.state === 'pending' ? 'Bisher schnellste Verbindungen' : 'Schnellste berechenbare Verbindungen' }} <span class="staff-map__count">{{ rankedEntries.length }}</span></h4>
            <p class="staff-map__muted">Bis zu 20 Wohnadressen, nach Fahrzeit und anschließend Strecke sortiert.</p>
            <ol class="staff-map__ranked">
              <li v-for="(result, index) in rankedEntries" :key="result.entryId">
                <button type="button" class="staff-map__result" :class="{ 'is-selected': selectedId === result.entryId }" @click="focusEntry(result.entryId)">
                  <span class="staff-map__rank">{{ index + 1 }}</span>
                  <span class="staff-map__result-main"><strong>{{ result.entry.name }}</strong><small>{{ result.addressEntryIds.length > 1 ? 'Haupt- und Zweitadresse' : addressKind(result.entry) }}</small><small>{{ result.entry.address }}</small></span>
                  <span class="staff-map__travel"><strong>{{ duration(result.durationSeconds) }}</strong><small>{{ distance(result.distanceMeters) }}</small></span>
                </button>
              </li>
            </ol>
            <p v-if="!rankedEntries.length" class="staff-map__muted">{{ payload.nearest.state === 'pending' ? 'Fahrzeiten werden ermittelt.' : 'Keine berechenbare Fahrverbindung vorhanden.' }}</p>
            <p v-if="payload.nearest.excluded.length" class="staff-map__muted">{{ payload.nearest.excluded.length }} Adressen noch ohne Fahrzeit. Den Status findest du in der Adressliste.</p>
          </section>

          <section class="staff-map__section staff-map__entries">
            <div class="staff-map__section-heading">
              <h4>{{ entityType === 'mitarbeiter' ? 'Wohnadressen' : 'Einsatzorte' }}</h4>
              <span class="staff-map__count">{{ payload?.summary.total || 0 }}</span>
            </div>
            <label class="sr-only" for="staff-map-entry-search">Adressen durchsuchen</label>
            <input id="staff-map-entry-search" v-model="entrySearch" type="search" placeholder="Name oder Adresse suchen" />
            <p v-if="payload" class="staff-map__muted">{{ payload.summary.mapped }} Kartenpunkte · {{ payload.summary.unresolved }} nicht aufgelöst</p>
            <ul class="staff-map__entry-list">
              <li v-for="entry in visibleEntries" :key="entry.id">
                <button type="button" class="staff-map__entry" :class="{ 'is-selected': selectedId === entry.id }" @click="focusEntry(entry.id)">
                  <span class="staff-map__dot" :style="{ background: entry.location?.color || '#64748b' }" />
                  <span><strong>{{ entry.name }}</strong><small>{{ entry.customerLabel || addressKind(entry) }}</small><small>{{ entry.address }}</small><small v-if="!entry.coordinates || excludedById.has(entry.id)" class="staff-map__status">{{ stateLabel(excludedById.get(entry.id)?.state || entry.state) }}</small></span>
                </button>
                <button v-if="entityType === 'einsatzort'" type="button" class="staff-map__choose" @click="chooseSite(entry)">Mitarbeiter nach Fahrzeit</button>
              </li>
            </ul>
            <p v-if="!loading && !filteredEntries.length" class="staff-map__muted">Keine passenden Einträge.</p>
            <button v-if="filteredEntries.length > visibleCount" type="button" class="staff-map__more" @click="visibleCount += 100">Weitere Adressen anzeigen</button>
          </section>
        </aside>
      </div>
    </div>
  </ModalFrame>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import EmployeeLocationMap from '@/components/maps/EmployeeLocationMap.vue';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';

defineEmits(['close']);
const auth = useAuth();
const mapView = ref(null);
const initialized = ref(false);
const loading = ref(true);
const error = ref('');
const entityType = ref('mitarbeiter');
const locationId = ref(null);
const locations = ref([]);
const selectedSiteId = ref('');
const selectedId = ref('');
const siteSearch = ref('');
const entrySearch = ref('');
const payload = ref(null);
const sites = ref([]);
const sitesPending = ref(false);
const visibleCount = ref(100);
const modes = [{ value: 'mitarbeiter', label: 'Mitarbeiter' }, { value: 'einsatzort', label: 'Einsatzorte' }];
const pending = computed(() => Boolean(payload.value?.summary.pending || sitesPending.value));
const id = value => String(value?._id || value || '');
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const matches = (entry, term) => normalized([entry.name, entry.address, entry.customerLabel].filter(Boolean).join(' ')).includes(normalized(term));
const allMatchingSites = computed(() => sites.value.filter(site => matches(site, siteSearch.value)));
const siteMatchCount = computed(() => allMatchingSites.value.length);
const matchingSites = computed(() => {
  const result = allMatchingSites.value.slice(0, 200);
  const selected = sites.value.find(site => site.einsatzortId === selectedSiteId.value);
  return selected && !result.includes(selected) ? [selected, ...result] : result;
});
const entriesById = computed(() => new Map((payload.value?.entries || []).map(entry => [entry.id, entry])));
const selectedEntry = computed(() => entriesById.value.get(selectedId.value) || null);
const selectedAddresses = computed(() => (payload.value?.entries || []).filter(entry => entry.mitarbeiterId === selectedEntry.value?.mitarbeiterId));
const rankedEntries = computed(() => (payload.value?.nearest?.results || []).map(result => ({ ...result, entry: entriesById.value.get(result.entryId) })).filter(result => result.entry));
const excludedById = computed(() => new Map((payload.value?.nearest?.excluded || []).map(entry => [entry.entryId, entry])));
const filteredEntries = computed(() => (payload.value?.entries || []).filter(entry => matches(entry, entrySearch.value)));
const visibleEntries = computed(() => filteredEntries.value.slice(0, visibleCount.value));
let controller;
let timer;
let requestVersion = 0;
let disposed = false;
let sitesLocation = '';
let focusedOrigin = '';

function addressKind(entry) { return entry.addressKind === 'secondary' ? 'Zweitadresse' : entry.addressKind === 'main' ? 'Hauptadresse' : 'Einsatzort'; }
function duration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} Min.` : `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`;
}
function distance(meters) { return `${(meters / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`; }
function stateLabel(state) {
  return ({ invalid: 'Adresse unvollständig', pending: 'Wird ermittelt …', unresolved: 'Adresse nicht gefunden',
    disabled: 'Kartendienst noch nicht eingerichtet', error: 'Kartendienst vorübergehend nicht verfügbar', unroutable: 'Keine PKW-Verbindung gefunden' })[state] || '';
}

function setMode(value) {
  if (entityType.value === value) return;
  selectedSiteId.value = '';
  selectedId.value = '';
  entityType.value = value;
}
function chooseSite(site) {
  selectedSiteId.value = site.einsatzortId;
  selectedId.value = site.id;
  entityType.value = 'mitarbeiter';
}
async function focusEntry(entryId) {
  selectedId.value = entryId;
  await nextTick();
  mapView.value?.focus(entryId);
}

async function initialize() {
  controller?.abort();
  controller = new AbortController();
  const version = ++requestVersion;
  loading.value = true;
  error.value = '';
  try {
    const [locationResponse, userResponse] = await Promise.all([
      api.get('/api/locations', { signal: controller.signal }),
      api.get('/api/users/me', { signal: controller.signal }),
    ]);
    if (disposed || version !== requestVersion) return;
    const user = userResponse.data;
    auth.user = user;
    const active = locationResponse.data.filter(location => location.isActive !== false);
    const legacy = !id(user.locationV2) && user.location ? active.find(location => [location.nameFull, location.shortName].some(name => normalized(name) === normalized(user.location))) : null;
    const ownId = id(user.locationV2) || id(legacy);
    const admin = [user.role, ...(user.roles || [])].some(role => String(role).toUpperCase() === 'ADMIN');
    const allowed = new Set([ownId, ...(user.locationAccess || []).map(id)]);
    locations.value = active.filter(location => admin || allowed.has(id(location)));
    locationId.value = locations.value.some(location => id(location) === ownId) ? ownId : null;
    // Flush initial filter changes before enabling the request watcher.
    await nextTick();
    if (disposed || version !== requestVersion) return;
    initialized.value = true;
    await loadData();
  } catch (err) {
    if (disposed || version !== requestVersion || err.code === 'ERR_CANCELED') return;
    error.value = 'Benutzer und Standorte konnten nicht geladen werden.';
    loading.value = false;
  }
}

async function loadData({ refresh = false } = {}) {
  clearTimeout(timer);
  controller?.abort();
  controller = new AbortController();
  const version = ++requestVersion;
  const region = locationId.value || 'all';
  const mode = entityType.value;
  const siteId = mode === 'mitarbeiter' ? selectedSiteId.value : '';
  if (!refresh) { loading.value = true; payload.value = null; visibleCount.value = 100; }
  error.value = '';
  try {
    const needsSites = mode === 'mitarbeiter' && (sitesLocation !== region || sitesPending.value || !refresh);
    const [main, siteResponse] = await Promise.all([
      api.get('/api/personal/map-data', { signal: controller.signal, params: { entityType: mode, locationV2: region, ...(siteId ? { einsatzortId: siteId } : {}) } }),
      needsSites ? api.get('/api/personal/map-data', { signal: controller.signal, params: { entityType: 'einsatzort', locationV2: region } }) : Promise.resolve(null),
    ]);
    if (disposed || version !== requestVersion) return;
    payload.value = main.data;
    locations.value = main.data.locations;
    if (siteResponse || mode === 'einsatzort') {
      const data = siteResponse?.data || main.data;
      sites.value = data.entries;
      sitesPending.value = Boolean(data.summary.pending);
      sitesLocation = region;
    }
    loading.value = false;
    if (payload.value.origin?.coordinates && focusedOrigin !== payload.value.origin.id) {
      focusedOrigin = payload.value.origin.id;
      await focusEntry(focusedOrigin);
    }
    if (disposed || version !== requestVersion) return;
    if (pending.value && !document.hidden) timer = setTimeout(() => loadData({ refresh: true }), 3000);
  } catch (err) {
    if (disposed || version !== requestVersion || err.code === 'ERR_CANCELED') return;
    payload.value = null;
    sites.value = [];
    sitesPending.value = false;
    sitesLocation = '';
    error.value = err.response?.data?.message || 'Die Kartendaten konnten nicht geladen werden.';
    loading.value = false;
  }
}

watch(locationId, () => {
  selectedSiteId.value = '';
  selectedId.value = '';
  siteSearch.value = '';
  sites.value = [];
  sitesLocation = '';
});
watch([entityType, locationId, selectedSiteId], () => {
  focusedOrigin = '';
  if (initialized.value) void loadData();
});
watch(entrySearch, () => { visibleCount.value = 100; });

function visibilityChanged() {
  clearTimeout(timer);
  if (!document.hidden && initialized.value && pending.value) void loadData({ refresh: true });
}
onMounted(() => { document.addEventListener('visibilitychange', visibilityChanged); void initialize(); });
onBeforeUnmount(() => {
  disposed = true;
  requestVersion += 1;
  controller?.abort();
  clearTimeout(timer);
  document.removeEventListener('visibilitychange', visibilityChanged);
});
</script>

<style scoped>
.staff-map-modal { --mf-body-padding: 12px; --mf-body-overflow: hidden; }
.staff-map { display: flex; flex-direction: column; min-height: 0; height: 100%; gap: 10px; }
.staff-map :deep(.toolbar) { flex: 0 0 auto; margin: 0; }
.staff-map__layout { display: grid; grid-template-columns: minmax(0, 1fr) 370px; flex: 1; min-height: 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.staff-map__map-panel { position: relative; min-height: 0; display: flex; flex-direction: column; }
.staff-map__map-panel > :deep(.employee-map) { flex: 1; min-height: 0; }
.staff-map__sidebar { overflow-y: auto; min-height: 0; border-left: 1px solid var(--border); background: var(--tile-bg); }
.staff-map__section { padding: 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.staff-map__section h4 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.staff-map__section-heading { display: flex; align-items: center; justify-content: space-between; }
.staff-map__section p { margin: 0; font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
.staff-map__section label { font-size: 12px; font-weight: 600; }
.staff-map__section input, .staff-map__section select { box-sizing: border-box; width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--modal-bg, #fff); color: var(--text); font: inherit; font-size: 12px; }
.staff-map button { font: inherit; cursor: pointer; }
.staff-map button:disabled { opacity: .5; cursor: wait; }
.staff-map button:focus-visible, .staff-map input:focus-visible, .staff-map select:focus-visible { outline: 2px solid var(--primary, #2563eb); outline-offset: 2px; }
.staff-map__modes { display: flex; padding: 3px; background: var(--modal-bg); border: 1px solid var(--border); border-radius: 9px; }
.staff-map__modes button { border: 0; border-radius: 6px; background: transparent; color: var(--muted); padding: 8px 12px; font-size: 12px; font-weight: 600; }
.staff-map__modes button[aria-pressed="true"] { background: var(--primary, #2563eb); color: white; }
.staff-map__refresh, .staff-map__message button, .staff-map__more { border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; background: var(--tile-bg); color: var(--text); font-size: 12px !important; }
.staff-map__refresh { margin-left: auto; }
.staff-map__message { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--tile-bg); font-size: 12px; }
.staff-map__message--error { border-color: #dc2626; }
.staff-map__progress, .staff-map__empty { position: absolute; left: 12px; top: 90px; right: 12px; z-index: 600; margin: auto; width: fit-content; max-width: calc(100% - 40px); padding: 10px 14px; border-radius: 10px; background: var(--tile-bg, white); color: var(--text); box-shadow: 0 4px 16px #0002; font-size: 12px; display: flex; align-items: center; gap: 10px; pointer-events: none; }
.staff-map__spinner { width: 13px; height: 13px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: map-spin 1s linear infinite; }
.staff-map__legend { display: flex; flex-wrap: wrap; gap: 10px 14px; padding: 10px 12px; background: var(--tile-bg); color: var(--muted); font-size: 10px; border-top: 1px solid var(--border); }
.staff-map__legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend-pin { display: inline-grid; place-items: center; width: 17px; height: 17px; background: #64748b; border-radius: 50%; color: #fff; font-style: normal; font-size: 9px; }
.legend-pin--secondary { background: transparent; color: var(--text); border: 1px dashed #64748b; }
.legend-pin--site { border-radius: 3px; }
.legend-pin--nearest { width: 12px; height: 12px; outline: 2px solid #f59e0b; outline-offset: 1px; margin: 2px; }
.legend-location, .staff-map__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.staff-map__muted { color: var(--muted); }
.staff-map__eyebrow { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .07em; }
.staff-map__origin, .staff-map__selection { background: color-mix(in srgb, var(--primary) 5%, var(--tile-bg)); }
.staff-map__text-button { border: 0; background: transparent; color: var(--text); padding: 0; text-align: left; font-weight: 700 !important; font-size: 14px !important; }
.staff-map__address-link { display: flex; flex-direction: column; gap: 3px; border: 0; background: transparent; color: var(--text); padding: 4px 0; text-align: left; font-size: 12px !important; }
.staff-map__count { border-radius: 20px; padding: 2px 7px; background: var(--hover); font-size: 11px; font-weight: 600; }
.staff-map__ranked, .staff-map__entry-list { list-style: none; padding: 0; margin: 0; }
.staff-map__ranked li + li, .staff-map__entry-list li + li { border-top: 1px solid var(--border); }
.staff-map__result, .staff-map__entry { width: 100%; text-align: left; display: flex; align-items: flex-start; gap: 9px; padding: 12px 4px; border: 0; border-radius: 6px; background: transparent; color: var(--text); }
.staff-map__result:hover, .staff-map__entry:hover, .is-selected { background: var(--hover) !important; }
.staff-map__result-main, .staff-map__entry > span:last-child { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.staff-map__result strong, .staff-map__entry strong { font-size: 12px; }
.staff-map__result small, .staff-map__entry small { color: var(--muted); font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
.staff-map__rank { min-width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: #f59e0b; color: #1c1917; font-size: 11px; font-weight: 700; }
.staff-map__travel { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; flex-shrink: 0; }
.staff-map__travel strong { font-size: 11px; }
.staff-map__dot { margin-top: 4px; }
.staff-map__choose { padding: 0 4px 10px 21px; border: 0; background: none; color: var(--primary); font-size: 11px !important; text-align: left; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@keyframes map-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .staff-map__spinner { animation: none; } }
@media (max-width: 1000px) { .staff-map__layout { grid-template-columns: minmax(0, 1fr) 310px; } }
@media (max-width: 760px) {
  .staff-map-modal { --mf-body-padding: 8px; }
  .staff-map__layout { display: flex; flex-direction: column; overflow-y: auto; }
  .staff-map__map-panel { height: 42vh; min-height: 320px; flex-shrink: 0; }
  .staff-map__sidebar { overflow: visible; border-left: 0; border-top: 1px solid var(--border); }
  .staff-map__legend { font-size: 9px; gap: 8px; }
  .staff-map__section { padding: 12px; }
  .staff-map :deep(.location-filter) { max-width: 100%; overflow-x: auto; }
}
</style>
