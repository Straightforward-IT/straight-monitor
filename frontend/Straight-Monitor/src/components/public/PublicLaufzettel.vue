<template>
  <div class="laufzettel-view">

    <div class="title-row">
      <h2 class="view-title">Laufzettel</h2>
      <button class="btn-new" @click="openForm" v-if="!showForm && !submitSuccess">
        <font-awesome-icon icon="fa-solid fa-plus" /> Neu
      </button>
    </div>

    <!-- ── SUCCESS ─────────────────────────────── -->
    <div v-if="submitSuccess" class="success-state">
      <div class="success-icon">
        <font-awesome-icon icon="fa-solid fa-check" />
      </div>
      <h3>Laufzettel eingereicht!</h3>
      <p>Dein Laufzettel wurde erfolgreich übermittelt.</p>
    </div>

    <!-- ── FORM ───────────────────────────────── -->
    <div v-else-if="showForm" class="form-card">
      <h3 class="form-title">Neuer Laufzettel</h3>

      <!-- Step 1: Job auswählen -->
      <div class="form-group">
        <label>Job auswählen *</label>
        <div class="custom-select" @click="showJobPicker = !showJobPicker">
          <span v-if="!selectedEinsatz" class="placeholder">— Job wählen —</span>
          <span v-else class="selected-value">{{ selectedEinsatzLabel }}</span>
          <font-awesome-icon icon="fa-solid fa-chevron-down" />
        </div>
        <div v-if="showJobPicker" class="picker-overlay" @click="showJobPicker = false">
          <div class="picker-sheet" @click.stop>
            <div class="picker-header">
              <h4>Job wählen</h4>
              <button class="picker-close" @click="showJobPicker = false">
                <font-awesome-icon icon="fa-solid fa-times" />
              </button>
            </div>
            <div class="picker-list">
              <div
                v-for="e in pastEinsaetze"
                :key="e._id"
                class="picker-item"
                :class="{ active: selectedEinsatz?._id === e._id }"
                @click="selectEinsatz(e)"
              >
                <span class="picker-item-title">
                  {{ e.auftrag?.eventTitel || e.bezeichnung || `#${e.auftragNr}` }}
                </span>
                <span class="picker-item-date">{{ formatDate(e.datumVon) }}</span>
              </div>
              <div v-if="pastEinsaetze.length === 0" class="picker-empty">
                Keine vergangenen Jobs gefunden.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Auto-filled info -->
      <div v-if="selectedEinsatz" class="prefill-info">
        <div class="prefill-row">
          <span class="prefill-label">Datum</span>
          <span class="prefill-value">{{ formatDate(selectedEinsatz.datumVon) }}</span>
        </div>
        <div class="prefill-row" v-if="selectedEinsatz.auftrag?.eventLocation || selectedEinsatz.auftrag?.eventOrt">
          <span class="prefill-label">Ort</span>
          <span class="prefill-value">{{ selectedEinsatz.auftrag?.eventLocation || selectedEinsatz.auftrag?.eventOrt }}</span>
        </div>
      </div>

      <!-- Step 2: Teamleiter auswählen -->
      <div class="form-group" v-if="selectedEinsatz">
        <label>Teamleiter auswählen *</label>
        <div v-if="loadingTeamleiter" class="loading-hint">
          <font-awesome-icon icon="fa-solid fa-spinner" spin /> Lade Mitarbeiter…
        </div>
        <div v-else-if="teamleiterCandidates.length === 0" class="empty-hint-sm">
          Keine Kandidaten gefunden.
        </div>
        <div v-else class="tl-chips">
          <button
            v-for="tl in teamleiterCandidates"
            :key="tl.personalnr"
            type="button"
            class="tl-chip"
            :class="{ active: selectedTeamleiter?.personalnr === tl.personalnr }"
            @click="selectedTeamleiter = tl"
          >
            {{ tl.vorname }} {{ tl.nachname }}
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="form-actions" v-if="selectedEinsatz">
        <button class="btn-cancel" @click="closeForm" type="button">Abbrechen</button>
        <button
          class="submit-btn"
          type="button"
          :disabled="!selectedTeamleiter || submitting"
          @click="submitLaufzettel"
        >
          <span v-if="submitting">
            <font-awesome-icon icon="fa-solid fa-spinner" spin /> Wird gesendet…
          </span>
          <span v-else>
            <font-awesome-icon icon="fa-solid fa-paper-plane" /> Einreichen
          </span>
        </button>
      </div>
      <div class="form-actions" v-else>
        <button class="btn-cancel" @click="closeForm" type="button">Abbrechen</button>
      </div>
    </div>

    <!-- ── SUBMITTED LIST ─────────────────────── -->
    <div class="section" v-if="!showForm && !submitSuccess">
      <h3 class="section-label">
        <font-awesome-icon icon="fa-solid fa-paper-plane" /> Eingereichte Laufzettel
        <span class="count">{{ submitted.length }}</span>
      </h3>
      <div v-if="submitted.length === 0" class="empty">
        Noch keine Laufzettel eingereicht.
      </div>
      <div v-for="doc in submitted" :key="doc._id" class="doc-card">
        <div class="doc-icon submitted-icon">
          <font-awesome-icon icon="fa-solid fa-file-circle-check" />
        </div>
        <div class="doc-info">
          <span class="doc-title">{{ doc.name_teamleiter || doc.title || doc.name || 'Laufzettel' }}</span>
          <span class="doc-meta" v-if="doc.location">
            <font-awesome-icon icon="fa-solid fa-location-dot" /> {{ doc.location }}
          </span>
          <span class="doc-date" v-if="doc.datum || doc.createdAt">
            {{ formatDate(doc.datum || doc.createdAt) }}
          </span>
        </div>
        <span :class="['doc-status', doc.status === 'ABGESCHLOSSEN' || doc.status === 'Bearbeitet' ? 'done' : 'submitted']">{{ doc.status === 'ABGESCHLOSSEN' ? 'Bewertet' : doc.status === 'Bearbeitet' ? 'Bewertet' : 'Eingereicht' }}</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  submitted: { type: Array, default: () => [] },
  einsaetze: { type: Array, default: () => [] },
  api: { type: Object, required: true },
  email: { type: String, default: '' }
});

