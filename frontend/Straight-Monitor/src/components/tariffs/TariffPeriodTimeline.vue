<template>
  <section class="tariff-period-timeline" aria-label="Chronologische Tarifperioden">
    <div class="tariff-period-timeline__toolbar">
      <div>
        <h3>Tarifperioden im Zeitverlauf</h3>
        <p class="tariff-period-timeline__muted">{{ periods.length }} Perioden · chronologisch vom ältesten zum neuesten Beginn</p>
      </div>
      <label v-if="years.length > 1" class="tariff-period-timeline__filter">
        Beginn im Jahr
        <AppSelect v-model="year" size="sm" aria-label="Tarifperioden nach Beginn im Jahr filtern">
          <option value="">Alle Jahre</option>
          <option v-for="entry in years" :key="entry" :value="entry">{{ entry }}</option>
        </AppSelect>
      </label>
    </div>

    <div v-if="selected" class="tariff-period-timeline__selection" aria-live="polite">
      <span class="tariff-period-timeline__muted">Ausgewählte Tarifperiode</span>
      <strong>{{ formatTariffDate(selected.validFrom) }} – {{ formatTariffDate(selected.validUntil) }} · {{ selected.legacyId }}</strong>
      <span v-if="hasCell" class="tariff-period-timeline__selection-rate">{{ cellLabel(selected) }}</span>
      <span v-if="year && startYear(selected) !== year" class="tariff-period-timeline__muted">Die gewählte Periode liegt außerhalb des Jahresfilters.</span>
    </div>
    <p v-if="date && matchingCount > 1" class="tariff-period-timeline__notice">{{ matchingCount }} Tarifperioden gelten am {{ formatTariffDate(date) }}. Die Stichtagszuordnung ist nicht eindeutig; jede Periode kann einzeln angesehen werden.</p>
    <p v-else-if="date && periods.length && matchingCount === 0" class="tariff-period-timeline__muted">Keine Tarifperiode gilt am {{ formatTariffDate(date) }}.</p>
    <p v-if="hasCell" class="tariff-period-timeline__muted">Grundwert für IX {{ stagePosition }} / IY {{ groupPosition }} je Tarifperiode</p>
    <p v-if="!periods.length" class="tariff-period-timeline__muted">Keine importierten Tarifperioden für diese Variante.</p>

    <div v-else ref="track" class="tariff-period-timeline__track">
      <ol class="tariff-period-timeline__periods">
        <li v-for="period in visiblePeriods" :key="period.legacyId" :ref="(element) => setPeriodElement(period.legacyId, element)" class="tariff-period-timeline__entry" :class="{ 'tariff-period-timeline__entry--matching': matchesDate(period) }">
          <AppButton
            class="tariff-period-timeline__button"
            :variant="String(period.legacyId) === modelValue ? 'outlined' : 'secondary'"
            :aria-pressed="String(period.legacyId) === modelValue"
            :aria-label="periodLabel(period)"
            @click="$emit('update:modelValue', String(period.legacyId))"
          >
            <span class="tariff-period-timeline__card">
              <span class="tariff-period-timeline__dates"><time v-if="period.validFrom" :datetime="dateOnly(period.validFrom)">{{ formatTariffDate(period.validFrom) }}</time><span v-else>offen</span><span aria-hidden="true"> – </span><time v-if="period.validUntil" :datetime="dateOnly(period.validUntil)">{{ formatTariffDate(period.validUntil) }}</time><span v-else>offen</span></span>
              <span class="tariff-period-timeline__id">Tarifzeit {{ period.legacyId }}</span>
              <strong v-if="hasCell" class="tariff-period-timeline__rate">{{ cellLabel(period) }}</strong>
              <span v-if="matchesDate(period)" class="tariff-period-timeline__date-match">Gültig am {{ formatTariffDate(date) }}</span>
              <span v-if="year && startYear(period) !== year" class="tariff-period-timeline__date-match">Ausgewählt · außerhalb des Jahresfilters</span>
            </span>
          </AppButton>
        </li>
      </ol>
    </div>
    <p v-if="visiblePeriods.length" class="tariff-period-timeline__muted">Datumsgrenzen gelten einschließlich des angegebenen Tages. Weitere Perioden sind durch horizontales Scrollen erreichbar.</p>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import { formatTariffDate, formatTariffDecimal } from './tariffDisplay';

const props = defineProps({
  periods: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  date: { type: String, default: '' },
  groupPosition: { type: [String, Number], default: null },
  stagePosition: { type: [String, Number], default: null },
});
defineEmits(['update:modelValue']);
const year = ref('');
const track = ref(null);
const elements = new Map();
const dateOnly = (value) => String(value || '').slice(0, 10);
const startYear = (period) => dateOnly(period.validFrom).slice(0, 4);
const orderedPeriods = computed(() => [...props.periods].sort((left, right) => dateOnly(left.validFrom).localeCompare(dateOnly(right.validFrom)) || String(left.legacyId).localeCompare(String(right.legacyId), 'de', { numeric: true })));
const years = computed(() => [...new Set(orderedPeriods.value.map(startYear).filter((entry) => /^\d{4}$/.test(entry)))].reverse());
const visiblePeriods = computed(() => year.value ? orderedPeriods.value.filter((period) => startYear(period) === year.value || String(period.legacyId) === props.modelValue) : orderedPeriods.value);
const selected = computed(() => props.periods.find((period) => String(period.legacyId) === props.modelValue));
const hasCell = computed(() => [props.groupPosition, props.stagePosition].every((value) => value !== null && value !== undefined && String(value) !== ''));

