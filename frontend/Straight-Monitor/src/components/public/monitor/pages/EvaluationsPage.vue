<template>
  <section class="public-monitor-page public-monitor-evaluations-page">
    <!-- FORM VIEW: Evaluierung schreiben -->
    <form
      v-if="mode === 'form' && selectedLaufzettel"
      class="personal-data-form"
      @submit.prevent="submitEvaluierung"
    >
      <section class="job-hero compact">
        <span class="date-kicker">Laufzettel ausfüllen</span>
        <h2>{{ selectedLaufzettel.name_mitarbeiter || 'Evaluierung' }}</h2>
        <p>{{ selectedLaufzettel.kunde || 'Bewerte den Einsatz des Mitarbeiters.' }}</p>
      </section>

      <section class="detail-list">
        <div v-if="selectedLaufzettel.name_mitarbeiter" class="detail-row">
          <span>Mitarbeiter</span>
          <strong>{{ selectedLaufzettel.name_mitarbeiter }}</strong>
        </div>
        <div v-if="selectedLaufzettel.name_teamleiter" class="detail-row">
          <span>Teamleiter</span>
          <strong>{{ selectedLaufzettel.name_teamleiter }}</strong>
        </div>
        <div v-if="selectedLaufzettel.auftragnummer" class="detail-row">
          <span>Auftragnr.</span>
          <strong>#{{ selectedLaufzettel.auftragnummer }}</strong>
        </div>
        <div v-if="selectedLaufzettel.kunde" class="detail-row">
          <span>Kunde</span>
          <strong>{{ selectedLaufzettel.kunde }}</strong>
        </div>
        <div v-if="selectedLaufzettel.locationV2?.nameFull || selectedLaufzettel.location" class="detail-row">
          <span>Standort</span>
          <strong>{{ selectedLaufzettel.locationV2?.nameFull || selectedLaufzettel.location }}</strong>
        </div>
        <div v-if="selectedLaufzettel.datum" class="detail-row">
          <span>Datum</span>
          <strong>{{ formatDate(selectedLaufzettel.datum) }}</strong>
        </div>
      </section>

      <label v-if="!selectedLaufzettel.kunde">
        <span>Kunde *</span>
        <input v-model.trim="form.kunde" type="text" required placeholder="Kundenname" />
      </label>

      <label>
        <span>Pünktlichkeit</span>
        <textarea v-model="form.puenktlichkeit" rows="2" placeholder="Wie pünktlich war der Mitarbeiter?" />
      </label>

      <label>
        <span>Grooming / Erscheinungsbild</span>
        <textarea v-model="form.grooming" rows="2" placeholder="Wie war das äußere Erscheinungsbild?" />
      </label>

      <label>
        <span>Motivation</span>
        <textarea v-model="form.motivation" rows="2" placeholder="Wie motiviert und engagiert wurde gearbeitet?" />
      </label>

      <label>
        <span>Technische Fertigkeiten</span>
        <textarea v-model="form.technische_fertigkeiten" rows="2" placeholder="Fachliche Umsetzung der Aufgaben…" />
      </label>

      <label>
        <span>Lernbereitschaft</span>
        <textarea v-model="form.lernbereitschaft" rows="2" placeholder="Offenheit für Hinweise und Neues…" />
      </label>

      <label>
        <span>Sonstiges / Kommentar</span>
        <textarea v-model="form.sonstiges" rows="3" placeholder="Weitere Anmerkungen…" />
      </label>

      <p v-if="submitError" class="inline-message personal-data-error">{{ submitError }}</p>

      <div class="job-decision-actions">
        <button class="secondary-button" type="button" @click="$emit('cancel-form')">
          Abbrechen
        </button>
        <button class="primary-button" type="submit" :disabled="!canSubmit || submitting">
          <font-awesome-icon :icon="submitting ? 'fa-solid fa-spinner' : 'fa-solid fa-paper-plane'" :spin="submitting" />
          {{ submitting ? 'Wird gesendet…' : 'Absenden' }}
        </button>
      </div>
    </form>

    <!-- LIST VIEW: Offene & abgegebene Laufzettel -->
    <template v-else>
      <section class="job-hero compact">
        <span class="date-kicker">Mein Profil</span>
        <h2>Laufzettel ausfüllen</h2>
        <p>Bewerte angeforderte Laufzettel deiner Teammitglieder und sieh bereits abgegebene Evaluierungen ein.</p>
      </section>

      <div v-if="submitSuccess" class="status-panel eval-success-banner">
        <font-awesome-icon icon="fa-solid fa-circle-check" />
        <strong>Die Evaluierung wurde erfolgreich gespeichert.</strong>
      </div>

      <section class="home-section">
        <div class="section-heading">
          <h3>Offene Laufzettel</h3>
          <span>{{ openLaufzettel.length }}</span>
        </div>
        <div v-if="openLaufzettel.length" class="document-list">
          <PublicListItem
            v-for="lz in openLaufzettel"
            :key="lz._id"
            icon="fa-solid fa-clock"
            icon-class="document-status-missing"
            :title="getLaufzettelTitle(lz)"
            :description="getLaufzettelDescription(lz)"
            badge="Offen"
            @click="$emit('select-laufzettel', lz)"
          />
        </div>
        <PublicListItem
          v-else
          :clickable="false"
          :chevron="false"
          icon="fa-solid fa-circle-check"
          icon-class="document-status-approved"
          title="Keine offenen Laufzettel"
          description="Alle angeforderten Laufzettel wurden bereits bewertet."
        />
      </section>

      <section class="home-section">
        <div class="section-heading">
          <h3>Evaluierungen abgegeben</h3>
          <span>{{ doneLaufzettel.length }}</span>
        </div>
        <div v-if="doneLaufzettel.length" class="document-list">
          <PublicListItem
            v-for="lz in doneLaufzettel"
            :key="lz._id"
            :clickable="false"
            :chevron="false"
            icon="fa-solid fa-circle-check"
            icon-class="document-status-approved"
            :title="getLaufzettelTitle(lz)"
            :description="getLaufzettelDescription(lz)"
            badge="Bewertet"
          />
        </div>
        <PublicListItem
          v-else
          :clickable="false"
          :chevron="false"
          icon="fa-solid fa-file-lines"
          title="Noch keine Evaluierungen abgegeben"
          description="Abgeschlossene Bewertungen erscheinen hier."
        />
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { showToast } from '@getflip/bridge';
import PublicListItem from '@/components/public/PublicListItem.vue';

