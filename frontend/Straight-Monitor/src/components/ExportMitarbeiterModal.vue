<template>
  <ModalFrame
    title="Excel-Liste"
    :subtitle="`${filteredMitarbeiterList.length} Mitarbeiter`"
    size="xl"
    layer="elevated"
    minimizable
    class="export-mitarbeiter-modal"
    @close="emit('close')"
  >
    <div class="export-dialog" @click="columnMenuOpen = false">
      <div v-if="shifts.length" class="shift-filter">
        <span class="shift-filter__label">Schichten</span>
        <div class="shift-filter__chips">
          <FilterChip
            v-for="shift in shifts"
            :key="shift.id"
            :active="selectedShiftIds.has(shift.id)"
            @click="toggleShift(shift.id)"
          >{{ shift.label }}</FilterChip>
        </div>
      </div>

      <section class="preview-panel" aria-label="Excel-Vorschau">
        <div class="preview-scroll">
          <table v-if="selectedKeys.length" class="preview-table">
            <thead>
              <tr>
                <th
                  v-for="key in selectedKeys"
                  :key="key"
                  draggable="true"
                  :class="{
                    'column-header--dragging': draggedColumnKey === key,
                    'column-header--drop-target': dragOverColumnKey === key && draggedColumnKey !== key,
                  }"
                  title="Zum Sortieren ziehen"
                  @dragstart="startColumnDrag(key)"
                  @dragover.prevent="dragOverColumnKey = key"
                  @dragleave="dragOverColumnKey = ''"
                  @drop.prevent="dropColumn(key)"
                  @dragend="endColumnDrag"
                >
                  <span>{{ labelFor(key) }}</span>
                  <button
                    type="button"
                    class="column-remove"
                    :aria-label="`${labelFor(key)} entfernen`"
                    :title="`${labelFor(key)} entfernen`"
                    @click.stop="removeField(key)"
                  >
                    <font-awesome-icon icon="fa-solid fa-xmark" />
                  </button>
                </th>
                <th class="column-add-cell">
                  <button
                    type="button"
                    class="column-add"
                    aria-label="Spalte hinzufügen"
                    title="Spalte hinzufügen"
                    @click.stop="openColumnMenu"
                  >
                    <font-awesome-icon icon="fa-solid fa-plus" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in previewRows" :key="row.__exportKey">
                <td v-for="(key, columnIndex) in selectedKeys" :key="key">
                  <button
                    v-if="columnIndex === 0"
                    type="button"
                    class="row-remove"
                    :aria-label="`${row.__employeeName} aus Export entfernen`"
                    :title="`${row.__employeeName} aus Export entfernen`"
                    @click="removeEmployee(row.__exportKey)"
                  >
                    <font-awesome-icon icon="fa-solid fa-minus" />
                  </button>
                  {{ row[key] }}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          <div v-else class="preview-empty">
            <p>Füge die erste Spalte hinzu.</p>
            <button type="button" class="column-add column-add--empty" @click.stop="openColumnMenu">
              <font-awesome-icon icon="fa-solid fa-plus" />
              Spalte hinzufügen
            </button>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <span class="footer-info">
        <font-awesome-icon icon="fa-solid fa-table-columns" />
        {{ selectedKeys.length }} Spalten · {{ filteredMitarbeiterList.length }} Zeilen
      </span>
      <div class="footer-actions">
        <ToolbarButton variant="secondary" @click="emit('close')">Abbrechen</ToolbarButton>
        <ToolbarButton :disabled="selectedKeys.length === 0" @click="doExport">
          <font-awesome-icon icon="fa-solid fa-download" />
          Excel exportieren
        </ToolbarButton>
      </div>
    </template>
  </ModalFrame>

  <ContextMenu
    v-if="columnMenuOpen"
    :x="columnMenuPosition.x"
    :y="columnMenuPosition.y"
    :width="200"
    :options="columnMenuOptions"
    @close="columnMenuOpen = false"
    @select="addField"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import * as XLSX from 'xlsx';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faDownload, faMinus, faPlus, faTableColumns, faXmark } from '@fortawesome/free-solid-svg-icons';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';

library.add(faDownload, faMinus, faPlus, faTableColumns, faXmark);

const props = defineProps({
  mitarbeiterList: { type: Array, default: () => [] },
  shifts: { type: Array, default: () => [] },
  filename: { type: String, default: '' },
});

const emit = defineEmits(['close']);

