const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Location = require('../../models/System/Location');
const models = require('../../models/Tariffs/TariffData');
const domain = require('./tariffDomain');

function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function objectId(value) {
  if (!/^[a-f\d]{24}$/i.test(String(value || ''))) fail(400, 'Ungültige Datensatz-ID.');
  return String(value);
}
// HTTP routes always supply the authenticated admin ID. Only a trusted local
// script can explicitly identify a CLI action without attributing it to a user.
function actorMetadata(userId, actor) {
  if (actor?.kind === 'CLI') {
    if (userId || !actor.label || !actor.script) fail(400, 'Eine CLI-Aktion benötigt ihre Herkunft und darf keinen Benutzer vertreten.');
    return { kind: 'CLI', userId: null, label: String(actor.label), script: String(actor.script) };
  }
  if (!userId || (actor && actor.kind !== 'USER')) fail(400, 'Ein Import benötigt einen angemeldeten Benutzer oder eine ausdrückliche CLI-Herkunft.');
  return { kind: 'USER', userId: objectId(userId) };
}
function serialize(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value._bsontype === 'Decimal128' || value._bsontype === 'ObjectId') return value.toString();
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [key, serialize(item)]));
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}
function canonical(value, sourceColumns = false) {
  if (Array.isArray(value)) return value.map(item => canonical(item, sourceColumns)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') {
    if (value._bsontype || value instanceof Date) return serialize(value);
    return Object.fromEntries(Object.keys(value).sort().filter(key => sourceColumns || !['_id', 'importId', 'employeeName'].includes(key)).map(key => [key, !sourceColumns && key === 'source' ? canonical(value[key]?.raw || {}, true) : canonical(value[key], sourceColumns)]));
  }
  return value;
}
function datasetHash(dataset, context = null) {
  const data = Object.fromEntries(['contract', 'groups', 'periods', 'assignments', 'allowances'].map(key => [key, dataset[key]]));
  return crypto.createHash('sha256').update(JSON.stringify({ data: canonical(data), context })).digest('hex');
}
function allowanceHistoryHash(rows) {
  return datasetHash({ allowances: domain.mergeAllowanceHistory(rows).allowances });
}
function assignmentHistoryHash(rows) {
  return datasetHash({ assignments: domain.mergeAssignmentHistory(rows).assignments });
}
async function activeId() {
  const catalog = await models.Catalog.findById('17055').lean();
  return catalog?.activeImportId ? String(catalog.activeImportId) : null;
}
async function dataset(importId, employeeId) {
  if (!importId) return { contract: null, groups: [], periods: [], assignments: [], allowances: [] };
  const filter = { importId };
  const employeeFilter = employeeId ? { ...filter, employeeId } : filter;
  const [contract, groups, periods, assignments, allowances] = await Promise.all([
    models.Contract.findOne(filter).lean(), models.Group.find(filter).sort({ legacyId: 1 }).lean(),
    models.Period.find(filter).sort({ validFrom: -1, legacyId: 1 }).lean(),
    models.Assignment.find(employeeFilter).sort({ validFrom: -1, legacyId: 1 }).lean(),
    models.Allowance.find(employeeFilter).sort({ validFrom: -1, legacyId: 1 }).lean(),
  ]);
  return serialize({ contract, groups, periods, assignments, allowances });
}
function summary(record, currentId, includeIssues = true) {
  if (!record) return null;
  const value = serialize(record);
  value.active = String(value._id) === currentId;
  value.status = value.active ? 'ACTIVE' : value.activatedAt ? 'SUPERSEDED' : value.status;
  if (!includeIssues) delete value.issues;
  return value;
}

