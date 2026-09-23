<template>
  <section class="monthly-review" aria-label="Monatsprüfung">
    <h2>Monatsprüfung</h2>
    <p>{{ state.state === 'REVIEWED' ? 'Intern geprüft' : 'Entwurf' }} · Revision {{ state.revision }}</p>
    <dl><template v-for="(label, key) in labels" :key="key"><dt>{{ label }}</dt><dd>{{ formatMinutes(state.totals[key]) }}</dd></template></dl>
    <p v-if="state.stale" role="alert">Freigegebene Zeiten oder fortlaufende Fehlzeiten wurden geändert. Quellen neu laden, abgleichen und erneut prüfen.</p>
    <ul v-if="state.sourceChanges?.length"><li v-for="change in state.sourceChanges" :key="change.id">{{ change.after?.date || change.before?.date }} · {{ change.before ? formatMinutes(change.before.netMinutes) : 'Neue Freigabe' }} → {{ change.after ? formatMinutes(change.after.netMinutes) : 'Freigabe zurückgenommen' }}</li></ul>
    <p>Zeitkonto nicht verfügbar · AZK-Vorschläge sind nicht gegen einen LODAS-Kontostand geprüft.</p>
    <div v-if="state.canReview" class="actions">
      <button v-if="state.state === 'DRAFT'" type="button" :disabled="busy || dirty || state.stale || !state.revision || !reason.trim()" @click="$emit('action', 'finalize')">Monat intern abschließen</button>
      <button v-else type="button" :disabled="busy || !reason.trim()" @click="$emit('action', 'reopen')">Neue Entwurfsrevision öffnen</button>
      <button type="button" :disabled="busy || mappingDirty" @click="$emit('loadMapping')">LODAS-Zuordnungen bearbeiten</button>
    </div>
    <p v-else>Der Monatsabschluss erfolgt durch PAYROLL oder ADMIN.</p>
    <h3>Prüfhistorie</h3>
    <p v-if="!state.snapshots.length">Noch kein geprüfter Snapshot.</p>
    <ul><li v-for="snapshot in state.snapshots" :key="snapshot._id">Revision {{ snapshot.revision }} · {{ new Date(snapshot.reviewedAt).toLocaleString('de-DE') }} <button v-if="state.canReview" type="button" :disabled="busy" @click="$emit('preview', snapshot._id)">LODAS-Vorschau</button></li></ul>
    <template v-if="preview">
      <h3>Offline-Vorschau · Snapshot {{ preview.contentHash.slice(0, 12) }}</h3>
      <p>{{ preview.mappingComplete ? 'DATEV-Zuordnungen vollständig' : 'DATEV-Zuordnungen unvollständig' }} · Mapping-Version {{ preview.mappingVersion }} · Keine Übertragung</p>
      <p v-if="preview.stale || !preview.current" role="alert">Historischer oder veralteter Snapshot. Vor einer späteren Übertragung erneut prüfen.</p>
      <ul><li v-for="(issue, index) in preview.issues" :key="index">{{ issue.message }} <small>{{ issue.sourceId }}</small></li></ul>
      <ul><li v-for="entry in preview.exclusions" :key="entry.sourceId">Ausgeschlossen: {{ entry.sourceId }} · {{ entry.reason }}</li></ul>
      <table><thead><tr><th>Lohnart</th><th>Schlüssel</th><th>Minuten</th><th>Übertragungswert</th><th>Quellen</th></tr></thead><tbody><tr v-for="(entry, index) in preview.quantities" :key="index"><td>{{ entry.body.salary_type_id }}</td><td>{{ entry.body.processing_code }}</td><td>{{ entry.conversion.minutes }}</td><td>{{ entry.conversion.value }} {{ entry.conversion.unit }}</td><td>{{ entry.sourceIds.join(', ') }}</td></tr></tbody></table>
      <ul><li v-for="entry in preview.absences" :key="entry.externalIdentity">Fehlzeit {{ entry.body.reason_for_absence }} · {{ entry.body.absence_start_date }} – {{ entry.body.absence_end_date }}{{ entry.continuation ? ' · Fortsetzung: vor Versand mit DATEV abgleichen' : '' }}</li></ul>
      <details><summary>Vorbereitete API-Anfragen</summary><pre>{{ JSON.stringify(preview.requests, null, 2) }}</pre></details>
    </template>
    <section v-if="mapping && state.canReview" aria-label="LODAS-Zuordnungen">
      <h3>LODAS-Zuordnungen · Version {{ mapping.version }}</h3>
      <p>Werte aus dem zukünftigen LODAS-Mandanten. Zvoove-Nummern werden nicht automatisch übernommen. Unterstützte Mengeneinheiten: Stunden oder Minuten.</p>
      <fieldset :disabled="busy">
        <label>Beraternummer-Mandantennummer<input v-model="config.clientId" placeholder="Noch nicht eingerichtet"></label>
        <label>LODAS-Personalnummer<input v-model.number="config.personnelNumber" type="number" min="1" max="99999" @change="config.personnelNumber === '' && (config.personnelNumber = null)"></label>
        <div v-for="(rule, index) in config.rules" :key="index" class="rule">
          <label>Quellcode<input v-model="rule.code" list="payroll-mapping-codes"></label>
          <label>Übermittlung<select v-model="rule.mode"><option value="QUANTITY">Monatsmenge</option><option value="ABSENCE">Fehlzeitzeitraum</option><option value="BOTH">Zeitraum und Menge</option><option value="EXCLUDE">Bewusst ausschließen</option></select></label>
          <template v-if="['QUANTITY', 'BOTH'].includes(rule.mode)">
            <label>Lohnart<input v-model.number="rule.salaryTypeId" type="number" min="1" max="9999"></label>
            <label>Verarbeitungsschlüssel<input v-model.number="rule.processingCode" type="number"></label>
            <label>Einheit<select v-model="rule.unit"><option value="HOURS">Stunden</option><option value="MINUTES">Minuten</option></select></label>
            <label>Vorzeichen<select v-model.number="rule.sign"><option :value="1">Positiv</option><option :value="-1">Negativ</option></select></label>
            <label>Kostenstelle (optional)<input v-model="rule.costCenterId" maxlength="13"></label>
          </template>
          <label v-if="['ABSENCE', 'BOTH'].includes(rule.mode)">LODAS-Fehlzeitgrund<input v-model.number="rule.absenceReason" type="number"></label>
          <label v-if="rule.mode === 'EXCLUDE'">Begründung<input v-model="rule.reason"></label>
          <button type="button" @click="config.rules.splice(index, 1)">Zuordnung entfernen</button>
        </div>
        <datalist id="payroll-mapping-codes"><option v-for="code in codes" :key="code" :value="code" /></datalist>
        <button type="button" @click="addRule">Zuordnung hinzufügen</button>
        <button type="button" :disabled="!mappingDirty" @click="$emit('saveMapping', cleanConfig())">Neue Mapping-Version speichern</button>
      </fieldset>
    </section>
    <details><summary>Bearbeitungsverlauf</summary><ul><li v-for="entry in state.history" :key="entry.revision">{{ entry.revision }} · {{ entry.action }} · {{ entry.reason }} · {{ new Date(entry.at).toLocaleString('de-DE') }}</li></ul></details>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { formatMinutes } from '@/utils/timeManagement';
