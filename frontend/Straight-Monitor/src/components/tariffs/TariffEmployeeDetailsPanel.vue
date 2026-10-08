<template>
  <SidePanelFrame
    :model-value="Boolean(employee)"
    :title="history?.employee?.employeeName || employee?.employeeName || 'Mitarbeiter-Tarifdetails'"
    :subtitle="`Tarifdetails · Personalnummer ${employee?.personalNr || '—'}`"
    width="560px"
    @update:model-value="!$event && emit('close')"
  >
    <div class="tariff-stack tariff-employee-details">
      <p v-if="historyLoading" role="status">Mitarbeiterhistorie wird geladen …</p>
      <p v-if="historyError" class="tariff-alert" role="alert">{{ historyError }}</p>
      <template v-if="history">
        <p v-if="employee?.location" class="tariff-muted">Standort {{ employee.location.nameFull || employee.location.shortName }}</p>
        <form v-if="history.employee?.employeeId" class="tariff-toolbar" @submit.prevent="emit('resolve')">
          <label class="tariff-field tariff-field--date">Stichtag<AppTextInput :model-value="date" type="date" required @update:model-value="emit('update:date', $event)" /></label>
          <AppButton type="submit" :loading="rateLoading" :disabled="!date">Grundwert abfragen</AppButton>
        </form>
        <p v-else class="tariff-notice">Die Grundwertabfrage ist erst bei einer eindeutigen Mitarbeiterzuordnung verfügbar.</p>
        <p v-if="rateLoading" role="status">Tariflohn wird geladen …</p>
        <p v-if="rateError" class="tariff-alert" role="alert">{{ rateError }}</p>
        <template v-if="rate">
          <dl v-if="rate.status === 'RESOLVED'" class="tariff-meta tariff-employee-details__wage">
            <div><dt>Tariflohn</dt><dd>{{ formatTariffDecimal(rate.value, true) }}</dd></div>
            <div><dt>Entgeltgruppe</dt><dd>{{ rate.payGroup?.name || '—' }}</dd></div>
            <div v-if="aboveValue !== null"><dt>ÜTZ</dt><dd>{{ formatTariffDecimal(aboveValue, true) }}</dd></div>
            <div v-if="total !== null"><dt>Summe (Tariflohn + ÜTZ)</dt><dd>{{ formatTariffDecimal(total, true) }}</dd></div>
          </dl>
          <p v-if="tariffSelectionNotice(rate.assignmentSelection)" class="tariff-notice">{{ tariffSelectionNotice(rate.assignmentSelection) }}</p>
          <p v-if="tariffSelectionNotice(rate.allowanceSelection, 'ÜTZ')" class="tariff-notice">{{ tariffSelectionNotice(rate.allowanceSelection, 'ÜTZ') }}</p>
          <p v-if="(rate.allowances || []).length > 1" class="tariff-notice">Mehrere ÜTZ-Einträge gelten am Stichtag. Die ÜTZ und die Summe müssen geklärt werden.</p>
          <details class="tariff-rule-section" :open="rate.status !== 'RESOLVED'">
            <summary>Herleitung des Tariflohns</summary>
            <TariffResolutionPath :contract="history.contract" :assignment="rate.assignment" :group="rate.group" :period="rate.period" :pay-group="rate.payGroup" :stage="rate.stage" :date="rate.date" :value="rate.value" :status="rate.status" :message="rate.message" show-sources />
            <p v-if="rate.code" class="tariff-muted">Klärungshinweis: {{ rate.code }}</p>
          </details>
          <TariffSourceTable title="ÜTZ am Stichtag" :records="rate.allowances || []" />
        </template>

        <section class="tariff-stack" aria-label="Historische Tarifzuordnungen">
          <h3>Tarifzuordnungen · {{ history.assignments?.length || 0 }}</h3>
          <p v-if="!history.assignments?.length" class="tariff-notice">Keine Tarifzuordnung für diesen Mitarbeiter im aktiven Tarifstand.</p>
          <p v-if="hasIneffectiveIntervals" class="tariff-notice">Unwirksame Zeiträume bleiben mit ihren Originalwerten in der Historie erhalten. Sie werden bei der Stichtagsabfrage nicht berücksichtigt.</p>
          <InformationCard v-for="(assignment, index) in history.assignments || []" :key="`${assignment.legacyId}:${index}`" :highlighted="assignment.legacyId === rate?.assignment?.legacyId" class="tariff-employee-assignment">
            <template v-if="assignment.legacyId === rate?.assignment?.legacyId" #legend>Für den Stichtag verwendet</template>
            <template #title>{{ formatTariffDate(assignment.validFrom) }} – {{ formatTariffDate(assignment.validUntil) }}</template>
            <template #actions><TariffIntervalStatus :status="assignment.intervalStatus" /></template>
            <dl class="tariff-meta">
              <div><dt>Tarifvariante</dt><dd>{{ groupFor(assignment)?.name || assignment.employeeGroupId }}</dd></div>
              <div><dt>Entgeltgruppe</dt><dd>{{ groupFor(assignment)?.payGroups?.find(entry => entry.legacyId === assignment.payGroupId)?.name || assignment.payGroupId }}</dd></div>
              <div><dt>Stufe</dt><dd>{{ groupFor(assignment)?.stages?.find(entry => entry.legacyId === assignment.stageId)?.name || assignment.stageId }}</dd></div>
              <div><dt>Ursprüngliche Personalnummer</dt><dd>{{ assignment.personalNr }}</dd></div>
            </dl>
            <AppButton v-if="assignment.intervalStatus !== 'INEFFECTIVE'" size="sm" variant="ghost" @click="emit('select-date', assignment.validFrom)">Am Beginn anzeigen</AppButton>
            <TariffSourceDetails :source="assignment.source" />
          </InformationCard>
        </section>
        <details class="tariff-rule-section" :open="hasIneffectiveIntervals">
          <summary>Individuelle ÜTZ: eigenständige Historie ({{ history.allowances?.length || 0 }})<span v-if="ineffectiveAllowanceCount"> · {{ ineffectiveAllowanceCount }} unwirksam</span></summary>
          <div class="tariff-stack">
            <p v-if="!history.allowances?.length" class="tariff-muted">Keine individuellen ÜTZ-Einträge importiert.</p>
            <InformationCard v-for="(allowance, index) in history.allowances || []" :key="`${allowance.legacyId}:${index}`" class="tariff-employee-assignment">
              <template #title>{{ formatTariffDate(allowance.validFrom) }} – {{ formatTariffDate(allowance.validUntil) }}</template>
              <template #actions><TariffIntervalStatus :status="allowance.intervalStatus" /></template>
              <dl class="tariff-meta">
                <div><dt>Ursprüngliche Personalnummer</dt><dd>{{ allowance.personalNr }}</dd></div>
                <div v-for="(value, field) in allowance.values || {}" :key="field"><dt>{{ allowanceLabels[field] || field }}</dt><dd>{{ formatTariffDecimal(value) }}</dd></div>
              </dl>
              <TariffSourceDetails :source="allowance.source" />
            </InformationCard>
          </div>
        </details>
        <TariffRelatedRules :contract="history.contract" :group="rate?.group" :period="rate?.period" :pay-group="rate?.payGroup" :stage="rate?.stage" />
        <details v-for="group in otherGroups" :key="group.legacyId" class="tariff-rule-section">
          <summary>Weitere historische Tarifvariante · {{ group.name }}</summary>
          <TariffRelatedRules :group="group" />
          <TariffSourceDetails :source="group.source" />
        </details>
      </template>
    </div>
  </SidePanelFrame>
