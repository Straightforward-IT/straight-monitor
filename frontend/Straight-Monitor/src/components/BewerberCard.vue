<template>
  <article class="bewerber-card">
    <header class="card-header" @click="expanded = !expanded">
      <div class="identity">
        <div class="avatar">{{ initials }}</div>
        <div>
          <h3>{{ bewerber.vorname }} {{ bewerber.nachname }}</h3>
          <p>{{ bewerber.email || 'Keine E-Mail hinterlegt' }}</p>
        </div>
      </div>
      <div class="header-actions" @click.stop>
        <span :class="['status', `status--${bewerber.status}`]">{{ statusLabel }}</span>
        <button ref="actionButton" type="button" class="icon-button" aria-label="Aktionen" @click="openContextMenu">
          <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
        </button>
      </div>
    </header>

    <div class="card-meta">
      <span v-if="bewerber.telefon">{{ bewerber.telefon }}</span>
      <span>läuft ab {{ formatDate(bewerber.expiresAt) }}</span>
      <span v-if="bewerber.asana_id">Asana verknüpft</span>
    </div>

    <div v-if="expanded" class="card-body">
      <template v-if="editing">
        <div class="form-grid">
          <label>Vorname <input v-model.trim="draft.vorname" required /></label>
          <label>Nachname <input v-model.trim="draft.nachname" required /></label>
          <label>E-Mail <input v-model.trim="draft.email" required type="email" /></label>
          <label>Telefon <input v-model.trim="draft.telefon" type="tel" /></label>
        </div>
        <div class="form-actions">
          <button type="button" class="secondary-button" @click="cancelEdit">Abbrechen</button>
          <button type="button" class="primary-button" :disabled="saving" @click="save">{{ saving ? 'Speichert ...' : 'Speichern' }}</button>
        </div>
      </template>
      <dl v-else>
        <div><dt>Telefon</dt><dd>{{ bewerber.telefon || '—' }}</dd></div>
        <div><dt>Wohnort</dt><dd>{{ location || '—' }}</dd></div>
        <div><dt>Formular</dt><dd>{{ bewerber.submittedAt ? `Eingereicht am ${formatDate(bewerber.submittedAt)}` : 'Noch nicht eingereicht' }}</dd></div>
        <div><dt>Dokumente</dt><dd>{{ bewerber.documents?.length || 0 }} hinterlegt</dd></div>
      </dl>
    </div>

    <ContextMenu v-if="showContextMenu" :x="contextMenuX" :y="contextMenuY" :options="contextMenuOptions" @close="showContextMenu = false" @select="handleContextAction" />
  </article>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';
import api from '@/utils/api';
import ContextMenu from './ContextMenu.vue';

library.add(faEllipsisVertical);

const EDIT_FIELDS = ['vorname', 'nachname', 'email', 'telefon'];

export default {
  name: 'BewerberCard',
  components: { ContextMenu, FontAwesomeIcon },
  props: { bewerber: { type: Object, required: true } },
  emits: ['saved', 'invite'],
  data() {
    return { expanded: false, editing: false, saving: false, draft: {}, showContextMenu: false, contextMenuX: 0, contextMenuY: 0 };
  },
  computed: {
    initials() {
      return `${this.bewerber.vorname?.[0] || ''}${this.bewerber.nachname?.[0] || ''}`.toUpperCase() || '?';
    },
    location() {
      return [this.bewerber.strasse, this.bewerber.plz, this.bewerber.ort].filter(Boolean).join(', ');
    },
    statusLabel() {
      return { neu: 'Neu', eingeladen: 'Eingeladen', formular_geoeffnet: 'Formular geöffnet', eingereicht: 'Eingereicht', abgelaufen: 'Abgelaufen' }[this.bewerber.status] || 'Neu';
    },
    contextMenuOptions() {
      const options = [{ label: 'Informationen bearbeiten', action: 'edit' }];
      if (this.bewerber.asana_permalink) options.unshift({ label: 'Asana-Aufgabe öffnen', action: 'asana' });
      options.push({ label: 'Einladung senden', action: 'invite' });
      return options;
    },
  },
  methods: {
    formatDate(value) {
      return value ? new Date(value).toLocaleDateString('de-DE') : '—';
    },
    openContextMenu() {
      const rect = this.$refs.actionButton.getBoundingClientRect();
      this.contextMenuX = rect.right - 160;
      this.contextMenuY = rect.bottom + 4;
      this.showContextMenu = true;
    },
    handleContextAction(action) {
      if (action === 'asana') window.open(this.bewerber.asana_permalink, '_blank', 'noopener,noreferrer');
      if (action === 'edit') this.startEdit();
      if (action === 'invite') this.$emit('invite', this.bewerber);
    },
    startEdit() {
      this.draft = Object.fromEntries(EDIT_FIELDS.map((field) => [field, this.bewerber[field] || '']));
      this.expanded = true;
      this.editing = true;
    },
    cancelEdit() {
      this.editing = false;
      this.draft = {};
    },
    async save() {
      if (!this.draft.vorname || !this.draft.nachname || !this.draft.email) return;
      this.saving = true;
      try {
        const response = await api.patch(`/api/bewerber/${this.bewerber._id}`, this.draft);
        this.$emit('saved', response.data.data);
        this.cancelEdit();
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.bewerber-card { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.card-header { align-items: center; cursor: pointer; display: flex; gap: 12px; justify-content: space-between; padding: 14px; }
.identity, .header-actions, .card-meta, .form-actions { align-items: center; display: flex; }
.identity { gap: 10px; min-width: 0; }
.avatar { align-items: center; background: var(--primary); border-radius: 6px; color: #fff; display: flex; flex: 0 0 38px; font-weight: 700; height: 38px; justify-content: center; }
h3, p { margin: 0; }
h3 { color: var(--text); font-size: .95rem; }
.identity p, .card-meta, dt { color: var(--muted); font-size: .8rem; }
.header-actions { gap: 8px; }
.icon-button { background: transparent; border: 0; color: var(--muted); cursor: pointer; height: 32px; width: 32px; }
.status { border: 1px solid var(--border); border-radius: 999px; color: var(--muted); font-size: .72rem; font-weight: 700; padding: 3px 7px; white-space: nowrap; }
.status--eingereicht { border-color: var(--success, #15803d); color: var(--success, #15803d); }
.status--eingeladen, .status--formular_geoeffnet { border-color: var(--primary); color: var(--primary); }
.status--abgelaufen { border-color: var(--danger, #b91c1c); color: var(--danger, #b91c1c); }
.card-meta { border-top: 1px solid var(--border); flex-wrap: wrap; gap: 8px 14px; padding: 9px 14px; }
.card-body { background: var(--hover); border-top: 1px solid var(--border); padding: 14px; }
dl { display: grid; gap: 8px; margin: 0; }
dl div { display: grid; gap: 3px; grid-template-columns: 105px minmax(0, 1fr); }
dd { color: var(--text); font-size: .85rem; margin: 0; }
.form-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
label { color: var(--text); display: grid; font-size: .8rem; font-weight: 600; gap: 5px; }
input { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 5px; color: var(--text); min-height: 36px; padding: 6px 8px; }
.form-actions { gap: 8px; justify-content: flex-end; margin-top: 14px; }
.primary-button, .secondary-button { border-radius: 5px; cursor: pointer; font: inherit; padding: 7px 10px; }
.primary-button { background: var(--primary); border: 1px solid var(--primary); color: #fff; }
.secondary-button { background: transparent; border: 1px solid var(--border); color: var(--text); }
@media (max-width: 520px) { .form-grid { grid-template-columns: 1fr; } }
</style>