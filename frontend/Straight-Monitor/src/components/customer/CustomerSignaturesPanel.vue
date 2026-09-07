<template>
  <section class="customer-signatures">
    <h4 class="section-title">
      <font-awesome-icon :icon="['fas', 'file-signature']" /> Signatur
    </h4>

    <nav class="signature-sections" aria-label="Signaturbereiche">
      <button type="button" :class="{ active: section === 'overview' }" @click="section = 'overview'">
        <font-awesome-icon :icon="['fas', 'file-signature']" />
        <span><strong>Signaturen</strong><small>{{ vorgaenge.length }} Vorgänge dieses Kunden</small></span>
      </button>
      <button type="button" :class="{ active: section === 'email' }" @click="section = 'email'">
        <font-awesome-icon :icon="['fas', 'envelope-open-text']" />
        <span><strong>E-Mail-Vorlage</strong><small>Ansprache für Stundenlisten-Signaturen</small></span>
      </button>
      <button type="button" :class="{ active: section === 'delivery' }" @click="section = 'delivery'">
        <font-awesome-icon :icon="['fas', 'paper-plane']" />
        <span><strong>Auslieferung</strong><small>Empfänger für vollständig signierte Dokumente</small></span>
      </button>
    </nav>

    <label class="stundenliste-double-copy-toggle">
      <input v-model="stundenlisteSignaturDoppelt" type="checkbox" :disabled="stundenlisteSettingSaving" @change="saveStundenlisteSetting" />
      <span>
        <strong>Stundenliste als Doppelausfertigung</strong>
        <small>Die erste Signaturausfertigung sperrt Beginn bis Unterschrift; die zweite bleibt leer.</small>
      </span>
      <font-awesome-icon v-if="stundenlisteSettingSaving" :icon="['fas', 'spinner']" spin />
    </label>
    <p v-if="stundenlisteSettingError" class="stundenliste-double-copy-error">{{ stundenlisteSettingError }}</p>

    <template v-if="section === 'overview'">
      <Toolbar class="signature-toolbar">
        <SearchBar v-model="search" placeholder="Signaturen durchsuchen …" class="signature-search" />
        <ToolbarLabel>{{ filteredVorgaenge.length }} {{ filteredVorgaenge.length === 1 ? 'Eintrag' : 'Einträge' }}</ToolbarLabel>
        <template #actions>
          <ToolbarGroup push-right>
            <ToolbarButton variant="secondary" @click="openNewSignature">
              <font-awesome-icon :icon="['fas', 'plus']" /> Neue Signatur
            </ToolbarButton>
          </ToolbarGroup>
        </template>
      </Toolbar>

      <div class="signature-filters">
        <span class="filter-label">Status</span>
        <FilterChip
          v-for="option in statusOptions"
          :key="option.key"
          :active="statuses.includes(option.key)"
          @click="toggleStatus(option.key)"
        >{{ option.label }}</FilterChip>
        <button v-if="!hasDefaultStatuses" type="button" class="filter-reset" @click="resetStatuses">Zurücksetzen</button>
      </div>

      <div v-if="availableTypes.length > 1" class="signature-filters signature-filters--types">
        <span class="filter-label">Dokument</span>
        <FilterChip :active="!typeFilter" @click="typeFilter = ''">Alle</FilterChip>
        <FilterChip
          v-for="type in availableTypes"
          :key="type.key"
          :active="typeFilter === type.key"
          @click="typeFilter = typeFilter === type.key ? '' : type.key"
        >{{ type.label }}</FilterChip>
      </div>

      <div v-if="loading" class="signature-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin />
        <span>Signaturen werden geladen …</span>
      </div>
      <div v-else-if="error" class="signature-state signature-state--error">
        <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
        <span>{{ error }}</span>
        <button type="button" @click="loadVorgaenge">Erneut versuchen</button>
      </div>
      <div v-else-if="filteredVorgaenge.length === 0" class="signature-empty">
        <span class="empty-icon"><font-awesome-icon :icon="['fas', 'file-signature']" /></span>
        <div>
          <strong>{{ vorgaenge.length ? 'Keine Signaturen passen zu den Filtern.' : 'Noch keine Signaturen für diesen Kunden.' }}</strong>
          <small>{{ vorgaenge.length ? 'Passe Status, Dokumenttyp oder Suche an.' : 'Lege den ersten Signaturvorgang direkt aus der Kundenakte an.' }}</small>
        </div>
        <ToolbarButton v-if="!vorgaenge.length" variant="secondary" @click="openNewSignature">
          <font-awesome-icon :icon="['fas', 'plus']" /> Neue Signatur
        </ToolbarButton>
      </div>
      <div v-else class="signature-list">
        <SignaturCard
          v-for="vorgang in filteredVorgaenge"
          :key="vorgang._id"
          :vorgang="vorgang"
          :starred="starred.includes(vorgang._id)"
          @toggle-star="toggleStar"
          @cancelled="onCancelled"
          @refreshed="upsertVorgang"
          @edit-draft="editDraft"
        />
      </div>
    </template>

    <CustomerEmailTemplatesEditor v-else-if="section === 'email'" :kunden-nr="kunde.kundenNr" />

    <section v-else class="delivery-defaults">
      <label>
        <span>Dokumenttyp</span>
        <select v-model="deliveryTypId" :disabled="deliveryTypesLoading">
          <option value="">Dokumenttyp auswählen</option>
          <option v-for="type in deliveryTypes" :key="type._id" :value="type._id">{{ type.label }}</option>
        </select>
      </label>
      <div v-if="deliveryTypId" class="delivery-defaults__content">
        <ContactSearchPicker
          :key="deliveryPickerKey"
          v-model="deliveryRecipient"
          role-name="Empfänger"
          :contacts="graphContacts"
          :removable="false"
          :show-delivery-method="false"
          :excluded-emails="deliveryRecipients.map((recipient) => recipient.email)"
          @selected="addDeliveryRecipient"
        />
        <p v-if="deliveryError" class="delivery-defaults__error">{{ deliveryError }}</p>
        <div v-if="deliveryLoading" class="signature-state"><font-awesome-icon :icon="['fas', 'spinner']" spin /> Laden …</div>
        <div v-else class="delivery-defaults__recipients">
          <span v-for="(recipient, index) in deliveryRecipients" :key="recipient.email" class="delivery-recipient">
            {{ recipient.displayName || recipient.email }}
            <small v-if="recipient.displayName">{{ recipient.email }}</small>
            <button type="button" title="Empfänger entfernen" @click="deliveryRecipients.splice(index, 1)">×</button>
          </span>
          <p v-if="!deliveryRecipients.length">Keine Standardempfänger festgelegt.</p>
        </div>
        <ToolbarButton :disabled="deliverySaving" @click="saveDeliveryRecipients">
          <font-awesome-icon :icon="['fas', deliverySaving ? 'spinner' : 'floppy-disk']" :spin="deliverySaving" />
          {{ deliverySaving ? 'Speichert …' : 'Standard speichern' }}
        </ToolbarButton>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faEnvelopeOpenText, faFileSignature, faFloppyDisk, faPaperPlane, faPlus, faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useSignaturModal } from '@/stores/signaturModal';
