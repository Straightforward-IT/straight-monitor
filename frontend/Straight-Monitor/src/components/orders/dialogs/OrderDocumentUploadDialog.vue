<template>
  <OrderActionDialog
    :model-value="modelValue"
    title="Dokument hochladen"
    max-width="760px"
    icon="fa-solid fa-upload"
    :saving="uploading"
    :can-submit="!!file"
    submit-label="Hochladen"
    @close="emit('close')"
    @submit="emit('submit')"
  >
    <template #default="{ formId }">
      <p class="order-upload-filename">
        {{ file?.name }}
      </p>
      <div class="order-dialog-field">
        <label
          class="order-dialog-label"
          :for="`${formId}-title`"
        >Bezeichnung (optional)</label>
        <AppTextInput
          :id="`${formId}-title`"
          v-model="titleModel"
          placeholder=" ändert auch den Dateinamen"
        />
      </div>
      <div class="order-dialog-field">
        <AppSegmentedControl
          :model-value="scope"
          label="Bereich"
          size="sm"
          :options="[
            { value: 'public', label: 'Public Monitor' },
            { value: 'monitor', label: 'Monitor' },
          ]"
          @update:model-value="updateScope"
        />
      </div>
      <div
        v-if="scope === 'monitor'"
        class="order-dialog-field"
      >
        <label
          class="order-dialog-label"
          :for="`${formId}-type`"
        >Dokumenttyp</label>
        <select
          :id="`${formId}-type`"
          v-model="typeModel"
          class="order-dialog-native"
        >
          <option value="einsatznachweis">
            Einsatznachweis
          </option>
          <option value="einsatzinformation">
            Einsatzinformation
          </option>
          <option value="ablauf">
            Ablaufplan
          </option>
          <option value="wegbeschreibung">
            Wegbeschreibung
          </option>
          <option value="sicherheit">
            Sicherheitsdokument
          </option>
          <option value="kunde">
            Kundendokument
          </option>
          <option value="sonstiges">
            Sonstiges
          </option>
        </select>
      </div>
      <div
        v-else
        class="order-dialog-field"
      >
      
        <div class="order-recipient-filter">
          <FilterChip
            :active="effectiveRule === 'all'"
            @click="setAllRecipients"
          >
            Alle Mitarbeiter
          </FilterChip>
          <FilterChip
            :active="effectiveRule === 'individual'"
            @click="enableIndividualSelection"
          >
            Individuelle Auswahl
          </FilterChip>
          <FilterChip
            :active="effectiveRule === 'teamleiter'"
            @click="selectTeamleaders"
          >
            Nur Teamleiter
          </FilterChip>
        </div>
        <p class="order-dialog-hint">
          <template v-if="effectiveRule === 'all'">
            Gilt auch für zukünftig eingeplante Mitarbeiter dieses Auftrags.
          </template>
          <template v-else-if="effectiveRule === 'teamleiter'">
            Gilt auch für zukünftig eingeplante Teamleiter dieses Auftrags.
          </template>
          <template v-else>
            Zukünftig geplante Mitarbeiter bleiben ausgeschlossen.
          </template>
        </p>
        <div class="order-recipient-groups">
          <section
            v-for="group in recipientGroups"
            :key="group.id"
            class="order-recipient-group"
          >
            <div class="order-recipient-header">
              <label class="order-recipient-shift">
                <input
                  type="checkbox"
                  :checked="isGroupSelected(group)"
                  :indeterminate.prop="isGroupPartiallySelected(group)"
                  :disabled="uploading || !group.assignments.length"
                  @change="toggleGroup(group, $event.target.checked)"
                >
                <span class="order-recipient-shift__content">
                  <strong>{{ group.label }}</strong>
                  <small>Schicht · {{ group.assignments.length }} Mitarbeiter</small>
                </span>
                <span class="order-recipient-shift__status">{{ selectedCount(group) }}/{{ group.assignments.length }}</span>
              </label>
              <AppIconButton
                variant="ghost"
                size="sm"
                :label="`${group.label} ${collapsedGroups.has(group.id) ? 'ausklappen' : 'einklappen'}`"
                :aria-expanded="!collapsedGroups.has(group.id)"
                :aria-controls="`${formId}-group-${group.id}`"
                @click="toggleCollapsedGroup(group.id)"
              >
                <font-awesome-icon :icon="collapsedGroups.has(group.id) ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down'" />
              </AppIconButton>
            </div>
            <div
              v-show="!collapsedGroups.has(group.id)"
              :id="`${formId}-group-${group.id}`"
            >
              <label
                v-for="assignment in group.assignments"
                :key="assignment.id"
                class="order-recipient-assignment"
              >
                <input
                  type="checkbox"
                  :checked="isAssignmentSelected(assignment)"
                  :disabled="uploading"
                  @change="toggleAssignment(assignment.id, $event.target.checked)"
                >
                <span class="order-recipient-assignment__name">
                  <span
                    class="order-recipient-assignment__text"
                    :title="String(assignment.name)"
                  >{{ assignment.name }}</span>
                  <TlBadge v-if="assignment.isTeamleiter" />
                </span>
                <small v-if="assignment.role">{{ assignment.role }}</small>
              </label>
            </div>
          </section>
        </div>
        <p class="order-recipient-summary">
          {{ recipientSummaryText }}
        </p>
      </div>
      <p
        v-if="error"
        role="alert"
        class="order-upload-error"
      >
        {{ error }}
      </p>
    </template>
  </OrderActionDialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faUpload, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import OrderActionDialog from './OrderActionDialog.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';
