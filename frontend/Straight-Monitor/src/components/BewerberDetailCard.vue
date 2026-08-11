<template>
  <article class="bewerber-detail" :class="{ 'bewerber-detail--embedded': embedded }">
    <div v-if="loading" class="detail-state">Bewerber wird geladen ...</div>
    <div v-else-if="loadError" class="detail-state detail-state--error">{{ loadError }}</div>

    <template v-else>
      <header v-if="!embedded" class="detail-header">
        <div class="identity">
          <div class="avatar">{{ initials }}</div>
          <div class="identity-copy">
            <h2>{{ form.vorname }} {{ form.nachname }}</h2>
            <p>{{ form.email || 'Keine E-Mail hinterlegt' }}</p>
            <div class="badges">
              <span :class="['status', `status--${bewerber.status}`]">{{ statusLabel }}</span>
              <span v-if="bewerber.asana_id" class="badge">Asana verknüpft</span>
              <span v-if="bewerber.submittedAt" class="badge badge--ok">Eingereicht am {{ formatDate(bewerber.submittedAt) }}</span>
              <span class="badge badge--muted">läuft ab {{ formatDate(bewerber.expiresAt) }}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <a v-if="bewerber.asana_permalink" :href="bewerber.asana_permalink" target="_blank" rel="noopener" class="ghost-button">Asana öffnen</a>
          <button type="button" class="ghost-button" @click="$emit('invite', bewerber)">Einladung senden</button>
        </div>
      </header>

      <form class="detail-form" @submit.prevent="save">
        <section class="detail-section">
          <h3>Persönliche Daten</h3>
          <div class="form-grid">
            <label>Anrede<select v-model="form.anrede"><option value="">Keine Angabe</option><option>Frau</option><option>Herr</option></select></label>
            <label>Familienstand<select v-model="form.familienstand"><option value="">Keine Angabe</option><option>ledig</option><option>verheiratet</option><option>eingetragene Lebenspartnerschaft</option><option>getrennt lebend</option><option>geschieden</option><option>verwitwet</option></select></label>
            <label>Vorname<input v-model.trim="form.vorname" required /></label>
            <label>Nachname<input v-model.trim="form.nachname" required /></label>
            <label>E-Mail<input v-model.trim="form.email" type="email" required /></label>
            <label>Telefon<input v-model.trim="form.telefon" type="tel" /></label>
            <label>Geburtsdatum<input v-model="form.geburtsdatum" type="date" /></label>
            <label>Staatsangehörigkeit<input v-model.trim="form.staatsangehoerigkeit" /></label>
            <label>Standort<select v-model="form.locationV2"><option value="">Nicht zugeordnet</option><option v-for="location in locations" :key="location._id" :value="location._id">{{ location.nameFull || location.shortName }}</option></select></label>
          </div>
        </section>

        <section class="detail-section">
          <h3>Adresse</h3>
          <div class="form-grid address-grid">
            <label class="address-street">Straße<input v-model.trim="form.strasse" /></label>
            <label class="address-number">Hausnummer<input v-model.trim="form.hausnummer" /></label>
            <label class="address-plz">PLZ<input v-model.trim="form.plz" inputmode="numeric" /></label>
            <label class="address-city">Ort<input v-model.trim="form.ort" /></label>
          </div>
          <div class="form-grid">
            <label class="full">Wohnsitz<input v-model.trim="form.wohnsitz" placeholder="z. B. Deutschland" /></label>
          </div>
        </section>

        <section class="detail-section">
          <h3>Einsatz und Verfügbarkeit</h3>
          <div class="form-grid">
            <label>Bevorzugter Bereich<select v-model="form.bevorzugterBereich"><option value="">Keine Angabe</option><option value="service">Service</option><option value="logistik">Logistik</option><option value="beides">Service und Logistik</option></select></label>
            <label>Aktuelles Anstellungsverhältnis<input v-model.trim="form.aktuellesAnstellungsverhaeltnis" /></label>
            <label>Verfügbar ab<input v-model="form.verfuegbarAb" type="date" /></label>
            <label>Verfügbar bis<input v-model="form.verfuegbarBis" type="date" /></label>
            <label class="full">Verfügbarkeit<textarea v-model.trim="form.verfuegbarkeit" rows="3" placeholder="Wochentage, Schichten oder Sperrzeiten" /></label>
            <label class="full">Erfahrung Gastronomie / Logistik<textarea v-model.trim="form.erfahrungGastronomieLogistik" rows="3" /></label>
          </div>
        </section>

        <section class="detail-section">
          <h3>Mobilität und Qualifikation</h3>
          <fieldset>
            <legend>Führerscheinklassen</legend>
            <div class="chip-grid">
              <label v-for="license in licenseClasses" :key="license"><input v-model="form.fuehrerscheine" type="checkbox" :value="license" /> {{ license }}</label>
            </div>
          </fieldset>
          <div class="chip-grid toggle-grid">
            <label><input v-model="form.eigenesAuto" type="checkbox" /> Eigenes Auto vorhanden</label>
            <label v-if="form.eigenesAuto"><input v-model="form.nutzungsberechtigung" type="checkbox" /> Nutzung für Einsätze möglich</label>
            <label><input v-model="form.reisebereitschaft" type="checkbox" /> Reisebereitschaft</label>
            <label><input v-model="form.deutschlandticket" type="checkbox" /> Deutschlandticket vorhanden</label>
            <label><input v-model="form.hat70TageGearbeitet" type="checkbox" /> Bereits nach 70-Tage-Regelung gearbeitet</label>
          </div>
          <div class="form-grid extras">
            <label v-if="form.hat70TageGearbeitet">Bereits gearbeitete Tage<input v-model.number="form.tage70Regelung" type="number" min="0" max="366" /></label>
            <label>Studium<select v-model="form.studiumStatus"><option value="">Keine Angabe</option><option value="eingeschrieben">Eingeschrieben</option><option value="studienabsicht">Studienabsicht</option><option value="nein">Kein Studium</option></select></label>
          </div>
        </section>

        <section class="detail-section">
          <h3>Nachweise</h3>
          <ul v-if="bewerber.documents?.length" class="documents">
            <li v-for="document in bewerber.documents" :key="document._id">
              <span>
                <strong>{{ document.name }}</strong>
                <small>{{ document.category === 'studienbescheinigung' ? 'Studienbescheinigung' : 'Sonstiger Nachweis' }} · {{ formatFileSize(document.size) }}</small>
              </span>
              <button type="button" class="ghost-button ghost-button--small" @click="downloadDocument(document)">Öffnen</button>
            </li>
          </ul>
          <p v-else class="empty-hint">Keine Nachweise hochgeladen.</p>
        </section>

        <section class="detail-section">
          <h3>Bemerkungen</h3>
          <textarea v-model.trim="form.bemerkungen" rows="4" />
        </section>

        <section v-if="bewerber.invitations?.length" class="detail-section">
          <h3>Einladungen</h3>
          <ul class="invitations">
            <li v-for="invitation in sortedInvitations" :key="invitation._id">
              <div class="invitation-copy">
                <strong>{{ invitationLabel(invitation.type) }}</strong>
                <small>Termin: {{ formatDateTime(invitation.appointmentAt) }} · gesendet {{ formatDate(invitation.sentAt) }}</small>
              </div>
              <span :class="['badge', `badge--${invitationState(invitation).tone}`]">{{ invitationState(invitation).label }}</span>
            </li>
          </ul>
        </section>
      </form>

      <footer class="detail-footer">
        <p v-if="saveError" class="save-error">{{ saveError }}</p>
        <p v-else-if="savedNotice" class="save-ok">{{ savedNotice }}</p>
        <div class="footer-actions">
          <button type="button" class="secondary-button" @click="$emit('close')">Schließen</button>
          <button type="button" class="primary-button" :disabled="saving" @click="save">{{ saving ? 'Speichert ...' : 'Änderungen speichern' }}</button>
        </div>
      </footer>
    </template>
  </article>
