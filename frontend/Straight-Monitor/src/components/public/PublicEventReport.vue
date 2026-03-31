<template>
  <div class="eventreport-view">

    <!-- ── LIST VIEW ──────────────────────────────────── -->
    <template v-if="!showForm && !submitSuccess && !detailReport">
      <div class="title-row">
        <h2 class="view-title">Event Reports</h2>
        <button class="btn-new" @click="openForm">
          <font-awesome-icon icon="fa-solid fa-plus" /> Neu
        </button>
      </div>

      <div class="section">
        <div v-if="sortedReports.length === 0" class="empty">
          Noch keine Event Reports geschrieben.
        </div>
        <div v-for="report in sortedReports" :key="report._id || report.auftragnummer" class="doc-card doc-card--clickable" @click="openDetail(report)">
          <div class="doc-icon">
            <img :src="imgEventreport" class="doc-icon-img" alt="" />
          </div>
          <div class="doc-info">
            <span class="doc-title">{{ report.auftrag?.eventTitel || report.kunde || report.location || 'Event Report' }}</span>
            <span class="doc-meta" v-if="report.location">
              <font-awesome-icon icon="fa-solid fa-location-dot" /> {{ report.location }}
            </span>
            <span class="doc-date" v-if="report.datum">
              {{ formatDate(report.datum) }}
            </span>
          </div>
          <div class="doc-card-right">
            <font-awesome-icon icon="fa-solid fa-chevron-right" class="doc-chevron" />
          </div>
        </div>
      </div>
    </template>

    <!-- ── DETAIL VIEW ─────────────────────────────────── -->
    <template v-else-if="detailReport && !showForm && !submitSuccess">
      <div class="detail-header">
        <button class="back-btn" @click="closeDetail">
          <font-awesome-icon icon="fa-solid fa-chevron-left" /> Zurück
        </button>
      </div>

      <h2 class="detail-title">{{ detailReport.kunde || detailReport.location || 'Event Report' }}</h2>

      <div class="detail-section">
        <div class="detail-row" v-if="detailReport.datum">
          <span class="detail-label"><font-awesome-icon icon="fa-solid fa-calendar" /> Datum</span>
          <span class="detail-value">{{ formatDate(detailReport.datum) }}</span>
        </div>
        <div class="detail-row" v-if="detailReport.kunde">
          <span class="detail-label"><font-awesome-icon icon="fa-solid fa-building" /> Kunde</span>
          <span class="detail-value">{{ detailReport.kunde }}</span>
        </div>
        <div class="detail-row" v-if="detailReport.auftrag?.eventTitel">
          <span class="detail-label"><font-awesome-icon icon="fa-solid fa-star" /> Event</span>
          <span class="detail-value">{{ detailReport.auftrag.eventTitel }}</span>
        </div>
        <div class="detail-row" v-if="detailReport.auftrag?.eventLocation">
          <span class="detail-label"><font-awesome-icon icon="fa-solid fa-map-pin" /> Venue</span>
          <span class="detail-value">{{ detailReport.auftrag.eventLocation }}</span>
        </div>
        <div class="detail-row" v-if="detailReport.auftrag?.eventStrasse">
          <span class="detail-label"><font-awesome-icon icon="fa-solid fa-location-dot" /> Adresse</span>
          <span class="detail-value">{{ detailReport.auftrag.eventStrasse }}<span v-if="detailReport.auftrag.eventPlz || detailReport.auftrag.eventOrt">, {{ detailReport.auftrag.eventPlz }} {{ detailReport.auftrag.eventOrt }}</span></span>
        </div>
        <div class="detail-row" v-if="detailReport.mitarbeiter_anzahl">
          <span class="detail-label"><font-awesome-icon icon="fa-solid fa-users" /> Mitarbeiter</span>
          <span class="detail-value">{{ detailReport.mitarbeiter_anzahl }}</span>
        </div>
      </div>

      <div class="detail-fields">
        <div class="detail-field" v-if="detailReport.puenktlichkeit">
          <span class="detail-field-label">Pünktlichkeit</span>
          <p class="detail-field-text">{{ detailReport.puenktlichkeit }}</p>
        </div>
        <div class="detail-field" v-if="detailReport.erscheinungsbild">
          <span class="detail-field-label">Erscheinungsbild</span>
          <p class="detail-field-text">{{ detailReport.erscheinungsbild }}</p>
        </div>
        <div class="detail-field" v-if="detailReport.team">
          <span class="detail-field-label">Team</span>
          <p class="detail-field-text">{{ detailReport.team }}</p>
        </div>
        <div class="detail-field" v-if="detailReport.mitarbeiter_job">
          <span class="detail-field-label">Mitarbeiter &amp; Job</span>
          <p class="detail-field-text">{{ detailReport.mitarbeiter_job }}</p>
        </div>
        <!-- Per-Mitarbeiter Feedback -->
        <div v-if="detailReport.mitarbeiter_feedback?.length" class="detail-field">
          <span class="detail-field-label">Mitarbeiter &amp; Job</span>
          <div v-for="mf in detailReport.mitarbeiter_feedback" :key="mf._id || mf.personalNr" class="detail-ma-row">
            <span class="detail-ma-name">{{ mf.name || (mf.mitarbeiter?.vorname + ' ' + mf.mitarbeiter?.nachname) || '—' }}</span>
            <p class="detail-ma-text" v-if="mf.text">{{ mf.text }}</p>
          </div>
        </div>
        <div class="detail-field" v-if="detailReport.feedback_auftraggeber">
          <span class="detail-field-label">Feedback Auftraggeber</span>
          <p class="detail-field-text">{{ detailReport.feedback_auftraggeber }}</p>
        </div>
        <div class="detail-field" v-if="detailReport.sonstiges">
          <span class="detail-field-label">Sonstiges</span>
          <p class="detail-field-text">{{ detailReport.sonstiges }}</p>
        </div>
      </div>

      <!-- Comments -->
      <div v-if="detailReport.comments?.length" class="detail-fields">
        <span class="detail-field-label" style="display:block; margin-bottom:0.5rem;">Kommentare</span>
        <div v-for="c in detailReport.comments" :key="c._id" class="detail-comment">
          <span class="detail-comment-author">{{ c.authorName || 'Unbekannt' }}</span>
          <span class="detail-comment-date">{{ formatDate(c.date) }}</span>
          <p class="detail-comment-text">{{ c.text }}</p>
        </div>
      </div>
    </template>

    <!-- ── FORM / SUCCESS VIEW ────────────────────────── -->
    <template v-else>

    <!-- Success -->
    <div v-if="submitSuccess" class="success-state">
      <div class="success-icon">
        <font-awesome-icon icon="fa-solid fa-check" />
      </div>
      <h3>Erfolgreich gesendet!</h3>
      <p>Dein Event Report wurde eingereicht.</p>
      <button class="btn-secondary" @click="resetForm">Weiteren Report schreiben</button>
      <button class="btn-secondary" @click="backToList">Zur Übersicht</button>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="submitReport" class="report-form">
      <!-- Notizen -->
      <div class="er-notes-row">
        <button type="button" class="er-notes-btn" :class="{ 'er-notes-btn--active': !!form.notizen }" @click="showNotizModal = true">
          <font-awesome-icon icon="fa-solid fa-comment" />
          {{ form.notizen ? 'Notizen bearbeiten' : 'Notizen hinzufügen' }}
          <span v-if="form.notizen" class="er-notes-dot"></span>
        </button>
        <p v-if="form.notizen" class="er-notes-preview">{{ form.notizen }}</p>
      </div>

      
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
          <label>Team</label>
          <textarea v-model="form.team" v-auto-grow rows="4" placeholder="Wie hat das Team zusammengearbeitet?" />
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
                v-auto-grow
                class="ma-row-input"
                rows="2"
                :placeholder="'Pünktlichkeit, Erscheinungsbild, Arbeitsweise…'"
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
        <textarea v-model="form.feedback_auftraggeber" v-auto-grow rows="5" placeholder="Was hat der Auftraggeber gesagt?"></textarea>
      </div>

      <div class="form-group">
        <label>Sonstiges</label>
        <textarea v-model="form.sonstiges" v-auto-grow rows="5" placeholder="Weitere Anmerkungen..."></textarea>
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

    </template><!-- end form/success wrapper -->

    <!-- Notizen Modal -->
    <Transition name="er-notiz">
      <div v-if="showNotizModal" class="er-modal-overlay" @click.self="showNotizModal = false">
        <div class="er-modal-sheet">
          <div class="er-modal-handle"></div>
          <div class="er-modal-icon">
            <font-awesome-icon icon="fa-solid fa-comment" />
          </div>
          <h3 class="er-modal-title">Notizen</h3>
          <textarea
            class="er-notiz-textarea"
            v-model="form.notizen"
            v-auto-grow
            placeholder="Notizen zu diesem Einsatz…"
            rows="5"
            autofocus
          ></textarea>
          <div class="er-modal-actions">
            <button class="er-modal-btn er-modal-btn--cancel" type="button" @click="showNotizModal = false">Schließen</button>
            <button class="er-modal-btn er-modal-btn--confirm" type="button" @click="showNotizModal = false">Speichern</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useTheme } from '@/stores/theme';
