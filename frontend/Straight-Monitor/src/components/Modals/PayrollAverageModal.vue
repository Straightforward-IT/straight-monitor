<template>
  <ModalFrame :model-value="modelValue" title="Stunden-Schnittberechnung Monat" :subtitle="employeeName" size="full" class="payroll-average-modal" @update:model-value="$emit('update:modelValue', $event)">
    <form class="payroll-average__controls" @submit.prevent="load">
      <label>Stichtag<AppTextInput v-model="cutoff" type="date" required /></label>
      <label class="payroll-average__count">Monate<AppTextInput v-model="count" type="number" min="1" max="12" step="1" required /></label>
      <label>Durchschnittsspeicher<AppTextInput model-value="1 · SP1" readonly /></label>
      <label>Personal-Nr.<AppTextInput :model-value="data?.employee?.personalNr || personalNr" readonly /></label>
      <AppButton type="submit" :disabled="loading || !employeeId">{{ loading ? 'Wird aufbereitet …' : 'Aufbereiten' }}</AppButton>
    </form>
    <p class="payroll-average__hint">Berücksichtigt werden die vollständigen Kalendermonate vor dem Stichtagsmonat. Grundlage: historische AUSWEISLOHN-Positionen der Lohnseite und SP1.</p>
    <p v-if="error" role="alert" class="payroll-average__error">{{ error }}</p>
    <p v-if="loading" role="status">Historische Lohnpositionen und Arbeitstage werden geladen …</p>
    <template v-if="data">
      <p class="payroll-average__period">{{ data.months.map(value => monthLabel(value)).join(' · ') }} <span>{{ data.sources.map(source => source.filename).join(', ') }}</span></p>
      <section class="payroll-average__section payroll-average__section--wages" aria-label="Lohnarten im Durchschnitt">
        <h4>Lohnarten</h4>
        <div class="payroll-average__scroll payroll-average__scroll--wages" tabindex="0" aria-label="Lohnarten nach Monaten">
          <table>
            <thead><tr><TableSortHeader v-for="column in wageColumns" :key="column.key" :data-sort-key="column.key" :label="column.label" :sort="wageTable.ariaSort(column.key)" :class="{ number: column.right }" @sort="wageTable.toggle(column.key)" /></tr></thead>
            <tbody>
              <tr v-for="row in sortedWages" :key="`${row.month}:${row.personalNr}:${row.wageType}`">
                <td>{{ row.month.slice(0, 4) }}</td><td>{{ monthLabel(row.month, false) }}</td><td>{{ row.personalNr }}</td><td><button type="button" class="payroll-average__wage-link" :aria-label="`Lohnart ${row.wageType} öffnen`" @click="openLohnart(row.wageType)">{{ row.wageType }}</button></td><td>{{ row.label }}</td><td :title="row.rule">{{ row.sp1 ?? 'Offen' }}</td><td class="number">{{ number(row.hours) }}</td><td class="number">{{ number(row.amount) }}</td>
              </tr>
              <tr v-if="!data.rows.length"><td colspan="8">Keine berücksichtigten Lohnpositionen im Zeitraum vorhanden.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="payroll-average__section" aria-label="Arbeitstage im Durchschnitt">
        <h4>Werktage (Montag–Freitag)</h4>
        <div class="payroll-average__scroll" tabindex="0" aria-label="Arbeitstage nach Monaten">
          <table>
            <thead><tr><TableSortHeader v-for="column in dayColumns" :key="column.key" :data-sort-key="column.key" :label="column.label" :sort="dayTable.ariaSort(column.key)" :class="{ number: column.right }" @sort="dayTable.toggle(column.key)" /></tr></thead>
            <tbody><tr v-for="row in sortedDays" :key="row.month"><td>{{ row.month.slice(0, 4) }}</td><td>{{ monthLabel(row.month, false) }}</td><td>{{ data.employee.personalNr }}</td><td class="number">{{ number(row.days) }}</td><td class="number">{{ row.fsDays ?? '—' }}</td><td>{{ dayNote(row) }}</td></tr></tbody>
          </table>
        </div>
      </section>
      <section class="payroll-average__section" aria-label="Summen und Durchschnittswerte">
        <h4>Summen</h4>
        <div class="payroll-average__scroll" tabindex="0" aria-label="Ergebnis der Schnittberechnung">
          <table class="payroll-average__totals">
            <thead><tr><th>Summe Stunden</th><th>Summe Werktage</th><th>Summe Betrag €</th><th>Schnitt Stunden</th><th>Schnitt Betrag €/Std.</th><th>Tagessatz €/Tag</th></tr></thead>
            <tbody><tr><td>{{ number(data.totals.hours) }}</td><td>{{ number(data.totals.days) }}</td><td>{{ number(data.totals.amount) }}</td><td>{{ number(data.totals.averageHours) }}</td><td>{{ number(data.totals.averageAmount) }}</td><td>{{ number(data.totals.dailyRate) }}</td></tr></tbody>
          </table>
        </div>
        <p class="payroll-average__hint">Schnitt Stunden = Stunden ÷ Werktage · Schnitt Betrag = Betrag ÷ Stunden · Tagessatz = Betrag ÷ Werktage. Jede Kennzahl wird direkt aus den Summen berechnet und erst für die Anzeige auf zwei Stellen gerundet.</p>
      </section>
      <ul v-if="data.issues.length" class="payroll-average__issues" aria-label="Offene Punkte der Schnittberechnung"><li v-for="(issue, index) in data.issues" :key="index">{{ issue.message }}</li></ul>
    </template>
    <template #footer><AppButton variant="secondary" @click="$emit('update:modelValue', false)">Schließen</AppButton></template>
  </ModalFrame>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import TableSortHeader from '@/components/ui-elements/TableSortHeader.vue';
