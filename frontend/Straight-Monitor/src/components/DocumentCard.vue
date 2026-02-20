<template>
  <article class="document-card" :data-theme="effectiveTheme">
    <!-- Header -->
    <header class="card-header">
      <div class="left">
        <div class="doc-icon">
          <img :src="docTypeImage" :alt="doc.docType" class="doc-icon-img" />
        </div>
        <div class="title">
          <span class="doc-type">{{ doc.docType }} <span v-if="doc.version === 'v2'" class="version-badge">v2</span></span>
          <span class="bezeichnung">{{ doc.bezeichnung || 'Kein Titel' }}</span>
        </div>
      </div>
      <!-- Removed status badge -->
    </header>

    <!-- Body -->
    <div class="card-body">
      <!-- Key Details -->
      <section class="details-section">
        <div class="kv">
          <div>
            <dt>Datum</dt>
            <dd>{{ formatDate(doc.datum) }}</dd>
          </div>
          <div v-if="doc.details?.name_teamleiter">
            <dt>Teamleiter</dt>
            <dd>
              <div class="person-detail">
                <template v-if="doc.details?.teamleiter">
                  <button 
                    :class="['btn-icon-tiny', { 'filter-active': isTeamleiterFiltered }]" 
                    @click="$emit('filter-teamleiter', doc.details.name_teamleiter)"
                    :title="isTeamleiterFiltered ? 'Filter aktiv - klicken zum Zurücksetzen' : 'Nach diesem Teamleiter filtern'"
                  >
                    <font-awesome-icon icon="fa-solid fa-filter" />
                  </button>
                  <button class="link-btn" @click="$emit('open-employee', 'teamleiter', getEmployeeId('teamleiter'))">
                    {{ doc.details.name_teamleiter }}
                  </button>
                  <button 
                    v-if="getPersonAsanaId('teamleiter')"
                    class="btn-icon-tiny" 
                    @click="openAsanaTask('teamleiter')"
                    title="Asana Task öffnen"
                  >
                    <img :src="asanaLogo" alt="Asana" class="asana-icon" />
                  </button>
                </template>
                <template v-else>
                  <span class="unassigned-name">
                    {{ doc.details.name_teamleiter }}
                    <font-awesome-icon icon="fa-solid fa-circle-exclamation" class="warn-icon" />
                  </span>
                  <button class="btn btn-sm btn-primary" @click="$emit('assign', 'teamleiter')">
                    <font-awesome-icon icon="fa-solid fa-link" /> Zuweisen
                  </button>
                </template>
              </div>
            </dd>
          </div>
          <div v-else>
            <dt>Teamleiter</dt>
            <dd>
              <button class="btn btn-sm btn-primary" @click="$emit('assign', 'teamleiter')">
                <font-awesome-icon icon="fa-solid fa-link" /> Zuweisen
              </button>
            </dd>
          </div>
          <div v-if="doc.docType !== 'Event-Bericht'">
            <dt>Mitarbeiter</dt>
            <dd v-if="doc.details?.name_mitarbeiter">
              <div class="person-detail">
                <template v-if="doc.details?.mitarbeiter">
                  <button 
                    :class="['btn-icon-tiny', { 'filter-active': isMitarbeiterFiltered }]" 
                    @click="$emit('filter-mitarbeiter', doc.details.name_mitarbeiter)"
                    :title="isMitarbeiterFiltered ? 'Filter aktiv - klicken zum Zurücksetzen' : 'Nach diesem Mitarbeiter filtern'"
                  >
                    <font-awesome-icon icon="fa-solid fa-filter" />
                  </button>
                  <button class="link-btn" @click="$emit('open-employee', 'mitarbeiter', getEmployeeId('mitarbeiter'))">
                    {{ doc.details.name_mitarbeiter }}
                  </button>
                  <button 
                    v-if="getPersonAsanaId('mitarbeiter')"
                    class="btn-icon-tiny" 
                    @click="openAsanaTask('mitarbeiter')"
                    title="Asana Task öffnen"
                  >
                    <img :src="asanaLogo" alt="Asana" class="asana-icon" />
                  </button>
                </template>
                <template v-else>
                  <span class="unassigned-name">
                    {{ doc.details.name_mitarbeiter }}
                    <font-awesome-icon icon="fa-solid fa-circle-exclamation" class="warn-icon" />
                  </span>
                  <button class="btn btn-sm btn-primary" @click="$emit('assign', 'mitarbeiter')">
                    <font-awesome-icon icon="fa-solid fa-link" /> Zuweisen
                  </button>
                </template>
              </div>
            </dd>
            <dd v-else>
              <button class="btn btn-sm btn-primary" @click="$emit('assign', 'mitarbeiter')">
                <font-awesome-icon icon="fa-solid fa-link" /> Zuweisen
              </button>
            </dd>
          </div>


        </div>
      </section>

      <!-- Mitarbeiter Feedback (nur für Event-Berichte mit v2 feedback array) -->
      <section v-if="doc.docType === 'Event-Bericht' && feedbackEntries.length" class="feedback-section">
        <h4 class="section-title">
          <font-awesome-icon icon="fa-solid fa-clipboard-check" class="section-icon" />
          Mitarbeiter Feedback ({{ feedbackEntries.length }})
        </h4>
        <div class="feedback-list">
          <div v-for="(fb, idx) in feedbackEntries" :key="idx" class="feedback-item">
            <div class="feedback-header">
              <button v-if="fb.mitarbeiter?._id" class="link-btn" @click="$emit('open-employee', 'mitarbeiter', fb.mitarbeiter._id)">
                {{ fb.mitarbeiter.vorname }} {{ fb.mitarbeiter.nachname }}
              </button>
              <span v-else class="unassigned-name">Unbekannter MA</span>
            </div>
            <p class="feedback-text">{{ fb.text || '—' }}</p>
          </div>
        </div>
      </section>

      <!-- Bewertung (alle Laufzettel) -->
      <section v-if="doc.docType === 'Laufzettel'" class="feedback-section">
        <h4 class="section-title">
          <font-awesome-icon icon="fa-solid fa-clipboard-check" class="section-icon" />
          Bewertung
        </h4>

        <!-- Noch offen -->
        <div v-if="doc.details?.status !== 'ABGESCHLOSSEN'" class="pending-hint">
          <font-awesome-icon icon="fa-solid fa-clock" class="pending-icon" />
          Bewertung steht noch aus
        </div>

        <!-- Abgeschlossen: Felder anzeigen -->
        <div v-else class="kv-list">
          <div v-if="doc.details?.kunde" class="kv-item">
            <span class="key">Kunde</span>
            <span class="value">{{ doc.details.kunde }}</span>
          </div>
          <div v-if="doc.details?.puenktlichkeit" class="kv-item">
            <span class="key">Pünktlichkeit</span>
            <span class="value">{{ doc.details.puenktlichkeit }}</span>
          </div>
          <div v-if="doc.details?.grooming" class="kv-item">
            <span class="key">Grooming</span>
            <span class="value">{{ doc.details.grooming }}</span>
          </div>
          <div v-if="doc.details?.motivation" class="kv-item">
            <span class="key">Motivation</span>
            <span class="value">{{ doc.details.motivation }}</span>
          </div>
          <div v-if="doc.details?.technische_fertigkeiten" class="kv-item">
            <span class="key">Techn. Fertigkeiten</span>
            <span class="value">{{ doc.details.technische_fertigkeiten }}</span>
          </div>
          <div v-if="doc.details?.lernbereitschaft" class="kv-item">
            <span class="key">Lernbereitschaft</span>
            <span class="value">{{ doc.details.lernbereitschaft }}</span>
          </div>
          <div v-if="doc.details?.sonstiges" class="kv-item">
            <span class="key">Sonstiges</span>
            <span class="value">{{ doc.details.sonstiges }}</span>
          </div>
        </div>
      </section>

      <!-- Raw Details -->
      <section class="raw-details-section">
        <h4 class="section-title">
          <font-awesome-icon icon="fa-solid fa-list" class="section-icon" />
          Details
        </h4>
        <div class="kv-list">
          <div 
            v-for="(value, key) in filteredDetails" 
            :key="key" 
            class="kv-item"
          >
            <span class="key">{{ formatKey(key) }}</span>
            <span class="value">{{ formatValue(key, value) }}</span>
          </div>
        </div>
      </section>

      <!-- Kommentare (nur für Event-Berichte) -->
      <section v-if="doc.docType === 'Event-Bericht'" class="comments-section">
        <h4 class="section-title">
          <font-awesome-icon icon="fa-solid fa-comments" class="section-icon" />
          Kommentare<span v-if="commentList.length" class="comments-count">{{ commentList.length }}</span>
        </h4>
        <div class="comments-list">
          <p v-if="!commentList.length" class="no-comments">Noch keine Kommentare.</p>
          <div v-for="(c, i) in commentList" :key="i" class="comment-item">
            <div class="comment-meta">
              <span class="comment-author">{{ c.authorName || 'Unbekannt' }}</span>
              <span class="comment-date">{{ formatDate(c.date) }}</span>
            </div>
            <p class="comment-text">{{ c.text }}</p>
          </div>
        </div>
        <div class="comment-input-wrapper">
          <textarea
            v-model="newCommentText"
            rows="3"
            placeholder="Kommentar schreiben..."
            class="comment-textarea"
            @keydown.ctrl.enter.prevent="postComment(false)"
          />
          <button
            class="comment-send-btn"
            :disabled="!newCommentText.trim() || commentLoading"
            @click="postComment(false)"
          >
            <font-awesome-icon :icon="commentLoading ? 'fa-solid fa-spinner' : 'fa-solid fa-paper-plane'" :spin="commentLoading" />
            Senden
          </button>
        </div>
      </section>
    </div>

    <!-- Footer -->
    <footer class="card-footer">
      <div class="actions-left">
        <button 
          v-if="getPersonAsanaId('teamleiter')" 
          class="btn btn-sm"
          @click="openAsanaTask('teamleiter')"
        >
          <img :src="asanaLogo" alt="Asana" class="asana-icon" /> Teamleiter Task
        </button>
        <button 
          v-if="doc.docType !== 'Event-Bericht' && getPersonAsanaId('mitarbeiter')" 
          class="btn btn-sm"
          @click="openAsanaTask('mitarbeiter')"
        >
          <img :src="asanaLogo" alt="Asana" class="asana-icon" /> Mitarbeiter Task
        </button>
      </div>
      <div class="footer-right">
        <template v-if="doc.docType === 'Event-Bericht'">
          <button
            class="btn btn-primary"
            :disabled="!newCommentText.trim() || commentLoading"
            @click="postComment(true)"
          >
            <font-awesome-icon icon="fa-solid fa-envelope" />
            An alle ausliefern
          </button>
        </template>
        <button class="btn" @click="$emit('close')">Schließen</button>
      </div>
    </footer>
  </article>