const props = defineProps({
  api: { type: [Object, Function], required: true },
  email: { type: String, default: '' },
  mode: { type: String, default: 'list' }, // 'list' | 'form'
  received: { type: Array, default: () => [] },
  selectedLaufzettel: { type: Object, default: null },
  submitSuccess: { type: Boolean, default: false },
});

const emit = defineEmits(['cancel-form', 'select-laufzettel', 'submitted']);

const submitting = ref(false);
const submitError = ref('');
const draftReady = ref(false);

const form = reactive({
  kunde: '',
  puenktlichkeit: '',
  grooming: '',
  motivation: '',
  technische_fertigkeiten: '',
  lernbereitschaft: '',
  sonstiges: '',
});

const openLaufzettel = computed(() =>
  props.received
    .filter((lz) => lz.status !== 'ABGESCHLOSSEN')
    .slice()
    .sort((a, b) => new Date(b.datum || b.createdAt || 0) - new Date(a.datum || a.createdAt || 0))
);

const doneLaufzettel = computed(() =>
  props.received
    .filter((lz) => lz.status === 'ABGESCHLOSSEN')
    .slice()
    .sort((a, b) => new Date(b.datum || b.createdAt || 0) - new Date(a.datum || a.createdAt || 0))
);

const draftUserId = computed(() => (props.email || 'u').toLowerCase());
const draftLaufzettelId = computed(() => props.selectedLaufzettel?._id || props.selectedLaufzettel?.auftragnummer || 'new');

function draftKey() {
  return `public_evaluierung_draft_${draftUserId.value}_${draftLaufzettelId.value}`;
}

function resetAndLoadForm() {
  draftReady.value = false;
  submitError.value = '';
  form.kunde = props.selectedLaufzettel?.kunde || '';
  form.puenktlichkeit = '';
  form.grooming = '';
  form.motivation = '';
  form.technische_fertigkeiten = '';
  form.lernbereitschaft = '';
  form.sonstiges = '';

  if (props.selectedLaufzettel) {
    try {
      const raw = localStorage.getItem(draftKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.form) {
          Object.assign(form, parsed.form);
          if (props.selectedLaufzettel.kunde) {
            form.kunde = props.selectedLaufzettel.kunde;
          }
        }
      }
    } catch {}
  }
  draftReady.value = true;
}

watch(
  () => [props.mode, props.selectedLaufzettel?._id],
  ([mode]) => {
    if (mode === 'form' && props.selectedLaufzettel) {
      resetAndLoadForm();
    }
  },
  { immediate: true }
);

