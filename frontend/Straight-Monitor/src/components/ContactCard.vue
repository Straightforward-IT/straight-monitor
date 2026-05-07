<template>
  <article class="contact-card" :data-theme="effectiveTheme">

    <!-- ── Header ────────────────────────────────────────────────────── -->
    <header class="card-header">
      <div class="left">
        <div class="avatar" :style="avatarStyle">{{ initials }}</div>
        <div class="title">
          <span class="display-name">{{ localContact.displayName || '–' }}</span>
          <div class="meta">
            <span v-if="localContact.jobTitle" class="pill">
              <font-awesome-icon :icon="['fas', 'briefcase']" />
              {{ localContact.jobTitle }}
            </span>
            <span v-if="localContact.companyName" class="pill">
              <font-awesome-icon :icon="['fas', 'building']" />
              {{ localContact.companyName }}
            </span>
            <span v-if="localContact._team" class="pill pill--team">{{ localContact._team }}</span>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <a
          v-if="primaryEmail"
          :href="`mailto:${primaryEmail}`"
          class="icon-btn"
          title="E-Mail schreiben"
        >
          <font-awesome-icon :icon="['fas', 'envelope']" />
        </a>
        <a
          v-if="primaryPhone"
          :href="`tel:${primaryPhone}`"
          class="icon-btn"
          title="Anrufen"
        >
          <font-awesome-icon :icon="['fas', 'phone']" />
        </a>
        <button
          class="icon-btn"
          :class="{ active: editing }"
          @click="toggleEdit"
          title="Bearbeiten"
        >
          <font-awesome-icon :icon="['fas', 'pen']" />
        </button>
        <button class="icon-btn" @click="$emit('close')" title="Schließen">
          <font-awesome-icon :icon="['fas', 'xmark']" />
        </button>
      </div>
    </header>

    <!-- ── Loading ───────────────────────────────────────────────────── -->
    <div v-if="loading" class="loading-state">
      <font-awesome-icon :icon="['fas', 'spinner']" spin />
      Lädt Kontakt…
    </div>

    <template v-else>

      <!-- ── Body: View ─────────────────────────────────────────────── -->
      <div v-if="!editing && !showDeleteConfirm" class="card-body">

        <!-- Microsoft branding -->
        <div class="ms-section">
          <div class="ms-brand">
            <div class="ms-logo-grid" aria-hidden="true">
              <span style="background:#f25022"></span>
              <span style="background:#7fba00"></span>
              <span style="background:#00a4ef"></span>
              <span style="background:#ffb900"></span>
            </div>
            <div class="ms-info">
              <span class="ms-label">Microsoft Kontakt</span>
              <span v-if="upn" class="ms-upn">{{ upn }}</span>
            </div>
          </div>

          <div
            v-if="linkedKunde"
            class="linked-kunde-badge"
            @click="$emit('open-kunde', linkedKunde)"
            title="Verknüpften Kunden öffnen"
          >
            <font-awesome-icon :icon="['fas', 'link']" />
            <span>{{ linkedKunde.kundName }}</span>
            <font-awesome-icon :icon="['fas', 'arrow-right']" class="arrow-icon" />
          </div>
        </div>

        <!-- Contact detail KV -->
        <dl class="kv">
          <div v-if="localContact.givenName || localContact.surname">
            <dt>Vorname / Nachname</dt>
            <dd>{{ [localContact.givenName, localContact.surname].filter(Boolean).join(' ') }}</dd>
          </div>
          <div v-if="primaryEmail">
            <dt>E-Mail</dt>
            <dd>
              <a :href="`mailto:${primaryEmail}`" class="action-link">
                <font-awesome-icon :icon="['fas', 'envelope']" class="link-icon" />
                {{ primaryEmail }}
              </a>
            </dd>
          </div>
          <div v-if="localContact.mobilePhone">
            <dt>Mobil</dt>
            <dd>
              <a :href="`tel:${localContact.mobilePhone}`" class="action-link">
                <font-awesome-icon :icon="['fas', 'mobile-screen']" class="link-icon" />
                {{ localContact.mobilePhone }}
              </a>
            </dd>
          </div>
          <div v-if="primaryBusinessPhone">
            <dt>Geschäftlich</dt>
            <dd>
              <a :href="`tel:${primaryBusinessPhone}`" class="action-link">
                <font-awesome-icon :icon="['fas', 'phone']" class="link-icon" />
                {{ primaryBusinessPhone }}
              </a>
            </dd>
          </div>
          <div v-if="localContact.jobTitle">
            <dt>Position</dt>
            <dd>{{ localContact.jobTitle }}</dd>
          </div>
          <div v-if="localContact.companyName">
            <dt>Firma</dt>
            <dd>{{ localContact.companyName }}</dd>
          </div>
        </dl>
      </div>

      <!-- ── Body: Edit ─────────────────────────────────────────────── -->
      <div v-else-if="editing" class="card-body edit-body">
        <div class="edit-form">
          <div class="form-row">
            <label>Vorname</label>
            <input v-model="editForm.givenName" class="form-input" placeholder="Vorname" />
          </div>
          <div class="form-row">
            <label>Nachname</label>
            <input v-model="editForm.surname" class="form-input" placeholder="Nachname" />
          </div>
          <div class="form-row">
            <label>E-Mail</label>
            <input v-model="editForm.email" type="email" class="form-input" placeholder="E-Mail" />
          </div>
          <div class="form-row">
            <label>Mobil</label>
            <input v-model="editForm.mobilePhone" class="form-input" placeholder="+49 …" />
          </div>
          <div class="form-row">
            <label>Geschäftlich</label>
            <input v-model="editForm.businessPhone" class="form-input" placeholder="+49 …" />
          </div>
          <div class="form-row">
            <label>Position</label>
            <input v-model="editForm.jobTitle" class="form-input" placeholder="z. B. Geschäftsführer" />
          </div>
          <div class="form-row">
            <label>Firma (companyName)</label>
            <input v-model="editForm.companyName" class="form-input" placeholder="companyName" />
            <span v-if="editLinkedKunde" class="edit-linked-hint">
              <font-awesome-icon :icon="['fas', 'link']" />
              {{ editLinkedKunde.kundName }}
            </span>
          </div>
        </div>
      </div>

      <!-- ── Body: Delete Confirm ───────────────────────────────────── -->
      <div v-else-if="showDeleteConfirm" class="card-body delete-body">
        <div class="delete-confirm-box">
          <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="warn-icon" />
          <p>
            Kontakt <strong>{{ localContact.displayName }}</strong> wirklich löschen?
          </p>
          <p class="warn-sub">Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </div>
      </div>

      <!-- ── Footer ─────────────────────────────────────────────────── -->
      <footer class="card-footer">
        <div class="footer-left">
          <button
            v-if="!editing && !showDeleteConfirm"
            class="btn btn-danger"
            @click="showDeleteConfirm = true"
          >
            <font-awesome-icon :icon="['fas', 'trash']" />
            Löschen
          </button>
          <template v-if="showDeleteConfirm">
            <button class="btn btn-danger" :disabled="deleting" @click="doDelete">
              <font-awesome-icon v-if="deleting" :icon="['fas', 'spinner']" spin />
              Endgültig löschen
            </button>
            <button class="btn btn-secondary" @click="showDeleteConfirm = false">Abbrechen</button>
          </template>
        </div>

        <div class="footer-right">
          <template v-if="editing">
            <button class="btn btn-secondary" @click="cancelEdit">Abbrechen</button>
            <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
              <font-awesome-icon v-if="saving" :icon="['fas', 'spinner']" spin />
              Speichern
            </button>
          </template>
        </div>
      </footer>

    </template>
  </article>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useTheme } from '@/stores/theme';
