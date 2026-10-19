<template>
  <section class="time-year-import" aria-label="Zvoove-Zeitimport">
    <h2>STUNDENVORTRAG und STUNDUHR – Jahresimport</h2>
    <p>Die Jahresauszüge der beiden Zvoove-Tabellen jeweils in das zugehörige Feld hochladen.</p>
    <p v-if="!hasAccess" role="alert">{{ error || 'Dieser Import ist ausschließlich für Admins zugänglich.' }}</p>
    <template v-else>
      <label>Jahr <AppTextInput v-model="year" type="number" :disabled="busy" /></label>
      <div v-for="role in roles" :key="role" class="time-year-import__table">
        <h3>{{ tableLabels[role] }}</h3>
        <AppFileDropzone :label="tableLabels[role]" :prompt="`${role}-Export hier ablegen oder auswählen`" :hint="`Zum Beispiel: ${tableFiles[role]} ${year}.xlsx (.xlsx oder .xls)`" :file="files[role]" accept=".xlsx,.xls" :disabled="busy" @select="select(role, $event)" />
      </div>
      <div class="actions"><AppButton :disabled="busy || !roles.some(role => files[role])" @click="preview">Jahresimport prüfen</AppButton></div>
      <p>Eine gelieferte Tabelle ersetzt ihren Jahresstand vollständig. Nicht gelieferte Tabellen und bestehende lokale Bearbeitungen bleiben erhalten.</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="busy" role="status">Jahresdateien werden verarbeitet …</p>
      <template v-if="run">
        <h3>{{ run.year }} · {{ run.status }}</h3>
        <dl>
          <div><dt>Stundenvorträge</dt><dd>{{ run.counts.vortraege }}</dd></div>
          <div><dt>Arbeitszeilen</dt><dd>{{ run.counts.workRows }}</dd></div>
          <div><dt>Pausenzeilen</dt><dd>{{ run.counts.pauseRows }}</dd></div>
          <div><dt>Arbeitsstunden</dt><dd>{{ run.productiveHours }}</dd></div>
          <div><dt>Pausenstunden</dt><dd>{{ run.pauseHours }}</dd></div>
          <div><dt>Buchungen ohne genaue Pausenlage</dt><dd>{{ run.counts.unlocatedBreaks }}</dd></div>
          <div><dt>Ungeklärte Buchungen / nicht zugeordnete Zeilen</dt><dd>{{ run.counts.unresolved }} / {{ run.counts.orphanRows }}</dd></div>
          <div><dt>Vorträge für die Schnellerfassung zugeordnet</dt><dd>{{ run.counts.editableProjections }}</dd></div>
        </dl>
        <ul v-if="run.issues?.length"><li v-for="(issue, i) in run.issues" :key="i">{{ issue.message }}</li></ul>
        <AppButton v-if="run.status === 'PREVIEW'" :disabled="busy || stale" @click="activate">Geprüften Jahresstand aktivieren</AppButton>
        <p v-if="run.projectionResult">Schnellerfassung: {{ run.projectionResult.created }} neu, {{ run.projectionResult.updated }} aktualisiert, {{ run.projectionResult.protected }} lokale Datensätze geschützt.</p>
      </template>
      <details><summary>STUNDENVORTRAG / STUNDUHR – Importhistorie</summary><ul><li v-for="item in history" :key="item.id"><AppButton variant="ghost" :disabled="busy" @click="load(item.id)">{{ item.year }} · {{ item.status }} · {{ item.counts.workRows }} Arbeitszeilen</AppButton></li></ul></details>
    </template>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';
const auth = useAuth(), roles = ['STUNDENVORTRAG', 'STUNDUHR'];
const tableLabels = { STUNDENVORTRAG: 'STUNDENVORTRAG – vom Mitarbeiter vorgetragene Zeiten', STUNDUHR: 'STUNDUHR – übertragene Arbeitszeiten und Pausen' };
const tableFiles = { STUNDENVORTRAG: 'Stundenvortrag', STUNDUHR: 'Stunduhr' };
const isAdmin = computed(() => [auth.user?.role, ...(auth.user?.roles || [])].some(role => String(role).toUpperCase() === 'ADMIN'));
const year = ref(new Date().getFullYear()), files = ref({ STUNDENVORTRAG: null, STUNDUHR: null }), run = ref(null), history = ref([]), busy = ref(false), error = ref(''), stale = ref(false), denied = ref(false);
const hasAccess = computed(() => isAdmin.value && !denied.value);
const base = '/api/payroll/time-imports';
let generation = 0;
async function request(work) {
  if (!hasAccess.value || busy.value) return;
  const requestGeneration = ++generation; busy.value = true; error.value = '';
  try { const result = await work(); if (requestGeneration === generation && isAdmin.value) run.value = result.data; }
  catch (failure) { if (requestGeneration === generation) { error.value = failure?.response?.data?.message || 'Jahresimport konnte nicht verarbeitet werden.'; stale.value = failure?.response?.status === 409; if ([401, 403].includes(failure?.response?.status)) { denied.value = true; run.value = null; history.value = []; files.value = { STUNDENVORTRAG: null, STUNDUHR: null }; } } }
  finally { if (requestGeneration === generation) { busy.value = false; if (hasAccess.value) { try { const result = await api.get(base); if (requestGeneration === generation && hasAccess.value) history.value = result.data.imports; } catch {} } } }
}
function select(role, file) { files.value[role] = file; run.value = null; stale.value = false; error.value = ''; }
async function preview() { stale.value = false; run.value = null; const form = new FormData(); form.append('year', String(year.value)); roles.forEach(role => { if (files.value[role]) form.append(role, files.value[role]); }); await request(() => api.post(`${base}/preview`, form)); }
async function activate() { const current = run.value; await request(() => api.post(`${base}/${current.id}/activate`, { expectedRevision: current.baseRevision })); }
async function load(id) { stale.value = false; await request(() => api.get(`${base}/${id}`)); }
watch(year, () => { run.value = null; stale.value = false; });
watch(isAdmin, async enabled => { generation++; const current = generation; run.value = null; history.value = []; files.value = { STUNDENVORTRAG: null, STUNDUHR: null }; busy.value = false; denied.value = false; if (enabled) { try { const result = await api.get(base); if (current === generation && hasAccess.value) history.value = result.data.imports; } catch (failure) { if (current === generation) { error.value = failure?.response?.data?.message || 'Importhistorie konnte nicht geladen werden.'; denied.value = [401, 403].includes(failure?.response?.status); } } } }, { immediate: true });
onBeforeUnmount(() => { generation++; });
</script>
<style scoped>
.time-year-import { display: grid; gap: 12px; padding: 24px; margin: 24px 0; border: 1px solid var(--border); border-radius: var(--card-radius, 12px); background: var(--panel); }
.time-year-import h2, .time-year-import h3, .time-year-import p { margin: 0; }
.time-year-import__table { display: grid; gap: 8px; }
.time-year-import dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 0; }
.time-year-import dd { margin: 4px 0 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
