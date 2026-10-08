<template>
  <InformationCard class="tariff-related-rules" aria-label="Zugehörige Tarifregeln">
    <template #legend>Zugehörigkeit der Regeln</template>
    <template #title><h3>Zugehörige Tarifregeln</h3></template>
    <template #actions><span class="tariff-muted">{{ totalCount }} importierte Regelzeilen</span></template>
    <p class="tariff-muted">Die Regeln gehören zu Vertrag, Variante oder Periode des ausgewählten Tarifwerts. Sie werden als Konfiguration angezeigt; eine persönliche Anwendbarkeit oder Berechnung wird hier nicht bestimmt.</p>
    <p v-if="payGroup || stage" class="tariff-related-selection">Ausgewählte Entgeltgruppe: {{ payGroup?.name || payGroup?.legacyId || '—' }} · Stufe: {{ stage?.name || stage?.legacyId || '—' }}</p>
    <p v-if="!contract && !group && !period" class="tariff-notice">Wähle eine Tarifbasis, um ihre zugehörigen Regeln zu sehen.</p>

    <details v-if="contract" class="tariff-rule-section" data-rule-scope="contract">
      <summary>Vertragsregeln · Tarifvertrag {{ contract.legacyId }} <span class="tariff-muted">({{ contractCount }} Zeilen)</span></summary>
      <div class="tariff-stack">
        <p class="tariff-muted">{{ contract.name || 'Tarifvertrag' }} · Urlaub und Kündigung gehören direkt zum Vertrag. Die historischen Urlaubsstände werden gemeinsam gezeigt.</p>
        <section class="tariff-related-section">
          <h4>Urlaubsstaffeln <span class="tariff-muted">({{ vacationRules.length }} Zeilen · {{ vacationGroups.length }} Regelstände)</span></h4>
          <p v-if="!vacationRules.length" class="tariff-muted">Keine Urlaubsstaffeln importiert.</p>
          <div v-for="stand in vacationGroups" :key="stand.key" class="tariff-related-section">
            <h5>{{ stand.label }} · {{ stand.records.length }} Zeilen</h5>
            <div class="tariff-scroll"><table aria-label="Urlaubsstaffel"><thead><tr><th>Zugehörigkeitsschwelle</th><th>Urlaubstage</th><th>Originalzeile</th></tr></thead><tbody>
              <tr v-for="(rule, index) in stand.records" :key="rowKey(rule, index)"><td>{{ sourceValue(ruleField(rule, 'IJAHR')) }}</td><td>{{ sourceValue(ruleField(rule, 'ITAGE')) }}</td><td><TariffSourceDetails :source="rule.source" /></td></tr>
            </tbody></table></div>
          </div>
          <p v-if="vacationRules.length" class="tariff-muted">Die Zählweise der Zugehörigkeitsschwelle ist im Export nicht erklärt. Aus dieser Übersicht wird kein Urlaubsanspruch berechnet.</p>
        </section>
        <section class="tariff-related-section">
          <h4>Kündigungsfristen <span class="tariff-muted">({{ noticePeriods.length }} Zeilen)</span></h4>
          <p v-if="!noticePeriods.length" class="tariff-muted">Keine Kündigungsfristen importiert.</p>
          <div v-else class="tariff-scroll"><table aria-label="Kündigungsfristen"><thead><tr><th>Beschäftigungsdauer: Schwellenwert</th><th>Kündigungsfrist: Wert</th><th>Originalzeile</th></tr></thead><tbody>
            <tr v-for="(rule, index) in noticePeriods" :key="rowKey(rule, index)"><td>{{ sourceValue(ruleField(rule, 'IANZAHLANG')) }} · Typcode {{ sourceValue(ruleField(rule, 'ITYPANG')) }}</td><td>{{ sourceValue(ruleField(rule, 'IANZAHLKUEND')) }} · Typcode {{ sourceValue(ruleField(rule, 'ITYPKUEND')) }}</td><td><TariffSourceDetails :source="rule.source" /></td></tr>
          </tbody></table></div>
          <p v-if="noticePeriods.length" class="tariff-muted">Einheiten und Bedeutung der Typcodes sind nicht dokumentiert; sie werden unverändert angezeigt.</p>
        </section>
      </div>
    </details>

    <details v-if="group" class="tariff-rule-section" data-rule-scope="variant">
      <summary>Variantenkonfiguration · {{ group.name || 'Tarifvariante' }} <span class="tariff-muted">({{ referenceWages.length }} Zeilen)</span></summary>
      <div class="tariff-stack">
        <p class="tariff-muted">Tarifvariante {{ group.legacyId }} · Diese Ecklohn-Konfiguration gehört zur Variante und wird nicht aus der ausgewählten Entgeltmatrix abgeleitet.</p>
        <h4>Ecklohn-Konfiguration</h4>
        <p v-if="!referenceWages.length" class="tariff-muted">Keine Ecklohn-Konfiguration importiert.</p>
        <div v-else class="tariff-scroll"><table aria-label="Ecklohn-Konfiguration"><thead><tr><th>Gruppenparameter</th><th>Stufenparameter</th><th>Originalzeile</th></tr></thead><tbody>
          <tr v-for="(rule, index) in referenceWages" :key="rowKey(rule, index)"><td>{{ sourceValue(ruleField(rule, 'IGRUPPE')) }}</td><td>{{ sourceValue(ruleField(rule, 'ISTUFE')) }}</td><td><TariffSourceDetails :source="rule.source" /></td></tr>
        </tbody></table></div>
        <p class="tariff-muted">Die Verwendung der Parameter ist ungeklärt. Sie bestimmen hier keinen zusätzlichen Entgeltwert.</p>
      </div>
    </details>

    <details v-if="period" class="tariff-rule-section" data-rule-scope="period" open>
      <summary>Periodenregeln · {{ formatTariffDate(period.validFrom) }} – {{ formatTariffDate(period.validUntil) }} <span class="tariff-muted">({{ periodCount }} Zeilen)</span></summary>
      <div class="tariff-stack">
        <p class="tariff-muted">Tarifperiode {{ period.legacyId }} · Variante {{ group?.name || period.employeeGroupId || '—' }}{{ group?.legacyId ? ` (${group.legacyId})` : '' }}. Die folgenden Regeln stammen ausschließlich aus dieser Periode.</p>
        <section class="tariff-related-section">
          <h4>Lohnartenregeln <span class="tariff-muted">({{ wageGroups.length }} Lohnarten · {{ wageRules.length }} Regelzeilen)</span></h4>
          <p v-if="!wageRules.length" class="tariff-muted">Keine Lohnartenregeln für diese Periode importiert.</p>
          <details v-for="wage in wageGroups" :key="wage.key" class="tariff-related-wage" :data-wage-number="wage.number">
            <summary>Lohnart {{ wage.number }} · {{ wage.records.length }} {{ wage.records.length === 1 ? 'Regel' : 'Regeln' }}</summary>
            <div class="tariff-scroll"><table :aria-label="`Regeln für Lohnart ${wage.number}`"><thead><tr><th>Prozentsatz</th><th>Festbetrag: Quellwert</th><th>Von-/Bis-Grenzen: Quellwerte</th><th>Entgeltgruppenverweis</th><th>Stufenverweis</th><th>Originalzeile</th></tr></thead><tbody>
              <tr v-for="(rule, index) in wage.records" :key="rowKey(rule, index)"><td>{{ ruleDecimal(rule, 'DPROZENT') }}<template v-if="ruleField(rule, 'DPROZENT') !== null"> %</template></td><td>{{ ruleDecimal(rule, 'DFESTBETRAG') }}</td><td>{{ ruleDecimal(rule, 'DAB') }} – {{ ruleDecimal(rule, 'DBIS') }}</td><td>{{ foreignKeyLabel(rule, 'ID_LCS_TARIFGRUPPEN', group?.payGroups || []) }}</td><td>{{ foreignKeyLabel(rule, 'ID_LCS_TARIFSTUFEN', group?.stages || []) }}</td><td><TariffSourceDetails :source="rule.source" /></td></tr>
            </tbody></table></div>
          </details>
          <p v-if="wageRules.length" class="tariff-muted">Mehrere Regeln derselben Lohnart bleiben getrennt erhalten. Lohnartnamen fehlen im Export. Grenzwerte und Quellkennzeichen wie −1 oder 0 entscheiden hier nicht über die Anwendbarkeit; weitere Steuerfelder stehen in den Originalzeilen.</p>
        </section>
        <section class="tariff-related-section">
          <h4>Sonderzahlungen <span class="tariff-muted">({{ specialPayments.length }} Zeilen)</span></h4>
          <p v-if="!specialPayments.length" class="tariff-muted">Keine Sonderzahlungsregeln für diese Periode importiert.</p>
          <div v-else class="tariff-scroll"><table aria-label="Sonderzahlungsregeln"><thead><tr><th>Sonderzahlung</th><th>Stichtag</th><th>Auszahlungsmonat</th><th>Lohnart</th><th>Mindestmitgliedschaft</th><th>Originalzeile</th></tr></thead><tbody>
            <tr v-for="(rule, index) in specialPayments" :key="rowKey(rule, index)"><td>{{ sourceValue(ruleField(rule, 'CBEZEICHNUNG')) }}</td><td>{{ sourceValue(ruleField(rule, 'CSTICHTAG1')) }}</td><td>{{ ruleMonth(rule) }}</td><td>{{ sourceValue(ruleField(rule, 'ILOHNARTNR')) }}</td><td>{{ sourceValue(ruleField(rule, 'MINMITGLIEDSCHAFTMONATE')) }}<template v-if="ruleField(rule, 'MINMITGLIEDSCHAFTMONATE') !== null"> Monate</template></td><td><TariffSourceDetails :source="rule.source" /></td></tr>
          </tbody></table></div>
          <p v-if="specialPayments.length" class="tariff-muted">Die Zeilen beschreiben Auszahlungsregeln; konkrete Sonderzahlungsbeträge stehen in dieser Tabelle nicht.</p>
        </section>
        <section class="tariff-related-section">
          <h4>Einsatzzulagen <span class="tariff-muted">({{ assignmentAllowances.length }} Zeilen)</span></h4>
          <p v-if="!assignmentAllowances.length" class="tariff-muted">Keine Einsatzzulagen für diese Periode importiert.</p>
          <div v-else class="tariff-scroll"><table aria-label="Einsatzzulagen"><thead><tr><th>Entgeltgruppenbereich</th><th>Stufenbereich</th><th>Einsatzdauer: Monatsschwelle</th><th>Zeit seit Eintritt: Monatsschwelle</th><th>Zulagenwert</th><th>Originalzeile</th></tr></thead><tbody>
            <tr v-for="(rule, index) in assignmentAllowances" :key="rowKey(rule, index)"><td>{{ matrixRangeLabel(rule, 'IGRUPPEAB', 'IGRUPPEBIS', group?.payGroups || [], 'IY') }}</td><td>{{ matrixRangeLabel(rule, 'ISTUFEAB', 'ISTUFEBIS', group?.stages || [], 'IX') }}</td><td>{{ sourceValue(ruleField(rule, 'IABMONATEEINSATZ')) }}</td><td>{{ sourceValue(ruleField(rule, 'IABMONATEEINTRITT')) }}</td><td>{{ ruleDecimal(rule, 'DZULAGE') }}</td><td><TariffSourceDetails :source="rule.source" /></td></tr>
          </tbody></table></div>
          <p v-if="assignmentAllowances.length" class="tariff-muted">Die Gruppen- und Stufenbereiche werden über die Matrixpositionen benannt. Verknüpfung der beiden Monatsschwellen und Einheit des Zulagenwerts sind nicht dokumentiert.</p>
        </section>
      </div>
    </details>
  </InformationCard>
