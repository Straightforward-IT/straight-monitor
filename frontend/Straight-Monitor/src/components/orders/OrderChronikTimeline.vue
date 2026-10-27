<template>
  <div
    v-if="isAdmin"
    class="order-chronik"
    aria-label="Auftragschronik"
    :aria-busy="loading"
  >
    <div
      ref="scrollAreaRef"
      class="chronik-scroll-area"
    >
      <p
        v-if="error"
        class="chronik-error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="loading && !entries.length"
        class="chronik-status"
        role="status"
      >
        Chronik wird geladen …
      </p>
      <p
        v-else-if="!entries.length && !error"
        class="chronik-empty"
      >
        Noch keine Einträge.
      </p>

      <div
        v-if="nextCursor"
        class="chronik-more-wrap"
      >
        <AppButton
          variant="secondary"
          size="sm"
          class="chronik-more"
          :disabled="loading"
          :loading="loading"
          @click="loadOlder"
        >
          {{ loading ? 'Lädt …' : 'Ältere Einträge laden' }}
        </AppButton>
      </div>

      <ol
        v-if="chronologicalEntries.length"
        class="chronik-feed"
      >
        <li
          v-for="entry in chronologicalEntries"
          :key="entry._id"
          class="chronik-entry"
          :class="{
            'chronik-entry--note': entry.kind === 'note',
            'chronik-entry--zvoove': isZvooveEntry(entry),
          }"
        >
          <div
            class="chronik-dot"
            :class="[
              `chronik-dot--${entryActionMeta(entry).variant}`,
              { 'chronik-dot--zvoove': isZvooveEntry(entry) },
            ]"
          >
            <span v-if="entry.kind === 'note'">{{ initials(cleanActorName(entry)) }}</span>
            <font-awesome-icon
              v-else
              :icon="['fas', 'circle-dot']"
            />
          </div>

          <div class="chronik-content">
            <div class="chronik-meta">
              <strong class="chronik-author">{{ cleanActorName(entry) }}</strong>
              <span
                v-if="isZvooveEntry(entry)"
                class="chronik-zvoove-badge"
                title="Zvoove Import"
              >
                <img
                  :src="zvooveLogo"
                  alt="Zvoove"
                  class="chronik-zvoove-icon"
                >
                <span>Zvoove</span>
              </span>
              <small
                class="chronik-action-pill chronik-action-pill--meta"
                :class="`chronik-action-pill--${entryActionMeta(entry).variant}`"
              >{{ entryActionMeta(entry).label }}</small>
              <time
                class="chronik-time"
                :datetime="entry.createdAt"
              >{{ formatTime(entry.createdAt) }}</time>
            </div>

            <div
              v-if="entry.kind === 'note'"
              class="chronik-note-wrap"
            >
              <p class="chronik-note">
                {{ entry.text }}
              </p>
              <AppIconButton
                v-if="canDelete(entry)"
                variant="ghost"
                size="sm"
                class="chronik-delete"
                label="Eigene Notiz löschen"
                title="Löschen"
                :disabled="deletingId === entry._id"
                @click="deleteNote(entry)"
              >
                <font-awesome-icon :icon="['fas', 'trash']" />
              </AppIconButton>
            </div>

            <details
              v-else
              class="chronik-details"
            >
              <summary class="chronik-summary">
                <span class="chronik-summary__text">{{ cleanSummary(entry) }}</span>
                <span
                  v-if="summaryLinks(entry).length || entryShifts(entry).length || entryAssignments(entry).length > 1"
                  class="chronik-summary__links"
                  @click.stop
                >
                  <template
                    v-for="link in summaryLinks(entry)"
                    :key="link.key"
                  >
                    <button
                      v-if="link.type === 'employee'"
                      type="button"
                      class="chronik-inline-link chronik-inline-link--employee"
                      :title="`Mitarbeiterkarte öffnen: ${link.label}`"
                      @click.stop="openEmployee({ mitarbeiterId: link.mitarbeiterId, personalNr: link.personalNr })"
                    >
                      <font-awesome-icon :icon="['fas', 'user']" />
                      <span>{{ link.label }}</span>
                    </button>
                    <button
                      v-else-if="link.type === 'signatur'"
                      type="button"
                      class="chronik-inline-link chronik-inline-link--signatur"
                      :title="`Dokument öffnen: ${link.label}`"
                      @click.stop="openSignaturPreview(link)"
                    >
                      <font-awesome-icon :icon="['fas', 'file-signature']" />
                      <span>{{ link.shortLabel }}</span>
                    </button>
                  </template>

                  <CustomTooltip
                    v-if="entryShifts(entry).length"
                    position="top"
                    :delay-in="80"
                    :delay-out="120"
                  >
                    <button
                      type="button"
                      class="chronik-hover-btn"
                      @click.stop
                    >
                      <font-awesome-icon :icon="['fas', 'clock']" />
                      <span>Schichten</span>
                      <span class="chronik-hover-btn__count">{{ entryShifts(entry).length }}</span>
                    </button>
                    <template #content>
                      <div class="chronik-tooltip">
                        <div class="chronik-tooltip__heading">
                          <font-awesome-icon :icon="['fas', 'clock']" />
                          <span>Schichten ({{ entryShifts(entry).length }})</span>
                        </div>
                        <div class="chronik-tooltip__chips">
                          <span
                            v-for="shiftChange in entryShifts(entry)"
                            :key="shiftChange.entityId"
                            class="chronik-tooltip__chip"
                            :class="`chronik-tooltip__chip--${shiftChange.action}`"
                          >
                            {{ shiftChange.label }}
                            <template v-if="compactHighlights(shiftChange).length">
                              · {{ compactHighlights(shiftChange).join(' · ') }}
                            </template>
                          </span>
                        </div>
                      </div>
                    </template>
                  </CustomTooltip>

                  <CustomTooltip
                    v-if="entryAssignments(entry).length > 1"
                    position="top"
                    :delay-in="80"
                    :delay-out="140"
                    interactive
                  >
                    <button
                      type="button"
                      class="chronik-hover-btn"
                      @click.stop
                    >
                      <font-awesome-icon :icon="['fas', 'users']" />
                      <span>Einsätze</span>
                      <span class="chronik-hover-btn__count">{{ entryAssignments(entry).length }}</span>
                    </button>
                    <template #content>
                      <div class="chronik-tooltip">
                        <div class="chronik-tooltip__heading">
                          <font-awesome-icon :icon="['fas', 'users']" />
                          <span>Einsätze ({{ entryAssignments(entry).length }})</span>
                        </div>
                        <div class="chronik-tooltip__chips">
                          <button
                            v-for="empChange in entryAssignments(entry)"
                            :key="empChange.entityId"
                            type="button"
                            class="chronik-tooltip__chip chronik-tooltip__chip--interactive"
                            :class="`chronik-tooltip__chip--${empChange.action}`"
                            @click.stop="openEmployeeFromChange(empChange)"
                          >
                            <font-awesome-icon :icon="['fas', 'user']" />
                            <span>{{ empChange.label }}</span>
                          </button>
                        </div>
                      </div>
                    </template>
                  </CustomTooltip>
                </span>
              </summary>
              <div class="chronik-changes-list">
                <div
                  v-for="change in entry.changes"
                  :key="`${change.entity}-${change.entityId}`"
                  class="chronik-change"
                  :class="{ 'chronik-change--compact': change.action !== 'updated' }"
                >
                  <h4 class="chronik-change__title">
                    <span class="chronik-entity-pill">{{ entityDisplayName(change.entity) }}</span>
                    <button
                      v-if="change.entity === 'SignaturVorgang'"
                      type="button"
                      class="chronik-link-btn"
                      :title="`Dokument öffnen: ${change.label}`"
                      @click.stop="openSignaturPreview({ vorgangId: change.signaturVorgangId || change.entityId, label: change.label, typKey: change.typKey })"
                    >
                      <font-awesome-icon :icon="['fas', 'file-signature']" />
                      <span>{{ change.label }}</span>
                    </button>
                    <button
                      v-else-if="changeHasEmployeeLink(change)"
                      type="button"
                      class="chronik-link-btn"
                      :title="`Mitarbeiterkarte öffnen: ${change.label}`"
                      @click.stop="openEmployeeFromChange(change)"
                    >
                      <font-awesome-icon :icon="['fas', 'user']" />
                      <span>{{ change.label }}</span>
                    </button>
                    <span
                      v-else
                      class="chronik-change__label"
                    >{{ change.label }}</span>

                    <template v-if="change.action !== 'updated'">
                      <span
                        v-for="chip in compactHighlights(change)"
                        :key="chip"
                        class="chronik-compact-chip"
                      >{{ chip }}</span>
                    </template>

                    <button
                      v-if="change.entity === 'SignaturVorgang' && (change.signaturVorgangId || change.entityId)"
                      type="button"
                      class="chronik-inline-link chronik-inline-link--subtle"
                      title="In Signaturen-Übersicht öffnen"
                      @click.stop="openInSignaturenPage(change.signaturVorgangId || change.entityId)"
                    >
                      <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                      <span>Vorgang</span>
                    </button>

                    <div class="chronik-change__right">
                      <CustomTooltip
                        v-if="change.action !== 'updated' && meaningfulFields(change).length"
                        position="left"
                        :delay-in="80"
                        :delay-out="140"
                        interactive
                      >
                        <button
                          type="button"
                          class="chronik-hover-btn"
                          @click.stop
                        >
                          <font-awesome-icon :icon="['fas', 'list-ul']" />
                          <span>Details</span>
                          <span class="chronik-hover-btn__count">{{ meaningfulFields(change).length }}</span>
                        </button>
                        <template #content>
                          <div class="chronik-tooltip">
                            <div class="chronik-tooltip__heading">
                              <span>{{ entityDisplayName(change.entity) }} · {{ change.label }}</span>
                              <small
                                class="chronik-action-pill"
                                :class="`chronik-action-pill--${change.action}`"
                              >{{ actionLabel(change.action) }}</small>
                            </div>
                            <div class="chronik-tooltip__rows">
                              <div
                                v-for="field in meaningfulFields(change)"
                                :key="field.field"
                                class="chronik-tooltip__row"
                              >
                                <span class="chronik-tooltip__key">{{ field.label }}</span>
                                <button
                                  v-if="isEmployeeFieldValue(field, change.action === 'deleted' ? 'before' : 'after')"
                                  type="button"
                                  class="chronik-tooltip__link"
                                  @click.stop="openEmployeeFromField(field, change.action === 'deleted' ? 'before' : 'after')"
                                >
                                  <font-awesome-icon :icon="['fas', 'user']" />
                                  <span>{{ singleFieldValue(change, field) }}</span>
                                </button>
                                <span
                                  v-else
                                  class="chronik-tooltip__val"
                                >{{ singleFieldValue(change, field) }}</span>
                              </div>
                            </div>
                          </div>
                        </template>
                      </CustomTooltip>

                      <small
                        class="chronik-action-pill"
                        :class="`chronik-action-pill--${change.action}`"
                      >{{ actionLabel(change.action) }}</small>
                    </div>
                  </h4>

                  <div
                    v-if="change.action === 'updated' && change.fields?.length"
                    class="chronik-table-scroll"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Feld</th>
                          <th>Vorher</th>
                          <th>Nachher</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="field in change.fields"
                          :key="field.field"
                        >
                          <th scope="row">
                            {{ field.label }}
                          </th>
                          <td>
                            <div class="chronik-value">
                              <button
                                v-if="isEmployeeFieldValue(field, 'before')"
                                type="button"
                                class="chronik-link-btn"
                                @click.stop="openEmployeeFromField(field, 'before')"
                              >
                                <font-awesome-icon :icon="['fas', 'user']" />
                                <span>{{ displayValue(field.before, field.beforeLabel) }}</span>
                              </button>
                              <template v-else>
                                {{ displayValue(field.before, field.beforeLabel) }}
                              </template>
                            </div>
                          </td>
                          <td>
                            <div class="chronik-value chronik-value--after">
                              <button
                                v-if="isEmployeeFieldValue(field, 'after')"
                                type="button"
                                class="chronik-link-btn"
                                @click.stop="openEmployeeFromField(field, 'after')"
                              >
                                <font-awesome-icon :icon="['fas', 'user']" />
                                <span>{{ displayValue(field.after, field.afterLabel) }}</span>
                              </button>
                              <template v-else>
                                {{ displayValue(field.after, field.afterLabel) }}
                              </template>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </li>
      </ol>
    </div>

    <form
      class="chronik-compose"
      @submit.prevent="addNote"
    >
      <span class="chronik-compose__avatar">{{ initials(auth.user?.name || auth.user?.email) }}</span>
      <div class="chronik-compose__row">
        <AppTextarea
          :id="`order-note-${auftragNr}`"
          v-model="note"
          class="chronik-compose__textarea"
          rows="1"
          maxlength="5000"
          aria-label="Notiz hinzufügen"
          placeholder="Notiz hinzufügen… (Ctrl+Enter senden)"
          :disabled="saving"
          @keydown.ctrl.enter.prevent="addNote"
          @keydown.meta.enter.prevent="addNote"
        />
        <AppIconButton
          type="submit"
          variant="primary"
          size="sm"
          class="chronik-send-btn"
          label="Notiz senden"
          title="Notiz senden"
          :disabled="saving || !note.trim()"
        >
          <font-awesome-icon
            :icon="['fas', saving ? 'spinner' : 'paper-plane']"
            :spin="saving"
          />
        </AppIconButton>
      </div>
    </form>

    <EmployeeCardModal
      v-if="selectedMitarbeiterId"
      :mitarbeiter-id="selectedMitarbeiterId"
      @close="selectedMitarbeiterId = null"
    />
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowUpRightFromSquare,
  faCircleDot,
  faClock,
  faFileSignature,
  faListUl,
  faPaperPlane,
  faSpinner,
  faTrash,
  faUser,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import { useDataCache } from '@/stores/dataCache';
