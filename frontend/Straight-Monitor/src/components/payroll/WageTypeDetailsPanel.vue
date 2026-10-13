<template>
  <SidePanelFrame :model-value="Boolean(selectedId)" :title="title" subtitle="Schreibgeschützter Zvoove-Lohnartenstamm" width="520px" class="wage-detail" @close="emit('close')">
    <AppTabs v-model="activeTab" :tabs="tabs" :id-prefix="tabPrefix" label="Lohnartdetails" size="sm" variant="compact" scroll-controls />
    <p v-if="loading" class="wage-detail__state" role="status">Lohnartdetails werden geladen …</p>
    <div v-else-if="error" class="wage-detail__error" role="alert"><p>{{ error }}</p><AppButton size="sm" variant="secondary" @click="loadDetails">Erneut laden</AppButton></div>
    <template v-else-if="record">
      <ul v-if="issues.length" class="wage-detail__issues" aria-label="Klärungshinweise"><li v-for="(issue, index) in issues" :key="index">{{ typeof issue === 'string' ? issue : issue.message || issue.note || JSON.stringify(issue) }}</li></ul>
      <section v-for="tab in tabs" :key="tab.id" :id="tab.panelId" role="tabpanel" :aria-labelledby="`${tabPrefix}-${tab.id}`" :hidden="activeTab !== tab.id" class="wage-detail__section">
        <template v-if="tab.id !== 'source'">
          <dl class="wage-detail__settings">
            <div v-for="setting in groupSettings(tab.id)" :key="setting.field" :data-setting="setting.field">
              <dt>{{ setting.label }}</dt>
              <dd>{{ setting.kind === 'code' ? formatSetting(record, setting.field) : setting.kind === 'flag' ? flagDisplay(record[setting.field]) : rawDisplay(record[setting.field]) }}</dd>
              <small v-if="setting.kind === 'code'">{{ getSettingHint(record, setting.field) }}</small>
              <small v-else-if="setting.note">{{ setting.note }}</small>
            </div>
          </dl>
          <template v-if="tab.id === 'tariff'">
            <section class="wage-detail__relation" aria-label="Verrechnungsbezug">
              <h3>Verrechnungsbezug</h3>
              <p v-if="offsetTargetNumber" class="wage-detail__relation-path">{{ record.lohnartNummer }} → {{ offsetTargetNumber }}</p>
              <AppButton v-if="offsetTarget?._id" size="sm" variant="secondary" @click="emit('select', offsetTarget)">{{ offsetTarget.lohnartNummer }} · {{ offsetTarget.lohnartBezeichnung || 'Ziel-Lohnart öffnen' }}</AppButton>
              <p v-else-if="offsetTargetNumber" class="wage-detail__hint">Ziel-Lohnart {{ offsetTargetNumber }} fehlt im Lohnartenstamm.</p>
              <p v-else class="wage-detail__state">Keine Verrechnungslohnart hinterlegt.</p>
              <p class="wage-detail__hint">Die Verrechnungsart, Ziel-Lohnart und Priorität beschreiben die Beziehung. Vorzeichen, Reihenfolge und Betrag sind noch zu klären; aus dieser Einstellung wird keine Buchung erzeugt.</p>
              <p v-if="String(record.lohnartNummer) === '110'" class="wage-detail__hint">ÜTZ ist eine zusätzliche lohnseitige Komponente zu den Normalstunden. Die Ziel-Lohnart 602 wird nicht als weitere positive Zulage addiert. Personal- und auftragsseitige Vereinbarungen können die Verrechnung beeinflussen.</p>
            </section>
          </template>
          <template v-if="tab.id === 'conditions'">
            <section class="wage-detail__conditions" aria-label="Kundenkonditionen">
              <h3>Kundenkonditionen</h3>
              <p class="wage-detail__hint">Die Verwendung der einzelnen Kundenkondition ist unabhängig von der Bereitstellung der Lohnart in Konditionstabellen. Fakturregeln erzeugen keine Mitarbeiterzuschläge.</p>
              <p v-if="!conditions.length" class="wage-detail__state">Keine Kundenkonditionen hinterlegt.</p>
              <section v-for="group in conditionGroups" :key="group.key" class="wage-detail__condition-group" :data-condition-group="group.key">
                <h4>{{ group.label }} <span>({{ group.rows.length }})</span></h4>
                <article v-for="(condition, index) in group.rows" :key="condition._id || `${group.key}-${index}`" class="wage-detail__condition">
                  <button v-if="customerFor(condition)" type="button" class="wage-detail__link" @click="emit('open-customer', customerFor(condition))">{{ customerLabel(customerFor(condition)) }}</button>
                  <strong v-else>Kunde {{ condition.kundenNrSnapshot || 'nicht aufgelöst' }}</strong>
                  <dl class="wage-detail__condition-values">
                    <div><dt>Verwendung</dt><dd>{{ condition.verwendung || 'Nicht geliefert' }} · {{ group.label }}</dd></div>
                    <div><dt>Regel</dt><dd>{{ conditionRule(condition) }}</dd></div>
                    <div><dt>Tage</dt><dd>{{ conditionDays(condition.tage) }}</dd></div>
                    <div><dt>Zuschlag</dt><dd>{{ rawDisplay(condition.zuschlagsProzent) }} %</dd></div>
                    <div><dt>Betragssatz</dt><dd>{{ rawDisplay(condition.preisBetrag) }}</dd></div>
                    <div><dt>Preisnummer</dt><dd>{{ rawDisplay(condition.preisNr) }}</dd></div>
                    <div><dt>Einheit</dt><dd>{{ condition.jeEinheit === 'tag' ? 'Je Tag' : condition.jeEinheit === 'woche' ? 'Je Woche' : rawDisplay(condition.jeEinheit) }}</dd></div>
                    <div><dt>Ab Stunden</dt><dd>{{ rawDisplay(condition.abStundenGrenze) }}</dd></div>
                    <div><dt>Nicht automatisch</dt><dd>{{ flagDisplay(condition.nichtAutomatisch) }}</dd></div>
                    <div><dt>Branchenzuschlag addieren</dt><dd>{{ flagDisplay(condition.branchenzuschlagAddieren) }}</dd></div>
                    <div><dt>Berufsschlüssel</dt><dd>{{ rawDisplay(condition.berufsSchluessel) }}</dd></div>
                    <div><dt>Tabelle / laufende Nummer</dt><dd>{{ rawDisplay(condition.tabellenNr) }} / {{ rawDisplay(condition.laufendeNummer) }}</dd></div>
                    <div><dt>Tabellenbezeichnung</dt><dd>{{ rawDisplay(condition.tabellenBezeichnung) }}</dd></div>
                    <div><dt>Zvoove-ID</dt><dd>{{ rawDisplay(condition.zvooveKonditionsId) }}</dd></div>
                  </dl>
                </article>
              </section>
            </section>
          </template>
          <p v-if="tab.id === 'accounting'" class="wage-detail__hint">Die Bedeutungen für Zusatzversorgung K3, alternative Pauschalsteuer K5 und BG2 sind dokumentiert. Ihre Datenspalten sind noch nicht belegt. BG2 wird nicht aus IBGSPALTESTD_SUB abgeleitet.</p>
        </template>
        <template v-else>
          <dl class="wage-detail__settings wage-detail__origin"><div><dt>Datei</dt><dd>{{ rawDisplay(record.source?.filename) }}</dd></div><div><dt>Tabellenblatt</dt><dd>{{ rawDisplay(record.source?.sheet) }}</dd></div><div><dt>Zeile</dt><dd>{{ rawDisplay(record.source?.row) }}</dd></div></dl>
          <h3>Modellwerte</h3>
          <p class="wage-detail__hint">Ungeklärte Altzuordnungen und undokumentierte Werte bleiben hier unverändert sichtbar.</p>
          <dl class="wage-detail__settings"><div v-for="[key, value] in rawEntries" :key="key" :data-raw-field="key"><dt>{{ key }}</dt><dd>{{ rawDisplay(value) }}</dd></div></dl>
          <h3>Quellspalten <span>({{ sourceColumns.length }})</span></h3>
          <p v-if="!sourceColumns.length" class="wage-detail__state">Für diesen Bestandsdatensatz ist noch keine Dateiherkunft gespeichert.</p>
          <div v-else class="wage-detail__source-wrap"><table class="wage-detail__source-table"><thead><tr><th>Index</th><th>Quellüberschrift</th><th>Vorkommen</th><th>Wert</th></tr></thead><tbody><tr v-for="(column, index) in sourceColumns" :key="index"><td>{{ column.index }}</td><td>{{ column.header }}</td><td>{{ column.occurrence }}</td><td>{{ rawDisplay(column.value) }}</td></tr></tbody></table></div>
        </template>
      </section>
    </template>
  </SidePanelFrame>
