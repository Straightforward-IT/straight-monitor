<template>
  <div class="eventreport-view">

    <!-- Back Button -->
    <button class="back-btn" @click="$emit('back')">
      <font-awesome-icon icon="fa-solid fa-arrow-left" /> Zurück
    </button>

    <h2 class="view-title">Event Report</h2>

    <!-- Success -->
    <div v-if="submitSuccess" class="success-state">
      <div class="success-icon">
        <font-awesome-icon icon="fa-solid fa-check" />
      </div>
      <h3>Erfolgreich gesendet!</h3>
      <p>Dein Event Report wurde eingereicht.</p>
      <button class="btn-secondary" @click="resetForm">Weiteren Report schreiben</button>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submitReport" class="report-form">
      <!-- Einsatz auswählen -->
      <div class="form-group">
        <label>Einsatz auswählen *</label>
        <div class="custom-select" @click="showEinsatzPicker = !showEinsatzPicker">
          <span v-if="!selectedEinsatzId" class="placeholder">— Einsatz wählen —</span>
          <span v-else class="selected-value">
            {{ selectedEinsatzLabel }}
          </span>
          <font-awesome-icon icon="fa-solid fa-chevron-down" />
        </div>
        <!-- Picker Sheet -->
        <div v-if="showEinsatzPicker" class="picker-overlay" @click="showEinsatzPicker = false">
          <div class="picker-sheet" @click.stop>
            <div class="picker-header">
              <h4>Einsatz wählen</h4>
              <button class="picker-close" @click="showEinsatzPicker = false">
                <font-awesome-icon icon="fa-solid fa-times" />
              </button>
            </div>
            <div class="picker-list">
              <div
                v-for="einsatz in pastEinsaetze"
                :key="einsatz._id"
                class="picker-item"
                :class="{ active: selectedEinsatzId === einsatz._id }"
                @click="selectEinsatz(einsatz)"
              >
                <span class="picker-item-title">
                  {{ einsatz.auftrag?.eventTitel || einsatz.bezeichnung || `#${einsatz.auftragNr}` }}
                </span>
                <span class="picker-item-date">{{ formatDate(einsatz.datumVon) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pre-filled fields -->
      <div class="form-row">
        <div class="form-group">
          <label>Standort *</label>
          <input v-model="form.location" type="text" required />
        </div>
        <div class="form-group">
          <label>Kunde *</label>
          <input v-model="form.kunde" type="text" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Auftragnummer</label>
          <input v-model="form.auftragnummer" type="text" readonly class="readonly" />
        </div>
        <div class="form-group">
          <label>Datum *</label>
          <input v-model="form.datum" type="date" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Teamleiter</label>
          <input :value="teamleiterName" type="text" readonly class="readonly" />
        </div>
        <div class="form-group">
          <label>Mitarbeiter Anzahl</label>
          <input v-model="form.mitarbeiter_anzahl" type="text" inputmode="numeric" />
        </div>
      </div>

      <!-- Ratings -->
      <div class="rating-section">
        <h3 class="rating-title">Bewertung</h3>

        <div class="form-group">
          <label>Pünktlichkeit</label>
          <textarea v-model="form.puenktlichkeit" rows="2" placeholder="Wie pünktlich waren die Mitarbeiter?" />
        </div>

        <div class="form-group">
          <label>Erscheinungsbild</label>
          <textarea v-model="form.erscheinungsbild" rows="2" placeholder="Wie war das Erscheinungsbild?" />
        </div>

        <div class="form-group">
          <label>Team</label>
          <textarea v-model="form.team" rows="2" placeholder="Wie hat das Team zusammengearbeitet?" />
        </div>
      </div>

      <!-- Text fields -->
      <!-- Mitarbeiter & Job -->
      <div class="form-group">
        <label>Mitarbeiter & Job</label>

        <!-- Remaining chips -->
        <div v-if="availableMitarbeiter.length" class="ma-chips">
          <button
            v-for="ma in availableMitarbeiter"
            :key="ma.personalNr"
            type="button"
            class="ma-chip"
            @click="addMitarbeiterRow(ma)"
          >
            + {{ maDisplayName(ma) }}
          </button>
        </div>

        <!-- Per-Mitarbeiter rows -->
        <div class="ma-rows">
          <div v-for="row in mitarbeiterRows" :key="row.personalNr" class="ma-row">
            <div class="ma-row-field">
              <span class="ma-row-legend">{{ row.name }}</span>
              <textarea
                v-model="row.text"
                class="ma-row-input"
                rows="2"
                :placeholder="'Feedback zu ' + row.name + '…'"
              ></textarea>
              <button type="button" class="ma-row-remove" @click="removeMitarbeiterRow(row)">
                <font-awesome-icon icon="fa-solid fa-times" />
              </button>
            </div>
          </div>
          <!-- Fallback free-text if no Mitarbeiter loaded -->
          <textarea
            v-if="!einsatzMitarbeiter.length"
            v-model="form.mitarbeiter_job"
            rows="3"
            placeholder="Wie haben die Mitarbeiter ihre Aufgaben erledigt?"
          ></textarea>
        </div>
      </div>

      <div class="form-group">
        <label>Feedback Auftraggeber</label>
        <textarea v-model="form.feedback_auftraggeber" rows="3" placeholder="Was hat der Auftraggeber gesagt?"></textarea>
      </div>

      <div class="form-group">
        <label>Sonstiges</label>
        <textarea v-model="form.sonstiges" rows="3" placeholder="Weitere Anmerkungen..."></textarea>
      </div>

      <button type="submit" class="submit-btn" :disabled="submitting">
        <span v-if="submitting">
          <font-awesome-icon icon="fa-solid fa-spinner" spin /> Wird gesendet...
        </span>
        <span v-else>
          <font-awesome-icon icon="fa-solid fa-paper-plane" /> Event Report absenden
        </span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';

const props = defineProps({
  einsaetze: { type: Array, default: () => [] },
  mitarbeiter: { type: Object, required: true },
  api: { type: Function, required: true },
  email: { type: String, default: '' },
  prefillEinsatz: { type: Object, default: null }
});

defineEmits(['back']);

const ratingOptions = ['Sehr gut', 'Gut', 'Befriedigend', 'Mangelhaft'];
const STANDORT_MAP = { '1': 'Berlin', '2': 'Hamburg', '3': 'Köln' };

const pastEinsaetze = computed(() => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return props.einsaetze.filter(e => {
    if (!e.datumVon) return true;
    return new Date(e.datumVon) <= endOfToday;
  });
});

const selectedEinsatzId = ref(props.prefillEinsatz?._id || '');
const showEinsatzPicker = ref(false);
const submitSuccess = ref(false);
const submitting = ref(false);
const einsatzMitarbeiter = ref([]);
const mitarbeiterRows = ref([]); // { personalNr, name, text }

const availableMitarbeiter = computed(() =>
  einsatzMitarbeiter.value.filter(ma => !mitarbeiterRows.value.find(r => r.personalNr === ma.personalNr))
);

function maDisplayName(ma) {
  const first = ma.vorname || ma.bezeichnung || '';
  const last = ma.nachname || '';
  return (first + ' ' + last).trim();
}

function addMitarbeiterRow(ma) {
  mitarbeiterRows.value.push({ personalNr: ma.personalNr, name: maDisplayName(ma), text: '' });
}

function removeMitarbeiterRow(row) {
  mitarbeiterRows.value = mitarbeiterRows.value.filter(r => r.personalNr !== row.personalNr);
}

const teamleiterName = computed(() =>
  `${props.mitarbeiter.vorname} ${props.mitarbeiter.nachname}`
);

const selectedEinsatzLabel = computed(() => {
  const e = props.einsaetze.find(e => e._id === selectedEinsatzId.value);
  if (!e) return '';
  return `${e.auftrag?.eventTitel || e.bezeichnung || `#${e.auftragNr}`} (${formatDate(e.datumVon)})`;
});

const form = reactive({
  location: '',
  kunde: '',
  auftragnummer: '',
  datum: '',
  mitarbeiter_anzahl: '',
  puenktlichkeit: '',
  erscheinungsbild: '',
  team: '',
  mitarbeiter_job: '',
  feedback_auftraggeber: '',
  sonstiges: ''
});

// localStorage draft helpers
function draftKey() {
  const nr = props.prefillEinsatz?.auftragNr || form.auftragnummer || 'new';
  return `eventreport_draft_${props.mitarbeiter?.personalnr || props.email || 'u'}_${nr}`;
}
function saveDraft() {
  try {
    localStorage.setItem(
      `eventreport_draft_${props.mitarbeiter?.personalnr || props.email || 'u'}`,
      JSON.stringify({
        selectedEinsatzId: selectedEinsatzId.value,
        form: { ...form },
        mitarbeiterRows: mitarbeiterRows.value
      })
    );
  } catch {}
}
function clearDraft() {
  try {
    localStorage.removeItem(`eventreport_draft_${props.mitarbeiter?.personalnr || props.email || 'u'}`);
  } catch {}
}
function loadDraft() {
  // Don't restore if we have a fresh prefill from job detail
  if (props.prefillEinsatz) return false;
  try {
    const raw = localStorage.getItem(`eventreport_draft_${props.mitarbeiter?.personalnr || props.email || 'u'}`);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (draft.selectedEinsatzId) selectedEinsatzId.value = draft.selectedEinsatzId;
    if (draft.form) Object.assign(form, draft.form);
    if (draft.mitarbeiterRows?.length) mitarbeiterRows.value = draft.mitarbeiterRows;
    return true;
  } catch { return false; }
}

// Watch for changes and auto-save draft
watch([() => ({ ...form }), mitarbeiterRows, selectedEinsatzId], saveDraft, { deep: true });

// Pre-fill if coming from job detail
if (props.prefillEinsatz) {
  prefillFromEinsatz(props.prefillEinsatz);
}

onMounted(() => {
  loadDraft();
});

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function selectEinsatz(einsatz) {
  selectedEinsatzId.value = einsatz._id;
  showEinsatzPicker.value = false;
  prefillFromEinsatz(einsatz);
}

function prefillFromEinsatz(einsatz) {
  form.auftragnummer = String(einsatz.auftragNr || '');
  form.datum = einsatz.datumVon ? new Date(einsatz.datumVon).toISOString().split('T')[0] : '';
  const rawLoc = einsatz.auftrag?.geschSt || einsatz.auftrag?.eventOrt || '';
  form.location = STANDORT_MAP[String(rawLoc)] || rawLoc;
  form.kunde = einsatz.auftrag?.eventTitel || einsatz.bezeichnung || '';
  loadEinsatzMitarbeiter(einsatz.auftragNr);
}

async function loadEinsatzMitarbeiter(auftragNr) {
  if (!auftragNr) return;
  mitarbeiterRows.value = [];
  try {
    const res = await props.api.get('/api/public/einsatz-mitarbeiter', { params: { auftragNr } });
    const all = [];
    (res.data || []).forEach(s => s.mitarbeiter?.forEach(ma => {
      if (!all.find(m => m.personalNr === ma.personalNr)) all.push(ma);
    }));
    einsatzMitarbeiter.value = all;
    mitarbeiterRows.value = [];
    // Pre-fill Mitarbeiter count
    if (all.length) form.mitarbeiter_anzahl = String(all.length);
  } catch { einsatzMitarbeiter.value = []; }
}



function resetForm() {
  clearDraft();
  submitSuccess.value = false;
  selectedEinsatzId.value = '';
  mitarbeiterRows.value = [];
  einsatzMitarbeiter.value = [];
  Object.keys(form).forEach(k => form[k] = '');
}

async function submitReport() {
  submitting.value = true;
  try {
    await props.api.post('/api/public/eventreport', {
      location: form.location,
      kunde: form.kunde,
      auftragnummer: form.auftragnummer,
      name_teamleiter: teamleiterName.value,
      mitarbeiter_anzahl: form.mitarbeiter_anzahl,
      datum: form.datum,
      puenktlichkeit: form.puenktlichkeit,
      erscheinungsbild: form.erscheinungsbild,
      team: form.team,
      mitarbeiter_job: !mitarbeiterRows.value.length ? form.mitarbeiter_job : '',
      mitarbeiter_feedback: mitarbeiterRows.value
        .filter(r => r.text.trim())
        .map(r => ({ personalNr: r.personalNr, name: r.name, text: r.text.trim() })),
      feedback_auftraggeber: form.feedback_auftraggeber,
      sonstiges: form.sonstiges,
      teamleiter_email: props.email
    });
    submitSuccess.value = true;
    clearDraft();
  } catch (err) {
    console.error('Submit error:', err);
    alert('Fehler beim Absenden: ' + (err.response?.data?.msg || err.message));
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.eventreport-view {
  padding: 0 0 2rem;
}

.ma-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.ma-chip {
  background: var(--tile-bg);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 0.3rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.ma-chip:active,
.ma-chip:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(238, 175, 103, 0.08);
}

.ma-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.ma-row-pill {
  display: none;
}

.ma-row {
  display: flex;
  flex-direction: column;
}

.ma-row-field {
  position: relative;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 1.1rem 0.65rem 0.5rem;
  margin: 0;
  transition: border-color 0.2s;
  background: var(--tile-bg);
}

.ma-row-field:focus-within {
  border-color: var(--primary);
}

.ma-row-legend {
  position: absolute;
  top: 0;
  left: 0.6rem;
  transform: translateY(-50%);
  background: linear-gradient(to bottom, var(--bg) 50%, var(--tile-bg) 50%);
  color: var(--primary);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0 0.25rem;
  line-height: 1;
  pointer-events: none;
  white-space: nowrap;
}

.ma-row-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
  padding: 0.1rem 1.5rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  line-height: 1.4;
  display: block;
}

.ma-row-input:focus {
  outline: none;
}

.ma-row-remove {
  position: absolute;
  top: 0.3rem;
  right: 0.4rem;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.4rem;
  -webkit-tap-highlight-color: transparent;
  z-index: 1;
}

.ma-row-remove:hover {
  color: #e74c3c;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  -webkit-tap-highlight-color: transparent;
}

.view-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 1.25rem;
}

/* Success */
.success-state {
  text-align: center;
  padding: 3rem 1rem;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #28a745;
  color: white;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.success-state h3 {
  font-size: 1.2rem;
  margin: 0 0 0.5rem;
  color: var(--text);
}

.success-state p {
  color: var(--muted);
  margin: 0 0 1.5rem;
}

.btn-secondary {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.65rem 1.5rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* Form */
.report-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.form-group {
  margin-bottom: 1rem;
  position: relative;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-group input,
.form-group textarea:not(.ma-row-input) {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 0.9rem;
  font-family: inherit;
  background: var(--tile-bg);
  color: var(--text);
  transition: border-color 0.2s;
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
}

.form-group input:focus,
.form-group textarea:not(.ma-row-input):focus {
  outline: none;
  border-color: var(--primary);
}

.readonly {
  opacity: 0.6;
  pointer-events: none;
}

/* Custom Select */
.custom-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
  -webkit-tap-highlight-color: transparent;
}

.custom-select .placeholder {
  color: var(--muted);
}

.custom-select i {
  font-size: 0.7rem;
  color: var(--muted);
}

/* Picker Sheet (mobile-native feel) */
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.picker-sheet {
  background: var(--panel);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.picker-header h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text);
}

.picker-close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
}

.picker-list {
  overflow-y: auto;
  padding: 0.5rem 0;
}

.picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.picker-item:active {
  background: var(--hover);
}

.picker-item.active {
  background: rgba(255, 117, 24, 0.08);
}

.picker-item-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.picker-item-date {
  font-size: 0.75rem;
  color: var(--muted);
}

/* Rating Chips */
.rating-section {
  margin-bottom: 0.5rem;
}

.rating-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.rating-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s;
}

.chip:active {
  transform: scale(0.95);
}

.chip.active {
  border-color: var(--primary);
  background: rgba(255, 117, 24, 0.1);
  color: var(--primary);
  font-weight: 600;
}

/* Submit */
.submit-btn {
  width: auto;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0.5rem auto 0;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s;
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.98);
  filter: brightness(1.1);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
