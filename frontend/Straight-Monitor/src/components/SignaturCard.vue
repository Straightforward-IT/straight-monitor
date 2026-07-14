<template>
  <div class="sig-card" :class="[`status-${vorgang.status}`, { expanded }]">
    <!-- Collapsed header -->
    <div class="sc-head" @click="toggleExpand">
      <button class="sc-star" :class="{ active: starred }" type="button" :title="starred ? 'Markierung entfernen' : 'Markieren'" @click.stop="$emit('toggle-star', vorgang._id)">
        <font-awesome-icon :icon="[starred ? 'fas' : 'far', 'star']" />
      </button>

      <div class="sc-main">
        <!-- Row 1: name + status -->
        <div class="sc-row1">
          <div class="sc-name">{{ vorgang.name }}</div>
          <span class="sc-status" :class="`badge-${vorgang.status}`">
            <font-awesome-icon :icon="statusIcon" />
            {{ statusLabel }}
          </span>
        </div>
        <!-- Row 2: type · meta pills · progress -->
        <div class="sc-row2">
          <div class="sc-type-pill" :title="typLabel">
            <font-awesome-icon :icon="typIcon" />
            <span>{{ typLabel }}</span>
          </div>
          <span v-if="vorgang.kundenKuerzel" class="sc-pill sc-pill--kunde">{{ vorgang.kundenKuerzel }}</span>
          <span v-if="vorgang.mitarbeiterName" class="sc-pill sc-pill--ma">{{ displayMitarbeiter }}</span>
          <span v-if="vorgang.standort" class="sc-pill sc-pill--standort">{{ standortLabel }}</span>
          <router-link
            v-if="vorgang.auftragNr"
            :to="`/auftraege?auftragNr=${vorgang.auftragNr}`"
            class="sc-pill sc-pill--auftrag"
            :title="`Auftrag ${vorgang.auftragNr} öffnen`"
            @click.stop
          >
            <font-awesome-icon :icon="['fas', 'briefcase']" />
            #{{ vorgang.auftragNr }}
          </router-link>
          <span class="sc-progress-pill" :title="`${signedCount}/${vorgang.submitters.length} unterschrieben`">
            <span class="sc-progress-bar-mini"><span class="sc-progress-fill-mini" :style="{ width: progressPct + '%' }"></span></span>
            {{ signedCount }}/{{ vorgang.submitters.length }}
          </span>
          <span class="sc-date">{{ formatDate(vorgang.createdAt) }}</span>
        </div>
      </div>

      <button class="sc-chevron" type="button">
        <font-awesome-icon :icon="['fas', expanded ? 'chevron-up' : 'chevron-down']" />
      </button>
    </div>

    <!-- Expanded body -->
    <Transition name="sc-expand">
      <div v-if="expanded" class="sc-body">
        <!-- Pending in-app signature banner -->
        <div v-if="activeEmbedSrc" class="sc-sign-banner">
          <font-awesome-icon :icon="['fas', 'pen-to-square']" />
          <span>Deine Unterschrift steht noch aus – nach unten scrollen, um das Dokument zu unterschreiben.</span>
        </div>
        <div class="sc-body-grid">
          <!-- PDF preview -->
          <div class="sc-preview">
            <!-- Inline in-app signing form -->
            <DocusealForm
              v-if="activeEmbedSrc && vorgang.status === 'open'"
              :src="activeEmbedSrc"
              host="cdn.docuseal.eu"
              :with-title="false"
              class="sc-preview-form"
              @complete="onEmbedComplete"
            />
            <div v-else-if="!hasSignedDoc" class="sc-preview-empty">
              <font-awesome-icon :icon="['fas', 'file-circle-question']" size="2x" />
              <p>{{ vorgang.status === 'completed' ? 'Kein Dokument hinterlegt' : 'Noch nicht unterschrieben' }}</p>
            </div>
            <div v-else-if="previewLoading" class="sc-preview-empty">
              <font-awesome-icon :icon="['fas', 'spinner']" spin size="2x" />
              <p>Vorschau laden…</p>
            </div>
            <iframe v-else-if="previewUrl" :src="previewUrl" class="sc-preview-frame" title="PDF-Vorschau"></iframe>
          </div>

          <!-- Details -->
          <div class="sc-details">
            <div class="sc-detail-block">
              <h4>Unterzeichner</h4>
              <div v-for="s in vorgang.submitters" :key="s.slug || s.email || s.role" class="sc-submitter" :class="`sub-${s.status}`">
                <font-awesome-icon :icon="submitterIcon(s.status)" class="sc-sub-icon" />
                <div class="sc-sub-info">
                  <span class="sc-sub-name">{{ s.name || s.email || '—' }}</span>
                  <span class="sc-sub-role">{{ s.role }}</span>
                </div>
                <!-- Embedded in-app signing button -->
                <button
                  v-if="vorgang.status === 'open' && s.embedded && s.embedSrc && s.status !== 'completed'"
                  class="sc-sub-link sc-sub-link--sign"
                  :class="{ active: activeEmbedSrc === s.embedSrc }"
                  type="button"
                  title="In-App signieren"
                  @click="selectEmbedSubmitter(s)"
                >
                  <font-awesome-icon :icon="['fas', 'pen-to-square']" />
                </button>
                <!-- Copy link button for non-embedded submitters -->
                <button
                  v-else-if="vorgang.status === 'open' && s.embedSrc && !s.embedded"
                  class="sc-sub-link"
                  type="button"
                  title="Signatur-Link kopieren"
                  @click="copyText(s.embedSrc, 'Signatur-Link kopiert')"
                >
                  <font-awesome-icon :icon="['fas', 'link']" />
                </button>
              </div>
            </div>

            <div class="sc-detail-block" v-if="vorgang.docusealTemplateName">
              <h4>Vorlage</h4>
              <p class="sc-detail-val">{{ vorgang.docusealTemplateName }}</p>
            </div>

            <!-- Verknüpfungen -->
            <div class="sc-detail-block" v-if="vorgang.auftragNr || vorgang.kundenKuerzel || vorgang.mitarbeiterName || vorgang.graphContact?.displayName">
              <h4>Verknüpfungen</h4>
              <div class="sc-links">
                <router-link
                  v-if="vorgang.auftragNr"
                  :to="`/auftraege?auftragNr=${vorgang.auftragNr}`"
                  class="sc-link-row"
                  @click.stop
                >
                  <font-awesome-icon :icon="['fas', 'briefcase']" class="sc-link-icon" />
                  <span class="sc-link-label">{{ vorgang.auftragTitel || `Auftrag #${vorgang.auftragNr}` }}</span>
                  <span class="sc-link-sub">#{{ vorgang.auftragNr }}</span>
                  <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="sc-link-ext" />
                </router-link>
                <router-link
                  v-if="vorgang.kundenKuerzel"
                  to="/kunden"
                  class="sc-link-row"
                  @click.stop
                >
                  <font-awesome-icon :icon="['fas', 'building']" class="sc-link-icon" />
                  <span class="sc-link-label">{{ vorgang.kundenKuerzel }}</span>
                  <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="sc-link-ext" />
                </router-link>
                <router-link
                  v-if="vorgang.mitarbeiterName"
                  to="/personal"
                  class="sc-link-row"
                  @click.stop
                >
                  <font-awesome-icon :icon="['fas', 'user']" class="sc-link-icon" />
                  <span class="sc-link-label">{{ displayMitarbeiter }}</span>
                  <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="sc-link-ext" />
                </router-link>
                <div v-if="vorgang.graphContact?.displayName" class="sc-link-row sc-link-row--static">
                  <font-awesome-icon :icon="['fas', 'address-card']" class="sc-link-icon" />
                  <span class="sc-link-label">{{ vorgang.graphContact.displayName }}</span>
                  <span class="sc-link-sub" v-if="vorgang.graphContact.email">{{ vorgang.graphContact.email }}</span>
                </div>
              </div>
            </div>

            <!-- Folgeaktionen -->
            <div class="sc-detail-block" v-if="hasFolgeaktionen">
              <h4>Folgeaktionen</h4>
              <div class="sc-links">
                <div
                  v-for="r in vorgang.folgeaktionen.ausliefernAn"
                  :key="r.email"
                  class="sc-link-row sc-link-row--static"
                >
                  <font-awesome-icon :icon="['fas', 'envelope']" class="sc-link-icon" />
                  <span class="sc-link-label">{{ r.displayName || r.email }}</span>
                  <span class="sc-link-sub" v-if="r.displayName && r.email">{{ r.email }}</span>
                </div>
                <div
                  v-for="a in vorgang.folgeaktionen.asanaActions"
                  :key="a.taskGid"
                  class="sc-link-row sc-link-row--static"
                >
                  <font-awesome-icon :icon="['fas', 'list-check']" class="sc-link-icon" />
                  <span class="sc-link-label">{{ a.taskName || a.taskGid }}</span>
                  <span class="sc-link-sub">{{ { complete: 'Abschließen', comment: 'Kommentieren', delete: 'Löschen' }[a.type] }}</span>
                </div>
              </div>
            </div>

            <!-- Zeitstempel -->
            <div class="sc-detail-block">
              <h4>Zeitstempel</h4>
              <div class="sc-timestamps">
                <div class="sc-ts-row">
                  <font-awesome-icon :icon="['fas', 'calendar-days']" class="sc-link-icon" />
                  <span class="sc-ts-label">Erstellt</span>
                  <span class="sc-ts-val">{{ formatDateTime(vorgang.createdAt) }}</span>
                </div>
                <template v-for="s in vorgang.submitters" :key="s.slug || s.email || s.role">
                  <div v-if="s.completedAt" class="sc-ts-row sc-ts-row--signer">
                    <font-awesome-icon :icon="['fas', 'pen-nib']" class="sc-link-icon" />
                    <span class="sc-ts-label">{{ s.name || s.role }}</span>
                    <span class="sc-ts-val">{{ formatDateTime(s.completedAt) }}</span>
                  </div>
                </template>
                <div v-if="vorgang.completedAt" class="sc-ts-row sc-ts-row--done">
                  <font-awesome-icon :icon="['fas', 'circle-check']" class="sc-link-icon" />
                  <span class="sc-ts-label">Abgeschlossen</span>
                  <span class="sc-ts-val">{{ formatDateTime(vorgang.completedAt) }}</span>
                </div>
                <div v-if="vorgang.cancelledAt" class="sc-ts-row sc-ts-row--cancelled">
                  <font-awesome-icon :icon="['fas', 'circle-xmark']" class="sc-link-icon" />
                  <span class="sc-ts-label">Storniert</span>
                  <span class="sc-ts-val">{{ formatDateTime(vorgang.cancelledAt) }}</span>
                </div>
              </div>
            </div>

            <div class="sc-actions">
              <button v-if="vorgang.status === 'draft'" class="sc-action sc-action--edit" type="button" @click="editDraft">
                <font-awesome-icon :icon="['fas', 'pen-nib']" /> Bearbeiten
              </button>
              <button v-if="hasSignedDoc" class="sc-action" type="button" @click="download">
                <font-awesome-icon :icon="['fas', downloading ? 'spinner' : 'download']" :spin="downloading" /> Download
              </button>
              <button v-if="vorgang.r2KeyAudit" class="sc-action" type="button" @click="openAudit">
                <font-awesome-icon :icon="['fas', 'shield-halved']" /> Audit
              </button>
              <button v-if="hasSignedDoc" class="sc-action" type="button" @click="copySignedLink">
                <font-awesome-icon :icon="['fas', 'copy']" /> Link kopieren
              </button>
              <button v-if="vorgang.status === 'open'" class="sc-action" type="button" :disabled="refreshing" @click="refresh">
                <font-awesome-icon :icon="['fas', 'rotate-right']" :spin="refreshing" /> Aktualisieren
              </button>
              <button v-if="vorgang.status !== 'completed' && vorgang.status !== 'cancelled'" class="sc-action sc-action--danger" type="button" @click="cancel">
                <font-awesome-icon :icon="['fas', 'ban']" /> Stornieren
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faStar as fasStar, faChevronUp, faChevronDown, faDownload, faShieldHalved, faCopy, faRotateRight, faBan, faLink, faFileCircleQuestion, faSpinner, faCircleCheck, faClock, faCircleXmark, faHourglassHalf, faPenNib, faFileSignature, faTags, faFileContract, faMoneyBillWave, faPlane, faPenToSquare, faBuilding, faEnvelope, faCalendarDays, faListCheck, faAddressCard, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { faStar as farStar } from '@fortawesome/free-regular-svg-icons';
import { DocusealForm } from '@docuseal/vue';
import api from '@/utils/api';