const PERSGRUPPE_MAP = { 101: 'Festi (101)', 110: 'KZF (110)', 109: 'Mini (109)', 106: 'Werkst. (106)' };
const ALL_FIELDS = [
  { key: 'vorname', label: 'Vorname', get: ma => ma.vorname || '' },
  { key: 'nachname', label: 'Nachname', get: ma => ma.nachname || '' },
  { key: 'personalnr', label: 'Personalnr.', get: ma => ma.personalnr || '' },
  { key: 'email', label: 'E-Mail', get: ma => ma.email || '' },
  { key: 'telefon', label: 'Telefon', get: ma => ma.telefon || '' },
  { key: 'geburtsdatum', label: 'Geburtsdatum', get: ma => ma.geburtsdatum ? formatDate(ma.geburtsdatum) : '' },
  { key: 'geburtsort', label: 'Geburtsort', get: ma => ma.geburtsort || '' },
  { key: 'einsatzCount', label: 'Einsatzanzahl', get: ma => ma.einsatzCount ?? '' },
  { key: 'konfektionsgroesse', label: 'Konfektionsgröße', get: ma => ma.konfektionsgroesse || '' },
  { key: 'schuhgroesse', label: 'Schuhgröße', get: ma => ma.schuhgroesse || '' },
  { key: 'persgruppe', label: 'Personengruppe', get: ma => ma.persgruppe ? (PERSGRUPPE_MAP[ma.persgruppe] || String(ma.persgruppe)) : '' },
  { key: 'erstellt_von', label: 'Erstellt von', get: ma => ma.erstellt_von || '' },
  { key: 'austrittsdatum', label: 'Austrittsdatum', get: ma => ma.austrittsdatum ? formatDate(ma.austrittsdatum) : '' },
  { key: 'berufe', label: 'Berufe', get: ma => (ma.berufe || []).map(beruf => beruf.designation || beruf).filter(Boolean).join(', ') },
  { key: 'qualifikationen', label: 'Qualifikationen', get: ma => (ma.qualifikationen || []).map(qualifikation => qualifikation.designation || qualifikation).filter(Boolean).join(', ') },
  { key: 'isTeamleiter', label: 'Ist Teamleiter', get: ma => (ma.qualifikationen || []).some(qualifikation => Number(qualifikation.qualificationKey) === 50055) ? 'Ja' : 'Nein' },
  { key: 'asana_id', label: 'Asana ID', get: ma => ma.asana_id || '' },
  { key: 'flip_id', label: 'Flip ID', get: ma => ma.flip_id || '' },
  { key: 'dateCreated', label: 'Erstellt am', get: ma => ma.dateCreated ? formatDate(ma.dateCreated) : (ma.createdAt ? formatDate(ma.createdAt) : '') },
];

const DEFAULT_KEYS = ['vorname', 'nachname', 'personalnr', 'email', 'telefon'];
const selectedKeys = ref([...DEFAULT_KEYS]);
const selectedShiftIds = ref(new Set());
const columnMenuOpen = ref(false);
const columnMenuPosition = ref({ x: 0, y: 0 });
const draggedColumnKey = ref('');
const dragOverColumnKey = ref('');
const excludedEmployeeIds = ref(new Set());

watch(() => props.shifts, shifts => {
  selectedShiftIds.value = new Set((shifts || []).map(shift => shift.id));
}, { immediate: true });

const availableFields = computed(() => ALL_FIELDS.filter(field => !selectedKeys.value.includes(field.key)));
const columnMenuOptions = computed(() => availableFields.value
  .slice()
  .sort((left, right) => left.label.localeCompare(right.label, 'de'))
  .map(field => ({ label: field.label, action: field.key })));
const filteredMitarbeiterList = computed(() => {
  return props.mitarbeiterList.filter(employee => {
    if (excludedEmployeeIds.value.has(employeeKey(employee))) return false;
    return !props.shifts.length || (employee.shiftIds || []).some(shiftId => selectedShiftIds.value.has(shiftId));
  });
});
const previewRows = computed(() => filteredMitarbeiterList.value.map(employee => {
  const row = {
    __exportKey: employeeKey(employee),
    __employeeName: [employee.vorname, employee.nachname].filter(Boolean).join(' ') || 'Mitarbeiter',
  };
  selectedKeys.value.forEach(key => { row[key] = getterFor(key)(employee); });
  return row;
}));

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('de-DE');
}

function toggleShift(shiftId) {
  const next = new Set(selectedShiftIds.value);
  if (next.has(shiftId)) next.delete(shiftId);
  else next.add(shiftId);
  selectedShiftIds.value = next;
}

function addField(key) {
  if (!selectedKeys.value.includes(key)) selectedKeys.value.push(key);
  columnMenuOpen.value = false;
}

function openColumnMenu(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  columnMenuPosition.value = { x: rect.right - 200, y: rect.bottom + 4 };
  columnMenuOpen.value = availableFields.value.length > 0;
}

