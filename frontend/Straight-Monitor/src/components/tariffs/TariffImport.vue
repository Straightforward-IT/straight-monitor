<template>
  <section class="tariff-stack">
    <div class="tariff-panel">
      <h2>Tarifdatenstand oder Teilimport prüfen</h2>
      <p class="tariff-muted">Ordne jede Exportdatei ihrer Tabellenrolle zu. Ein vollständiger Import enthält alle 14 Tabellen. Bei einem Teilimport werden nicht ausgewählte Tabellen aus dem aktuell aktiven Tarifstand übernommen.</p>
      <div class="tariff-grid">
        <div v-for="role in tariffFileRoles" :key="role.key" class="tariff-import-file">
          <header><strong>{{ roleLabel(role.key) }}</strong><AppButton v-if="files[role.key]" size="sm" variant="ghost" :disabled="busy" :aria-label="`${roleLabel(role.key)}: Datei entfernen`" @click="removeFile(role.key)">Entfernen</AppButton></header>
          <AppFileDropzone :label="roleLabel(role.key)" :hint="role.hint" :file="files[role.key] || null" accept=".xlsx,.xls" :disabled="busy" @select="selectFile(role.key, $event)" />
        </div>
      </div>
      <div class="tariff-actions"><AppButton :loading="previewLoading" :disabled="!selectedFileCount || busy || !imports" @click="previewFiles">Importvorschau erstellen</AppButton><span class="tariff-muted">{{ selectedFileCount }} von 14 Dateien ausgewählt<template v-if="selectedFileCount && selectedFileCount < 14"> · Teilimport</template></span></div>
      <p v-if="previewError" class="tariff-alert" role="alert">{{ previewError }}</p>
    </div>

    <p v-if="detailLoading" role="status">Importdetails werden geladen …</p>
    <p v-if="detailError" class="tariff-alert" role="alert">{{ detailError }}</p>
    <div v-if="selected" class="tariff-panel" aria-label="Importvorschau">
      <h2>Importvorschau · {{ importStatusLabel(isActive ? 'ACTIVE' : selected.status) }}</h2>
      <dl class="tariff-meta"><div><dt>Importlauf</dt><dd>{{ selected._id }}</dd></div><div><dt>Erstellt</dt><dd>{{ timestamp(selected.createdAt) }}</dd></div><div><dt>Prüfung</dt><dd>{{ selected.errorCount || 0 }} Fehler · {{ selected.warningCount || 0 }} Hinweise</dd></div></dl>
      <p v-if="selected.duplicate" class="tariff-notice">Dieser Datenstand wurde bereits importiert. Der vorhandene Importlauf wird wiederverwendet.</p>
      <p v-if="isActive" class="tariff-notice" role="status">Dieser Datenstand ist bereits aktiv.</p>
      <p v-if="selected.partialImportRoles?.length" class="tariff-notice">Teilimport: {{ selected.partialImportRoles.map(roleLabel).join(', ') }}. Alle anderen Tarifdaten wurden aus dem aktuell aktiven Stand übernommen.</p>
      <p v-if="selected.assignmentHistory" class="tariff-notice">Tarif Personal: {{ selected.assignmentHistory.received }} Zeilen aus der Datei, {{ selected.assignmentHistory.retained }} bisherige Zeilen zusätzlich erhalten. Die Datensatzanzahl enthält beide.</p>
      <p v-if="selected.allowanceHistory" class="tariff-notice">ÜTZ: {{ selected.allowanceHistory.received }} Zeilen aus der Datei, {{ selected.allowanceHistory.retained }} bisherige Zeilen zusätzlich erhalten. Die Datensatzanzahl enthält beide.</p>
      <div class="tariff-scroll"><table aria-label="Importanzahlen und Änderungen"><thead><tr><th>Tabelle</th><th>Datei</th><th>Datensätze 17055</th><th>Neu</th><th>Geändert</th><th>Entfallen</th><th>Unverändert</th></tr></thead><tbody>
        <tr v-for="role in tariffFileRoles" :key="role.key"><th scope="row">{{ roleLabel(role.key) }}</th><td>{{ fileFor(selected, role.key)?.filename || '—' }}</td><td>{{ selected.counts?.[role.key] ?? '—' }}</td><td>{{ selected.changes?.[role.key]?.added ?? '—' }}</td><td>{{ selected.changes?.[role.key]?.changed ?? '—' }}</td><td>{{ selected.changes?.[role.key]?.removed ?? '—' }}</td><td>{{ selected.changes?.[role.key]?.unchanged ?? '—' }}</td></tr>
      </tbody></table></div>
      <div v-if="selected.issues?.length" class="tariff-stack">
        <h3>Fehler und Hinweise</h3>
        <ul class="tariff-issues"><li v-for="(issue, index) in selected.issues" :key="index"><strong>{{ issueLabel(issue) }}</strong>: {{ issue.message }}<span class="tariff-muted"><template v-if="issue.table"> · {{ roleLabel(issue.table) }}</template><template v-if="issue.filename"> · {{ issue.filename }}</template><template v-if="issue.row"> · Zeile {{ issue.row }}</template><template v-if="issue.code"> · {{ issue.code }}</template></span></li></ul>
      </div>
      <p v-if="selected.errorCount || selected.status === 'INVALID'" class="tariff-alert" role="alert">Dieser Import kann wegen der angezeigten Fehler nicht aktiviert werden. Korrigiere die Exportdateien und erstelle eine neue Vorschau.</p>
      <p v-else-if="selected.requiresNewPreview" class="tariff-alert" role="alert">Die Tarif-Personal- oder ÜTZ-Historie hat sich seit dieser Vorschau geändert. Prüfe die Dateien erneut, damit alle bisherigen Zeilen erhalten bleiben.</p>
      <p v-else-if="!isActive" class="tariff-muted">Die Aktivierung schaltet vollständig auf diesen geprüften Datenstand um. Der bisherige Import bleibt in der Historie erhalten. Ungeklärte Mitarbeiter bleiben gekennzeichnet.</p>
      <div class="tariff-actions"><AppButton :disabled="!canActivate" :loading="activationLoading" @click="activate">Geprüften Datenstand aktivieren</AppButton><AppButton size="sm" variant="ghost" :disabled="busy" @click="selected = null">Vorschau schließen</AppButton></div>
      <p v-if="activationError" class="tariff-alert" role="alert">{{ activationError }}</p>
      <p v-if="activationNotice" class="tariff-notice" role="status">{{ activationNotice }}</p>
    </div>

    <div class="tariff-panel">
      <div class="tariff-actions"><h2>Importhistorie</h2><AppButton size="sm" variant="secondary" :loading="importsLoading" :disabled="busy" @click="loadImports">Neu laden</AppButton></div>
      <p v-if="importsError" class="tariff-alert" role="alert">{{ importsError }}</p>
      <p v-if="importsLoading" role="status">Importhistorie wird geladen …</p>
      <template v-if="imports">
        <p class="tariff-muted">Aktiver Import: {{ activeImportId || 'Noch keiner' }}</p>
        <div v-if="imports.data?.length" class="tariff-scroll"><table aria-label="Frühere Importläufe"><thead><tr><th>Erstellt</th><th>Status</th><th>Fehler / Hinweise</th><th>Importlauf</th><th>Details</th></tr></thead><tbody>
          <tr v-for="entry in imports.data" :key="entry._id" :class="{ 'tariff-selected': selected?._id === entry._id }"><td>{{ timestamp(entry.createdAt) }}</td><td>{{ importStatusLabel(entry._id === activeImportId ? 'ACTIVE' : entry.status) }}</td><td>{{ entry.errorCount || 0 }} / {{ entry.warningCount || 0 }}</td><td>{{ entry._id }}</td><td><AppButton size="sm" variant="secondary" :disabled="busy" @click="loadDetails(entry._id)">Prüfung anzeigen</AppButton></td></tr>
        </tbody></table></div>
        <p v-else class="tariff-notice">Bisher wurde kein Tarifdatenstand importiert.</p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, shallowRef } from 'vue';
