<template>
  <div v-if="active && isAdmin && employeeId" class="employee-tariff-wage" aria-label="Tariflohn und ÜTZ" :aria-busy="loading">
    <div class="employee-tariff-wage__heading">
      <span>Tarif am {{ formatTariffDate(date) }}</span>
      <AppButton v-if="error" size="sm" variant="ghost" @click="reload">Erneut versuchen</AppButton>
    </div>
    <p v-if="loading" role="status">Tariflohn wird geladen …</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="data">
      <dl class="employee-tariff-wage__values">
        <div><dt>Tariflohn</dt><dd data-wage="base">{{ resolved ? formatTariffDecimal(data.baseRate.value, true) : 'Klärung erforderlich' }}</dd></div>
        <div><dt>Entgeltgruppe</dt><dd data-wage="group">{{ data.baseRate?.payGroup?.name || 'Nicht eindeutig zugeordnet' }}</dd></div>
        <div><dt>ÜTZ</dt><dd data-wage="above">{{ aboveTariffValue !== null ? formatTariffDecimal(aboveTariffValue, true) : 'Klärung erforderlich' }}</dd></div>
        <div v-if="total !== null"><dt>Summe (Tariflohn + ÜTZ)</dt><dd data-wage="total">{{ formatTariffDecimal(total, true) }}</dd></div>
      </dl>
      <p v-if="!resolved" class="employee-tariff-wage__notice" role="status">{{ data.baseRate?.message || 'Der Tariflohn konnte nicht eindeutig ermittelt werden.' }}</p>
      <p v-if="aboveTariffNotice" class="employee-tariff-wage__notice" role="status">{{ aboveTariffNotice }}</p>
      <p v-if="resolved && data.baseRate?.group" class="employee-tariff-wage__context">{{ data.baseRate.group.name }}<template v-if="data.baseRate.stage?.name"> · {{ data.baseRate.stage.name }}</template></p>
      <p v-if="tariffSelectionNotice(data.baseRate?.assignmentSelection)" class="employee-tariff-wage__context">{{ tariffSelectionNotice(data.baseRate.assignmentSelection) }}</p>
      <p v-if="tariffSelectionNotice(data.aboveTariff?.selection, 'ÜTZ')" class="employee-tariff-wage__context">{{ tariffSelectionNotice(data.aboveTariff.selection, 'ÜTZ') }}</p>
      <p v-if="total !== null" class="employee-tariff-wage__context">Die Summe enthält den Tariflohn und die ausgewiesene ÜTZ.</p>
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useAuth } from '@/stores/auth';
import api from '@/utils/api';
import AppButton from '@/components/ui-elements/AppButton.vue';
import { formatTariffDate, formatTariffDecimal, todayInBerlin, tariffSelectionNotice } from './tariffDisplay';
import { useTariffRequest } from './useTariffRequest';
import { decimalSum } from './tariffRelations';

const props = defineProps({ employeeId: { type: String, default: '' }, active: { type: Boolean, default: true }, date: { type: String, default: todayInBerlin } });
const auth = useAuth();
const isAdmin = computed(() => [auth.user?.role, ...(Array.isArray(auth.user?.roles) ? auth.user.roles : [])].some(role => String(role || '').toUpperCase() === 'ADMIN'));
const { data, loading, error, run, clear } = useTariffRequest();
const resolved = computed(() => data.value?.baseRate?.status === 'RESOLVED' && data.value.baseRate.value != null);
const hasAboveTariff = computed(() => data.value?.aboveTariff?.status === 'RESOLVED' && ![null, undefined, ''].includes(data.value.aboveTariff.values?.DPREIS));
const aboveTariffValue = computed(() => {
  const above = data.value?.aboveTariff;
  if (above?.code === 'ABOVE_TARIFF_MISSING') return '0';
  if (above?.status === 'RESOLVED') return hasAboveTariff.value ? above.values.DPREIS : '0';
  return null;
});
const total = computed(() => resolved.value && aboveTariffValue.value !== null ? decimalSum(data.value.baseRate.value, aboveTariffValue.value) : null);
const aboveTariffNotice = computed(() => {
  const above = data.value?.aboveTariff;
  if (!above || above.code === 'ABOVE_TARIFF_MISSING' || above.code === 'NO_ACTIVE_IMPORT') return '';
  if (above.status === 'RESOLVED' && !hasAboveTariff.value) return 'Kein individueller ÜTZ-Betrag hinterlegt; für die Summe wird 0,00 € verwendet.';
  return above.status !== 'RESOLVED' ? above.message || 'Die ÜTZ konnte nicht eindeutig ermittelt werden.' : '';
});
function reload() {
  if (!props.active || !isAdmin.value || !props.employeeId || !props.date) { clear(); return; }
  return run(signal => api.get(`/api/tariffs/employees/${encodeURIComponent(props.employeeId)}/wage-info`, { signal, params: { date: props.date } }));
}
// This also clears a completed value on employee changes or role revocation.
watch([() => props.employeeId, () => props.date, () => props.active, isAdmin, () => auth.user?.id, () => auth.user?._id], reload, { immediate: true });
</script>

<style scoped>
.employee-tariff-wage { display: grid; gap: 8px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border); min-width: 0; }
.employee-tariff-wage__heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; }
.employee-tariff-wage__values { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin: 0; }
.employee-tariff-wage__values > div { min-width: 0; }
.employee-tariff-wage dt { font-size: 10px; font-weight: 600; color: var(--muted); }
.employee-tariff-wage dd { font-size: 13px; font-weight: 600; margin: 3px 0 0; overflow-wrap: anywhere; }
.employee-tariff-wage p { margin: 0; font-size: 12px; line-height: 1.5; }
.employee-tariff-wage .employee-tariff-wage__context { color: var(--muted); font-size: 11px; }
.employee-tariff-wage__notice { padding: 8px 10px; background: var(--tile-bg); border-radius: var(--control-radius, 6px); }
</style>