function removeField(key) {
  selectedKeys.value = selectedKeys.value.filter(selectedKey => selectedKey !== key);
}

function employeeKey(employee) {
  return String(employee._id || `personalnr:${employee.personalnr || ''}`);
}

function removeEmployee(key) {
  const next = new Set(excludedEmployeeIds.value);
  next.add(key);
  excludedEmployeeIds.value = next;
}

function startColumnDrag(key) {
  draggedColumnKey.value = key;
}

function dropColumn(targetKey) {
  const sourceKey = draggedColumnKey.value;
  if (!sourceKey || sourceKey === targetKey) return;
  const next = [...selectedKeys.value];
  const sourceIndex = next.indexOf(sourceKey);
  const targetIndex = next.indexOf(targetKey);
  next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, sourceKey);
  selectedKeys.value = next;
}

function endColumnDrag() {
  draggedColumnKey.value = '';
  dragOverColumnKey.value = '';
}

function labelFor(key) {
  return ALL_FIELDS.find(field => field.key === key)?.label || key;
}

function getterFor(key) {
  return ALL_FIELDS.find(field => field.key === key)?.get || (employee => employee[key] || '');
}

function doExport() {
  const headers = selectedKeys.value.map(labelFor);
  const rows = filteredMitarbeiterList.value.map(employee => selectedKeys.value.map(key => getterFor(key)(employee)));
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = headers.map((header, columnIndex) => ({
    wch: Math.min(60, Math.max(header.length, ...rows.map(row => String(row[columnIndex] || '').length)) + 2),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mitarbeiter');
  const date = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
  XLSX.writeFile(workbook, props.filename || `Mitarbeiter_Export_${date}.xlsx`);
}
</script>

<style scoped lang="scss">
:global(.export-mitarbeiter-modal) {
  --mf-max-width: min(1200px, calc(100vw - 32px));
  --mf-max-height: min(920px, calc(100dvh - 20px));
  --mf-body-padding: 0;
  --mf-body-overflow: hidden;
  --mf-footer-padding: 12px 20px;
  --mf-radius: 10px;
  --mf-border: 1px solid var(--border);
}

.export-dialog, .preview-panel { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.shift-filter { display: flex; align-items: flex-start; gap: 12px; padding: 10px 24px; border-bottom: 1px solid var(--border); background: var(--hover, #f9fafb); }
.shift-filter__label { flex: 0 0 auto; padding-top: 5px; color: var(--muted); font-size: .72rem; font-weight: 600; text-transform: uppercase; }
.shift-filter__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.preview-scroll { flex: 1; min-height: 0; overflow: auto; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.preview-table thead tr { position: sticky; top: 0; z-index: 1; background: var(--hover, #f9fafb); }
.preview-table th { position: relative; padding: 8px 34px 8px 12px; border-bottom: 2px solid var(--border); color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .4px; text-align: left; text-transform: uppercase; white-space: nowrap; }
.preview-table th[draggable="true"] { cursor: grab; }
.preview-table .column-header--dragging { opacity: .45; }
.preview-table .column-header--drop-target { box-shadow: inset 3px 0 var(--primary); }
.preview-table td { max-width: 200px; padding: 7px 12px; overflow: hidden; border-bottom: 1px solid var(--border); color: var(--text); text-overflow: ellipsis; white-space: nowrap; }
.preview-table tbody tr:hover { background: var(--hover, #f5f5f5); }
.preview-table tbody td:first-child { position: relative; padding-left: 42px; }
.row-remove { position: absolute; top: 50%; left: 10px; display: inline-grid; width: 22px; height: 22px; padding: 0; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; opacity: 0; transform: translateY(-50%); }
.preview-table tbody tr:hover .row-remove, .row-remove:focus-visible { opacity: 1; }
.row-remove:hover, .row-remove:focus-visible { background: color-mix(in srgb, #dc3545 12%, transparent); color: #dc3545; }
.column-add-cell { width: 44px; min-width: 44px; padding: 4px !important; text-align: center !important; }
.column-remove, .column-add { display: inline-grid; width: 24px; height: 24px; padding: 0; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--muted); cursor: pointer; }
.column-remove:hover, .column-add:hover { background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }
.column-remove { position: absolute; top: 50%; right: 6px; transform: translateY(-50%); }
.column-add { color: var(--primary); }
.column-add--empty { width: auto; height: auto; gap: 7px; padding: 7px 10px; border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border)); }
.preview-empty { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 120px; color: var(--muted); font-size: 14px; }
.footer-info { display: flex; align-items: center; margin-right: auto; gap: 12px; color: var(--muted); font-size: 13px; }
.footer-actions { display: flex; gap: 10px; }
@media (max-width: 700px) { .shift-filter { padding: 10px 14px; } }
</style>
