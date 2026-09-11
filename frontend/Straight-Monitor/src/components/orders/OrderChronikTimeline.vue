<template>
  <div v-if="isAdmin" class="order-chronik" aria-label="Auftragschronik" :aria-busy="loading">
    <div class="chronik-toolbar">
      <span>Änderungen & Notizen</span>
      <button type="button" :disabled="loading" @click="reload">Aktualisieren</button>
    </div>
    <p v-if="error" class="chronik-error" role="alert">{{ error }}</p>
    <p v-if="loading && !entries.length" role="status">Chronik wird geladen …</p>
    <p v-else-if="!entries.length && !error" class="chronik-empty">Noch keine Einträge. Änderungen werden seit Einführung der Chronik erfasst.</p>

    <ol class="chronik-feed">
      <li v-for="entry in entries" :key="entry._id" class="chronik-entry" :class="{ 'chronik-entry--note': entry.kind === 'note' }">
        <div class="chronik-meta">
          <strong>{{ entry.actor.name }}</strong>
          <time :datetime="entry.createdAt">{{ formatTime(entry.createdAt) }}</time>
          <span>{{ entry.kind === 'note' ? 'Notiz' : 'Änderung' }}</span>
        </div>
        <template v-if="entry.kind === 'note'">
          <p class="chronik-note">{{ entry.text }}</p>
          <button v-if="canDelete(entry)" class="chronik-delete" type="button" :disabled="deletingId === entry._id" @click="deleteNote(entry)">Eigene Notiz löschen</button>
        </template>
        <details v-else>
          <summary>{{ entry.summary }}</summary>
          <div v-for="change in entry.changes" :key="`${change.entity}-${change.entityId}`" class="chronik-change">
            <h4>{{ change.entity }} · {{ change.label }} <small>{{ actionLabel(change.action) }}</small></h4>
            <div class="chronik-table-scroll">
              <table>
                <thead><tr><th>Feld</th><th>Vorher</th><th>Nachher</th></tr></thead>
                <tbody><tr v-for="field in change.fields" :key="field.field">
                  <th scope="row">{{ field.label }}</th>
                  <td><div class="chronik-value">{{ displayValue(field.before, field.beforeLabel) }}</div></td>
                  <td><div class="chronik-value">{{ displayValue(field.after, field.afterLabel) }}</div></td>
                </tr></tbody>
              </table>
            </div>
          </div>
        </details>
      </li>
    </ol>
    <button v-if="nextCursor" class="chronik-more" type="button" :disabled="loading" @click="loadOlder">{{ loading ? 'Lädt …' : 'Ältere Einträge laden' }}</button>

    <form class="chronik-compose" @submit.prevent="addNote">
      <label :for="`order-note-${auftragNr}`">Notiz hinzufügen</label>
      <textarea :id="`order-note-${auftragNr}`" v-model="note" rows="2" maxlength="5000" placeholder="Was soll zu diesem Auftrag festgehalten werden?" :disabled="saving" />
      <div><span>{{ note.length }} / 5000</span><button type="submit" :disabled="saving || !note.trim()">{{ saving ? 'Speichert …' : 'Notiz speichern' }}</button></div>
    </form>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';

const props = defineProps({ auftragNr: { type: [Number, String], required: true }, revision: { type: Number, default: 0 } });
const auth = useAuth();
const entries = ref([]);
const nextCursor = ref(null);
const loading = ref(false);
const error = ref('');
const note = ref('');
const saving = ref(false);
const deletingId = ref(null);
let generation = 0;
let controller;
let mounted = true;
const isAdmin = computed(() => [auth.user?.role, ...(auth.user?.roles || [])].some(role => String(role).toUpperCase() === 'ADMIN'));
const isCurrent = (order, requestGeneration) => mounted && isAdmin.value && String(props.auftragNr) === String(order) && requestGeneration === generation;

