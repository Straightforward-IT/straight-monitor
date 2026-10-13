import { computed, reactive, ref } from 'vue';
import api from '@/utils/api';

const sharedFields = ['bezeichnung', 'bedarf', 'berufSchl', 'qualSchl', 'uhrzeitVon', 'uhrzeitBis', 'endDayOffset', 'treffpunkt', 'treffpunktOrt', 'ansprechpartnerName', 'ansprechpartnerTelefon', 'ansprechpartnerEmail'];
const shiftFields = [...sharedFields, 'datumVon', 'datumBis', 'garantiestundenLohn', 'endeOffen', 'einsatzinformationSourceHtml', 'einsatzinformationCustomized', 'applyLatestTemplate'];
export const scopeField = field => field === 'datumBis' ? 'endDayOffset' : field;
const orderFields = ['eventTitel', 'locationV2', 'kundenNr', 'einsatzort', 'einsatzortOverride', 'bestDatum', 'referenz', 'bestelltext', 'bestelltextOverride', 'day'];
const labels = {
  eventTitel: 'Titel', locationV2: 'Standort', kundenNr: 'Kunde', einsatzort: 'Einsatzort',
  einsatzortOverride: 'Einsatzort nur für diesen Tag', bestDatum: 'Bestelldatum', referenz: 'Referenz',
  bestelltext: 'Bestellung', bestelltextOverride: 'Bestellung nur für diesen Tag', day: 'Startdatum',
  bezeichnung: 'Bezeichnung', bedarf: 'Bedarf', berufSchl: 'Beruf', qualSchl: 'Qualifikation',
  uhrzeitVon: 'Beginn', uhrzeitBis: 'Ende', datumVon: 'Startdatum', datumBis: 'Enddatum',
  treffpunkt: 'Treffpunktzeit', treffpunktOrt: 'Treffpunkt', ansprechpartnerName: 'Ansprechpartner',
  ansprechpartnerTelefon: 'Telefon', ansprechpartnerEmail: 'E-Mail', garantiestundenLohn: 'Garantiestunden',
  endeOffen: 'Ende offen', einsatzinformationSourceHtml: 'Einsatzinformation',
  endDayOffset: 'Endtag-Abstand',
  einsatzinformationCustomized: 'Individuelle Einsatzinformation', applyLatestTemplate: 'Aktuelle Vorlage', overrides: 'Tagesspezifische Felder',
};
const clone = value => JSON.parse(JSON.stringify(value));
const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const identity = value => String(value?._id || value || '');
const newId = () => crypto.randomUUID();
function moveDay(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function dayOffset(from, to) { return Math.round((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000); }
export function editorDay(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(date);
}
export function shiftDto(shift) {
  return Object.fromEntries([
    ...shiftFields.map(field => [field, shift[field]]),
    ['_id', shift._id], ['clientId', shift.clientId], ['groupShiftKey', shift.groupShiftKey],
    ['expectedUpdatedAt', shift._id ? shift.updatedAt : undefined],
    ['overrides', [...(shift.overrides || [])].sort()], ['deleted', Boolean(shift.deleted)], ['dayOnly', Boolean(shift.dayOnly)],
  ].filter(([, value]) => value !== undefined));
}
function normalizeShift(shift, day) {
  return {
    ...shift, clientId: shift.clientId || identity(shift._id) || newId(),
    datumVon: editorDay(shift.datumVon) || day, datumBis: editorDay(shift.datumBis || shift.datumVon) || day,
    berufSchl: String(shift.berufSchl || ''), qualSchl: String(shift.qualSchl || ''), overrides: [...new Set((shift.overrides || []).map(scopeField))],
    endDayOffset: shift.endDayOffset ?? Math.max(0, dayOffset(editorDay(shift.datumVon) || day, editorDay(shift.datumBis || shift.datumVon) || day)),
    einsatzinformationSourceHtml: shift.einsatzinformationSourceHtml ?? shift.einsatzinformation?.sourceHtml ?? '',
    einsatzinformationCustomized: shift.einsatzinformationCustomized ?? Boolean(shift.einsatzinformation?.customized),
    infoPreview: shift.einsatzinformation?.renderedHtml || '', infoUnresolved: shift.einsatzinformation?.unresolvedPlaceholders || [],
  };
}
export function draftDifferences(draft, baseline) {
  const changes = [];
  for (const field of orderFields) {
    if (!same(draft.order[field], baseline.order[field])) changes.push({ key: field, label: labels[field], before: baseline.order[field], after: draft.order[field], kind: 'order' });
  }
  for (const shift of draft.shifts) {
    const before = baseline.shifts.find(item => item.clientId === shift.clientId);
    if (!before) {
      if (!shift.deleted) changes.push({ key: shift.clientId, label: shift.bezeichnung || 'Neue Schicht', before: null, after: 'Schicht hinzufügen', kind: 'shift', shiftId: shift.clientId });
      continue;
    }
    if (shift.deleted) {
      changes.push({ key: shift.clientId, label: shift.bezeichnung, before: 'Schicht mit Einplanungen', after: 'Löschen', kind: 'shift', shiftId: shift.clientId });
      for (const assignment of baseline.assignments || []) {
        if (identity(assignment.schicht) !== identity(shift._id) && !(shift.idAuftragArbeitsschichten != null && assignment.idAuftragArbeitsschichten === shift.idAuftragArbeitsschichten)) continue;
        changes.push({ key: `cascade-${assignment._id}`, label: assignment.mitarbeiterData ? `${assignment.mitarbeiterData.vorname} ${assignment.mitarbeiterData.nachname}` : `Personal ${assignment.personalNr}`, before: shift.bezeichnung, after: 'Einplanung durch Schichtlöschung entfernen', kind: 'planning' });
      }
      continue;
    }
    for (const field of [...shiftFields, 'overrides']) {
      if (!same(shift[field], before[field])) changes.push({ key: `${shift.clientId}-${field}`, label: `${shift.bezeichnung || 'Schicht'} · ${labels[field]}`, before: before[field], after: shift[field], kind: 'shift', shiftId: shift.clientId, field });
    }
  }
  for (const operation of draft.planning) {
    changes.push({ key: operation.clientId, label: operation.employeeName || 'Mitarbeiter', before: operation.type === 'remove' ? 'Eingeplant' : null, after: operation.type === 'remove' ? 'Einplanung entfernen' : 'Einplanen', kind: 'planning' });
  }
  return changes;
}

export function useAuftragEditor({ auftragNr, locationV2 = '', onUpdated = () => {} }) {
  const creating = ref(!auftragNr);
  const drafts = reactive({});
  const baselines = {};
  const activeKey = ref('new');
  const dates = ref([editorDay(new Date())]);
  const activeDay = ref(dates.value[0]);
  const multiDay = ref(false);
  const group = ref(null);
  const members = ref([]);
  const nextCursor = ref(null);
  const loading = ref(false);
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  const progress = ref(null);
  const files = reactive([]);
  const savedSites = reactive([]);
  const submissionId = ref('');
  const clientSubmissionId = ref(newId());
  const sharedEdits = reactive({ order: {}, shifts: {} });
  const creationTemplates = reactive({});
  drafts.new = { order: { eventTitel: '', locationV2, kundenNr: null, einsatzort: '', bestDatum: dates.value[0], referenz: '', bestelltext: '', day: dates.value[0], einsatzortOverride: false, bestelltextOverride: false }, shifts: [], assignments: [], planning: [], customer: null };
  baselines.new = clone(drafts.new);
  const draft = computed(() => drafts[activeKey.value]);
  const order = computed(() => draft.value.order);
  const shifts = computed(() => draft.value.shifts.filter(shift => !shift.deleted));
  const changesByDay = computed(() => Object.entries(drafts).map(([key, value]) => ({
    key, day: value.order.day, auftragNr: value.order.auftragNr, changes: draftDifferences(value, baselines[key]),
  })).filter(item => item.changes.length && (!creating.value || dates.value.includes(item.day))));
  const dirty = computed(() => changesByDay.value.length > 0 || files.some(file => file.status !== 'completed') || creating.value && (dates.value.length > 1 || dates.value[0] !== baselines.new.order.day));
  const pending = computed(() => busy.value || Boolean(submissionId.value) || progress.value?.canResume === false);
  const linked = computed(() => Boolean(group.value) || creating.value && multiDay.value && dates.value.length > 1);
  const validation = computed(() => {
    const messages = [];
    const item = order.value;
    if (!item.eventTitel?.trim()) messages.push('Bitte einen Titel angeben.');
    if (!item.kundenNr) messages.push('Bitte einen Kunden auswählen.');
    if (!item.locationV2) messages.push('Bitte einen Standort auswählen.');
    if (!item.einsatzort) messages.push('Bitte einen Einsatzort auswählen oder als Stammdaten speichern.');
    if (item.einsatzortIssue) messages.push(item.einsatzortIssue.message);
    if (item.groupCustomerMismatch && !item.einsatzortOverride) messages.push('Nach der Kundenkorrektur einen Einsatzort nur für diesen Tag auswählen.');
    if (creating.value && !dates.value.length) messages.push('Bitte mindestens ein Startdatum auswählen.');
    shifts.value.forEach(shift => {
      if (!shift.bezeichnung?.trim()) messages.push('Jede Schicht benötigt eine Bezeichnung.');
      if (!shift.uhrzeitVon || !shift.uhrzeitBis) messages.push(`${shift.bezeichnung || 'Schicht'}: Beginn und Ende angeben.`);
      if (!shift.datumVon || !shift.datumBis) messages.push(`${shift.bezeichnung || 'Schicht'}: Start- und Enddatum angeben.`);
      if (shift.datumBis < shift.datumVon) messages.push(`${shift.bezeichnung}: Enddatum liegt vor dem Start.`);
    });
    if (creating.value && files.some(file => file.status !== 'completed' && file.target === 'order' && !dates.value.includes(drafts[file.dayKey]?.order.day))) messages.push('Eine Anlage gehört zu einem entfernten Tag. Bitte die Anlage entfernen oder den Tag wieder auswählen.');
    return [...new Set(messages)];
  });

  function applyShared(draftValue) {
    for (const [field, value] of Object.entries(sharedEdits.order)) {
      if (!draftValue.order[`${field}Override`]) draftValue.order[field] = value;
    }
    for (const shift of draftValue.shifts) {
      for (const [field, value] of Object.entries(sharedEdits.shifts[shift.groupShiftKey] || {})) {
        if (!shift.overrides.includes(field)) {
          shift[field] = value;
          if (field === 'endDayOffset') shift.datumBis = value == null ? '' : moveDay(shift.datumVon, value);
        }
      }
    }
  }
  async function load(number, cursor, refresh = false) {
    loading.value = true; error.value = '';
    try {
      const { data } = await api.get(`/api/auftraege/editor/context/${number}`, { params: cursor ? { cursor } : {} });
      if (cursor) members.value = [...new Map([...members.value, ...data.members].map(member => [String(member.auftragNr), member])).values()];
      else {
        const row = data.order;
        const key = String(row.auftragNr);
        if (!drafts[key] || refresh) {
          const day = row.day || row.startingDay || editorDay(row.vonDatum);
          const value = {
            order: { ...row, day, eventTitel: row.eventTitel || '', referenz: row.referenz || '', locationV2: identity(row.locationV2), einsatzort: identity(row.einsatzort), bestDatum: editorDay(row.bestDatum), bestelltext: row.bestelltext || '', einsatzortOverride: Boolean(row.einsatzortOverride), bestelltextOverride: Boolean(row.bestelltextOverride) },
            shifts: (row.schichten || []).map(shift => normalizeShift(shift, day)), assignments: row.einsaetze || [], planning: [], customer: row.kundeData || null,
          };
          drafts[key] = value; baselines[key] = clone(value); applyShared(value);
        }
        if (drafts.new && key !== 'new') delete drafts.new;
        activeKey.value = key; activeDay.value = drafts[key].order.day;
        group.value = data.group;
        members.value = [...new Map([...(data.members || []), ...(data.group ? [{ auftragNr: row.auftragNr, day: drafts[key].order.day, eventTitel: row.eventTitel }] : [])].map(member => [String(member.auftragNr), member])).values()];
        creating.value = false;
        if (data.pendingSubmission && !submissionId.value && data.pendingSubmission.ready !== true) {
          if (data.pendingSubmission.canResume === false) {
            progress.value = data.pendingSubmission;
            error.value = 'Der Vorgang eines anderen Bearbeiters ist noch nicht abgeschlossen. Nur der einreichende Benutzer kann ihn fortsetzen.';
          } else if (dirty.value) error.value = 'Für diese Aufträge läuft ein anderer Vorgang. Bitte die eigenen Änderungen prüfen, bevor der gespeicherte Vorgang in einem neu geöffneten Editor fortgesetzt wird.';
          else {
            submissionId.value = data.pendingSubmission.id; progress.value = data.pendingSubmission;
            completedOrders.value = [row];
            files.splice(0, files.length, ...(data.pendingSubmission.attachments || []).map(file => ({
              id: file.clientUploadId, file: null, filename: file.filename, expectedSize: file.size,
              target: file.relationTarget, day: file.day, auftragNr: file.auftragNr, dayKey: String(file.auftragNr || row.auftragNr),
              status: file.uploaded || file.completed ? 'completed' : 'missing', error: file.uploaded || file.completed ? '' : 'Bitte die Originaldatei erneut auswählen.',
            })));
          }
        }
      }
      nextCursor.value = data.nextCursor;
      return true;
    } catch (failure) { error.value = failure.response?.data?.message || failure.message || 'Auftrag konnte nicht geladen werden.'; return false; }
    finally { loading.value = false; }
  }
  function setOrder(field, value) {
    if (field === 'einsatzort' && order.value.groupCustomerMismatch && !order.value.einsatzortOverride) {
      error.value = 'Nach der Importkorrektur den Einsatzort ausdrücklich nur für diesen Tag ändern.'; return;
    }
    order.value[field] = value;
    if (field === 'einsatzort' && value) { order.value.einsatzortIssue = null; order.value.einsatzortValid = true; }
    if (creating.value && !['day', 'bestelltext', 'einsatzort'].includes(field)) {
      Object.values(drafts).forEach(value => { value.order[field] = order.value[field]; });
    }
    if (linked.value && ['einsatzort', 'bestelltext'].includes(field) && !order.value[`${field}Override`]) {
      sharedEdits.order[field] = value;
      Object.values(drafts).forEach(applyShared);
    }
  }
  function toggleOrderOverride(field) {
    const key = `${field}Override`;
    if (field === 'einsatzort' && order.value.groupCustomerMismatch && order.value[key]) {
      error.value = 'Für den korrigierten Kunden ist ein tagesspezifischer Einsatzort erforderlich.'; return;
    }
    if (!order.value[key]) {
      if (!(field in sharedEdits.order)) sharedEdits.order[field] = order.value[field];
      order.value[key] = true;
    } else {
      order.value[key] = false;
      const common = sharedEdits.order[field] ?? group.value?.[field];
      if (common !== undefined) order.value[field] = field === 'einsatzort' ? identity(common) : common;
    }
  }
  function setShift(shift, field, value) {
    shift[field] = value;
    const commonField = scopeField(field);
    const commonValue = field === 'datumBis' ? value ? dayOffset(shift.datumVon, value) : null : value;
    if (field === 'datumBis') shift.endDayOffset = commonValue;
    const template = creationTemplates[shift.groupShiftKey || shift.clientId];
    if (template && !shift.overrides.includes(commonField)) {
      template[commonField] = commonValue;
      if (field === 'datumBis') template.datumBis = value ? moveDay(template.datumVon, commonValue) : '';
    }
    if (linked.value && shift.groupShiftKey && sharedFields.includes(commonField) && !shift.overrides.includes(commonField)) {
      sharedEdits.shifts[shift.groupShiftKey] ||= {};
      sharedEdits.shifts[shift.groupShiftKey][commonField] = commonValue;
      Object.values(drafts).forEach(applyShared);
    }
  }
  function toggleOverride(shift, field) {
    field = scopeField(field);
    if (shift.overrides.includes(field)) {
      shift.overrides = shift.overrides.filter(item => item !== field);
      const common = sharedEdits.shifts[shift.groupShiftKey]?.[field]
        ?? creationTemplates[shift.groupShiftKey || shift.clientId]?.[field]
        ?? group.value?.shifts?.find(item => String(item.groupShiftKey || item._id) === String(shift.groupShiftKey))?.[field]
        ?? baselines[activeKey.value].shifts.find(item => item.clientId === shift.clientId)?.[field];
      if (common !== undefined) {
        shift[field] = common;
        if (field === 'endDayOffset') shift.datumBis = common == null ? '' : moveDay(shift.datumVon, common);
      }
    } else shift.overrides.push(field);
  }
  function selectCreationDay(day) {
    const key = day === drafts.new.order.day ? 'new' : `new:${day}`;
    if (!drafts[key]) {
      const value = clone(drafts.new);
      value.order.day = day;
      value.planning = [];
      value.shifts = Object.values(creationTemplates).map(template => {
        const shift = clone(template); const offset = dayOffset(shift.datumVon, shift.datumBis);
        shift.datumVon = day; shift.datumBis = moveDay(day, offset); shift.overrides = [];
        return shift;
      });
      drafts[key] = value;
      baselines[key] = clone({ ...value, shifts: [], planning: [] });
      applyShared(value);
    }
    activeKey.value = key; activeDay.value = day;
  }
  function addShift(values = {}) {
    const shift = normalizeShift({ bezeichnung: '', uhrzeitVon: '08:00', uhrzeitBis: '16:00', bedarf: 1, garantiestundenLohn: 0, treffpunkt: '', treffpunktOrt: '', ansprechpartnerName: '', ansprechpartnerTelefon: '', ansprechpartnerEmail: '', ...values, _id: undefined, clientId: newId(), groupShiftKey: creating.value && !values.dayOnly ? newId() : undefined }, order.value.day);
    draft.value.shifts.push(shift);
    if (!shift.dayOnly) creationTemplates[shift.groupShiftKey || shift.clientId] = clone(shift);
    if (creating.value && linked.value && !shift.dayOnly) {
      for (const [key, value] of Object.entries(drafts)) {
        if (key === activeKey.value) continue;
        const copy = clone(shift); copy.datumVon = value.order.day;
        copy.datumBis = moveDay(copy.datumVon, dayOffset(shift.datumVon, shift.datumBis));
        value.shifts.push(copy);
      }
    }
    return shift;
  }
  function deleteShift(shift, dayOnly = false) {
    shift.deleted = true; shift.dayOnly = dayOnly;
    if (!dayOnly) {
      delete creationTemplates[shift.groupShiftKey || shift.clientId];
      for (const value of Object.values(drafts)) {
        value.shifts.filter(item => shift.groupShiftKey ? item.groupShiftKey === shift.groupShiftKey : item.clientId === shift.clientId).forEach(item => { item.deleted = true; });
      }
    }
    for (const value of Object.values(drafts)) {
      const deleted = value.shifts.filter(item => item.deleted);
      const assignmentIds = new Set(value.assignments.filter(item => deleted.some(shift => identity(item.schicht) === identity(shift._id) && Boolean(shift._id)
        || shift.idAuftragArbeitsschichten != null && item.idAuftragArbeitsschichten === shift.idAuftragArbeitsschichten)).map(item => String(item._id)));
      value.planning = value.planning.filter(item => item.type === 'assign' ? !deleted.some(shift => shift.clientId === item.clientShiftId) : !assignmentIds.has(item.einsatzId));
    }
  }
  function assignmentsFor(shift) {
    const removed = new Set(draft.value.planning.filter(item => item.type === 'remove').map(item => item.einsatzId));
    return [
      ...draft.value.assignments.filter(item => !removed.has(String(item._id)) && (
        identity(item.schicht) === identity(shift._id) && Boolean(shift._id)
        || shift.idAuftragArbeitsschichten != null && item.idAuftragArbeitsschichten === shift.idAuftragArbeitsschichten
      )),
      ...draft.value.planning.filter(item => item.type === 'assign' && item.clientShiftId === shift.clientId),
    ];
  }
  function stageAssignment(candidate, shift, conflictOverride, includeOtherLocations = false) {
    if (assignmentsFor(shift).some(item => identity(item.mitarbeiterId || item.mitarbeiterData) === identity(candidate._id))) return;
    draft.value.planning.push({ clientId: newId(), type: 'assign', clientShiftId: shift.clientId, schichtId: shift._id, mitarbeiterId: candidate._id, employeeName: `${candidate.vorname} ${candidate.nachname}`, conflictOverride, includeOtherLocations });
  }
  function removeAssignment(item) {
    if (item.type === 'assign') draft.value.planning = draft.value.planning.filter(operation => operation.clientId !== item.clientId);
    else if (!draft.value.planning.some(operation => operation.einsatzId === String(item._id))) {
      draft.value.planning.push({ clientId: newId(), type: 'remove', einsatzId: String(item._id), employeeName: item.mitarbeiterData ? `${item.mitarbeiterData.vorname} ${item.mitarbeiterData.nachname}` : `Personal ${item.personalNr}` });
    }
  }
  function queueFiles(selected, target = linked.value ? 'group' : 'order') {
    error.value = '';
    for (const file of Array.isArray(selected) ? selected : [selected]) {
      if (file.size > 30 * 1024 * 1024) { error.value = `${file.name}: Die maximale Dateigröße beträgt 30 MB.`; continue; }
      files.push({ id: newId(), file, target, dayKey: activeKey.value, status: 'pending', error: '' });
    }
  }
  function restoreFile(item, file) {
    if (file.name !== item.filename || file.size !== item.expectedSize) { item.error = 'Dateiname und Dateigröße stimmen nicht mit der vorgemerkten Anlage überein.'; return; }
    item.file = file; item.status = 'pending'; item.error = '';
  }
  function changedPayload(key) {
    const value = drafts[key]; const baseline = baselines[key];
    const payload = { auftragNr: value.order.auftragNr, day: value.order.day, expectedUpdatedAt: baseline.order.updatedAt, planningVersion: baseline.order.planningVersion, order: {} };
    for (const field of orderFields) {
      if (creating.value || !same(value.order[field], baseline.order[field]) || ['kundenNr', 'locationV2', 'einsatzort'].includes(field)) payload.order[field] = value.order[field];
    }
    payload.shifts = value.shifts.flatMap(shift => {
      const before = baseline.shifts.find(item => item.clientId === shift.clientId);
      if (shift.deleted && !before) return [];
      if (!before || creating.value) return [shiftDto(shift)];
      const changed = Object.fromEntries(shiftFields.filter(field => !same(shift[field], before[field])).map(field => [field, shift[field]]));
      if (!Object.keys(changed).length && same(shift.overrides, before.overrides) && !shift.deleted) return [];
      return [{ _id: shift._id, clientId: shift.clientId, groupShiftKey: shift.groupShiftKey, expectedUpdatedAt: before.updatedAt, overrides: shift.overrides, deleted: Boolean(shift.deleted), dayOnly: Boolean(shift.dayOnly), ...changed }];
    });
    payload.planning = value.planning;
    return payload;
  }
  function submissionPayload() {
    const primary = changedPayload(activeKey.value);
    return {
      ...primary, mode: creating.value ? 'create' : 'edit', groupRevision: group.value?.revision,
      clientSubmissionId: clientSubmissionId.value, dates: creating.value ? [...new Set(dates.value)].sort() : undefined,
      commonShifts: Object.values(creationTemplates).map(shiftDto),
      commonOrder: creating.value ? { einsatzort: sharedEdits.order.einsatzort ?? drafts.new.order.einsatzort, bestelltext: sharedEdits.order.bestelltext ?? drafts.new.order.bestelltext } : undefined,
      attachments: files.filter(file => file.status !== 'completed').map(file => ({ clientUploadId: file.id, relationTarget: file.target, day: file.day || drafts[file.dayKey]?.order.day, filename: file.file?.name || file.filename, size: file.file?.size ?? file.expectedSize })),
      dayOverrides: Object.keys(drafts).filter(key => key !== activeKey.value && (!creating.value || dates.value.includes(drafts[key].order.day)) && draftDifferences(drafts[key], baselines[key]).length).map(changedPayload),
    };
  }
  function stagedAssignments() {
    return Object.values(drafts).filter(value => !creating.value || dates.value.includes(value.order.day)).flatMap(value => value.planning.map(operation => ({
      ...operation, auftragNr: value.order.auftragNr, day: value.order.day,
      schicht: operation.type === 'assign' ? shiftDto(value.shifts.find(shift => shift.clientId === operation.clientShiftId)) : undefined,
    })));
  }
  async function uploadFiles(orders) {
    for (const item of files.filter(file => file.status !== 'completed')) {
      item.status = 'uploading'; item.error = '';
      try {
        if (!item.file) throw new Error('Bitte die Originaldatei erneut auswählen.');
        const original = drafts[item.dayKey]?.order;
        const number = item.target === 'group' ? orders[0]?.auftragNr || order.value.auftragNr : item.auftragNr || original?.auftragNr || orders.find(order => (order.day || editorDay(order.vonDatum)) === (item.day || original?.day))?.auftragNr;
        if (!number) throw new Error('Der Zielauftrag für die Anlage fehlt.');
        const body = new FormData();
        body.append('file', item.file); body.append('title', item.file.name); body.append('scope', 'monitor');
        body.append('type', 'bestellung'); body.append('relationTarget', item.target); body.append('clientUploadId', item.id);
        const { data } = await api.post(`/api/auftraege/${number}/einsatzdokumente`, body);
        if (data.success !== true) throw new Error(data.message || 'Das Bestelldokument wurde nicht gespeichert.');
        item.status = 'completed';
      } catch (failure) {
        item.status = 'failed'; item.error = failure.response?.data?.message || failure.message || 'Upload fehlgeschlagen.';
      }
    }
    if (files.some(file => file.status === 'failed')) throw new Error('Auftragsänderungen gespeichert. Einige Anlagen fehlen noch; bitte nur diese Uploads erneut versuchen.');
  }
  const completedOrders = ref([]);
  async function submit() {
    if (busy.value) return;
    if (progress.value?.canResume === false) { error.value = 'Nur der einreichende Benutzer kann diesen Vorgang fortsetzen.'; return; }
    if (!submissionId.value && validation.value.length) { error.value = validation.value.join(' '); return; }
    busy.value = true; error.value = ''; notice.value = '';
    try {
      if (!submissionId.value) {
        const { data } = await api.post('/api/auftraege/editor/submissions', submissionPayload());
        progress.value = data; submissionId.value = data.id;
        if (!data.id) throw new Error('Die Antwort enthält keine Vorgangs-ID.');
      }
      while (progress.value.status !== 'completed') {
        const before = progress.value.completed;
        const { data } = await api.post(`/api/auftraege/editor/submissions/${submissionId.value}/process`, {});
        progress.value = data;
        for (const row of data.orders || []) {
          const index = completedOrders.value.findIndex(item => item.auftragNr === row.auftragNr);
          if (index >= 0) completedOrders.value[index] = row; else completedOrders.value.push(row);
          onUpdated(row);
        }
        if (data.status === 'incomplete' || data.errors?.length) throw new Error(data.errors?.map(item => typeof item === 'string' ? item : item.message).join(' ') || 'Der Vorgang ist unvollständig. Nur ausstehende Tage erneut versuchen.');
        if (data.status !== 'completed' && data.completed === before) throw new Error('Der Vorgang hat keinen Fortschritt gemeldet. Bitte erneut versuchen.');
      }
      await uploadFiles(completedOrders.value);
      const { data: completion } = await api.post(`/api/auftraege/editor/submissions/${submissionId.value}/complete`, {});
      if (completion.ready !== true) throw new Error('Der Vorgang ist noch nicht vollständig abgeschlossen.');
      const number = completedOrders.value.find(item => item.auftragNr === order.value.auftragNr)?.auftragNr || completedOrders.value[0]?.auftragNr || order.value.auftragNr;
      if (!number) throw new Error('Die gespeicherten Aufträge fehlen in der Antwort. Bitte den Vorgang erneut laden.');
      if (number) {
        if (!await load(number, null, true)) throw new Error('Änderungen gespeichert, aber der aktuelle Stand konnte nicht geladen werden. Bitte erneut versuchen.');
        Object.keys(drafts).filter(key => key !== activeKey.value).forEach(key => delete drafts[key]);
      }
      submissionId.value = ''; progress.value = null; clientSubmissionId.value = newId(); completedOrders.value = [];
      Object.keys(sharedEdits.order).forEach(key => delete sharedEdits.order[key]);
      Object.keys(sharedEdits.shifts).forEach(key => delete sharedEdits.shifts[key]);
      notice.value = 'Alle Änderungen und Anlagen wurden gespeichert.';
    } catch (failure) { error.value = failure.response?.data?.message || failure.message || 'Übernahme fehlgeschlagen.'; }
    finally { busy.value = false; }
  }
  return { creating, drafts, draft, order, shifts, dates, activeDay, multiDay, group, members, nextCursor, activeKey, loading, busy, error, notice, progress, files, savedSites, dirty, pending, linked, validation, changesByDay, load, selectCreationDay, setOrder, toggleOrderOverride, setShift, toggleOverride, addShift, deleteShift, assignmentsFor, stageAssignment, removeAssignment, queueFiles, restoreFile, submit, submissionPayload, stagedAssignments };
}