import eventreportLight from '@/assets/eventreport.png';
import eventreportDark from '@/assets/eventreport-dark.png';

// Auto-grow directive for textareas
const vAutoGrow = {
  mounted(el) {
    const MAX = 600;
    function adjust() {
      el.style.height = 'auto';
      const h = Math.min(el.scrollHeight, MAX);
      el.style.height = h + 'px';
      el.style.overflowY = el.scrollHeight > MAX ? 'auto' : 'hidden';
    }
    el.addEventListener('input', adjust);
    new ResizeObserver(adjust).observe(el);
    adjust();
  }
};

const props = defineProps({
  einsaetze: { type: Array, default: () => [] },
  mitarbeiter: { type: Object, required: true },
  api: { type: Function, required: true },
  email: { type: String, default: '' },
  prefillEinsatz: { type: Object, default: null }
});

defineEmits(['back']);

// Allow parent to attempt internal back-navigation before leaving the view
function tryGoBack() {
  if (showForm.value || submitSuccess.value) {
    backToList();
    return true;
  }
  if (detailReport.value) {
    closeDetail();
    return true;
  }
  return false;
}

defineExpose({ tryGoBack });

const theme = useTheme();
const imgEventreport = computed(() => theme.isDark ? eventreportDark : eventreportLight);