import { useDataCache } from '@/stores/dataCache';
import api from '@/utils/api';

const props = defineProps({
  /** MS Graph contact object. May be sparse (just id + upn) or fully loaded. */
  contact: { type: Object, required: true },
});

const emit = defineEmits(['close', 'deleted', 'updated', 'open-kunde']);

// ─── Theme ───────────────────────────────────────────────────────────
const theme = useTheme();
const effectiveTheme = computed(() => (theme.isDark ? 'dark' : 'light'));

// ─── Data cache for Kunden matching ──────────────────────────────────
const dataCache = useDataCache();

// ─── Local contact state ─────────────────────────────────────────────
const loading = ref(false);
const localContact = ref({ ...props.contact });

// Resolve UPN from either _upn (Kontakte-tab full contact) or upn (stored in lead's msContact)
const upn = computed(() => localContact.value._upn || localContact.value.upn || props.contact._upn || props.contact.upn || '');

// ─── Derived fields ───────────────────────────────────────────────────
const primaryEmail = computed(() => {
  const c = localContact.value;
  if (Array.isArray(c.emailAddresses) && c.emailAddresses.length > 0) {
    return c.emailAddresses[0].address || '';
  }
  // Fallback: email stored directly (sparse contact from lead)
  return c.email || '';
});