</template>

<script>
import api from '@/utils/api';

const DATE_FIELDS = ['geburtsdatum', 'verfuegbarAb', 'verfuegbarBis'];
const EDITABLE_FIELDS = [
  'anrede', 'vorname', 'nachname', 'email', 'telefon',
  'strasse', 'hausnummer', 'plz', 'ort', 'wohnsitz',
  'staatsangehoerigkeit', 'familienstand', 'geburtsdatum',
  'bevorzugterBereich', 'erfahrungGastronomieLogistik', 'aktuellesAnstellungsverhaeltnis',
  'verfuegbarAb', 'verfuegbarBis', 'verfuegbarkeit', 'bemerkungen',
  'fuehrerscheine', 'eigenesAuto', 'nutzungsberechtigung',
  'reisebereitschaft', 'deutschlandticket',
  'hat70TageGearbeitet', 'tage70Regelung', 'studiumStatus',
  'locationV2',
];

export default {
  name: 'BewerberDetailCard',
  props: {
    bewerberId: { type: String, required: true },
    embedded: { type: Boolean, default: false },
  },
  emits: ['close', 'saved', 'invite'],
  data() {
    return {
      loading: true,
      loadError: '',
      saving: false,
      saveError: '',
      savedNotice: '',
      bewerber: {},
      form: {},
      locations: [],
      licenseClasses: ['B', 'BE', 'A', 'A1', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'L', 'T', 'M'],
    };
  },
  computed: {
    initials() {
      return `${this.form.vorname?.[0] || ''}${this.form.nachname?.[0] || ''}`.toUpperCase() || '?';
    },
    statusLabel() {
      return { neu: 'Neu', eingeladen: 'Eingeladen', formular_geoeffnet: 'Formular geöffnet', eingereicht: 'Eingereicht', abgelaufen: 'Abgelaufen' }[this.bewerber.status] || 'Neu';
    },
    sortedInvitations() {
      return [...(this.bewerber.invitations || [])].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    },
  },
  watch: {
    bewerberId: 'loadBewerber',
  },
  methods: {
    async loadBewerber() {
      this.loading = true;
      this.loadError = '';
      try {
        const [bewerberResponse, locationsResponse] = await Promise.all([
          api.get(`/api/bewerber/${this.bewerberId}`),
          this.locations.length ? Promise.resolve(null) : api.get('/api/locations'),
        ]);
        if (locationsResponse) this.locations = locationsResponse.data?.data || locationsResponse.data || [];
        this.bewerber = bewerberResponse.data.data || {};
        this.hydrateForm();
      } catch (error) {
        this.loadError = error.response?.data?.message || 'Bewerber konnte nicht geladen werden.';
      } finally {
        this.loading = false;
      }
    },
    hydrateForm() {
      const form = {};
      for (const field of EDITABLE_FIELDS) {
        let value = this.bewerber[field];
        if (field === 'locationV2') value = this.bewerber.locationV2?._id || this.bewerber.locationV2 || '';
        else if (DATE_FIELDS.includes(field)) value = value ? String(value).slice(0, 10) : '';
        else if (field === 'fuehrerscheine') value = Array.isArray(value) ? [...value] : [];
        else if (['eigenesAuto', 'nutzungsberechtigung', 'reisebereitschaft', 'deutschlandticket', 'hat70TageGearbeitet'].includes(field)) value = !!value;
        else if (value === undefined || value === null) value = '';
        form[field] = value;
      }
      this.form = form;
    },
    buildPayload() {
      const payload = { ...this.form };
      payload.locationV2 = this.form.locationV2 || null;
      if (!this.form.eigenesAuto) payload.nutzungsberechtigung = false;
      if (!this.form.hat70TageGearbeitet) payload.tage70Regelung = null;
      for (const field of DATE_FIELDS) payload[field] = this.form[field] || null;
      return payload;
    },
    async save() {
      if (!this.form.vorname || !this.form.nachname || !this.form.email) {
        this.saveError = 'Vorname, Nachname und E-Mail sind erforderlich.';
        return;
      }
      this.saving = true;
      this.saveError = '';
      this.savedNotice = '';
      try {
        const response = await api.patch(`/api/bewerber/${this.bewerberId}`, this.buildPayload());
        this.bewerber = response.data.data || this.bewerber;
        this.hydrateForm();
        this.savedNotice = 'Änderungen gespeichert.';
        this.$emit('saved', this.bewerber);
        window.setTimeout(() => { this.savedNotice = ''; }, 2500);
      } catch (error) {
        this.saveError = error.response?.data?.message || 'Änderungen konnten nicht gespeichert werden.';
      } finally {
        this.saving = false;
      }
    },
    async downloadDocument(document) {
      try {
        const response = await api.get(`/api/bewerber/${this.bewerberId}/documents/${document._id}/download`);
        const url = response.data?.data?.url;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      } catch (error) {
        this.saveError = error.response?.data?.message || 'Dokument konnte nicht geöffnet werden.';
      }
    },
    invitationLabel(type) {
      return { vertrag: 'Vertragsunterschrift', vertrag_service: 'Vertrag und Service-Schulung', vertrag_logistik: 'Vertrag und Logistik-Schulung' }[type] || 'Einladung';
    },
    invitationState(invitation) {
      if (invitation.submittedAt) return { label: 'Eingereicht', tone: 'ok' };
      if (invitation.revokedAt) return { label: 'Zurückgezogen', tone: 'danger' };
      if (new Date(invitation.expiresAt) <= new Date()) return { label: 'Abgelaufen', tone: 'muted' };
      if (invitation.openedAt) return { label: 'Geöffnet', tone: 'primary' };
      return { label: 'Gesendet', tone: 'primary' };
    },
    formatDate(value) {
      return value ? new Date(value).toLocaleDateString('de-DE') : '—';
    },
    formatDateTime(value) {
      return value ? new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    },
    formatFileSize(size) {
      if (!size) return '';
      return `${(size / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
    },
  },
  mounted() {
    this.loadBewerber();
  },
};
</script>

<style scoped lang="scss">
.bewerber-detail { background: var(--surface); color: var(--text); display: flex; flex-direction: column; max-height: calc(100vh - 80px); }
.bewerber-detail--embedded { background: transparent; max-height: none; }
.detail-state { color: var(--muted); padding: 48px; text-align: center; }
.detail-state--error { color: var(--danger, #b91c1c); }

.detail-header { align-items: flex-start; background: var(--tile-bg); border-bottom: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; padding: 22px 24px; }
.identity { align-items: center; display: flex; gap: 14px; min-width: 0; }
.avatar { align-items: center; background: var(--primary); border-radius: 10px; color: #fff; display: flex; flex: 0 0 52px; font-size: 1.15rem; font-weight: 700; height: 52px; justify-content: center; }
.identity-copy { min-width: 0; }
.identity-copy h2 { font-size: 1.2rem; font-weight: 600; margin: 0; }
.identity-copy p { color: var(--muted); font-size: .85rem; margin: 2px 0 0; }
.badges { align-items: center; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.status, .badge { border: 1px solid var(--border); border-radius: 999px; color: var(--muted); font-size: .72rem; font-weight: 600; padding: 3px 9px; white-space: nowrap; }
.status--eingereicht { border-color: var(--success, #15803d); color: var(--success, #15803d); }
.status--eingeladen, .status--formular_geoeffnet { border-color: var(--primary); color: var(--primary); }
.status--abgelaufen { border-color: var(--danger, #b91c1c); color: var(--danger, #b91c1c); }
.badge--ok { border-color: var(--success, #15803d); color: var(--success, #15803d); }
.badge--primary { border-color: var(--primary); color: var(--primary); }
.badge--danger { border-color: var(--danger, #b91c1c); color: var(--danger, #b91c1c); }
.badge--muted { color: var(--muted); }
.header-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.ghost-button { background: transparent; border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; font: inherit; font-size: .82rem; padding: 8px 12px; text-decoration: none; transition: border-color .15s, color .15s; }
.ghost-button:hover { border-color: var(--primary); color: var(--primary); }
.ghost-button--small { font-size: .78rem; padding: 6px 10px; }

.detail-form { display: grid; gap: 22px; overflow-y: auto; padding: 22px 24px; }
.bewerber-detail--embedded .detail-form { overflow-y: visible; padding: 18px 16px; }
.detail-section > h3 { font-size: 1rem; font-weight: 600; margin: 0 0 14px; }
.detail-section > textarea { width: 100%; }

.form-grid { display: grid; gap: 14px 16px; grid-template-columns: 1fr 1fr; }
.form-grid + .form-grid { margin-top: 14px; }
.address-grid { grid-template-columns: repeat(4, 1fr); }
.address-street { grid-column: span 3; }
.address-number { grid-column: span 1; }
.address-plz { grid-column: span 1; }
.address-city { grid-column: span 3; }
.full { grid-column: 1 / -1; }

label, legend { color: var(--text); display: grid; font-size: .78rem; font-weight: 600; gap: 6px; }
input, select, textarea { background: var(--tile-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font: inherit; font-weight: 400; min-height: 42px; padding: 9px 11px; transition: border-color .15s, box-shadow .15s; }
textarea { line-height: 1.5; resize: vertical; }
input:focus, select:focus, textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent); outline: none; }

fieldset { border: 0; margin: 0 0 16px; padding: 0; }
.chip-grid { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 10px; }
.chip-grid label { align-items: center; background: var(--tile-bg); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; display: flex; font-weight: 500; gap: 8px; padding: 8px 11px; }
.chip-grid label:has(:checked) { background: color-mix(in srgb, var(--primary) 12%, transparent); border-color: var(--primary); }
.chip-grid input { accent-color: var(--primary); cursor: pointer; min-height: 0; width: auto; }
.extras { margin-top: 16px; }

.documents, .invitations { display: grid; gap: 10px; list-style: none; margin: 0; padding: 0; }
.documents li, .invitations li { align-items: center; background: var(--hover); border: 1px solid var(--border); border-radius: 10px; display: flex; gap: 12px; justify-content: space-between; padding: 12px 14px; }
.documents span, .invitation-copy { display: grid; gap: 2px; min-width: 0; }
.documents strong, .invitation-copy strong { font-weight: 600; }
.documents small, .invitation-copy small { color: var(--muted); font-size: .78rem; }
.empty-hint { color: var(--muted); font-size: .85rem; margin: 0; }

.detail-footer { align-items: center; background: var(--tile-bg); border-top: 1px solid var(--border); display: flex; gap: 16px; justify-content: space-between; padding: 16px 24px; }
.bewerber-detail--embedded .detail-footer { background: transparent; padding: 4px 16px 16px; }
.save-error { color: var(--danger, #b91c1c); font-size: .84rem; margin: 0; }
.save-ok { color: var(--success, #15803d); font-size: .84rem; margin: 0; }
.footer-actions { display: flex; gap: 10px; margin-left: auto; }
.primary-button, .secondary-button { border-radius: 8px; cursor: pointer; font: inherit; font-weight: 600; padding: 10px 16px; }
.primary-button { background: var(--primary); border: 1px solid var(--primary); color: #fff; }
.primary-button:disabled { cursor: not-allowed; opacity: .6; }
.secondary-button { background: transparent; border: 1px solid var(--border); color: var(--text); }

@media (max-width: 640px) {
  .form-grid, .address-grid { grid-template-columns: 1fr; }
  .address-street, .address-number, .address-plz, .address-city, .full { grid-column: auto; }
  .detail-header, .detail-form, .detail-footer { padding-inline: 16px; }
}
</style>