import ContactSearchPicker from '@/components/ContactSearchPicker.vue';
import CustomerEmailTemplatesEditor from '@/components/customer/CustomerEmailTemplatesEditor.vue';
import SignaturCard from '@/components/SignaturCard.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import ToolbarLabel from '@/components/ui-elements/ToolbarLabel.vue';

library.add(faEnvelopeOpenText, faFileSignature, faFloppyDisk, faPaperPlane, faPlus, faSpinner, faTriangleExclamation);

const props = defineProps({
  kunde: { type: Object, required: true },
});

const modal = useSignaturModal();
const section = ref('overview');
const vorgaenge = ref([]);
const loading = ref(false);
const error = ref('');
const search = ref('');
const typeFilter = ref('');
const statusOptions = [
  { key: 'draft', label: 'Entwurf' },
  { key: 'open', label: 'Offen' },
  { key: 'completed', label: 'Abgeschlossen' },
  { key: 'cancelled', label: 'Storniert' },
];
const defaultStatuses = statusOptions.filter(({ key }) => key !== 'cancelled').map(({ key }) => key);
const statuses = ref([...defaultStatuses]);
const starred = ref(loadStarred());
let eventSource = null;
const deliveryTypes = ref([]);
const deliveryTypesLoading = ref(false);
const deliveryTypId = ref('');
const deliveryRecipients = ref([]);
const deliveryRecipient = ref({ name: '', email: '', embedded: false });
const deliveryPickerKey = ref(0);
const graphContacts = ref([]);
const deliveryLoading = ref(false);
const deliverySaving = ref(false);
const deliveryError = ref('');
const stundenlisteSignaturDoppelt = ref(props.kunde.stundenlisteSignaturDoppelt === true);
const stundenlisteSettingSaving = ref(false);
const stundenlisteSettingError = ref('');

