const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Auftrag = require('../../models/Event/Auftrag');
const Schicht = require('../../models/Event/Schicht');
const Einsatz = require('../../models/Event/Einsatz');
const Kunde = require('../../models/Customer/Kunde');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const User = require('../../models/System/User');
const Group = require('../../models/Event/Auftragsgruppe');
const Submission = require('../../models/Event/AuftragEditorSubmission');
const Day = require('../../models/Event/AuftragEditorDay');
const Attachment = require('../../models/Event/AuftragEditorAttachment');
const { snapshot, recordOrderChanges, buildChanges, employeeNames } = require('./AuftragChronikService');
const { getStaffingCandidates, shiftWindow } = require('./StaffingSuggestionService');
const { dayKey, validDay, addDays, dayOffset, atTime } = require('../../utils/orderDay');
const { canAccess } = require('../TimeCaptureService');
const { prepareTemplate } = require('./EinsatzinformationService');

const BATCH_SIZE = 10;
const PAGE_SIZE = 50;
const own = (value, key) => Object.hasOwn(value || {}, key);
const id = value => String(value?._id || value || '');
const clone = value => JSON.parse(JSON.stringify(value));
const equal = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const INFO_FIELDS = ['einsatzinformationSourceHtml', 'einsatzinformationCustomized', 'applyLatestTemplate'];
const META_FIELDS = ['_id', 'clientId', 'groupShiftKey', 'overrides', 'deleted', 'dayOnly', 'expectedUpdatedAt', 'endDayOffset'];
const ORDER_META = ['day', 'einsatzortOverride', 'bestelltextOverride'];

function fail(statusCode, message, code = 'EDITOR_INVALID', details) {
  const error = new Error(message);
  Object.assign(error, { statusCode, code, details });
  throw error;
}
function compareUpdated(expected, actual) {
  return expected && new Date(expected).getTime() === new Date(actual).getTime();
}
function shiftKey(shift) { return id(shift._id) || String(shift.clientId || ''); }
function planningShift(shifts, operation) {
  const byId = operation.schichtId ? shifts.find(shift => id(shift._id) === id(operation.schichtId)) : null;
  const byClient = operation.clientShiftId ? shifts.find(shift => shift.clientId === operation.clientShiftId) : null;
  if (operation.schichtId && byClient && byId !== byClient) fail(400, 'Widersprüchliche Schichtidentität in der Planung.');
  return operation.schichtId ? byId : byClient;
}
function overrideHas(overrides, field) {
  return overrides.includes(field) || (field === 'endDayOffset' && overrides.includes('datumBis'));
}
function conflictIdentity(conflict) {
  return [conflict.type, conflict.entryId || conflict.einsatzId || conflict.label].map(value => String(value || '')).join(':');
}
function covers(override, conflicts) {
  if (!conflicts.length) return true;
  if (!override?.confirmed || !String(override.reason || '').trim()) return false;
  const identities = new Set((override.conflicts || []).map(conflictIdentity));
  return conflicts.every(conflict => identities.has(conflictIdentity(conflict)));
}

