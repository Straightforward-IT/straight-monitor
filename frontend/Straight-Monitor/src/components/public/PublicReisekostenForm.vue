<template>
  <main class="public-reisekosten">
    <header class="brand-header">
      <div><img :src="logoSrc" alt="Straightforward" class="brand-logo" /></div>
    </header>

    <section v-if="state === 'loading'" class="form-shell state-panel" role="status">
      Reisekostenformular wird geladen …
    </section>

    <section v-else-if="['invalid', 'expired', 'submitted'].includes(state)" class="form-shell state-panel">
      <h1>{{ terminalTitle }}</h1>
      <p>{{ terminalMessage }}</p>
    </section>

    <section v-else-if="state === 'success'" class="form-shell state-panel success">
      <span class="success-icon">✓</span>
      <h1>Reisekosten eingereicht</h1>
      <p>
        Vielen Dank! Deine Reisekostenabrechnung wurde übermittelt und wird nun im Büro geprüft.
      </p>
      <p v-if="form.category === 'mietwagen'" class="success-note">
        Bitte denke daran, den <strong>Original-Tankbeleg</strong> fristgerecht im Büro vorzulegen, damit die Auszahlung angewiesen werden kann.
      </p>
    </section>

    <form v-else class="form-shell" @submit.prevent="submitForm">
      <header class="form-heading">
        <div>
          <p class="eyebrow">Reisekostenabrechnung</p>
          <h1>Einsatzfahrt abrechnen</h1>
          <p>Bitte wähle die Art deiner Auslage und fülle die passenden Angaben für diese Schicht aus.</p>
        </div>
        <div v-if="context.datum" class="heading-meta">
          <strong>{{ formatDate(context.datum) }}</strong>
          <span v-if="context.mitarbeiterName">{{ context.mitarbeiterName }}</span>
        </div>
      </header>

      <!-- 1. Automatisch gezogene Einsatzdaten -->
      <section class="form-section">
        <h2>1. Einsatz &amp; Anlass</h2>
        <div class="form-grid">
          <label>
            Anlass / Zweck der Reise
            <input :value="context.anlass || 'Einsatzfahrt'" disabled />
          </label>
          <label>
            Kunde
            <input :value="context.kundenName || '—'" disabled />
          </label>
          <label v-if="context.eventTitel" class="full">
            Veranstaltung / Event
            <input :value="context.eventTitel" disabled />
          </label>
        </div>
      </section>

      <!-- 2. Auswahl der Art (Baum-Einstieg) -->
      <section class="form-section">
        <h2>2. Art der Reisekosten wählen</h2>
        <p class="section-copy">
          Bitte wähle zuerst aus, worum es sich handelt. Die weiteren Felder schalten sich entsprechend deiner Wahl frei.
        </p>

        <div class="category-grid" role="radiogroup" aria-label="Art der Reisekosten">
          <button
            type="button"
            class="category-card"
            :class="{ active: form.category === 'mietwagen' }"
            :aria-pressed="form.category === 'mietwagen'"
            @click="selectCategory('mietwagen')"
          >
            <span class="category-title">Tankbeleg Mietwagen</span>
            <span class="category-sub">Betankung eines Mietwagens · 1 Beleg</span>
          </button>

          <button
            type="button"
            class="category-card"
            :class="{ active: form.category === 'oeffi' }"
            :aria-pressed="form.category === 'oeffi'"
            @click="selectCategory('oeffi')"
          >
            <span class="category-title">Öffi-Ticket</span>
            <span class="category-sub">ÖPNV / Bahn · bis zu 2 Belege (Hin &amp; Rück)</span>
          </button>

          <button
            type="button"
            class="category-card"
            :class="{ active: form.category === 'privatpkw' }"
            :aria-pressed="form.category === 'privatpkw'"
            @click="selectCategory('privatpkw')"
          >
            <span class="category-title">Privat-PKW</span>
            <span class="category-sub">Eigener PKW · {{ kmSatzFormatted }} € / km</span>
          </button>
        </div>
      </section>

      <!-- Gesperrter Platzhalter solange noch keine Kategorie gewählt wurde -->
      <section v-if="!form.category" class="form-section form-section--locked" inert>
        <h2>3. Angaben &amp; Belege</h2>
        <p class="locked-hint">
          Bitte wähle oben zuerst <strong>Tankbeleg Mietwagen</strong>, <strong>Öffi-Ticket</strong> oder <strong>Privat-PKW</strong> aus, um fortzufahren.
        </p>
      </section>

      <!-- 3A. Baum: Tankbeleg Mietwagen -->
      <section v-else-if="form.category === 'mietwagen'" class="form-section">
        <h2>3. Tankbeleg Mietwagen</h2>

        <div class="form-grid">
          <label class="full">
            Kennzeichen (optional)
            <input
              v-model.trim="form.nummernschild"
              placeholder="z. B. HH-AB 1234"
              autocomplete="off"
            />
          </label>
        </div>

        <div class="sub-block">
          <label class="block-label">Tankbeleg fotografieren oder hochladen (genau 1 Beleg)</label>
          <p class="section-copy">Aus buchhalterischen Gründen kann pro Vorgang nur ein einzelner Tankbeleg eingereicht werden.</p>

          <div v-if="anlagen.length < 1" class="upload-row">
            <label class="upload-button" :class="{ disabled: uploading }">
              {{ uploading ? 'Wird hochgeladen …' : 'Beleg fotografieren / Datei wählen' }}
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                :disabled="uploading"
                @change="uploadBeleg"
              />
            </label>
          </div>

          <ul v-if="anlagen.length" class="documents">
            <li v-for="doc in anlagen" :key="doc._id">
              <span>
                <strong>{{ doc.filename }}</strong>
                <small>{{ formatFileSize(doc.size) }}</small>
              </span>
              <button type="button" title="Beleg entfernen" :disabled="busy" @click="removeBeleg(doc)">×</button>
            </li>
          </ul>
        </div>

        <div class="notice-box" role="note">
          <strong>Wichtiger Hinweis zur Auszahlung:</strong>
          <p>
            Der <strong>Original-Tankbeleg</strong> muss innerhalb der vereinbarten Frist im Büro vorgelegt werden. Die Überweisung des Betrages erfolgt erst, sobald der Originalbeleg im Büro vorliegt und geprüft wurde.
          </p>
          <label class="notice-check">
            <input v-model="form.originalReceiptNoteAccepted" type="checkbox" required />
            <span>Ich habe den Hinweis gelesen und lege den Originalbeleg fristgerecht im Büro vor.</span>
          </label>
        </div>

        <div class="form-grid amount-block">
          <label>
            Betrag laut Tankbeleg (€) *
            <input
              v-model.number="form.betragEur"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              required
            />
          </label>
        </div>
      </section>

      <!-- 3B. Baum: Öffi-Ticket -->
      <section v-else-if="form.category === 'oeffi'" class="form-section">
        <h2>3. Öffi-Ticket (ÖPNV / Bahn)</h2>

        <div class="sub-block">
          <label class="block-label">Ticket-Belege fotografieren oder hochladen (max. 2 Belege für Hin- &amp; Rückfahrt)</label>
          <p class="section-copy">Du kannst bis zu 2 Belege (z. B. Hinfahrt und Rückfahrt) als Foto oder PDF hochladen.</p>

          <div v-if="anlagen.length < 2" class="upload-row">
            <label class="upload-button" :class="{ disabled: uploading }">
              {{ uploading ? 'Wird hochgeladen …' : `Beleg hinzufügen (${anlagen.length}/2)` }}
              <input
                type="file"
                accept="image/*,application/pdf"
                :disabled="uploading"
                @change="uploadBeleg"
              />
            </label>
          </div>

          <ul v-if="anlagen.length" class="documents">
            <li v-for="doc in anlagen" :key="doc._id">
              <span>
                <strong>{{ doc.filename }}</strong>
                <small>{{ formatFileSize(doc.size) }}</small>
              </span>
              <button type="button" title="Beleg entfernen" :disabled="busy" @click="removeBeleg(doc)">×</button>
            </li>
          </ul>
        </div>

        <div class="notice-box" role="note">
          <strong>Hinweis zur Einreichung:</strong>
          <p>
            Bitte achte darauf, dass Preis und Reisedatum auf dem Ticket gut lesbar sind. Die Auszahlung erfolgt nach Prüfung durch das Büro.
          </p>
        </div>

        <div class="form-grid amount-block">
          <label>
            Gesamtbetrag der Tickets (€) *
            <input
              v-model.number="form.betragEur"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              required
            />
          </label>
        </div>
      </section>

      <!-- 3C. Baum: Privat-PKW -->
      <section v-else-if="form.category === 'privatpkw'" class="form-section">
        <h2>3. Fahrt mit eigenem PKW</h2>

        <div class="form-grid">
          <label class="full">
            Kennzeichen (Pflichtfeld) *
            <input
              v-model.trim="form.nummernschild"
              placeholder="z. B. HH-XY 987"
              required
            />
          </label>

          <label>
            Start / Treffpunkt (automatisch gezogen)
            <input v-model.trim="form.start" placeholder="Startadresse / Treffpunkt" required />
          </label>

          <label>
            Ziel / Eventlocation (automatisch gezogen)
            <input v-model.trim="form.ziel" placeholder="Zieladresse / Eventlocation" required />
          </label>
        </div>

        <div class="sub-block">
          <label class="block-label">Fahrtstrecke</label>
          <div class="toggle-grid">
            <label :class="{ checked: !form.isRoundTrip }">
              <input v-model="form.isRoundTrip" type="radio" :value="false" />
              Nur einfache Fahrt (Hinfahrt)
            </label>
            <label :class="{ checked: form.isRoundTrip }">
              <input v-model="form.isRoundTrip" type="radio" :value="true" />
              Hin- und Rückfahrt
            </label>
          </div>
        </div>

        <div class="form-grid amount-block">
          <label>
            Gefahrene Kilometer Gesamt (km) *
            <input
              v-model.number="form.kilometer"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="z. B. 42"
              required
            />
          </label>

          <label>
            Erstattungsbetrag ({{ kmSatzFormatted }} € / km)
            <input :value="`${centToStr(computedPkwCent)} €`" disabled class="calculated-output" />
          </label>
        </div>

        <div class="sub-block">
          <label class="block-label">Optional: Routen-Screenshot / Nachweis anhängen</label>
          <div v-if="anlagen.length < 2" class="upload-row">
            <label class="upload-button upload-button--secondary" :class="{ disabled: uploading }">
              {{ uploading ? 'Wird hochgeladen …' : 'Screenshot / PDF anhängen (optional)' }}
              <input
                type="file"
                accept="image/*,application/pdf"
                :disabled="uploading"
                @change="uploadBeleg"
              />
            </label>
          </div>
          <ul v-if="anlagen.length" class="documents">
            <li v-for="doc in anlagen" :key="doc._id">
              <span>
                <strong>{{ doc.filename }}</strong>
                <small>{{ formatFileSize(doc.size) }}</small>
              </span>
              <button type="button" title="Nachweis entfernen" :disabled="busy" @click="removeBeleg(doc)">×</button>
            </li>
          </ul>
        </div>
      </section>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <footer class="submit-row">
        <p>Nach dem Absenden wird deine Abrechnung im Office geprüft und zur Auszahlung freigegeben.</p>
        <button type="submit" :disabled="busy || uploading || !canSubmit">
          {{ busy ? 'Wird übermittelt …' : 'Reisekosten einreichen' }}
        </button>
      </footer>
    </form>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import logoSrc from '@/assets/straightforward-logo-black.png';
