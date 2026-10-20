<template>
  <main class="public-reisekosten">
    <header class="brand-header">
      <div class="brand-header__left">
        <img :src="logoSrc" alt="Straightforward" class="brand-logo" />
        <span class="brand-subtitle">Reisekostenabrechnung</span>
      </div>
    </header>

    <section v-if="state === 'loading'" class="rk-shell rk-state-panel" role="status">
      <LoadingSpinner label="Reisekostenformular wird geladen …" />
    </section>

    <section v-else-if="['invalid', 'expired', 'submitted'].includes(state)" class="rk-shell rk-state-panel">
      <div class="rk-state-icon rk-state-icon--muted">
        <font-awesome-icon :icon="['fas', state === 'submitted' ? 'check' : 'triangle-exclamation']" />
      </div>
      <h1>{{ terminalTitle }}</h1>
      <p>{{ terminalMessage }}</p>
    </section>

    <section v-else-if="state === 'success'" class="rk-shell rk-state-panel rk-state-panel--success">
      <div class="rk-state-icon rk-state-icon--success">
        <font-awesome-icon :icon="['fas', 'check']" />
      </div>
      <h1>Reisekosten eingereicht</h1>
      <p>
        Vielen Dank! Deine Reisekostenabrechnung wurde übermittelt und wird nun im Büro geprüft.
      </p>
      <p v-if="form.category === 'mietwagen'" class="rk-success-note">
        Bitte denke daran, den <strong>Original-Tankbeleg</strong> fristgerecht im Büro vorzulegen, damit die Auszahlung angewiesen werden kann.
      </p>
    </section>

    <form v-else class="rk-shell" @submit.prevent="submitForm">
      <header class="rk-header">
        <div class="rk-header__title-group">
          <p class="rk-eyebrow">Einsatzdokument</p>
          <h1>Einsatzfahrt abrechnen</h1>
          <p class="rk-header__sub">
            Bitte wähle die Art deiner Auslage und fülle die passenden Angaben für diese Schicht aus.
          </p>
        </div>
        <div v-if="context.datum || context.mitarbeiterName" class="rk-header__meta">
          <strong v-if="context.datum">{{ formatDate(context.datum) }}</strong>
          <span v-if="context.mitarbeiterName">{{ context.mitarbeiterName }}</span>
        </div>
      </header>

      <!-- 1. Automatisch gezogene Einsatzdaten -->
      <section class="rk-section">
        <div class="rk-section__heading">
          <h2>1. Einsatz &amp; Anlass</h2>
        </div>
        <div class="rk-grid">
          <label class="rk-field">
            <span class="rk-field__label">Anlass / Zweck der Reise</span>
            <AppTextInput :model-value="context.anlass || 'Einsatzfahrt'" disabled />
          </label>
          <label class="rk-field">
            <span class="rk-field__label">Kunde</span>
            <AppTextInput :model-value="context.kundenName || '—'" disabled />
          </label>
          <label v-if="context.eventTitel" class="rk-field rk-field--full">
            <span class="rk-field__label">Veranstaltung / Event</span>
            <AppTextInput :model-value="context.eventTitel" disabled />
          </label>
        </div>
      </section>

      <!-- 2. Auswahl der Art (Baum-Einstieg) -->
      <section class="rk-section">
        <div class="rk-section__heading">
          <h2>2. Art der Reisekosten wählen</h2>
          <p class="rk-section__copy">
            Bitte wähle zuerst aus, worum es sich handelt. Die weiteren Felder schalten sich entsprechend deiner Wahl frei.
          </p>
        </div>

        <div class="rk-category-chips" role="radiogroup" aria-label="Art der Reisekosten">
          <FilterChip
            class="category-card rk-category-chip"
            :active="form.category === 'mietwagen'"
            :aria-pressed="form.category === 'mietwagen'"
            @click="selectCategory('mietwagen')"
          >
            <font-awesome-icon :icon="['fas', 'gas-pump']" />
            <div class="rk-category-chip__text">
              <span class="rk-category-chip__title">Tankbeleg Mietwagen</span>
              <span class="rk-category-chip__sub">Betankung Mietwagen · 1 Beleg</span>
            </div>
          </FilterChip>

          <FilterChip
            class="category-card rk-category-chip"
            :active="form.category === 'oeffi'"
            :aria-pressed="form.category === 'oeffi'"
            @click="selectCategory('oeffi')"
          >
            <font-awesome-icon :icon="['fas', 'train-subway']" />
            <div class="rk-category-chip__text">
              <span class="rk-category-chip__title">Öffi-Ticket</span>
              <span class="rk-category-chip__sub">ÖPNV / Bahn · max. 2 Belege</span>
            </div>
          </FilterChip>

          <FilterChip
            class="category-card rk-category-chip"
            :active="form.category === 'privatpkw'"
            :aria-pressed="form.category === 'privatpkw'"
            @click="selectCategory('privatpkw')"
          >
            <font-awesome-icon :icon="['fas', 'car']" />
            <div class="rk-category-chip__text">
              <span class="rk-category-chip__title">Privat-PKW</span>
              <span class="rk-category-chip__sub">Eigener PKW · {{ kmSatzFormatted }} € / km</span>
            </div>
          </FilterChip>
        </div>
      </section>

      <!-- Gesperrter Platzhalter solange noch keine Kategorie gewählt wurde -->
      <section v-if="!form.category" class="rk-section form-section--locked rk-section--locked" inert>
        <div class="rk-section__heading">
          <h2>3. Angaben &amp; Belege</h2>
          <p class="rk-section__copy">
            Bitte wähle oben zuerst <strong>Tankbeleg Mietwagen</strong>, <strong>Öffi-Ticket</strong> oder <strong>Privat-PKW</strong> aus, um fortzufahren.
          </p>
        </div>
      </section>

      <!-- 3A. Baum: Tankbeleg Mietwagen -->
      <section v-else-if="form.category === 'mietwagen'" class="rk-section">
        <div class="rk-section__heading">
          <h2>3. Tankbeleg Mietwagen</h2>
        </div>

        <div class="rk-grid">
          <label class="rk-field rk-field--full">
            <span class="rk-field__label">Kennzeichen (optional)</span>
            <AppTextInput
              v-model.trim="form.nummernschild"
              placeholder="z. B. HH-AB 1234"
              autocomplete="off"
            />
          </label>
        </div>

        <div class="rk-sub-block">
          <div class="rk-sub-block__header">
            <span class="rk-field__label">Tankbeleg fotografieren oder hochladen (genau 1 Beleg)</span>
            <p class="rk-section__copy">
              Aus buchhalterischen Gründen kann pro Vorgang nur ein einzelner Tankbeleg eingereicht werden.
            </p>
          </div>

          <div v-if="anlagen.length < 1" class="rk-upload-row">
            <AppButton
              variant="outlined"
              size="md"
              :disabled="uploading"
              :loading="uploading"
              @click="belegInput?.click()"
            >
              <font-awesome-icon :icon="['fas', 'upload']" />
              {{ uploading ? 'Wird hochgeladen …' : 'Beleg fotografieren / Datei wählen' }}
            </AppButton>
            <input
              ref="belegInput"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              hidden
              :disabled="uploading"
              @change="uploadBeleg"
            />
          </div>

          <ul v-if="anlagen.length" class="rk-documents">
            <li v-for="doc in anlagen" :key="doc._id" class="rk-document-row">
              <font-awesome-icon :icon="['fas', doc.contentType && doc.contentType.includes('pdf') ? 'file-pdf' : 'file-image']" class="rk-document-icon" />
              <div class="rk-document-info">
                <strong>{{ doc.filename }}</strong>
                <small>{{ formatFileSize(doc.size) }}</small>
              </div>
              <AppIconButton
                variant="ghost"
                size="sm"
                class="rk-del-btn"
                :label="`${doc.filename} entfernen`"
                :disabled="busy"
                @click="removeBeleg(doc)"
              >
                <font-awesome-icon :icon="['fas', 'xmark']" />
              </AppIconButton>
            </li>
          </ul>
        </div>

        <div class="notice-box rk-notice-box" role="note">
          <div class="rk-notice-box__title">
            <font-awesome-icon :icon="['fas', 'circle-info']" />
            <strong>Wichtiger Hinweis zur Auszahlung</strong>
          </div>
          <p class="rk-notice-box__text">
            Der <strong>Original-Tankbeleg</strong> muss innerhalb der vereinbarten Frist im Büro vorgelegt werden. Die Überweisung des Betrages erfolgt erst, sobald der Originalbeleg im Büro vorliegt und geprüft wurde.
          </p>
          <label class="notice-check rk-notice-check">
            <input v-model="form.originalReceiptNoteAccepted" type="checkbox" required />
            <span>Ich habe den Hinweis gelesen und lege den Originalbeleg fristgerecht im Büro vor.</span>
          </label>
        </div>

        <div class="rk-grid">
          <label class="rk-field">
            <span class="rk-field__label">Betrag laut Tankbeleg (€) *</span>
            <AppTextInput
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
      <section v-else-if="form.category === 'oeffi'" class="rk-section">
        <div class="rk-section__heading">
          <h2>3. Öffi-Ticket (ÖPNV / Bahn)</h2>
        </div>

        <div class="rk-sub-block">
          <div class="rk-sub-block__header">
            <span class="rk-field__label">Ticket-Belege fotografieren oder hochladen (max. 2 Belege für Hin- &amp; Rückfahrt)</span>
            <p class="rk-section__copy">
              Du kannst bis zu 2 Belege (z. B. Hinfahrt und Rückfahrt) als Foto oder PDF hochladen.
            </p>
          </div>

          <div v-if="anlagen.length < 2" class="rk-upload-row">
            <AppButton
              variant="outlined"
              size="md"
              :disabled="uploading"
              :loading="uploading"
              @click="belegInput?.click()"
            >
              <font-awesome-icon :icon="['fas', 'upload']" />
              {{ uploading ? 'Wird hochgeladen …' : `Beleg hinzufügen (${anlagen.length}/2)` }}
            </AppButton>
            <input
              ref="belegInput"
              type="file"
              accept="image/*,application/pdf"
              hidden
              :disabled="uploading"
              @change="uploadBeleg"
            />
          </div>

          <ul v-if="anlagen.length" class="rk-documents">
            <li v-for="doc in anlagen" :key="doc._id" class="rk-document-row">
              <font-awesome-icon :icon="['fas', doc.contentType && doc.contentType.includes('pdf') ? 'file-pdf' : 'file-image']" class="rk-document-icon" />
              <div class="rk-document-info">
                <strong>{{ doc.filename }}</strong>
                <small>{{ formatFileSize(doc.size) }}</small>
              </div>
              <AppIconButton
                variant="ghost"
                size="sm"
                class="rk-del-btn"
                :label="`${doc.filename} entfernen`"
                :disabled="busy"
                @click="removeBeleg(doc)"
              >
                <font-awesome-icon :icon="['fas', 'xmark']" />
              </AppIconButton>
            </li>
          </ul>
        </div>

        <div class="notice-box rk-notice-box" role="note">
          <div class="rk-notice-box__title">
            <font-awesome-icon :icon="['fas', 'circle-info']" />
            <strong>Hinweis zur Einreichung</strong>
          </div>
          <p class="rk-notice-box__text">
            Bitte achte darauf, dass Preis und Reisedatum auf dem Ticket gut lesbar sind. Die Auszahlung erfolgt nach Prüfung durch das Büro.
          </p>
        </div>

        <div class="rk-grid">
          <label class="rk-field">
            <span class="rk-field__label">Gesamtbetrag der Tickets (€) *</span>
            <AppTextInput
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
      <section v-else-if="form.category === 'privatpkw'" class="rk-section">
        <div class="rk-section__heading">
          <h2>3. Fahrt mit eigenem PKW</h2>
        </div>

        <div class="rk-grid">
          <label class="rk-field rk-field--full">
            <span class="rk-field__label">Kennzeichen (Pflichtfeld) *</span>
            <AppTextInput
              v-model.trim="form.nummernschild"
              placeholder="z. B. HH-XY 987"
              required
            />
          </label>

          <label class="rk-field">
            <span class="rk-field__label">Start / Treffpunkt (automatisch gezogen)</span>
            <AppTextInput v-model.trim="form.start" placeholder="Startadresse / Treffpunkt" required />
          </label>

          <label class="rk-field">
            <span class="rk-field__label">Ziel / Eventlocation (automatisch gezogen)</span>
            <AppTextInput v-model.trim="form.ziel" placeholder="Zieladresse / Eventlocation" required />
          </label>
        </div>

        <div class="rk-sub-block">
          <div class="rk-sub-block__header">
            <span class="rk-field__label">Fahrtstrecke</span>
          </div>
          <div class="rk-chip-row">
            <FilterChip
              :active="!form.isRoundTrip"
              @click="form.isRoundTrip = false"
            >
              Nur einfache Fahrt (Hinfahrt)
            </FilterChip>
            <FilterChip
              :active="form.isRoundTrip"
              @click="form.isRoundTrip = true"
            >
              Hin- und Rückfahrt
            </FilterChip>
          </div>
        </div>

        <div class="rk-grid">
          <label class="rk-field">
            <span class="rk-field__label">Gefahrene Kilometer Gesamt (km) *</span>
            <AppTextInput
              v-model.number="form.kilometer"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="z. B. 42"
              required
            />
          </label>

          <label class="rk-field">
            <span class="rk-field__label">Erstattungsbetrag ({{ kmSatzFormatted }} € / km)</span>
            <AppTextInput :model-value="`${centToStr(computedPkwCent)} €`" disabled class="calculated-output" />
          </label>
        </div>

        <div class="rk-sub-block">
          <div class="rk-sub-block__header">
            <span class="rk-field__label">Optional: Routen-Screenshot / Nachweis anhängen</span>
            <p class="rk-section__copy">
              Optional kannst du einen Screenshot deiner Route oder einen Nachweis als Bild/PDF beifügen.
            </p>
          </div>
          <div v-if="anlagen.length < 2" class="rk-upload-row">
            <AppButton
              variant="outlined"
              size="md"
              :disabled="uploading"
              :loading="uploading"
              @click="belegInput?.click()"
            >
              <font-awesome-icon :icon="['fas', 'upload']" />
              {{ uploading ? 'Wird hochgeladen …' : 'Screenshot / PDF anhängen (optional)' }}
            </AppButton>
            <input
              ref="belegInput"
              type="file"
              accept="image/*,application/pdf"
              hidden
              :disabled="uploading"
              @change="uploadBeleg"
            />
          </div>
          <ul v-if="anlagen.length" class="rk-documents">
            <li v-for="doc in anlagen" :key="doc._id" class="rk-document-row">
              <font-awesome-icon :icon="['fas', doc.contentType && doc.contentType.includes('pdf') ? 'file-pdf' : 'file-image']" class="rk-document-icon" />
              <div class="rk-document-info">
                <strong>{{ doc.filename }}</strong>
                <small>{{ formatFileSize(doc.size) }}</small>
              </div>
              <AppIconButton
                variant="ghost"
                size="sm"
                class="rk-del-btn"
                :label="`${doc.filename} entfernen`"
                :disabled="busy"
                @click="removeBeleg(doc)"
              >
                <font-awesome-icon :icon="['fas', 'xmark']" />
              </AppIconButton>
            </li>
          </ul>
        </div>
      </section>

      <p v-if="error" class="rk-error" role="alert">{{ error }}</p>

      <footer class="rk-footer">
        <p class="rk-footer__note">
          Nach dem Absenden wird deine Abrechnung im Office geprüft und zur Auszahlung freigegeben.
        </p>
        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          :disabled="busy || uploading || !canSubmit"
          :loading="busy"
        >
          <font-awesome-icon :icon="['fas', 'paper-plane']" />
          {{ busy ? 'Wird übermittelt …' : 'Reisekosten einreichen' }}
        </AppButton>
      </footer>
    </form>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faCheck,
  faXmark,
  faUpload,
  faFilePdf,
  faFileImage,
  faCar,
  faGasPump,
  faTrainSubway,
  faCircleInfo,
  faTriangleExclamation,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import darkLogo from '@/assets/SF_000.svg';