import { useDocumentPreviewModals } from '@/composables/useDocumentPreviewModals';
import CustomTooltip from '@/components/CustomTooltip.vue';
import EmployeeCardModal from '@/components/Modals/EmployeeCardModal.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTextarea from '@/components/ui-elements/AppTextarea.vue';
import zvooveLogo from '@/assets/Zvoove.webp';

library.add(
  faArrowUpRightFromSquare,
  faCircleDot,
  faClock,
  faFileSignature,
  faListUl,
  faPaperPlane,
  faSpinner,
  faTrash,
  faUser,
  faUsers,
);

const props = defineProps({
  auftragNr: { type: [Number, String], required: true },
  revision: { type: Number, default: 0 },
});
const emit = defineEmits(['count-change', 'loading-change']);
const instance = getCurrentInstance();
const auth = useAuth();
const { openDocumentPreview } = useDocumentPreviewModals();
const scrollAreaRef = ref(null);
const selectedMitarbeiterId = ref(null);
const entries = ref([]);
const chronologicalEntries = computed(() => [...entries.value].reverse());
const nextCursor = ref(null);
const loading = ref(false);
const error = ref('');
const note = ref('');
const saving = ref(false);
const deletingId = ref(null);
let generation = 0;
let controller;
let mounted = true;

const isAdmin = computed(() =>
  [auth.user?.role, ...(auth.user?.roles || [])].some(
    role => String(role).toUpperCase() === 'ADMIN',
  ),
);
const isCurrent = (order, requestGeneration) =>
  mounted &&
  isAdmin.value &&
  String(props.auftragNr) === String(order) &&
  requestGeneration === generation;

