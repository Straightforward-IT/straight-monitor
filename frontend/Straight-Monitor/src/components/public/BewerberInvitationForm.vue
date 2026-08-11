<template>
  <main class="public-application">
    <header class="brand-header">
      <div><img :src="logoSrc" alt="Straightforward" class="brand-logo" /></div>
    </header>

    <section v-if="state === 'loading'" class="form-shell state-panel">Einladung wird geprüft ...</section>
    <section v-else-if="['invalid', 'expired', 'revoked', 'submitted'].includes(state)" class="form-shell state-panel">
      <h1>{{ terminalTitle }}</h1><p>{{ terminalMessage }}</p>
    </section>
    <section v-else-if="state === 'success'" class="form-shell state-panel success">
      <span class="success-icon">✓</span><h1>Angaben übermittelt</h1><p>Vielen Dank. Deine Angaben wurden erfolgreich gespeichert.</p>
    </section>

    <section v-else-if="state === 'code'" class="form-shell code-panel">
      <p class="eyebrow">Stammdaten</p>
      <h1>Angaben ergänzen</h1>
      <p>Gib den sechsstelligen Zugangscode aus deiner Einladungs-E-Mail ein.</p>
      <form @submit.prevent="verifyCode">
        <label>Zugangscode<input v-model.trim="accessCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required /></label>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="busy || accessCode.length !== 6">{{ busy ? 'Wird geprüft ...' : 'Formular öffnen' }}</button>
      </form>
    </section>

    <form v-else class="form-shell" @submit.prevent="submitForm">
      <header class="form-heading">
        <div><p class="eyebrow">Selbstauskunft</p><h1>Deine Angaben</h1><p>Prüfe die vorbefüllten Daten und ergänze fehlende Informationen.</p></div>
        <div v-if="form.invitation"><strong>{{ invitationLabel }}</strong><span>{{ formatAppointment(form.invitation.appointmentAt) }}</span></div>
      </header>

      <section class="form-section">
        <h2>Persönliche Daten</h2>
        <div class="form-grid">
          <label>Anrede<select v-model="form.anrede"><option value="">Keine Angabe</option><option>Frau</option><option>Herr</option></select></label>
          <label>Familienstand<select v-model="form.familienstand"><option value="">Keine Angabe</option><option>ledig</option><option>verheiratet</option><option>eingetragene Lebenspartnerschaft</option><option>getrennt lebend</option><option>geschieden</option><option>verwitwet</option></select></label>
          <label>Vorname<input v-model.trim="form.vorname" autocomplete="given-name" required /></label>
          <label>Nachname<input v-model.trim="form.nachname" autocomplete="family-name" required /></label>
          <label>E-Mail<input v-model.trim="form.email" type="email" autocomplete="email" required /></label>
          <label>Telefon<input v-model.trim="form.telefon" type="tel" autocomplete="tel" /></label>
          <label>Geburtsdatum<input v-model="form.geburtsdatum" type="date" autocomplete="bday" /></label>
          <label>Staatsangehörigkeit<input v-model.trim="form.staatsangehoerigkeit" autocomplete="country-name" /></label>
        </div>
      </section>

      <section class="form-section">
        <h2>Adresse</h2>
        <div class="form-grid address-grid">
          <label class="address-street">Straße<input v-model.trim="form.strasse" autocomplete="address-line1" /></label>
          <label class="address-number">Hausnummer<input v-model.trim="form.hausnummer" /></label>
          <label class="address-plz">PLZ<input v-model.trim="form.plz" autocomplete="postal-code" inputmode="numeric" /></label>
          <label class="address-city">Ort<input v-model.trim="form.ort" autocomplete="address-level2" /></label>
        </div>
        <div class="form-grid">
          <label class="full">Wohnsitz<input v-model.trim="form.wohnsitz" placeholder="z. B. Deutschland" /></label>
        </div>
      </section>

      <section class="form-section">
        <h2>Mobilität und Qualifikation</h2>
        <fieldset><legend>Führerscheinklassen</legend><div class="license-grid"><label v-for="license in licenseClasses" :key="license"><input v-model="form.fuehrerscheine" type="checkbox" :value="license" /> {{ license }}</label></div></fieldset>
        <div class="toggle-grid">
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

      <section class="form-section">
        <h2>Nachweise</h2><p class="section-copy">Optional: PDF, Word, JPG oder PNG bis 10 MB.</p>
        <div class="upload-row"><select v-model="uploadCategory"><option value="studienbescheinigung">Studienbescheinigung</option><option value="sonstiges">Sonstiger Nachweis</option></select><label class="upload-button">Datei auswählen<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" :disabled="uploading" @change="uploadDocument" /></label></div>
        <ul class="documents"><li v-for="document in form.documents" :key="document._id"><span><strong>{{ document.name }}</strong><small>{{ document.category === 'studienbescheinigung' ? 'Studienbescheinigung' : 'Sonstiger Nachweis' }} · {{ formatFileSize(document.size) }}</small></span><button type="button" title="Nachweis entfernen" @click="removeDocument(document)">×</button></li></ul>
      </section>

      <section class="form-section"><h2>Bemerkungen</h2><textarea v-model.trim="form.bemerkungen" rows="4" /></section>
      <p v-if="error" class="error">{{ error }}</p>
      <footer class="submit-row"><p>Mit dem Absenden bestätigst du die Richtigkeit deiner Angaben.</p><button type="submit" :disabled="busy">{{ busy ? 'Wird übermittelt ...' : 'Angaben verbindlich absenden' }}</button></footer>
    </form>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import logoSrc from '@/assets/straightforward-logo-black.png';