import lightLogo from '@/assets/SF_002.png';
import { useTheme } from '@/stores/theme';
import apiPublic from '@/utils/api-public';
import { centToStr, eurToCent, KM_SATZ_PRIVAT_PKW_CENT } from '@/utils/reisekostenCalc';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import LoadingSpinner from '@/components/ui-elements/LoadingSpinner.vue';

library.add(
  faCheck,
  faXmark,
  faUpload,
  faFilePdf,
  faFileImage,
  faCar,
  faGasPump,
  faTrainSubway,
  faCircleInfo,
  faTriangleExclamation,
  faPaperPlane
);

const route = useRoute();
const theme = useTheme();
const logoSrc = computed(() => (theme.isDark ? darkLogo : lightLogo));
const accessToken = String(route.params.accessToken || '');

const state = ref('loading');
const busy = ref(false);
const uploading = ref(false);
const error = ref('');
const anlagen = ref([]);
const belegInput = ref(null);

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
  betragEur: '',
  originalReceiptNoteAccepted: false,
  start: '',
  ziel: '',
  isRoundTrip: true,
  kilometer: '',
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

<style scoped lang="scss">
.public-reisekosten {
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  padding: 20px 16px 48px;
}

.brand-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 780px;
  margin: 0 auto 20px;

  &__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.brand-logo {
  display: block;
  height: 28px;
  width: auto;
}