</template>

<script>
import { computed } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useTheme } from "@/stores/theme";
import { useAuth } from "@/stores/auth";
import api from "@/utils/api";
import asanaLogo from "@/assets/asana.png";
import laufzettelIcon from "@/assets/laufzettel.png";
import laufzettelDarkIcon from "@/assets/laufzettel-dark.png";
import eventreportIcon from "@/assets/eventreport.png";
import eventreportDarkIcon from "@/assets/eventreport-dark.png";
import evaluierungIcon from "@/assets/evaluierung.png";
import evaluierungDarkIcon from "@/assets/evaluierung-dark.png";
import {
  faLink,
  faCircleExclamation,
  faList,
  faFilter,
  faFileLines,
  faClipboardCheck,
  faComments,
  faPaperPlane,
  faSpinner,
  faFloppyDisk,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(faLink, faCircleExclamation, faList, faFilter, faFileLines, faClipboardCheck, faComments, faPaperPlane, faSpinner, faFloppyDisk, faEnvelope);

export default {
  name: "DocumentCard",
  components: { FontAwesomeIcon },
  props: {
    doc: { type: Object, required: true },
    personDetails: { type: Object, default: () => ({}) },
    filteredTeamleiter: { type: String, default: null },
    filteredMitarbeiter: { type: String, default: null },
  },
  emits: ["close", "assign", "filter-teamleiter", "filter-mitarbeiter", "open-employee"],

  data() {
    return {
      newCommentText: '',
      commentLoading: false,
      localComments: null,
    };
  },

  setup(props) {
    const theme = useTheme();
    const auth = useAuth();

    const isDark = computed(() => theme.isDark);
    const laufzettelImg = computed(() => isDark.value ? laufzettelDarkIcon : laufzettelIcon);
    const evaluierungImg = computed(() => isDark.value ? evaluierungDarkIcon : evaluierungIcon);
    const eventreportImg = computed(() => isDark.value ? eventreportDarkIcon : eventreportIcon);
    const currentUser = computed(() => auth.user);

    return { asanaLogo, laufzettelImg, evaluierungImg, eventreportImg, currentUser };
  },

  computed: {
    docTypeImage() {
      const type = (this.doc.docType || '').toLowerCase();
      if (type.includes('laufzettel')) return this.laufzettelImg;
      if (type.includes('event') || type.includes('bericht')) return this.eventreportImg;
      if (type.includes('evaluierung')) return this.evaluierungImg;
      return this.eventreportImg;
    },
    statusClass() {
      const status = (this.doc.status || '').toLowerCase();
      if (status === 'zugewiesen') return 'zugewiesen';
      if (status === 'offen') return 'offen';
      return '';
    },
    isTeamleiterFiltered() {
      return this.filteredTeamleiter && this.filteredTeamleiter === this.doc.details?.name_teamleiter;
    },
    isMitarbeiterFiltered() {
      return this.filteredMitarbeiter && this.filteredMitarbeiter === this.doc.details?.name_mitarbeiter;
    },
    filteredDetails() {
      if (!this.doc.details) return {};
      const excludeKeys = ['_id', '__v', 'mitarbeiter', 'teamleiter', 'laufzettel', 'task_id', 'assigned', 'date', 'mitarbeiter_feedback', 'version', 'createdAt', 'updatedAt', 'status', 'kunde', 'puenktlichkeit', 'grooming', 'motivation', 'technische_fertigkeiten', 'lernbereitschaft', 'sonstiges'];
      const filtered = {};
      for (const [key, value] of Object.entries(this.doc.details)) {
        if (!excludeKeys.includes(key)) {
          filtered[key] = value;
        }
      }
      return filtered;
    },
    feedbackEntries() {
      const fb = this.doc.details?.mitarbeiter_feedback;
      if (!Array.isArray(fb)) return [];
      return fb.filter(entry => entry.text?.trim());
    },
    commentList() {
      const base = Array.isArray(this.doc.details?.comments) ? this.doc.details.comments : [];
      return this.localComments !== null ? this.localComments : base;
    },
  },

  methods: {
    getEmployeeId(role) {
      const employee = this.doc.details?.[role];
      if (!employee) return null;
      // If it's already a string (ObjectId), return it
      if (typeof employee === 'string') return employee;
      // If it's an object (populated), return the _id
      return employee._id || null;
    },
    formatDate(val) {
      if (!val) return "—";
      const d = new Date(val);
      if (isNaN(d)) return "—";
      return d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },
    formatKey(key) {
      if (!key) return '';
      if (key === 'date') return 'Geschrieben am';
      return key
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase());
    },
    formatValue(key, value) {
      if (!value) return '—';
      if (typeof key === 'string' && (key.toLowerCase().includes('datum') || key.toLowerCase().includes('date'))) {
        return this.formatDate(value);
      }
      return value;
    },
    getPersonAsanaId(role) {
      const name = this.doc.details?.[`name_${role}`];
      return name && this.personDetails[name]?.asana_id;
    },
    openAsanaTask(role) {
      const name = this.doc.details?.[`name_${role}`];
      const asanaId = this.personDetails[name]?.asana_id;
      if (asanaId) {
        const asanaWebUrl = `https://app.asana.com/0/0/${asanaId}`;
        window.open(asanaWebUrl, '_blank');
      }
    },

    async postComment(sendEmail) {
      if (!this.newCommentText.trim() || this.commentLoading) return;
      this.commentLoading = true;
      try {
        const res = await api.post(`/api/reports/eventreport/${this.doc._id}/comment`, {
          text: this.newCommentText.trim(),
          sendUpdate: sendEmail,
        });
        if (this.localComments === null) {
          this.localComments = [...(this.doc.details?.comments || [])];
        }
        this.localComments.push(res.data.comment);
        this.newCommentText = '';
      } catch (err) {
        console.error('Kommentar-Fehler:', err);
        alert('Fehler: ' + (err.response?.data?.msg || err.message));
      } finally {
        this.commentLoading = false;
      }
    },

  }
};
</script>

