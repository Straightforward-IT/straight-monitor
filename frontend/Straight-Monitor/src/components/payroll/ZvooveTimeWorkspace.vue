<template>
  <section class="zvoove-workspace" aria-label="Monatsstunden und geplante Schichten" :aria-busy="loading">
    <div class="zvoove-workspace__layout" :class="{ 'zvoove-workspace__layout--solo': informationHidden }">
      <div class="zvoove-workspace__hours">
        <div class="zvoove-workspace__matrix">
          <div :inert="loading" :aria-hidden="loading || undefined">
            <TimeMonthMatrix imported readonly :month="month" :entries="entries" :planned-entries="plannedEntries" :selected-date="selectedDate" @select-day="$emit('selectDay', $event)">
              <template #heading-actions>
                <AppIconButton v-if="informationHidden" label="Informationen einblenden" variant="ghost" size="sm" @click="setInformationHidden(false)"><FontAwesomeIcon :icon="faAnglesRight" /></AppIconButton>
              </template>
            </TimeMonthMatrix>
          </div>
          <div v-if="loading" class="zvoove-workspace__loading" role="status">Monatsstunden werden geladen …</div>
        </div>
        <PayrollWageTypesSection :month="month" :selected-date="selectedDate" :positions="positions" :loading="positionsLoading || loading" :error="positionsError" :has-access="positionsAccess" @clear-day="$emit('clearDay')" />
      </div>
      <aside v-if="!informationHidden" class="zvoove-information" aria-label="Importierte Stunden und Tariflohn">
        <header class="zvoove-information__heading">
          <AppIconButton label="Informationen ausblenden" variant="ghost" size="sm" @click="setInformationHidden(true)"><FontAwesomeIcon :icon="faAnglesLeft" /></AppIconButton>
          <h2>Informationen</h2><span>Zvoove-Stunden</span>
        </header>
        <AppTabs v-model="informationTab" class="zvoove-information__tabs" :tabs="informationTabs" label="Informationen" size="sm" variant="compact" />
        <template v-if="informationTab === 'contingent'">
          <HoverDataCard inline hide-header :data="hoursOverview" :loading="loading || contingentLoading" />
          <p class="zvoove-information__notice">Stunden und Kennzeichen aus Zvoove. Die Summen enthalten keine zusätzliche Lohn- oder Zeitkontoberechnung.<template v-if="hoursOverview.type === 'days-hours'"> Das Tageskontingent beruht weiterhin auf Einsätzen und Vorarbeitgebertagen.</template></p>
        </template>
        <div v-else class="zvoove-information__wage"><EmployeeTariffWage compact :employee-id="String(employee.id || '')" :date="tariffDate" active /></div>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faAnglesLeft, faAnglesRight } from '@fortawesome/free-solid-svg-icons';
import TimeMonthMatrix from '@/components/ui-elements/TimeMonthMatrix.vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTabs from '@/components/ui-elements/AppTabs.vue';
import EmployeeTariffWage from '@/components/tariffs/EmployeeTariffWage.vue';
import PayrollWageTypesSection from '@/components/payroll/PayrollWageTypesSection.vue';
import { buildPayrollHoursOverview } from '@/utils/payrollHoursOverview';

const props = defineProps({ employee: { type: Object, required: true }, month: { type: String, required: true }, entries: { type: Array, default: () => [] }, plannedEntries: { type: Array, default: () => [] }, totals: { type: Object, default: () => ({ hours: '0', byCode: [] }) }, selectedDate: { type: String, default: '' }, contingentData: { type: Object, default: null }, contingentLoading: Boolean, loading: Boolean, positions: { type: Object, default: null }, positionsLoading: Boolean, positionsError: { type: String, default: '' }, positionsAccess: Boolean });
defineEmits(['selectDay', 'clearDay']);
const hoursOverview = computed(() => buildPayrollHoursOverview(props));
const informationTabs = [{ id: 'contingent', label: 'Kontingent' }, { id: 'wage', label: 'Lohn' }];
const informationTab = ref('contingent');
const informationHiddenKey = 'timeManagement.informationHidden';
const informationHidden = ref(readInformationHidden());
function readInformationHidden() { try { return localStorage.getItem(informationHiddenKey) === '1'; } catch { return false; } }
function setInformationHidden(value) { informationHidden.value = value; try { localStorage.setItem(informationHiddenKey, value ? '1' : '0'); } catch { /* Speicher nicht verfügbar */ } }
const tariffDate = computed(() => {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  if (today.startsWith(props.month)) return today;
  const [year, month] = props.month.split('-').map(Number);
  return `${props.month}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
});
</script>

<style scoped>
.zvoove-workspace { min-width: 0; }
.zvoove-workspace__layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 34%); align-items: start; gap: 14px; }
.zvoove-workspace__layout--solo { grid-template-columns: minmax(0, 1fr); }
.zvoove-workspace__hours { min-width: 0; }
.zvoove-workspace__matrix { position: relative; }
.zvoove-workspace__loading { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; padding: 16px; border: 1px solid var(--border); border-radius: 6px; background: color-mix(in srgb, var(--surface) 95%, transparent); color: var(--muted); font-size: 12px; }
.zvoove-information { min-width: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: var(--surface); }
.zvoove-information__heading { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--hover); border-bottom: 1px solid var(--border); }
.zvoove-information__heading h2 { margin: 0; font-size: 12px; }
.zvoove-information__heading > span { margin-left: auto; font-size: 10px; color: var(--muted); }
.zvoove-information :deep(.zvoove-information__tabs) { border-bottom: 1px solid var(--border); padding: 6px 10px; }
.zvoove-information__wage { padding: 12px; }
.zvoove-information__notice { margin: 0; padding: 10px 12px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--border); }
@container payroll-main (max-width: 850px) { .zvoove-workspace__layout { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 700px) { .zvoove-workspace__layout { grid-template-columns: minmax(0, 1fr); } }
</style>
