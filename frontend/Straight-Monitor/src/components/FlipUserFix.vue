<template>
  <PageLayout title="Quick Flip Fix" width="wide" content-variant="flush">
  <div class="flip-user-fix">
    <!-- Header -->
    <div class="page-header">
      <p class="subtitle">Flip-Benutzer filtern, auswählen und Attribute per Bulk-Update setzen.</p>
    </div>

    <!-- Filter Panel -->
    <div class="card filter-card">
      <div class="card-header">
        <span class="card-title">Filter</span>
        <AppIconButton variant="ghost" size="sm" label="Filter hinzufügen" @click="addFilter">
          <font-awesome-icon icon="fa-solid fa-plus" />
        </AppIconButton>
      </div>

      <div class="filter-list" v-if="filterConditions.length > 0">
        <div class="filter-row" v-for="(cond, i) in filterConditions" :key="i">
          <AppSelect v-model="cond.attribute" class="filter-select" :aria-label="`Attribut für Filter ${i + 1}`">
            <option value="">— Attribut —</option>
            <option
              v-for="def in attributeDefs"
              :key="def.technical_name"
              :value="def.technical_name"
            >{{ def.title }} ({{ def.technical_name }})</option>
          </AppSelect>

          <AppSelect v-model="cond.operator" class="op-select" :aria-label="`Operator für Filter ${i + 1}`">
            <option value="eq">= (gleich)</option>
            <option value="neq">≠ (ungleich)</option>
            <option value="contains">enthält</option>
            <option value="empty">ist leer</option>
          </AppSelect>

          <AppTextInput
            v-if="cond.operator !== 'empty'"
            v-model="cond.value"
            class="filter-value"
            :aria-label="`Wert für Filter ${i + 1}`"
            placeholder="Wert…"
            @keyup.enter="triggerLoad"
          />

          <AppIconButton variant="ghost" size="sm" class="filter-remove" :label="`Filter ${i + 1} entfernen`" @click="removeFilter(i)">
            <font-awesome-icon icon="fa-solid fa-times" />
          </AppIconButton>
        </div>
      </div>
      <p v-else class="hint">Kein Filter → alle aktiven Flip-Benutzer werden geladen.</p>

      <div class="card-footer">
        <div class="status-filter-group">
          <span class="label-small">Status:</span>
          <AppToggleChip
            v-for="s in statusOptions"
            :key="s"
            :label="s"
            :accessible-label="`Status ${s}`"
            :model-value="selectedStatuses.includes(s)"
            :disabled="selectedStatuses.length === 1 && selectedStatuses.includes(s)"
            @update:model-value="toggleStatus(s)"
          />
        </div>
        <AppButton :loading="usersLoading" @click="triggerLoad">
          <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
          {{ usersLoading ? 'Lädt…' : 'Benutzer laden' }}
        </AppButton>
      </div>
    </div>

    <!-- Result stats -->
    <div class="stats-bar" v-if="allUsers.length > 0">
      <span>
        <strong>{{ filteredUsers.length }}</strong> von
        <strong>{{ allUsers.length }}</strong> Benutzern angezeigt
      </span>
      <span v-if="selectedIds.size > 0" class="selected-hint">
        <font-awesome-icon icon="fa-solid fa-check-square" />
        {{ selectedIds.size }} ausgewählt
      </span>
      <AppButton v-if="selectedIds.size < filteredUsers.length" variant="ghost" size="sm" @click="selectAll">
        Alle auswählen
      </AppButton>
      <AppButton v-if="selectedIds.size > 0" variant="ghost" size="sm" @click="deselectAll">
        Auswahl aufheben
      </AppButton>
    </div>

    <!-- User Table -->
    <div class="card table-card" v-if="allUsers.length > 0">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="col-check">
                <input
                  type="checkbox"
                  aria-label="Alle angezeigten Benutzer auswählen"
                  :checked="filteredUsers.length > 0 && selectedIds.size === filteredUsers.length"
                  :indeterminate="selectedIds.size > 0 && selectedIds.size < filteredUsers.length"
                  @change="toggleSelectAll"
                />
              </th>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Status</th>
              <th
                v-for="attr in visibleAttributeColumns"
                :key="attr"
                class="col-attr"
              >{{ attr }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              :class="{ selected: selectedIds.has(user.id) }"
              @click="toggleUser(user.id)"
            >
              <td class="col-check" @click.stop>
                <input
                  type="checkbox"
                  :aria-label="`${user.first_name} ${user.last_name} auswählen`"
                  :checked="selectedIds.has(user.id)"
                  @change="toggleUser(user.id)"
                />
              </td>
              <td>{{ user.first_name }} {{ user.last_name }}</td>
              <td class="col-email">{{ user.email }}</td>
              <td>
                <span class="status-badge" :class="user.status.toLowerCase()">{{ user.status }}</span>
              </td>
              <td
                v-for="attr in visibleAttributeColumns"
                :key="attr"
                class="col-attr"
              >
                <span
                  v-if="user.attributes[attr] !== undefined"
                  class="attr-chip"
                  :class="{
                    'true': user.attributes[attr] === 'true',
                    'false': user.attributes[attr] === 'false'
                  }"
                >{{ user.attributes[attr] }}</span>
                <span v-else class="attr-empty">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Bulk Update Panel -->
    <Transition name="slide-up">
      <div class="bulk-panel card" v-if="selectedIds.size > 0">
        <div class="card-header">
          <span class="card-title">
            <font-awesome-icon icon="fa-solid fa-pen-to-square" />
            {{ selectedIds.size }} Benutzer bearbeiten
          </span>
        </div>

        <div class="bulk-row">
          <div class="field-group">
            <label class="field-label">Attribut</label>
            <AppSelect v-model="updateAttribute" class="filter-select" aria-label="Attribut für Bulk-Update">
              <option value="">— Attribut wählen —</option>
              <option
                v-for="def in attributeDefs"
                :key="def.technical_name"
                :value="def.technical_name"
              >{{ def.title }} ({{ def.technical_name }})</option>
            </AppSelect>
          </div>

          <div class="field-group">
            <label class="field-label">Neuer Wert</label>
            <AppTextInput v-model="updateValue" class="filter-value" aria-label="Neuer Attributwert" placeholder="z.B. true / false / Hamburg" />
          </div>

          <AppButton
            class="btn-apply"
            :disabled="!updateAttribute || updateValue === '' || applyLoading"
            :loading="applyLoading"
            @click="confirmApply"
          >
            <font-awesome-icon icon="fa-solid fa-bolt" />
            {{ applyLoading ? 'Wird angewendet…' : 'Anwenden' }}
          </AppButton>
        </div>

        <!-- Result feedback -->
        <div class="bulk-result" v-if="applyResult">
          <span class="result-ok">
            <font-awesome-icon icon="fa-solid fa-circle-check" />
            {{ applyResult.succeeded }} erfolgreich
          </span>
          <span class="result-err" v-if="applyResult.failed > 0">
            <font-awesome-icon icon="fa-solid fa-circle-xmark" />
            {{ applyResult.failed }} fehlgeschlagen
          </span>
          <AppButton v-if="applyResult.failed > 0" variant="ghost" size="sm" :aria-expanded="showResultDetails" @click="showResultDetails = !showResultDetails">
            Details
          </AppButton>
          <div class="result-detail" v-if="showResultDetails">
            <div v-for="r in applyResult.results" :key="r.id">
              <span v-if="!r.success" class="err-row">
                ID {{ r.id }}: {{ r.error }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Confirm Modal -->
    <ModalFrame v-if="confirmVisible" title="Bulk-Update bestätigen" size="sm" @close="confirmVisible = false">
      <div class="confirm-copy">
        <p>
          Attribut <strong>{{ updateAttribute }}</strong> bei
          <strong>{{ selectedIds.size }}</strong> Benutzer(n) auf
          <strong>{{ updateValue }}</strong> setzen?
        </p>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="confirmVisible = false">Abbrechen</AppButton>
        <AppButton @click="applyBulkUpdate">Ja, anwenden</AppButton>
      </template>
    </ModalFrame>
  </div>
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import PageLayout from '@/components/layout/PageLayout.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppToggleChip from '@/components/ui-elements/AppToggleChip.vue';
import api from '@/utils/api';

// ─── State ────────────────────────────────────────────────────────────────────

const attributeDefs = ref([]);
const allUsers = ref([]);
const usersLoading = ref(false);
const applyLoading = ref(false);
const applyResult = ref(null);
const showResultDetails = ref(false);
const confirmVisible = ref(false);

const selectedIds = ref(new Set());

const filterConditions = ref([]);
const selectedStatuses = ref(['ACTIVE']);
const statusOptions = ['ACTIVE', 'LOCKED', 'PENDING_DELETION'];

const updateAttribute = ref('');
const updateValue = ref('');

// ─── Computed ─────────────────────────────────────────────────────────────────

const filteredUsers = computed(() => {
  if (filterConditions.value.length === 0) return allUsers.value;
  return allUsers.value.filter(user =>
    filterConditions.value.every(cond => {
      if (!cond.attribute) return true;
      const attrVal = (user.attributes[cond.attribute] ?? '').toLowerCase();
      const filterVal = (cond.value ?? '').toLowerCase();
      switch (cond.operator) {
        case 'eq':      return attrVal === filterVal;
        case 'neq':     return attrVal !== filterVal;
        case 'contains': return attrVal.includes(filterVal);
        case 'empty':   return attrVal === '' || attrVal === undefined;
        default:        return true;
      }
    })
  );
});

const visibleAttributeColumns = computed(() => {
  // Show attributes from filter conditions + any from update attribute
  const attrs = new Set();
  filterConditions.value.forEach(c => { if (c.attribute) attrs.add(c.attribute); });
  if (updateAttribute.value) attrs.add(updateAttribute.value);
  // Also add commonly interesting ones if data has them
  const interesting = ['isService', 'isLogistik', 'isOffice', 'isTeamLead', 'isFesti', 'location', 'department'];
  if (allUsers.value.length > 0) {
    interesting.forEach(a => {
      if (allUsers.value.some(u => u.attributes[a] !== undefined)) attrs.add(a);
    });
  }
  return [...attrs];
});

// ─── Methods ──────────────────────────────────────────────────────────────────

async function loadAttributeDefs() {
  try {
    const res = await api.get('/api/flip-user-fix/attribute-definitions');
    attributeDefs.value = res.data;
  } catch (e) {
    console.error('Failed to load attribute definitions', e);
  }
}

function addFilter() {
  filterConditions.value.push({ attribute: '', operator: 'eq', value: '' });
}

function removeFilter(i) {
  filterConditions.value.splice(i, 1);
}

function toggleStatus(s) {
  const idx = selectedStatuses.value.indexOf(s);
  if (idx === -1) selectedStatuses.value.push(s);
  else if (selectedStatuses.value.length > 1) selectedStatuses.value.splice(idx, 1);
}

async function triggerLoad() {
  usersLoading.value = true;
  applyResult.value = null;
  selectedIds.value = new Set();
  try {
    const params = { status: selectedStatuses.value.join(',') };
    const res = await api.get('/api/flip-user-fix/users', { params });
    allUsers.value = res.data;
  } catch (e) {
    console.error('Failed to load users', e);
    allUsers.value = [];
  } finally {
    usersLoading.value = false;
  }
}

function toggleUser(id) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function toggleSelectAll(e) {
  if (e.target.checked) selectAll();
  else deselectAll();
}

function selectAll() {
  selectedIds.value = new Set(filteredUsers.value.map(u => u.id));
}

function deselectAll() {
  selectedIds.value = new Set();
}

function confirmApply() {
  applyResult.value = null;
  showResultDetails.value = false;
  confirmVisible.value = true;
}

async function applyBulkUpdate() {
  confirmVisible.value = false;
  applyLoading.value = true;
  applyResult.value = null;
  try {
    const ids = [...selectedIds.value];
    // Split into chunks of 100
    const chunks = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

    let totalSucceeded = 0, totalFailed = 0;
    const allResults = [];

    for (const chunk of chunks) {
      const items = chunk.map(id => ({
        id,
        attributes: { [updateAttribute.value]: updateValue.value },
      }));
      const res = await api.patch('/api/flip-user-fix/users/batch', { items });
      totalSucceeded += res.data.succeeded;
      totalFailed += res.data.failed;
      allResults.push(...(res.data.results || []));
    }

    applyResult.value = { succeeded: totalSucceeded, failed: totalFailed, results: allResults };

    // Refresh local attribute values for successfully updated users
    const successIds = new Set(allResults.filter(r => r.success).map(r => r.id));
    allUsers.value = allUsers.value.map(u => {
      if (!successIds.has(u.id)) return u;
      return {
        ...u,
        attributes: { ...u.attributes, [updateAttribute.value]: updateValue.value },
      };
    });

    deselectAll();
  } catch (e) {
    console.error('Bulk update failed', e);
    applyResult.value = { succeeded: 0, failed: selectedIds.value.size, results: [] };
  } finally {
    applyLoading.value = false;
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(loadAttributeDefs);
</script>

<style scoped lang="scss">
.flip-user-fix {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.subtitle {
  color: var(--muted);
  font-size: 13px;
  margin: 0;
}

/* Cards */
.card {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.card-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid var(--border);
}

/* Filter rows */
.filter-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 18px;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.filter-select {
  flex: 2;
  min-width: 180px;
}
.op-select {
  flex: 1;
  min-width: 130px;
}
.filter-value {
  flex: 2;
  min-width: 140px;
}
.hint {
  padding: 14px 18px;
  font-size: 13px;
  color: var(--muted);
  margin: 0;
}

/* Status chips */
.status-filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.label-small {
  font-size: 12px;
  color: var(--muted);
}

/* Stats bar */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--muted);
  flex-wrap: wrap;
}
.selected-hint {
  color: var(--action-accent-text);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Table */
.table-card { overflow: hidden; }
.table-wrapper {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
thead th {
  padding: 10px 12px;
  text-align: left;
  background: var(--hover);
  color: var(--muted);
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 1;
}
tbody tr {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;

  &:hover { background: var(--hover); }
  &.selected { background: color-mix(in srgb, var(--primary) 8%, transparent); }
}
td {
  padding: 9px 12px;
  color: var(--text);
  vertical-align: middle;
  white-space: nowrap;
}
.col-check { width: 40px; text-align: center; }
.col-email { color: var(--muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.col-attr { text-align: center; }

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  &.active { background: color-mix(in srgb, var(--status-success-text) 12%, transparent); color: var(--status-success-text); }
  &.locked { background: color-mix(in srgb, var(--status-warning-text) 12%, transparent); color: var(--status-warning-text); }
  &.pending_deletion { background: color-mix(in srgb, var(--status-danger-text) 12%, transparent); color: var(--status-danger-text); }
}

.attr-chip {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  border: 1px solid var(--border);
  background: var(--hover);
  &.true { background: color-mix(in srgb, var(--status-success-text) 12%, transparent); color: var(--status-success-text); border-color: transparent; }
  &.false { background: color-mix(in srgb, var(--status-danger-text) 12%, transparent); color: var(--status-danger-text); border-color: transparent; }
}
.attr-empty { color: var(--muted); font-size: 12px; }

/* Bulk Panel */
.bulk-panel {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
.bulk-row {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 16px 18px;
  flex-wrap: wrap;
}
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 180px;
}
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.btn-apply {
  min-width: 150px;
}

/* Bulk Result */
.bulk-result {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  flex-wrap: wrap;
}
.result-ok { color: var(--status-success-text); display: flex; align-items: center; gap: 6px; font-weight: 600; }
.result-err { color: var(--status-danger-text); display: flex; align-items: center; gap: 6px; font-weight: 600; }
.result-detail {
  width: 100%;
  max-height: 120px;
  overflow-y: auto;
  font-size: 12px;
  color: var(--muted);
}
.err-row { display: block; padding: 2px 0; }
.filter-remove:hover:not(:disabled) { color: var(--status-danger-text); }
.confirm-copy p { margin: 0; color: var(--muted); line-height: 1.5; }

/* Transition */
.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.25s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