function scrollToBottom() {
  nextTick(() => {
    if (scrollAreaRef.value) {
      scrollAreaRef.value.scrollTop = scrollAreaRef.value.scrollHeight;
    }
  });
}

function initials(name) {
  return (
    String(name || '?')
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function isZvooveEntry(entry) {
  if (!entry || entry.kind === 'note') return false;
  if (entry.source === 'zvoove' || entry.actor?.isZvoove) return true;
  if (/Liste 7001|Aufträge-Import|Zvoove/i.test(`${entry.actor?.name || ''} ${entry.summary || ''}`)) {
    return true;
  }
  return Boolean(
    entry.action === 'Auftrag.created' &&
      entry.changes?.some(
        c =>
          c.entity === 'Auftrag' &&
          c.fields?.some(f => f.field === 'source' && f.after === 'zvoove'),
      ),
  );
}

function cleanActorName(entry) {
  const raw = String(entry?.actor?.name || '');
  const stripped = raw
    .replace(/\s*\((?:Liste 7001|Aufträge-Import|Zvoove(?:\s*Import)?)\)\s*$/i, '')
    .trim();
  if (!stripped || /^Zvoove\s*Import$/i.test(stripped)) return 'Zvoove';
  return stripped;
}

function cleanSummary(entry) {
  return String(entry?.summary || '')
    .replace(/\s*\((?:Liste 7001|Aufträge-Import)\)\s*$/i, '')
    .trim();
}

async function load(older = false) {
  controller?.abort();
  const requestGeneration = ++generation;
  if (!isAdmin.value) {
    entries.value = [];
    nextCursor.value = null;
    note.value = '';
    loading.value = false;
    error.value = '';
    return;
  }
  controller = new AbortController();
  const order = props.auftragNr;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/api/auftraege/${order}/chronik`, {
      params: { limit: 30, ...(older && nextCursor.value ? { cursor: nextCursor.value } : {}) },
      signal: controller.signal,
    });
    if (!isCurrent(order, requestGeneration)) return;
    const incoming = Array.isArray(data?.entries) ? data.entries : [];
    const rows = older ? [...entries.value, ...incoming] : incoming;
    entries.value = [...new Map(rows.map(entry => [entry._id, entry])).values()];
    nextCursor.value = data?.nextCursor ?? null;
    if (!older) scrollToBottom();
  } catch (cause) {
    if (cause.code === 'ERR_CANCELED' || !isCurrent(order, requestGeneration)) return;
    error.value =
      cause.response?.data?.message ||
      'Chronik konnte nicht geladen werden. Bitte erneut versuchen.';
    if ([401, 403].includes(cause.response?.status)) {
      entries.value = [];
      nextCursor.value = null;
    }
  } finally {
    if (isCurrent(order, requestGeneration)) loading.value = false;
  }
}

function reload() {
  return load();
}

function loadOlder() {
  if (!loading.value && nextCursor.value) return load(true);
}

function canDelete(entry) {
  return isAdmin.value && String(entry.actor.id) === String(auth.user?._id || auth.user?.id);
}

function formatTime(value) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function actionLabel(action) {
  return ({ created: 'angelegt', updated: 'geändert', deleted: 'gelöscht' })[action];
}

function entryActionMeta(entry) {
  if (!entry || entry.kind === 'note') {
    return { label: 'Notiz', variant: 'note' };
  }
  const action = String(entry.action || '');
  if (action === 'Auftrag.released') {
    return { label: 'Freigegeben', variant: 'created' };
  }
  if (action === 'SignaturVorgang.started') {
    return { label: 'Signatur gestartet', variant: 'created' };
  }
  if (action === 'SignaturVorgang.completed') {
    return { label: 'Abgeschlossen', variant: 'created' };
  }
  if (action === 'SignaturVorgang.cancelled') {
    return { label: 'Storniert', variant: 'deleted' };
  }
  const changes = Array.isArray(entry.changes) ? entry.changes : [];
  if (action.endsWith('.created') || (changes.length && changes.every(c => c.action === 'created'))) {
    return { label: 'Angelegt', variant: 'created' };
  }
  if (action.endsWith('.deleted') || (changes.length && changes.every(c => c.action === 'deleted'))) {
    return { label: 'Gelöscht', variant: 'deleted' };
  }
  return { label: 'Geändert', variant: 'updated' };
}

function singleFieldValue(change, field) {
  if (!field) return '—';
  return change?.action === 'deleted'
    ? displayValue(field.before, field.beforeLabel)
    : displayValue(field.after, field.afterLabel);
}

function meaningfulFields(change) {
  if (!Array.isArray(change?.fields)) return [];
  return change.fields.filter(field => {
    const val = singleFieldValue(change, field);
    return val !== '—' && val !== '' && val !== 'Nein';
  });
}

function compactHighlights(change) {
  if (!change || !Array.isArray(change.fields)) return [];
  const byField = Object.fromEntries(change.fields.map(f => [f.field, singleFieldValue(change, f)]));
  const chips = [];
  if (byField.uhrzeitVon && byField.uhrzeitVon !== '—') {
    chips.push(
      byField.uhrzeitBis && byField.uhrzeitBis !== '—'
        ? `${byField.uhrzeitVon}–${byField.uhrzeitBis}`
        : byField.uhrzeitVon,
    );
  }
  if (change.entity === 'Schicht' && byField.bedarf && byField.bedarf !== '—') {
    chips.push(`Bedarf: ${byField.bedarf}`);
  }
  if (change.entity === 'Auftrag' && byField.eventLocation && byField.eventLocation !== '—') {
    chips.push(byField.eventLocation);
  }
  if (change.entity === 'SignaturVorgang' && byField.status && byField.status !== '—') {
    chips.push(byField.status);
  }
  return chips;
}

function entryShifts(entry) {
  if (!Array.isArray(entry?.changes)) return [];
  return entry.changes.filter(c => c.entity === 'Schicht');
}

function entryAssignments(entry) {
  if (!Array.isArray(entry?.changes)) return [];
  return entry.changes.filter(c => c.entity === 'Einsatz');
}

function entityDisplayName(entity) {
  if (entity === 'SignaturVorgang') return 'Signatur';
  return entity;
}

function extractPersonalNr(text) {
  const match = String(text || '').match(/\(#(\d+)\)/);
  return match ? match[1] : null;
}

function changeHasEmployeeLink(change) {
  if (!change) return false;
  if (change.mitarbeiterId) return true;
  if (change.entity === 'Einsatz' && extractPersonalNr(change.label)) return true;
  return false;
}

function isEmployeeFieldValue(field, side) {
  if (!field || field.field !== 'personalNr') return false;
  const raw = side === 'before' ? field.before : field.after;
  const label = side === 'before' ? field.beforeLabel : field.afterLabel;
  const id = side === 'before' ? field.beforeMitarbeiterId : field.afterMitarbeiterId;
  if (id) return true;
  if (raw != null && raw !== '' && raw !== '—') return true;
  return Boolean(extractPersonalNr(label));
}

function summaryLinks(entry) {
  if (!entry || entry.kind === 'note' || !Array.isArray(entry.changes)) return [];
  const links = [];
  for (const change of entry.changes) {
    if (change.entity === 'SignaturVorgang' && (change.signaturVorgangId || change.entityId)) {
      links.push({
        key: `sig-${change.signaturVorgangId || change.entityId}`,
        type: 'signatur',
        vorgangId: change.signaturVorgangId || change.entityId,
        typKey: change.typKey,
        label: change.label || 'Signatur',
        shortLabel: change.typKey === 'stundenliste' ? 'Stundenliste' : 'Signatur',
      });
    } else if (change.entity === 'Einsatz' && entry.changes.length <= 2 && changeHasEmployeeLink(change)) {
      const empLabel = String(change.label || '').split(' · ')[0] || change.label;
      links.push({
        key: `emp-${change.entityId}`,
        type: 'employee',
        mitarbeiterId: change.mitarbeiterId || null,
        personalNr: extractPersonalNr(change.label),
        label: empLabel,
      });
    }
  }
  return links.slice(0, 2);
}

async function openEmployee({ mitarbeiterId = null, personalNr = null } = {}) {
  if (mitarbeiterId) {
    selectedMitarbeiterId.value = null;
    await nextTick();
    selectedMitarbeiterId.value = String(mitarbeiterId);
    return;
  }
  if (!personalNr) return;
  const pnrStr = String(personalNr).trim();
  try {
    const cache = useDataCache();
    const cached = (cache.mitarbeiter || []).find(
      m =>
        String(m.personalnr) === pnrStr ||
        (m.personalnrHistory || []).some(h => String(h.value) === pnrStr),
    );
    if (cached?._id) {
      selectedMitarbeiterId.value = null;
      await nextTick();
      selectedMitarbeiterId.value = String(cached._id);
      return;
    }
  } catch (_) {
    // Pinia store or cache may be uninitialized
  }
  try {
    const { data } = await api.get('/api/personal/search', { params: { q: pnrStr } });
    const match = (Array.isArray(data) ? data : []).find(
      m => String(m.personalnr) === pnrStr || m._id,
    );
    if (match?._id) {
      selectedMitarbeiterId.value = null;
      await nextTick();
      selectedMitarbeiterId.value = String(match._id);
    }
  } catch (_) {
    // Ignore lookup failure
  }
}

function openEmployeeFromChange(change) {
  return openEmployee({
    mitarbeiterId: change?.mitarbeiterId || null,
    personalNr: extractPersonalNr(change?.label),
  });
}

function openEmployeeFromField(field, side) {
  const mitarbeiterId = side === 'before' ? field?.beforeMitarbeiterId : field?.afterMitarbeiterId;
  const raw = side === 'before' ? field?.before : field?.after;
  const label = side === 'before' ? field?.beforeLabel : field?.afterLabel;
  return openEmployee({
    mitarbeiterId: mitarbeiterId || null,
    personalNr: extractPersonalNr(label) || (raw != null ? String(raw) : null),
  });
}

function openInSignaturenPage(vorgangId) {
  if (!vorgangId) return;
  const router = instance?.appContext?.config?.globalProperties?.$router;
  if (router) {
    router.push({ name: 'SignaturenPage', query: { vorgangId: String(vorgangId) } });
  } else if (typeof window !== 'undefined') {
    window.location.href = `/signaturen?vorgangId=${encodeURIComponent(String(vorgangId))}`;
  }
}

async function openSignaturPreview({ vorgangId, label }) {
  if (!vorgangId) return;
  const filename = `${String(label || 'Signaturdokument').replace(/\.pdf$/i, '')}.pdf`;
  try {
    openDocumentPreview({
      id: `signatur-${vorgangId}`,
      filename,
      mimeType: 'application/pdf',
      resolveUrl: async () => {
        const { data } = await api.get(`/api/signaturen/${vorgangId}/document-url`);
        return data.url;
      },
    });
  } catch (_) {
    openInSignaturenPage(vorgangId);
  }
}

function displayValue(raw, label) {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) {
    return formatTime(raw);
  }
  return label ?? (raw == null ? '—' : String(raw));
}

async function addNote() {
  if (!isAdmin.value || saving.value || !note.value.trim()) return;
  const order = props.auftragNr;
  saving.value = true;
  error.value = '';
  try {
    await api.post(`/api/auftraege/${order}/chronik/notes`, { text: note.value.trim() });
    if (mounted && String(order) === String(props.auftragNr)) {
      note.value = '';
      await reload();
    }
  } catch (cause) {
    if (mounted && String(order) === String(props.auftragNr)) {
      error.value = cause.response?.data?.message || 'Notiz konnte nicht gespeichert werden.';
    }
  } finally {
    if (mounted && String(order) === String(props.auftragNr)) saving.value = false;
  }
}

async function deleteNote(entry) {
  if (!canDelete(entry) || deletingId.value || !window.confirm('Eigene Notiz löschen?')) return;
  const order = props.auftragNr;
  deletingId.value = entry._id;
  error.value = '';
  try {
    await api.delete(`/api/auftraege/${order}/chronik/${entry._id}`);
    if (mounted && String(order) === String(props.auftragNr)) {
      entries.value = entries.value.filter(item => item._id !== entry._id);
      await reload();
    }
  } catch (cause) {
    if (mounted && String(order) === String(props.auftragNr)) {
      error.value = cause.response?.data?.message || 'Notiz konnte nicht gelöscht werden.';
    }
  } finally {
    if (mounted && String(order) === String(props.auftragNr)) deletingId.value = null;
  }
}

watch(
  () => props.auftragNr,
  () => {
    entries.value = [];
    nextCursor.value = null;
    note.value = '';
    saving.value = false;
    deletingId.value = null;
  },
);
watch(entries, list => emit('count-change', list.length), { immediate: true });
watch(loading, val => emit('loading-change', val), { immediate: true });
watch(() => [props.auftragNr, props.revision, isAdmin.value], reload, { immediate: true });
onBeforeUnmount(() => {
  mounted = false;
  generation++;
  controller?.abort();
});
defineExpose({ reload, loading });
</script>

<style scoped lang="scss">
.order-chronik {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  color: var(--text);
  font-size: 0.84rem;
}

.chronik-scroll-area {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
}

.chronik-status,
.chronik-empty {
  margin: 0;
  padding: 20px 8px;
  color: var(--muted);
  text-align: center;
  line-height: 1.5;
}

.chronik-error {
  margin: 0 0 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, #dc2626 35%, var(--border));
  background: color-mix(in srgb, #dc2626 10%, var(--panel));
  color: #dc2626;
  font-size: 0.8rem;
}

.chronik-more-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.chronik-feed {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 4px 0;

  &::before {
    content: '';
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: 11px;
    width: 1px;
    background: var(--border);
  }
}

.chronik-entry {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.chronik-dot {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  margin-top: 2px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--tile-bg);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;

  &--note {
    background: var(--primary);
    color: #fff;
    font-size: 9px;
  }

  &--created {
    color: #10b981;
  }

  &--updated {
    color: #f59e0b;
  }

  &--deleted {
    color: #ef4444;
  }

  &--zvoove {
    color: #2563eb;
  }
}

.chronik-content {
  flex: 1 1 auto;
  min-width: 0;
}

.chronik-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 0.74rem;
}

.chronik-author {
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 600;
}

.chronik-zvoove-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px 1px 4px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #2563eb 32%, var(--border));
  background: color-mix(in srgb, #2563eb 10%, var(--panel));
  color: var(--text);
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.2;
}

.chronik-zvoove-icon {
  width: 13px;
  height: 13px;
  border-radius: 3px;
  object-fit: contain;
  flex-shrink: 0;
}

.chronik-kind-tag {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 600;
}

.chronik-time {
  margin-left: auto;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.chronik-note-wrap {
  position: relative;
  display: block;

  &:hover .chronik-delete,
  &:focus-within .chronik-delete {
    opacity: 1;
  }
}

.chronik-note {
  margin: 0;
  padding: 7px 34px 7px 11px;
  border: 1px solid color-mix(in srgb, var(--primary) 26%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary) 6%, var(--panel));
  color: var(--text);
  font-size: 0.82rem;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chronik-delete {
  --app-button-icon-size: 24px;
  position: absolute;
  top: 50%;
  right: 5px;
  min-height: 24px;
  height: 24px;
  transform: translateY(-50%);
  opacity: 0;
  color: var(--muted);
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;

  &:hover:not(:disabled) {
    color: var(--action-danger, #ef4444);
    background: color-mix(in srgb, #ef4444 12%, transparent);
  }
}

.chronik-details {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  overflow: hidden;
  transition: border-color 0.15s ease;

  &[open] {
    border-color: color-mix(in srgb, var(--primary) 42%, var(--border));
  }
}

.chronik-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.4;
  overflow-wrap: anywhere;
  user-select: none;

  &:hover {
    background: var(--hover);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }
}

.chronik-summary__links {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin-left: auto;
}

.chronik-inline-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  background: color-mix(in srgb, var(--primary) 10%, var(--panel));
  color: var(--primary);
  font: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--primary) 18%, var(--panel));
    border-color: var(--primary);
  }

  &--subtle {
    border-color: var(--border);
    background: var(--panel);
    color: var(--muted);

    &:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
  }
}

.chronik-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;

  svg {
    font-size: 0.72em;
    flex-shrink: 0;
  }

  &:hover {
    text-decoration: underline;
  }
}

.chronik-changes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px 10px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--tile-bg) 55%, var(--panel));
}

.chronik-change--compact {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);

  .chronik-change__title {
    margin: 0;
  }
}

.chronik-change__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  font-size: 0.78rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.chronik-change__right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.chronik-compact-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.chronik-hover-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--panel);
  color: var(--text);
  font: inherit;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;

  svg {
    color: var(--primary);
    font-size: 0.68rem;
  }

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, var(--panel));
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 15px;
    height: 14px;
    padding: 0 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary) 16%, transparent);
    color: var(--primary);
    font-size: 0.63rem;
    font-weight: 700;
  }
}

.chronik-tooltip {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 210px;
  max-width: 340px;
  padding: 2px 0;
  white-space: normal;
  text-align: left;

  &__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.72rem;
    font-weight: 700;
    color: #111827;

    svg {
      color: var(--primary, #5abfeb);
      font-size: 0.7rem;
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 5px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #111827;
    font: inherit;
    font-size: 0.71rem;
    font-weight: 600;
    line-height: 1.3;

    &--created {
      background: rgba(16, 185, 129, 0.14);
      border-color: rgba(16, 185, 129, 0.4);
      color: #047857;
    }

    &--updated {
      background: rgba(245, 158, 11, 0.14);
      border-color: rgba(245, 158, 11, 0.4);
      color: #b45309;
    }

    &--deleted {
      background: rgba(239, 68, 68, 0.14);
      border-color: rgba(239, 68, 68, 0.4);
      color: #b91c1c;
    }

    &--interactive {
      cursor: pointer;

      &:hover {
        filter: brightness(0.95);
        text-decoration: underline;
      }
    }
  }

  &__rows {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 220px;
    overflow-y: auto;
  }

  &__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.72rem;
    line-height: 1.35;
  }

  &__key {
    color: #6b7280;
    font-weight: 600;
    flex-shrink: 0;
  }

  &__val {
    color: #111827;
    font-weight: 500;
    text-align: right;
    overflow-wrap: anywhere;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--primary, #2563eb);
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.chronik-entity-pill {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hover);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 0.68rem;
  font-weight: 700;
}

.chronik-action-pill {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;

  &--meta {
    margin-left: 0;
  }

  &--note {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--primary);
  }

  &--created {
    background: color-mix(in srgb, #10b981 15%, transparent);
    color: #059669;
  }

  &--updated {
    background: color-mix(in srgb, #f59e0b 15%, transparent);
    color: #d97706;
  }

  &--deleted {
    background: color-mix(in srgb, #ef4444 15%, transparent);
    color: #dc2626;
  }
}

.chronik-table-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
}

table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.75rem;
}

th,
td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}

thead th {
  background: color-mix(in srgb, var(--hover) 65%, var(--panel));
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

th:first-child {
  width: 26%;
  color: var(--muted);
  font-weight: 600;
}

.chronik-value {
  max-height: 10rem;
  overflow: auto;
  white-space: pre-wrap;
  color: var(--muted);

  &--after {
    color: var(--text);
    font-weight: 500;
  }
}

.chronik-compose {
  position: sticky;
  bottom: 0;
  z-index: 3;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 94%, var(--tile-bg));
  backdrop-filter: blur(8px);
}

.chronik-compose__avatar {
  display: inline-flex;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  margin-bottom: 5px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
}

.chronik-compose__row {
  display: flex;
  flex: 1 1 auto;
  align-items: flex-end;
  gap: 6px;
  min-width: 0;
}

.chronik-compose__textarea {
  min-height: 34px;
  max-height: 110px;
  padding: 6px 10px;
  font-size: 0.82rem;
}

.chronik-send-btn {
  --app-button-icon-size: 34px;
  min-height: 34px;
  height: 34px;
  flex-shrink: 0;
}
</style>