const emit = defineEmits(['back', 'laufzettel-submitted']);

// ── UI state ──────────────────────────────────
const showForm = ref(false);
const submitSuccess = ref(false);
const submitting = ref(false);

// ── Job selection ─────────────────────────────
const showJobPicker = ref(false);
const selectedEinsatz = ref(null);

const pastEinsaetze = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return props.einsaetze
    .filter(e => e.datumBis && new Date(e.datumBis) < today)
    .sort((a, b) => new Date(b.datumVon) - new Date(a.datumVon));
});

const selectedEinsatzLabel = computed(() => {
  if (!selectedEinsatz.value) return '';
  const e = selectedEinsatz.value;
  return `${e.auftrag?.eventTitel || e.bezeichnung || `#${e.auftragNr}`} (${formatDate(e.datumVon)})`;
});

async function selectEinsatz(e) {
  selectedEinsatz.value = e;
  showJobPicker.value = false;
  selectedTeamleiter.value = null;
  await loadTeamleiter(e.auftragNr);
}

// ── Teamleiter selection ──────────────────────
const teamleiterCandidates = ref([]);
const selectedTeamleiter = ref(null);
const loadingTeamleiter = ref(false);

async function loadTeamleiter(auftragNr) {
  loadingTeamleiter.value = true;
  teamleiterCandidates.value = [];
  try {
    const res = await props.api.get('/api/public/einsatz-teamleiter', {
      params: { auftragNr }
    });
    // Exclude the current user from the list
    teamleiterCandidates.value = (res.data || []).filter(
      tl => (tl.email || '').toLowerCase() !== (props.email || '').toLowerCase()
    );
  } catch (err) {
    console.error('Could not load teamleiter candidates', err);
  } finally {
    loadingTeamleiter.value = false;
  }
}

