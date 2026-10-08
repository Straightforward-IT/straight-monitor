<template>
  <section class="tariff-stack tariff-overview" :aria-busy="loading">
    <p v-if="error" class="tariff-alert" role="alert">{{ error }}</p>
    <p v-else-if="loading" role="status">Tarifdaten werden geladen …</p>
    <p v-else-if="!catalog?.contract" class="tariff-notice">Es ist noch kein Tarifdatenstand aktiv. Über „Import“ kannst du die 14 Exporttabellen prüfen und aktivieren.</p>
    <template v-else>
      <InformationCard>
        <template #legend>Tarifvertrag {{ catalog.contract.legacyId }}</template>
        <template #title><h2>{{ catalog.contract.name || 'Tarifvertrag' }}</h2></template>
        <template #actions><AppButton variant="ghost" size="sm" :loading="loading" @click="reload">Neu laden</AppButton></template>
        <div class="tariff-overview__contract-body">
          <p>Wähle eine Variante und einen Stichtag. Die Entgeltmatrix zeigt die Grundwerte; ein Klick auf einen Betrag erklärt seine Herkunft.</p>
          <dl class="tariff-overview__counts"><div><dt>Varianten</dt><dd>{{ catalog.groups?.length || 0 }}</dd></div><div><dt>Historische Perioden</dt><dd>{{ catalog.periods?.length || 0 }}</dd></div><div><dt>Entgeltwerte</dt><dd>{{ catalog.counts?.rates ?? allRateCount }}</dd></div></dl>
        </div>
      </InformationCard>

      <div class="tariff-overview__explorer">
        <aside aria-label="Tarifvarianten" class="tariff-overview__variants">
          <InformationCard>
            <template #legend>Gehört zum Tarifvertrag</template><template #title>Tarifvarianten</template>
            <p class="tariff-muted">Jede Variante hat eigene Gruppen, Stufen und Zeiträume.</p>
            <ul class="tariff-overview__variant-list">
              <li v-for="entry in variants" :key="entry.legacyId">
                <AppButton block :variant="groupId === String(entry.legacyId) ? 'outlined' : 'ghost'" class="tariff-overview__variant" :aria-pressed="groupId === String(entry.legacyId)" :data-variant="entry.legacyId" @click="selectGroup(String(entry.legacyId))">
                  <span class="tariff-overview__variant-content"><strong>{{ entry.name || `Variante ${entry.legacyId}` }}</strong><span class="tariff-muted">{{ variantPeriodCount(entry) }} Perioden<span v-if="entry.statusLabel"> · {{ entry.statusLabel }}</span></span></span>
                </AppButton>
              </li>
            </ul>
          </InformationCard>
        </aside>

        <div class="tariff-stack tariff-overview__content">
          <InformationCard v-if="group">
            <template #legend>Ausgewählte Variante</template><template #title><h3>{{ group.name }}</h3></template>
            <label class="tariff-field tariff-overview__compact-variant">Tarifvariante
              <AppSelect :model-value="groupId" aria-label="Tarifvariante auswählen" @update:model-value="selectGroup"><option v-for="entry in variants" :key="entry.legacyId" :value="String(entry.legacyId)">{{ entry.name }}{{ entry.statusLabel ? ` · ${entry.statusLabel}` : '' }}</option></AppSelect>
            </label>
            <div class="tariff-overview__selection">
              <label class="tariff-field tariff-field--date">Stichtag<AppTextInput :model-value="date" type="date" aria-label="Stichtag für die Tarifübersicht" @update:model-value="selectDate" /></label>
              <AppButton size="sm" variant="secondary" @click="selectDate(todayInBerlin())">Heute</AppButton>
              <p class="tariff-muted">{{ payGroups.length }} Entgeltgruppen · {{ stages.length }} {{ stages.length === 1 ? 'Stufe' : 'Stufen' }} · {{ periods.length }} Zeiträume</p>
            </div>
            <p v-if="group.statusLabel" class="tariff-notice">Exportstatus dieser Variante: {{ group.statusLabel }}. Die importierte Historie bleibt einsehbar.</p>
          </InformationCard>

          <TariffResolutionPath v-if="group" :contract="catalog.contract" :group="group" :period="period" :pay-group="payGroup" :stage="stage" :date="date" :value="resolvedValue" :status="resolutionMessage ? 'UNRESOLVED' : 'RESOLVED'" :message="resolutionMessage" />

          <InformationCard v-if="group">
            <template #legend>Zur ausgewählten Tarifvariante</template><template #title>Zeiträume und Entwicklung</template>
            <TariffPeriodTimeline :periods="periods" :model-value="periodId" :date="date" :group-position="payGroup?.position" :stage-position="stage?.position" @update:model-value="selectPeriod" />
          </InformationCard>

          <InformationCard v-if="period && group">
            <template #legend>Entgeltmatrix dieser Periode</template><template #title>Entgeltgruppe × Tarifstufe</template>
            <template #actions><span class="tariff-muted">{{ formatTariffDate(period.validFrom) }} – {{ formatTariffDate(period.validUntil) }}</span></template>
            <p class="tariff-muted">Betrag auswählen, um den Tarifpfad und die Entwicklung dieser Gruppe und Stufe zu sehen.</p>
            <p v-if="priorPeriod" class="tariff-muted">Die Änderung vergleicht denselben Matrixplatz mit der Vorperiode ab {{ formatTariffDate(priorPeriod.validFrom) }}.</p>
            <div class="tariff-scroll">
              <table aria-label="Tarifliche Entgeltmatrix" class="tariff-overview__matrix">
                <thead><tr><th scope="col">Entgeltgruppe</th><th v-for="entry in stages" :key="entry.legacyId" scope="col">{{ entry.name || `Stufe ${entry.position}` }}</th></tr></thead>
                <tbody><tr v-for="entry in payGroups" :key="entry.legacyId" :class="{ 'tariff-selected': String(entry.legacyId) === payGroupId }">
                  <th scope="row">{{ entry.name || `Gruppe ${entry.position}` }}</th>
                  <td v-for="level in stages" :key="level.legacyId">
                    <AppButton class="tariff-overview__cell" :variant="isSelected(entry, level) ? 'outlined' : 'ghost'" :aria-pressed="isSelected(entry, level)" :aria-label="`${entry.name}, ${level.name}: ${cellLabel(entry, level)}`" :data-cell="`${entry.legacyId}:${level.legacyId}`" @click="selectCell(entry, level)">
                      <span class="tariff-overview__cell-content"><strong>{{ cellLabel(entry, level) }}</strong><small v-if="changeLabel(entry, level)" class="tariff-muted">{{ changeLabel(entry, level) }}</small></span>
                    </AppButton>
                  </td>
                </tr></tbody>
              </table>
            </div>
            <details class="tariff-rule-section tariff-overview__provenance"><summary>Herkunft des ausgewählten Werts</summary><div class="tariff-stack">
              <p v-if="payGroup && stage">{{ payGroup.name }} (IY {{ payGroup.position }}) und {{ stage.name }} (IX {{ stage.position }}) verweisen auf {{ selectedRates.length }} {{ selectedRates.length === 1 ? 'Matrixzeile' : 'Matrixzeilen' }} der Periode {{ period.legacyId }}.</p>
              <TariffSourceDetails v-for="(rate, index) in selectedRates" :key="index" :source="rate.source" label="Entgeltwert: Originalzeile" />
              <TariffSourceDetails :source="payGroup?.source" label="Entgeltgruppe: Originalzeile" /><TariffSourceDetails :source="stage?.source" label="Tarifstufe: Originalzeile" /><TariffSourceDetails :source="period.source" label="Tarifperiode: Originalzeile" />
            </div></details>
          </InformationCard>

          <TariffRelatedRules :contract="catalog.contract" :group="group" :period="period" :pay-group="payGroup" :stage="stage" />
        </div>
      </div>
      <details class="tariff-rule-section"><summary>Import und vollständige Quelldaten</summary><div class="tariff-stack">
        <p class="tariff-muted">Aktiver Import: {{ catalog.activeImportId }}</p>
        <TariffSourceDetails :source="catalog.contract.source" label="Tarifvertrag: Quelldaten" /><TariffSourceDetails v-if="group" :source="group.source" label="Tarifvariante: Quelldaten" />
        <TariffSourceTable title="Entgeltgruppen der ausgewählten Variante" :records="group?.payGroups || []" /><TariffSourceTable title="Tarifstufen der ausgewählten Variante" :records="group?.stages || []" /><TariffSourceTable title="Alle Entgeltwerte der ausgewählten Periode" :records="period?.rates || []" />
      </div></details>
    </template>
    <AppButton v-if="error" variant="secondary" :loading="loading" @click="reload">Erneut laden</AppButton>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import api from '@/utils/api';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import InformationCard from '@/components/ui-elements/InformationCard.vue';
