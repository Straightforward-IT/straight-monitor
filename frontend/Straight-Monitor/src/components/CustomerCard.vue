<template>
  <article class="customer-card" :data-theme="effectiveTheme">
    <!-- Header -->
    <header class="card-header">
      <div class="left">
        <div class="icon-box">
          <font-awesome-icon :icon="['fas', 'building']" class="header-icon" />
        </div>
        <div class="title">
          <span class="kunden-nr">Kunden-Nr. {{ kunde.kundenNr }}</span>
          <div class="name-row">
            <span class="name">{{ kunde.kundName || 'Unbenannt' }}</span>
            <!-- Kuerzel -->
            <template v-if="!editingKuerzel">
              <span v-if="kunde.kuerzel" class="kuerzel-badge" @click="startEditKuerzel" title="Kürzel bearbeiten">{{ kunde.kuerzel }}</span>
              <button v-else class="kuerzel-add-btn" @click="startEditKuerzel" title="Kürzel festlegen">
                <font-awesome-icon :icon="['fas', 'tag']" /> Kürzel
              </button>
            </template>
            <template v-else>
              <div class="kuerzel-edit-row" @keydown.enter="saveKuerzel" @keydown.esc="cancelEditKuerzel">
                <input
                  ref="kuerzelInputRef"
                  v-model="kuerzelInput"
                  class="kuerzel-input"
                  placeholder="z.B. ABB"
                  maxlength="20"
                />
                <button class="kuerzel-save-btn" @click="saveKuerzel" :disabled="kuerzelSaving">
                  <font-awesome-icon :icon="['fas', kuerzelSaving ? 'spinner' : 'check']" :spin="kuerzelSaving" />
                </button>
                <button class="kuerzel-cancel-btn" @click="cancelEditKuerzel">
                  <font-awesome-icon :icon="['fas', 'times']" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="right">
        <span class="status-badge" :class="getStatusClass(kunde.kundStatus)">
          {{ getStatusText(kunde.kundStatus) }}
        </span>
      </div>
    </header>

    <!-- Body -->
    <div class="card-body">
      
      <!-- General Info -->
      <section class="section info-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'info-circle']" /> Allgemeine Daten
        </h4>
        <div class="kv-grid">
          <div class="kv-item">
            <span class="label">Geschäftsstelle</span>
            <span class="value">{{ getGeschStText(kunde.geschSt) }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Kostenstelle</span>
            <span class="value">{{ kunde.kostenSt || '—' }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Kunde seit</span>
            <span class="value">{{ formatDate(kunde.kundeSeit) }}</span>
          </div>
        </div>
      </section>

      <section class="section remarks-section" v-if="kunde.bemerkung && kunde.bemerkung.length > 0">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'clipboard']" /> Bemerkungen
        </h4>
        <ul class="remarks-list">
          <li v-for="(rem, index) in kunde.bemerkung" :key="index" class="remark-item">
            {{ rem }}
          </li>
        </ul>
      </section>

      <!-- Contacts -->
      <section class="section contacts-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'address-book']" /> Kontakte
          <span class="badge">{{ linkedContacts.length }}</span>
        </h4>

        <div v-if="!kunde.kuerzel" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'tag']" class="empty-icon" />
          Kein Kürzel gesetzt — Kürzel im Header festlegen, um verknüpfte Kontakte anzuzeigen.
        </div>

        <div v-else-if="contactsLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Kontakte werden geladen…
        </div>

        <div v-else-if="linkedContacts.length === 0" class="empty-contacts">
          Keine Microsoft-Kontakte mit Kürzel „{{ kunde.kuerzel }}" gefunden.
        </div>

        <div v-else class="contacts-list">
          <div v-for="contact in linkedContacts" :key="contact.id" class="contact-card">

            <!-- Edit mode -->
            <template v-if="editingContactId === contact.id">
              <div class="edit-form">
                <div class="edit-row">
                  <input v-model="editForm.givenName" placeholder="Vorname" class="edit-input" />
                  <input v-model="editForm.surname" placeholder="Nachname" class="edit-input" />
                </div>
                <input v-model="editForm.jobTitle" placeholder="Position / Titel" class="edit-input edit-input-full" />
                <input v-model="editForm.email" placeholder="E-Mail" class="edit-input edit-input-full" />
                <div class="edit-row">
                  <input v-model="editForm.businessPhone" placeholder="Festnetz" class="edit-input" />
                  <input v-model="editForm.mobilePhone" placeholder="Mobil" class="edit-input" />
                </div>
              </div>
              <div class="contact-actions">
                <button class="action-btn action-save" @click="saveEditContact(contact)" :disabled="contactSaving">
                  <font-awesome-icon :icon="['fas', contactSaving ? 'spinner' : 'check']" :spin="contactSaving" />
                  Speichern
                </button>
                <button class="action-btn action-cancel" @click="cancelEditContact">
                  <font-awesome-icon :icon="['fas', 'times']" /> Abbrechen
                </button>
              </div>
            </template>

            <!-- Read mode -->
            <template v-else>
              <div class="contact-header">
                <div class="contact-name">
                  <font-awesome-icon :icon="['fas', 'user']" />
                  {{ contact.displayName }}
                </div>
                <div class="contact-meta">
                  <span v-if="contact.jobTitle" class="creator">{{ contact.jobTitle }}</span>
                </div>
              </div>

              <div class="contact-details">
                <div v-if="contact.emailAddresses && contact.emailAddresses.length" class="detail-row">
                  <font-awesome-icon :icon="['fas', 'envelope']" />
                  <a :href="`mailto:${contact.emailAddresses[0].address}`">{{ contact.emailAddresses[0].address }}</a>
                </div>
                <div v-if="contact.businessPhones && contact.businessPhones.length" class="detail-row">
                  <font-awesome-icon :icon="['fas', 'phone']" />
                  <a :href="`tel:${contact.businessPhones[0]}`">{{ contact.businessPhones[0] }}</a>
                </div>
                <div v-else-if="contact.mobilePhone" class="detail-row">
                  <font-awesome-icon :icon="['fas', 'mobile-screen']" />
                  <a :href="`tel:${contact.mobilePhone}`">{{ contact.mobilePhone }}</a>
                </div>
              </div>

              <div class="contact-actions">
                <button class="action-btn action-edit" @click="startEditContact(contact)">
                  <font-awesome-icon :icon="['fas', 'pen']" /> Bearbeiten
                </button>
                <button class="action-btn action-delete" @click="deleteContact(contact)" :disabled="deletingContactId === contact.id">
                  <font-awesome-icon :icon="['fas', deletingContactId === contact.id ? 'spinner' : 'trash']" :spin="deletingContactId === contact.id" />
                  Löschen
                </button>
              </div>
            </template>

          </div>
        </div>
      </section>

      <!-- Analytics -->
      <section class="section analytics-section" v-if="kunde.kundenNr">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'chart-bar']" /> Einsatz-Analytics
        </h4>
        <KundenAnalyticsEmbed :kundenNr="kunde.kundenNr" :geschSt="kunde.geschSt" @navigate="$emit('close')" />
      </section>

      <!-- Kennzahlen -->
      <section class="section kpi-section" v-if="kunde.kundenNr">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'chart-line']" /> Kennzahlen
        </h4>

        <div v-if="kpiLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Kennzahlen werden geladen…
        </div>

        <div v-else-if="kpi" class="kpi-body">

          <!-- Top row: summary cards -->
          <div class="kpi-summary-row">
            <div class="kpi-card">
              <span class="kpi-value">{{ kpi.einsatz.avgPositionenPerAuftrag }}</span>
              <span class="kpi-label">Ø Positionen / Auftrag</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-value">{{ formatEuro(kpi.umsatz.total) }}</span>
              <span class="kpi-label">Gesamt-Umsatz (Netto)</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-value">{{ kpi.umsatz.shareGlobal }}%</span>
              <span class="kpi-label">Anteil Gesamtumsatz</span>
            </div>
            <div class="kpi-card" v-if="kpi.umsatz.shareStandort > 0">
              <span class="kpi-value">{{ kpi.umsatz.shareStandort }}%</span>
              <span class="kpi-label">Anteil Standortumsatz ({{ getGeschStText(kpi.umsatz.geschSt) }})</span>
            </div>
          </div>

          <!-- Yearly breakdown -->
          <div class="kpi-tables-row">

            <!-- Umsatz per year -->
            <div class="kpi-table-block" v-if="kpi.umsatz.perYear.length">
              <div class="kpi-table-title">Umsatz pro Jahr</div>
              <table class="kpi-table">
                <thead>
                  <tr><th>Jahr</th><th>Netto</th><th>Aktive Mo.</th><th>Hochgerechnet</th></tr>
                </thead>
                <tbody>
                  <tr v-for="y in kpi.umsatz.perYear" :key="y.year">
                    <td>{{ y.year }}</td>
                    <td>{{ formatEuro(y.netto) }}</td>
                    <td class="muted-cell">{{ y.activeMonths }}</td>
                    <td class="muted-cell">{{ y.activeMonths < 12 ? formatEuro(y.annualizedNetto) : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Einsätze per year -->
            <div class="kpi-table-block">
              <div class="kpi-table-title">Einsätze & Positionen pro Jahr</div>
              <table class="kpi-table">
                <thead>
                  <tr><th>Jahr</th><th>Einsätze</th><th>Aufträge</th><th>Ø Pos./Auftrag</th></tr>
                </thead>
                <tbody>
                  <tr v-for="y in kpi.einsatz.perYear" :key="y.year">
                    <td>{{ y.year }}</td>
                    <td>{{ y.einsaetze }}</td>
                    <td class="muted-cell">{{ y.auftraege }}</td>
                    <td>{{ y.avgPositionenPerAuftrag }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Qualifikationen -->
          <div class="kpi-table-block" v-if="kpi.qualifikationen.length">
            <div class="kpi-table-title">Gebuchte Qualifikationen</div>
            <div class="qual-bars">
              <div v-for="q in kpi.qualifikationen.slice(0, 10)" :key="q.qualSchl" class="qual-bar-row">
                <span class="qual-name">{{ q.name }}</span>
                <div class="qual-bar-track">
                  <div class="qual-bar-fill" :style="{ width: q.share + '%' }"></div>
                </div>
                <span class="qual-pct">{{ q.share }}%</span>
                <span class="qual-count muted-cell">({{ q.count }})</span>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>

    <!-- Footer -->
    <footer class="card-footer">
      <button class="btn btn-secondary" @click="$emit('close')">Schließen</button>
      <!-- Placeholder for Edit Action -->
      <!-- <button class="btn btn-primary">Bearbeiten</button> -->
    </footer>
  </article>
</template>

<script setup>
import { computed, ref, nextTick, watch, onMounted } from 'vue';
import { useTheme } from '@/stores/theme';
import { useDataCache } from '@/stores/dataCache';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import KundenAnalyticsEmbed from './KundenAnalyticsEmbed.vue';
import api from '@/utils/api';

const props = defineProps({
  kunde: { type: Object, required: true }
});

const emit = defineEmits(['close']);

const dataCache = useDataCache();

// MS Graph contacts linked via kuerzel
const msContacts = ref([]);
const contactsLoading = ref(false);

async function loadContacts() {
  if (!props.kunde.kuerzel) return;
  contactsLoading.value = true;
  try {
    const { data } = await api.get('/api/graph/contacts');
    msContacts.value = data.contacts || [];
  } catch (e) {
    msContacts.value = [];
  } finally {
    contactsLoading.value = false;
  }
}

const linkedContacts = computed(() => {
  const kuerzel = (props.kunde.kuerzel || '').trim().toLowerCase();
  if (!kuerzel) return [];
  return msContacts.value.filter(
    c => (c.companyName || '').trim().toLowerCase() === kuerzel
  );
});

onMounted(loadContacts);
watch(() => props.kunde.kuerzel, loadContacts);

// Kennzahlen (KPIs)
const kpi = ref(null);
const kpiLoading = ref(false);

async function loadKpi() {
  if (!props.kunde.kundenNr) return;
  kpiLoading.value = true;
  try {
    const params = { kundenNr: props.kunde.kundenNr };
    if (props.kunde.geschSt) params.geschSt = props.kunde.geschSt;
    const { data } = await api.get('/api/kunden/analytics/kennzahlen', { params });
    kpi.value = data;
  } catch (e) {
    kpi.value = null;
  } finally {
    kpiLoading.value = false;
  }
}

onMounted(loadKpi);

// Contact edit / delete
const editingContactId = ref(null);
const editForm = ref({});
const contactSaving = ref(false);
const deletingContactId = ref(null);

function startEditContact(contact) {
  editingContactId.value = contact.id;
  editForm.value = {
    givenName: contact.givenName || '',
    surname: contact.surname || '',
    jobTitle: contact.jobTitle || '',
    email: contact.emailAddresses?.[0]?.address || '',
    businessPhone: contact.businessPhones?.[0] || '',
    mobilePhone: contact.mobilePhone || '',
  };
}

function cancelEditContact() {
  editingContactId.value = null;
  editForm.value = {};
}

async function saveEditContact(contact) {
  if (contactSaving.value) return;
  contactSaving.value = true;
  try {
    const patch = {
      upn: contact._upn,
      givenName: editForm.value.givenName,
      surname: editForm.value.surname,
      jobTitle: editForm.value.jobTitle,
      mobilePhone: editForm.value.mobilePhone || null,
    };
    if (editForm.value.businessPhone) {
      patch.businessPhones = [editForm.value.businessPhone];
    } else {
      patch.businessPhones = [];
    }
    if (editForm.value.email) {
      patch.emailAddresses = [{ address: editForm.value.email, name: `${editForm.value.givenName} ${editForm.value.surname}`.trim() }];
    }
    const { data } = await api.patch(`/api/graph/contacts/${contact.id}`, patch);
    // Update in-place
    const idx = msContacts.value.findIndex(c => c.id === contact.id);
    if (idx !== -1 && data.contact) {
      msContacts.value[idx] = { ...msContacts.value[idx], ...data.contact };
    }
    editingContactId.value = null;
  } finally {
    contactSaving.value = false;
  }
}

async function deleteContact(contact) {
  if (!window.confirm(`Kontakt „${contact.displayName}" wirklich aus Microsoft-Kontakten löschen?`)) return;
  deletingContactId.value = contact.id;
  try {
    await api.delete(`/api/graph/contacts/${contact.id}`, { data: { upn: contact._upn } });
    msContacts.value = msContacts.value.filter(c => c.id !== contact.id);
  } finally {
    deletingContactId.value = null;
  }
}

// Kuerzel inline edit
const editingKuerzel = ref(false);
const kuerzelInput = ref('');
const kuerzelSaving = ref(false);
const kuerzelInputRef = ref(null);

function startEditKuerzel() {
  kuerzelInput.value = props.kunde.kuerzel || '';
  editingKuerzel.value = true;
  nextTick(() => kuerzelInputRef.value?.focus());
}

async function saveKuerzel() {
  if (kuerzelSaving.value) return;
  kuerzelSaving.value = true;
  try {
    const val = kuerzelInput.value.trim() || null;
    await api.put(`/api/kunden/${props.kunde._id}`, { kuerzel: val });
    // Update in-place in the cache so the list also reflects the change
    const cached = dataCache.kunden.find(k => k._id === props.kunde._id);
    if (cached) cached.kuerzel = val;
    props.kunde.kuerzel = val;
    editingKuerzel.value = false;
  } finally {
    kuerzelSaving.value = false;
  }
}

function cancelEditKuerzel() {
  editingKuerzel.value = false;
}

const theme = useTheme();
const effectiveTheme = computed(() => theme.current || 'light');

function getStatusText(status) {
  switch(status) {
    case 1: return 'Potentiell';
    case 2: return 'Aktiv';
    case 3: return 'Inaktiv';
    default: return 'Unbekannt';
  }
}

function getStatusClass(status) {
  switch(status) {
    case 1: return 'status-lead';
    case 2: return 'status-active';
    case 3: return 'status-inactive';
    default: return '';
  }
}

function getGeschStText(gs) {
  if (!gs) return '—';
  // Standard mappings based on AuftraegePage and other components
  if (gs === '1' || gs === 1) return 'Berlin';
  if (gs === '2' || gs === 2) return 'Hamburg';
  if (gs === '3' || gs === 3) return 'Köln';
  return gs;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatEuro(value) {
  if (value == null || value === 0) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
</script>

<style scoped>
.customer-card {
  display: flex;
  flex-direction: column;
  background: var(--tile-bg);
  border-radius: 12px;
  overflow: hidden;
  max-height: 90vh;
  width: 100%;
}

/* Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--tile-bg);
  border-bottom: 1px solid var(--border);
}

.left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-box {
  width: 42px;
  height: 42px;
  background: var(--hover);
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--primary);
  font-size: 18px;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.kuerzel-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(249, 115, 22, 0.15);
  color: var(--primary);
  border: 1px solid var(--primary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;
}

.kuerzel-badge:hover {
  background: rgba(249, 115, 22, 0.25);
}

.kuerzel-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  border: 1px dashed var(--border);
  cursor: pointer;
  transition: all 0.15s;
}

.kuerzel-add-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.kuerzel-edit-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.kuerzel-input {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid var(--primary);
  border-radius: 4px;
  background: var(--tile-bg);
  color: var(--text);
  width: 90px;
  outline: none;
}

.kuerzel-save-btn,
.kuerzel-cancel-btn {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  display: grid;
  place-items: center;
  transition: background 0.15s;
}

.kuerzel-save-btn {
  background: var(--primary);
  color: #fff;
}

.kuerzel-save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.kuerzel-cancel-btn {
  background: var(--hover);
  color: var(--muted);
}

.kunden-nr {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
}

.name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.status-active { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.status-inactive { background: rgba(107, 114, 128, 0.15); color: #6b7280; }
.status-lead { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

/* Body */
.card-body {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg { color: var(--muted); }
}

.badge {
  background: var(--soft);
  color: var(--text);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

/* Info Grid */
.kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--soft);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.kv-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.value {
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
}

/* Remarks */
.remarks-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.remark-item {
  position: relative;
  padding-left: 16px;
  margin-bottom: 8px;
  color: var(--text);
  font-size: 14px;
}

.remark-item::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: bold;
}

/* Contacts */
.contacts-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.empty-contacts {
  color: var(--muted);
  font-style: italic;
  font-size: 14px;
}

.contact-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contact-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.contact-name {
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg { color: var(--muted); }
}

.contact-meta {
  font-size: 11px;
  color: var(--muted);
}

.contact-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  
  svg { width: 14px; color: var(--muted); }
  
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
}

.contact-comments {
  margin-top: 8px;
  background: var(--hover);
  padding: 8px 12px;
  border-radius: 6px;
}

/* Contact actions */
.contact-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  background: transparent;
}

.action-edit {
  border-color: var(--border);
  color: var(--muted);
}
.action-edit:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.action-delete {
  border-color: var(--border);
  color: var(--muted);
}
.action-delete:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.action-delete:disabled,
.action-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-save {
  border-color: var(--primary);
  color: var(--primary);
  margin-left: auto;
}
.action-save:hover:not(:disabled) {
  background: var(--primary);
  color: #fff;
}

.action-cancel {
  border-color: var(--border);
  color: var(--muted);
}
.action-cancel:hover {
  background: var(--hover);
}

/* Edit form */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.edit-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 13px;
  background: var(--tile-bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}
.edit-input:focus {
  border-color: var(--primary);
}

.edit-input-full {
  width: 100%;
  box-sizing: border-box;
}

.comments-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.comment-item {
  font-size: 12px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.comment-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.comment-text {
  color: var(--text);
  margin-bottom: 2px;
}

.comment-footer {
  font-size: 10px;
  color: var(--muted);
}

/* Footer */
.card-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--tile-bg);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--tile-bg);
  border-color: var(--border);
  color: var(--text);
}
.btn-secondary:hover {
  background: var(--hover);
}

.btn-primary {
  background: var(--primary);
  color: white;
}
.btn-primary:hover {
  filter: brightness(1.1);
}

/* ── KPI Section ─────────────────────────────────────────────────────────── */
.kpi-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kpi-summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
}

.kpi-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-tables-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.kpi-table-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi-table-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.kpi-table th {
  text-align: left;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}

.kpi-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.kpi-table tr:last-child td {
  border-bottom: none;
}

.muted-cell {
  color: var(--muted);
}

/* Qualification bars */
.qual-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qual-bar-row {
  display: grid;
  grid-template-columns: 160px 1fr 40px 44px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.qual-name {
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qual-bar-track {
  height: 6px;
  background: var(--hover);
  border-radius: 3px;
  overflow: hidden;
}

.qual-bar-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.qual-pct {
  font-weight: 600;
  color: var(--text);
  text-align: right;
}

.qual-count {
  font-size: 11px;
}
</style>
