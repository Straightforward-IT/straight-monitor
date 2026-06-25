<template>
  <div class="sig-card" :class="[`status-${vorgang.status}`, { expanded }]">
    <!-- Collapsed header -->
    <div class="sc-head" @click="toggleExpand">
      <button class="sc-star" :class="{ active: starred }" type="button" :title="starred ? 'Markierung entfernen' : 'Markieren'" @click.stop="$emit('toggle-star', vorgang._id)">
        <font-awesome-icon :icon="[starred ? 'fas' : 'far', 'star']" />
      </button>

      <div class="sc-type-pill" :title="typLabel">
        <font-awesome-icon :icon="typIcon" />
        <span>{{ typLabel }}</span>
      </div>

      <div class="sc-main">
        <div class="sc-name">{{ vorgang.name }}</div>
        <div class="sc-meta-row">
          <span v-if="vorgang.kundenKuerzel" class="sc-pill sc-pill--kunde">{{ vorgang.kundenKuerzel }}</span>
          <span v-if="vorgang.mitarbeiterName" class="sc-pill sc-pill--ma">{{ displayMitarbeiter }}</span>
          <span v-if="vorgang.standort" class="sc-pill sc-pill--standort">{{ standortLabel }}</span>
          <span class="sc-date">{{ formatDate(vorgang.createdAt) }}</span>
        </div>
      </div>

      <div class="sc-progress" :title="`${signedCount}/${vorgang.submitters.length} unterschrieben`">
        <span class="sc-progress-text">{{ signedCount }}/{{ vorgang.submitters.length }}</span>
        <div class="sc-progress-bar"><div class="sc-progress-fill" :style="{ width: progressPct + '%' }"></div></div>
      </div>

      <span class="sc-status" :class="`badge-${vorgang.status}`">
        <font-awesome-icon :icon="statusIcon" />
        {{ statusLabel }}
      </span>

      <button class="sc-chevron" type="button">
        <font-awesome-icon :icon="['fas', expanded ? 'chevron-up' : 'chevron-down']" />
      </button>
    </div>

    <!-- Expanded body -->
    <Transition name="sc-expand">
      <div v-if="expanded" class="sc-body">
        <div class="sc-body-grid">
          <!-- PDF preview -->
          <div class="sc-preview">
            <div v-if="!hasSignedDoc" class="sc-preview-empty">
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
                <button
                  v-if="vorgang.status === 'open' && s.embedSrc"
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

            <div class="sc-actions">
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
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faStar as fasStar, faChevronUp, faChevronDown, faDownload, faShieldHalved, faCopy, faRotateRight, faBan, faLink, faFileCircleQuestion, faSpinner, faCircleCheck, faClock, faCircleXmark, faHourglassHalf, faPenNib, faFileSignature, faTags, faFileContract, faMoneyBillWave, faPlane } from '@fortawesome/free-solid-svg-icons';
import { faStar as farStar } from '@fortawesome/free-regular-svg-icons';
import api from '@/utils/api';

library.add(fasStar, farStar, faChevronUp, faChevronDown, faDownload, faShieldHalved, faCopy, faRotateRight, faBan, faLink, faFileCircleQuestion, faSpinner, faCircleCheck, faClock, faCircleXmark, faHourglassHalf, faPenNib, faFileSignature, faTags, faFileContract, faMoneyBillWave, faPlane);

const props = defineProps({
  vorgang: { type: Object, required: true },
  starred: { type: Boolean, default: false },
});
const emit = defineEmits(['toggle-star', 'cancelled', 'refreshed']);

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

const hasSignedDoc = computed(() => props.vorgang.status === 'completed' && !!props.vorgang.r2KeySigned);

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

function toggleExpand() {
  expanded.value = !expanded.value;
  if (expanded.value && hasSignedDoc.value && !previewLoaded.value) loadPreview();
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
</script>

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
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
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
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  font-size: 0.74rem;
  font-weight: 700;
  flex-shrink: 0;
  max-width: 140px;
  span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}

.sc-main { flex: 1; min-width: 0; }
.sc-name {
  font-size: 0.92rem;
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
}
.sc-date { font-size: 0.72rem; color: var(--muted); }

.sc-progress {
  flex-shrink: 0;
  width: 70px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  .sc-progress-text { font-size: 0.68rem; color: var(--muted); font-weight: 600; }
  .sc-progress-bar { width: 100%; height: 4px; background: var(--hover); border-radius: 3px; overflow: hidden; }
  .sc-progress-fill { height: 100%; background: var(--primary); transition: width 0.3s; }
}

.sc-status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
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
    &:hover { color: var(--primary); }
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
}

.sc-expand-enter-active, .sc-expand-leave-active { transition: opacity 0.18s; }
.sc-expand-enter-from, .sc-expand-leave-to { opacity: 0; }
</style>