library.add(fasStar, farStar, faChevronUp, faChevronDown, faDownload, faShieldHalved, faCopy, faRotateRight, faBan, faLink, faFileCircleQuestion, faSpinner, faCircleCheck, faClock, faCircleXmark, faHourglassHalf, faPenNib, faFileSignature, faTags, faFileContract, faMoneyBillWave, faPlane, faPenToSquare, faBuilding, faEnvelope, faCalendarDays, faListCheck, faAddressCard, faArrowUpRightFromSquare);

const props = defineProps({
  vorgang: { type: Object, required: true },
  starred: { type: Boolean, default: false },
});
const emit = defineEmits(['toggle-star', 'cancelled', 'refreshed', 'edit-draft']);

const expanded = ref(false);
const previewUrl = ref('');
const previewLoading = ref(false);
const previewLoaded = ref(false);
const downloading = ref(false);
const refreshing = ref(false);

const standortLabels = { hamburg: 'Hamburg', berlin: 'Berlin', koeln: 'Köln', it: 'IT', hr: 'HR', rs: 'RS' };

const typLabel = computed(() => props.vorgang.typ?.label || props.vorgang.typKey || 'Signatur');
const standortLabel = computed(() => standortLabels[props.vorgang.standort] || props.vorgang.standort);
const displayMitarbeiter = computed(() => (props.vorgang.mitarbeiterName || '').replace(/-/g, ' '));

