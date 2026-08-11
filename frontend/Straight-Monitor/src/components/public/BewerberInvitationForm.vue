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
          <span></span>
          <label>Vorname<input v-model.trim="form.vorname" autocomplete="given-name" required /></label>
          <label>Nachname<input v-model.trim="form.nachname" autocomplete="family-name" required /></label>
          <label>E-Mail<input v-model.trim="form.email" type="email" autocomplete="email" required /></label>
          <label>Telefon<input v-model.trim="form.telefon" type="tel" autocomplete="tel" /></label>
          <label>Geburtsdatum<input v-model="form.geburtsdatum" type="date" autocomplete="bday" /></label>
          <label>Familienstand<input v-model.trim="form.familienstand" /></label>
          <label>Staatsangehörigkeit<input v-model.trim="form.staatsangehoerigkeit" /></label>
          <label>Wohnsitz<input v-model.trim="form.wohnsitz" /></label>
        </div>
      </section>

      <section class="form-section">
        <h2>Adresse</h2>
        <div class="form-grid address-grid">
          <label>Straße und Hausnummer<input v-model.trim="form.strasse" autocomplete="street-address" /></label>
          <label>PLZ<input v-model.trim="form.plz" autocomplete="postal-code" inputmode="numeric" /></label>
          <label>Ort<input v-model.trim="form.ort" autocomplete="address-level2" /></label>
        </div>
      </section>

      <section class="form-section">
        <h2>Einsatz und Verfügbarkeit</h2>
        <div class="form-grid">
          <label>Bevorzugter Bereich<select v-model="form.bevorzugterBereich"><option value="">Keine Angabe</option><option value="service">Service</option><option value="logistik">Logistik</option><option value="beides">Service und Logistik</option></select></label>
          <label>Aktuelles Anstellungsverhältnis<input v-model.trim="form.aktuellesAnstellungsverhaeltnis" /></label>
          <label>Verfügbar ab<input v-model="form.verfuegbarAb" type="date" /></label>
          <label>Verfügbar bis<input v-model="form.verfuegbarBis" type="date" /></label>
          <label class="full">Verfügbarkeit<textarea v-model.trim="form.verfuegbarkeit" rows="3" placeholder="Wochentage, Schichten oder Sperrzeiten" /></label>
          <label class="full">Erfahrung Gastronomie / Logistik<textarea v-model.trim="form.erfahrungGastronomieLogistik" rows="3" /></label>
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
.public-application { background: #f4f3f0; color: #252525; min-height: 100vh; padding: 0 20px 60px; }
.brand-header { align-items: center; display: flex; justify-content: space-between; margin: 0 auto; max-width: 920px; padding: 24px 0; }
.brand-header div { align-items: center; display: flex; gap: 10px; }.brand-header > span { color: #666; font-size: .82rem; }
.brand-logo { height: 28px; width: auto; display: block; }
.form-shell { background: #fff; border: 1px solid #d8d6d1; border-radius: 8px; margin: 0 auto; max-width: 920px; overflow: hidden; }
.form-heading { align-items: end; background: #252525; color: #fff; display: flex; gap: 30px; justify-content: space-between; padding: 28px; }
.form-heading h1 { font-size: 1.7rem; }.form-heading p { color: #d0d0d0; margin-top: 6px; }.form-heading > div:last-child { display: grid; gap: 5px; text-align: right; }.form-heading span { color: #ccc; font-size: .78rem; }
.eyebrow { color: #e8730a !important; font-size: .72rem; font-weight: 800; text-transform: uppercase; }
h1, h2, p { margin: 0; }h2 { font-size: 1rem; margin-bottom: 18px; }
.form-section { border-bottom: 1px solid #e5e3de; padding: 26px 28px; }.section-copy { color: #666; font-size: .8rem; margin: -10px 0 14px; }
.form-grid { display: grid; gap: 15px; grid-template-columns: 1fr 1fr; }.address-grid { grid-template-columns: 2fr .7fr 1.3fr; }.full { grid-column: 1 / -1; }
label, legend { color: #444; display: grid; font-size: .8rem; font-weight: 700; gap: 6px; }
input, select, textarea { background: #fff; border: 1px solid #c9c7c2; border-radius: 5px; color: #222; font: inherit; min-height: 42px; padding: 9px 10px; }textarea { resize: vertical; }
input:focus, select:focus, textarea:focus { border-color: #e8730a; outline: 2px solid rgba(232,115,10,.18); }
fieldset { border: 0; margin: 0 0 18px; padding: 0; }.license-grid, .toggle-grid { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 9px; }.license-grid label, .toggle-grid label { align-items: center; background: #f4f3f0; border: 1px solid #ddd; border-radius: 4px; display: flex; padding: 8px 10px; }.license-grid input, .toggle-grid input { min-height: 0; width: auto; }.extras { margin-top: 16px; }
.upload-row { align-items: center; display: flex; gap: 10px; }.upload-button { background: #252525; border-radius: 5px; color: white; cursor: pointer; display: inline-flex; padding: 12px 14px; }.upload-button input { display: none; }
.documents { display: grid; gap: 8px; list-style: none; margin: 16px 0 0; padding: 0; }.documents li { align-items: center; background: #f4f3f0; display: flex; justify-content: space-between; padding: 10px 12px; }.documents span { display: grid; }.documents small { color: #666; }.documents button { background: transparent; border: 0; cursor: pointer; font-size: 1.25rem; }
.submit-row { align-items: center; display: flex; gap: 20px; justify-content: space-between; padding: 24px 28px; }.submit-row p { color: #666; font-size: .78rem; }.submit-row button, .code-panel button { background: #e8730a; border: 1px solid #e8730a; border-radius: 5px; color: white; cursor: pointer; font: inherit; font-weight: 700; min-height: 42px; padding: 9px 15px; }.submit-row button:disabled, .code-panel button:disabled { opacity: .55; }
.error { color: #b42318; font-size: .82rem; padding: 0 28px; }.state-panel, .code-panel { padding: 48px; text-align: center; }.state-panel p, .code-panel > p { color: #666; margin-top: 10px; }.code-panel form { display: grid; gap: 14px; margin: 28px auto 0; max-width: 320px; }.code-panel input { font-size: 1.4rem; letter-spacing: 8px; text-align: center; }.code-panel .error { padding: 0; }.success-icon { align-items: center; background: #177245; border-radius: 50%; color: white; display: inline-flex; font-size: 1.4rem; height: 48px; justify-content: center; margin-bottom: 16px; width: 48px; }
@media (max-width: 680px) { .public-application { padding-inline: 10px; }.brand-header > span { display: none; }.form-heading, .submit-row { align-items: stretch; flex-direction: column; }.form-heading > div:last-child { text-align: left; }.form-grid, .address-grid { grid-template-columns: 1fr; }.full { grid-column: auto; }.form-section, .form-heading, .submit-row { padding: 20px; }.upload-row { align-items: stretch; flex-direction: column; } }
</style>