.brand-subtitle {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
}

.rk-shell {
  max-width: 780px;
  margin: 0 auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.rk-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 26px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));

  &__title-group {
    display: grid;
    gap: 6px;
  }

  h1 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1.25;
  }

  &__sub {
    margin: 0;
    font-size: 0.85rem;
    color: var(--muted);
    line-height: 1.45;
  }

  &__meta {
    display: grid;
    gap: 3px;
    text-align: right;
    flex-shrink: 0;

    strong {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--action-accent-text);
    }

    span {
      font-size: 0.78rem;
      color: var(--muted);
    }
  }
}

.rk-eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--action-accent-text);
}

.rk-section {
  display: grid;
  gap: 18px;
  padding: 22px 26px;
  border-bottom: 1px solid var(--border);

  &:last-of-type {
    border-bottom: 0;
  }

  &--locked {
    background: var(--panel);
    opacity: 0.7;
  }

  &__heading {
    display: grid;
    gap: 6px;

    h2 {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
    }
  }

  &__copy {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
    line-height: 1.45;
  }
}

.rk-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.rk-field {
  display: grid;
  gap: 6px;
  min-width: 0;

  &--full {
    grid-column: 1 / -1;
  }

  &__label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.35;
  }
}

.rk-category-chips {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.rk-category-chip {
  justify-content: flex-start;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 8px;
  text-align: left;
  height: 100%;

  svg {
    margin-top: 2px;
    font-size: 1rem;
    color: var(--action-accent-text);
    flex-shrink: 0;
  }

  &__text {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  &__title {
    font-size: 0.86rem;
    font-weight: 700;
    line-height: 1.25;
  }

  &__sub {
    font-size: 0.74rem;
    color: var(--muted);
    font-weight: 400;
    line-height: 1.3;
  }
}

.rk-sub-block {
  display: grid;
  gap: 10px;

  &__header {
    display: grid;
    gap: 4px;
  }
}

.rk-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rk-upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rk-documents {
  display: grid;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.rk-document-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius, 8px);
  background: var(--panel);
}

.rk-document-icon {
  color: var(--action-accent-text);
  font-size: 1rem;
  flex-shrink: 0;
}

.rk-document-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;

  strong {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 0.72rem;
    color: var(--muted);
  }
}

