<template>
  <section class="um">
    <header class="um__head">
      <h1>Benutzer<span>verwaltung</span></h1>
      <button class="btn btn-primary" @click="openCreate">
        <font-awesome-icon icon="fa-solid fa-plus" />
        Neuer Benutzer
      </button>
    </header>

    <!-- Fehlermeldung -->
    <div v-if="error" class="um__error">{{ error }}</div>

    <!-- Tabelle -->
    <div class="um__table-wrap">
      <table class="um__table" v-if="!loading">
        <thead>
          <tr>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Standort</th>
            <th>Mitarbeiter</th>
            <th>Rolle</th>
            <th>Bestätigt</th>
            <th>Registriert</th>
            <th class="th-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u._id" :class="{ 'row--self': u._id === currentUserId }">
            <td>{{ u.name || '—' }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.location || '—' }}</td>
            <td>
              <span v-if="u.mitarbeiter" class="ma-link-tag">
                <font-awesome-icon icon="fa-solid fa-user-tie" />
                {{ u.mitarbeiter.vorname }} {{ u.mitarbeiter.nachname }}
                <span v-if="u.mitarbeiter.personalnr" class="ma-link-nr">#{{ u.mitarbeiter.personalnr }}</span>
              </span>
              <span v-else class="ma-unlinked">—</span>
            </td>
            <td>
              <div class="badge-list">
                <span
                  v-for="r in (u.roles?.length ? u.roles : [u.role || 'USER'])"
                  :key="r"
                  class="badge"
                  :class="r === 'ADMIN' ? 'badge--admin' : r === 'VERTRIEB' ? 'badge--vertrieb' : 'badge--user'"
                >
                  {{ r }}
                </span>
              </div>
            </td>
            <td>
              <span class="status" :class="u.isConfirmed ? 'status--ok' : 'status--no'">
                {{ u.isConfirmed ? 'Ja' : 'Nein' }}
              </span>
            </td>
            <td>{{ formatDate(u.date) }}</td>
            <td class="td-actions">
              <button class="btn-icon" title="Bearbeiten" @click="openEdit(u)">
                <font-awesome-icon icon="fa-solid fa-pen" />
              </button>
              <button
                class="btn-icon btn-icon--link"
                :title="u.mitarbeiter ? 'Mitarbeiter-Verknüpfung bearbeiten' : 'Mit Mitarbeiter verknüpfen'"
                @click="openLink(u)"
              >
                <font-awesome-icon :icon="u.mitarbeiter ? 'fa-solid fa-link' : 'fa-solid fa-link'" />
              </button>
              <button
                class="btn-icon btn-icon--danger"
                title="Löschen"
                :disabled="u._id === currentUserId"
                @click="openDelete(u)"
              >
                <font-awesome-icon icon="fa-solid fa-trash" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="um__loading">
        <font-awesome-icon icon="fa-solid fa-spinner" spin />
        Wird geladen…
      </div>
    </div>

    <!-- Edit / Create Modal -->
    <div v-if="editModal.open" class="modal-backdrop" @click.self="closeEdit">
      <div class="modal-content">
        <header class="modal-header">
          <h3>{{ editModal.isNew ? 'Neuen Benutzer anlegen' : 'Benutzer bearbeiten' }}</h3>
          <button class="close-btn" @click="closeEdit">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </header>

        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Name</label>
              <input v-model="editModal.form.name" type="text" placeholder="Max Mustermann" />
            </div>
            <div class="form-group">
              <label>Standort</label>
              <input v-model="editModal.form.location" type="text" placeholder="Hamburg" />
            </div>
          </div>

          <div class="form-group">
            <label>E-Mail <span class="required">*</span></label>
            <input v-model="editModal.form.email" type="email" placeholder="name@straightforward.email" />
          </div>

          <div class="form-group">
            <label>
              Passwort
              <span v-if="!editModal.isNew" class="hint">(leer lassen = nicht ändern)</span>
              <span v-else class="required">*</span>
            </label>
            <input v-model="editModal.form.password" type="password" placeholder="Neues Passwort" autocomplete="new-password" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Rollen</label>
              <div class="roles-checkboxes">
                <label v-for="r in AVAILABLE_ROLES" :key="r.value" class="role-checkbox-label">
                  <input type="checkbox" :value="r.value" v-model="editModal.form.roles" />
                  <span>{{ r.label }}</span>
                </label>
              </div>
            </div>
            <div class="form-group form-group--checkbox">
              <label class="checkbox-label">
                <input type="checkbox" v-model="editModal.form.isConfirmed" />
                <span>E-Mail bestätigt</span>
              </label>
            </div>
          </div>

          <div v-if="editModal.error" class="modal-error">{{ editModal.error }}</div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-ghost" @click="closeEdit">Abbrechen</button>
          <button class="btn btn-primary" @click="saveUser" :disabled="editModal.saving">
            <font-awesome-icon
              :icon="editModal.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'"
              :class="{ 'fa-spin': editModal.saving }"
            />
            {{ editModal.isNew ? 'Anlegen' : 'Speichern' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- MB Verknüpfen Modal -->
    <div v-if="linkModal.open" class="modal-backdrop" @click.self="closeLink">
      <div class="modal-content modal-content--sm">
        <header class="modal-header">
          <h3>Mit Mitarbeiter verknüpfen</h3>
          <button class="close-btn" @click="closeLink">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </header>

        <div class="modal-body">
          <!-- Current link -->
          <div v-if="linkModal.mitarbeiterObj" class="current-link">
            <span class="current-link__label">Aktuell verknüpft:</span>
            <span class="current-link__name">
              <font-awesome-icon icon="fa-solid fa-user-tie" />
              {{ linkModal.mitarbeiterObj.vorname }} {{ linkModal.mitarbeiterObj.nachname }}
              <span v-if="linkModal.mitarbeiterObj.personalnr" class="ma-link-nr">#{{ linkModal.mitarbeiterObj.personalnr }}</span>
            </span>
            <button class="btn-unlink" @click="clearLink" title="Verknüpfung entfernen">
              <font-awesome-icon icon="fa-solid fa-unlink" />
              Entfernen
            </button>
          </div>
          <p v-else class="hint-text">Kein Mitarbeiter verknüpft.</p>

          <div class="form-group">
            <label>{{ linkModal.mitarbeiterObj ? 'Neuen Mitarbeiter auswählen' : 'Mitarbeiter suchen' }}</label>
            <MitarbeiterSearch
              :key="linkModal.searchKey"
              :modelValue="null"
              @select="onLinkSelect"
              :dropup="false"
            />
          </div>

          <div v-if="linkModal.error" class="modal-error">{{ linkModal.error }}</div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-ghost" @click="closeLink">Abbrechen</button>
          <button class="btn btn-primary" @click="saveLink" :disabled="linkModal.saving">
            <font-awesome-icon
              :icon="linkModal.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'"
              :class="{ 'fa-spin': linkModal.saving }"
            />
            Speichern
          </button>
        </footer>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteModal.open" class="modal-backdrop" @click.self="closeDelete">
      <div class="modal-content modal-content--sm">
        <header class="modal-header">
          <h3>Benutzer löschen</h3>
          <button class="close-btn" @click="closeDelete">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </header>

        <div class="modal-body">
          <p class="warning-text">
            Möchtest du den Benutzer <strong>{{ deleteModal.user?.name || deleteModal.user?.email }}</strong> wirklich löschen?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div v-if="deleteModal.error" class="modal-error">{{ deleteModal.error }}</div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-ghost" @click="closeDelete">Abbrechen</button>
          <button class="btn btn-danger" @click="confirmDelete" :disabled="deleteModal.deleting">
            <font-awesome-icon
              :icon="deleteModal.deleting ? 'fa-solid fa-spinner' : 'fa-solid fa-trash'"
              :class="{ 'fa-spin': deleteModal.deleting }"
            />
            Löschen
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';

const AVAILABLE_ROLES = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'VERTRIEB', label: 'VERTRIEB' },
];

