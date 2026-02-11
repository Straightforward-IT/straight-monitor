<template>
  <article class="customer-card" :data-theme="effectiveTheme">
    <!-- Header -->
    <header class="card-header">
      <div class="left">
        <div class="icon-box">
          <font-awesome-icon :icon="['fas', 'building']" class="header-icon" />
        </div>
        <div class="title">
          <span class="kunden-nr">Kunden-Nr. {{ kunde.kundenNr }}</span>
          <span class="name">{{ kunde.kundName || 'Unbenannt' }}</span>
        </div>
      </div>
      <div class="right">
        <span class="status-badge" :class="getStatusClass(kunde.kundStatus)">
          {{ getStatusText(kunde.kundStatus) }}
        </span>
      </div>
    </header>

    <!-- Body -->
    <div class="card-body">
      
      <!-- General Info -->
      <section class="section info-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'info-circle']" /> Allgemeine Daten
        </h4>
        <div class="kv-grid">
          <div class="kv-item">
            <span class="label">Geschäftsstelle</span>
            <span class="value">{{ getGeschStText(kunde.geschSt) }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Kostenstelle</span>
            <span class="value">{{ kunde.kostenSt || '—' }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Kunde seit</span>
            <span class="value">{{ formatDate(kunde.kundeSeit) }}</span>
          </div>
        </div>
      </section>

      <!-- Remarks -->
      <section class="section remarks-section" v-if="kunde.bemerkung && kunde.bemerkung.length > 0">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'clipboard']" /> Bemerkungen
        </h4>
        <ul class="remarks-list">
          <li v-for="(rem, index) in kunde.bemerkung" :key="index" class="remark-item">
            {{ rem }}
          </li>
        </ul>
      </section>

      <!-- Contacts -->
      <section class="section contacts-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'address-book']" /> Kontakte
          <span class="badge">{{ kunde.kontakte ? kunde.kontakte.length : 0 }}</span>
        </h4>
        
        <div v-if="!kunde.kontakte || kunde.kontakte.length === 0" class="empty-contacts">
          Keine Kontakte hinterlegt.
        </div>

        <div v-else class="contacts-list">
          <div v-for="(kontakt, idx) in kunde.kontakte" :key="idx" class="contact-card">
            <div class="contact-header">
              <div class="contact-name">
                <font-awesome-icon :icon="['fas', 'user']" />
                {{ kontakt.vorname }} {{ kontakt.nachname }}
              </div>
              <div class="contact-meta">
                <span v-if="kontakt.angelegtVon?.name" class="creator" title="Angelegt von">
                  <font-awesome-icon :icon="['fas', 'pen']" class="small-icon" /> {{ kontakt.angelegtVon.name }}
                </span>
              </div>
            </div>
            
            <div class="contact-details">
              <div v-if="kontakt.email" class="detail-row">
                <font-awesome-icon :icon="['fas', 'envelope']" />
                <a :href="`mailto:${kontakt.email}`">{{ kontakt.email }}</a>
              </div>
              <div v-if="kontakt.telefon" class="detail-row">
                <font-awesome-icon :icon="['fas', 'phone']" />
                <a :href="`tel:${kontakt.telefon}`">{{ kontakt.telefon }}</a>
              </div>
            </div>

            <!-- Contact Comments -->
            <div v-if="kontakt.kommentare && kontakt.kommentare.length > 0" class="contact-comments">
               <div class="comments-label">Kommentare ({{ kontakt.kommentare.length }})</div>
               <div v-for="(comment, cIdx) in kontakt.kommentare" :key="cIdx" class="comment-item">
                 <div class="comment-text">{{ comment.text }}</div>
                 <div class="comment-footer">
                   <span class="date">{{ formatDate(comment.datum) }}</span>
                   <span v-if="comment.verfasser?.name" class="author"> · {{ comment.verfasser.name }}</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Analytics -->
      <section class="section analytics-section" v-if="kunde.kundenNr">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'chart-bar']" /> Einsatz-Analytics
        </h4>
        <KundenAnalyticsEmbed :kundenNr="kunde.kundenNr" :geschSt="kunde.geschSt" @navigate="$emit('close')" />
      </section>

    </div>

    <!-- Footer -->
    <footer class="card-footer">
      <button class="btn btn-secondary" @click="$emit('close')">Schließen</button>
      <!-- Placeholder for Edit Action -->
      <!-- <button class="btn btn-primary">Bearbeiten</button> -->
    </footer>
  </article>
</template>

<script setup>
import { computed, inject } from 'vue';
import { useTheme } from '@/stores/theme';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import KundenAnalyticsEmbed from './KundenAnalyticsEmbed.vue';

const props = defineProps({
  kunde: { type: Object, required: true }
});

const emit = defineEmits(['close']);

const theme = useTheme();
const effectiveTheme = computed(() => theme.current || 'light');

function getStatusText(status) {
  switch(status) {
    case 1: return 'Potentiell';
    case 2: return 'Aktiv';
    case 3: return 'Inaktiv';
    default: return 'Unbekannt';
  }
}

function getStatusClass(status) {
  switch(status) {
    case 1: return 'status-lead';
    case 2: return 'status-active';
    case 3: return 'status-inactive';
    default: return '';
  }
}

function getGeschStText(gs) {
  if (!gs) return '—';
  // Standard mappings based on AuftraegePage and other components
  if (gs === '1' || gs === 1) return 'Berlin';
  if (gs === '2' || gs === 2) return 'Hamburg';
  if (gs === '3' || gs === 3) return 'Köln';
  return gs;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
</script>

<style scoped>
.customer-card {
  display: flex;
  flex-direction: column;
  background: var(--tile-bg);
  border-radius: 12px;
  overflow: hidden;
  max-height: 90vh;
  width: 100%;
}

/* Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--tile-bg);
  border-bottom: 1px solid var(--border);
}

.left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-box {
  width: 42px;
  height: 42px;
  background: var(--hover);
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--primary);
  font-size: 18px;
}

.title {
  display: flex;
  flex-direction: column;
}

.kunden-nr {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
}

.name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.status-active { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.status-inactive { background: rgba(107, 114, 128, 0.15); color: #6b7280; }
.status-lead { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

/* Body */
.card-body {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg { color: var(--muted); }
}

.badge {
  background: var(--soft);
  color: var(--text);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

/* Info Grid */
.kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--soft);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.kv-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.value {
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
}

/* Remarks */
.remarks-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.remark-item {
  position: relative;
  padding-left: 16px;
  margin-bottom: 8px;
  color: var(--text);
  font-size: 14px;
}

.remark-item::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: bold;
}

/* Contacts */
.contacts-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.empty-contacts {
  color: var(--muted);
  font-style: italic;
  font-size: 14px;
}

.contact-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contact-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.contact-name {
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg { color: var(--muted); }
}

.contact-meta {
  font-size: 11px;
  color: var(--muted);
}

.contact-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  
  svg { width: 14px; color: var(--muted); }
  
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
}

.contact-comments {
  margin-top: 8px;
  background: var(--hover);
  padding: 8px 12px;
  border-radius: 6px;
}

.comments-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.comment-item {
  font-size: 12px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.comment-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.comment-text {
  color: var(--text);
  margin-bottom: 2px;
}

.comment-footer {
  font-size: 10px;
  color: var(--muted);
}

/* Footer */
.card-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--tile-bg);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--tile-bg);
  border-color: var(--border);
  color: var(--text);
}
.btn-secondary:hover {
  background: var(--hover);
}

.btn-primary {
  background: var(--primary);
  color: white;
}
.btn-primary:hover {
  filter: brightness(1.1);
}
</style>
