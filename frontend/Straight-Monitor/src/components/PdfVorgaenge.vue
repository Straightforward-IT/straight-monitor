<template>
  <div class="window">
    <div class="page-header">
      <div class="header-left">
        <button class="btn-back" @click="$router.push('/pdf-vorlagen')">
          <font-awesome-icon :icon="['fas', 'arrow-left']" /> Vorlagen
        </button>
        <div>
          <h1><font-awesome-icon :icon="['fas', 'layer-group']" /> Vorgänge</h1>
          <p v-if="template" class="header-sub">Vorlage: {{ template.name }}</p>
        </div>
      </div>
      <div class="header-stats" v-if="vorgaenge.length > 0">
        <span class="stat-chip stat-offen">{{ offenCount }} Offen</span>
        <span class="stat-chip stat-bereit">{{ bereitCount }} Bereit</span>
      </div>
      <button class="btn-primary" @click="openCreateDialog">
        <font-awesome-icon :icon="['fas', 'plus']" /> Neuer Vorgang
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
      <p>Lade Vorgänge…</p>
    </div>

    <!-- Empty -->
    <div v-else-if="vorgaenge.length === 0" class="empty-state">
      <font-awesome-icon :icon="['fas', 'layer-group']" size="2x" />
      <p>Noch keine Vorgänge erstellt.</p>
      <p class="hint-text">Klicke auf "Neuer Vorgang" um aus der aktuellen Vorlage einen neuen Vorgang zu erstellen.</p>
    </div>

    <!-- Table -->
    <div v-else class="table-wrapper">
      <table class="vorgaenge-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Mitarbeiter</th>
            <th>Status</th>
            <th>Erstellt</th>
            <th class="th-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vorgaenge" :key="v._id" :class="{ 'row-bereit': v.status === 'bereit' }">
            <td class="td-name">
              {{ v.name }}
              <span
                v-if="isStale(v)"
                class="version-badge"
                :title="`Vorlage wurde nach Erstellung dieses Vorgangs geändert (Vorgang v${v.templateVersion || 1} → Vorlage v${template?.version ?? '?'})`"
              >
                <font-awesome-icon :icon="['fas', 'triangle-exclamation']" /> ältere Vorlage
              </span>
            </td>
            <td class="td-ma">
              <span v-if="v.mitarbeiterName" class="ma-name">{{ v.mitarbeiterName }}</span>
              <span v-if="v.mitarbeiterEmail" class="ma-email">{{ v.mitarbeiterEmail }}</span>
              <span v-if="!v.mitarbeiterEmail && !v.mitarbeiterName" class="text-muted">—</span>
            </td>
            <td class="td-status">
              <span class="status-badge" :class="`status-${v.status}`">
                <font-awesome-icon :icon="v.status === 'bereit' ? ['fas', 'circle-check'] : ['fas', 'clock']" />
                {{ v.status === 'bereit' ? 'Bereit' : 'Offen' }}
              </span>
            </td>
            <td class="td-date">{{ formatDate(v.createdAt) }}</td>
            <td class="td-actions">
              <button class="btn-icon-sm" title="Bediener-Felder ausfüllen" @click="openFillDialog(v)">
                <font-awesome-icon :icon="['fas', 'pen-to-square']" />
              </button>
              <button
                class="btn-icon-sm"
                title="Mitarbeiter-Link kopieren"
                :disabled="!v.mitarbeiterEmail"
                @click="copyFormLink(v)"
              >
                <font-awesome-icon :icon="['fas', 'link']" />
              </button>
              <button
                class="btn-icon-sm"
                title="E-Mail an Mitarbeiter senden"
                :disabled="!v.mitarbeiterEmail"
                @click="sendEmail(v)"
              >
                <font-awesome-icon :icon="['fas', 'envelope']" />
              </button>
              <button
                class="btn-icon-sm btn-download"
                title="PDF herunterladen"
                @click="downloadPdf(v)"
              >
                <font-awesome-icon :icon="['fas', 'download']" />
              </button>
              <button class="btn-icon-sm btn-danger" title="Löschen" @click="deleteVorgang(v)">
                <font-awesome-icon :icon="['fas', 'trash']" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ══ CREATE DIALOG ════════════════════════════════════════════════ -->
    <div v-if="createDialog.visible" class="modal-overlay" @click.self="createDialog.visible = false">
      <div class="modal-box">
        <h2><font-awesome-icon :icon="['fas', 'plus']" /> Neuer Vorgang</h2>
        <div class="modal-fields">
          <label>Name <span class="required">*</span></label>
          <input v-model="createDialog.name" class="form-input" placeholder="z.B. Arbeitsvertrag Max Mustermann" />
          <label>Mitarbeiter E-Mail</label>
          <input v-model="createDialog.mitarbeiterEmail" type="email" class="form-input" placeholder="mitarbeiter@example.com" />
          <label>Mitarbeiter Name</label>
          <input v-model="createDialog.mitarbeiterName" class="form-input" placeholder="(optional)" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="createDialog.visible = false">Abbrechen</button>
          <button class="btn-primary" :disabled="!createDialog.name.trim() || creating" @click="confirmCreate">
            <font-awesome-icon v-if="creating" :icon="['fas', 'spinner']" spin />
            Erstellen
          </button>
        </div>
      </div>
    </div>

    <!-- ══ FILL DIALOG (operator values) ════════════════════════════════ -->
    <div v-if="fillDialog.visible" class="modal-overlay" @click.self="fillDialog.visible = false">
      <div class="modal-box modal-box-wide">
        <h2><font-awesome-icon :icon="['fas', 'pen-to-square']" /> {{ fillDialog.vorgang?.name }}</h2>
        <p class="modal-hint">Fülle hier die <strong>Bediener-Felder</strong> aus. Mitarbeiter-Felder werden vom Mitarbeiter ausgefüllt.</p>
        <div v-if="fillDialog.vorgang && isStale(fillDialog.vorgang)" class="stale-warning">
          <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
          Dieser Vorgang basiert auf einer älteren Version der Vorlage (v{{ fillDialog.vorgang.templateVersion || 1 }}).
          Die aktuellen Felder der Vorlage (v{{ template?.version ?? '?' }}) sind hier nicht sichtbar — der Vorgang behält seinen ursprünglichen Stand.
        </div>

        <div v-if="fillDialog.bedienerBookmarks.length === 0" class="no-fields-hint">
          <font-awesome-icon :icon="['fas', 'info-circle']" />
          Keine Bediener-Felder in dieser Vorlage.
        </div>

        <div v-else class="fill-form">
          <div v-for="bm in fillDialog.bedienerBookmarks" :key="bm.id" class="fill-row">
            <label :for="`fill-${bm.id}`">
              <font-awesome-icon :icon="bookmarkIcon(bm.dataType)" class="fill-icon" />
              {{ bm.label }}
            </label>
            <div v-if="bm.dataType === 'checkbox'" class="checkbox-wrapper">
              <input :id="`fill-${bm.id}`" v-model="fillDialog.values[bm.id]" type="checkbox" class="form-checkbox" />
              <span>{{ fillDialog.values[bm.id] ? 'Ja / Angekreuzt' : 'Nein / Leer' }}</span>
            </div>
            <div v-else-if="bm.dataType === 'checkbox-group-single'" class="group-options">
              <label
                v-for="opt in (bm.options || [])"
                :key="opt"
                class="group-option"
              >
                <input
                  type="radio"
                  :name="`group-${bm.id}`"
                  :value="opt"
                  v-model="fillDialog.values[bm.id]"
                  class="form-radio"
                />
                <span>{{ opt }}</span>
              </label>
            </div>
            <div v-else-if="bm.dataType === 'checkbox-group-multi'" class="group-options">
              <label
                v-for="opt in (bm.options || [])"
                :key="opt"
                class="group-option"
              >
                <input
                  type="checkbox"
                  :value="opt"
                  v-model="fillDialog.values[bm.id]"
                  class="form-checkbox"
                />
                <span>{{ opt }}</span>
              </label>
            </div>
            <input
              v-else-if="bm.dataType === 'date'"
              :id="`fill-${bm.id}`"
              v-model="fillDialog.values[bm.id]"
              type="date"
              class="form-input"
            />
            <input
              v-else
              :id="`fill-${bm.id}`"
              v-model="fillDialog.values[bm.id]"
              type="text"
              class="form-input"
              :placeholder="bm.defaultValue || bm.label"
            />
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="fillDialog.visible = false">Schließen</button>
          <button class="btn-primary" :disabled="fillSaving" @click="saveFill">
            <font-awesome-icon v-if="fillSaving" :icon="['fas', 'spinner']" spin />
            Speichern
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/api';