</template>

<script setup>
import { computed } from 'vue';
import InformationCard from '@/components/ui-elements/InformationCard.vue';
import TariffSourceDetails from './TariffSourceDetails.vue';
import { formatTariffDate, sourceValue } from './tariffDisplay';
import { foreignKeyLabel, groupVacationRules, groupWageRules, matrixRangeLabel, ruleDecimal, ruleField, ruleMonth } from './tariffRelatedRules';

const props = defineProps({
  contract: { type: Object, default: null },
  group: { type: Object, default: null },
  period: { type: Object, default: null },
  payGroup: { type: Object, default: null },
  stage: { type: Object, default: null },
});
const vacationRules = computed(() => props.contract?.vacationRules || []);
const noticePeriods = computed(() => props.contract?.noticePeriods || []);
const referenceWages = computed(() => props.group?.referenceWages || []);
const wageRules = computed(() => props.period?.wageRules || []);
const specialPayments = computed(() => props.period?.specialPayments || []);
const assignmentAllowances = computed(() => props.period?.assignmentAllowances || []);
const vacationGroups = computed(() => groupVacationRules(vacationRules.value));
const wageGroups = computed(() => groupWageRules(wageRules.value));
const contractCount = computed(() => vacationRules.value.length + noticePeriods.value.length);
const periodCount = computed(() => wageRules.value.length + specialPayments.value.length + assignmentAllowances.value.length);
const totalCount = computed(() => contractCount.value + referenceWages.value.length + periodCount.value);
const rowKey = (record, index) => `${record.legacyId || record.source?.row || 'rule'}:${index}`;
</script>

<style scoped>
.tariff-related-rules :deep(.information-card__header) { flex-wrap: wrap; }
.tariff-related-rules .tariff-related-section { display: grid; gap: 10px; min-width: 0; }
.tariff-related-rules h4, .tariff-related-rules h5 { margin: 0; line-height: 1.5; font-size: .9rem; font-weight: 600; }
.tariff-related-rules h5 { color: var(--muted); font-size: .82rem; }
.tariff-related-selection { font-size: .88rem; }
.tariff-related-wage { border: 1px solid var(--border); border-radius: var(--control-radius, 6px); padding: 10px; min-width: 0; }
.tariff-related-wage > summary { font-weight: 500; }
</style>