import apiPublic from '@/utils/api-public';

const route = useRoute();
const accessToken = String(route.params.accessToken || '');
const state = ref('loading');
const accessCode = ref('');
const error = ref('');
const busy = ref(false);
const uploading = ref(false);
const uploadCategory = ref('studienbescheinigung');
const licenseClasses = ['B', 'BE', 'A', 'A1', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'L', 'T', 'M'];
const form = reactive({ documents: [], fuehrerscheine: [] });
const invitationLabel = computed(() => ({ vertrag: 'Vertragsunterschrift', vertrag_service: 'Vertrag und Service-Schulung', vertrag_logistik: 'Vertrag und Logistik-Schulung' })[form.invitation?.type] || 'Einladung');
const terminalTitle = computed(() => state.value === 'submitted' ? 'Bereits übermittelt' : state.value === 'expired' ? 'Einladung abgelaufen' : state.value === 'revoked' ? 'Einladung nicht mehr gültig' : 'Einladung nicht gefunden');
const terminalMessage = computed(() => state.value === 'submitted' ? 'Die Angaben zu dieser Einladung wurden bereits eingereicht.' : state.value === 'expired' ? 'Bitte wende dich für einen neuen Link an dein Straightforward-Team.' : 'Bitte prüfe den Link oder wende dich an dein Straightforward-Team.');

onMounted(checkInvitation);

