<template>
  <PageLayout title="Flip: Austritte" width="standard" content-variant="flush">
    <div class="flip-exit">
      <section class="flip-exit__card" aria-labelledby="flip-exit-upload-title">
        <h2 id="flip-exit-upload-title">Excel-Datei hochladen</h2>
        <p>Die erste Zeile muss die Spalten Personal-Nr, Nachname und Vorname enthalten.</p>
        <div class="flip-exit__columns" aria-label="Erwartete Spalten">
          <span>Personal-Nr</span><span>Nachname</span><span>Vorname</span>
        </div>

        <div
          class="flip-exit__dropzone"
          :class="{ 'flip-exit__dropzone--active': dragging }"
          @dragenter.prevent="dragging = true"
          @dragover.prevent
          @dragleave.prevent="dragging = false"
          @drop.prevent="handleDrop"
        >
          <span>Excel-Datei hier ablegen</span>
          <span class="flip-exit__muted">oder</span>
          <AppButton variant="secondary" :disabled="busy" @click="fileInput?.click()">Datei auswählen</AppButton>
          <input
            ref="fileInput"
            class="flip-exit__file-input"
            type="file"
            accept=".xlsx,.xls"
            aria-label="Excel-Datei für Flip-Austritte auswählen"
            tabindex="-1"
            :disabled="busy"
            @change="handleFileInput"
          >
        </div>

        <p v-if="fileName" class="flip-exit__summary" role="status">
          <strong>{{ fileName }}</strong> · {{ users.length }} {{ users.length === 1 ? 'Person' : 'Personen' }} bereit
        </p>
        <p v-if="error" class="flip-exit__error" role="alert">{{ error }}</p>

        <div class="flip-exit__actions">
          <AppButton variant="danger" :disabled="!users.length || parsing" :loading="submitting" @click="submitUsers">
            {{ users.length === 1 ? '1 Nutzer löschen' : `${users.length} Nutzer löschen` }}
          </AppButton>
        </div>
      </section>

      <section v-if="completed" class="flip-exit__card" aria-live="polite">
        <h2>Verarbeitung abgeschlossen</h2>
        <p>{{ users.length - notFound.length }} von {{ users.length }} Personen verarbeitet.</p>
        <div v-if="notFound.length">
          <h3>Nicht gefundene Nutzer</h3>
          <ul><li v-for="(name, index) in notFound" :key="`${name}-${index}`">{{ name }}</li></ul>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<script setup>
import { ref } from 'vue';
import * as XLSX from 'xlsx';
import PageLayout from '@/components/layout/PageLayout.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import api from '@/utils/api';

const fileInput = ref(null);
const fileName = ref('');
const users = ref([]);
const notFound = ref([]);
const error = ref('');
const completed = ref(false);
const dragging = ref(false);
const parsing = ref(false);
const submitting = ref(false);
const busy = ref(false);

function handleFileInput(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) void readExcel(file);
}

function handleDrop(event) {
  dragging.value = false;
  if (busy.value) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) void readExcel(file);
}

async function readExcel(file) {
  if (busy.value) return;
  fileName.value = '';
  users.value = [];
  notFound.value = [];
  completed.value = false;
  error.value = '';
  if (!/\.xlsx?$/i.test(file.name)) {
    error.value = 'Bitte eine Excel-Datei im Format .xlsx oder .xls auswählen.';
    return;
  }
  parsing.value = true;
  busy.value = true;
  try {
    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) throw new Error('Empty workbook');
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const parsed = rows.slice(1).map(row => ({
      personalnr: row[0] != null ? String(row[0]).trim() : null,
      nachname: row[1],
      vorname: row[2],
    })).filter(person => person.personalnr || (person.vorname && person.nachname));
    if (!parsed.length) {
      error.value = 'Die Datei enthält keine verwendbaren Personendaten.';
      return;
    }
    users.value = parsed;
    fileName.value = file.name;
  } catch (cause) {
    console.error('Excel-Datei konnte nicht gelesen werden:', cause);
    error.value = 'Die Excel-Datei konnte nicht gelesen werden.';
  } finally {
    parsing.value = false;
    busy.value = false;
  }
}

async function submitUsers() {
  if (!users.value.length || busy.value) return;
  if (!window.confirm(`${users.value.length} Flip-Nutzer wirklich löschen?`)) return;
  submitting.value = true;
  busy.value = true;
  error.value = '';
  completed.value = false;
  try {
    const response = await api.post('/api/personal/flip/exit', users.value, {
      headers: { 'Content-Type': 'application/json' },
    });
    notFound.value = response.data.notFound || [];
    completed.value = true;
  } catch (cause) {
    console.error('Fehler beim Löschen der Flip-Nutzer:', cause);
    error.value = 'Die Nutzer konnten nicht verarbeitet werden. Bitte erneut versuchen.';
  } finally {
    submitting.value = false;
    busy.value = false;
  }
}
</script>

<style scoped>
.flip-exit { display: grid; gap: 16px; max-width: 720px; }
.flip-exit__card { padding: 24px; border: 1px solid var(--border); border-radius: 12px; background: var(--tile-bg); color: var(--text); }
.flip-exit__card h2 { margin: 0 0 8px; font-size: 1.15rem; }
.flip-exit__card h3 { margin: 18px 0 8px; font-size: 1rem; }
.flip-exit__card p { margin: 0 0 16px; line-height: 1.5; }
.flip-exit__columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 18px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 0.85rem; }
.flip-exit__columns span { padding: 10px; background: var(--hover); text-align: center; }
.flip-exit__columns span + span { border-left: 1px solid var(--border); }
.flip-exit__dropzone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 150px; padding: 16px; border: 2px dashed var(--border); border-radius: 10px; background: var(--panel); text-align: center; }
.flip-exit__dropzone--active { border-color: var(--primary); background: var(--hover); }
.flip-exit__muted { color: var(--muted); font-size: 0.85rem; }
.flip-exit__file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.flip-exit__summary { margin-top: 16px !important; overflow-wrap: anywhere; }
.flip-exit__error { margin-top: 16px !important; color: var(--status-danger-text); }
.flip-exit__actions { display: flex; justify-content: flex-end; margin-top: 18px; }
.flip-exit__card ul { margin: 0; padding-left: 20px; }
@media (max-width: 600px) {
  .flip-exit__card { padding: 16px; }
  .flip-exit__actions > * { width: 100%; }
}
</style>