const ratingOptions = ['Sehr gut', 'Gut', 'Befriedigend', 'Mangelhaft'];
const STANDORT_MAP = { '1': 'Berlin', '2': 'Hamburg', '3': 'Köln' };

const pastEinsaetze = computed(() => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Collect auftragnummern that already have a report by this teamleiter
  const reportedNrs = new Set(
    (props.mitarbeiter?.eventreports || [])
      .map(r => r?.auftragnummer ? String(r.auftragnummer) : null)
      .filter(Boolean)
  );

  return props.einsaetze.filter(e => {
    if (e.datumVon && new Date(e.datumVon) > endOfToday) return false;
    if (e.auftragNr && reportedNrs.has(String(e.auftragNr))) return false;
    return true;
  });
});

const selectedEinsatzId = ref(props.prefillEinsatz?._id || '');
const showEinsatzPicker = ref(false);
const showForm = ref(!!props.prefillEinsatz);
const detailReport = ref(null);
const submitSuccess = ref(false);
const submitting = ref(false);
const einsatzMitarbeiter = ref([]);

const sortedReports = computed(() =>
  [...(props.mitarbeiter?.eventreports || [])]
    .sort((a, b) => new Date(b.datum || b.createdAt || 0) - new Date(a.datum || a.createdAt || 0))
);

function openForm() {
  submitSuccess.value = false;
  detailReport.value = null;
  showForm.value = true;
}

function backToList() {
  submitSuccess.value = false;
  showForm.value = false;
  detailReport.value = null;
}

function openDetail(report) {
  detailReport.value = report;
}

function closeDetail() {
  detailReport.value = null;
}
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