const signedCount = computed(() => props.vorgang.submitters.filter(s => s.status === 'completed').length);
const progressPct = computed(() => {
  const total = props.vorgang.submitters.length || 1;
  return Math.round((signedCount.value / total) * 100);
});

// True for any completed submission — r2KeySigned may be absent (will be fetched on demand from DocuSeal).
const hasSignedDoc = computed(() => props.vorgang.status === 'completed' && !!props.vorgang.submissionId);

const typIcon = computed(() => ({
  stundenliste: ['fas', 'clock'],
  preisblatt: ['fas', 'tags'],
  auerv: ['fas', 'file-contract'],
  arbeitsvertrag: ['fas', 'file-contract'],
  lohnvorschuss: ['fas', 'money-bill-wave'],
  reisekostenabrechnung: ['fas', 'plane'],
}[props.vorgang.typKey] || ['fas', 'file-signature']));

const statusLabel = computed(() => ({ draft: 'Entwurf', open: 'Offen', completed: 'Abgeschlossen', cancelled: 'Storniert' }[props.vorgang.status] || props.vorgang.status));
const statusIcon = computed(() => ({
  draft: ['fas', 'pen-nib'],
  open: ['fas', 'clock'],
  completed: ['fas', 'circle-check'],
  cancelled: ['fas', 'circle-xmark'],
}[props.vorgang.status] || ['fas', 'clock']));

