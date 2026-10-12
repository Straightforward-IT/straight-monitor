<template>
  <section class="hours-import" aria-labelledby="zvoove-hours-import-title">
    <header class="hours-import__heading">
      <h2 id="zvoove-hours-import-title">Zvoove-Stunden</h2>
      <p>Importiere eine Monatsdatei aus STUNDEN. Prüfe zuerst die Vorschau und aktiviere anschließend die geprüften Stunden.</p>
    </header>

    <p v-if="!hasAccess" role="alert">{{ accessError || 'Der Stundenimport ist ausschließlich für Admins zugänglich.' }}</p>
    <template v-else>
      <div class="hours-import__upload">
        <AppFileDropzone label="Zvoove-Stunden" prompt="Monatsdatei hier ablegen oder auswählen" hint="Eine Excel-Datei pro Monat (.xlsx oder .xls)" :file="file" accept=".xlsx,.xls" :disabled="loading.activate" @select="selectFile" />
        <div class="hours-import__actions">
          <AppButton :disabled="!file || busy" :loading="loading.preview" @click="createPreview">Stundenimport prüfen</AppButton>
          <AppButton v-if="file" variant="ghost" :disabled="loading.activate" @click="selectFile(null)">Datei entfernen</AppButton>
        </div>
        <p class="hours-import__muted">Nicht mitgelieferte Wochen bleiben erhalten. Mitgelieferte Wochen ersetzen ihre bisherigen Werte vollständig, auch geleerte Stunden und Kennzeichen.</p>
        <details>
          <summary>Erwartete Spalten und Tageszuordnung</summary>
          <p>T1 bis T7 sind Montag bis Sonntag, KZ1 bis KZ7 enthalten die zugehörigen KB-Kürzel. Stunden ohne Kennzeichen sind produktive Stunden. Kennzeichen ohne Stunden bleiben erhalten, beispielsweise FS.</p>
          <p class="hours-import__columns">{{ expectedColumns.join(', ') }}</p>
        </details>
        <p v-if="errors.preview" role="alert" class="hours-import__error">{{ errors.preview }}</p>
      </div>

      <p v-if="loading.details" role="status">Importdetails werden geladen …</p>
      <p v-if="errors.details" role="alert" class="hours-import__error">{{ errors.details }}</p>
      <div v-if="preview" class="hours-import__preview" aria-label="Stundenimport-Vorschau">
        <h3>{{ monthLabel(preview.month) }} · {{ statusLabel(preview.status, preview.isCurrent) }}</h3>
        <p class="hours-import__muted">{{ preview.filename }} · {{ issueCount(preview, 'ERROR') }} Fehler · {{ issueCount(preview, 'WARNING') }} Hinweise</p>
        <dl class="hours-import__counts">
          <div><dt>Wochenzeilen</dt><dd>{{ preview.counts?.rows ?? '—' }}</dd></div>
          <div><dt>Personalnummern</dt><dd>{{ preview.counts?.employees ?? '—' }}</dd></div>
          <div><dt>Tageswerte</dt><dd>{{ preview.counts?.days ?? '—' }}</dd></div>
          <div><dt>Produktive Tage</dt><dd>{{ preview.counts?.productiveDays ?? '—' }}</dd></div>
          <div><dt>Tageskennzeichen</dt><dd>{{ preview.counts?.markers ?? '—' }}</dd></div>
        </dl>
        <div class="hours-import__scroll">
          <table aria-label="Änderungen der Wochenzeilen">
            <thead><tr><th>Neu</th><th>Aktualisiert</th><th>Unverändert</th></tr></thead>
            <tbody><tr><td>{{ preview.changes?.added ?? '—' }}</td><td>{{ preview.changes?.updated ?? '—' }}</td><td>{{ preview.changes?.unchanged ?? '—' }}</td></tr></tbody>
          </table>
        </div>
        <div v-if="preview.issues?.length" class="hours-import__issues">
          <h4>Fehler und Hinweise</h4>
          <ul><li v-for="(issue, index) in preview.issues" :key="index" :class="{ 'hours-import__error': issue.severity === 'ERROR' }">
            <strong>{{ issue.severity === 'ERROR' ? 'Fehler' : 'Hinweis' }}:</strong> {{ issue.message }}
            <span v-if="sourceLabel(issue.source)" class="hours-import__muted"> · {{ sourceLabel(issue.source) }}</span>
          </li></ul>
        </div>
        <p v-if="preview.status === 'ACTIVE' && preview.isCurrent === false" role="status" class="hours-import__notice">Dieser Import wurde früher aktiviert. Der Monatsbestand wurde inzwischen erneut aktualisiert; die ursprüngliche Prüfung bleibt hier nachvollziehbar.</p>
        <p v-else-if="['ACTIVE', 'APPLIED'].includes(preview.status)" role="status" class="hours-import__notice">Dieser Import ist aktiviert. Die Stunden stehen in der Stundenerfassung zur Verfügung.</p>
        <p v-else-if="preview.status === 'SUPERSEDED'" role="status" class="hours-import__notice">Dieser Import wurde durch einen neueren Import ersetzt. Die ursprüngliche Prüfung bleibt hier nachvollziehbar.</p>
        <p v-else-if="!preview.valid || issueCount(preview, 'ERROR')" role="alert" class="hours-import__error">Die Vorschau enthält Fehler und kann nicht aktiviert werden. Korrigiere die Datei und prüfe sie erneut.</p>
        <p v-else-if="stale" role="alert" class="hours-import__error">Der Monatsbestand hat sich seit dieser Vorschau geändert. Prüfe die Datei erneut.</p>
        <p v-else class="hours-import__muted">Die Aktivierung übernimmt die Änderungen für {{ monthLabel(preview.month) }}. Ungeklärte Mitarbeiter und KB-Zuordnungen bleiben markiert.</p>
        <div class="hours-import__actions">
          <AppButton :disabled="!canActivate" :loading="loading.activate" @click="activate">Geprüfte Stunden aktivieren</AppButton>
          <AppButton variant="ghost" :disabled="busy" @click="invalidatePreview">Vorschau schließen</AppButton>
        </div>
        <p v-if="errors.activate" role="alert" class="hours-import__error">{{ errors.activate }}</p>
      </div>

      <div class="hours-import__history">
        <div class="hours-import__actions">
          <h3>Stundenimport-Historie</h3>
          <AppButton size="sm" variant="secondary" :loading="loading.history" :disabled="busy" @click="loadHistory">Historie neu laden</AppButton>
        </div>
        <p v-if="errors.history" role="alert" class="hours-import__error">{{ errors.history }}</p>
        <p v-if="loading.history" role="status">Stundenimport-Historie wird geladen …</p>
        <div v-if="history.length" class="hours-import__scroll">
          <table aria-label="Frühere Stundenimporte">
            <thead><tr><th>Monat</th><th>Datei</th><th>Erstellt</th><th>Status</th><th>Wochenzeilen</th><th>Fehler / Hinweise</th><th>Details</th></tr></thead>
            <tbody><tr v-for="entry in history" :key="entry.id">
              <td>{{ monthLabel(entry.month) }}</td><td>{{ entry.filename }}</td><td>{{ timestamp(entry.createdAt) }}</td><td>{{ statusLabel(entry.status, entry.isCurrent) }}</td><td>{{ entry.counts?.rows ?? '—' }}</td><td>{{ issueCount(entry, 'ERROR') }} / {{ issueCount(entry, 'WARNING') }}</td>
              <td><AppButton size="sm" variant="secondary" :disabled="busy" @click="loadDetails(entry.id)">Prüfung anzeigen</AppButton></td>
            </tr></tbody>
          </table>
        </div>
        <p v-else-if="!loading.history && !errors.history" class="hours-import__muted">Bisher wurde kein Zvoove-Stundenimport geprüft.</p>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';