const auth = useAuth();
const currentUserId = computed(() => auth.user?._id || auth.user?.id);

const users = ref([]);
const loading = ref(true);
const error = ref('');

// ─── Edit / Create Modal ────────────────────────────────────────────────────
const editModal = reactive({
  open: false,
  isNew: false,
  saving: false,
  error: '',
  userId: null,
  form: {
    name: '',
    email: '',
    password: '',
    location: '',
    roles: ['USER'],
    isConfirmed: true,
  },
});

// ─── Delete Modal ───────────────────────────────────────────────────────────
const deleteModal = reactive({
  open: false,
  deleting: false,
  error: '',
  user: null,
});

// ─── Link Modal ─────────────────────────────────────────────────────────────
const linkModal = reactive({
  open: false,
  saving: false,
  error: '',
  userId: null,
  searchKey: 0,
  mitarbeiterId: null,
  mitarbeiterObj: null,
});

// ─── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(fetchUsers);

async function fetchUsers() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get('/api/users/admin/all');
    users.value = res.data;
  } catch (e) {
    error.value = e?.response?.data?.msg || 'Fehler beim Laden der Benutzer.';
  } finally {
    loading.value = false;
  }
}

// ─── Edit / Create ──────────────────────────────────────────────────────────
function openCreate() {
  Object.assign(editModal, {
    open: true,
    isNew: true,
    saving: false,
    error: '',
    userId: null,
    form: { name: '', email: '', password: '', location: '', roles: ['USER'], isConfirmed: true },
  });
}

