<template>
  <section class="monthly-review" aria-label="Monatsprüfung">
    <h2>Monatsprüfung</h2>
    <p>{{ state.state === 'REVIEWED' ? 'Intern geprüft' : 'Entwurf' }} · Revision {{ state.revision }}</p>
    <dl><template v-for="(label, key) in labels" :key="key"><dt>{{ label }}</dt><dd>{{ formatMinutes(state.totals[key]) }}</dd></template></dl>
    <p v-if="state.stale" role="alert">Freigegebene Zeiten oder fortlaufende Fehlzeiten wurden geändert. Quellen neu laden, abgleichen und erneut prüfen.</p>
    <ul v-if="state.sourceChanges?.length"><li v-for="change in state.sourceChanges" :key="change.id">{{ change.after?.date || change.before?.date }} · {{ change.before ? formatMinutes(change.before.netMinutes) : 'Neue Freigabe' }} → {{ change.after ? formatMinutes(change.after.netMinutes) : 'Freigabe zurückgenommen' }}<details><summary>Geänderte Quelldaten einschließlich Zeiten und Pausen</summary><pre>{{ JSON.stringify({ vorher: change.before, aktuell: change.after }, null, 2) }}</pre></details></li></ul>
    <ul v-if="state.inheritedChanges?.length"><li v-for="change in state.inheritedChanges" :key="change.id">Fortlaufende Fehlzeit {{ change.after?.code || change.before?.code }} · {{ change.after?.startDate || change.before?.startDate }}<details><summary>Geänderter Zeitraum und Tagesmengen</summary><pre>{{ JSON.stringify({ vorher: change.before, aktuell: change.after }, null, 2) }}</pre></details></li></ul>
    <p>Zeitkonto nicht verfügbar · AZK-Vorschläge sind nicht gegen einen LODAS-Kontostand geprüft.</p>
    <div v-if="state.canReview" class="actions">
      <AppButton v-if="state.state === 'DRAFT'" size="sm" :disabled="busy || dirty || state.stale || !state.revision || !reason.trim()" @click="$emit('action', 'finalize')">Monat intern abschließen</AppButton>
      <AppButton v-else size="sm" :disabled="busy || !reason.trim()" @click="$emit('action', 'reopen')">Neue Entwurfsrevision öffnen</AppButton>
      <AppButton size="sm" variant="secondary" :disabled="busy || mappingDirty" @click="$emit('loadMapping')">LODAS-Zuordnungen bearbeiten</AppButton>
    </div>
    <p v-else>Der Monatsabschluss erfolgt durch PAYROLL oder ADMIN.</p>
    <h3>Prüfhistorie</h3>
    <p v-if="!state.snapshots.length">Noch kein geprüfter Snapshot.</p>
    <ul><li v-for="snapshot in state.snapshots" :key="snapshot._id">Revision {{ snapshot.revision }} · {{ new Date(snapshot.reviewedAt).toLocaleString('de-DE') }} <AppButton v-if="state.canReview" size="sm" variant="outlined" :disabled="busy" @click="$emit('preview', snapshot._id)">LODAS-Vorschau</AppButton></li></ul>
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
        <label>Beraternummer-Mandantennummer<AppTextInput v-model="config.clientId" placeholder="Noch nicht eingerichtet" /></label>
        <label>LODAS-Personalnummer<AppTextInput v-model.number="config.personnelNumber" type="number" min="1" max="99999" @change="config.personnelNumber === '' && (config.personnelNumber = null)" /></label>
        <div v-for="(rule, index) in config.rules" :key="index" class="rule">
          <label>Quellcode<AppTextInput v-model="rule.code" list="payroll-mapping-codes" /></label>
          <label>Übermittlung<AppSelect v-model="rule.mode"><option value="QUANTITY">Monatsmenge</option><option value="ABSENCE">Fehlzeitzeitraum</option><option value="BOTH">Zeitraum und Menge</option><option value="EXCLUDE">Bewusst ausschließen</option></AppSelect></label>
          <template v-if="['QUANTITY', 'BOTH'].includes(rule.mode)">
            <label>Lohnart<AppTextInput v-model.number="rule.salaryTypeId" type="number" min="1" max="9999" /></label>
            <label>Verarbeitungsschlüssel<AppTextInput v-model.number="rule.processingCode" type="number" /></label>
            <label>Einheit<AppSelect v-model="rule.unit"><option value="HOURS">Stunden</option><option value="MINUTES">Minuten</option></AppSelect></label>
            <label>Vorzeichen<AppSelect v-model.number="rule.sign"><option :value="1">Positiv</option><option :value="-1">Negativ</option></AppSelect></label>
            <label>Kostenstelle (optional)<AppTextInput v-model="rule.costCenterId" maxlength="13" /></label>
          </template>
          <label v-if="['ABSENCE', 'BOTH'].includes(rule.mode)">LODAS-Fehlzeitgrund<AppTextInput v-model.number="rule.absenceReason" type="number" /></label>
          <label v-if="rule.mode === 'EXCLUDE'">Begründung<AppTextInput v-model="rule.reason" /></label>
          <AppButton size="sm" variant="outlined" @click="config.rules.splice(index, 1)">Zuordnung entfernen</AppButton>
        </div>
        <datalist id="payroll-mapping-codes"><option v-for="code in codes" :key="code" :value="code" /></datalist>
        <div class="monthly-review__mapping-actions">
          <AppButton size="sm" variant="secondary" @click="addRule">Zuordnung hinzufügen</AppButton>
          <AppButton size="sm" :disabled="!mappingDirty" @click="$emit('saveMapping', cleanConfig())">Neue Mapping-Version speichern</AppButton>
        </div>
      </fieldset>
    </section>
    <details><summary>Bearbeitungsverlauf</summary><ul><li v-for="entry in state.history" :key="entry.revision">{{ entry.revision }} · {{ entry.action }} · {{ entry.reason }} · {{ new Date(entry.at).toLocaleString('de-DE') }}</li></ul></details>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
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
fieldset { border: 0; padding: 0; } label { display: grid; gap: 4px; margin: 8px 0; font-size: 13px; }
.actions, .monthly-review__mapping-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rule { display: flex; align-items: end; flex-wrap: wrap; gap: 10px; padding: 10px; margin-block: 8px; border: 1px solid var(--border); } .rule .app-text-input { width: 160px; } .rule .app-button { margin-bottom: 8px; }
table { width: 100%; text-align: left; font-size: 13px; } td, th { padding: 8px; overflow-wrap: anywhere; } pre { white-space: pre-wrap; overflow-wrap: anywhere; } [role=alert] { color: var(--danger, #c54a38); }
</style>