const hasDefaultStatuses = computed(() =>
  statuses.value.length === defaultStatuses.length
  && defaultStatuses.every((status) => statuses.value.includes(status))
);

const availableTypes = computed(() => {
  const types = new Map();
  vorgaenge.value.forEach((vorgang) => {
    const key = vorgang.typKey || vorgang.typ?._id;
    if (key) types.set(key, { key, label: vorgang.typ?.label || vorgang.typKey || 'Signatur' });
  });
  return [...types.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'));
});

const filteredVorgaenge = computed(() => {
  const query = search.value.trim().toLowerCase();
  return vorgaenge.value
    .filter((vorgang) => statuses.value.includes(vorgang.status))
    .filter((vorgang) => !typeFilter.value || vorgang.typKey === typeFilter.value)
    .filter((vorgang) => {
      if (!query) return true;
      const haystack = [
        vorgang.name,
        vorgang.auftragNr,
        vorgang.auftragTitel,
        vorgang.docusealTemplateName,
        ...(vorgang.submitters || []).flatMap((submitter) => [submitter.name, submitter.email]),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      const aStarred = starred.value.includes(a._id) ? 0 : 1;
      const bStarred = starred.value.includes(b._id) ? 0 : 1;
      return aStarred - bStarred || new Date(b.createdAt) - new Date(a.createdAt);
    });
});

function toggleStatus(status) {
  const index = statuses.value.indexOf(status);
  if (index === -1) statuses.value.push(status);
  else statuses.value.splice(index, 1);
}

function resetStatuses() {
  statuses.value = [...defaultStatuses];
}

function loadStarred() {
  try { return JSON.parse(localStorage.getItem('signatur_starred') || '[]'); } catch { return []; }
}

function toggleStar(id) {
  const index = starred.value.indexOf(id);
  if (index === -1) starred.value.push(id);
  else starred.value.splice(index, 1);
  localStorage.setItem('signatur_starred', JSON.stringify(starred.value));
}

function belongsToCustomer(vorgang) {
  const customerId = String(props.kunde._id || '');
  const linkedId = String(vorgang.kunde?._id || vorgang.kunde || '');
  return (customerId && linkedId === customerId)
    || Number(vorgang.kundenNr) === Number(props.kunde.kundenNr);
}

function upsertVorgang(vorgang) {
  if (!vorgang?._id) return;
  const index = vorgaenge.value.findIndex((item) => item._id === vorgang._id);
  if (!belongsToCustomer(vorgang)) {
    if (index !== -1) vorgaenge.value.splice(index, 1);
    return;
  }
  if (index === -1) vorgaenge.value.unshift(vorgang);
  else vorgaenge.value.splice(index, 1, vorgang);
}

function onCancelled(id) {
  const index = vorgaenge.value.findIndex((item) => item._id === id);
  if (index !== -1) vorgaenge.value[index] = { ...vorgaenge.value[index], status: 'cancelled' };
}

function openNewSignature() {
  modal.openModal({
    kundeId: props.kunde._id || null,
    kundenKuerzel: props.kunde.kuerzel || null,
  }, upsertVorgang);
}

function editDraft(vorgang) {
  modal.openModal({
    draftId: vorgang._id,
    draftData: vorgang,
    kundeId: props.kunde._id || null,
    kundenKuerzel: props.kunde.kuerzel || null,
  }, upsertVorgang);
}

watch(() => props.kunde.stundenlisteSignaturDoppelt, (value) => {
  if (!stundenlisteSettingSaving.value) stundenlisteSignaturDoppelt.value = value === true;
});

async function saveStundenlisteSetting() {
  const previousValue = props.kunde.stundenlisteSignaturDoppelt === true;
  stundenlisteSettingSaving.value = true;
  stundenlisteSettingError.value = '';
  try {
    await api.put(`/api/kunden/${props.kunde._id}`, {
      stundenlisteSignaturDoppelt: stundenlisteSignaturDoppelt.value,
    });
    props.kunde.stundenlisteSignaturDoppelt = stundenlisteSignaturDoppelt.value;
  } catch (requestError) {
    stundenlisteSignaturDoppelt.value = previousValue;
    stundenlisteSettingError.value = requestError.response?.data?.message || 'Einstellung konnte nicht gespeichert werden.';
  } finally {
    stundenlisteSettingSaving.value = false;
  }
}

function addDeliveryRecipient(recipient = deliveryRecipient.value) {
  const email = String(recipient.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return;
  if (!deliveryRecipients.value.some((item) => String(item.email || '').toLowerCase() === email)) {
    deliveryRecipients.value.push({ displayName: recipient.name || '', email });
  }
  deliveryRecipient.value = { name: '', email: '', embedded: false };
  deliveryPickerKey.value += 1;
}

async function loadDeliveryTypes() {
  deliveryTypesLoading.value = true;
  try {
    const [{ data: types }, { data: contacts }] = await Promise.all([
      api.get('/api/signatur-typen'),
      api.get('/api/graph/contacts'),
    ]);
    deliveryTypes.value = (Array.isArray(types) ? types : []).filter((type) => type.isActive !== false);
    graphContacts.value = Array.isArray(contacts?.contacts) ? contacts.contacts : [];
  } catch (requestError) {
    deliveryError.value = requestError.response?.data?.message || 'Einstellungen konnten nicht geladen werden.';
  } finally {
    deliveryTypesLoading.value = false;
  }
}

async function loadDeliveryRecipients() {
  deliveryRecipients.value = [];
  deliveryError.value = '';
  if (!deliveryTypId.value) return;
  deliveryLoading.value = true;
  try {
    const { data } = await api.get('/api/signaturen/folge-defaults', {
      params: { kundeId: props.kunde._id, typId: deliveryTypId.value },
    });
    deliveryRecipients.value = Array.isArray(data.ausliefernAn) ? data.ausliefernAn : [];
  } catch (requestError) {
    deliveryError.value = requestError.response?.data?.message || 'Standardempfänger konnten nicht geladen werden.';
  } finally {
    deliveryLoading.value = false;
  }
}

async function saveDeliveryRecipients() {
  if (!deliveryTypId.value || deliverySaving.value) return;
  deliverySaving.value = true;
  deliveryError.value = '';
  try {
    const { data } = await api.put('/api/signaturen/folge-defaults', {
      kundeId: props.kunde._id,
      typId: deliveryTypId.value,
      ausliefernAn: deliveryRecipients.value,
    });
    deliveryRecipients.value = data.ausliefernAn || [];
  } catch (requestError) {
    deliveryError.value = requestError.response?.data?.message || 'Standardempfänger konnten nicht gespeichert werden.';
  } finally {
    deliverySaving.value = false;
  }
}

async function loadVorgaenge() {
  if (!props.kunde.kundenNr) return;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/api/signaturen', {
      params: { kundenNr: props.kunde.kundenNr, refresh: true },
    });
    vorgaenge.value = Array.isArray(data) ? data : [];
  } catch (requestError) {
    vorgaenge.value = [];
    error.value = requestError.response?.data?.message || 'Signaturen konnten nicht geladen werden.';
  } finally {
    loading.value = false;
  }
}