async function catalog() {
  const currentId = await activeId();
  const [data, record] = await Promise.all([
    // Employee rows are intentionally not part of the overview response.
    currentId ? Promise.all([
      models.Contract.findOne({ importId: currentId }).lean(),
      models.Group.find({ importId: currentId }).sort({ legacyId: 1 }).lean(),
      models.Period.find({ importId: currentId }).sort({ validFrom: -1 }).lean(),
    ]).then(([contract, groups, periods]) => ({ contract, groups, periods })) : { contract: null, groups: [], periods: [] },
    currentId ? models.Import.findById(currentId).lean() : null,
  ]);
  return serialize({ activeImportId: currentId, import: summary(record, currentId), ...data, counts: record?.counts || {} });
}
async function imports() {
  const currentId = await activeId();
  const records = await models.Import.find({ status: { $ne: 'BUILDING' } }).sort({ createdAt: -1 }).limit(50).lean();
  return { activeImportId: currentId, data: records.map(record => summary(record, currentId, false)) };
}
async function getImport(id) {
  const record = await models.Import.findById(objectId(id)).lean();
  if (!record || record.status === 'BUILDING') fail(404, 'Importlauf nicht gefunden.');
  const currentId = await activeId();
  const value = summary(record, currentId);
  if (record.status === 'READY') {
    const [previous, next] = await Promise.all([dataset(currentId), dataset(id)]);
    value.changes = domain.compareDatasets(previous, next);
    value.requiresNewPreview = !value.active && (
      (record.partialImportRoles?.length && String(record.basedOnImportId || '') !== String(currentId || '')) ||
      !record.assignmentHistory || record.assignmentHistory.basedOnHash !== assignmentHistoryHash(previous.assignments) ||
      !record.allowanceHistory || record.allowanceHistory.basedOnHash !== allowanceHistoryHash(previous.allowances)
    );
    if (!value.requiresNewPreview) value.basedOnImportId = currentId;
  }
  return { ...value, activeImportId: currentId };
}
async function removeDataset(id) {
  await Promise.all([models.Contract, models.Group, models.Period, models.Assignment, models.Allowance].map(model => model.deleteMany({ importId: id })));
}
async function preview(files, userId, actor) {
  const createdActor = actorMetadata(userId, actor);
  const parsed = domain.parseFiles(files, { allowPartial: true });
  if (!parsed.files.length) fail(400, 'Wähle mindestens eine Tarifdatei für die Importvorschau aus.');
  parsed.files = parsed.files.map(file => ({ ...file,
    label: domain.TABLES.find(table => table.key === file.key)?.label || file.key,
    rowCount: file.rows,
    checksum: crypto.createHash('sha256').update(files.find(upload => upload.fieldname === file.key).buffer).digest('hex'),
  }));
  const currentId = await activeId();
  const previous = await dataset(currentId);
  const partialImportRoles = parsed.files.length < domain.TABLES.length ? parsed.files.map(file => file.key) : [];
  if (partialImportRoles.length && !currentId) fail(409, 'Ein Teilimport benötigt zuerst einen aktivierten vollständigen Tarifstand.');
  const importData = partialImportRoles.length ? domain.completePartialDataset(parsed, previous) : parsed;
  const personalNumbers = domain.collectPersonalNumbers(importData);
  // Match the canonical number in the domain. Exact $in queries would miss
  // aliases with leading zeroes and could conceal ambiguous employee matches.
  const employees = personalNumbers.length ? await Mitarbeiter.find({}).select('_id personalnr personalnrHistory vorname nachname').lean() : [];
  const next = domain.buildDataset(importData, employees);
  const mergedAssignments = domain.mergeAssignmentHistory(previous.assignments, next.assignments, next.issues);
  next.assignments = mergedAssignments.assignments;
  next.issues = mergedAssignments.issues;
  next.counts.employeeAssignments = mergedAssignments.assignments.length;
  const assignmentHistory = { ...mergedAssignments.history, basedOnHash: assignmentHistoryHash(previous.assignments) };
  const allowanceUpload = partialImportRoles.length && !partialImportRoles.includes('aboveTariff') ? [] : next.allowances;
  const mergedAllowances = domain.mergeAllowanceHistory(previous.allowances, allowanceUpload, next.issues);
  next.allowances = mergedAllowances.allowances;
  next.issues = mergedAllowances.issues;
  next.counts.aboveTariff = mergedAllowances.allowances.length;
  const allowanceHistory = { ...mergedAllowances.history, basedOnHash: allowanceHistoryHash(previous.allowances) };
  const errorCount = next.issues.filter(issue => issue.severity === 'ERROR').length;
  // Invalid previews also include source errors in their hash, so unrelated
  // malformed uploads cannot collapse to the same empty draft.
  const contentHash = errorCount
    ? crypto.createHash('sha256').update(JSON.stringify({ files: parsed.files, partialImportRoles, issues: next.issues })).digest('hex')
    : datasetHash(next, { partialImportRoles });
  let record = await models.Import.findOne({ contentHash }).lean();
  if (record?.status === 'BUILDING') {
    // Recover abandoned preparations after a process restart. The old worker
    // cannot finish without its import record and never publishes its rows.
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const removed = await models.Import.deleteOne({ _id: record._id, status: 'BUILDING', updatedAt: { $lte: cutoff } });
    if (!removed.deletedCount) fail(409, 'Dieser Import wird bereits vorbereitet. Bitte erneut laden.');
    await removeDataset(record._id);
    record = null;
  }
  if (record) {
    // A fresh upload explicitly reviews this merged snapshot against the current
    // history. Merely reopening a stale draft must never rebase it silently.
    await models.Import.updateOne({ _id: record._id }, { $set: { partialImportRoles, assignmentHistory, allowanceHistory, basedOnImportId: currentId } });
    return { ...summary(record, currentId), partialImportRoles, assignmentHistory, allowanceHistory, changes: domain.compareDatasets(previous, next), basedOnImportId: currentId, duplicate: true, activeImportId: currentId };
  }
  const id = new mongoose.Types.ObjectId();
  const attributes = {
    _id: id, contentHash, status: 'BUILDING', files: parsed.files, partialImportRoles, counts: next.counts,
    issues: next.issues, errorCount, warningCount: next.issues.filter(issue => issue.severity === 'WARNING').length,
    changes: domain.compareDatasets(previous, next), basedOnImportId: currentId, assignmentHistory, allowanceHistory, createdBy: userId || null, createdActor,
  };
  try { await models.Import.create(attributes); }
  catch (error) {
    if (error.code !== 11000) throw error;
    record = await models.Import.findOne({ contentHash }).lean();
    if (!record || record.status === 'BUILDING') fail(409, 'Dieser Import wird bereits vorbereitet. Bitte erneut laden.');
    await models.Import.updateOne({ _id: record._id }, { $set: { partialImportRoles, assignmentHistory, allowanceHistory, basedOnImportId: currentId } });
    return { ...summary(record, currentId), partialImportRoles, assignmentHistory, allowanceHistory, changes: attributes.changes, basedOnImportId: currentId, duplicate: true, activeImportId: currentId };
  }
  try {
    if (!errorCount) {
      const insert = async (model, rows) => {
        if (rows.length) await model.insertMany(rows.map((row, index) => ({ ...row, legacyId: row.legacyId || `source-row:${index + 1}`, importId: id })));
      };
      // Never publish the pointer until every collection has been saved.
      await insert(models.Contract, next.contract ? [next.contract] : []);
      await insert(models.Group, next.groups);
      await insert(models.Period, next.periods);
      await insert(models.Assignment, next.assignments);
      await insert(models.Allowance, next.allowances);
    }
    const finished = await models.Import.updateOne({ _id: id, status: 'BUILDING' }, { $set: { status: errorCount ? 'INVALID' : 'READY' } });
    if (!finished.modifiedCount) fail(409, 'Die Importvorbereitung ist abgelaufen. Bitte erneut prüfen.');
  } catch (error) {
    await removeDataset(id);
    await models.Import.deleteOne({ _id: id });
    throw error;
  }
  return { ...summary(await models.Import.findById(id).lean(), currentId), duplicate: false, activeImportId: currentId };
}
async function activate(id, expectedActiveImportId, userId, actor) {
  const activatedActor = actorMetadata(userId, actor);
  objectId(id);
  if (expectedActiveImportId === undefined) fail(400, 'Der erwartete aktive Importlauf muss angegeben werden.');
  if (expectedActiveImportId !== null) objectId(expectedActiveImportId);
  const record = await models.Import.findById(id).lean();
  if (!record) fail(404, 'Importlauf nicht gefunden.');
  if (record.status !== 'READY' || record.errorCount) fail(409, 'Dieser Importlauf kann nicht aktiviert werden.');
  try { await models.Catalog.updateOne({ _id: '17055' }, { $setOnInsert: { activeImportId: null, revision: 0 } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const currentId = await activeId();
  if (currentId === String(id)) return { activeImportId: currentId, import: summary(record, currentId) };
  const current = await dataset(currentId);
  if (record.partialImportRoles?.length && String(record.basedOnImportId || '') !== String(currentId || '')) {
    fail(409, 'Der aktive Tarifstand hat sich seit diesem Teilimport geändert. Bitte die Teilimport-Vorschau erneut erstellen.');
  }
  if (!record.assignmentHistory || record.assignmentHistory.basedOnHash !== assignmentHistoryHash(current.assignments) ||
    !record.allowanceHistory || record.allowanceHistory.basedOnHash !== allowanceHistoryHash(current.allowances)) {
    fail(409, 'Die Tarif-Personal- oder ÜTZ-Historie hat sich seit dieser Vorschau geändert. Bitte die Dateien erneut prüfen, damit alle bisherigen Zeilen erhalten bleiben.');
  }
  const updated = await models.Catalog.findOneAndUpdate({ _id: '17055', activeImportId: expectedActiveImportId }, {
    $set: { activeImportId: id }, $inc: { revision: 1 },
  }, { new: true }).lean();
  if (!updated) fail(409, 'Der aktive Tarifstand wurde zwischenzeitlich geändert. Bitte Vorschau erneut laden.');
  await models.Import.updateOne({ _id: id }, { $set: { activatedAt: new Date(), activatedBy: userId || null, activatedActor } });
  return { activeImportId: String(id), import: summary(await models.Import.findById(id).lean(), String(id)) };
}
function employeeEntry(row) {
  return { key: row.employeeId ? String(row.employeeId) : `personal:${row.personalNr}`, employeeId: row.employeeId ? String(row.employeeId) : null,
    personalNr: row.personalNr, employeeName: row.employeeName || '', matchStatus: row.matchStatus, assignmentCount: 0, allowanceCount: 0 };
}
function activeEmployeeEntry(employee, location, counts) {
  const employeeId = String(employee._id);
  const personalNumbers = [...new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry?.value)].filter(Boolean).map(String))];
  return {
    key: employeeId,
    employeeId,
    employeeName: [employee.vorname, employee.nachname].filter(Boolean).join(' ').trim(),
    personalNr: employee.personalnr || '',
    personalNumbers,
    location: location ? { _id: String(location._id), shortName: location.shortName, nameFull: location.nameFull, color: location.color } : null,
    matchStatus: 'MATCHED',
    assignmentCount: counts?.assignmentCount || 0,
    allowanceCount: counts?.allowanceCount || 0,
    hasTariffAssignment: Boolean(counts?.assignmentCount),
  };
}
async function employees({ search = '', page = 1, pageSize = 50, locationId = null, tariff = 'all' } = {}) {
  if (!['all', 'missing'].includes(String(tariff))) fail(400, 'Ungültiger Tarifzuordnungsfilter.');
  if (locationId && !mongoose.isValidObjectId(locationId)) fail(400, 'Ungültiger Standortfilter.');
  const employeeFilter = { isActive: true, ...(locationId ? { locationV2: locationId } : {}) };
  const currentId = await activeId();
  const [activeEmployees, locations] = await Promise.all([
    Mitarbeiter.find(employeeFilter).select('_id vorname nachname personalnr personalnrHistory locationV2').lean(),
    Location.find({ isActive: true }).select('_id shortName nameFull color').sort({ shortName: 1 }).lean(),
  ]);
  const employeeIds = activeEmployees.map(employee => employee._id);
  const projection = 'employeeId';
  const [assignments, allowances] = currentId && employeeIds.length ? await Promise.all([
    models.Assignment.find({ importId: currentId, employeeId: { $in: employeeIds }, matchStatus: 'MATCHED' }).select(projection).lean(),
    models.Allowance.find({ importId: currentId, employeeId: { $in: employeeIds }, matchStatus: 'MATCHED' }).select(projection).lean(),
  ]) : [[], []];
  const counts = new Map();
  for (const [rows, countField] of [[assignments, 'assignmentCount'], [allowances, 'allowanceCount']]) {
    for (const row of rows) {
      const key = String(row.employeeId);
      if (!counts.has(key)) counts.set(key, { assignmentCount: 0, allowanceCount: 0 });
      counts.get(key)[countField] += 1;
    }
  }
  const locationsById = new Map(locations.map(location => [String(location._id), location]));
  const needle = String(search).trim().toLocaleLowerCase('de');
  const rows = activeEmployees.map(employee => activeEmployeeEntry(employee, locationsById.get(String(employee.locationV2)), counts.get(String(employee._id))))
    .filter(item => String(tariff) !== 'missing' || !item.hasTariffAssignment)
    .filter(item => `${item.employeeName} ${item.personalNumbers.join(' ')}`.toLocaleLowerCase('de').includes(needle))
    .sort((left, right) => `${left.employeeName} ${left.personalNr}`.localeCompare(`${right.employeeName} ${right.personalNr}`, 'de'));
  const pageNumber = Number(page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) fail(400, 'Ungültige Seitennummer.');
  const pageSizeNumber = Number(pageSize);
  if (![25, 50, 100].includes(pageSizeNumber)) fail(400, 'Ungültige Seitengröße.');
  return serialize({ data: rows.slice((pageNumber - 1) * pageSizeNumber, pageNumber * pageSizeNumber), total: rows.length, page: pageNumber, pageSize: pageSizeNumber, locations });
}
async function history(key) {
  const currentId = await activeId();
  const isPersonal = String(key || '').startsWith('personal:');
  const personalNr = isPersonal ? String(key).slice(9) : null;
  if (isPersonal && !/^\d+$/.test(personalNr)) fail(400, 'Ungültige Personalnummer.');
  const filter = { importId: currentId, ...(isPersonal ? { personalNr, employeeId: null } : { employeeId: objectId(key) }) };
  const employee = !isPersonal ? await Mitarbeiter.findById(key).select('_id vorname nachname personalnr personalnrHistory locationV2').lean() : null;
  if (!isPersonal && !employee) fail(404, 'Mitarbeiter nicht gefunden.');
  if (!currentId) {
    if (isPersonal) fail(404, 'Noch kein Tarifstand aktiviert.');
    return { employee: activeEmployeeEntry(employee, null, null), assignments: [], allowances: [], groups: [], contract: null, activeImportId: null };
  }
  const [assignments, allowances] = await Promise.all([
    models.Assignment.find(filter).sort({ validFrom: -1 }).lean(), models.Allowance.find(filter).sort({ validFrom: -1 }).lean(),
  ]);
  if (isPersonal && !assignments.length && !allowances.length) fail(404, 'Keine Tarifhistorie gefunden.');
  const groupIds = [...new Set(assignments.map(assignment => assignment.employeeGroupId))];
  const [contract, groups] = await Promise.all([
    models.Contract.findOne({ importId: currentId }).lean(),
    models.Group.find({ importId: currentId, legacyId: { $in: groupIds } }).lean(),
  ]);
  return serialize({ employee: employee ? activeEmployeeEntry(employee, null, { assignmentCount: assignments.length, allowanceCount: allowances.length }) : employeeEntry(assignments[0] || allowances[0]), assignments, allowances, contract, groups, activeImportId: currentId });
}
function currentTariffDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function validateRead(employeeId, date) {
  objectId(employeeId);
  let validDate = false;
  try { validDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && domain.dateString(date) === date; }
  catch (_) { /* Invalid calendar dates are client input errors. */ }
  if (!validDate) fail(400, 'Ein gültiger Stichtag im Format JJJJ-MM-TT ist erforderlich.');
}
function noActiveImport(date) {
  return { status: 'UNRESOLVED', code: 'NO_ACTIVE_IMPORT', message: 'Es ist noch kein Tarifdatenstand aktiv.', date, currency: 'EUR' };
}
function datedEmployeeFilter(importId, employeeId, date) {
  return { importId, employeeId, matchStatus: 'MATCHED', intervalStatus: { $ne: 'INEFFECTIVE' }, validFrom: { $lte: date }, $or: [{ validUntil: null }, { validUntil: { $gte: date } }] };
}
// A card needs only this employee's valid rows and their related tariff periods.
// Capture the import pointer once so activation cannot mix two data snapshots.
async function employeeDataset(importId, employeeId, date) {
  const filter = datedEmployeeFilter(importId, employeeId, date);
  const [assignments, allowances, employee] = await Promise.all([
    models.Assignment.find(filter).lean(), models.Allowance.find(filter).lean(),
    Mitarbeiter.findById(employeeId).select('personalnr').lean(),
  ]);
  const groupIds = [...new Set(assignments.map(entry => entry.employeeGroupId))];
  const [groups, periods] = groupIds.length ? await Promise.all([
    models.Group.find({ importId, legacyId: { $in: groupIds } }).lean(),
    models.Period.find({ importId, employeeGroupId: { $in: groupIds }, validFrom: { $lte: date }, $or: [{ validUntil: null }, { validUntil: { $gte: date } }] }).lean(),
  ]) : [[], []];
  return serialize({ groups, periods, assignments, allowances, currentPersonalNr: employee?.personalnr || null });
}
async function baseRate(employeeId, date) {
  validateRead(employeeId, date);
  const importId = await activeId();
  if (!importId) return { ...noActiveImport(date), allowances: [] };
  const data = await employeeDataset(importId, employeeId, date);
  return domain.resolveBaseRate(data, employeeId, date, data.currentPersonalNr);
}
async function aboveTariffValues(employeeId, date) {
  validateRead(employeeId, date);
  const importId = await activeId();
  if (!importId) return { ...noActiveImport(date), candidateCount: 0 };
  const [allowances, employee] = await Promise.all([
    models.Allowance.find(datedEmployeeFilter(importId, employeeId, date)).lean(),
    Mitarbeiter.findById(employeeId).select('personalnr').lean(),
  ]);
  return domain.resolveAboveTariff(serialize({ allowances }), employeeId, date, employee?.personalnr);
}
const pick = (value, keys) => value ? Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]])) : undefined;
async function wageInfo(employeeId, date) {
  validateRead(employeeId, date);
  if (!await Mitarbeiter.exists({ _id: employeeId })) fail(404, 'Mitarbeiter nicht gefunden.');
  const importId = await activeId();
  const data = importId ? await employeeDataset(importId, employeeId, date) : null;
  const baseRate = data ? domain.resolveBaseRate(data, employeeId, date, data.currentPersonalNr) : noActiveImport(date);
  const aboveTariff = data ? domain.resolveAboveTariff(data, employeeId, date, data.currentPersonalNr) : { ...noActiveImport(date), candidateCount: 0 };
  return {
    employeeId: String(employeeId), date, activeImportId: importId,
    baseRate: { ...pick(baseRate, ['status', 'date', 'currency', 'value', 'code', 'message', 'assignmentSelection']),
      assignment: pick(baseRate.assignment, ['legacyId', 'personalNr', 'validFrom', 'validUntil']),
      group: pick(baseRate.group, ['legacyId', 'name']), payGroup: pick(baseRate.payGroup, ['legacyId', 'name', 'position']),
      stage: pick(baseRate.stage, ['legacyId', 'name', 'position']), period: pick(baseRate.period, ['legacyId', 'validFrom', 'validUntil']),
    },
    aboveTariff: { ...pick(aboveTariff, ['status', 'date', 'currency', 'values', 'code', 'message', 'candidateCount', 'selection']),
      record: pick(aboveTariff.record, ['legacyId', 'personalNr', 'validFrom', 'validUntil', 'intervalStatus']),
    },
  };
}

module.exports = { catalog, imports, getImport, preview, activate, employees, history, baseRate, aboveTariffValues, wageInfo, currentTariffDate, serialize, datasetHash };