const primaryPhone = computed(() => localContact.value.mobilePhone || primaryBusinessPhone.value || '');
const primaryBusinessPhone = computed(() => (localContact.value.businessPhones || [])[0] || '');

// ─── Avatar ───────────────────────────────────────────────────────────
const initials = computed(() => {
  const name = localContact.value.displayName || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
});

const avatarHue = computed(() => {
  const str = localContact.value.displayName || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
});

const avatarStyle = computed(() => ({
  background: `hsl(${avatarHue.value}, 60%, 42%)`,
}));

// ─── Linked Kunde matching ────────────────────────────────────────────
const linkedKunde = computed(() => {
  const company = (localContact.value.companyName || '').trim();
  if (!company) return null;
  return (dataCache.kunden || []).find(
    (k) => k.kuerzel && k.kuerzel.toLowerCase() === company.toLowerCase()
  ) || null;
});

// ─── Edit state ───────────────────────────────────────────────────────
const editing = ref(false);
const saving = ref(false);
const editForm = reactive({
  givenName: '',
  surname: '',
  email: '',
  mobilePhone: '',
  businessPhone: '',
  jobTitle: '',
  companyName: '',
});

const editLinkedKunde = computed(() => {
  const company = (editForm.companyName || '').trim();
  if (!company) return null;
  return (dataCache.kunden || []).find(
    (k) => k.kuerzel && k.kuerzel.toLowerCase() === company.toLowerCase()
  ) || null;
});

function toggleEdit() {
  if (editing.value) {
    cancelEdit();
  } else {
    startEdit();
  }
}

function startEdit() {
  const c = localContact.value;
  editForm.givenName = c.givenName || '';
  editForm.surname = c.surname || '';
  editForm.email = primaryEmail.value;
  editForm.mobilePhone = c.mobilePhone || '';
  editForm.businessPhone = primaryBusinessPhone.value;
  editForm.jobTitle = c.jobTitle || '';
  editForm.companyName = c.companyName || '';
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
}

async function saveEdit() {
  if (!upn.value || !localContact.value.id) return;
  saving.value = true;
  try {
    const patch = {};
    if (editForm.givenName !== undefined)    patch.givenName   = editForm.givenName;
    if (editForm.surname !== undefined)      patch.surname     = editForm.surname;
    if (editForm.jobTitle !== undefined)     patch.jobTitle    = editForm.jobTitle;
    if (editForm.companyName !== undefined)  patch.companyName = editForm.companyName;
    if (editForm.mobilePhone !== undefined)  patch.mobilePhone = editForm.mobilePhone;
    if (editForm.businessPhone !== undefined) {
      patch.businessPhones = editForm.businessPhone ? [editForm.businessPhone] : [];
    }
    if (editForm.email !== undefined) {
      const displayName = [editForm.givenName, editForm.surname].filter(Boolean).join(' ')
        || localContact.value.displayName || '';
      patch.emailAddresses = editForm.email
        ? [{ address: editForm.email, name: displayName }]
        : [];
    }
    // Rebuild displayName
    const newDisplay = [editForm.givenName, editForm.surname].filter(Boolean).join(' ');
    if (newDisplay) patch.displayName = newDisplay;

    const { data } = await api.patch(
      `/api/graph/contacts/${localContact.value.id}`,
      { upn: upn.value, ...patch }
    );

    const updated = { ...localContact.value, ...data.contact, _upn: upn.value };
    localContact.value = updated;
    editing.value = false;
    emit('updated', updated);
  } catch (e) {
    console.error('Kontakt speichern fehlgeschlagen:', e);
    alert('Fehler beim Speichern des Kontakts.');
  } finally {
    saving.value = false;
  }
}

// ─── Delete state ─────────────────────────────────────────────────────
const showDeleteConfirm = ref(false);
const deleting = ref(false);

async function doDelete() {
  if (!upn.value || !localContact.value.id) return;
  deleting.value = true;
  try {
    await api.delete(`/api/graph/contacts/${localContact.value.id}`, {
      data: { upn: upn.value },
    });
    emit('deleted', localContact.value.id);
    emit('close');
  } catch (e) {
    console.error('Kontakt löschen fehlgeschlagen:', e);
    alert('Fehler beim Löschen des Kontakts.');
  } finally {
    deleting.value = false;
  }
}