function connectSSE() {
  if (eventSource) eventSource.close();
  const token = localStorage.getItem('token');
  if (!token) return;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  eventSource = new EventSource(`${base}/api/signaturen/events?token=${encodeURIComponent(token)}`);
  eventSource.onmessage = (event) => {
    try {
      const { type, payload } = JSON.parse(event.data);
      if ((type === 'vorgang.updated' || type === 'vorgang.created') && payload?._id) upsertVorgang(payload);
    } catch { /* Ignore malformed heartbeat or event payloads. */ }
  };
}

watch(() => props.kunde.kundenNr, loadVorgaenge);
watch(section, (value) => {
  if (value === 'delivery' && !deliveryTypes.value.length) loadDeliveryTypes();
});
watch(deliveryTypId, loadDeliveryRecipients);
onMounted(() => {
  loadVorgaenge();
  connectSSE();
});
onBeforeUnmount(() => eventSource?.close());
</script>

<style scoped>
.customer-signatures { display:grid; gap:.8rem; }
.signature-sections { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.65rem; }
.signature-sections button { display:flex; align-items:center; gap:.7rem; min-height:58px; padding:.7rem .8rem; border:1px solid var(--border); border-radius:9px; color:var(--text); background:var(--surface); text-align:left; cursor:pointer; }
.signature-sections button > svg { color:var(--muted); font-size:1rem; }
.signature-sections button > span { display:grid; gap:.15rem; }
.signature-sections small { color:var(--muted); }
.signature-sections button:hover { border-color:color-mix(in srgb,var(--primary) 55%,var(--border)); }
.signature-sections button.active { border-color:var(--primary); background:color-mix(in srgb,var(--primary) 7%,var(--surface)); box-shadow:inset 0 0 0 1px var(--primary); }
.signature-sections button.active > svg { color:var(--primary); }
.stundenliste-double-copy-toggle { display:flex; align-items:center; gap:.7rem; padding:.75rem .8rem; border:1px solid var(--border); border-radius:8px; color:var(--text); background:var(--panel); cursor:pointer; }
.stundenliste-double-copy-toggle input { width:1rem; height:1rem; accent-color:var(--primary); }
.stundenliste-double-copy-toggle > span { display:grid; gap:.12rem; flex:1; }
.stundenliste-double-copy-toggle small { color:var(--muted); }
.stundenliste-double-copy-toggle > svg { color:var(--primary); }
.stundenliste-double-copy-toggle:has(input:disabled) { cursor:wait; opacity:.75; }
.stundenliste-double-copy-error { margin:0; color:#e6584f; font-size:.82rem; }
.signature-toolbar { margin:0; }
.signature-search { min-width:min(340px,40vw); }
.signature-filters { display:flex; align-items:center; flex-wrap:wrap; gap:.4rem; padding:.15rem .15rem 0; }
.signature-filters--types { padding-top:0; }
.filter-label { margin-right:.15rem; color:var(--muted); font-size:.68rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
.filter-reset { padding:.25rem .4rem; border:0; color:var(--primary); background:transparent; font-size:.72rem; cursor:pointer; }
.signature-list { display:grid; gap:.6rem; }
.signature-state,.signature-empty { display:flex; align-items:center; justify-content:center; gap:.75rem; min-height:150px; padding:1rem; border:1px dashed var(--border); border-radius:10px; color:var(--muted); background:var(--panel); }
.signature-state > svg { color:var(--primary); font-size:1.2rem; }
.signature-state button { padding:.4rem .65rem; border:1px solid var(--border); border-radius:7px; color:var(--text); background:var(--surface); cursor:pointer; }
.signature-state--error { color:#e6584f; border-color:color-mix(in srgb,#e6584f 35%,var(--border)); background:color-mix(in srgb,#e6584f 6%,var(--surface)); }
.empty-icon { display:grid; flex:0 0 2.5rem; width:2.5rem; height:2.5rem; place-items:center; border-radius:9px; color:var(--primary); background:color-mix(in srgb,var(--primary) 12%,var(--surface)); }
.signature-empty > div { display:grid; flex:1; gap:.15rem; }
.signature-empty strong { color:var(--text); }
.signature-empty small { color:var(--muted); }
.delivery-defaults { display:grid; gap:.9rem; max-width:720px; padding:1rem; border:1px solid var(--border); border-radius:9px; background:var(--panel); }
.delivery-defaults > label { display:grid; gap:.35rem; color:var(--muted); font-size:.74rem; font-weight:700; }
.delivery-defaults select { min-height:40px; padding:.5rem .65rem; border:1px solid var(--border); border-radius:8px; color:var(--text); background:var(--surface); font:inherit; }
.delivery-defaults__content { display:grid; gap:.7rem; }
.delivery-defaults__recipients { display:flex; flex-wrap:wrap; gap:.45rem; }
.delivery-defaults__recipients > p { width:100%; margin:0; color:var(--muted); font-size:.82rem; }
.delivery-recipient { display:inline-flex; align-items:center; gap:.35rem; padding:.35rem .55rem; border:1px solid color-mix(in srgb,var(--primary) 35%,var(--border)); border-radius:999px; color:var(--text); background:var(--surface); font-size:.8rem; }
.delivery-recipient small { color:var(--muted); }
.delivery-recipient button { padding:0; border:0; color:var(--muted); background:transparent; font-size:1rem; cursor:pointer; }
.delivery-recipient button:hover { color:#e6584f; }
.delivery-defaults__error { margin:0; color:#e6584f; font-size:.82rem; }
@media (max-width:760px) {
  .signature-sections { grid-template-columns:1fr; }
  .signature-sections button { min-height:48px; }
  .signature-toolbar :deep(.toolbar) { flex-wrap:wrap; }
  .signature-search { min-width:0; width:100%; }
  .signature-empty { align-items:flex-start; flex-wrap:wrap; }
}
</style>
