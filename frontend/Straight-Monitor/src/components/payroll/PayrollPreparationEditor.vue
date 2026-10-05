<template>
  <section class="preparation-editor" aria-label="Monatsvorbereitung">
    <h2>Monatsvorbereitung</h2>
    <p>Ist-Zeiten bleiben unverändert. Hier bereitest du Fehlzeiten, Mengenänderungen und Zeitkonto-Aufträge vor.</p>
    <p v-if="readonly">Dieser Monat ist intern abgeschlossen. Zum Bearbeiten muss PAYROLL/ADMIN ihn wieder öffnen.</p>
    <fieldset :disabled="readonly || busy">
      <div class="fields">
        <label>Eintragsart<AppSelect v-model="form.kind"><option value="ABSENCE">Fehlzeit / Krankheit</option><option value="ADJUSTMENT">Stundenkorrektur</option><option value="TRANSFER">Eimer · AZK-Vorschlag</option></AppSelect></label>
        <template v-if="form.kind === 'ABSENCE'">
          <label>Art<AppSelect v-model="form.code"><option value="">Bitte wählen</option><option v-for="type in absenceTypes" :key="type.code" :value="type.code">{{ type.code }} · {{ type.label }}</option></AppSelect></label>
          <label>Beginn<AppTextInput v-model="form.startDate" type="date" :min="`${month}-01`" :max="lastDay" /></label>
          <label>Ende<AppTextInput v-model="form.endDate" type="date" :min="form.startDate" /></label>
          <AppButton size="sm" variant="secondary" @click="generateDays">Tagesmengen bearbeiten</AppButton>
        </template>
        <template v-else>
          <label>Zuordnungsdatum<AppTextInput v-model="form.date" type="date" :min="`${month}-01`" :max="lastDay" /></label>
          <label>Minuten<AppTextInput v-model.number="form.minutes" type="number" step="1" :min="form.kind === 'TRANSFER' ? 1 : -525600" /></label>
          <label>Quelle<AppSelect v-model="form.source"><option v-if="form.kind === 'ADJUSTMENT'" value="">Manuelle Korrektur</option><option v-if="form.kind === 'TRANSFER'" value="AZK">AZK · Abgang vorschlagen</option><option v-for="source in sources" :key="source.id" :value="source.id">{{ sourceLabel(source) }}</option></AppSelect></label>
          <label v-if="form.kind === 'TRANSFER'">Ziel<AppSelect v-model="form.target"><option value="AZK">AZK · Zugang vorschlagen</option><option value="PAYMENT">Auszahlung / Freizeitausgleich</option></AppSelect></label>
        </template>
      </div>
      <template v-if="form.kind === 'ABSENCE'">
        <p>Der Originalzeitraum darf über den Monat hinausgehen. Anrechenbare Minuten je Tag ausdrücklich prüfen; 0 bedeutet keine Stundenmenge.</p>
        <div class="daily" v-if="form.daily.length"><label v-for="day in form.daily" :key="day.date">{{ day.date }}<AppTextInput v-model.number="day.minutes" type="number" min="0" max="1440" step="1" :aria-label="`Anrechenbare Minuten am ${day.date}`" /></label></div>
      </template>
      <p v-if="form.kind === 'TRANSFER'">Zeitkonto nicht verfügbar. Dieser Vorschlag ist nicht gegen einen LODAS-Kontostand geprüft.</p>
      <label>Begründung<AppTextInput v-model="form.reason" maxlength="1000" /></label>
      <div class="preparation-editor__actions">
        <AppButton size="sm" @click="apply">{{ editing ? 'Eintrag übernehmen' : 'Zum Entwurf hinzufügen' }}</AppButton>
        <AppButton size="sm" variant="secondary" @click="reset">Eingabe verwerfen</AppButton>
      </div>
      <p v-if="error" role="alert">{{ error }}</p>
    </fieldset>
    <ul class="items">
      <li v-for="item in modelValue" :key="item.id">
        <span>{{ describe(item) }} · {{ item.reason }}</span>
        <AppButton size="sm" variant="secondary" :disabled="readonly || busy" @click="edit(item)">Bearbeiten</AppButton>
        <AppButton size="sm" variant="outlined" :disabled="readonly || busy" @click="remove(item.id)">Entfernen</AppButton>
      </li>
      <li v-for="item in inherited" :key="item.id">
        {{ describe(item) }} · Fortlaufende Fehlzeit
        <RouterLink :to="{ path: '/payroll', query: { ...route.query, month: item.originMonth, tab: 'stundenerfassung' } }">Im Ursprungsmonat {{ item.originMonth }} bearbeiten</RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import { absenceDays, preparationInput, sourceLabel } from '@/utils/payrollPreparation';
