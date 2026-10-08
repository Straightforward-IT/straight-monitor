<template>
  <section class="tariff-resolution" :class="{ 'tariff-resolution--employee': assignment }" aria-label="Herleitung des tariflichen Grundwerts">
    <div class="tariff-resolution__heading"><h3>So entsteht der Grundwert</h3><span v-if="date" class="tariff-muted">Stichtag {{ formatTariffDate(date) }}</span></div>
    <div class="tariff-resolution__path">
      <InformationCard v-if="assignment" class="tariff-resolution__node">
        <template #legend>Mitarbeiterzuordnung</template><template #title>Personalnummer {{ assignment.personalNr }}</template>
        <p>{{ formatTariffDate(assignment.validFrom) }} – {{ formatTariffDate(assignment.validUntil) }}</p>
        <TariffSourceDetails v-if="showSources" :source="assignment.source" />
      </InformationCard>
      <InformationCard class="tariff-resolution__node">
        <template #legend>1 · Tarifvariante</template><template #title>{{ group?.name || 'Keine Variante gewählt' }}</template>
        <p v-if="contract">{{ contract.name }} · Vertrag {{ contract.legacyId }}</p>
        <small v-if="group">Variante {{ group.legacyId }}</small>
        <TariffSourceDetails v-if="showSources" :source="group?.source" />
      </InformationCard>
      <InformationCard class="tariff-resolution__node">
        <template #legend>2 · Gültiger Zeitraum</template><template #title>{{ period ? `${formatTariffDate(period.validFrom)} – ${formatTariffDate(period.validUntil)}` : 'Keine eindeutige Periode' }}</template>
        <p>Bestimmt Entgeltmatrix und Periodenregeln.</p><small v-if="period">Tarifperiode {{ period.legacyId }}</small>
        <TariffSourceDetails v-if="showSources" :source="period?.source" />
      </InformationCard>
      <InformationCard class="tariff-resolution__node">
        <template #legend>3 · Position in der Matrix</template><template #title>{{ payGroup?.name || 'Entgeltgruppe wählen' }}</template>
        <p>{{ stage?.name || 'Stufe wählen' }}</p>
        <small v-if="payGroup && stage">Zeile IY {{ payGroup.position }} + Spalte IX {{ stage.position }}</small>
        <TariffSourceDetails v-if="showSources && payGroup" :source="payGroup.source" label="Entgeltgruppe: Herkunft" />
        <TariffSourceDetails v-if="showSources && stage" :source="stage.source" label="Stufe: Herkunft" />
      </InformationCard>
      <InformationCard class="tariff-resolution__node tariff-resolution__result" :highlighted="resolved">
        <template #legend>Tariflicher Grundwert</template><template #title><span v-if="resolved" class="tariff-value">{{ formatTariffDecimal(value, true) }}</span><span v-else>Klärung erforderlich</span></template>
        <p>{{ resolved ? 'Entgeltwert am Schnittpunkt von Gruppe und Stufe.' : message || 'Für diese Auswahl gibt es keinen eindeutigen Grundwert.' }}</p>
        <small>ÜTZ und weitere Regeln werden separat betrachtet.</small>
      </InformationCard>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import InformationCard from '@/components/ui-elements/InformationCard.vue';
import TariffSourceDetails from './TariffSourceDetails.vue';
import { formatTariffDate, formatTariffDecimal } from './tariffDisplay';
const props = defineProps({
  contract: { type: Object, default: null }, group: { type: Object, default: null }, period: { type: Object, default: null },
  payGroup: { type: Object, default: null }, stage: { type: Object, default: null }, assignment: { type: Object, default: null },
  value: { type: String, default: null }, date: { type: String, default: '' }, status: { type: String, default: 'RESOLVED' },
  message: { type: String, default: '' }, showSources: { type: Boolean, default: false },
});
const resolved = computed(() => props.status === 'RESOLVED' && props.value !== null && props.value !== '');
</script>

<style scoped>
.tariff-resolution { container-type: inline-size; display: grid; gap: 14px; min-width: 0; }
.tariff-resolution__heading { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.tariff-resolution__path { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 185px), 1fr)); gap: 22px; }
.tariff-resolution__node { position: relative; font-size: .82rem; }
.tariff-resolution__node:not(:last-child)::after { content: '→'; position: absolute; right: -19px; top: 46%; color: var(--primary); font-size: 1.2rem; }
.tariff-resolution__node small { color: var(--muted); line-height: 1.5; }
.tariff-resolution__result .tariff-value { font-size: 1.7rem; white-space: nowrap; }
@container (max-width: 1050px) { .tariff-resolution--employee .tariff-resolution__path { grid-template-columns: 1fr 1fr; } .tariff-resolution--employee .tariff-resolution__node::after { display: none; } }
@container (max-width: 820px) { .tariff-resolution__path { grid-template-columns: 1fr 1fr; } .tariff-resolution__node::after { display: none; } }
@container (max-width: 460px) { .tariff-resolution .tariff-resolution__path { grid-template-columns: 1fr; gap: 18px; } .tariff-resolution .tariff-resolution__node:not(:last-child)::after { display: block; content: '↓'; top: auto; bottom: -21px; right: 50%; } }
</style>