function submitterIcon(s) {
  return {
    completed: ['fas', 'circle-check'],
    awaiting: ['fas', 'hourglass-half'],
    opened: ['fas', 'pen-nib'],
    declined: ['fas', 'circle-xmark'],
  }[s] || ['fas', 'hourglass-half'];
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const hasFolgeaktionen = computed(() => {
  const f = props.vorgang.folgeaktionen;
  if (!f) return false;
  return (f.ausliefernAn?.length > 0) || (f.asanaActions?.length > 0);
});

function toggleExpand() {
  expanded.value = !expanded.value;
  if (expanded.value) {
    // Auto-open in-app form for first pending embedded submitter
    if (firstPendingEmbedded.value) {
      activeEmbedSrc.value = firstPendingEmbedded.value.embedSrc;
    } else if (hasSignedDoc.value && !previewLoaded.value) {
      loadPreview();
    }
  }
}

async function loadPreview() {
  previewLoading.value = true;
  try {
    const { data } = await api.get(`/api/signaturen/${props.vorgang._id}/signed-url`);
    previewUrl.value = data.url || '';
    previewLoaded.value = true;
  } catch (e) {
    console.error('Vorschau laden fehlgeschlagen', e);
  } finally {
    previewLoading.value = false;
  }
}

async function download() {
  downloading.value = true;
  try {
    const { data } = await api.get(`/api/signaturen/${props.vorgang._id}/signed-url`);
    if (data.url) {
      const a = document.createElement('a');
      a.href = data.url;
      a.download = `${props.vorgang.name.replace(/[^a-z0-9_\- ]/gi, '_')}.pdf`;
      a.target = '_blank';
      a.click();
    }
  } catch (e) {
    console.error('Download fehlgeschlagen', e);
  } finally {
    downloading.value = false;
  }
}

async function openAudit() {
  try {
    const { data } = await api.get(`/api/signaturen/${props.vorgang._id}/audit-url`);
    if (data.url) window.open(data.url, '_blank', 'noopener');
  } catch (e) {
    console.error('Audit öffnen fehlgeschlagen', e);
  }
}

async function copySignedLink() {
  try {
    const { data } = await api.get(`/api/signaturen/${props.vorgang._id}/signed-url`);
    if (data.url) copyText(data.url, 'Dokument-Link kopiert');
  } catch (e) {
    console.error('Link kopieren fehlgeschlagen', e);
  }
}

async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: msg || 'Kopiert', type: 'success' } }));
  } catch (_) { /* ignore */ }
}