import TariffSourceDetails from './TariffSourceDetails.vue';
import TariffSourceTable from './TariffSourceTable.vue';
import TariffPeriodTimeline from './TariffPeriodTimeline.vue';
import TariffResolutionPath from './TariffResolutionPath.vue';
import TariffRelatedRules from './TariffRelatedRules.vue';
import { formatTariffDate, formatTariffDecimal, todayInBerlin } from './tariffDisplay';
import { availableVariant, decimalDifference, matrixMatches, orderedPositions, periodsForVariant, periodsOnDate, previousPeriod } from './tariffRelations';
import { useTariffRequest } from './useTariffRequest';
const props = defineProps({ revision: { type: Number, default: 0 } });
const { data: catalog, loading, error, run } = useTariffRequest();
const groupId = ref(''), periodId = ref(''), payGroupId = ref(''), stageId = ref('');
const date = ref(todayInBerlin());
const variants = computed(() => [...(catalog.value?.groups || [])].sort((a, b) => Number(!availableVariant(a)) - Number(!availableVariant(b)) || String(a.legacyId).localeCompare(String(b.legacyId), 'de', { numeric: true })));
const group = computed(() => catalog.value?.groups?.find(entry => String(entry.legacyId) === groupId.value) || null);
const periods = computed(() => periodsForVariant(catalog.value?.periods, groupId.value));
const matchingPeriods = computed(() => periodsOnDate(periods.value, date.value));
const period = computed(() => periods.value.find(entry => String(entry.legacyId) === periodId.value) || null);
const payGroups = computed(() => orderedPositions(group.value?.payGroups));
const stages = computed(() => orderedPositions(group.value?.stages));
const payGroup = computed(() => payGroups.value.find(entry => String(entry.legacyId) === payGroupId.value) || null);
const stage = computed(() => stages.value.find(entry => String(entry.legacyId) === stageId.value) || null);
const selectedRates = computed(() => matrixMatches(period.value, stage.value?.position, payGroup.value?.position));
const priorPeriod = computed(() => previousPeriod(periods.value, period.value));
const allRateCount = computed(() => (catalog.value?.periods || []).reduce((count, entry) => count + (entry.rates?.length || 0), 0));
const resolutionMessage = computed(() => {
  if (!date.value) return 'Bitte einen Stichtag wählen.';
  if (matchingPeriods.value.length > 1) return `${matchingPeriods.value.length} Tarifperioden gelten an diesem Stichtag. Ein eindeutiger Grundwert kann erst nach Klärung angegeben werden.`;
  if (!matchingPeriods.value.length) return 'Für diesen Stichtag ist keine gültige Tarifperiode importiert. Wähle einen Zeitraum aus der Historie.';
  if (!period.value || !payGroup.value || !stage.value) return 'Periode, Entgeltgruppe und Stufe müssen ausgewählt sein.';
  if (selectedRates.value.length > 1) return 'Der Matrixplatz enthält mehrere Entgeltwerte. Die Zuordnung muss geklärt werden.';
  if (!selectedRates.value.length || selectedRates.value[0].value == null || selectedRates.value[0].value === '') return 'Für diese Entgeltgruppe und Stufe fehlt ein importierter Grundwert.';
  return '';
});
const resolvedValue = computed(() => resolutionMessage.value ? null : selectedRates.value[0].value);
const variantPeriodCount = entry => (catalog.value?.periods || []).filter(period => String(period.employeeGroupId) === String(entry.legacyId)).length;
function selectDate(value) {
  date.value = value;
  const matches = periodsOnDate(periods.value, value);
  periodId.value = matches.length === 1 ? String(matches[0].legacyId) : '';
}
function selectGroup(id) {
  const previousGroupPosition = payGroup.value?.position, previousStagePosition = stage.value?.position;
  groupId.value = id;
  payGroupId.value = String((payGroups.value.find(entry => String(entry.position) === String(previousGroupPosition)) || payGroups.value[0])?.legacyId || '');
  stageId.value = String((stages.value.find(entry => String(entry.position) === String(previousStagePosition)) || stages.value[0])?.legacyId || '');
  selectDate(date.value);
}
function selectPeriod(id) {
  const selected = periods.value.find(entry => String(entry.legacyId) === String(id));
  if (!selected) return;
  if (!(selected.validFrom <= date.value && (!selected.validUntil || selected.validUntil >= date.value))) date.value = selected.validFrom;
  periodId.value = String(id);
}
function selectCell(entry, level) { payGroupId.value = String(entry.legacyId); stageId.value = String(level.legacyId); }
const isSelected = (entry, level) => String(entry.legacyId) === payGroupId.value && String(level.legacyId) === stageId.value;
function cellLabel(entry, level) {
  const rates = matrixMatches(period.value, level.position, entry.position);
  return rates.length > 1 ? 'Mehrdeutig' : !rates.length || rates[0].value == null || rates[0].value === '' ? 'Kein Wert' : formatTariffDecimal(rates[0].value, true);
}
function changeLabel(entry, level) {
  const current = matrixMatches(period.value, level.position, entry.position), previous = matrixMatches(priorPeriod.value, level.position, entry.position);
  if (current.length !== 1 || previous.length !== 1) return '';
  const difference = decimalDifference(current[0].value, previous[0].value);
  return difference === null ? '' : difference === '0' ? 'unverändert' : `${difference.startsWith('-') ? '' : '+'}${formatTariffDecimal(difference, true)} zur Vorperiode`;
}
async function reload() {
  const result = await run(signal => api.get('/api/tariffs/catalog', { signal }));
  if (result) selectGroup(result.groups?.some(entry => String(entry.legacyId) === groupId.value) ? groupId.value : String(variants.value[0]?.legacyId || ''));
}
watch(() => props.revision, reload, { immediate: true });
</script>