</template>

<script setup>
import { computed } from 'vue';
import SidePanelFrame from '@/components/frames/SidePanelFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import InformationCard from '@/components/ui-elements/InformationCard.vue';
import TariffSourceDetails from './TariffSourceDetails.vue';
import TariffSourceTable from './TariffSourceTable.vue';
import TariffIntervalStatus from './TariffIntervalStatus.vue';
import TariffResolutionPath from './TariffResolutionPath.vue';
import TariffRelatedRules from './TariffRelatedRules.vue';
import { formatTariffDate, formatTariffDecimal, tariffSelectionNotice } from './tariffDisplay';
import { decimalSum } from './tariffRelations';

const props = defineProps({
  employee: { type: Object, default: null }, history: { type: Object, default: null }, rate: { type: Object, default: null },
  date: { type: String, default: '' }, historyLoading: Boolean, rateLoading: Boolean,
  historyError: { type: String, default: '' }, rateError: { type: String, default: '' },
});
const emit = defineEmits(['close', 'resolve', 'update:date', 'select-date']);
const allowanceLabels = { DPREIS: 'Individuelle ÜTZ (DPREIS)', DPREISPROD: 'Produktion (DPREISPROD)', DEINSATZZULAGE: 'Einsatzzulage (Quellwert)', DPREISGEHALT: 'Gehalt (DPREISGEHALT)' };
const hasIneffectiveIntervals = computed(() => [...(props.history?.assignments || []), ...(props.history?.allowances || [])].some(entry => entry.intervalStatus === 'INEFFECTIVE'));
const ineffectiveAllowanceCount = computed(() => (props.history?.allowances || []).filter(entry => entry.intervalStatus === 'INEFFECTIVE').length);
const otherGroups = computed(() => (props.history?.groups || []).filter(group => group.legacyId !== props.rate?.group?.legacyId));
const aboveValue = computed(() => props.rate?.allowances?.length === 1 ? props.rate.allowances[0].values?.DPREIS ?? null : null);
const total = computed(() => props.rate?.status === 'RESOLVED' && aboveValue.value !== null ? decimalSum(props.rate.value, aboveValue.value) : null);
const groupFor = assignment => props.history?.groups?.find(group => group.legacyId === assignment.employeeGroupId);
</script>

<style scoped>
.tariff-employee-details { min-width: 0; }
.tariff-employee-details__wage { padding: 12px; background: var(--panel); border-radius: var(--control-radius, 8px); }
.tariff-employee-details__wage dd { font-weight: 600; }
.tariff-employee-assignment :deep(.information-card__header) { flex-wrap: wrap; }
</style>