watch(
  () => ({ ...form }),
  () => {
    if (!draftReady.value || props.mode !== 'form' || !props.selectedLaufzettel) return;
    try {
      localStorage.setItem(
        draftKey(),
        JSON.stringify({
          laufzettelId: props.selectedLaufzettel._id || '',
          auftragnummer: props.selectedLaufzettel.auftragnummer || '',
          form: { ...form },
          savedAt: new Date().toISOString(),
        })
      );
    } catch {}
  },
  { deep: true }
);

const canSubmit = computed(() => {
  return (
    !!form.kunde &&
    (!!form.puenktlichkeit?.trim() ||
      !!form.grooming?.trim() ||
      !!form.motivation?.trim() ||
      !!form.technische_fertigkeiten?.trim() ||
      !!form.lernbereitschaft?.trim() ||
      !!form.sonstiges?.trim())
  );
});

async function submitEvaluierung() {
  if (!props.selectedLaufzettel || !canSubmit.value || submitting.value) return;
  submitting.value = true;
  submitError.value = '';
  try {
    await props.api.post('/api/public/evaluierung', {
      email: props.email,
      laufzettel_id: props.selectedLaufzettel._id,
      kunde: form.kunde,
      datum: props.selectedLaufzettel.datum || new Date().toISOString(),
      puenktlichkeit: form.puenktlichkeit,
      grooming: form.grooming,
      motivation: form.motivation,
      technische_fertigkeiten: form.technische_fertigkeiten,
      lernbereitschaft: form.lernbereitschaft,
      sonstiges: form.sonstiges,
    });
    try {
      localStorage.removeItem(draftKey());
    } catch {}
    emit('submitted');
    try {
      await showToast({ text: 'Evaluierung eingereicht!', intent: 'success', duration: 2500 });
    } catch {}
  } catch (err) {
    submitError.value = err.response?.data?.msg || err.message || 'Fehler beim Einreichen.';
  } finally {
    submitting.value = false;
  }
}

function getLaufzettelTitle(lz) {
  return lz.name_mitarbeiter || lz.kunde || 'Laufzettel';
}

function getLaufzettelDescription(lz) {
  const parts = [];
  if (lz.kunde && lz.name_mitarbeiter) parts.push(lz.kunde);
  const loc = lz.locationV2?.nameFull || lz.location;
  if (loc) parts.push(loc);
  const dateStr = formatDate(lz.datum || lz.createdAt);
  if (dateStr) parts.push(dateStr);
  return parts.join(' · ') || 'Laufzettel';
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }) === now.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })) {
    return 'Heute';
  }
  return dt.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
</script>

<style scoped>
.job-hero { padding:1rem 0 1.2rem; border-bottom:3px solid var(--primary); }
.job-hero.compact { padding-top:.35rem; }
.date-kicker { color:var(--primary); font-size:.72rem; font-weight:800; text-transform:uppercase; }
.job-hero h2 { margin:.35rem 0 .2rem; font-size:1.65rem; }
.job-hero p { color:var(--muted); }
.detail-list { margin-top:.2rem; }
.detail-row { display:grid; grid-template-columns:110px minmax(0,1fr); gap:1rem; padding:.75rem 0; border-bottom:1px solid var(--border); font-size:.82rem; }
.detail-row span { color:var(--muted); }
.personal-data-form { display:grid; gap:.85rem; }
.personal-data-form > label { display:grid; gap:.35rem; color:var(--muted); font-size:.78rem; }
.personal-data-form input,
.personal-data-form textarea {
  width:100%;
  box-sizing:border-box;
  padding:.65rem;
  border:1px solid var(--border);
  border-radius:4px;
  background:var(--surface);
  color:var(--text);
  font:inherit;
}
.personal-data-form input { min-height:44px; }
.personal-data-form textarea { resize:vertical; min-height:68px; }
.personal-data-error { color:var(--dev-red, #b84235); }
.job-decision-actions { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; margin-top:.4rem; }
.job-decision-actions button { width:100%; }
.status-panel { display:flex; align-items:center; justify-content:center; gap:.5rem; min-height:46px; padding:.5rem .85rem; border:1px solid var(--dev-green, #157f5b); border-radius:6px; color:var(--dev-green, #157f5b); font-size:.85rem; text-align:center; }
.eval-success-banner { margin-top:1rem; }
.section-heading > span { display:grid; width:24px; height:24px; place-items:center; border-radius:50%; background:var(--primary); color:white; font-size:.7rem; font-weight:700; }
</style>
