<template>
  <div class="evaluierungen-view">

    <!-- Back Button -->
    <button class="back-btn" @click="$emit('back')">
      <font-awesome-icon icon="fa-solid fa-arrow-left" /> Zurück
    </button>

    <h2 class="view-title">Evaluierungen</h2>

    <!-- Offen: Laufzettel received ohne eingereichte Evaluierung -->
    <div class="section">
      <h3 class="section-title">
        <font-awesome-icon icon="fa-solid fa-clock" /> Offene Laufzettel
        <span class="count">{{ openLaufzettel.length }}</span>
      </h3>
      <div v-if="openLaufzettel.length === 0" class="empty">Keine offenen Evaluierungen.</div>
      <div v-for="lz in openLaufzettel" :key="lz._id" class="doc-card">
        <div class="doc-icon">
          <font-awesome-icon icon="fa-solid fa-file-lines" />
        </div>
        <div class="doc-info">
          <span class="doc-title">{{ getLaufzettelLabel(lz) }}</span>
          <span class="doc-date" v-if="lz.datum || lz.createdAt">{{ formatDate(lz.datum || lz.createdAt) }}</span>
          <span class="doc-sub" v-if="lz.name_teamleiter">Teamleiter: {{ lz.name_teamleiter }}</span>
        </div>
        <button class="btn-schreiben" @click="$emit('write-evaluierung', lz)">
          <font-awesome-icon icon="fa-solid fa-pen" /> Schreiben
        </button>
      </div>
    </div>

    <!-- Eingereicht: alle evaluierungen_submitted -->
    <div class="section">
      <h3 class="section-title">
        <font-awesome-icon icon="fa-solid fa-paper-plane" /> Eingereichte Evaluierungen
        <span class="count">{{ submitted.length }}</span>
      </h3>
      <div v-if="submitted.length === 0" class="empty">Noch keine Evaluierungen eingereicht.</div>
      <div v-for="ev in sortedSubmitted" :key="ev._id" class="doc-card">
        <div class="doc-icon submitted-icon">
          <font-awesome-icon icon="fa-solid fa-file-circle-check" />
        </div>
        <div class="doc-info">
          <span class="doc-title">{{ getEvaluierungLabel(ev) }}</span>
          <span class="doc-date" v-if="ev.datum || ev.createdAt">{{ formatDate(ev.datum || ev.createdAt) }}</span>
          <span class="doc-sub" v-if="ev.name_teamleiter">Teamleiter: {{ ev.name_teamleiter }}</span>
        </div>
        <span class="doc-status done">Eingereicht</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft, faClock, faPaperPlane, faFileLines, faFileCircleCheck, faPen
} from '@fortawesome/free-solid-svg-icons';

library.add(faArrowLeft, faClock, faPaperPlane, faFileLines, faFileCircleCheck, faPen);

const props = defineProps({
  received: { type: Array, default: () => [] },  // laufzettel_received
  submitted: { type: Array, default: () => [] }, // evaluierungen_submitted
});

defineEmits(['back', 'write-evaluierung']);

// ── Filter / sort ─────────────────────────────
const submittedLaufzettelIds = computed(() => {
  const ids = new Set();
  for (const ev of props.submitted) {
    const lz = ev.laufzettel;
    if (!lz) continue;
    let id;
    if (typeof lz === 'string') {
      id = lz;
    } else if (lz._id) {
      id = String(lz._id);
    } else {
      id = lz.toString();
    }
    if (id) ids.add(id);
  }
  return ids;
});

const openLaufzettel = computed(() =>
  props.received
    .filter(lz => !submittedLaufzettelIds.value.has(String(lz._id)))
    .slice()
    .sort((a, b) => new Date(b.datum || b.createdAt) - new Date(a.datum || a.createdAt))
);

const sortedSubmitted = computed(() =>
  props.submitted
    .slice()
    .sort((a, b) => new Date(b.datum || b.createdAt) - new Date(a.datum || a.createdAt))
);

function getLaufzettelLabel(lz) {
  if (lz.name_mitarbeiter && lz.name_teamleiter)
    return `${lz.name_mitarbeiter} – ${lz.name_teamleiter}`;
  if (lz.task_id) return `Laufzettel #${lz.task_id}`;
  return 'Laufzettel';
}

function getEvaluierungLabel(ev) {
  if (ev.name_mitarbeiter && ev.name_teamleiter)
    return `${ev.name_mitarbeiter} – ${ev.name_teamleiter}`;
  if (ev.task_id) return `Evaluierung #${ev.task_id}`;
  return 'Evaluierung';
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<style scoped>
.evaluierungen-view {
  padding: 0 0 2rem;
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

.section {
  margin-bottom: 1.5rem;
}

.section-title {
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

.doc-date {
  font-size: 0.75rem;
  color: var(--muted);
}

.doc-sub {
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

.doc-status.pending {
  background: rgba(255, 193, 7, 0.15);
  color: #e6a200;
}

.doc-status.done {
  background: rgba(40, 167, 69, 0.15);
  color: #28a745;
}

/* Schreiben Button */
.btn-schreiben {
  background: transparent;
  color: var(--primary);
  border: 2px solid var(--primary);
  border-radius: 12px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s;
}

.btn-schreiben:active {
  transform: scale(0.98);
  filter: brightness(1.1);
}

/* Overlay */
.form-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.form-sheet {
  background: var(--panel, #fff);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.form-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.form-close {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem;
}

.form-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prefill-info {
  background: var(--hover, #f5f5f5);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.prefill-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.prefill-label {
  color: var(--muted);
  min-width: 80px;
  font-weight: 600;
}

.prefill-value {
  color: var(--text);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}

.form-input {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 0.9rem;
  background: var(--panel, #fff);
  color: var(--text);
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

textarea.form-input {
  resize: vertical;
  min-height: 80px;
}

.rating-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.rating-chip {
  border: 1.5px solid var(--border);
  background: var(--panel, #fff);
  color: var(--text);
  border-radius: 8px;
  padding: 0.4rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

.rating-chip.active {
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.btn-cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.submit-btn {
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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
  margin: 0;
  color: var(--text);
}

.success-state p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