import api from '@/utils/api';
import { formatImportedHours } from '@/utils/importedHours';
import { sortTableRows } from '@/utils/tableSorting';
import { useLohnartModals } from '@/composables/useLohnartModals';

const props = defineProps({ modelValue: Boolean, employeeId: { type: String, default: '' }, employeeName: { type: String, default: '' }, personalNr: { type: String, default: '' }, month: { type: String, required: true }, accessKey: { type: String, default: '' } });
defineEmits(['update:modelValue']);
const { openLohnart } = useLohnartModals();
const cutoff = ref(`${props.month}-01`), count = ref(3), data = ref(null), error = ref(''), loading = ref(false);
const dayNote = row => row.days == null ? 'Kalenderzählung offen' : 'Alle Montag–Freitag des Kalendermonats';
const dateColumns = [{ key: 'year', label: 'Jahr', numeric: true, value: row => row.month.slice(0, 4) }, { key: 'month', label: 'Monat' }];
const wageColumns = [...dateColumns, { key: 'personalNr', label: 'Personal-Nr.', numeric: true }, { key: 'wageType', label: 'Lohnart-Nr.', numeric: true },
  { key: 'label', label: 'Lohnartbezeichnung' }, { key: 'sp1', label: 'SP1', numeric: true }, { key: 'hours', label: 'Stunden', numeric: true, right: true }, { key: 'amount', label: 'Betrag €', numeric: true, right: true }];
const dayColumns = [...dateColumns, { key: 'personalNr', label: 'Personal-Nr.', numeric: true, value: () => data.value?.employee?.personalNr },
  { key: 'days', label: 'Werktage', numeric: true, right: true }, { key: 'fsDays', label: 'Davon FS', numeric: true, right: true }, { key: 'note', label: 'Hinweis', value: dayNote }];