function matchesDate(period) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date) || !period.validFrom) return false;
  return dateOnly(period.validFrom) <= props.date && (!period.validUntil || dateOnly(period.validUntil) >= props.date);
}
const matchingCount = computed(() => props.periods.filter(matchesDate).length);
function cellLabel(period) {
  const rates = (period.rates || []).filter((rate) => String(rate.stagePosition) === String(props.stagePosition) && String(rate.groupPosition) === String(props.groupPosition));
  if (rates.length > 1) return 'Nicht eindeutig';
  if (!rates.length || rates[0].value === null || rates[0].value === undefined || rates[0].value === '') return 'Grundwert fehlt';
  return formatTariffDecimal(rates[0].value, true);
}
function periodLabel(period) {
  return `Tarifzeit ${period.legacyId}: ${formatTariffDate(period.validFrom)} bis ${formatTariffDate(period.validUntil)}${matchesDate(period) ? `, gültig am ${formatTariffDate(props.date)}` : ''}${hasCell.value ? `, Grundwert: ${cellLabel(period)}` : ''}`;
}
function setPeriodElement(id, element) {
  if (element) elements.set(String(id), element);
  else elements.delete(String(id));
}
async function revealSelection() {
  await nextTick();
  const element = elements.get(props.modelValue);
  if (!element || !track.value) return;
  const centered = element.offsetLeft - (track.value.clientWidth - element.offsetWidth) / 2;
  track.value.scrollLeft = Math.max(0, Math.min(centered, track.value.scrollWidth - track.value.clientWidth));
}
watch(() => props.periods, () => { year.value = ''; });
watch([() => props.modelValue, visiblePeriods], revealSelection, { immediate: true, flush: 'post' });
</script>

<style scoped>
.tariff-period-timeline { display: grid; gap: 12px; min-width: 0; }
.tariff-period-timeline h3, .tariff-period-timeline p { margin: 0; }
.tariff-period-timeline h3 { font-size: 1rem; }
.tariff-period-timeline__toolbar { display: flex; justify-content: space-between; flex-wrap: wrap; align-items: end; gap: 12px; }
.tariff-period-timeline__toolbar > div { display: grid; gap: 5px; }
.tariff-period-timeline__muted { font-size: .8rem; color: var(--muted); line-height: 1.45; }
.tariff-period-timeline__filter { display: grid; gap: 4px; font-size: .8rem; color: var(--text); }
.tariff-period-timeline__selection { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--primary); border-radius: var(--control-radius, 8px); background: color-mix(in srgb, var(--primary) 8%, var(--panel)); font-size: .85rem; }
.tariff-period-timeline__selection-rate { margin-left: auto; font-weight: 700; white-space: nowrap; }
.tariff-period-timeline__notice { padding: 10px 12px; background: var(--tile-bg); border: 1px solid var(--warning, #c38d20); border-radius: var(--control-radius, 8px); font-size: .85rem; line-height: 1.45; }
.tariff-period-timeline__track { position: relative; overflow-x: auto; padding: 6px 2px 12px; }
.tariff-period-timeline__periods { display: flex; width: max-content; min-width: 100%; gap: 12px; margin: 0; padding: 14px 0 0; list-style: none; }
.tariff-period-timeline__entry { position: relative; flex: 0 0 205px; width: 205px; padding-top: 10px; }
.tariff-period-timeline__entry::before { content: ''; position: absolute; left: 0; right: -12px; top: 0; border-top: 2px solid var(--border); }
.tariff-period-timeline__entry:last-child::before { right: 0; }
.tariff-period-timeline__entry::after { content: ''; position: absolute; top: -4px; left: 12px; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.tariff-period-timeline__entry--matching::after { background: var(--primary); outline: 3px solid color-mix(in srgb, var(--primary) 20%, transparent); }
.tariff-period-timeline__button { width: 100%; height: 100%; white-space: normal; justify-content: start; text-align: left; padding: 10px 12px; }
.tariff-period-timeline__card { display: grid; gap: 5px; font-weight: 400; }
.tariff-period-timeline__dates { font-size: .8rem; font-weight: 600; }
.tariff-period-timeline__id { color: var(--muted); font-size: .74rem; }
.tariff-period-timeline__rate { font-size: .95rem; }
.tariff-period-timeline__date-match { font-size: .73rem; line-height: 1.3; }
@media (max-width: 600px) { .tariff-period-timeline__entry { flex-basis: 185px; width: 185px; } .tariff-period-timeline__selection-rate { margin-left: 0; } }
</style>