</template>

<script setup>
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
import api from '@/utils/api';
import { fields, formatSetting, getConditionUsage, getSettingHint } from '@/utils/wageTypeSettings';
import SidePanelFrame from '@/components/frames/SidePanelFrame.vue';
import AppTabs from '@/components/ui-elements/AppTabs.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';

const props = defineProps({ selectedId: { type: String, default: '' }, selectedRecord: { type: Object, default: null } });
const emit = defineEmits(['close', 'select', 'open-customer']);
const record = ref(null);
const loading = ref(false);
const error = ref('');
const activeTab = ref('calculation');
let revision = 0;
let controller;
const tabPrefix = `wage-type-details-${getCurrentInstance().uid}`;
const tabs = [
  { id: 'calculation', label: 'Berechnung' }, { id: 'time', label: 'Zeit & Fehlzeiten' },
  { id: 'conditions', label: 'Faktur & Konditionen' }, { id: 'tariff', label: 'Tarif & Verrechnung' },
  { id: 'accounting', label: 'Abrechnung' }, { id: 'source', label: 'Herkunft' },
].map(tab => ({ ...tab, panelId: `${tabPrefix}-${tab.id}-panel` }));
const title = computed(() => {
  const selected = record.value || props.selectedRecord;
  return selected ? `Lohnart ${selected.lohnartNummer} · ${selected.lohnartBezeichnung || ''}` : 'Lohnartdetails';
});
const issues = computed(() => record.value?.issues || []);
const sourceColumns = computed(() => record.value?.source?.columns || []);
const rawEntries = computed(() => Object.entries(record.value || {}).filter(([key]) => !['codeMetadaten', 'berechnungsart', 'durchschnittsspeicherung', 'kunden', 'kundenkonditionen', 'verrechnungsbezug', 'source', 'issues'].includes(key)));
const conditions = computed(() => record.value?.kundenkonditionen || []);
const conditionGroups = computed(() => [
  { key: 'L', label: 'Lohn', rows: conditions.value.filter(row => row.verwendung === 'L') },
  { key: 'F', label: 'Faktur', rows: conditions.value.filter(row => row.verwendung === 'F') },
  { key: 'unknown', label: 'Ungeklärte Verwendung', rows: conditions.value.filter(row => !getConditionUsage(row.verwendung)) },
].filter(group => group.rows.length));
const offsetTarget = computed(() => record.value?.verrechnungsbezug?.target || null);
const offsetTargetNumber = computed(() => record.value?.verrechnungsbezug?.targetNumber || record.value?.verrechnungslohnartNummer || '');