import api from '@/utils/api';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';
import { importStatusLabel, tariffFileRoles } from './tariffDisplay';
import { useTariffRequest } from './useTariffRequest';
const emit = defineEmits(['activated']);
const files = shallowRef({});
const selected = shallowRef(null);
const activeImportId = ref(null);
const expectedActiveImportId = ref(null);
const activationNotice = ref('');
const { data: imports, loading: importsLoading, error: importsError, run: readImports } = useTariffRequest();
const { loading: previewLoading, error: previewError, run: readPreview, clear: clearPreview } = useTariffRequest();
const { loading: detailLoading, error: detailError, run: readDetails, clear: clearDetails } = useTariffRequest();
const { loading: activationLoading, error: activationError, run: activateImport, clear: clearActivation } = useTariffRequest();
const busy = computed(() => previewLoading.value || detailLoading.value || activationLoading.value);
const selectedFileCount = computed(() => tariffFileRoles.filter(({ key }) => !!files.value[key]).length);
const isActive = computed(() => !!selected.value && selected.value._id === activeImportId.value);
const canActivate = computed(() => !!selected.value && !busy.value && !isActive.value && !selected.value.errorCount && !selected.value.requiresNewPreview && selected.value.status !== 'INVALID');
const roleLabel = (key) => {
  const role = tariffFileRoles.find((entry) => entry.key === key);
  return role ? `${role.importNumber} · ${role.label}` : key;
};
const issueLabel = (issue) => ['ERROR', 'error'].includes(issue.severity) ? 'Fehler' : 'Hinweis';
const fileFor = (record, key) => Array.isArray(record.files) ? record.files.find((file) => file.key === key) : record.files?.[key];
const timestamp = (value) => value ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value)) : '—';