const route  = useRoute();
const router = useRouter();
const token  = localStorage.getItem('token');
const headers = { 'x-auth-token': token };

// ── State ─────────────────────────────────────────────────────────────────
const loading   = ref(false);
const creating  = ref(false);
const fillSaving = ref(false);
const template  = ref(null);
const vorgaenge = ref([]);
const createDialog = ref({ visible: false, name: '', mitarbeiterEmail: '', mitarbeiterName: '' });
const fillDialog   = ref({ visible: false, vorgang: null, bedienerBookmarks: [], values: {} });

// ── Computed ──────────────────────────────────────────────────────────────
const offenCount  = computed(() => vorgaenge.value.filter(v => v.status === 'offen').length);
const bereitCount = computed(() => vorgaenge.value.filter(v => v.status === 'bereit').length);
const templateId  = computed(() => route.query.templateId ?? null);

function isStale(v) {
  if (!template.value) return false;
  const tv = v.templateVersion ?? 1;
  const lv = template.value.version ?? 1;
  return tv < lv;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function bookmarkIcon(dataType) {
  const map = {
    text: ['fas', 'font'], date: ['fas', 'calendar'], checkbox: ['fas', 'check'],
    'checkbox-group-single': ['fas', 'circle-dot'],
    'checkbox-group-multi': ['fas', 'list-check'],
  };
  return map[dataType] || ['fas', 'font'];
}

// ── API ───────────────────────────────────────────────────────────────────
async function fetchData() {
  loading.value = true;
  try {
    const [vRes, tRes] = await Promise.all([
      api.get('/api/pdf-vorgaenge', { headers, params: templateId.value ? { templateId: templateId.value } : {} }),
      templateId.value
        ? api.get(`/api/pdf-templates/${templateId.value}`, { headers })
        : Promise.resolve(null),
    ]);
    vorgaenge.value = vRes.data;
    template.value  = tRes?.data ?? null;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  createDialog.value = { visible: true, name: '', mitarbeiterEmail: '', mitarbeiterName: '' };
}

async function confirmCreate() {
  if (!createDialog.value.name.trim() || creating.value) return;
  if (!templateId.value) {
    alert('Keine Vorlage ausgewählt. Bitte über eine Vorlage navigieren.');
    return;
  }
  creating.value = true;
  try {
    const res = await api.post('/api/pdf-vorgaenge', {
      templateId:        templateId.value,
      name:              createDialog.value.name.trim(),
      mitarbeiterEmail:  createDialog.value.mitarbeiterEmail,
      mitarbeiterName:   createDialog.value.mitarbeiterName,
    }, { headers });
    vorgaenge.value.unshift(res.data);
    createDialog.value.visible = false;
  } finally {
    creating.value = false;
  }
}

async function deleteVorgang(v) {
  if (!confirm(`Vorgang "${v.name}" wirklich löschen?`)) return;
  await api.delete(`/api/pdf-vorgaenge/${v._id}`, { headers });
  vorgaenge.value = vorgaenge.value.filter(x => x._id !== v._id);
}

async function openFillDialog(v) {
  // Always use the snapshotted bookmarks stored on the Vorgang.
  // This ensures the operator fills exactly the fields that existed at creation time.
  // Fall back to live template only for Vorgänge that pre-date versioning.
  let bedienerBookmarks = [];
  if (v.snapshotBookmarks && v.snapshotBookmarks.length > 0) {
    bedienerBookmarks = v.snapshotBookmarks.filter(b => b.fillRole === 'bediener');
  } else if (template.value) {
    bedienerBookmarks = template.value.bookmarks?.filter(b => b.fillRole === 'bediener') ?? [];
  } else if (v.templateId) {
    try {
      const res = await api.get(`/api/pdf-templates/${v.templateId}`, { headers });
      bedienerBookmarks = res.data.bookmarks?.filter(b => b.fillRole === 'bediener') ?? [];
    } catch {}
  }

  // Initialize values from existing operatorValues
  const values = {};
  for (const bm of bedienerBookmarks) {
    const existing = v.operatorValues?.[bm.id];
    if (bm.dataType === 'checkbox') {
      values[bm.id] = existing === 'true' || existing === true || existing === '1';
    } else if (bm.dataType === 'checkbox-group-multi') {
      values[bm.id] = existing ? existing.split(',') : [];
    } else if (bm.dataType === 'checkbox-group-single') {
      values[bm.id] = existing || '';
    } else {
      values[bm.id] = existing ?? (bm.defaultValue || '');
    }
  }

  fillDialog.value = { visible: true, vorgang: v, bedienerBookmarks, values };
}

async function saveFill() {
  if (fillSaving.value || !fillDialog.value.vorgang) return;
  fillSaving.value = true;
  try {
    const operatorValues = {};
    for (const bm of fillDialog.value.bedienerBookmarks) {
      const raw = fillDialog.value.values[bm.id];
      if (bm.dataType === 'checkbox') {
        operatorValues[bm.id] = raw ? 'true' : 'false';
      } else if (bm.dataType === 'checkbox-group-multi') {
        operatorValues[bm.id] = Array.isArray(raw) ? raw.join(',') : (raw || '');
      } else if (bm.dataType === 'checkbox-group-single') {
        operatorValues[bm.id] = raw || '';
      } else if (bm.dataType === 'date' && raw) {
        const d = new Date(raw);
        operatorValues[bm.id] = isNaN(d) ? raw : d.toLocaleDateString('de-DE');
      } else {
        operatorValues[bm.id] = raw || '';
      }
    }
    const res = await api.put(`/api/pdf-vorgaenge/${fillDialog.value.vorgang._id}`, { operatorValues }, { headers });
    // Update local list
    const idx = vorgaenge.value.findIndex(v => v._id === res.data._id);
    if (idx !== -1) vorgaenge.value[idx] = res.data;
    fillDialog.value.visible = false;
  } finally {
    fillSaving.value = false;
  }
}

async function copyFormLink(v) {
  try {
    const res = await api.get(`/api/pdf-vorgaenge/${v._id}/formlink`, { headers });
    await navigator.clipboard.writeText(res.data.formUrl);
    alert('Link kopiert:\n' + res.data.formUrl);
  } catch (e) {
    alert('Fehler beim Kopieren: ' + e.message);
  }
}

async function sendEmail(v) {
  try {
    const res = await api.post(`/api/pdf-vorgaenge/${v._id}/send-email`, {}, { headers });
    alert(res.data.message + '\n\nLink: ' + res.data.formUrl);
  } catch (e) {
    alert('Fehler: ' + (e.response?.data?.message || e.message));
  }
}

async function downloadPdf(v) {
  try {
    const res = await api.get(`/api/pdf-vorgaenge/${v._id}/download`, { headers, responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${v.name.replace(/[^a-z0-9_\-]/gi, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Fehler beim Herunterladen: ' + (e.response?.data?.message || e.message));
  }
}

onMounted(fetchData);
</script>

<style scoped lang="scss">
.window { padding: 24px; max-width: 1200px; }

.page-header {
  display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
}
.header-left {
  display: flex; align-items: flex-start; gap: 12px; flex: 1;
  h1 { font-size: 1.4rem; margin: 0; display: flex; align-items: center; gap: 10px; }
  .header-sub { font-size: 13px; color: var(--text-muted); margin: 2px 0 0; }
}
.header-stats { display: flex; align-items: center; gap: 8px; align-self: center; }
.stat-chip {
  font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
  &.stat-offen  { background: rgba(255,140,0,.15); color: var(--primary); }
  &.stat-bereit { background: rgba(34,197,94,.15); color: #16a34a; }
}

.loading-state, .empty-state {
  text-align: center; padding: 60px 20px; color: var(--text-muted);
  display: flex; flex-direction: column; align-items: center; gap: 12px; font-size: 14px;
}
.hint-text { font-size: 13px; color: var(--text-muted); max-width: 400px; text-align: center; }

/* ── Table ────────────────────────────────────────────────────────────── */
.table-wrapper {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
}
.vorgaenge-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
  th, td { padding: 10px 14px; text-align: left; }
  th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
       color: var(--text-muted); border-bottom: 1px solid var(--border); background: var(--bg); }
  tbody tr { border-bottom: 1px solid var(--border); transition: background 120ms;
    &:last-child { border-bottom: none; }
    &:hover { background: var(--bg); }
    &.row-bereit { background: rgba(34,197,94,.04); }
  }
  .th-actions { text-align: right; }
}
.td-name { font-weight: 500; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.version-badge {
  display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 4px; background: rgba(234,179,8,.15); color: #92400e;
  border: 1px solid rgba(234,179,8,.35); cursor: default;
  [data-theme='dark'] & { background: rgba(234,179,8,.12); color: #fbbf24; border-color: rgba(234,179,8,.25); }
}
.stale-warning {
  display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.5;
  padding: 10px 12px; border-radius: 6px; margin-bottom: 12px;
  background: rgba(234,179,8,.12); color: #92400e; border: 1px solid rgba(234,179,8,.3);
  [data-theme='dark'] & { background: rgba(234,179,8,.1); color: #fbbf24; border-color: rgba(234,179,8,.25); }
  svg { flex-shrink: 0; margin-top: 2px; }
}
.td-ma { display: flex; flex-direction: column; gap: 2px; }
.ma-name  { font-weight: 500; }
.ma-email { font-size: 11px; color: var(--text-muted); }
.text-muted { color: var(--text-muted); }
.td-date { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.td-actions { text-align: right; display: flex; gap: 4px; justify-content: flex-end; }
.td-status { white-space: nowrap; }
.status-badge {
  display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600;
  padding: 3px 8px; border-radius: 20px;
  &.status-offen  { background: rgba(255,140,0,.15); color: var(--primary); }
  &.status-bereit { background: rgba(34,197,94,.15); color: #16a34a; }
}

/* ── Modal ────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0; background: var(--overlay); z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: var(--modal-bg); border: 1px solid var(--border); border-radius: 12px;
  padding: 28px; width: 440px; max-width: 95vw;
  h2 { font-size: 1.1rem; margin: 0 0 20px; display: flex; align-items: center; gap: 8px; }
  &.modal-box-wide { width: 560px; }
}
.modal-hint { font-size: 13px; color: var(--text-muted); margin: -10px 0 18px; }
.modal-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.modal-fields label { font-size: 12px; font-weight: 500; color: var(--text-muted); }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
.required { color: var(--primary); }

.fill-form { display: flex; flex-direction: column; gap: 12px; max-height: 55vh; overflow-y: auto; padding-right: 4px; }
.fill-row {
  display: flex; flex-direction: column; gap: 5px;
  label { font-size: 12px; font-weight: 500; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
}
.fill-icon { width: 12px; flex-shrink: 0; }
.checkbox-wrapper {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px; font-size: 13px;
}
.form-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
.form-radio { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
.group-options {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 10px; background: var(--bg);
  border: 1px solid var(--border); border-radius: 6px;
}
.group-option {
  display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;
}
.no-fields-hint {
  font-size: 13px; color: var(--text-muted); display: flex; gap: 8px;
  align-items: flex-start; padding: 12px; background: var(--bg); border-radius: 6px;
}

/* ── Shared ──────────────────────────────────────────────────────────── */
.form-input {
  border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
  background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit;
  &:focus { outline: none; border-color: var(--primary); }
}
.btn-primary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: var(--primary); color: #fff; border: none; border-radius: 6px;
  font-size: 13px; cursor: pointer; font-family: inherit;
  &:hover { opacity: .85; } &:disabled { opacity: .5; cursor: not-allowed; }
}
.btn-secondary {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  background: transparent; color: var(--text); border: 1px solid var(--border);
  border-radius: 6px; font-size: 13px; cursor: pointer; font-family: inherit;
  &:hover { border-color: var(--text); }
}
.btn-back {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; flex-shrink: 0;
  background: transparent; color: var(--text-muted); border: 1px solid var(--border);
  border-radius: 6px; font-size: 13px; cursor: pointer; font-family: inherit;
  &:hover { color: var(--text); border-color: var(--text); }
}
.btn-icon-sm {
  background: transparent; border: 1px solid var(--border); border-radius: 5px;
  color: var(--text-muted); padding: 4px 8px; cursor: pointer; font-size: 12px;
  transition: all 150ms;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &:disabled { opacity: .4; cursor: not-allowed; }
  &.btn-danger:hover { border-color: #dc2626; color: #dc2626; }
  &.btn-download:hover { border-color: #2563eb; color: #2563eb; }
}
</style>