async function load(older = false) {
  controller?.abort();
  const requestGeneration = ++generation;
  if (!isAdmin.value) {
    entries.value = []; nextCursor.value = null; note.value = ''; loading.value = false; error.value = '';
    return;
  }
  controller = new AbortController();
  const order = props.auftragNr;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/api/auftraege/${order}/chronik`, {
      params: { limit: 30, ...(older && nextCursor.value ? { cursor: nextCursor.value } : {}) }, signal: controller.signal,
    });
    if (!isCurrent(order, requestGeneration)) return;
    const rows = older ? [...entries.value, ...data.entries] : data.entries;
    entries.value = [...new Map(rows.map(entry => [entry._id, entry])).values()];
    nextCursor.value = data.nextCursor;
  } catch (cause) {
    if (cause.code === 'ERR_CANCELED' || !isCurrent(order, requestGeneration)) return;
    error.value = cause.response?.data?.message || 'Chronik konnte nicht geladen werden. Bitte erneut versuchen.';
    if ([401, 403].includes(cause.response?.status)) { entries.value = []; nextCursor.value = null; }
  } finally { if (isCurrent(order, requestGeneration)) loading.value = false; }
}
function reload() { return load(); }
function loadOlder() { if (!loading.value && nextCursor.value) return load(true); }
function canDelete(entry) { return isAdmin.value && String(entry.actor.id) === String(auth.user?._id || auth.user?.id); }
function formatTime(value) { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function actionLabel(action) { return ({ created: 'angelegt', updated: 'geändert', deleted: 'gelöscht' })[action]; }
function displayValue(raw, label) {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw)) return formatTime(raw);
  return label ?? (raw == null ? '—' : String(raw));
}
async function addNote() {
  if (!isAdmin.value || saving.value || !note.value.trim()) return;
  const order = props.auftragNr;
  saving.value = true;
  error.value = '';
  try {
    await api.post(`/api/auftraege/${order}/chronik/notes`, { text: note.value.trim() });
    if (mounted && String(order) === String(props.auftragNr)) { note.value = ''; await reload(); }
  } catch (cause) {
    if (mounted && String(order) === String(props.auftragNr)) error.value = cause.response?.data?.message || 'Notiz konnte nicht gespeichert werden.';
  } finally { if (mounted && String(order) === String(props.auftragNr)) saving.value = false; }
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
    if (mounted && String(order) === String(props.auftragNr)) error.value = cause.response?.data?.message || 'Notiz konnte nicht gelöscht werden.';
  } finally { if (mounted && String(order) === String(props.auftragNr)) deletingId.value = null; }
}
watch(() => props.auftragNr, () => { entries.value = []; nextCursor.value = null; note.value = ''; saving.value = false; deletingId.value = null; });
watch(() => [props.auftragNr, props.revision, isAdmin.value], reload, { immediate: true });
onBeforeUnmount(() => { mounted = false; generation++; controller?.abort(); });
</script>

<style scoped>
.order-chronik { --text-muted: var(--muted); color: var(--text); font-size: .86rem; }
.chronik-toolbar, .chronik-meta, .chronik-compose > div { display: flex; align-items: center; justify-content: space-between; gap: .65rem; }
.chronik-toolbar { margin-bottom: .9rem; color: var(--text-muted); }
button { border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text); padding: .4rem .65rem; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
button:focus-visible, summary:focus-visible, textarea:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.chronik-feed { list-style: none; margin: 0; padding: 0 0 0 .8rem; border-left: 2px solid var(--border); }
.chronik-entry { position: relative; padding: .8rem; margin: 0 0 .75rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.chronik-entry::before { content: ''; position: absolute; width: 8px; height: 8px; border-radius: 50%; background: var(--primary); left: -1.12rem; top: 1.1rem; }
.chronik-entry--note { background: color-mix(in srgb, var(--primary) 6%, var(--surface)); }
.chronik-meta { flex-wrap: wrap; justify-content: flex-start; color: var(--text-muted); font-size: .75rem; margin-bottom: .55rem; }
.chronik-meta strong { color: var(--text); }
.chronik-meta > span { margin-left: auto; }
summary { cursor: pointer; line-height: 1.5; overflow-wrap: anywhere; }
.chronik-change { margin-top: .8rem; }
h4 { font-size: .82rem; margin: 0 0 .45rem; overflow-wrap: anywhere; }
h4 small { display: inline-block; font-weight: normal; color: var(--text-muted); margin-left: .35rem; }
.chronik-table-scroll { overflow-x: auto; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: .78rem; }
th, td { padding: .5rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
thead th { color: var(--text-muted); font-weight: normal; }
th:first-child { width: 24%; }
.chronik-value { max-height: 12rem; overflow: auto; white-space: pre-wrap; }
.chronik-note { white-space: pre-wrap; overflow-wrap: anywhere; margin: .25rem 0; line-height: 1.5; }
.chronik-delete { margin-top: .6rem; font-size: .75rem; }
.chronik-compose { border-top: 1px solid var(--border); margin-top: 1rem; padding-top: .8rem; display: grid; gap: .5rem; }
.chronik-compose textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 8px; color: var(--text); background: var(--surface); padding: .65rem; font: inherit; resize: vertical; }
.chronik-compose span { color: var(--text-muted); font-size: .75rem; }
.chronik-compose button { border-color: var(--primary); }
.chronik-error { color: #dc2626; }
.chronik-empty { color: var(--text-muted); padding: 1rem 0; line-height: 1.6; }
.chronik-more { display: block; margin: .8rem auto; }
</style>