import TlBadge from '@/components/ui-elements/TlBadge.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';

library.add(faUpload, faChevronDown, faChevronRight);

const collapsedGroups = ref(new Set());

function toggleCollapsedGroup(id) {
  if (collapsedGroups.value.has(id)) collapsedGroups.value.delete(id);
  else collapsedGroups.value.add(id);
}

const props = defineProps({
  modelValue: { type: Boolean, default: false }, file: { type: Object, default: null },
  uploading: { type: Boolean, default: false }, error: { type: String, default: '' },
  title: { type: String, default: '' }, scope: { type: String, default: 'public' },
  type: { type: String, default: 'einsatznachweis' },
  publicEinsatzIds: { type: Array, default: () => [] },
  publicSchichtIds: { type: Array, default: () => [] },
  publicRecipientFilter: { type: Boolean, default: false },
  publicRecipientRule: { type: String, default: 'all' },
  assignments: { type: Array, default: () => [] },
});
const emit = defineEmits(['close', 'submit', 'update:title', 'update:scope', 'update:type', 'update:publicEinsatzIds', 'update:publicSchichtIds', 'update:publicRecipientFilter', 'update:publicRecipientRule']);
const model = key => computed({ get: () => props[key], set: value => emit(`update:${key}`, value) });
const titleModel = model('title');
const typeModel = model('type');
const localRule = ref(null);

const effectiveRule = computed(() => {
  if (props.publicRecipientRule && props.publicRecipientRule !== 'all') {
    return props.publicRecipientRule;
  }
  if (!props.publicRecipientFilter) return 'all';
  return localRule.value || 'individual';
});

const recipientGroups = computed(() => {
  const groups = new Map();
  props.assignments.forEach(assignment => {
    const schicht = assignment.schicht;
    const id = String(schicht?._id || assignment.idAuftragArbeitsschichten || 'ohne-schicht');
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        label: schicht?.bezeichnung || assignment.schichtBezeichnung || 'Ohne Schichtzuordnung',
        assignments: [],
      });
    }
    const name = [assignment.mitarbeiterData?.vorname, assignment.mitarbeiterData?.nachname].filter(Boolean).join(' ')
      || assignment.personalNr
      || 'Unbekannter Mitarbeiter';
    groups.get(id).assignments.push({
      id: String(assignment._id),
      name,
      role: assignment.berufData?.designation || assignment.bezeichnung || '',
      isTeamleiter: (assignment.mitarbeiterData?.qualifikationen || []).some(qualification => (
        Number(qualification.qualificationKey || qualification) === 50055
      )),
    });
  });
  return [...groups.values()];
});
const recipientCount = computed(() => props.assignments.length);
const allRecipientIds = computed(() => recipientGroups.value.flatMap(group => group.assignments.map(assignment => assignment.id)));
const teamleaderIds = computed(() => recipientGroups.value.flatMap(group => (
  group.assignments.filter(assignment => assignment.isTeamleiter).map(assignment => assignment.id)
)));
const isAssignmentSelected = (assignmentOrId) => {
  const id = typeof assignmentOrId === 'object' ? assignmentOrId.id : assignmentOrId;
  const isTl = typeof assignmentOrId === 'object' ? assignmentOrId.isTeamleiter : teamleaderIds.value.includes(id);
  if (effectiveRule.value === 'all') return true;
  if (effectiveRule.value === 'teamleiter') return Boolean(isTl);
  return props.publicEinsatzIds.includes(id);
};
const selectedCount = group => group.assignments.filter(assignment => isAssignmentSelected(assignment)).length;
const isGroupSelected = group => group.assignments.length > 0 && selectedCount(group) === group.assignments.length;
const isGroupPartiallySelected = group => selectedCount(group) > 0 && selectedCount(group) < group.assignments.length;

const recipientSummaryText = computed(() => {
  if (effectiveRule.value === 'all') {
    return `${recipientCount.value} Mitarbeiter eingeschlossen (inkl. zukünftiger Einplanungen)`;
  }
  if (effectiveRule.value === 'teamleiter') {
    return `${teamleaderIds.value.length} Teamleiter aktuell (gilt auch für zukünftige Teamleiter)`;
  }
  return `${props.publicEinsatzIds.length} Mitarbeiter ausgewählt`;
});

function setRule(rule) {
  localRule.value = rule;
  emit('update:publicRecipientRule', rule);
}