async function refresh() {
  refreshing.value = true;
  try {
    const { data } = await api.get(`/api/signaturen/${props.vorgang._id}?refresh=true`);
    emit('refreshed', data);
  } catch (e) {
    console.error('Aktualisieren fehlgeschlagen', e);
  } finally {
    refreshing.value = false;
  }
}

async function cancel() {
  if (!confirm(`„${props.vorgang.name}" stornieren?`)) return;
  try {
    await api.delete(`/api/signaturen/${props.vorgang._id}`);
    emit('cancelled', props.vorgang._id);
  } catch (e) {
    console.error('Stornieren fehlgeschlagen', e);
    alert(e?.response?.data?.message || 'Stornieren fehlgeschlagen.');
  }
}
function editDraft() {
  emit('edit-draft', props.vorgang);
}

// ── In-App Signing (inline preview) ────────────────────────────────────────────────
const activeEmbedSrc = ref('');

// Auto-select the first pending embedded submitter when the card expands
const firstPendingEmbedded = computed(() =>
  props.vorgang.submitters.find(s => s.embedded && s.embedSrc && s.status !== 'completed') || null
);

function selectEmbedSubmitter(submitter) {
  activeEmbedSrc.value = activeEmbedSrc.value === submitter.embedSrc ? '' : submitter.embedSrc;
}

function onEmbedComplete() {
  activeEmbedSrc.value = '';
  refresh();
}</script>

