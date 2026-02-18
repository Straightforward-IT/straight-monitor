<template>
  <div class="evaluierungen-view">

    <h2 class="view-title">Evaluierungen</h2>

    <!-- Offen (received but not yet submitted) -->
    <div class="section">
      <h3 class="section-title">
        <font-awesome-icon icon="fa-solid fa-clock" /> Offen
        <span class="count">{{ openItems.length }}</span>
      </h3>
      <div v-if="openItems.length === 0" class="empty">Keine offenen Evaluierungen.</div>
      <div v-for="doc in openItems" :key="doc._id || doc.name" class="doc-card">
        <div class="doc-icon">
          <font-awesome-icon icon="fa-solid fa-file-lines" />
        </div>
        <div class="doc-info">
          <span class="doc-title">{{ doc.title || doc.name || 'Laufzettel' }}</span>
          <span class="doc-date" v-if="doc.createdAt">{{ formatDate(doc.createdAt) }}</span>
        </div>
        <span class="doc-status pending">Offen</span>
      </div>
    </div>

    <!-- Eingereicht -->
    <div class="section">
      <h3 class="section-title">
        <font-awesome-icon icon="fa-solid fa-paper-plane" /> Eingereicht
        <span class="count">{{ submitted.length }}</span>
      </h3>
      <div v-if="submitted.length === 0" class="empty">Noch keine Evaluierungen eingereicht.</div>
      <div v-for="doc in submitted" :key="doc._id || doc.name" class="doc-card">
        <div class="doc-icon submitted-icon">
          <font-awesome-icon icon="fa-solid fa-file-circle-check" />
        </div>
        <div class="doc-info">
          <span class="doc-title">{{ doc.title || doc.name || 'Evaluierung' }}</span>
          <span class="doc-date" v-if="doc.createdAt">{{ formatDate(doc.createdAt) }}</span>
        </div>
        <span class="doc-status done">Eingereicht</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  received: { type: Array, default: () => [] },
  submitted: { type: Array, default: () => [] }
});

defineEmits(['back']);

// Only show received items that haven't been submitted yet
const openItems = computed(() => {
  const submittedIds = new Set(
    props.submitted.map(s => s._id || s.name || s.title).filter(Boolean)
  );
  return props.received.filter(r => {
    const id = r._id || r.name || r.title;
    return !submittedIds.has(id);
  });
});

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
</style>