<style scoped>
.tariff-overview__contract-body { display: flex; flex-wrap: wrap; gap: 18px 32px; align-items: center; justify-content: space-between; }
.tariff-overview__contract-body > p { flex: 1 1 340px; max-width: 750px; font-size: .9rem; }
.tariff-overview__counts { display: flex; gap: 22px; margin: 0; }
.tariff-overview__counts div { display: flex; flex-direction: column-reverse; gap: 3px; }
.tariff-overview__counts dt { font-size: .75rem; color: var(--muted); }
.tariff-overview__counts dd { font-size: 1.25rem; font-weight: 700; margin: 0; }
.tariff-overview__explorer { display: grid; grid-template-columns: 235px minmax(0, 1fr); gap: 22px; align-items: start; }
.tariff-overview__variants { position: sticky; top: 12px; min-width: 0; }
.tariff-overview .tariff-overview__compact-variant { display: none; }
.tariff-overview__content { min-width: 0; }
.tariff-overview__variant-list { list-style: none; padding: 0; margin: 6px 0 0; display: grid; gap: 4px; }
.tariff-overview__variant { justify-content: flex-start; text-align: left; white-space: normal; padding: 10px; }
.tariff-overview__variant-content { display: grid; gap: 6px; }
.tariff-overview__variant-content strong { line-height: 1.4; font-size: .82rem; }
.tariff-overview__variant-content .tariff-muted { font-size: .73rem; font-weight: 400; }
.tariff-overview__selection { display: flex; align-items: end; gap: 12px; flex-wrap: wrap; }
.tariff-overview__selection .tariff-field { flex: 0 1 190px; }
.tariff-overview__selection > p { margin-left: auto; padding-bottom: 8px; }
.tariff-overview__matrix th { vertical-align: middle; }
.tariff-overview__matrix td { padding: 5px 10px; }
.tariff-overview__cell { width: 100%; justify-content: start; white-space: normal; text-align: left; }
.tariff-overview__cell-content { display: grid; gap: 4px; }
.tariff-overview__cell-content strong { font-size: .95rem; }
.tariff-overview__cell-content small { font-size: .73rem; font-weight: 400; }
.tariff-overview__provenance { margin-top: 6px; }
@media (max-width: 1000px) { .tariff-overview__explorer { grid-template-columns: 1fr; } .tariff-overview__variants { display: none; } .tariff-overview .tariff-overview__compact-variant { display: grid; flex: none; margin-bottom: 10px; } .tariff-overview__variant-list { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); } .tariff-overview__variant { height: 100%; } }
@media (max-width: 580px) { .tariff-overview__variant-list { grid-template-columns: 1fr; } .tariff-overview__counts { gap: 18px; } .tariff-overview__selection > p { margin-left: 0; } }
</style>