<style scoped lang="scss">
.sig-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--tile-bg, var(--surface));
  overflow: hidden;
  transition: box-shadow 0.15s, border-color 0.15s;

  &:hover { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07); }
  &.expanded { border-color: color-mix(in srgb, var(--primary) 35%, var(--border)); }
  &.status-completed { border-left: 3px solid #10b981; }
  &.status-open { border-left: 3px solid #f59e0b; }
  &.status-draft { border-left: 3px solid var(--muted); }
  &.status-cancelled { border-left: 3px solid #ef4444; opacity: 0.7; }
}

.sc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
}

.sc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

// Row 1: name left, status badge right
.sc-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

// Row 2: type pill + meta pills, single non-wrapping line
.sc-row2 {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
  flex-wrap: nowrap;
}

.sc-star {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.95rem;
  flex-shrink: 0;
  &.active { color: #f59e0b; }
  &:hover { color: #f59e0b; }
}

.sc-type-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  font-size: 0.68rem;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
  span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
}

.sc-main { flex: 1; min-width: 0; }
.sc-name {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sc-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  flex-wrap: wrap;
}
.sc-pill {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
  &--kunde { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
  &--ma { background: color-mix(in srgb, #10b981 16%, transparent); color: #10b981; }
  &--standort { background: var(--hover); color: var(--muted); }
  &--auftrag {
    background: color-mix(in srgb, #6366f1 14%, transparent);
    color: #818cf8;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    &:hover { background: color-mix(in srgb, #6366f1 24%, transparent); }
  }
}
.sc-date { font-size: 0.68rem; color: var(--muted); white-space: nowrap; flex-shrink: 0; }

// Inline progress pill in row 2
.sc-progress-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}
.sc-progress-bar-mini {
  width: 28px;
  height: 3px;
  background: var(--hover);
  border-radius: 2px;
  overflow: hidden;
  display: inline-block;
  vertical-align: middle;
}
.sc-progress-fill-mini {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: width 0.3s;
}

.sc-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
  &.badge-completed { background: color-mix(in srgb, #10b981 16%, transparent); color: #10b981; }
  &.badge-open { background: color-mix(in srgb, #f59e0b 16%, transparent); color: #f59e0b; }
  &.badge-draft { background: var(--hover); color: var(--muted); }
  &.badge-cancelled { background: color-mix(in srgb, #ef4444 14%, transparent); color: #ef4444; }
}

.sc-chevron {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}

/* Body */
.sc-body {
  border-top: 1px solid var(--border);
  padding: 16px;
}
.sc-sign-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: color-mix(in oklab, var(--primary) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
  border-radius: 8px;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--primary);

  svg { flex-shrink: 0; font-size: 0.9rem; }
}
.sc-body-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 16px;
}
@media (max-width: 720px) {
  .sc-body-grid { grid-template-columns: 1fr; }
}

.sc-preview {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  min-height: 280px;
  background: var(--bg, var(--surface));
  display: flex;
}
.sc-preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  font-size: 0.82rem;
}
.sc-preview-frame { width: 100%; height: 100%; min-height: 280px; border: none; }
.sc-preview-form { width: 100%; min-height: 400px; }

.sc-detail-block { margin-bottom: 14px; }
.sc-detail-block h4 {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  font-weight: 700;
  margin: 0 0 8px;
}
.sc-detail-val { font-size: 0.85rem; color: var(--text); }

// ── Linked entities + Folgeaktionen ──────────────────────────────────
.sc-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sc-link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 7px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--primary);
  text-decoration: none;
  transition: background 0.12s;

  &:hover { background: color-mix(in oklab, var(--primary) 8%, transparent); }

  &.sc-link-row--static {
    color: var(--text);
    cursor: default;
    &:hover { background: transparent; }
  }

  .sc-link-icon { font-size: 0.78rem; color: var(--muted); flex-shrink: 0; width: 14px; text-align: center; }
  .sc-link-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-link-sub { font-size: 0.72rem; color: var(--muted); white-space: nowrap; }
  .sc-link-ext { font-size: 0.65rem; color: var(--muted); flex-shrink: 0; }
}

// ── Timestamps ────────────────────────────────────────────────────────
.sc-timestamps { display: flex; flex-direction: column; gap: 4px; }

.sc-ts-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8rem;

  .sc-link-icon { font-size: 0.78rem; color: var(--muted); flex-shrink: 0; width: 14px; text-align: center; }
  .sc-ts-label { color: var(--muted); min-width: 100px; flex-shrink: 0; }
  .sc-ts-val { color: var(--text); font-weight: 500; }

  &.sc-ts-row--done .sc-link-icon { color: #10b981; }
  &.sc-ts-row--cancelled .sc-link-icon { color: #ef4444; }
  &.sc-ts-row--signer .sc-link-icon { color: var(--primary); }
  &.sc-ts-row--signer .sc-ts-label { font-style: italic; }
}

.sc-submitter {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  .sc-sub-icon { font-size: 0.85rem; flex-shrink: 0; }
  .sc-sub-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sc-sub-name { font-size: 0.84rem; font-weight: 600; color: var(--text); }
  .sc-sub-role { font-size: 0.72rem; color: var(--muted); }
  .sc-sub-link {
    background: none; border: none; color: var(--muted); cursor: pointer;
    padding: 4px 6px; border-radius: 5px; font-size: 0.85rem;
    &:hover { color: var(--primary); }

    &.sc-sub-link--sign {
      color: var(--primary);
      border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
      background: color-mix(in oklab, var(--primary) 7%, transparent);
      font-size: 0.78rem;
      &:hover, &.active { background: color-mix(in oklab, var(--primary) 14%, transparent); border-color: var(--primary); }
    }
  }
  &.sub-completed .sc-sub-icon { color: #10b981; }
  &.sub-awaiting .sc-sub-icon { color: #f59e0b; }
  &.sub-declined .sc-sub-icon { color: #ef4444; }
}

.sc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.sc-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: var(--hover); border-color: var(--primary); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &--danger:hover { border-color: #ef4444; color: #ef4444; }
  &--edit:hover { border-color: var(--primary); color: var(--primary); }
}

.sc-expand-enter-active, .sc-expand-leave-active { transition: opacity 0.18s; }
.sc-expand-enter-from, .sc-expand-leave-to { opacity: 0; }
</style>