<style scoped lang="scss">
.document-card {
  display: flex;
  flex-direction: column;
  background: var(--surface, var(--panel));
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

/* Header */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  background: var(--surface, var(--panel));
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.doc-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: var(--soft, var(--hover));
}

.doc-icon-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  image-rendering: crisp-edges;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.doc-type {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bezeichnung {
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  background: var(--soft, var(--hover));
  color: var(--muted);
  
  &.zugewiesen {
    background: #e9f8ff;
    color: #1976d2;
  }
  &.offen {
    background: #fff7e6;
    color: #b46c00;
  }
}

/* Body */
.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.details-section {
  .kv {
    display: grid;
    gap: 12px;
  }
  
  .kv > div {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 10px;
    align-items: start;
  }
  
  dt {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }
  
  dd {
    color: var(--text);
    word-wrap: break-word;
  }
}

.person-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.link-btn {
  background: transparent;
  border: none;
  color: var(--primary);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: 140ms ease;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
  
  &:hover {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
  }
}

.unassigned-name {
  color: var(--muted);
  opacity: 0.7;
  font-style: italic;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.warn-icon {
  color: #f6a019;
  font-size: 0.85em;
  opacity: 0.8;
}

.btn-icon-tiny {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: 140ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: var(--soft, var(--hover));
    color: var(--primary);
  }

  &.filter-active {
    color: #ff8c00;
    background: color-mix(in srgb, #ff8c00 15%, transparent);
    
    &:hover {
      color: #ff8c00;
      background: color-mix(in srgb, #ff8c00 25%, transparent);
    }
  }
}

.asana-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.link-doc-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin-right: 5px;
  vertical-align: middle;
  image-rendering: crisp-edges;
}

/* Raw Details Section */
.raw-details-section {
  background: var(--bg);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    
    .section-icon {
      color: var(--muted);
    }
  }
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-item {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  font-size: 0.9rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
  
  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  
  .key {
    font-weight: 600;
    color: var(--muted);
  }
  
  .value {
    color: var(--text);
    word-break: break-word;
  }
}

.card-footer {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface, var(--panel));
  flex-shrink: 0;
}

.actions-left {
  display: flex;
  gap: 10px;
}

.footer-right {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* Comments */
.comments-section {
  background: var(--bg);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border);

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);

    .section-icon { color: var(--muted); }
  }
}