module.exports = function createEditorService(helpers) {
  const { invokeMutation, readDetails, getEinsatzortForAuftrag, resolveWritableLocation,
    assertCustomerMatchesLocation, normalizeEditablePatch, orderFields, shiftFields } = helpers;
  const commonFields = new Set([...shiftFields].filter(field => !['datumVon', 'datumBis', 'letzteAusschreibung'].includes(field))
    .concat(['endDayOffset', ...INFO_FIELDS.filter(field => field !== 'applyLatestTemplate')]));
  const editableOrder = new Set(['eventTitel', 'locationV2', 'kundenNr', 'einsatzort', 'bestDatum', 'referenz',
    'bestelltext', 'vonDatum', 'bisDatum']);

  async function actor(req) {
    const userId = req.user?.id || req.user?._id;
    const user = mongoose.isValidObjectId(userId) ? await User.findById(userId).lean() : null;
    if (!user) fail(403, 'Ein gültiges Benutzerkonto ist erforderlich.', 'EDITOR_FORBIDDEN');
    return user;
  }
  async function contextValidation(req, order) {
    if (!Number.isSafeInteger(Number(order.kundenNr)) || Number(order.kundenNr) <= 0) fail(400, 'Ein Kunde ist erforderlich.');
    const customer = await Kunde.findOne({ kundenNr: Number(order.kundenNr) }).lean();
    if (!customer) fail(400, 'Kunde nicht gefunden.');
    const { location } = await resolveWritableLocation(req, id(order.locationV2));
    await assertCustomerMatchesLocation(customer, location._id);
    if (!order.einsatzort) fail(400, 'Ein gespeicherter Kunden-Einsatzort ist erforderlich.');
    await getEinsatzortForAuftrag(order.kundenNr, id(order.einsatzort));
    if (!String(order.eventTitel || '').trim()) fail(400, 'Ein Auftragstitel ist erforderlich.');
  }
  function orderInput(input = {}) {
    for (const field of ['einsatzortOverride', 'bestelltextOverride']) {
      if (own(input, field) && typeof input[field] !== 'boolean') fail(400, `${field} muss ein Wahrheitswert sein.`);
    }
    if (Object.keys(input).some(field => !editableOrder.has(field) && !ORDER_META.includes(field))) {
      fail(400, 'Nicht editierbare Felder in den Auftragsdaten.');
    }
    const fields = Object.fromEntries(Object.entries(input).filter(([field]) => editableOrder.has(field)));
    if (own(fields, 'eventTitel') && typeof fields.eventTitel !== 'string') fail(400, 'Der Auftragstitel muss ein Text sein.');
    if (own(fields, 'bestelltext') && (typeof fields.bestelltext !== 'string' || fields.bestelltext.length > 100000)) {
      fail(400, 'Die Bestellung muss ein Text mit höchstens 100000 Zeichen sein.');
    }
    return Object.keys(fields).length ? normalizeEditablePatch(fields, orderFields) : {};
  }
  function normalizeShift(input, current = null, day = null) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Ungültige Schicht.');
    const unknown = Object.keys(input).filter(field => !shiftFields.has(field) && !INFO_FIELDS.includes(field) && !META_FIELDS.includes(field));
    if (unknown.length) fail(400, `Nicht editierbare Schichtfelder: ${unknown.join(', ')}`);
    for (const field of ['deleted', 'dayOnly', 'einsatzinformationCustomized', 'applyLatestTemplate']) {
      if (own(input, field) && typeof input[field] !== 'boolean') fail(400, `${field} muss ein Wahrheitswert sein.`);
    }
    if (input.clientId && String(input.clientId).length > 200) fail(400, 'Die Schicht-clientId ist zu lang.');
    if (input.expectedUpdatedAt && current && !compareUpdated(input.expectedUpdatedAt, current.updatedAt)) {
      fail(409, 'Die Schicht wurde zwischenzeitlich geändert.', 'SHIFT_STALE');
    }
    if (!current && !String(input.clientId || '').trim()) fail(400, 'Eine clientId für neue Schichten ist erforderlich.');
    const values = Object.fromEntries(Object.entries(input).filter(([field]) => shiftFields.has(field)));
    const patch = Object.keys(values).length ? normalizeEditablePatch(values, shiftFields) : {};
    for (const [field, value] of Object.entries(patch)) {
      if (value !== null && Schicht.schema.path(field)?.instance === 'String') {
        if (!['string', 'number'].includes(typeof value)) fail(400, `${field} muss ein Text sein.`);
        patch[field] = String(value);
      }
    }
    const effective = { ...(current || {}), ...patch };
    if (!input.deleted) {
      if (!String(effective.bezeichnung || '').trim()) fail(400, 'Eine Schichtbezeichnung ist erforderlich.');
      if (effective.bedarf === undefined) patch.bedarf = 1;
      if (!Number.isInteger(Number(effective.bedarf ?? patch.bedarf)) || Number(effective.bedarf ?? patch.bedarf) < 0) {
        fail(400, 'Der Schichtbedarf muss eine nicht negative ganze Zahl sein.');
      }
      for (const field of ['uhrzeitVon', 'uhrzeitBis']) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(effective[field] || ''))) fail(400, `${field} muss das Format HH:MM haben.`);
      }
    }
    const overrides = input.overrides === undefined ? [...(current?.overrides || [])] : input.overrides;
    if (!Array.isArray(overrides) || overrides.some(field => !commonFields.has(field) && !['datumVon', 'datumBis'].includes(field))) {
      fail(400, 'Ungültige tagesspezifische Schichtfelder.');
    }
    const result = { ...patch };
    for (const field of INFO_FIELDS) if (own(input, field)) result[field] = input[field];
    if (own(result, 'einsatzinformationSourceHtml')) {
      const source = result.einsatzinformationSourceHtml ?? '';
      if (typeof source !== 'string' || source.length > 100000) fail(400, 'Die Einsatzinformation ist ungültig oder zu lang.');
      try { prepareTemplate(source); }
      catch (error) { fail(400, error.message, 'INFORMATION_INVALID'); }
      result.einsatzinformationSourceHtml = source;
    }
    if (own(input, 'endDayOffset')) result.endDayOffset = Number(input.endDayOffset);
    else if (own(input, 'datumBis')) result.endDayOffset = dayOffset(input.datumVon || current?.datumVon || day, input.datumBis);
    else if (!current) result.endDayOffset = effective.uhrzeitBis <= effective.uhrzeitVon ? 1 : 0;
    else if (own(input, 'uhrzeitBis') || own(input, 'uhrzeitVon')) {
      result.endDayOffset = current.endDayOffset ?? Math.max(0, dayOffset(current.datumVon, current.datumBis));
      if (result.endDayOffset === 0 && effective.uhrzeitBis <= effective.uhrzeitVon) result.endDayOffset = 1;
    }
    if (own(result, 'endDayOffset') && (!Number.isInteger(result.endDayOffset) || result.endDayOffset < 0)) {
      fail(400, 'Der Endtag-Abstand ist ungültig.');
    }
    if (day && own(input, 'datumVon') && dayKey(input.datumVon) !== day) fail(400, 'Die Schicht muss am Starttag des Auftrags beginnen.');
    return { fields: result, overrides: [...new Set(overrides)], current, input };
  }
  function relative(fields, day, current = null) {
    const result = { ...fields };
    if (day) {
      const effective = { ...(current || {}), ...fields };
      const offset = effective.endDayOffset ?? Math.max(0, dayOffset(effective.datumVon || day, effective.datumBis || day));
      result.datumVon = atTime(day);
      result.datumBis = atTime(addDays(day, offset));
      const window = shiftWindow({ ...effective, day, endDayOffset: offset });
      if (!window.start || !window.end || window.end <= window.start) fail(400, 'Der Schichtzeitraum ist ungültig.');
    }
    return result;
  }
  function infoFields(shift) {
    return { einsatzinformationSourceHtml: shift.einsatzinformation?.sourceHtml || '',
      einsatzinformationCustomized: Boolean(shift.einsatzinformation?.customized) };
  }
  function baselineField(shift, field) {
    if (INFO_FIELDS.includes(field)) return infoFields(shift)[field];
    if (field === 'endDayOffset') return shift.endDayOffset ?? Math.max(0, dayOffset(shift.datumVon, shift.datumBis));
    return shift[field];
  }
  async function loadOrder(number) {
    if (!Number.isSafeInteger(Number(number)) || Number(number) <= 0) fail(400, 'Ungültige Auftragsnummer.');
    const order = await Auftrag.findOne({ auftragNr: Number(number) }).lean();
    if (!order) fail(404, 'Auftrag nicht gefunden.');
    if (order.isPseudo) fail(400, 'Pseudo-Aufträge verwenden ihren bisherigen Editor.');
    return order;
  }
  function staleChecks(input, order) {
    if (!compareUpdated(input.expectedUpdatedAt, order.updatedAt)) fail(409,
      'Der Auftrag wurde zwischenzeitlich geändert. Bitte neu laden.', 'ORDER_STALE');
    if (!Number.isInteger(input.planningVersion) || input.planningVersion !== Number(order.planningVersion || 0)) {
      fail(409, 'Die Planung wurde zwischenzeitlich geändert.', 'PLANNING_STALE');
    }
  }

  async function getContext(req, number, cursor) {
    const user = await actor(req);
    const order = await loadOrder(number);
    if (!canAccess(user, order.locationV2)) fail(403, 'Für diesen Auftragsstandort fehlt die Berechtigung.');
    const details = await readDetails(req, order.auftragNr);
    const group = order.auftragsgruppe ? await Group.findById(order.auftragsgruppe).lean() : null;
    let members = [], nextCursor = null;
    if (group) {
      const filter = { auftragsgruppe: group._id };
      if (cursor) {
        if (!/^\d+$/.test(cursor)) fail(400, 'Ungültiger Gruppen-Cursor.');
        filter.auftragNr = { $gt: Number(cursor) };
      }
      const rows = await Auftrag.find(filter).select('auftragNr day eventTitel updatedAt planningVersion auftStatus')
        .sort({ auftragNr: 1 }).limit(PAGE_SIZE + 1).lean();
      members = rows.slice(0, PAGE_SIZE);
      nextCursor = rows.length > PAGE_SIZE ? String(members.at(-1).auftragNr) : null;
      if (!order.bestelltextOverride) details.bestelltext = group.bestelltext;
    }
    details.bestelltextOverride = Boolean(order.bestelltextOverride);
    details.day = order.day || dayKey(order.vonDatum);
    details.dailyOrder = Boolean(order.day);
    details.groupRevision = group?.revision ?? null;
    details.groupStatus = group?.status ?? null;
    details.einsatzortValid = false;
    details.einsatzortIssue = null;
    try {
      if (!order.einsatzort) fail(400, 'Ein gespeicherter Kunden-Einsatzort ist erforderlich.', 'SITE_REQUIRED');
      await getEinsatzortForAuftrag(order.kundenNr, order.einsatzort);
      details.einsatzortValid = true;
    } catch (error) {
      details.einsatzortIssue = { code: error.code || 'SITE_CUSTOMER_MISMATCH', message: error.message };
    }
    details.groupCustomerMismatch = Boolean(group && Number(group.kundenNr) !== Number(order.kundenNr));
    if (details.groupCustomerMismatch && !order.einsatzortOverride) {
      details.einsatzortIssue = { code: 'GROUP_CUSTOMER_MISMATCH',
        message: 'Eine Importkorrektur hat den Kunden dieses Tages geändert. Ein gespeicherter Einsatzort nur für diesen Tag ist erforderlich.' };
      details.einsatzortValid = false;
    }
    details.schichten = details.schichten.map(shift => ({ ...shift, overrides: shift.overrides || [] }));
    const queued = await Day.findOne({ auftragNr: order.auftragNr, active: true }).select('submission').lean();
    const operationId = group?.activeSubmission || queued?.submission || order.submission;
    const operation = operationId ? await Submission.findById(operationId).lean() : null;
    const pendingSubmission = operation && (operation.status !== 'completed' || operation.ready === false)
      ? { ...(await progressData(operation)), canResume: id(operation.createdBy) === id(user._id) } : null;
    return { order: details, group: group ? { ...group,
      shifts: group.shiftDefaults.map(definition => ({ groupShiftKey: definition.key, ...definition.fields })) } : null,
    members, nextCursor, pendingSubmission };
  }

  async function candidates(req, input) {
    await actor(req);
    const current = input.auftragNr ? await loadOrder(input.auftragNr) : null;
    if (current && !canAccess(await actor(req), current.locationV2)) fail(403, 'Für diesen Auftragsstandort fehlt die Berechtigung.');
    const order = { ...(current || {}), kundenNr: input.kundenNr ?? current?.kundenNr,
      locationV2: input.locationV2 ?? current?.locationV2, einsatzort: input.einsatzort ?? current?.einsatzort,
      eventTitel: current?.eventTitel || 'Vorschau' };
    if (current && Number(order.kundenNr) !== Number(current.kundenNr)) fail(400, 'Der Kunde kann nicht geändert werden.');
    await contextValidation(req, order);
    const saved = input.schicht?._id ? await Schicht.findOne({ _id: input.schicht._id, auftragNr: current?.auftragNr }).lean() : null;
    if (input.schicht?._id && !saved) fail(400, 'Schicht nicht gefunden.');
    const normalized = normalizeShift(input.schicht, saved, current?.day || null);
    const shift = { ...(saved || {}), ...normalized.fields, clientId: input.schicht.clientId };
    if (!shift.datumVon) fail(400, 'Ein Schichtdatum ist erforderlich.');
    if (!saved || current?.day) {
      const day = current?.day || dayKey(shift.datumVon);
      Object.assign(shift, relative(shift, day), { day });
    }
    const operations = (input.stagedAssignments || []).map(operation => operation.type === 'assign'
      && !operation.schicht && !operation.shift && operation.clientShiftId === shift.clientId
      ? { ...operation, schicht: shift } : operation);
    const staged = await previewScheduling(operations, current);
    const results = await getStaffingCandidates({ auftrag: order, schicht: shift,
      includeOtherLocations: input.includeOtherLocations === true, ...staged });
    return { candidates: results, planningVersion: current?.planningVersion ?? 0 };
  }

  async function previewScheduling(operations, current) {
    if (!Array.isArray(operations)) fail(400, 'Ungültige vorgemerkte Planung.');
    const removedEinsatzIds = [], stagedDeployments = [];
    for (const operation of operations) {
      if (operation.type === 'remove') {
        if (!mongoose.isValidObjectId(operation.einsatzId)) fail(400, 'Ungültiger Einsatz.');
        const assignment = await Einsatz.findById(operation.einsatzId).lean();
        if (!assignment) fail(400, 'Einsatz nicht gefunden.');
        const order = await loadOrder(assignment.auftragNr);
        if (current && order.auftragNr !== current.auftragNr
          && (!current.auftragsgruppe || id(order.auftragsgruppe) !== id(current.auftragsgruppe))) {
          fail(403, 'Der vorgemerkte Einsatz gehört nicht zur bearbeiteten Gruppe.');
        }
        if (!current) fail(403, 'Bestehende Einsätze können nur in ihrem Auftragskontext vorgemerkt entfernt werden.');
        removedEinsatzIds.push(id(assignment._id));
      } else if (operation.type === 'assign') {
        const employee = mongoose.isValidObjectId(operation.mitarbeiterId)
          ? await Mitarbeiter.findById(operation.mitarbeiterId).lean() : null;
        if (!employee) fail(400, 'Mitarbeiter nicht gefunden.');
        let shift = operation.schicht || operation.shift;
        if (!shift && operation.schichtId) shift = await Schicht.findById(operation.schichtId).lean();
        if (!shift) fail(400, 'Eine vorgemerkte Schicht benötigt ihre Schichtdaten.');
        const savedId = operation.schichtId || shift._id;
        if (savedId && !mongoose.isValidObjectId(savedId)) fail(400, 'Ungültige vorgemerkte Schicht-ID.');
        const saved = savedId ? await Schicht.findById(savedId).lean() : null;
        if (savedId && !saved) fail(400, 'Vorgemerkte Schicht nicht gefunden.');
        const number = saved?.auftragNr || operation.auftragNr || shift.auftragNr;
        let savedOrder;
        if (number) {
          savedOrder = await loadOrder(number);
          const order = savedOrder;
          if (!current || (order.auftragNr !== current.auftragNr
            && (!current.auftragsgruppe || id(order.auftragsgruppe) !== id(current.auftragsgruppe)))) {
            fail(403, 'Die vorgemerkte Schicht gehört nicht zur bearbeiteten Gruppe.');
          }
        }
        const normalized = normalizeShift({ ...Object.fromEntries(Object.entries(shift).filter(([field]) =>
          shiftFields.has(field) || META_FIELDS.includes(field))), clientId: shift.clientId || operation.clientShiftId || id(shift._id) },
        saved, savedOrder?.day || null);
        const day = operation.day || shift.day || savedOrder?.day || dayKey(shift.datumVon || saved?.datumVon);
        const stagedShift = { ...(saved || {}), ...shift, ...normalized.fields };
        if (!saved || savedOrder?.day) Object.assign(stagedShift, relative(normalized.fields, day, saved), { day });
        stagedDeployments.push({ ...stagedShift, _id: `staged:${day}:${savedId || operation.clientShiftId}:${employee._id}`,
          schicht: savedId || `${day}:${operation.clientShiftId || shift.clientId}`, personalNr: Number(employee.personalnr),
          auftragNr: operation.auftragNr || current?.auftragNr || 0 });
      } else fail(400, 'Ungültige vorgemerkte Planungsänderung.');
    }
    return { removedEinsatzIds, stagedDeployments };
  }

  async function buildEditDay(order, input, defaults, group, newDefaults, main = false) {
    const patch = orderInput(input.order || {});
    if (own(patch, 'kundenNr') && Number(patch.kundenNr) !== Number(order.kundenNr)) fail(400, 'Der Kunde kann nicht geändert werden.');
    const effectiveOrder = { ...order, ...patch };
    const metadata = { bestelltextOverride: own(input.order, 'bestelltextOverride') ? input.order.bestelltextOverride === true : order.bestelltextOverride,
      einsatzortOverride: own(input.order, 'einsatzortOverride') ? input.order.einsatzortOverride === true : order.einsatzortOverride };
    if (group) {
      if (id(effectiveOrder.locationV2) !== id(group.locationV2)) fail(400, 'Der Standort einer Auftragsgruppe kann nicht geändert werden.');
      if (!metadata.einsatzortOverride) patch.einsatzort = group.einsatzort;
      if (!metadata.bestelltextOverride) patch.bestelltext = group.bestelltext;
      Object.assign(effectiveOrder, patch);
    }
    await contextValidation(input.req, effectiveOrder);
    const saved = await Schicht.find({ auftragNr: order.auftragNr }).lean();
    const byId = new Map(saved.map(shift => [id(shift._id), shift]));
    const shiftInputs = new Map();
    for (const dto of input.shifts || []) {
      if (dto._id && !byId.has(id(dto._id))) fail(400, 'Die Schicht gehört nicht zu diesem Auftrag.');
      const key = dto._id ? id(dto._id) : dto.clientId;
      if (!key || shiftInputs.has(key)) fail(400, 'Doppelte oder fehlende Schichtidentität.');
      shiftInputs.set(key, normalizeShift(dto, byId.get(key), order.day || null));
    }
    const shiftActions = [];
    const suppressed = new Set(order.suppressedGroupShiftKeys || []);
    for (const staged of shiftInputs.values()) {
      if (!staged.current && staged.input.groupShiftKey) {
        if (!defaults.some(definition => definition.key === staged.input.groupShiftKey)) fail(400, 'Die gemeinsame Schichtdefinition wurde nicht gefunden.');
        if (!staged.input.deleted) suppressed.delete(staged.input.groupShiftKey);
      }
    }
    for (const current of saved) {
      const staged = shiftInputs.get(id(current._id));
      const definition = defaults?.find(item => item.key === current.groupShiftKey);
      if (staged?.input.deleted || (current.groupShiftKey && !definition)) {
        if (staged?.input.dayOnly && current.groupShiftKey) suppressed.add(current.groupShiftKey);
        shiftActions.push({ type: 'delete', _id: id(current._id), clientId: current.clientId });
        continue;
      }
      const fields = { ...(staged?.fields || {}) };
      const overrides = staged?.overrides || current.overrides || [];
      if (definition) for (const [field, value] of Object.entries(definition.fields)) {
        if (!overrideHas(overrides, field)) fields[field] = value;
      }
      if (definition) for (const field of current.overrides || []) {
        if (!overrides.includes(field) && own(definition.fields, field)) fields[field] = definition.fields[field];
      }
      const materialized = relative(fields, order.day || null, current);
      const changed = Object.entries(materialized).filter(([field, value]) =>
        !equal(value instanceof Date ? value.toISOString() : value, baselineField(current, field) instanceof Date
          ? baselineField(current, field).toISOString() : baselineField(current, field)));
      if (changed.length || !equal(current.overrides || [], overrides)) {
        shiftActions.push({ type: 'patch', _id: id(current._id), clientId: staged?.input.clientId || current.clientId,
          fields: Object.fromEntries(changed), overrides, groupShiftKey: current.groupShiftKey });
      }
    }
    for (const staged of shiftInputs.values()) {
      if (staged.current || staged.input.deleted) continue;
      if (staged.input.groupShiftKey) continue;
      if (group && !staged.input.dayOnly) continue;
      shiftActions.push({ type: 'create', clientId: staged.input.clientId,
        fields: relative(staged.fields, order.day || null), overrides: staged.overrides });
    }
    for (const definition of defaults || []) {
      if (saved.some(shift => shift.groupShiftKey === definition.key) || suppressed.has(definition.key)) continue;
      const source = (input.shifts || []).find(dto => dto.groupShiftKey === definition.key || newDefaults.get(dto.clientId) === definition.key);
      const overrides = source?.overrides || [];
      const fields = { ...definition.fields };
      if (source) {
        const staged = normalizeShift(source, null, order.day || null);
        for (const [field, value] of Object.entries(staged.fields)) if (overrideHas(overrides, field)) fields[field] = value;
      }
      shiftActions.push({ type: 'create', clientId: source?.clientId || definition.key, groupShiftKey: definition.key,
        fields: relative(fields, order.day || null), overrides });
    }
    const orderPatch = Object.fromEntries(Object.entries(patch).filter(([field, value]) => !equal(value, order[field])));
    return { orderPatch, metadata: { ...metadata, suppressedGroupShiftKeys: [...suppressed] },
      expectedUpdatedAt: order.updatedAt, planningVersion: order.planningVersion || 0,
      shiftVersions: saved.map(shift => ({ _id: shift._id, updatedAt: shift.updatedAt })),
      shiftActions, planning: input.planning || [], day: order.day || dayKey(order.vonDatum), main };
  }

  async function effectiveState(payload, existing) {
    const shifts = existing ? await Schicht.find({ auftragNr: existing.auftragNr }).lean() : [];
    const byId = new Map(shifts.map(shift => [id(shift._id), shift]));
    for (const action of payload.shiftActions) {
      if (action.type === 'delete') byId.delete(action._id);
      else if (action.type === 'patch') byId.set(action._id, { ...byId.get(action._id), ...action.fields,
        overrides: action.overrides, groupShiftKey: action.groupShiftKey,
        clientId: action.clientId || byId.get(action._id)?.clientId });
      else byId.set(action.clientId, { ...action.fields, _id: action.clientId, clientId: action.clientId,
        overrides: action.overrides, groupShiftKey: action.groupShiftKey,
        day: existing?.day || (!existing ? payload.day : undefined) });
    }
    const order = { ...(existing || {}), ...payload.orderPatch };
    return { order, shifts: [...byId.values()] };
  }
  function hasPayloadChanges(payload, order) {
    return Object.keys(payload.orderPatch).length > 0 || payload.shiftActions.length > 0 || payload.planning.length > 0
      || Object.entries(payload.metadata).some(([field, value]) => field !== 'submission' && !equal(value, order[field]));
  }
  async function validatePlanning(payload, existing, staged = { removedEinsatzIds: [], stagedDeployments: [] }) {
    const state = await effectiveState(payload, existing);
    const removed = new Set(payload.planning.filter(operation => operation.type === 'remove').map(operation => id(operation.einsatzId)));
    if (removed.size !== payload.planning.filter(operation => operation.type === 'remove').length) fail(400, 'Doppelte Einsatz-Entfernung.');
    const deleted = new Set(payload.shiftActions.filter(action => action.type === 'delete').map(action => action._id));
    const assignments = existing ? await Einsatz.find({ auftragNr: existing.auftragNr }).lean() : [];
    const scheduling = { ...staged, removedEinsatzIds: [...new Set([...(staged.removedEinsatzIds || []),
      ...removed, ...assignments.filter(assignment => deleted.has(id(assignment.schicht))).map(assignment => id(assignment._id))])] };
    for (const assignment of assignments) {
      if (removed.has(id(assignment._id)) || deleted.has(id(assignment.schicht))) continue;
      const shift = state.shifts.find(item => id(item._id) === id(assignment.schicht)
        || (assignment.idAuftragArbeitsschichten != null && assignment.idAuftragArbeitsschichten === item.idAuftragArbeitsschichten));
      if (!shift) continue;
      const employee = await Mitarbeiter.findOne({ $or: [{ personalnr: String(assignment.personalNr) },
        { 'personalnrHistory.value': String(assignment.personalNr) }] }).lean();
      if (!employee) fail(409, 'Ein eingeplanter Mitarbeiter wurde nicht gefunden.', 'PLANNING_INVALID');
      await checkCandidate(state.order, shift, employee, assignment.conflictOverride, true, scheduling);
    }
    const keys = new Set();
    for (const operation of payload.planning) {
      if (operation.type === 'remove') {
        if (!assignments.some(assignment => id(assignment._id) === id(operation.einsatzId))) fail(400, 'Zu entfernender Einsatz gehört nicht zu diesem Auftrag.');
        continue;
      }
      if (operation.type !== 'assign' || !mongoose.isValidObjectId(operation.mitarbeiterId)) fail(400, 'Ungültige Planungsänderung.');
      const shift = planningShift(state.shifts, operation);
      const employee = await Mitarbeiter.findById(operation.mitarbeiterId).lean();
      if (!shift || !employee) fail(400, 'Mitarbeiter oder Schicht nicht gefunden.');
      if (!Number.isSafeInteger(Number(employee.personalnr)) || Number(employee.personalnr) <= 0) fail(400, 'Mitarbeiter hat keine gültige Personalnummer.');
      const employeeNumbers = helpers.employeePersonalNumbers(employee);
      const key = `${shiftKey(shift)}:${employee.personalnr}`;
      if (keys.has(key) || assignments.some(assignment => !removed.has(id(assignment._id))
        && id(assignment.schicht) === id(shift._id) && employeeNumbers.includes(Number(assignment.personalNr)))) {
        fail(409, 'Doppelte Einplanung.', 'PLANNING_DUPLICATE');
      }
      keys.add(key);
      await checkCandidate(state.order, shift, employee, operation.conflictOverride, operation.includeOtherLocations === true, scheduling);
    }
  }
  async function checkCandidate(order, shift, employee, override, includeOtherLocations, staged) {
    const candidateShift = mongoose.isValidObjectId(shift._id) ? shift : { ...shift, _id: undefined,
      clientId: `${order.day || order.auftragNr}:${shift.clientId}` };
    const [candidate] = await getStaffingCandidates({ auftrag: order, schicht: candidateShift,
      employeeIds: [employee._id], includeOtherLocations, ...staged });
    if (!candidate) fail(403, 'Mitarbeiter liegt außerhalb der freigegebenen Standorte.', 'PLANNING_FORBIDDEN');
    if (!covers(override, candidate.conflicts)) fail(409, 'Ein Planungskonflikt muss bestätigt und begründet werden.',
      'PLANNING_CONFLICT', { conflicts: candidate.conflicts, mitarbeiterId: employee._id });
  }

  async function submit(req, input, options = {}) {
    const user = await actor(req);
    if (!['create', 'edit'].includes(input.mode)) fail(400, 'Ungültiger Einreichungsmodus.');
    const clientSubmissionId = String(input.clientSubmissionId || (options.review ? 'read-only-review' : '')).trim();
    if (!clientSubmissionId || clientSubmissionId.length > 200) fail(400, 'Eine clientSubmissionId ist erforderlich.');
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const previous = options.review ? null : await Submission.findOne({ createdBy: user._id, clientSubmissionId }).lean();
    if (previous) {
      if (previous.requestHash !== requestHash) fail(409, 'Diese Einreichungs-ID wurde für andere Änderungen verwendet.', 'IDEMPOTENCY_CONFLICT');
      return progress(req, previous._id);
    }
    if (!Array.isArray(input.shifts) || !Array.isArray(input.planning || [])) fail(400, 'Ungültige Schicht- oder Planungsdaten.');
    if (own(input, 'commonShifts') && !Array.isArray(input.commonShifts)) fail(400, 'Ungültige gemeinsame Schichten.');
    if (!Array.isArray(input.dayOverrides || [])) fail(400, 'Ungültige Tagesänderungen.');
    if (!Array.isArray(input.attachments || [])) fail(400, 'Ungültige Dokument-Vormerkungen.');
    let created;
    const reviewRows = [];
    async function storeJobs(rows) {
      for (const row of rows) row.payload.metadata.submission = row.submission;
      if (options.review) reviewRows.push(...rows);
      else await Day.insertMany(rows);
    }
    try {
      created = await mongoose.connection.transaction(async () => {
        const overrideInputs = input.dayOverrides || [];
        const newDefaults = new Map();
        let group, jobs = [], total = 0;
        const header = new Submission({ createdBy: user._id, clientSubmissionId, requestHash, mode: input.mode, total: 0 });
        if (input.mode === 'create') {
          const patch = orderInput(input.order || {});
          await contextValidation(req, patch);
          const commonOrder = input.commonOrder || {};
          if (Object.keys(commonOrder).some(field => !['einsatzort', 'bestelltext'].includes(field))) {
            fail(400, 'Ungültige gemeinsame Auftragsfelder.');
          }
          const commonPatch = { ...patch, ...orderInput(commonOrder) };
          await contextValidation(req, commonPatch);
          const requested = input.dates?.length ? input.dates : [input.order?.day || dayKey(input.order?.vonDatum)];
          if (!Array.isArray(requested) || requested.some(day => !validDay(day))) fail(400, 'Ungültige ausgewählte Starttage.');
          const dates = [...new Set(requested)];
          if (!dates.length) fail(400, 'Mindestens ein Starttag ist erforderlich.');
          const mainDay = input.order?.day || dates[0];
          if (!dates.includes(mainDay)) fail(400, 'Der aktuelle Starttag muss ausgewählt sein.');
          const dailyInputs = new Map();
          for (const dto of overrideInputs) {
            if (!dates.includes(dto.day) || dailyInputs.has(dto.day)) fail(400, 'Ungültiger oder doppelter Tages-Override.');
            dailyInputs.set(dto.day, dto);
          }
          const commonShiftInputs = input.commonShifts || input.shifts;
          if (!Array.isArray(commonShiftInputs)) fail(400, 'Ungültige gemeinsame Schichten.');
          const definitions = commonShiftInputs.filter(dto => !dto.deleted && !dto.dayOnly).map(dto => {
            const normalized = normalizeShift(dto, null, mainDay);
            if (normalized.overrides.length) fail(400, 'Gemeinsame Erstellungs-Schichten benötigen keine Tages-Overrides; dayOverrides verwenden.');
            const key = dto.groupShiftKey || crypto.randomUUID();
            newDefaults.set(dto.clientId, key);
            return { key, clientId: dto.clientId, fields: normalized.fields };
          });
          if (newDefaults.size !== definitions.length
            || new Set(definitions.map(definition => definition.key)).size !== definitions.length) fail(400, 'Gemeinsame Schichten müssen eindeutig benannt sein.');
          if (dates.length > 1) {
            group = new Group({ kundenNr: patch.kundenNr, locationV2: patch.locationV2, einsatzort: commonPatch.einsatzort,
              bestelltext: commonPatch.bestelltext ?? '', shiftDefaults: definitions.map(({ key, fields }) => ({ key, fields })),
              activeSubmission: header._id, createdBy: user._id });
            if (!options.review) await group.save();
            header.group = group._id;
            header.groupRevision = group.revision;
          }
          for (const day of dates) {
            const extra = dailyInputs.get(day) || {};
            const dayOrderInput = day === mainDay ? { ...(input.order || {}), ...(extra.order || {}) } : extra.order || {};
            const dayPatch = { ...commonPatch, ...(day === mainDay ? patch : {}), ...orderInput(extra.order || {}), day,
              vonDatum: atTime(day), bisDatum: atTime(day) };
            if (Number(dayPatch.kundenNr) !== Number(patch.kundenNr)) fail(400, 'Der Kunde kann nicht je Tag geändert werden.');
            if (id(dayPatch.locationV2) !== id(patch.locationV2)) fail(400, 'Der Standort kann nicht je Tag geändert werden.');
            await contextValidation(req, dayPatch);
            const metadata = { day, auftragsgruppe: group?._id || null, submission: header._id,
              bestelltextOverride: dayOrderInput.bestelltextOverride === true,
              einsatzortOverride: dayOrderInput.einsatzortOverride === true };
            if (group && !metadata.bestelltextOverride) dayPatch.bestelltext = group.bestelltext;
            if (group && !metadata.einsatzortOverride) dayPatch.einsatzort = group.einsatzort;
            const extras = [...(day === mainDay ? input.shifts : []), ...(extra.shifts || [])];
            const suppressed = [];
            const shiftActions = definitions.map(definition => {
              const dto = extras.findLast(value => value.clientId === definition.clientId || value.groupShiftKey === definition.key);
              if (dto?.deleted) { suppressed.push(definition.key); return null; }
              const fields = { ...definition.fields };
              const overrides = dto?.overrides || [];
              if (dto) {
                const normalized = normalizeShift({ ...fields, ...dto, clientId: definition.clientId }, null, day);
                for (const [field, value] of Object.entries(normalized.fields)) if (overrideHas(overrides, field)) fields[field] = value;
              }
              return { type: 'create', clientId: definition.clientId, groupShiftKey: group ? definition.key : undefined,
                fields: relative(fields, day), overrides };
            }).filter(Boolean);
            metadata.suppressedGroupShiftKeys = suppressed;
            for (const dto of extras.filter(value => !definitions.some(definition => value.clientId === definition.clientId || value.groupShiftKey === definition.key))) {
              if (dto.deleted) continue;
              const normalized = normalizeShift(dto, null, day);
              shiftActions.push({ type: 'create', clientId: dto.clientId, fields: relative(normalized.fields, day), overrides: normalized.overrides });
            }
            const payload = { orderPatch: dayPatch, metadata, shiftActions,
              planning: day === mainDay ? [...(input.planning || []), ...(extra.planning || [])] : extra.planning || [], day };
            jobs.push(await dayJob(header._id, total++, day, payload));
            if (jobs.length === 100) { await storeJobs(jobs); jobs = []; }
          }
        } else {
          const mainOrder = await loadOrder(input.auftragNr);
          if (!canAccess(user, mainOrder.locationV2)) fail(403, 'Für diesen Auftragsstandort fehlt die Berechtigung.');
          const queued = await Day.findOne({ auftragNr: mainOrder.auftragNr, active: true }).select('submission').lean();
          const oldOperation = mainOrder.submission ? await Submission.findById(mainOrder.submission).lean() : null;
          if (queued || (oldOperation && (oldOperation.status !== 'completed' || oldOperation.ready === false))) {
            fail(409, 'Dieser Auftrag hat eine noch nicht abgeschlossene Einreichung.', 'SUBMISSION_PENDING',
              { submissionId: queued?.submission || oldOperation._id });
          }
          staleChecks(input, mainOrder);
          group = mainOrder.auftragsgruppe ? await Group.findById(mainOrder.auftragsgruppe) : null;
          if (group && (group.activeSubmission || input.groupRevision !== group.revision)) {
            fail(409, 'Die Auftragsgruppe wurde geändert oder hat eine laufende Einreichung.',
              group.activeSubmission ? 'GROUP_PENDING' : 'GROUP_STALE', { submissionId: group.activeSubmission });
          }
          const inputs = new Map([[mainOrder.auftragNr, { ...input, req }]]);
          for (const dto of overrideInputs) {
            const order = await loadOrder(dto.auftragNr);
            if (!group || id(order.auftragsgruppe) !== id(group._id) || inputs.has(order.auftragNr)) fail(400, 'Ungültiger oder doppelter Gruppen-Tag.');
            staleChecks(dto, order);
            inputs.set(order.auftragNr, { ...dto, req });
          }
          let defaults = group ? clone(group.shiftDefaults) : [];
          const commonChanges = new Map();
          const markCommon = (field, value) => {
            if (commonChanges.has(field) && !equal(commonChanges.get(field), value)) {
              fail(400, 'Widersprüchliche Änderungen am selben gemeinsamen Feld.', 'GROUP_CHANGE_CONFLICT', { field });
            }
            commonChanges.set(field, value);
          };
          if (group) {
            for (const [number, dto] of inputs) {
              const order = number === mainOrder.auftragNr ? mainOrder : await loadOrder(number);
              const patch = orderInput(dto.order || {});
              if (own(patch, 'kundenNr') && Number(patch.kundenNr) !== Number(order.kundenNr)) fail(400, 'Der Kunde kann nicht geändert werden.');
              for (const field of ['einsatzort', 'bestelltext']) {
                const isOverride = own(dto.order, `${field}Override`) ? dto.order[`${field}Override`] === true : order[`${field}Override`];
                if (own(patch, field) && !isOverride && !equal(id(field === 'einsatzort' ? patch[field] : null) || patch[field],
                  id(field === 'einsatzort' ? order[field] : null) || order[field])) {
                  markCommon(field, patch[field]);
                  group[field] = patch[field];
                }
              }
              const saved = await Schicht.find({ auftragNr: number }).lean();
              for (const shift of dto.shifts || []) {
                const current = shift._id ? saved.find(value => id(value._id) === id(shift._id)) : null;
                if (shift._id && !current) fail(400, 'Schicht gehört nicht zum ausgewählten Tag.');
                const normalized = normalizeShift(shift, current, order.day || null);
                const key = current?.groupShiftKey;
                if (key && shift.deleted && !shift.dayOnly) { defaults = defaults.filter(value => value.key !== key); continue; }
                if (current && key) {
                  const definition = defaults.find(value => value.key === key);
                  if (!definition) continue;
                  for (const [field, value] of Object.entries(normalized.fields)) {
                    if (commonFields.has(field) && !overrideHas(normalized.overrides, field)
                      && !equal(value, baselineField(current, field))) {
                      markCommon(`${key}:${field}`, value);
                      definition.fields[field] = value;
                    }
                  }
                } else if (!current && !shift.deleted && !shift.dayOnly && !shift.groupShiftKey) {
                  if (newDefaults.has(shift.clientId)) fail(400, 'Doppelte neue gemeinsame Schicht.');
                  const seeds = (input.commonShifts || []).filter(seed => seed.clientId === shift.clientId);
                  if (seeds.length > 1) fail(400, 'Doppelte neue gemeinsame Schichtvorlage.');
                  const seed = seeds[0];
                  const common = seed ? normalizeShift(seed, null, order.day || null) : normalized;
                  if (seed && (seed._id || seed.groupShiftKey || seed.dayOnly || seed.deleted || common.overrides.length)) {
                    fail(400, 'Eine neue gemeinsame Schichtvorlage darf keine Tages-Overrides oder gespeicherte Identität enthalten.');
                  }
                  const key = crypto.randomUUID();
                  newDefaults.set(shift.clientId, key);
                  defaults.push({ key, fields: common.fields });
                }
              }
            }
            group.shiftDefaults = defaults;
            await contextValidation(req, { ...group.toObject(), eventTitel: mainOrder.eventTitel });
            group.activeSubmission = header._id;
            group.status = 'pending';
            group.revision += 1;
            if (!options.review) await group.save();
            header.group = group._id;
            header.groupRevision = group.revision;
          }
          let after = 0;
          do {
            const orders = group ? await Auftrag.find({ auftragsgruppe: group._id, auftragNr: { $gt: after } })
              .sort({ auftragNr: 1 }).limit(PAGE_SIZE).lean() : [mainOrder];
            if (!orders.length) break;
            for (const order of orders) {
              const dto = inputs.get(order.auftragNr) || { req, shifts: [], planning: [] };
              const payload = await buildEditDay(order, dto, defaults, group, newDefaults, order.auftragNr === mainOrder.auftragNr);
              const day = order.day || dayKey(order.vonDatum);
              const filesForDay = (input.attachments || []).some(attachment => attachment.day === day);
              if (hasPayloadChanges(payload, order) || filesForDay) jobs.push(await dayJob(header._id, total++, day, payload, order));
              if (jobs.length === 100) { await storeJobs(jobs); jobs = []; }
              after = order.auftragNr;
            }
            if (!group) break;
          } while (true);
        }
        if (!total) fail(400, 'Keine Änderungen übermittelt.', 'EDITOR_EMPTY');
        if (jobs.length) await storeJobs(jobs);
        header.total = total;
        const attachmentKeys = new Set();
        const attachments = [];
        for (const dto of input.attachments || []) {
          if (!dto.clientUploadId || String(dto.clientUploadId).length > 200
            || !['group', 'order'].includes(dto.relationTarget) || (dto.relationTarget === 'group' && !group)
            || !validDay(dto.day) || !String(dto.filename || '').trim()
            || !Number.isSafeInteger(dto.size) || dto.size < 0 || dto.size > 30 * 1024 * 1024) {
            fail(400, 'Eine Dokument-Vormerkung ist ungültig (maximal 30 MB pro Datei).', 'ATTACHMENT_INVALID');
          }
          const exists = options.review ? reviewRows.some(row => row.day === dto.day)
            : await Day.exists({ submission: header._id, day: dto.day });
          if (!exists) fail(400, 'Der Dokument-Tag gehört nicht zur Einreichung.', 'ATTACHMENT_INVALID');
          const key = `${dto.relationTarget}:${dto.relationTarget === 'group' ? '' : dto.day}:${dto.clientUploadId}`;
          if (attachmentKeys.has(key)) fail(400, 'Doppelte Dokument-Vormerkung.');
          attachmentKeys.add(key);
          attachments.push({ submission: header._id, clientUploadId: dto.clientUploadId,
            relationTarget: dto.relationTarget, day: dto.day, filename: dto.filename, size: dto.size });
        }
        if (!options.review && attachments.length) await Attachment.insertMany(attachments);
        header.attachmentsPending = attachments.length;
        header.ready = attachments.length === 0;
        if (!options.review) await header.save();
        const scheduling = await submissionSchedule(header._id, null, options.review ? reviewRows : null);
        let afterOrdinal = -1, meaningful = input.mode === 'create' || attachments.length > 0;
        do {
          const page = options.review ? reviewRows.filter(row => row.ordinal > afterOrdinal).slice(0, PAGE_SIZE)
            : await Day.find({ submission: header._id, ordinal: { $gt: afterOrdinal } })
              .sort({ ordinal: 1 }).limit(PAGE_SIZE).lean();
          if (!page.length) break;
          for (const row of page) {
            const order = row.auftragNr ? await loadOrder(row.auftragNr) : null;
            const metadataChanged = order && Object.entries(row.payload.metadata).some(([field, value]) => field !== 'submission' && !equal(value, order[field]));
            if (metadataChanged || Object.keys(row.payload.orderPatch).length || row.payload.shiftActions.length || row.payload.planning.length) meaningful = true;
            await validatePlanning(row.payload, order, scheduling);
            afterOrdinal = row.ordinal;
          }
        } while (true);
        if (!meaningful) fail(400, 'Keine Änderungen übermittelt.', 'EDITOR_EMPTY');
        return header._id;
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const duplicate = await Submission.findOne({ createdBy: user._id, clientSubmissionId }).lean();
      if (!duplicate) fail(409, 'Ein betroffener Auftrag hat bereits eine laufende Einreichung.', 'SUBMISSION_PENDING');
      if (duplicate.requestHash !== requestHash) fail(409, 'Diese Einreichungs-ID wurde für andere Änderungen verwendet.', 'IDEMPOTENCY_CONFLICT');
      created = duplicate._id;
    }
    if (options.review) return reviewChanges(reviewRows, options.cursor, input.attachments || []);
    return progress(req, created);
  }

  async function authorizedSubmission(req, submissionId) {
    const user = await actor(req);
    if (!mongoose.isValidObjectId(submissionId)) fail(400, 'Ungültige Einreichungs-ID.');
    const submission = await Submission.findOne({ _id: submissionId, createdBy: user._id }).lean();
    if (!submission) fail(404, 'Einreichung nicht gefunden.');
    return { submission, user };
  }
  async function progress(req, submissionId, orders) {
    const { submission } = await authorizedSubmission(req, submissionId);
    return progressData(submission, orders);
  }
  async function progressData(submission, orders) {
    const rows = await Day.find({ submission: submission._id }).select('day status error auftragNr')
      .sort({ ordinal: 1 }).lean();
    const unfinished = rows.filter(row => row.status !== 'completed');
    const manifests = await Attachment.find({ submission: submission._id }).lean();
    const attachments = [];
    const group = submission.group && manifests.some(item => item.relationTarget === 'group')
      ? await Group.findById(submission.group).select('einsatzdokumente').lean() : null;
    for (const attachment of manifests) {
      const row = rows.find(row => row.day === attachment.day);
      const order = attachment.relationTarget === 'order' && row?.auftragNr
        ? await Auftrag.findOne({ auftragNr: row.auftragNr }).select('einsatzdokumente').lean() : null;
      const document = (attachment.relationTarget === 'group' ? group : order)?.einsatzdokumente
        ?.find(doc => doc.clientUploadId === attachment.clientUploadId);
      attachments.push({ clientUploadId: attachment.clientUploadId, relationTarget: attachment.relationTarget,
        day: attachment.day, filename: attachment.filename, size: attachment.size, auftragNr: row?.auftragNr || null,
        uploaded: document?.uploadStatus === 'ready', completed: attachment.ready,
        documentId: document?._id || null });
    }
    return { id: submission._id, status: submission.status, total: submission.total, completed: submission.completed,
      failedDays: unfinished.filter(item => item.status === 'failed').map(item => item.day),
      pendingDays: unfinished.filter(item => item.status === 'pending').map(item => item.day),
      errors: unfinished.filter(item => item.error).map(item => ({ day: item.day, ...item.error })),
      attachmentsPending: submission.attachmentsPending || 0,
      ready: submission.status === 'completed' && submission.ready !== false,
      attachments,
      targets: rows.map(row => ({ day: row.day, auftragNr: row.auftragNr || null, status: row.status })),
      ...(orders ? { orders } : {}) };
  }
  function mutationFields(fields) {
    return Object.fromEntries(Object.entries(fields).filter(([field]) => shiftFields.has(field) || INFO_FIELDS.includes(field)));
  }
  async function dayJob(submissionId, ordinal, day, payload, existing = null) {
    const state = await effectiveState(payload, existing);
    const windows = state.shifts.map(shiftWindow);
    const existingStaff = existing ? await Einsatz.exists({ auftragNr: existing.auftragNr }) : null;
    return { submission: submissionId, ordinal, day, payload, ...(existing ? { auftragNr: existing.auftragNr } : {}),
      scheduleRelevant: Boolean(existingStaff || payload.planning.some(operation => operation.type === 'assign')),
      ...(windows.length ? { windowStart: new Date(Math.min(...windows.map(window => window.start.getTime()))),
        windowEnd: new Date(Math.max(...windows.map(window => window.end.getTime()))) } : {}) };
  }
  async function submissionSchedule(submissionId, batch = null, virtualRows = null) {
    const removedEinsatzIds = [], stagedDeployments = [];
    const windows = batch?.filter(row => row.windowStart && row.windowEnd)
      .map(row => ({ windowStart: { $lt: row.windowEnd }, windowEnd: { $gt: row.windowStart } }));
    let after = -1;
    do {
      const rows = virtualRows ? virtualRows.filter(row => row.scheduleRelevant && row.ordinal > after).slice(0, PAGE_SIZE)
        : await Day.find({ submission: submissionId, status: { $ne: 'completed' },
        scheduleRelevant: true, ordinal: { $gt: after }, ...(windows?.length ? { $or: windows } : {}) })
        .sort({ ordinal: 1 }).limit(PAGE_SIZE).lean();
      if (!rows.length) break;
      for (const row of rows) {
        const existing = row.auftragNr ? await loadOrder(row.auftragNr) : null;
        const state = await effectiveState(row.payload, existing);
        const assignments = existing ? await Einsatz.find({ auftragNr: existing.auftragNr }).lean() : [];
        removedEinsatzIds.push(...assignments.map(assignment => id(assignment._id)));
        const removed = new Set(row.payload.planning.filter(operation => operation.type === 'remove').map(operation => id(operation.einsatzId)));
        for (const assignment of assignments) {
          if (removed.has(id(assignment._id))) continue;
          const shift = state.shifts.find(item => id(item._id) === id(assignment.schicht)
            || (assignment.idAuftragArbeitsschichten != null && assignment.idAuftragArbeitsschichten === item.idAuftragArbeitsschichten));
          if (shift) stagedDeployments.push({ ...assignment, ...shift, _id: assignment._id, schicht: shift._id,
            personalNr: assignment.personalNr, auftragNr: existing.auftragNr });
        }
        for (const operation of row.payload.planning.filter(value => value.type === 'assign')) {
          const shift = planningShift(state.shifts, operation);
          const employee = await Mitarbeiter.findById(operation.mitarbeiterId).lean();
          if (!shift || !employee) fail(400, 'Mitarbeiter oder Schicht der vorgemerkten Planung nicht gefunden.');
          stagedDeployments.push({ ...shift, _id: `staged:${row.day}:${shiftKey(shift)}:${employee._id}`,
            schicht: mongoose.isValidObjectId(shift._id) ? shift._id : `${row.day}:${shift.clientId}`,
            personalNr: Number(employee.personalnr), auftragNr: existing?.auftragNr || 0 });
        }
        after = row.ordinal;
      }
    } while (true);
    return { removedEinsatzIds, stagedDeployments };
  }
  async function reviewChanges(rows, cursor, attachments) {
    if (cursor && !/^\d+$/.test(String(cursor))) fail(400, 'Ungültiger Review-Cursor.');
    const offset = Number(cursor || 0);
    const affected = [];
    for (const row of rows) {
      const existing = row.auftragNr ? await loadOrder(row.auftragNr) : null;
      const before = existing ? await snapshot(existing.auftragNr) : {};
      const state = await effectiveState(row.payload, existing);
      const order = { ...state.order, ...row.payload.metadata, _id: existing?._id || `new:${row.day}` };
      for (const shift of state.shifts) {
        const action = row.payload.shiftActions.find(value => value._id === id(shift._id)
          || (value.clientId && value.clientId === shift.clientId));
        const renderContextChanged = Object.keys(row.payload.orderPatch).some(field => ['eventTitel', 'einsatzort',
          'vonDatum', 'bisDatum', 'locationV2'].includes(field));
        if (!action && !renderContextChanged) continue;
        const fields = action?.fields || {};
        const oldShift = before.Schicht?.find(value => id(value._id) === id(shift._id));
        const selectionChanged = ['berufSchl', 'qualSchl'].some(field => own(fields, field) && !equal(fields[field], oldShift?.[field]));
        shift.einsatzinformation = await helpers.renderShiftInformation({ auftrag: order, schicht: shift,
          sourceHtml: own(fields, 'einsatzinformationSourceHtml') ? fields.einsatzinformationSourceHtml : oldShift?.einsatzinformation?.sourceHtml,
          customized: own(fields, 'einsatzinformationCustomized') ? fields.einsatzinformationCustomized : oldShift?.einsatzinformation?.customized,
          forceTemplate: Boolean(fields.applyLatestTemplate || (selectionChanged && !oldShift?.einsatzinformation?.customized)
            || (own(row.payload.orderPatch, 'einsatzort') && !oldShift?.einsatzinformation?.customized)) });
      }
      const assignments = (before.Einsatz || []).map(assignment => ({ ...assignment }));
      const removed = new Set(row.payload.planning.filter(operation => operation.type === 'remove').map(operation => id(operation.einsatzId)));
      const deleted = new Set(row.payload.shiftActions.filter(action => action.type === 'delete').map(action => action._id));
      const deletedLegacyKeys = new Set((before.Schicht || []).filter(shift => deleted.has(id(shift._id)))
        .map(shift => shift.idAuftragArbeitsschichten).filter(value => value != null));
      const afterAssignments = assignments.filter(assignment => !removed.has(id(assignment._id)) && !deleted.has(id(assignment.schicht))
        && !deletedLegacyKeys.has(assignment.idAuftragArbeitsschichten));
      for (const action of row.payload.shiftActions.filter(action => action.type === 'patch')) {
        const oldShift = before.Schicht?.find(shift => id(shift._id) === action._id);
        for (const assignment of afterAssignments.filter(assignment => id(assignment.schicht) === action._id
          || (oldShift?.idAuftragArbeitsschichten != null && assignment.idAuftragArbeitsschichten === oldShift.idAuftragArbeitsschichten))) {
          for (const [field, value] of Object.entries(action.fields)) {
            if (field === 'bezeichnung') assignment.schichtBezeichnung = value;
            else if (shiftFields.has(field)) assignment[field] = value;
            if (field === 'datumVon') assignment.detailDatumVon = value;
            if (field === 'datumBis') assignment.detailDatumBis = value;
          }
        }
      }
      for (const operation of row.payload.planning.filter(operation => operation.type === 'assign')) {
        const employee = await Mitarbeiter.findById(operation.mitarbeiterId).lean();
        const shift = planningShift(state.shifts, operation);
        afterAssignments.push({ ...shift, _id: `planned:${shiftKey(shift)}:${employee._id}`,
          personalNr: Number(employee.personalnr), schicht: shift._id, schichtBezeichnung: shift.bezeichnung,
          conflictOverride: operation.conflictOverride });
      }
      const after = { Auftrag: [order], Schicht: state.shifts, Einsatz: afterAssignments };
      const changes = buildChanges(before, after, await employeeNames(before, after))
        .flatMap(change => change.fields.map(field => ({ key: `${change.entity}:${change.entityId}:${field.field}`,
          label: `${change.label} · ${field.label}`, before: field.before, after: field.after, kind: change.action,
          ...(change.entity === 'Schicht' ? { shiftId: change.entityId } : {}) })));
      for (const attachment of attachments.filter(item => item.relationTarget === 'group' || item.day === row.day)) {
        changes.push({ key: `attachment:${attachment.clientUploadId}`, label: 'Bestellungsdokument',
          before: null, after: attachment.filename, kind: 'created' });
      }
      if (changes.length) affected.push({ auftragNr: row.auftragNr || null, day: row.day, changes });
    }
    return { orders: affected.slice(offset, offset + PAGE_SIZE), totalAffected: affected.length,
      nextCursor: offset + PAGE_SIZE < affected.length ? String(offset + PAGE_SIZE) : null, errors: [] };
  }
  async function applyDay(req, header, row) {
    const payload = row.payload;
    let order = row.auftragNr ? await loadOrder(row.auftragNr) : null;
    if (order) staleChecks(payload, order);
    if (order && payload.shiftVersions) {
      const saved = await Schicht.find({ auftragNr: order.auftragNr }).select('_id updatedAt').lean();
      if (saved.length !== payload.shiftVersions.length || payload.shiftVersions.some(version => {
        const current = saved.find(shift => id(shift._id) === id(version._id));
        return !current || !compareUpdated(version.updatedAt, current.updatedAt);
      })) fail(409, 'Eine Schicht wurde seit der Einreichung geändert.', 'SHIFT_STALE');
    }
    await contextValidation(req, { ...(order || {}), ...payload.orderPatch });
    await validatePlanning(payload, order, req.editorScheduling);
    const before = order ? await snapshot(order.auftragNr) : {};
    if (!order) {
      const body = { ...payload.orderPatch };
      delete body.day;
      order = await invokeMutation('post', '/', req, {}, body);
      await Auftrag.updateOne({ _id: order._id }, { $set: payload.metadata });
      order = await Auftrag.findById(order._id).lean();
    } else {
      const patch = Object.fromEntries(Object.entries(payload.orderPatch).filter(([field, value]) => !equal(value,
        order[field] instanceof Date ? order[field].toISOString() : order[field])));
      if (Object.keys(patch).length) await invokeMutation('patch', '/:auftragNr', req, { auftragNr: String(order.auftragNr) }, patch);
      await Auftrag.updateOne({ _id: order._id }, { $set: payload.metadata });
    }
    const params = { auftragNr: String(order.auftragNr) };
    const shiftMap = new Map();
    for (const action of payload.shiftActions) {
      if (action.type === 'delete') {
        await invokeMutation('delete', '/:auftragNr/schichten/:schichtId', req, { ...params, schichtId: action._id }, {});
        continue;
      }
      let shift;
      const fields = mutationFields(action.fields);
      if (action.type === 'create') shift = await invokeMutation('post', '/:auftragNr/schichten', req, params, fields);
      else if (Object.keys(fields).length) shift = await invokeMutation('patch', '/:auftragNr/schichten/:schichtId', req,
        { ...params, schichtId: action._id }, fields);
      else shift = await Schicht.findById(action._id).lean();
      await Schicht.updateOne({ _id: shift._id }, { $set: { overrides: action.overrides || [],
        ...(action.groupShiftKey ? { groupShiftKey: action.groupShiftKey } : {}),
        ...(action.clientId ? { clientId: action.clientId } : {}),
        ...(order.day ? { day: order.day, endDayOffset: action.fields.endDayOffset
          ?? shift.endDayOffset ?? Math.max(0, dayOffset(shift.datumVon, shift.datumBis)) } : {}) } });
      if (order.day) {
        const updatedShift = await Schicht.findById(shift._id).select('endDayOffset').lean();
        await Einsatz.updateMany({ auftragNr: order.auftragNr, schicht: shift._id },
          { $set: { day: order.day, endDayOffset: updatedShift.endDayOffset } });
      }
      if (action.clientId) shiftMap.set(action.clientId, id(shift._id));
    }
    for (const shift of await Schicht.find({ auftragNr: order.auftragNr }).lean()) {
      if (shift.clientId) shiftMap.set(shift.clientId, id(shift._id));
    }
    // Removals are applied before additions so replacement/move previews and commit see the same final state.
    for (const operation of payload.planning.filter(value => value.type === 'remove')) {
      await invokeMutation('delete', '/:auftragNr/einsaetze/:einsatzId', req, { ...params, einsatzId: operation.einsatzId }, {});
    }
    for (const operation of payload.planning.filter(value => value.type === 'assign')) {
      const current = await Auftrag.findById(order._id).lean();
      const logicalShift = operation.schichtId || operation.clientShiftId;
      await invokeMutation('put', '/:auftragNr/planning', { ...req,
        editorConflictKey: `staged:${row.day}:${logicalShift}:${operation.mitarbeiterId}` }, params, {
        planningVersion: current.planningVersion || 0, includeOtherLocations: operation.includeOtherLocations === true,
        operations: [{ ...operation, schichtId: operation.schichtId || shiftMap.get(operation.clientShiftId) }],
      });
    }
    const current = await Auftrag.findById(order._id).lean();
    await validatePlanning({ ...payload, orderPatch: {}, shiftActions: [], planning: [] }, current,
      req.editorScheduling);
    await Auftrag.updateOne({ _id: order._id }, { $inc: { planningVersion: 1 }, $max: { wizardStep: 3 } });
    await recordOrderChanges(before, await snapshot(order.auftragNr), await actor(req),
      header.mode === 'create' ? 'Auftrag.created' : 'planning.updated');
    await Day.updateOne({ _id: row._id, status: { $ne: 'completed' } }, {
      $set: { status: 'completed', active: false, auftragNr: order.auftragNr, error: null },
    });
    return order.auftragNr;
  }
  async function process(req, submissionId) {
    const { submission } = await authorizedSubmission(req, submissionId);
    if (submission.status === 'completed') return progress(req, submissionId, []);
    const leaseToken = crypto.randomUUID();
    const claimed = await Submission.findOneAndUpdate({
      _id: submission._id, status: { $ne: 'completed' },
      $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }],
    }, { $set: { status: 'processing', leaseToken, leaseUntil: new Date(Date.now() + 5 * 60000) } }, { new: true }).lean();
    if (!claimed) fail(409, 'Diese Einreichung wird gerade verarbeitet.', 'SUBMISSION_BUSY');
    const rows = await Day.find({ submission: submission._id, status: { $in: ['pending', 'failed'] } })
      .sort({ ordinal: 1 }).limit(BATCH_SIZE).lean();
    let numbers = [];
    try {
      numbers = await mongoose.connection.transaction(async () => {
        const lock = await Submission.findOne({ _id: submission._id, leaseToken }).lean();
        if (!lock) fail(409, 'Die Verarbeitungsreservierung ist abgelaufen.', 'SUBMISSION_BUSY');
        if (claimed.group) {
          const group = await Group.findOne({ _id: claimed.group, activeSubmission: claimed._id, revision: claimed.groupRevision }).lean();
          if (!group) fail(409, 'Die Gruppe wurde zwischenzeitlich geändert.', 'GROUP_STALE');
        }
        const completedNumbers = [];
        const scheduling = await submissionSchedule(claimed._id, rows);
        for (const row of rows) completedNumbers.push(await applyDay({ ...req, editorScheduling: scheduling }, claimed, row));
        const updated = await Submission.findOneAndUpdate({ _id: claimed._id, leaseToken },
          { $inc: { completed: rows.length }, $set: { leaseToken: null, leaseUntil: null } }, { new: true });
        const completed = updated.completed === updated.total;
        updated.status = completed ? 'completed' : 'pending';
        await updated.save();
        if (claimed.group) await Group.updateOne({ _id: claimed.group, activeSubmission: claimed._id },
          { $set: { status: completed ? updated.ready ? 'completed' : 'incomplete' : 'processing',
            ...(completed && updated.ready ? { activeSubmission: null } : {}) } });
        return completedNumbers;
      });
    } catch (error) {
      const detail = { code: error.code || 'BATCH_FAILED', message: error.message, ...(error.details ? { details: error.details } : {}) };
      await Day.updateMany({ _id: { $in: rows.map(row => row._id) }, status: { $ne: 'completed' } }, { $set: { status: 'failed', error: detail } });
      await Submission.updateOne({ _id: claimed._id, leaseToken }, { $set: { status: 'incomplete', leaseToken: null, leaseUntil: null } });
      if (claimed.group) await Group.updateOne({ _id: claimed.group, activeSubmission: claimed._id }, { $set: { status: 'incomplete' } });
    }
    const orders = [];
    for (const number of numbers) orders.push(await readDetails(req, number));
    return progress(req, submissionId, orders);
  }
  async function complete(req, submissionId) {
    const { submission, user } = await authorizedSubmission(req, submissionId);
    if (submission.status !== 'completed') fail(409, 'Die Tagesaufträge sind noch nicht vollständig gespeichert.', 'SUBMISSION_PENDING');
    if (submission.ready !== false) return progress(req, submissionId, []);
    await mongoose.connection.transaction(async () => {
      const attachments = await Attachment.find({ submission: submission._id }).lean();
      const missing = [];
      for (const attachment of attachments) {
        const row = await Day.findOne({ submission: submission._id, day: attachment.day, status: 'completed' }).lean();
        const order = row?.auftragNr ? await loadOrder(row.auftragNr) : null;
        if (!order || !canAccess(user, order.locationV2)) fail(403, 'Für diesen Dokument-Auftrag fehlt die Berechtigung.');
        const owner = attachment.relationTarget === 'group' ? await Group.findById(submission.group).lean() : order;
        const document = owner?.einsatzdokumente?.find(doc => doc.clientUploadId === attachment.clientUploadId
          && doc.uploadStatus === 'ready' && doc.type === 'bestellung' && doc.scope === 'monitor');
        const safeName = attachment.filename.replace(/[/\\:*?"<>|]/g, '_');
        if (!document || document.size !== attachment.size || document.filename !== safeName) {
          missing.push({ day: attachment.day, clientUploadId: attachment.clientUploadId, relationTarget: attachment.relationTarget });
        }
      }
      if (missing.length) fail(409, 'Bestellungsdokumente fehlen oder sind noch nicht vollständig hochgeladen.',
        'ATTACHMENTS_PENDING', { attachments: missing });
      await Attachment.updateMany({ submission: submission._id }, { $set: { ready: true } });
      await Submission.updateOne({ _id: submission._id }, { $set: { attachmentsPending: 0, ready: true } });
      if (submission.group) await Group.updateOne({ _id: submission.group, activeSubmission: submission._id },
        { $set: { activeSubmission: null, status: 'completed' } });
    });
    return progress(req, submissionId, []);
  }
  return { getContext, candidates, submit, process, progress,
    review: (req, input, cursor) => submit(req, input, { review: true, cursor }), complete, BATCH_SIZE };
};