function openEdit(u) {
  Object.assign(editModal, {
    open: true,
    isNew: false,
    saving: false,
    error: '',
    userId: u._id,
    form: {
      name: u.name || '',
      email: u.email || '',
      password: '',
      location: u.location || '',
      roles: u.roles?.length ? [...u.roles] : [u.role || 'USER'],
      isConfirmed: !!u.isConfirmed,
    },
  });
}

function closeEdit() {
  editModal.open = false;
}

async function saveUser() {
  editModal.error = '';
  if (!editModal.form.email) { editModal.error = 'E-Mail ist erforderlich.'; return; }
  if (editModal.isNew && !editModal.form.password) { editModal.error = 'Passwort ist erforderlich.'; return; }

  editModal.saving = true;
  try {
    const payload = { ...editModal.form };
    if (!payload.password) delete payload.password;
    if (!payload.roles?.length) payload.roles = ['USER'];

    if (editModal.isNew) {
      const res = await api.post('/api/users/admin/create', payload);
      users.value.unshift(res.data);
    } else {
      const res = await api.put(`/api/users/admin/${editModal.userId}`, payload);
      const idx = users.value.findIndex(u => u._id === editModal.userId);
      if (idx !== -1) users.value[idx] = res.data;
    }
    closeEdit();
  } catch (e) {
    editModal.error = e?.response?.data?.msg || 'Fehler beim Speichern.';
  } finally {
    editModal.saving = false;
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────
function openDelete(u) {
  Object.assign(deleteModal, { open: true, deleting: false, error: '', user: u });
}

function closeDelete() {
  deleteModal.open = false;
}

async function confirmDelete() {
  deleteModal.error = '';
  deleteModal.deleting = true;
  try {
    await api.delete(`/api/users/admin/${deleteModal.user._id}`);
    users.value = users.value.filter(u => u._id !== deleteModal.user._id);
    closeDelete();
  } catch (e) {
    deleteModal.error = e?.response?.data?.msg || 'Fehler beim Löschen.';
  } finally {
    deleteModal.deleting = false;
  }
}

// ─── Link (MB Verknüpfen) ────────────────────────────────────────────────────
function openLink(u) {
  Object.assign(linkModal, {
    open: true,
    saving: false,
    error: '',
    userId: u._id,
    searchKey: linkModal.searchKey + 1,
    mitarbeiterId: u.mitarbeiter?._id || null,
    mitarbeiterObj: u.mitarbeiter || null,
  });
}

function closeLink() {
  linkModal.open = false;
}

function onLinkSelect(ma) {
  if (!ma) return;
  linkModal.mitarbeiterId = ma._id;
  linkModal.mitarbeiterObj = ma;
}

function clearLink() {
  linkModal.mitarbeiterId = null;
  linkModal.mitarbeiterObj = null;
  linkModal.searchKey++;
}

async function saveLink() {
  linkModal.error = '';
  linkModal.saving = true;
  try {
    const res = await api.put(`/api/users/admin/${linkModal.userId}/mitarbeiter`, {
      mitarbeiterId: linkModal.mitarbeiterId || null,
    });
    const idx = users.value.findIndex(u => u._id === linkModal.userId);
    if (idx !== -1) users.value[idx] = res.data;
    closeLink();
  } catch (e) {
    linkModal.error = e?.response?.data?.msg || 'Fehler beim Speichern.';
  } finally {
    linkModal.saving = false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.um {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
  color: var(--text);
}

.um__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 12px;
  flex-wrap: wrap;

  h1 {
    font-size: 1.7rem;
    font-weight: 700;
    margin: 0;
    span { color: var(--primary); }
  }
}

.um__error {
  background: rgba(220, 53, 69, 0.12);
  border: 1px solid rgba(220, 53, 69, 0.4);
  color: #dc3545;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.um__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 32px;
  opacity: 0.6;
}

.um__table-wrap {
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: auto;
}

.um__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;

  thead {
    background: var(--tile-bg);
    th {
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      color: var(--text-muted, var(--text));
      opacity: 0.75;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
    }
  }

  tbody {
    tr {
      transition: background 0.15s;
      border-bottom: 1px solid var(--border);

      &:last-child { border-bottom: none; }
      &:hover { background: var(--hover); }
      &.row--self { background: rgba(var(--primary-rgb, 255, 120, 0), 0.06); }
    }

    td {
      padding: 10px 14px;
      vertical-align: middle;
    }
  }
}

.th-actions,
.td-actions {
  text-align: right;
  white-space: nowrap;
}

.td-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

// Badges
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 600;

  &--admin {
    background: rgba(var(--primary-rgb, 255, 120, 0), 0.15);
    color: var(--primary);
    border: 1px solid var(--primary);
  }

  &--vertrieb {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
    border: 1px solid #3b82f6;
  }

  &--user {
    background: var(--tile-bg);
    color: var(--text);
    border: 1px solid var(--border);
  }
}

.status {
  font-size: 0.8rem;
  font-weight: 500;

  &--ok { color: #28a745; }
  &--no { color: #dc3545; }
}

// Action Icon Buttons
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover { background: var(--hover); border-color: var(--primary); color: var(--primary); }

  &--danger {
    &:hover { border-color: #dc3545; color: #dc3545; background: rgba(220, 53, 69, 0.08); }
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    &:hover { background: var(--tile-bg); border-color: var(--border); color: var(--text); }
  }
}

// Buttons
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &-primary {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
    &:hover:not(:disabled) { filter: brightness(1.1); }
  }

  &-ghost {
    background: transparent;
    color: var(--text);
    border-color: var(--border);
    &:hover:not(:disabled) { background: var(--hover); }
  }

  &-danger {
    background: #dc3545;
    color: #fff;
    border-color: #dc3545;
    &:hover:not(:disabled) { background: color.adjust(#dc3545, $lightness: -8%); }
  }
}

// Modal
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background: var(--surface, var(--tile-bg));
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: auto;

  &--sm { max-width: 400px; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);

  h3 { margin: 0; font-size: 1rem; font-weight: 600; }
}

.close-btn {
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s;
  &:hover { opacity: 1; background: var(--hover); }
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-footer {
  padding: 12px 20px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border);
}

.modal-error {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.35);
  color: #dc3545;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
}

// Form
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 480px) { grid-template-columns: 1fr; }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 0.8rem;
    font-weight: 500;
    opacity: 0.75;
  }

  input, select {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--tile-bg);
    color: var(--text);
    font-size: 0.875rem;
    transition: border-color 0.15s;
    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }

  &--checkbox {
    justify-content: flex-end;
  }
}

.badge-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

// Role checkboxes in modal
.roles-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.role-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--primary); }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
}

.required { color: #dc3545; margin-left: 2px; }
.hint { color: var(--text); opacity: 0.5; font-size: 0.75rem; margin-left: 4px; font-weight: 400; }

.warning-text {
  margin: 0;
  line-height: 1.6;
  font-size: 0.9rem;
}

// Mitarbeiter link display in table
.ma-link-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: var(--text);
  svg { opacity: 0.5; font-size: 0.75rem; }
}

.ma-link-nr {
  font-size: 0.72rem;
  opacity: 0.55;
  margin-left: 2px;
}

.ma-unlinked {
  opacity: 0.35;
}

// link modal styles
.btn-icon--link {
  &:hover { border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.08); }
}

.current-link {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.875rem;

  &__label { opacity: 0.6; white-space: nowrap; }
  &__name {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 500;
    flex: 1;
  }
}

.btn-unlink {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(220, 53, 69, 0.08);
  border: 1px solid rgba(220, 53, 69, 0.35);
  color: #dc3545;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  margin-left: auto;
  &:hover { background: rgba(220, 53, 69, 0.15); }
}

.hint-text {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.55;
}
</style>