const props = defineProps({ state: { type: Object, required: true }, preview: { type: Object, default: null }, mapping: { type: Object, default: null }, busy: Boolean, dirty: Boolean, reason: { type: String, default: '' }, codes: { type: Array, default: () => [] } });
const emit = defineEmits(['action', 'preview', 'loadMapping', 'saveMapping', 'mappingDirty']);
const config = ref({ clientId: '', personnelNumber: null, rules: [] }), baseline = ref(''), mappingDirty = ref(false);
const labels = { workedMinutes: 'Freigegebene Ist-Zeit', absenceMinutes: 'Anrechenbare Fehlzeit', adjustmentMinutes: 'Mengenänderungen', proposedDepositMinutes: 'AZK-Zugänge vorgeschlagen', proposedWithdrawalMinutes: 'AZK-Abgänge vorgeschlagen' };
watch(() => props.mapping, value => {
  if (!value) return;
  config.value = JSON.parse(JSON.stringify(value.config)); baseline.value = JSON.stringify(config.value); mappingDirty.value = false; emit('mappingDirty', false);
}, { immediate: true });
watch(config, () => { mappingDirty.value = JSON.stringify(config.value) !== baseline.value; emit('mappingDirty', mappingDirty.value); }, { deep: true });
function addRule() { config.value.rules.push({ code: '', mode: 'QUANTITY', salaryTypeId: null, processingCode: null, unit: 'HOURS', sign: 1, costCenterId: '', absenceReason: null, reason: '' }); }
function cleanConfig() {
  return { clientId: config.value.clientId, personnelNumber: config.value.personnelNumber || null, rules: config.value.rules.map(r => ({
    code: r.code, mode: r.mode,
    ...(['QUANTITY', 'BOTH'].includes(r.mode) ? { salaryTypeId: r.salaryTypeId, processingCode: r.processingCode, unit: r.unit, sign: r.sign, costCenterId: r.costCenterId || '' } : {}),
    ...(['ABSENCE', 'BOTH'].includes(r.mode) ? { absenceReason: r.absenceReason } : {}),
    ...(r.mode === 'EXCLUDE' ? { reason: r.reason } : {}),
  })) };
}
</script>

<style scoped>
.monthly-review { padding: 16px; } h2 { font-size: 18px; } h3 { font-size: 15px; margin-top: 24px; }
dl { display: grid; grid-template-columns: minmax(170px, 320px) auto; gap: 8px; } dd { margin: 0; font-variant-numeric: tabular-nums; }
fieldset { border: 0; padding: 0; } label { display: grid; gap: 4px; margin: 8px 0; font-size: 13px; } input, select, button { padding: 8px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); color: var(--text); }
button { margin: 4px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
.rule { display: flex; align-items: end; flex-wrap: wrap; gap: 10px; padding: 10px; margin-block: 8px; border: 1px solid var(--border); } .rule input { width: 160px; }
table { width: 100%; text-align: left; font-size: 13px; } td, th { padding: 8px; overflow-wrap: anywhere; } pre { white-space: pre-wrap; overflow-wrap: anywhere; } [role=alert] { color: var(--danger, #c54a38); }
</style>