const emit = defineEmits(['activated']);
const auth = useAuth();
const file = shallowRef(null);
const preview = shallowRef(null);
const history = shallowRef([]);
const stale = ref(false);
const accessError = ref('');
const denied = ref(false);
const kinds = ['preview', 'history', 'details', 'activate'];
const loading = reactive(Object.fromEntries(kinds.map((key) => [key, false])));
const errors = reactive(Object.fromEntries(kinds.map((key) => [key, ''])));
const sequences = Object.fromEntries(kinds.map((key) => [key, 0]));
const controllers = {};
const expectedColumns = ['PERSONALNR', 'JAHR', 'MONAT', 'WOCHE', 'KW', ...Array.from({ length: 7 }, (_, index) => `T${index + 1}`), ...Array.from({ length: 7 }, (_, index) => `KZ${index + 1}`), 'ERSTELLTAM', 'GEAENDERAM'];
const isAdmin = computed(() => [auth?.user?.role, ...(auth?.user?.roles || [])].some((role) => String(role || '').toUpperCase() === 'ADMIN'));
const hasAccess = computed(() => isAdmin.value && !denied.value);
const busy = computed(() => loading.preview || loading.details || loading.activate);
const issueCount = (entry, severity) => (entry.issues || []).filter((issue) => issue.severity === severity).length;
const canActivate = computed(() => hasAccess.value && preview.value?.status === 'PREVIEW' && preview.value.valid && !issueCount(preview.value, 'ERROR') && !stale.value && !busy.value);
const statusLabel = (status, isCurrent) => status === 'ACTIVE' && isCurrent === false ? 'Historisch aktiviert' : ({ PREVIEW: 'Geprüfte Vorschau', INVALID: 'Fehlerhaft', ACTIVE: 'Aktiviert', APPLIED: 'Übernommen', SUPERSEDED: 'Durch neueren Import ersetzt' }[status] || status);
function monthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return month || 'Monat ungeklärt';
  const date = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? month : new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