async function checkInvitation() {
  try {
    const formResponse = await apiPublic.get(`/api/public/bewerber/invitations/${accessToken}/form`);
    hydrateForm(formResponse.data.data);
    state.value = 'form';
    return;
  } catch (sessionError) {
    if (![401, 410].includes(sessionError.response?.status)) {
      state.value = 'invalid';
      return;
    }
  }
  try {
    const response = await apiPublic.get(`/api/public/bewerber/invitations/${accessToken}`);
    state.value = response.data.data.state === 'active' ? 'code' : response.data.data.state;
  } catch (requestError) {
    state.value = requestError.response?.data?.state || requestError.response?.data?.data?.state || 'invalid';
  }
}
async function verifyCode() {
  busy.value = true; error.value = '';
  try {
    const response = await apiPublic.post(`/api/public/bewerber/invitations/${accessToken}/verify`, { code: accessCode.value });
    hydrateForm(response.data.data); state.value = 'form';
  } catch (requestError) { error.value = requestError.response?.data?.message || 'Der Zugang konnte nicht geprüft werden.'; }
  finally { busy.value = false; }
}
function hydrateForm(data) {
  for (const [key, value] of Object.entries(data)) form[key] = dateValue(key, value);
  form.documents ||= []; form.fuehrerscheine ||= [];
}
function dateValue(key, value) { return ['geburtsdatum', 'verfuegbarAb', 'verfuegbarBis'].includes(key) && value ? String(value).slice(0, 10) : value; }
async function uploadDocument(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  if (file.size > 10 * 1024 * 1024) { error.value = 'Die Datei darf maximal 10 MB groß sein.'; return; }
  uploading.value = true; error.value = '';
  try {
    const data = new FormData(); data.append('file', file); data.append('category', uploadCategory.value);
    const response = await apiPublic.post(`/api/public/bewerber/invitations/${accessToken}/documents`, data);
    form.documents.push(response.data.data);
  } catch (requestError) { error.value = requestError.response?.data?.message || 'Die Datei konnte nicht hochgeladen werden.'; }
  finally { uploading.value = false; }
}
async function removeDocument(document) {
  try { await apiPublic.delete(`/api/public/bewerber/invitations/${accessToken}/documents/${document._id}`); form.documents = form.documents.filter((entry) => entry._id !== document._id); }
  catch (requestError) { error.value = requestError.response?.data?.message || 'Die Datei konnte nicht entfernt werden.'; }
}
async function submitForm() {
  if (!window.confirm('Angaben jetzt verbindlich absenden? Danach sind keine Änderungen mehr möglich.')) return;
  busy.value = true; error.value = '';
  try { await apiPublic.post(`/api/public/bewerber/invitations/${accessToken}/submit`, { ...form, documents: undefined, invitation: undefined }); state.value = 'success'; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch (requestError) { error.value = requestError.response?.data?.message || 'Die Angaben konnten nicht übermittelt werden.'; }
  finally { busy.value = false; }
}
function formatAppointment(value) { return value ? new Date(value).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' }) : ''; }
function formatFileSize(size) { return `${(Number(size || 0) / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`; }
</script>

<style scoped lang="scss">
.public-application {
  --sf-bg: #f4f5f6;
  --sf-surface: #ffffff;
  --sf-text: #1f2124;
  --sf-muted: #6b6f76;
  --sf-border: #e3e4e7;
  --sf-border-strong: #d3d5d9;
  --sf-accent: #eeaf67;
  --sf-accent-soft: rgba(238, 175, 103, 0.16);
  --sf-ink: #23252a;
  --sf-field: #f7f8f9;

  background: var(--sf-bg);
  color: var(--sf-text);
  min-height: 100vh;
  padding: 0 20px 72px;
  -webkit-font-smoothing: antialiased;
}

.brand-header { align-items: center; display: flex; justify-content: space-between; margin: 0 auto; max-width: 920px; padding: 28px 4px; }
.brand-header div { align-items: center; display: flex; gap: 10px; }
.brand-logo { height: 30px; width: auto; display: block; }

.form-shell {
  background: var(--sf-surface);
  border: 1px solid var(--sf-border);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(17, 19, 22, 0.06);
  margin: 0 auto;
  max-width: 920px;
  overflow: hidden;
}

.form-heading {
  align-items: flex-end;
  background: var(--sf-ink);
  color: #fff;
  display: flex;
  gap: 30px;
  justify-content: space-between;
  padding: 34px 34px 30px;
}
.form-heading h1 { font-size: 1.75rem; font-weight: 600; letter-spacing: -0.01em; }
.form-heading > div:first-child > p:last-child { color: #b9bcc2; margin-top: 8px; font-size: .92rem; }
.form-heading > div:last-child { display: grid; gap: 4px; text-align: right; }
.form-heading > div:last-child strong { font-weight: 600; }
.form-heading span { color: #a7abb2; font-size: .8rem; }

.eyebrow { color: var(--sf-accent); font-size: .7rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 6px; }

h1, h2, p { margin: 0; }
h2 { font-size: 1.02rem; font-weight: 600; margin-bottom: 20px; letter-spacing: -0.01em; }

.form-section { border-bottom: 1px solid var(--sf-border); padding: 30px 34px; }
.form-section:last-of-type { border-bottom: 0; }
.section-copy { color: var(--sf-muted); font-size: .82rem; margin: -12px 0 18px; }

.form-grid { display: grid; gap: 16px 18px; grid-template-columns: 1fr 1fr; }
.form-grid + .form-grid { margin-top: 16px; }
.address-grid { grid-template-columns: repeat(4, 1fr); }
.address-street { grid-column: span 3; }
.address-number { grid-column: span 1; }
.address-plz { grid-column: span 1; }
.address-city { grid-column: span 3; }
.full { grid-column: 1 / -1; }

label, legend { color: var(--sf-text); display: grid; font-size: .8rem; font-weight: 600; gap: 7px; }

input, select, textarea {
  background: var(--sf-field);
  border: 1px solid var(--sf-border-strong);
  border-radius: 10px;
  color: var(--sf-text);
  font: inherit;
  font-weight: 400;
  min-height: 44px;
  padding: 10px 12px;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
textarea { resize: vertical; line-height: 1.5; }
input:hover, select:hover, textarea:hover { border-color: var(--sf-muted); }
input:focus, select:focus, textarea:focus {
  background: var(--sf-surface);
  border-color: var(--sf-accent);
  box-shadow: 0 0 0 3px var(--sf-accent-soft);
  outline: none;
}

fieldset { border: 0; margin: 0 0 20px; padding: 0; }
.license-grid, .toggle-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.license-grid label, .toggle-grid label {
  align-items: center;
  background: var(--sf-field);
  border: 1px solid var(--sf-border-strong);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  font-weight: 500;
  gap: 8px;
  padding: 9px 12px;
  transition: border-color .15s, background .15s;
}
.license-grid label:hover, .toggle-grid label:hover { border-color: var(--sf-accent); }
.license-grid label:has(:checked), .toggle-grid label:has(:checked) {
  background: var(--sf-accent-soft);
  border-color: var(--sf-accent);
}
.license-grid input, .toggle-grid input { accent-color: var(--sf-accent); min-height: 0; width: auto; cursor: pointer; }
.extras { margin-top: 18px; }

.upload-row { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; }
.upload-row select { min-width: 220px; }
.upload-button {
  align-items: center;
  background: var(--sf-ink);
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  font-size: .85rem;
  font-weight: 600;
  min-height: 44px;
  padding: 0 18px;
  transition: opacity .15s;
}
.upload-button:hover { opacity: .88; }
.upload-button input { display: none; }

.documents { display: grid; gap: 10px; list-style: none; margin: 18px 0 0; padding: 0; }
.documents li {
  align-items: center;
  background: var(--sf-field);
  border: 1px solid var(--sf-border);
  border-radius: 10px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 12px 14px;
}
.documents span { display: grid; gap: 2px; min-width: 0; }
.documents strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.documents small { color: var(--sf-muted); }
.documents button { background: transparent; border: 0; color: var(--sf-muted); cursor: pointer; font-size: 1.4rem; line-height: 1; padding: 0 4px; transition: color .15s; }
.documents button:hover { color: #b42318; }

.submit-row {
  align-items: center;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 26px 34px;
}
.submit-row p { color: var(--sf-muted); font-size: .8rem; }

.submit-row button, .code-panel button {
  background: var(--sf-accent);
  border: 1px solid var(--sf-accent);
  border-radius: 10px;
  color: var(--sf-ink);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 46px;
  padding: 11px 22px;
  transition: filter .15s, box-shadow .15s, opacity .15s;
}
.submit-row button:hover:not(:disabled), .code-panel button:hover:not(:disabled) {
  box-shadow: 0 6px 18px rgba(238, 175, 103, 0.4);
  filter: brightness(1.03);
}
.submit-row button:disabled, .code-panel button:disabled { opacity: .5; cursor: not-allowed; }

.error { color: #b42318; font-size: .84rem; padding: 0 34px 8px; }

.state-panel, .code-panel { padding: 56px 40px; text-align: center; }
.state-panel h1, .code-panel h1 { font-size: 1.5rem; font-weight: 600; }
.state-panel p, .code-panel > p { color: var(--sf-muted); margin-top: 12px; }
.code-panel form { display: grid; gap: 16px; margin: 30px auto 0; max-width: 320px; }
.code-panel input { font-size: 1.5rem; font-weight: 600; letter-spacing: 10px; text-align: center; }
.code-panel .error { padding: 0; }
.success-icon { align-items: center; background: #177245; border-radius: 50%; color: #fff; display: inline-flex; font-size: 1.5rem; height: 52px; justify-content: center; margin-bottom: 18px; width: 52px; }

@media (max-width: 680px) {
  .public-application { padding-inline: 12px; }
  .brand-header { padding-inline: 0; }
  .form-heading, .submit-row { align-items: stretch; flex-direction: column; gap: 16px; }
  .form-heading > div:last-child { text-align: left; }
  .form-grid, .address-grid { grid-template-columns: 1fr; }
  .address-street, .address-number, .address-plz, .address-city { grid-column: auto; }
  .full { grid-column: auto; }
  .form-section, .form-heading, .submit-row { padding: 22px; }
  .upload-row { align-items: stretch; flex-direction: column; }
  .upload-row select { min-width: 0; }
}
</style>