.comments-count {
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  margin-left: 4px;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.no-comments {
  color: var(--muted);
  font-style: italic;
  font-size: 0.88rem;
  margin: 0;
}

.comment-item {
  background: var(--surface, var(--panel));
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}

.comment-meta {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 4px;
}

.comment-author {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primary);
}

.comment-date {
  font-size: 0.75rem;
  color: var(--muted);
}

.comment-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text);
  white-space: pre-wrap;
  line-height: 1.5;
}

.comment-input-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
}

.comment-textarea {
  width: 100%;
  padding: 0.65rem 0.75rem;
  padding-bottom: 2.8rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 0.9rem;
  font-family: inherit;
  background: var(--tile-bg, var(--surface));
  color: var(--text);
  transition: border-color 0.2s;
  box-sizing: border-box;
  resize: vertical;
  -webkit-appearance: none;
  appearance: none;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.comment-send-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 5px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: 140ms ease;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--primary) 85%, black);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* Buttons */
.btn {
  border: 1px solid var(--border);
  background: var(--surface, var(--panel));
  color: var(--text);
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  transition: 140ms ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  
  &:hover {
    background: var(--soft, var(--hover));
  }
}

/* Feedback Section */
.pending-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-style: italic;
  font-size: 0.9rem;
  padding: 4px 0;

  .pending-icon {
    color: #f6a019;
    opacity: 0.85;
  }
}

.feedback-section {
  background: var(--bg);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border);

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    
    .section-icon {
      color: var(--muted);
    }
  }
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feedback-item {
  background: var(--surface, var(--panel));
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.feedback-header {
  margin-bottom: 6px;
  font-weight: 600;
}

.feedback-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text);
  white-space: pre-wrap;
  line-height: 1.5;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  letter-spacing: 0.3px;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  
  &:hover {
    background: color-mix(in srgb, var(--primary) 85%, black);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .card-actions {
    align-self: flex-end;
  }
  
  .details-section .kv > div {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  
  .kv-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  
  .card-footer {
    flex-direction: column;
    gap: 12px;
  }
  
  .actions-left {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