const showNotizModal = ref(false);

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
  sonstiges: '',
  notizen: ''
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
async function loadDraft() {
  // Don't restore if we have a fresh prefill from job detail
  if (props.prefillEinsatz) return false;
  try {
    const raw = localStorage.getItem(`eventreport_draft_${props.mitarbeiter?.personalnr || props.email || 'u'}`);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (draft.selectedEinsatzId) selectedEinsatzId.value = draft.selectedEinsatzId;
    if (draft.form) Object.assign(form, draft.form);
    // Re-fetch Mitarbeiter list so chips are available again
    if (draft.form?.auftragnummer) {
      const savedRows = draft.mitarbeiterRows || [];
      await loadEinsatzMitarbeiter(draft.form.auftragnummer);
      // loadEinsatzMitarbeiter clears rows – restore saved ones
      if (savedRows.length) mitarbeiterRows.value = savedRows;
    } else if (draft.mitarbeiterRows?.length) {
      mitarbeiterRows.value = draft.mitarbeiterRows;
    }
    return true;
  } catch { return false; }
}

// Watch for changes and auto-save draft
watch([() => ({ ...form }), mitarbeiterRows, selectedEinsatzId], saveDraft, { deep: true });

// Persist notizen per Auftrag so they survive across sessions & Einsatz switches
watch(() => form.notizen, (val) => {
  if (!form.auftragnummer) return;
  try {
    if (val && val.trim()) {
      localStorage.setItem(`jobnote_${form.auftragnummer}`, val.trim());
    } else {
      localStorage.removeItem(`jobnote_${form.auftragnummer}`);
    }
  } catch { /* ignore */ }
});

// Pre-fill if coming from job detail
if (props.prefillEinsatz) {
  prefillFromEinsatz(props.prefillEinsatz);
}

onMounted(async () => {
  await loadDraft();
});

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return 'Heute';
  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function selectEinsatz(einsatz) {
  selectedEinsatzId.value = einsatz._id;
  showEinsatzPicker.value = false;
  prefillFromEinsatz(einsatz);
}

function prefillFromEinsatz(einsatz) {
  form.notizen = ''; // Clear before loading auftrag-specific note
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

    // Load server-side noShow state
    let noShowSet = new Set();
    try {
      const checkInRes = await props.api.get('/api/public/checkins', { params: { auftragNr } });
      (checkInRes.data?.noShow || []).forEach(nr => noShowSet.add(nr));
    } catch { /* ignore */ }

    // Pre-fill MA rows from stored annotations (Verspätung from localStorage + Nicht Erschienen from server)
    const prefilledRows = [];
    for (const ma of all) {
      const parts = [];
      if (noShowSet.has(ma.personalNr)) parts.push('Nicht erschienen');
      try {
        const raw = localStorage.getItem(`maannot_${auftragNr}_${ma.personalNr}`);
        if (raw) {
          const ann = JSON.parse(raw);
          if (ann.verspaetung > 0) parts.push(`Verspätung: ${ann.verspaetung} min`);
        }
      } catch { /* ignore */ }
      if (parts.length) {
        const first = ma.vorname || ma.bezeichnung || '';
        const last = ma.nachname || '';
        prefilledRows.push({
          personalNr: ma.personalNr,
          name: (first + ' ' + last).trim(),
          text: parts.join('\n')
        });
      }
    }
    if (prefilledRows.length) {
      mitarbeiterRows.value = prefilledRows;
    }

    // Pre-fill Notizen from job-level note
    try {
      const jobNote = localStorage.getItem(`jobnote_${auftragNr}`);
      if (jobNote && jobNote.trim()) {
        form.notizen = jobNote.trim();
      }
    } catch { /* ignore */ }
  } catch { einsatzMitarbeiter.value = []; }
}