const props = defineProps({ modelValue: { type: Array, required: true }, sources: { type: Array, required: true }, inherited: { type: Array, default: () => [] }, types: { type: Array, default: () => [] }, month: { type: String, required: true }, readonly: Boolean, busy: Boolean, picked: { type: Object, default: null } });
const emit = defineEmits(['update:modelValue', 'formDirty']);
const route = useRoute(), editing = ref(''), error = ref('');
const blank = () => ({ kind: 'ABSENCE', code: '', startDate: `${props.month}-01`, endDate: `${props.month}-01`, date: `${props.month}-01`, daily: [], minutes: 60, source: '', target: 'AZK', reason: '' });
const form = ref(blank());
const baseline = ref(JSON.stringify(form.value));
watch(form, value => emit('formDirty', JSON.stringify(value) !== baseline.value), { deep: true });
const lastDay = computed(() => { const [y, m] = props.month.split('-').map(Number); return `${props.month}-${new Date(y, m, 0).getDate()}`; });
const absenceTypes = computed(() => {
  const types = new Map(props.types.filter(t => ['sick', 'vacation', 'absence'].includes(t.kind)).map(t => [t.code, t]));
  for (const item of props.modelValue.filter(i => i.kind === 'ABSENCE')) if (!types.has(item.code)) types.set(item.code, { code: item.code, label: item.label || item.code });
  return [...types.values()];
});
function reset() { editing.value = ''; form.value = blank(); baseline.value = JSON.stringify(form.value); error.value = ''; emit('formDirty', false); }
function generateDays() { form.value.daily = absenceDays(form.value.startDate, form.value.endDate, form.value.daily); }
function edit(item) { form.value = { ...blank(), ...preparationInput(item) }; editing.value = item.id; baseline.value = JSON.stringify(form.value); }
function remove(id) { emit('update:modelValue', props.modelValue.filter(i => i.id !== id)); if (editing.value === id) reset(); }
function apply() {
  error.value = '';
  if (!form.value.reason.trim()) { error.value = 'Bitte eine Begründung angeben.'; return; }
  if (form.value.kind === 'ABSENCE' && !form.value.code) { error.value = 'Bitte eine Fehlzeitart wählen.'; return; }
  const input = preparationInput({ ...form.value, id: editing.value || crypto.randomUUID() });
  const old = props.modelValue.find(i => i.id === input.id && i.kind === input.kind && i.code === input.code);
  const item = { ...(old || {}), ...input };
  emit('update:modelValue', [...props.modelValue.filter(i => i.id !== item.id), item]); reset();
}
function describe(i) { return i.kind === 'ABSENCE' ? `${i.code} · ${i.startDate} – ${i.endDate}` : `${i.kind === 'TRANSFER' ? 'AZK-Vorschlag' : 'Korrektur'} · ${i.date} · ${i.minutes} Min.`; }
watch(() => props.picked, value => {
  if (!value || props.readonly) return;
  form.value.kind = value.kind || 'TRANSFER';
  if (value.source) form.value.source = value.source;
  if (value.target) form.value.target = value.target;
  if (value.date) { form.value.date = value.date; form.value.startDate = value.date; form.value.endDate = value.date; }
});
defineExpose({ reset });
</script>

<style scoped>
.preparation-editor { padding: 16px; margin-block: 16px; border: 1px solid var(--border); border-radius: 8px; }
h2 { font-size: 16px; } p { font-size: 13px; color: var(--muted); } fieldset { border: 0; padding: 0; min-width: 0; }
.fields { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
label { display: grid; gap: 5px; margin-block: 8px; font-size: 13px; }
.fields .app-button { align-self: end; margin-bottom: 8px; }
.preparation-editor__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-block: 8px; }
.daily { display: flex; flex-wrap: wrap; gap: 8px; max-height: 240px; overflow: auto; } .daily .app-text-input { width: 100px; }
.items { padding-left: 20px; } .items li { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-block: 8px; font-size: 13px; } .items span { margin-right: auto; }
</style>