.rk-del-btn {
  --action-ghost-text: var(--status-danger-text);
  --action-accent-text: var(--status-danger-text);
}

.rk-notice-box {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--primary);
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.84rem;
    color: var(--action-accent-text);
  }

  &__text {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text);
    line-height: 1.5;
  }
}

.rk-notice-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-top: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  line-height: 1.4;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin-top: 2px;
    accent-color: var(--primary);
    flex-shrink: 0;
    cursor: pointer;
  }
}

:deep(.calculated-output) {
  font-weight: 700;
  color: var(--action-accent-text) !important;
}

.rk-error {
  margin: 0;
  padding: 12px 26px 0;
  color: var(--status-danger-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.rk-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 26px;
  border-top: 1px solid var(--border);
  background: var(--panel);

  &__note {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
    line-height: 1.4;
  }
}

.rk-state-panel {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 48px 28px;
  text-align: center;

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
  }

  p {
    margin: 0;
    max-width: 480px;
    font-size: 0.88rem;
    color: var(--muted);
    line-height: 1.5;
  }
}

.rk-state-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  margin-bottom: 4px;

  &--success {
    background: color-mix(in srgb, var(--status-success-text) 16%, transparent);
    color: var(--status-success-text);
  }

  &--muted {
    background: color-mix(in srgb, var(--primary) 16%, transparent);
    color: var(--action-accent-text);
  }
}

.rk-success-note {
  margin-top: 6px !important;
  padding: 10px 14px;
  border: 1px solid var(--primary);
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary) 8%, var(--surface));
  color: var(--text) !important;
  font-size: 0.82rem !important;
}

@media (max-width: 680px) {
  .public-reisekosten {
    padding: 14px 10px 36px;
  }

  .rk-header,
  .rk-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .rk-header__meta {
    text-align: left;
  }

  .rk-category-chips,
  .rk-grid {
    grid-template-columns: 1fr;
  }

  .rk-section,
  .rk-header,
  .rk-footer {
    padding: 18px;
  }
}
</style>
