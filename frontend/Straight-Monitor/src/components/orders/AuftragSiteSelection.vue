<template>
  <article class="site-selection">
    <header><h4>Einsatzort</h4><FilterChip v-if="linked" :active="order.einsatzortOverride" :disabled="disabled" @click="$emit('scope')">{{ order.einsatzortOverride ? 'Nur dieser Tag' : 'Gemeinsam' }}</FilterChip><AppButton variant="secondary" size="sm" :disabled="disabled || !order.kundenNr" @click="showForm = true">Einsatzort anlegen</AppButton></header>
    <p v-if="!order.kundenNr">Zuerst einen Kunden auswählen.</p>
    <p v-if="order.einsatzortIssue" class="issue" role="alert">{{ order.einsatzortIssue.message }}</p>
    <p v-if="!order.einsatzort && (order.eventStrasse || order.eventOrt)" class="snapshot">Bisherige Adresse: {{ [order.eventLocation, order.eventStrasse, order.eventPlz, order.eventOrt].filter(Boolean).join(', ') }}. Bitte als Einsatzort speichern oder einen bestehenden wählen.</p>
    <div class="site-grid"><button v-for="site in sites" :key="site._id" type="button" :class="{ selected: order.einsatzort === site._id }" :disabled="disabled" :aria-pressed="order.einsatzort === site._id" @click="$emit('select', site._id)"><strong>{{ site.bezeichnung }}</strong><span>{{ [site.adresse?.strasse, site.adresse?.plz, site.adresse?.ort].filter(Boolean).join(' ') }}</span></button></div>
    <p v-if="order.kundenNr && !sites.length">Keine gespeicherten Einsatzorte. Bitte einen Einsatzort anlegen.</p>
    <EinsatzortFormModal v-if="showForm" :kunden-nr="order.kundenNr" :initial-address="{ bezeichnung: order.eventLocation || '', strasse: order.eventStrasse || '', plz: order.eventPlz || '', ort: order.eventOrt || '' }" @close="showForm = false" @saved="saved" />
  </article>
</template>
<script setup>
import { ref } from 'vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import EinsatzortFormModal from '@/components/Modals/EinsatzortFormModal.vue';
defineProps({ order: { type: Object, required: true }, sites: { type: Array, default: () => [] }, linked: { type: Boolean, default: false }, disabled: { type: Boolean, default: false } });
const emit = defineEmits(['select', 'saved', 'scope']);
const showForm = ref(false);
function saved(site) { showForm.value = false; emit('saved', site); }
</script>
<style scoped>
.site-selection { padding: 16px; margin-bottom: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }h4 { font-size: .9rem; font-weight: 600; flex: 1; }
p { color: var(--muted); font-size: .8rem; margin: 10px 0; }.snapshot { padding: 10px; background: var(--panel); border-radius: 8px; }
.issue { color: var(--status-danger-text); }
.site-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 8px; }
.site-grid button { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; text-align: left; cursor: pointer; font: inherit; }
.site-grid span { color: var(--muted); font-size: .75rem; }.site-grid .selected { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
button:focus-visible { outline: 2px solid var(--control-focus-ring,var(--primary)); outline-offset: 2px; }
</style>