// ── Form lifecycle ────────────────────────────
function openForm() {
  showForm.value = true;
  submitSuccess.value = false;
  selectedEinsatz.value = null;
  selectedTeamleiter.value = null;
  teamleiterCandidates.value = [];
}

function closeForm() {
  showForm.value = false;
}

function resetForm() {
  submitSuccess.value = false;
  openForm();
}

// ── Submit ────────────────────────────────────
async function submitLaufzettel() {
  if (!selectedEinsatz.value || !selectedTeamleiter.value) return;
  submitting.value = true;
  try {
    await props.api.post('/api/public/laufzettel', {
      email: props.email,
      auftragNr: selectedEinsatz.value.auftragNr,
      teamleiter_email: selectedTeamleiter.value.email
    });
    showForm.value = false;
    submitSuccess.value = true;
    emit('laufzettel-submitted');
  } catch (err) {
    console.error('Laufzettel submit error:', err);
    alert('Fehler beim Einreichen: ' + (err.response?.data?.msg || err.message));
  } finally {
    submitting.value = false;
  }
}

// ── Helpers ───────────────────────────────────
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
}
</script>

<style scoped>
.laufzettel-view {
  padding: 0 0 2rem;
}

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

  &:hover {
    background: color-mix(in oklab, var(--primary) 10%, transparent);
  }
}

/* ── Success ── */
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2rem 1rem;
  gap: 0.75rem;
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(40, 167, 69, 0.15);
  color: #28a745;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.success-state h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}

.success-state p {
  font-size: 0.875rem;
  color: var(--muted);
}

.btn-secondary {
  background: var(--tile-bg);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  margin-top: 0.5rem;
}

/* ── Form card ── */
.form-card {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.form-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.custom-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--text);
  -webkit-tap-highlight-color: transparent;
}

.custom-select .placeholder {
  color: var(--muted);
}

.custom-select .selected-value {
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 0.5rem;
}

/* Picker */
.picker-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.picker-sheet {
  background: var(--tile-bg);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-height: 65vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.picker-header h4 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.picker-close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem;
}

.picker-list {
  overflow-y: auto;
  flex: 1;
  padding: 0.5rem 0;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  gap: 0.5rem;
}

.picker-item:active,
.picker-item.active {
  background: rgba(238, 175, 103, 0.1);
}

.picker-item-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-item-date {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.picker-empty {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1.5rem;
  font-style: italic;
}

/* Prefill info */
.prefill-info {
  background: var(--bg);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.prefill-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.82rem;
}

.prefill-label {
  color: var(--muted);
  font-weight: 600;
  min-width: 90px;
}

.prefill-value {
  color: var(--text);
  font-weight: 500;
}

/* Teamleiter chips */
.tl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tl-chip {
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 0.35rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.tl-chip.active {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(238, 175, 103, 0.1);
}

.loading-hint {
  font-size: 0.85rem;
  color: var(--muted);
  padding: 0.5rem 0;
}

.empty-hint-sm {
  font-size: 0.85rem;
  color: var(--muted);
  padding: 0.5rem 0;
  font-style: italic;
}

/* Form actions */
.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
  justify-content: flex-end;
}

.btn-cancel {
  background: none;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.submit-btn {
  background: #fff;
  color: var(--primary);
  border: 1.5px solid var(--primary);
  border-radius: 8px;
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Submitted list ── */
.section {
  margin-bottom: 1.5rem;
}

.section-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.count {
  background: var(--hover);
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
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
  background: rgba(255, 117, 24, 0.1);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.submitted-icon {
  background: rgba(40, 167, 69, 0.1);
  color: #28a745;
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
</style>