function resetForm() {
  clearDraft();
  submitSuccess.value = false;
  showForm.value = true;
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
      notizen: form.notizen,
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

/* \u2500\u2500 List view \u2500\u2500 */
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.view-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.btn-new {
  background: transparent;
  color: var(--primary);
  border: 1.5px solid var(--primary);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.btn-new:active {
  background: color-mix(in oklab, var(--primary) 10%, transparent);
}

.section {
  margin-bottom: 1.5rem;
}

.empty {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1.25rem;
  background: var(--tile-bg);
  border-radius: 10px;
  font-style: italic;
}

.doc-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 0.5rem;
}

.doc-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 117, 24, 0.2);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.doc-icon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.doc-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.doc-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-meta {
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.doc-date {
  font-size: 0.75rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.doc-card--clickable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.doc-card--clickable:active {
  background: var(--hover);
}
.doc-card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  flex-shrink: 0;
}
.doc-chevron {
  font-size: 0.75rem;
  color: var(--muted);
}
.doc-auftragnr {
  opacity: 0.6;
}

/* ── Detail view ── */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0;
  -webkit-tap-highlight-color: transparent;
}
.back-btn:active { opacity: 0.7; }
.detail-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 1rem;
}
.detail-section {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.detail-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.85rem;
}
.detail-label {
  color: var(--muted);
  font-weight: 600;
  min-width: 130px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.detail-value {
  color: var(--text);
  font-weight: 500;
}
.detail-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.detail-field {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.75rem;
}
.detail-field-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.detail-field-text {
  margin: 0.4rem 0 0;
  font-size: 0.88rem;
  color: var(--text);
  line-height: 1.5;
  white-space: pre-wrap;
}
.detail-ma-row {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}
.detail-ma-row:first-of-type {
  margin-top: 0.4rem;
  padding-top: 0.4rem;
}
.detail-ma-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--primary);
}
.detail-ma-text {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  white-space: pre-wrap;
  line-height: 1.4;
}
.detail-comment {
  background: var(--bg);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.4rem;
}
.detail-comment-author {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text);
}
.detail-comment-date {
  font-size: 0.72rem;
  color: var(--muted);
  margin-left: 0.4rem;
}
.detail-comment-text {
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.4;
  white-space: pre-wrap;
}

.doc-status {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.doc-status.done {
  background: rgba(40, 167, 69, 0.15);
  color: #28a745;
}

.doc-status.submitted {
  background: rgba(255, 107, 0, 0.12);
  color: var(--primary);
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
  resize: none;
  overflow-y: auto;
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
  resize: none;
  overflow: hidden;
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

/* Notizen button row */
.er-notes-row {
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.er-notes-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.er-notes-btn--active {
  border-color: #0ea5e9;
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.07);
}
.er-notes-btn:active { opacity: 0.75; }
.er-notes-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0ea5e9;
  flex-shrink: 0;
}
.er-notes-preview {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: pre-wrap;
  margin: 0;
  padding: 0.5rem 0.75rem;
  background: var(--hover);
  border-radius: 8px;
  border-left: 3px solid #0ea5e9;
}

/* Notizen Modal */
.er-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}
.er-modal-sheet {
  width: 100%;
  background: var(--panel);
  border-radius: 20px 20px 0 0;
  padding: 0.75rem 1.25rem 2rem;
  padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.er-modal-handle {
  width: 36px;
  height: 4px;
  border-radius: 4px;
  background: var(--border);
  margin-bottom: 0.25rem;
}
.er-modal-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(14, 165, 233, 0.12);
  border: 1.5px solid rgba(14, 165, 233, 0.3);
  color: #0ea5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}
.er-modal-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.er-notiz-textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--tile-bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  padding: 0.75rem;
  font-size: 0.9rem;
  color: var(--text);
  font-family: inherit;
  resize: none;
  overflow: hidden;
  outline: none;
  line-height: 1.5;
}
.er-notiz-textarea:focus { border-color: #0ea5e9; }
.er-modal-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}
.er-modal-btn {
  flex: 1;
  padding: 0.8rem;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s;
}
.er-modal-btn:active { opacity: 0.75; }
.er-modal-btn--cancel {
  background: var(--hover);
  color: var(--muted);
}
.er-modal-btn--confirm {
  background: #0ea5e9;
  color: white;
}

/* Modal transition */
.er-notiz-enter-active { transition: opacity 0.2s; }
.er-notiz-leave-active { transition: opacity 0.15s; }
.er-notiz-enter-from, .er-notiz-leave-to { opacity: 0; }
.er-notiz-enter-active .er-modal-sheet { transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
.er-notiz-leave-active .er-modal-sheet { transition: transform 0.2s ease-in; }
.er-notiz-enter-from .er-modal-sheet, .er-notiz-leave-to .er-modal-sheet { transform: translateY(100%); }
</style>