import apiPublic from '@/utils/api-public';
import { centToStr, eurToCent, KM_SATZ_PRIVAT_PKW_CENT } from '@/utils/reisekostenCalc';

const route = useRoute();
const accessToken = String(route.params.accessToken || '');

const state = ref('loading');
const busy = ref(false);
const uploading = ref(false);
const error = ref('');
const anlagen = ref([]);

const context = reactive({
  id: '',
  auftragNr: null,
  mitarbeiterName: '',
  anlass: 'Einsatzfahrt',
  kundenName: '',
  eventTitel: '',
  eventLocation: '',
  start: '',
  ziel: '',
  datum: null,
  kmSatzCent: KM_SATZ_PRIVAT_PKW_CENT,
});

const form = reactive({
  category: '',
  nummernschild: '',
  betragEur: null,
  originalReceiptNoteAccepted: false,
  start: '',
  ziel: '',
  isRoundTrip: true,
  kilometer: null,
});

const kmSatzFormatted = computed(() =>
  (context.kmSatzCent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
);

const computedPkwCent = computed(() => {
  const km = Number(form.kilometer) || 0;
  return Math.round(km * context.kmSatzCent);
});

const canSubmit = computed(() => {
  if (!form.category) return false;
  if (form.category === 'mietwagen') {
    return anlagen.value.length === 1 && Number(form.betragEur) > 0 && form.originalReceiptNoteAccepted;
  }
  if (form.category === 'oeffi') {
    return anlagen.value.length >= 1 && anlagen.value.length <= 2 && Number(form.betragEur) > 0;
  }
  if (form.category === 'privatpkw') {
    return Boolean(form.nummernschild.trim()) && Boolean(form.start.trim()) && Boolean(form.ziel.trim()) && Number(form.kilometer) > 0;
  }
  return false;
});

const terminalTitle = computed(() =>
  state.value === 'submitted'
    ? 'Bereits eingereicht'
    : state.value === 'expired'
      ? 'Link abgelaufen'
      : 'Link ungültig'
);
const terminalMessage = computed(() =>
  state.value === 'submitted'
    ? 'Für diese Schicht wurde die Reisekostenabrechnung bereits eingereicht und befindet sich in der Prüfung.'
    : 'Bitte wende dich bei Rückfragen an dein Straightforward-Team.'
);

onMounted(loadForm);

async function loadForm() {
  state.value = 'loading';
  error.value = '';
  try {
    const { data } = await apiPublic.get(`/api/public/reisekosten/${accessToken}`);
    const d = data.data || {};
    Object.assign(context, {
      id: d.id || '',
      auftragNr: d.auftragNr ?? null,
      mitarbeiterName: d.mitarbeiterName || '',
      anlass: d.anlass || 'Einsatzfahrt',
      kundenName: d.kundenName || '—',
      eventTitel: d.eventTitel || '',
      eventLocation: d.eventLocation || '',
      start: d.start || '',
      ziel: d.ziel || '',
      datum: d.datum || null,
      kmSatzCent: d.kmSatzCent || KM_SATZ_PRIVAT_PKW_CENT,
    });
    form.nummernschild = d.nummernschild || '';
    form.start = d.start || '';
    form.ziel = d.ziel || '';
    anlagen.value = Array.isArray(d.anlagen) ? d.anlagen : [];
    state.value = 'form';
  } catch (err) {
    state.value = err.response?.data?.state || 'invalid';
  }
}

function selectCategory(cat) {
  if (cat === 'mietwagen' && anlagen.value.length > 1) {
    error.value = 'Für einen Tankbeleg Mietwagen darf maximal 1 Beleg hochgeladen sein. Bitte entferne zuerst überzählige Belege.';
    return;
  }
  error.value = '';
  form.category = cat;
}

async function uploadBeleg(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  uploading.value = true;
  error.value = '';
  try {
    const fd = new FormData();
    fd.append('category', form.category);
    fd.append('file', file);
    const { data } = await apiPublic.post(`/api/public/reisekosten/${accessToken}/belege`, fd);
    anlagen.value = data.anlagen || [];
  } catch (err) {
    error.value = err.response?.data?.message || 'Der Beleg konnte nicht hochgeladen werden.';
  } finally {
    uploading.value = false;
  }
}

async function removeBeleg(doc) {
  error.value = '';
  try {
    const { data } = await apiPublic.delete(`/api/public/reisekosten/${accessToken}/belege/${doc._id}`);
    anlagen.value = data.anlagen || [];
  } catch (err) {
    error.value = err.response?.data?.message || 'Der Beleg konnte nicht entfernt werden.';
  }
}

async function submitForm() {
  if (!canSubmit.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const payload = {
      category: form.category,
      nummernschild: form.nummernschild,
      betragCent: eurToCent(form.betragEur),
      originalReceiptNoteAccepted: form.originalReceiptNoteAccepted,
      start: form.start,
      ziel: form.ziel,
      isRoundTrip: form.isRoundTrip,
      kilometer: Number(form.kilometer) || 0,
    };
    await apiPublic.post(`/api/public/reisekosten/${accessToken}/submit`, payload);
    state.value = 'success';
  } catch (err) {
    error.value = err.response?.data?.message || 'Die Abrechnung konnte nicht gesendet werden.';
  } finally {
    busy.value = false;
  }
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFileSize(bytes = 0) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
</script>

<style scoped>
.public-reisekosten {
  --sf-bg: #f6f4f0;
  --sf-surface: #ffffff;
  --sf-field: #faf9f6;
  --sf-text: #1c1d20;
  --sf-muted: #6c6f75;
  --sf-border: #e5e2dc;
  --sf-border-strong: #d4d0c8;
  --sf-accent: #eeaf67;
  --sf-accent-soft: rgba(238, 175, 103, 0.18);
  --sf-ink: #17181b;
  background: radial-gradient(circle at top, #fbfaf7 0%, var(--sf-bg) 70%);
  color: var(--sf-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  min-height: 100vh;
  padding: 28px 18px 64px;
}

.brand-header {
  display: flex;
  justify-content: flex-start;
  margin: 0 auto 24px;
  max-width: 780px;
}
.brand-logo { display: block; height: 26px; width: auto; }

.form-shell {
  background: var(--sf-surface);
  border: 1px solid var(--sf-border);
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(20, 20, 20, 0.03), 0 18px 44px rgba(20, 20, 20, 0.06);
  margin: 0 auto;
  max-width: 780px;
  overflow: hidden;
}

.form-heading {
  align-items: flex-end;
  background: var(--sf-ink);
  color: #fff;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 32px 34px 28px;
}
.form-heading h1 { font-size: 1.65rem; font-weight: 600; margin: 0; }
.form-heading > div:first-child > p:last-child { color: #b9bcc2; margin-top: 8px; font-size: .9rem; }
.heading-meta { display: grid; gap: 4px; text-align: right; }
.heading-meta strong { font-weight: 600; }
.heading-meta span { color: #a7abb2; font-size: .82rem; }

.eyebrow {
  color: var(--sf-accent);
  font-size: .7rem;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  margin: 0 0 6px;
}

h2, p { margin: 0; }
h2 { font-size: 1.02rem; font-weight: 600; margin-bottom: 18px; }

.form-section { border-bottom: 1px solid var(--sf-border); padding: 28px 34px; }
.form-section--locked { background: #faf9f6; opacity: 0.72; }
.locked-hint { color: var(--sf-muted); font-size: 0.9rem; }
.section-copy { color: var(--sf-muted); font-size: .83rem; margin: -10px 0 16px; }

.category-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, 1fr);
}
.category-card {
  align-items: flex-start;
  background: var(--sf-field);
  border: 2px solid var(--sf-border-strong);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  text-align: left;
  transition: border-color .15s, background .15s, transform .1s;
}
.category-card:hover { border-color: var(--sf-accent); }
.category-card.active {
  background: var(--sf-accent-soft);
  border-color: var(--sf-accent);
}
.category-title { font-size: 0.95rem; font-weight: 700; color: var(--sf-text); }
.category-sub { font-size: 0.78rem; color: var(--sf-muted); line-height: 1.35; }

.form-grid { display: grid; gap: 16px 18px; grid-template-columns: 1fr 1fr; }
.full { grid-column: 1 / -1; }
.amount-block { margin-top: 18px; }

label, .block-label {
  color: var(--sf-text);
  display: grid;
  font-size: .8rem;
  font-weight: 600;
  gap: 7px;
}
.sub-block { margin-top: 20px; }

input {
  background: var(--sf-field);
  border: 1px solid var(--sf-border-strong);
  border-radius: 10px;
  color: var(--sf-text);
  font: inherit;
  font-weight: 400;
  min-height: 44px;
  padding: 10px 12px;
}
input:disabled {
  background: #f0eee9;
  color: #555;
}
.calculated-output {
  font-weight: 700;
  color: var(--sf-ink) !important;
}

.toggle-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
.toggle-grid label {
  align-items: center;
  background: var(--sf-field);
  border: 1px solid var(--sf-border-strong);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  font-weight: 500;
  gap: 8px;
  padding: 10px 14px;
}
.toggle-grid label.checked {
  background: var(--sf-accent-soft);
  border-color: var(--sf-accent);
  font-weight: 600;
}
.toggle-grid input { min-height: 0; width: auto; accent-color: var(--sf-accent); }

.notice-box {
  background: #fff8eb;
  border: 1px solid #f2c97d;
  border-radius: 12px;
  padding: 16px 18px;
  margin-top: 20px;
  font-size: 0.85rem;
  line-height: 1.5;
}
.notice-box strong { display: block; margin-bottom: 6px; color: #7a4b00; }
.notice-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  font-weight: 600;
  cursor: pointer;
}
.notice-check input { min-height: 0; width: 18px; height: 18px; margin-top: 2px; }

.upload-row { margin-top: 10px; }
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
}
.upload-button--secondary {
  background: transparent;
  border: 1px solid var(--sf-border-strong);
  color: var(--sf-text);
}
.upload-button input { display: none; }

.documents { display: grid; gap: 10px; list-style: none; margin: 14px 0 0; padding: 0; }
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
.documents button {
  background: transparent;
  border: 0;
  color: var(--sf-muted);
  cursor: pointer;
  font-size: 1.4rem;
  line-height: 1;
  padding: 0 4px;
}

.submit-row {
  align-items: center;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 24px 34px;
}
.submit-row p { color: var(--sf-muted); font-size: .8rem; }
.submit-row button {
  background: var(--sf-accent);
  border: 1px solid var(--sf-accent);
  border-radius: 10px;
  color: var(--sf-ink);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 46px;
  padding: 11px 22px;
  white-space: nowrap;
}
.submit-row button:disabled { opacity: .5; cursor: not-allowed; }

.error { color: #b42318; font-size: .85rem; padding: 12px 34px 0; font-weight: 600; }

.state-panel { padding: 56px 40px; text-align: center; }
.state-panel h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 12px; }
.state-panel p { color: var(--sf-muted); }
.success-note { margin-top: 14px; color: #7a4b00 !important; }
.success-icon {
  align-items: center;
  background: #177245;
  border-radius: 50%;
  color: #fff;
  display: inline-flex;
  font-size: 1.5rem;
  height: 52px;
  justify-content: center;
  margin-bottom: 18px;
  width: 52px;
}

@media (max-width: 680px) {
  .category-grid, .form-grid { grid-template-columns: 1fr; }
  .form-heading, .submit-row { align-items: stretch; flex-direction: column; gap: 16px; }
  .heading-meta { text-align: left; }
  .form-section, .form-heading, .submit-row { padding: 22px; }
}
</style>
