<template>
  <section class="bewerber-tab">
    <section v-if="suggestions.length || loadingSuggestions || suggestionsError" class="suggestions-bar" aria-label="Asana-Vorschläge">
      <div class="suggestions-heading">
        <span>Vorschläge aus Asana</span>
        <small v-if="suggestions.length">{{ suggestions.length }} offen</small>
      </div>
      <p v-if="suggestionsError" class="suggestions-error">{{ suggestionsError }}</p>
      <p v-else-if="loadingSuggestions" class="suggestions-loading">Asana-Aufgaben werden geladen ...</p>
      <div v-else class="suggestions-list">
        <article v-for="task in suggestions" :key="task.gid" class="suggestion-item">
          <div class="suggestion-copy">
            <strong>{{ task.name }}</strong>
            <span>{{ formatTaskDate(task.createdAt) }}</span>
          </div>
          <div class="suggestion-actions">
            <button type="button" class="suggestion-action suggestion-action--secondary" @click="openAsanaTask(task)">Asana öffnen</button>
            <button type="button" class="suggestion-action" @click="createApplicant(task.gid)">Bewerber erstellen</button>
          </div>
        </article>
      </div>
    </section>

    <Toolbar class="tab-toolbar">
      <ToolbarFilter v-model="filterExpanded" :active-count="activeFilterCount" @reset="resetFilters">
        <FilterGroup label="Standort">
          <FilterChip
            v-for="location in applicantLocations"
            :key="location.key"
            :active="locationFilter === location.key"
            @click="locationFilter = locationFilter === location.key ? '' : location.key"
          >
            {{ location.label }}
          </FilterChip>
        </FilterGroup>
      </ToolbarFilter>
      <SearchBar class="toolbar-search" v-model="search" placeholder="Bewerber suchen..." aria-label="Bewerber suchen" />
      <button type="button" class="refresh-button" @click="loadApplicants">Aktualisieren</button>
    </Toolbar>
    <p v-if="error" class="state state--error">{{ error }}</p>
    <p v-else-if="loading" class="state">Bewerber werden geladen ...</p>
    <div v-else-if="filteredApplicants.length" class="bewerber-grid">
      <BewerberCard
        v-for="bewerber in filteredApplicants"
        :key="bewerber._id"
        :bewerber="bewerber"
        @saved="replaceApplicant"
        @invite="openInvitation"
      />
    </div>
    <p v-else class="state">Keine Bewerber gefunden.</p>
    <p v-if="notice" class="notice">{{ notice }}</p>

    <div v-if="invitingApplicant" class="modal-backdrop" @click.self="closeInvitation">
      <section class="invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <header class="dialog-header">
          <div>
            <h2 id="invite-title">Einladung senden</h2>
            <p>{{ invitingApplicant.vorname }} {{ invitingApplicant.nachname }}</p>
          </div>
          <button type="button" class="close-button" aria-label="Schließen" @click="closeInvitation">&times;</button>
        </header>

        <label>Einladung
          <select v-model="invitation.type">
            <option value="vertrag">Nur Vertragsunterschrift</option>
            <option value="vertrag_service">Vertragsunterschrift + Service-Schulung</option>
            <option value="vertrag_logistik">Vertragsunterschrift + Logistik-Schulung</option>
          </select>
        </label>
        <label>Termin
          <input v-model="invitation.appointmentAt" type="datetime-local" required />
        </label>

        <section class="documents-section">
          <div class="section-title">
            <h3>Anhänge</h3>
            <label class="upload-button">Dokument hinzufügen
              <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" :disabled="uploadingDocument" @change="uploadDocument" />
            </label>
          </div>
          <p v-if="loadingDocuments" class="document-state">Dokumente werden geladen ...</p>
          <p v-else-if="!emailDocuments.length" class="document-state">Noch keine Vorlagen hinterlegt.</p>
          <label v-for="document in emailDocuments" :key="document._id" class="document-option">
            <input v-model="invitation.documentIds" :value="document._id" type="checkbox" />
            <span>{{ document.name }}</span>
            <small>{{ formatFileSize(document.size) }}</small>
          </label>
        </section>

        <p v-if="inviteError" class="invite-error">{{ inviteError }}</p>
        <footer class="dialog-actions">
          <button type="button" class="secondary-button" :disabled="sendingInvitation" @click="closeInvitation">Abbrechen</button>
          <button type="button" class="primary-button" :disabled="sendingInvitation || !invitation.appointmentAt" @click="sendInvitation">
            {{ sendingInvitation ? 'Wird gesendet ...' : 'Einladung senden' }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<script>
import api from '@/utils/api';
import BewerberCard from './BewerberCard.vue';
import SearchBar from './SearchBar.vue';
import FilterGroup from './FilterGroup.vue';
import FilterChip from './ui-elements/FilterChip.vue';
import ToolbarFilter from './ui-elements/ToolbarFilter.vue';
import Toolbar from './ui-elements/Toolbar.vue';

const LOCATION_LABELS = {
  berlin: 'Berlin',
  hamburg: 'Hamburg',
  koeln: 'Köln',
};

export default {
  name: 'BewerberTab',
  components: { BewerberCard, FilterChip, FilterGroup, SearchBar, Toolbar, ToolbarFilter },
  props: {
    initialApplicantId: { type: String, default: '' },
  },
  data() {
    return {
      applicants: [],
      suggestions: [],
      search: '',
      filterExpanded: false,
      locationFilter: '',
      loading: true,
      loadingSuggestions: true,
      suggestionsError: '',
      error: '',
      notice: '',
      invitingApplicant: null,
      emailDocuments: [],
      loadingDocuments: false,
      uploadingDocument: false,
      sendingInvitation: false,
      inviteError: '',
      invitation: { type: 'vertrag', appointmentAt: '', documentIds: [] },
    };
  },
  computed: {
    activeFilterCount() {
      return this.locationFilter ? 1 : 0;
    },
    applicantLocations() {
      return [...new Set(this.applicants.map((bewerber) => bewerber.teamKey).filter(Boolean))]
        .sort()
        .map((key) => ({ key, label: LOCATION_LABELS[key] || key }));
    },
    filteredApplicants() {
      const needle = this.search.trim().toLowerCase();
      return this.applicants.filter((bewerber) =>
        (!this.locationFilter || bewerber.teamKey === this.locationFilter)
        && (!needle || [bewerber.vorname, bewerber.nachname, bewerber.email, bewerber.telefon]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(needle)))
      );
    },
  },
  methods: {
    async loadApplicants() {
      this.loading = true;
      this.error = '';
      try {
        const response = await api.get('/api/bewerber');
        this.applicants = response.data.data || [];
      } catch (error) {
        this.error = error.response?.data?.message || 'Bewerber konnten nicht geladen werden.';
      } finally {
        this.loading = false;
      }
    },
    async loadSuggestions() {
      this.loadingSuggestions = true;
      this.suggestionsError = '';
      try {
        const response = await api.get('/api/bewerber/suggestions');
        this.suggestions = response.data.data || [];
      } catch (error) {
        this.suggestionsError = error.response?.data?.message || 'Asana-Vorschläge konnten nicht geladen werden.';
      } finally {
        this.loadingSuggestions = false;
      }
    },
    createApplicant(taskId) {
      this.$router.push({ name: 'BewerberErstellen', params: { id: taskId } });
    },
    openAsanaTask(task) {
      const fallbackUrl = task.permalinkUrl || `https://app.asana.com/0/${task.gid}`;
      const appUrl = fallbackUrl.replace(/^https?:\/\//, 'asana://');
      const openedAt = Date.now();
      window.location.href = appUrl;

      window.setTimeout(() => {
        if (Date.now() - openedAt < 1_250) {
          window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        }
      }, 900);
    },
    replaceApplicant(updatedApplicant) {
      const index = this.applicants.findIndex((bewerber) => bewerber._id === updatedApplicant._id);
      if (index !== -1) this.applicants.splice(index, 1, updatedApplicant);
    },
    resetFilters() {
      this.locationFilter = '';
    },
    async openInvitation(applicant) {
      this.invitingApplicant = applicant;
      this.invitation = { type: 'vertrag', appointmentAt: '', documentIds: [] };
      this.inviteError = '';
      await this.loadEmailDocuments();
    },
    closeInvitation(force = false) {
      if (this.sendingInvitation && !force) return;
      this.invitingApplicant = null;
      this.inviteError = '';
    },
    async loadEmailDocuments() {
      this.loadingDocuments = true;
      try {
        const response = await api.get('/api/bewerber/email-documents');
        this.emailDocuments = response.data.data || [];
      } catch (error) {
        this.inviteError = error.response?.data?.message || 'Dokumente konnten nicht geladen werden.';
      } finally {
        this.loadingDocuments = false;
      }
    },
    async uploadDocument(event) {
      const [file] = event.target.files || [];
      event.target.value = '';
      if (!file) return;

      this.uploadingDocument = true;
      this.inviteError = '';
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/api/bewerber/email-documents', formData);
        this.emailDocuments.push(response.data.data);
        this.invitation.documentIds.push(response.data.data._id);
      } catch (error) {
        this.inviteError = error.response?.data?.message || 'Dokument konnte nicht hochgeladen werden.';
      } finally {
        this.uploadingDocument = false;
      }
    },
    async sendInvitation() {
      if (!this.invitingApplicant) return;
      this.sendingInvitation = true;
      this.inviteError = '';
      try {
        await api.post(`/api/bewerber/${this.invitingApplicant._id}/invitations`, this.invitation);
        this.notice = `Einladung an ${this.invitingApplicant.vorname} ${this.invitingApplicant.nachname} wurde gesendet.`;
        this.closeInvitation(true);
        await this.loadApplicants();
      } catch (error) {
        this.inviteError = error.response?.data?.message || 'Einladung konnte nicht gesendet werden.';
      } finally {
        this.sendingInvitation = false;
      }
    },
    formatFileSize(size) {
      if (!size) return '';
      return `${(size / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
    },
    formatTaskDate(value) {
      return value ? `erstellt am ${new Date(value).toLocaleDateString('de-DE')}` : 'Asana-Aufgabe';
    },
  },
  mounted() {
    this.loadApplicants();
    this.loadSuggestions();
  },
};
</script>

<style scoped lang="scss">
.bewerber-tab { padding: 20px; }
.suggestions-bar { border-bottom: 1px solid var(--border); display: grid; gap: 10px; margin: -4px 0 18px; padding: 0 0 18px; }
.suggestions-heading { align-items: baseline; display: flex; gap: 8px; }
.suggestions-heading span { color: var(--text); font-size: .9rem; font-weight: 600; }
.suggestions-heading small { color: var(--muted); font-size: .75rem; }
.suggestions-list { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
.suggestion-item { align-items: center; background: var(--hover); border: 1px solid var(--border); border-radius: 8px; display: flex; flex: 0 0 min(460px, 94vw); gap: 12px; justify-content: space-between; min-width: 0; padding: 10px; }
.suggestion-copy { display: grid; gap: 3px; min-width: 0; }
.suggestion-copy strong { color: var(--text); font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.suggestion-copy span, .suggestions-loading, .suggestions-error { color: var(--muted); font-size: .75rem; }
.suggestions-error { color: var(--danger, #b91c1c); }
.suggestion-actions { display: flex; flex-shrink: 0; gap: 6px; }
.suggestion-action { background: transparent; border: 1px solid var(--primary); border-radius: 5px; color: var(--primary); cursor: pointer; flex-shrink: 0; font: inherit; font-size: .75rem; padding: 6px 8px; }
.suggestion-action:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
.suggestion-action--secondary { border-color: var(--border); color: var(--text); }
@media (max-width: 560px) { .suggestion-item { align-items: stretch; flex-direction: column; } .suggestion-actions { justify-content: flex-end; } }
.tab-toolbar { justify-content: space-between; margin-bottom: 18px; }
.refresh-button { background: transparent; border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; font: inherit; min-height: 38px; padding: 7px 10px; }
.bewerber-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.state, .notice { color: var(--muted); margin: 0; padding: 30px 0; text-align: center; }
.state--error { color: var(--danger, #b91c1c); }
.notice { color: var(--primary); padding: 12px 0 0; }
.modal-backdrop { align-items: center; background: rgba(0, 0, 0, .42); display: flex; inset: 0; justify-content: center; padding: 20px; position: fixed; z-index: 1100; }
.invite-dialog { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 24px 55px rgba(0, 0, 0, .28); color: var(--text); display: grid; gap: 16px; max-height: calc(100vh - 40px); max-width: 560px; overflow: auto; padding: 20px; width: 100%; }
.dialog-header, .section-title, .dialog-actions, .document-option { align-items: center; display: flex; }
.dialog-header, .section-title { justify-content: space-between; }
.dialog-header h2, .dialog-header p, .section-title h3 { margin: 0; }
.dialog-header h2 { font-size: 1.05rem; }
.dialog-header p, .document-state { color: var(--muted); font-size: .85rem; }
.close-button { background: transparent; border: 0; color: var(--text); cursor: pointer; font-size: 1.7rem; line-height: 1; }
.invite-dialog > label { display: grid; font-size: .85rem; font-weight: 600; gap: 6px; }
.invite-dialog select, .invite-dialog input[type="datetime-local"] { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 5px; color: var(--text); font: inherit; min-height: 38px; padding: 7px 8px; }
.documents-section { border-top: 1px solid var(--border); display: grid; gap: 8px; padding-top: 14px; }
.section-title h3 { font-size: .9rem; }
.upload-button { background: transparent; border: 1px solid var(--primary); border-radius: 5px; color: var(--primary); cursor: pointer; font-size: .8rem; font-weight: 600; padding: 6px 8px; }
.upload-button input { display: none; }
.document-option { border: 1px solid var(--border); border-radius: 5px; cursor: pointer; font-size: .85rem; gap: 8px; padding: 8px; }
.document-option small { color: var(--muted); margin-left: auto; }
.invite-error { color: var(--danger, #b91c1c); font-size: .85rem; margin: 0; }
.dialog-actions { gap: 8px; justify-content: flex-end; }
.primary-button, .secondary-button { border-radius: 5px; cursor: pointer; font: inherit; padding: 8px 10px; }
.primary-button { background: var(--primary); border: 1px solid var(--primary); color: #fff; }
.secondary-button { background: transparent; border: 1px solid var(--border); color: var(--text); }
.primary-button:disabled, .secondary-button:disabled { cursor: not-allowed; opacity: .6; }
@media (max-width: 560px) { .tab-toolbar { align-items: stretch; flex-direction: column; } }
</style>