function invalidatePreview() {
  selected.value = null;
  activationNotice.value = '';
  clearPreview(); clearDetails(); clearActivation();
}
function selectFile(key, file) { if (!busy.value) { invalidatePreview(); files.value = { ...files.value, [key]: file }; } }
function removeFile(key) { const next = { ...files.value }; delete next[key]; invalidatePreview(); files.value = next; }
async function loadImports() {
  const result = await readImports((signal) => api.get('/api/tariffs/imports', { signal }));
  if (result) activeImportId.value = result.activeImportId || null;
}
function selectPreview(result, fallbackActiveId) {
  if (!result) return;
  selected.value = result;
  expectedActiveImportId.value = Object.prototype.hasOwnProperty.call(result, 'basedOnImportId') ? result.basedOnImportId : fallbackActiveId;
}
async function previewFiles() {
  if (!selectedFileCount.value || busy.value || !imports.value) return;
  invalidatePreview();
  const comparisonImportId = activeImportId.value;
  const form = new FormData();
  for (const { key } of tariffFileRoles) if (files.value[key]) form.append(key, files.value[key]);
  const result = await readPreview((signal) => api.post('/api/tariffs/imports/preview', form, { signal }));
  selectPreview(result, comparisonImportId);
  if (result) await loadImports();
}
async function loadDetails(id) {
  invalidatePreview();
  const comparisonImportId = activeImportId.value;
  const result = await readDetails((signal) => api.get(`/api/tariffs/imports/${encodeURIComponent(id)}`, { signal }));
  selectPreview(result, comparisonImportId);
}
async function activate() {
  if (!canActivate.value) return;
  activationNotice.value = '';
  const id = selected.value._id;
  const result = await activateImport((signal) => api.post(`/api/tariffs/imports/${encodeURIComponent(id)}/activate`, { expectedActiveImportId: expectedActiveImportId.value }, { signal }));
  if (result) {
    activeImportId.value = result.activeImportId;
    if (result.import) selected.value = result.import;
    activationNotice.value = 'Der geprüfte Tarifdatenstand ist jetzt aktiv.';
    emit('activated');
    await loadImports();
  }
}
onMounted(loadImports);
</script>