function timestamp(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(date) : '—';
}
function sourceLabel(source) {
  if (!source) return '';
  return [source.filename, source.sheet, source.row ? `Zeile ${source.row}` : ''].filter(Boolean).join(' · ');
}
function cancel(kind) {
  sequences[kind] += 1;
  controllers[kind]?.abort();
  loading[kind] = false;
}
function clearPrivateData() {
  kinds.forEach(cancel);
  file.value = null;
  preview.value = null;
  history.value = [];
  stale.value = false;
  kinds.forEach((key) => { errors[key] = ''; });
}
async function request(kind, perform, accept) {
  if (!hasAccess.value) return;
  cancel(kind);
  const sequence = sequences[kind];
  const controller = new AbortController();
  controllers[kind] = controller;
  loading[kind] = true;
  errors[kind] = '';
  try {
    const result = await perform(controller.signal);
    if (sequence === sequences[kind] && hasAccess.value) await accept(result.data);
  } catch (error) {
    if (sequence !== sequences[kind] || controller.signal.aborted) return;
    const message = error.response?.data?.message || error.message || 'Der Stundenimport konnte nicht geladen werden.';
    if ([401, 403].includes(error.response?.status)) {
      clearPrivateData();
      denied.value = true;
      accessError.value = message;
    } else {
      errors[kind] = message;
      if (kind === 'activate' && error.response?.status === 409) stale.value = true;
    }
  } finally {
    if (sequence === sequences[kind]) loading[kind] = false;
  }
}
function invalidatePreview() {
  cancel('preview');
  cancel('details');
  preview.value = null;
  stale.value = false;
  errors.preview = '';
  errors.details = '';
  errors.activate = '';
}
function selectFile(nextFile) {
  if (!hasAccess.value || loading.activate) return;
  invalidatePreview();
  file.value = nextFile;
  if (nextFile && !/\.xlsx?$/i.test(nextFile.name)) {
    file.value = null;
    errors.preview = 'Bitte wähle eine Excel-Datei (.xlsx oder .xls).';
  }
}
async function loadHistory() {
  await request('history', (signal) => api.get('/api/payroll/imports', { signal }), (data) => { history.value = data.imports || []; });
}
async function createPreview() {
  if (!hasAccess.value || !file.value || busy.value) return;
  invalidatePreview();
  const form = new FormData();
  form.append('file', file.value);
  await request('preview', (signal) => api.post('/api/payroll/imports/preview', form, { signal }), async (data) => {
    preview.value = data;
    await loadHistory();
  });
}
async function loadDetails(id) {
  if (!hasAccess.value || busy.value) return;
  invalidatePreview();
  await request('details', (signal) => api.get(`/api/payroll/imports/${encodeURIComponent(id)}`, { signal }), (data) => { preview.value = data; });
}
async function activate() {
  if (!canActivate.value) return;
  const selected = preview.value;
  await request('activate', (signal) => api.post(`/api/payroll/imports/${encodeURIComponent(selected.id)}/activate`, { expectedRevision: selected.baseRevision }, { signal }), async (data) => {
    preview.value = data;
    emit('activated', data);
    await loadHistory();
  });
}
watch(isAdmin, (enabled) => {
  clearPrivateData();
  denied.value = false;
  accessError.value = '';
  if (enabled) loadHistory();
}, { immediate: true });
onBeforeUnmount(() => kinds.forEach(cancel));
</script>

<style scoped>
.hours-import { display: grid; gap: 20px; margin: 24px 0; padding: 24px; background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: var(--card-radius, 12px); }
.hours-import__heading h2, .hours-import__heading p { margin: 0; }
.hours-import__heading, .hours-import__upload, .hours-import__preview, .hours-import__history { display: grid; gap: 12px; }
.hours-import__heading p, .hours-import__muted { color: var(--muted); font-size: .9rem; line-height: 1.5; }
.hours-import__preview, .hours-import__history { padding-top: 18px; border-top: 1px solid var(--border); }
.hours-import__preview h3, .hours-import__history h3, .hours-import__issues h4 { margin: 0; }
.hours-import__actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.hours-import__actions h3 { margin-right: auto; }
.hours-import__counts { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin: 0; }
.hours-import__counts dt { color: var(--muted); font-size: .85rem; }
.hours-import__counts dd { margin: 4px 0 0; font-weight: 600; }
.hours-import__scroll { overflow-x: auto; }
.hours-import table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.hours-import th, .hours-import td { padding: 10px; border-bottom: 1px solid var(--border); text-align: left; }
.hours-import__columns { overflow-wrap: anywhere; font-family: monospace; font-size: .85rem; }
.hours-import__issues ul { padding-left: 20px; margin: 8px 0; }
.hours-import__issues li { padding: 4px 0; overflow-wrap: anywhere; }
.hours-import__error { color: var(--danger, #b93636); }
.hours-import__notice { background: color-mix(in srgb, var(--primary) 8%, var(--panel)); padding: 12px; border-radius: 8px; }
.hours-import p { margin-top: 0; margin-bottom: 0; }
@media (max-width: 600px) { .hours-import { padding: 16px; } }
</style>