function tableSort(rows, columns) {
  const key = ref(''), direction = ref('asc');
  return {
    rows: computed(() => sortTableRows(rows(), columns.find(column => column.key === key.value), direction.value)),
    toggle(field) { direction.value = key.value === field && direction.value === 'asc' ? 'desc' : 'asc'; key.value = field; },
    ariaSort(field) { return key.value === field ? direction.value === 'asc' ? 'ascending' : 'descending' : 'none'; },
  };
}
const wageTable = tableSort(() => data.value?.rows || [], wageColumns), dayTable = tableSort(() => data.value?.days || [], dayColumns);
const sortedWages = wageTable.rows, sortedDays = dayTable.rows;
let generation = 0, controller;
function clear() { generation++; controller?.abort(); data.value = null; error.value = ''; loading.value = false; }
async function load() {
  clear();
  if (!props.modelValue || !props.employeeId) return;
  const current = generation; controller = new AbortController(); loading.value = true;
  try {
    const response = await api.get(`/api/payroll/employees/${encodeURIComponent(props.employeeId)}/average`, { params: { cutoff: cutoff.value, months: count.value }, signal: controller.signal });
    if (generation !== current || !props.modelValue) return;
    if (!Array.isArray(response.data?.rows) || !response.data.totals || !Array.isArray(response.data.days)) throw new Error('Schnittdaten fehlen.');
    data.value = response.data;
  } catch (cause) {
    if (generation === current) error.value = cause?.response?.data?.message || 'Die Schnittberechnung konnte nicht geladen werden.';
  } finally { if (generation === current) loading.value = false; }
}
watch([cutoff, count], clear, { flush: 'sync' });
watch(() => [props.modelValue, props.employeeId, props.month, props.accessKey], () => {
  clear();
  if (props.modelValue) { cutoff.value = `${props.month}-01`; count.value = 3; load(); }
}, { immediate: true });
onBeforeUnmount(clear);
const number = value => value == null ? '—' : formatImportedHours(String(value), 2);
const monthLabel = (month, year = true) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', month: 'long', ...(year ? { year: 'numeric' } : {}) });
</script>

<style scoped>
.payroll-average__controls { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; flex-shrink: 0; }
.payroll-average__controls label { display: grid; gap: 5px; color: var(--muted); font-size: 12px; width: 180px; }
.payroll-average__controls .payroll-average__count { width: 80px; }
.payroll-average__hint { margin: 8px 0; font-size: 12px; color: var(--muted); line-height: 1.5; flex-shrink: 0; }
.payroll-average__period { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 12px; flex-shrink: 0; margin: 6px 0; }.payroll-average__period span { color: var(--muted); }
.payroll-average__section { margin: 8px 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; flex-shrink: 0; }
.payroll-average__section--wages { display: flex; flex-direction: column; flex: 1 1 220px; min-height: 138px; }
.payroll-average__section h4 { margin: 0; padding: 6px 12px; background: var(--surface-2, var(--surface)); font-size: 13px; border-bottom: 1px solid var(--border); }
.payroll-average__section--wages h4 { flex-shrink: 0; }
.payroll-average__scroll { overflow: auto; }.payroll-average__scroll--wages { max-height: 33vh; min-height: 0; flex: 1; }
.payroll-average__section table { border-collapse: collapse; width: 100%; font-size: 12px; white-space: nowrap; }
.payroll-average__wage-link { border: 0; padding: 0; background: transparent; color: var(--primary); font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.payroll-average__section th { text-align: left; color: var(--muted); font-weight: 600; background: var(--surface); position: sticky; top: 0; }
.payroll-average__section td, .payroll-average__section th { padding: 6px 12px; border-bottom: 1px solid var(--border); }
.payroll-average__section th.table-sort-header { padding: 0; }
.payroll-average__section th.number :deep(button) { justify-content: flex-end; }
.payroll-average__section tbody tr:nth-child(even) { background: color-mix(in srgb, var(--muted) 5%, transparent); }
.payroll-average__section tbody tr:last-child td { border-bottom: 0; }
.payroll-average__section .number, .payroll-average__totals td, .payroll-average__totals th { text-align: right; font-variant-numeric: tabular-nums; }
.payroll-average__totals td { font-size: 16px; font-weight: 600; padding-top: 10px; padding-bottom: 10px; }
.payroll-average__section > .payroll-average__hint { padding: 0 12px; }
.payroll-average__error, .payroll-average__issues { color: var(--text); background: color-mix(in srgb, var(--warning, #d7a34e) 12%, var(--surface)); padding: 12px 16px; border-radius: 6px; font-size: 12px; }
.payroll-average__issues { padding-left: 30px; line-height: 1.6; }
</style>