const rawSettings = [
  ['lohnartNummer', 'Lohnartnummer', 'calculation'], ['lohnartKurzzeichen', 'Kürzel', 'calculation'], ['lohnartBezeichnung', 'Bezeichnung', 'calculation'], ['fremdLohnartNummer', 'Fremdlohnartnummer', 'calculation'],
  ['zuschlagsProzent', 'Lohnseitiger Zuschlag (%)', 'calculation'], ['zuschlagsgruppeWert', 'Zuschlagsgruppe (Quellwert)', 'calculation'],
  ['kb', 'Fehlzeitenkürzel (KB)', 'time'], ['automatischeKuerzungCode', 'Automatische Kürzung (Quellcode)', 'time'], ['automatischeKuerzungText', 'Automatische Kürzung (Quellbezeichnung)', 'time'], ['abweichendePreisermittlungFehlzeiten', 'Abweichende Preisermittlung bei Fehlzeiten', 'time'], ['abweichendeStundenermittlungFehlzeiten', 'Abweichende Stundenermittlung bei Fehlzeiten', 'time'], ['fehlzeitenProzent', 'Fehlzeitenprozentsatz', 'time'], ['urlaubKrankheitLohnartNummer', 'Lohnart für Urlaub/Krankheit', 'time'],
  ['rechnungstext', 'Rechnungstext', 'conditions'], ['rechnungsZuschlagProzent', 'Zuschlag für Rechnung (%)', 'conditions'], ['rechnungsspalte', 'Druckspalte für Preis', 'conditions'], ['kostenart', 'Kostenart (SQL-Quellwert)', 'conditions'], ['sachkonto', 'Sachkonto', 'conditions'], ['sachkontoGeringfuegig', 'Sachkonto für geringfügig Beschäftigte', 'conditions'], ['sachkontoEBilanzPauschalsteuer', 'Sachkonto für E-Bilanz Pauschalsteuer', 'conditions'], ['fremdArtikelNummer', 'Fremd-Artikelnummer', 'conditions'], ['positionsnummer', 'Positionsnummer', 'conditions'],
  ['berechnungsgrundlageSpalte', 'Berechnungsgrundlage-Spalte (ungeklärte Altzuordnung)', 'conditions'], ['verrechnungslohnartNummer', 'Verrechnungslohnartnummer', 'tariff'], ['verrechnungsPrioritaet', 'Priorität der Verrechnung', 'tariff'],
  ['branchenzuschlagCode', 'Branchenzuschlag-Code (Altwert)', 'tariff'], ['branchenzuschlagLohnartNummer', 'Branchenzuschlag-Lohnartnummer (Altwert)', 'tariff'], ['branchenzuschlagPrioritaet', 'Branchenzuschlag-Priorität (Altwert)', 'tariff'],
  ['steuerSpezialCode', 'Steuer-Spezial-Code (ungeklärte Altzuordnung)', 'accounting'], ['steuerpflichtigerAnteil', 'Steuerpflichtiger Anteil (%)', 'accounting'], ['kalkulatorischerLohnfaktor', 'Kalkulatorischer Lohnfaktor (%)', 'calculation'],
  ['pfaendungsProzent', 'Pfändungsprozentsatz (normale Pfändung)', 'accounting'], ['pfaendungsFreibetrag', 'Pfändungsfreibetrag (normale Pfändung)', 'accounting'], ['unterhaltsPfaendungsProzent', 'Pfändungsprozentsatz (Unterhaltspfändung)', 'accounting'], ['unterhaltsPfaendungsFreibetrag', 'Pfändungsfreibetrag (Unterhaltspfändung)', 'accounting'],
  ['steuerfreieSammelbefoerderungCode', 'Steuerfreie Sammelbeförderung (Quellcode)', 'accounting'], ['steuerfreieSammelbefoerderungText', 'Steuerfreie Sammelbeförderung (Quellbezeichnung)', 'accounting'], ['stundenermittlungBuchungsbelegCode', 'Stundenermittlung Buchungsbeleg (Quellcode)', 'accounting'], ['stundenermittlungBuchungsbelegText', 'Stundenermittlung Buchungsbeleg (Quellbezeichnung)', 'accounting'], ['abzugBuchungsbeleg', 'Abzug Buchungsbeleg', 'accounting'], ['nettoAbBezugsart', 'Ab-/Bezugsart für Nettobezug', 'accounting'],
].map(([field, label, group]) => ({ field, label, group, kind: 'raw' }));
const flagSettings = [
  ['fuerGesamtstunden', 'Für Gesamtstunden', 'time'], ['inAuswertungenBeruecksichtigen', 'In Auswertungen berücksichtigen', 'time'], ['inklusiveFehlzeiten', 'Inklusive Fehlzeiten', 'time'], ['schichttrennung', 'Schichttrennung', 'time'], ['beiMonatswechselAufteilen', 'Bei Monatswechsel aufteilen', 'time'], ['fuerWochenende', 'Für das Wochenende', 'time'], ['inStundenauswertung', 'In Stundenauswertung (SQL-Quellwert)', 'time'],
  ['feiertagslohnart', 'Feiertagslohnart', 'tariff'], ['urlaubslohnart', 'Urlaubslohnart', 'tariff'], ['zuschlagAusTarifvertrag', 'Zuschlag aus Tarifvertrag', 'tariff'], ['azkVerrechnungPlus', 'AZK-Verrechnung Plus', 'tariff'], ['azkVerrechnungMinus', 'AZK-Verrechnung Minus', 'tariff'], ['azkStundenRelevant', 'Relevant für AZK-Stunden', 'tariff'], ['bankarbeitstageBeruecksichtigen', 'Bankarbeitstage berücksichtigen', 'tariff'], ['bestandteilGrundverguetung', 'Bestandteil der Grundvergütung', 'tariff'], ['equalPayRelevanz', 'Relevant für Equal Pay', 'tariff'],
  ['keineLohnuebergabe', 'Keine Lohnübergabe', 'accounting'], ['stundenwertUebergeben', 'Lohnart mit Stundenwert übergeben', 'accounting'], ['lohnartAuswerten', 'Lohnart auswerten', 'accounting'], ['auswerten', 'Auswerten (SQL-Quellwert)', 'accounting'], ['rueckstellungUrlaub', 'Rückstellung Urlaub', 'accounting'], ['rueckstellungArbeitszeitkonten', 'Rückstellung Arbeitszeitkonten', 'accounting'], ['abrechnungsdruckVerdichten', 'Beim Abrechnungsdruck verdichten', 'accounting'], ['nichtDruckenBeiBetragNull', 'Nicht drucken bei Betrag null', 'accounting'], ['nichtImGesamtbrutto', 'Nicht im Gesamtbrutto berücksichtigen', 'accounting'], ['tageNichtDrucken', 'Tage beim Abrechnungsdruck nicht drucken', 'accounting'], ['sonntagFeiertagNachtZuschlag', 'Sonntags-/Feiertags-/Nachtarbeitszuschlag', 'accounting'], ['vorzeichenumkehr', 'Vorzeichenumkehr', 'accounting'], ['doppelbesteuerung', 'Doppelbesteuerung', 'accounting'], ['nebenbezuegeReisekosten', 'Nebenbezüge (Reisekosten)', 'accounting'], ['insolvenzgeldKennzeichenU', 'Insolvenzgeld / Kennzeichen U', 'accounting'],
  ['sonderzulage', 'Sonderzulage', 'calculation'], ['gehaltslohnart', 'Gehaltslohnart für Stundenlohnberechnung', 'calculation'], ['durchZuschlaegeReduzierbar', 'Durch Zuschläge reduzierbar', 'calculation'], ['durchschnittBeiAbweichendemPreisNichtBeruecksichtigen', 'Durchschnitt bei abweichendem Preis nicht berücksichtigen', 'calculation'],
].map(([field, label, group]) => ({ field, label, group, kind: 'flag' }));
function groupSettings(group) {
  return [
    ...rawSettings.filter(setting => setting.group === group && (setting.field in record.value || ['lohnartNummer', 'lohnartKurzzeichen', 'lohnartBezeichnung', 'kb', 'verrechnungslohnartNummer', 'verrechnungsPrioritaet'].includes(setting.field))),
    ...Object.entries(fields).filter(([, setting]) => setting.group === group).map(([field, setting]) => ({ field, label: setting.label, kind: 'code' })),
    ...flagSettings.filter(setting => setting.group === group),
  ];
}
function rawDisplay(value) {
  if (value == null || value === '') return 'Nicht geliefert';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
function flagDisplay(value) {
  if (value == null || value === '') return 'Nicht geliefert';
  if (typeof value === 'string' && value.trim().toLocaleLowerCase('de') === 'ja') return 'Ja';
  if (typeof value === 'string' && value.trim().toLocaleLowerCase('de') === 'nein') return 'Nein';
  if (value === true || value === 1 || value === '1') return 'Ja';
  if (value === false || value === 0 || value === '0') return 'Nein';
  return `${value} · Bedeutung ungeklärt`;
}
function customerFor(condition) {
  if (condition.kunde && typeof condition.kunde === 'object') return condition.kunde;
  return record.value?.kunden?.find(customer => customer._id === condition.kunde || String(customer.kundenNr) === String(condition.kundenNrSnapshot)) || null;
}
function customerLabel(customer) { return [customer.kundenNr, customer.kuerzel || customer.kundName].filter(Boolean).join(' · '); }
function conditionRule(condition) {
  const type = condition.regelArt === 'uhrzeit' ? 'Uhrzeit' : condition.regelArt === 'stunden' ? 'Stunden' : rawDisplay(condition.regelArt);
  return `${type}: ${rawDisplay(condition.abWert)} – ${rawDisplay(condition.bisWert)}`;
}
function conditionDays(days = {}) {
  return [['montag', 'Mo'], ['dienstag', 'Di'], ['mittwoch', 'Mi'], ['donnerstag', 'Do'], ['freitag', 'Fr'], ['samstag', 'Sa'], ['sonntag', 'So'], ['feiertag', 'Feiertag']].filter(([key]) => days?.[key]).map(([, label]) => label).join(', ') || 'Nicht geliefert';
}
async function loadDetails() {
  const current = ++revision;
  controller?.abort();
  controller = new AbortController();
  record.value = null; error.value = ''; loading.value = false;
  if (!props.selectedId) return;
  loading.value = true;
  try {
    const { data } = await api.get(`/api/import/lohnarten/${encodeURIComponent(props.selectedId)}`, { signal: controller.signal });
    if (current !== revision) return;
    if (!data.data) throw new Error('Lohnartdetails fehlen.');
    record.value = data.data;
  } catch (cause) {
    if (current !== revision || controller.signal.aborted) return;
    error.value = cause?.response?.data?.message || 'Lohnartdetails konnten nicht geladen werden.';
  } finally { if (current === revision) loading.value = false; }
}
watch(() => props.selectedId, loadDetails, { immediate: true });
onBeforeUnmount(() => { revision++; controller?.abort(); });
</script>

<style scoped>
.wage-detail { min-width: 0; }
.wage-detail__section { padding-top: 14px; }
.wage-detail__settings { margin: 0; display: grid; gap: 0; }
.wage-detail__settings > div { padding: 10px 0; border-bottom: 1px solid var(--border); }
.wage-detail__settings dt { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.wage-detail__settings dd { margin: 0; font-size: 13px; overflow-wrap: anywhere; white-space: pre-wrap; }
.wage-detail__settings small { display: block; margin-top: 5px; font-size: 11px; line-height: 1.5; color: var(--muted); }
.wage-detail__relation, .wage-detail__conditions { margin-top: 18px; }
.wage-detail h3 { margin: 12px 0 8px; font-size: 14px; }
.wage-detail h4 { margin: 14px 0 8px; font-size: 13px; }
.wage-detail__hint, .wage-detail__state { color: var(--muted); font-size: 12px; line-height: 1.5; }
.wage-detail__relation-path { font-size: 18px; font-weight: 600; }
.wage-detail__error { color: var(--danger, #b91c1c); font-size: 13px; }
.wage-detail__issues { margin: 12px 0; padding: 12px 12px 12px 28px; font-size: 12px; line-height: 1.5; background: var(--hover); border-radius: 6px; }
.wage-detail__condition { padding: 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; }
.wage-detail__condition-values { display: grid; gap: 8px; margin-bottom: 0; font-size: 12px; }
.wage-detail__condition-values > div { display: flex; align-items: baseline; gap: 12px; justify-content: space-between; }
.wage-detail__condition-values dt { color: var(--muted); }
.wage-detail__condition-values dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
.wage-detail__link { padding: 0; border: 0; background: transparent; color: var(--primary); font: inherit; font-weight: 600; cursor: pointer; text-align: left; }
.wage-detail__link:hover { text-decoration: underline; }
.wage-detail__source-wrap { overflow-x: auto; }
.wage-detail__source-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.wage-detail__source-table th, .wage-detail__source-table td { padding: 8px 6px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.wage-detail__source-table th { color: var(--muted); }
</style>