function setRecipients(ids) {
  emit('update:publicEinsatzIds', [...new Set(ids)]);
}

function setAllRecipients() {
  setRule('all');
  emit('update:publicRecipientFilter', false);
  emit('update:publicSchichtIds', []);
  setRecipients([]);
}

function enableIndividualSelection() {
  setRule('individual');
  emit('update:publicRecipientFilter', true);
  emit('update:publicSchichtIds', []);
  setRecipients([]);
}

function selectTeamleaders() {
  setRule('teamleiter');
  emit('update:publicRecipientFilter', true);
  emit('update:publicSchichtIds', []);
  setRecipients(teamleaderIds.value);
}

function updateScope(scope) {
  emit('update:scope', scope);
  if (scope !== 'public') {
    setRule('all');
    emit('update:publicRecipientFilter', false);
    emit('update:publicSchichtIds', []);
    setRecipients([]);
  }
}

function currentSelectedIdsForIndividualTransition() {
  if (effectiveRule.value === 'all') return allRecipientIds.value;
  if (effectiveRule.value === 'teamleiter') return teamleaderIds.value;
  return props.publicEinsatzIds;
}

function toggleAssignment(id, selected) {
  const baseIds = currentSelectedIdsForIndividualTransition();
  setRule('individual');
  emit('update:publicRecipientFilter', true);
  const nextIds = selected ? [...baseIds, id] : baseIds.filter(value => value !== id);
  setRecipients(nextIds);
}

function toggleGroup(group, selected) {
  const groupIds = group.assignments.map(assignment => assignment.id);
  const baseIds = currentSelectedIdsForIndividualTransition();
  setRule('individual');
  emit('update:publicRecipientFilter', true);
  const nextSchichtIds = selected
    ? [...new Set([...props.publicSchichtIds, group.id])]
    : props.publicSchichtIds.filter(id => id !== group.id);
  emit('update:publicSchichtIds', nextSchichtIds);
  setRecipients(selected
    ? [...baseIds, ...groupIds]
    : baseIds.filter(id => !groupIds.includes(id)));
}
</script>

<style scoped>
.order-upload-filename { margin: 0; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--control-radius); background: var(--control-input-bg); color: var(--text); font-size: .8rem; overflow-wrap: anywhere; }
.order-upload-error { margin: 0; color: var(--status-danger-text); font-size: .85rem; }
.order-dialog-hint { display: grid; gap: 3px; margin: 0; color: var(--muted); font-size: .82rem; }
.order-recipient-filter { display: flex; flex-wrap: wrap; gap: 6px; }
.order-recipient-groups { display: flex; flex-direction: column; height: min(265px, 35dvh); min-height: 0; gap: 8px; overflow-x: hidden; overflow-y: scroll; overscroll-behavior: contain; scrollbar-gutter: stable; touch-action: pan-y; }
.order-recipient-group { flex: 0 0 auto; min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: var(--control-radius); background: var(--surface); }
.order-recipient-header { display: flex; align-items: center; padding-right: 6px; background: color-mix(in srgb, var(--primary) 8%, var(--surface)); }
.order-recipient-shift, .order-recipient-assignment { display: flex; align-items: center; gap: 9px; cursor: pointer; }
.order-recipient-shift input, .order-recipient-assignment input { flex: 0 0 auto; width: 18px; height: 18px; margin: 0; accent-color: var(--primary); cursor: pointer; }
.order-recipient-shift input:focus-visible, .order-recipient-assignment input:focus-visible { outline: 2px solid var(--control-focus-ring, var(--primary)); outline-offset: 2px; }
.order-recipient-shift { flex: 1; min-width: 0; padding: 8px 10px; color: var(--text); font-size: .84rem; }
.order-recipient-shift__content { display: flex; align-items: center; min-width: 0; gap: 12px; }
.order-recipient-shift__content strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-recipient-shift__content small { flex: 0 0 auto; color: var(--muted); font-size: .72rem; white-space: nowrap; }
.order-recipient-shift__status { flex: 0 0 auto; margin-left: auto; padding: 2px 6px; border-radius: 999px; background: var(--surface); color: var(--action-accent-text); font-size: .72rem; font-weight: 600; }
.order-recipient-assignment { display: grid; grid-template-columns: 18px minmax(0, 1fr) minmax(0, .9fr); column-gap: 12px; min-height: 38px; box-sizing: border-box; padding: 8px 12px 8px 24px; color: var(--text); font-size: .8rem; }
.order-recipient-assignment + .order-recipient-assignment { border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent); }
.order-recipient-assignment__name { display: flex; align-items: center; min-width: 0; gap: 5px; }
.order-recipient-assignment__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-recipient-assignment__name :deep(.tl-badge) { flex: 0 0 auto; }
.order-recipient-assignment small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: .73rem; }
.order-recipient-summary { margin: 0; color: var(--muted); font-size: .8rem; }
</style>