// ─── Fetch full contact on mount if sparse ────────────────────────────
onMounted(async () => {
  const c = props.contact;
  // If the contact is already fully loaded (has givenName field present), skip fetch
  if (c.givenName !== undefined || c.surname !== undefined) return;
  // Need at least id and upn to fetch
  const contactId = c.id;
  const contactUpn = c._upn || c.upn;
  if (!contactId || !contactUpn) return;

  loading.value = true;
  try {
    const { data } = await api.get(`/api/graph/contacts/${contactId}?upn=${encodeURIComponent(contactUpn)}`);
    if (data.ok && data.contact) {
      localContact.value = { ...data.contact, _upn: contactUpn };
    }
  } catch (e) {
    console.error('Kontakt laden fehlgeschlagen:', e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="scss">
.contact-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  width: 520px;
  max-width: 100%;
  max-height: 90vh;
}

// ── Header ─────────────────────────────────────────────────────────────
.card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 18px;
  color: #fff;
  flex: 0 0 auto;
  letter-spacing: -0.5px;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.display-name {
  font-weight: 700;
  font-size: 17px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--soft);
  color: var(--muted);

  &--team {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
    font-weight: 600;
    text-transform: capitalize;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--muted);
  font-size: 14px;
  text-decoration: none;
  transition: background 0.14s ease, color 0.14s ease, border-color 0.2s ease;

  &:hover {
    background: var(--soft);
    color: var(--text);
  }

  &.active {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent);
  }
}

// ── Loading ────────────────────────────────────────────────────────────
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--muted);
  font-size: 14px;
  flex: 1;
}

// ── Body ───────────────────────────────────────────────────────────────
.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

// ── MS Section ────────────────────────────────────────────────────────
.ms-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ms-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--soft);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.ms-logo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  width: 22px;
  height: 22px;
  flex-shrink: 0;

  span {
    border-radius: 2px;
    display: block;
  }
}

.ms-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ms-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.ms-upn {
  font-size: 11px;
  color: var(--muted);
  font-family: 'SF Mono', 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.linked-kunde-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
  border-radius: 10px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.14s ease;

  &:hover {
    background: color-mix(in srgb, var(--primary) 18%, transparent);
  }

  .arrow-icon {
    font-size: 11px;
    opacity: 0.7;
    margin-left: auto;
  }
}

// ── KV Details ────────────────────────────────────────────────────────
.kv {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;

  > div {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 10px;
    align-items: start;
  }

  dt {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    padding-top: 2px;
  }

  dd {
    color: var(--text);
    margin: 0;
    word-break: break-word;
  }
}

.action-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--primary);
  text-decoration: none;
  font-size: 13px;
  padding: 3px 8px 3px 4px;
  border-radius: 6px;
  transition: background 0.14s ease;

  &:hover {
    background: color-mix(in srgb, var(--primary) 12%, transparent);
  }

  .link-icon {
    font-size: 12px;
    opacity: 0.75;
  }
}

// ── Edit form ─────────────────────────────────────────────────────────
.edit-body {
  gap: 0;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
}

.form-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.2s;
  -webkit-appearance: none;

  &:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
  }
}

.edit-linked-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--primary);
  margin-top: 4px;
}

// ── Delete confirm ─────────────────────────────────────────────────────
.delete-body {
  justify-content: center;
  align-items: center;
  flex: 1;
}

.delete-confirm-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 24px;
  background: color-mix(in srgb, #dc3545 8%, transparent);
  border: 1px solid color-mix(in srgb, #dc3545 25%, transparent);
  border-radius: 12px;

  .warn-icon {
    font-size: 32px;
    color: #dc3545;
  }

  p {
    margin: 0;
    color: var(--text);
    font-size: 15px;
    line-height: 1.5;
  }

  .warn-sub {
    font-size: 13px;
    color: var(--muted);
  }
}

// ── Footer ─────────────────────────────────────────────────────────────
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.footer-left,
.footer-right {
  display: flex;
  gap: 8px;
}

// ── Buttons ────────────────────────────────────────────────────────────
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;

  &:hover:not(:disabled) {
    background: var(--soft);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &.btn-primary {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--primary) 85%, #000);
      border-color: color-mix(in srgb, var(--primary) 85%, #000);
    }
  }

  &.btn-secondary {
    background: var(--soft);
    border-color: var(--border);
    color: var(--text);
  }

  &.btn-danger {
    background: color-mix(in srgb, #dc3545 12%, transparent);
    border-color: color-mix(in srgb, #dc3545 35%, transparent);
    color: #dc3545;

    &:hover:not(:disabled) {
      background: color-mix(in srgb, #dc3545 20%, transparent);
    }
  }
}

// ── Responsive ─────────────────────────────────────────────────────────
@media (max-width: 560px) {
  .contact-card {
    width: 100%;
    border-radius: 16px 16px 0 0;
    max-height: 95vh;
  }

  .kv > div {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
