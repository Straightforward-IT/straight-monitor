const mongoose = require('mongoose');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Lohnart = require('../../models/Payroll/Lohnart');
const { Week, Snapshot, Import, State } = require('../../models/Payroll/ZvooveHours');
const capture = require('../TimeCaptureService');
const { canAccess } = capture;
const d = require('../../domain/payroll/zvooveHours');

function objectId(id) { if (!mongoose.isValidObjectId(id)) d.fail('Ungültige ID.'); return id; }
function monthValue(value) { if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) d.fail('Monat im Format YYYY-MM angeben.'); return value; }
function serialize(record) { return JSON.parse(JSON.stringify(record)); }
function metadata(record, state) {
  const isCurrent = !!state?.importId && String(state.importId) === String(record._id);
  return { id: String(record._id), filename: record.filename, month: record.month, status: record.status === 'ACTIVE' && state && !isCurrent ? 'SUPERSEDED' : record.status, baseRevision: record.baseRevision,
    valid: record.valid, counts: record.counts, changes: record.changes, issues: record.issues || [], createdAt: record.createdAt,
    activatedAt: record.activatedAt || null, revision: record.revision ?? null, isCurrent };
}
async function ensureState(month) {
  try { return await State.findOneAndUpdate({ _id: month }, { $setOnInsert: { revision: 0 } }, { upsert: true, new: true }).lean(); }
  catch (error) { if (error.code !== 11000) throw error; return State.findById(month).lean(); }
}
async function storeWeeks(rows) {
  await Week.init();
  if (!rows.length) return [];
  const hashed = rows.map(row => ({ ...row, contentHash: d.rowHash(row) }));
  try { await Week.collection.bulkWrite(hashed.map(({ source, ...row }) => ({ updateOne: { filter: { contentHash: row.contentHash }, update: { $setOnInsert: { ...row, employeeId: row.employeeId ? new mongoose.Types.ObjectId(row.employeeId) : null, createdAt: new Date(), updatedAt: new Date() } }, upsert: true } })), { ordered: false }); }
  catch (error) { if (error.code !== 11000 || error.writeErrors?.some(item => item.code !== 11000)) throw error; }
  const versions = await Week.find({ contentHash: { $in: hashed.map(row => row.contentHash) } }).select('_id contentHash').lean();
  const ids = new Map(versions.map(row => [row.contentHash, row._id]));
  return hashed.map(row => ({ key: row.key, versionId: ids.get(row.contentHash), source: row.source, contentHash: row.contentHash }));
}
async function preview(file, userId) {
  if (!file?.buffer) d.fail('Eine Excel-Datei ist erforderlich.');
  const parsed = d.parseWorkbook(file.buffer, file.originalname);
  const numbers = [...new Set(parsed.rows.map(row => row.personalNr))];
  const [employees, lohnarten] = await Promise.all([
    Mitarbeiter.find({ $or: [{ personalnr: { $in: numbers } }, { 'personalnrHistory.value': { $in: numbers } }] }).select('_id personalnr personalnrHistory').lean(),
    Lohnart.find({ kb: { $ne: '' } }).select('kb lohnartNummer lohnartBezeichnung').lean(),
  ]);
  const resolved = d.resolveRows(parsed.rows, employees, lohnarten);
  const issues = [...parsed.issues, ...resolved.issues];
  const valid = !!parsed.month && !issues.some(issue => issue.severity === 'ERROR');
  const state = parsed.month ? await ensureState(parsed.month) : null;
  let snapshotId = null;
  const changes = { added: 0, updated: 0, unchanged: 0, retained: 0 };
  if (valid) {
    const previous = state?.snapshotId ? await Snapshot.findById(state.snapshotId).lean() : null;
    const refs = previous?.rows || [];
    const existingWeeks = refs.length ? await Week.find({ _id: { $in: refs.map(ref => ref.versionId) } }).select('_id contentHash').lean() : [];
    const hashes = new Map(existingWeeks.map(row => [String(row._id), row.contentHash]));
    const byKey = new Map(refs.map(ref => [ref.key, { ...ref, contentHash: hashes.get(String(ref.versionId)) }]));
    const incoming = await storeWeeks(resolved.rows);
    for (const row of incoming) {
      const old = byKey.get(row.key);
      changes[!old ? 'added' : old.contentHash === row.contentHash ? 'unchanged' : 'updated']++;
      byKey.set(row.key, row);
    }
    changes.retained = refs.length - incoming.filter(row => refs.some(ref => ref.key === row.key)).length;
    const combined = [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
    const contentHash = d.hash(combined.map(row => [row.key, row.contentHash]));
    await Snapshot.init();
    try { await Snapshot.collection.updateOne({ month: parsed.month, contentHash }, { $setOnInsert: { month: parsed.month, contentHash, rows: combined.map(({ contentHash: _hash, ...ref }) => ref), createdAt: new Date(), updatedAt: new Date() } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
    snapshotId = (await Snapshot.findOne({ month: parsed.month, contentHash }).select('_id').lean())._id;
  }
  const days = resolved.rows.flatMap(row => row.days);
  const run = await Import.create({ filename: parsed.filename, month: parsed.month, status: valid ? 'PREVIEW' : 'INVALID', valid, baseRevision: state?.revision || 0,
    counts: { rows: parsed.receivedRows, employees: numbers.length, days: days.length, productiveDays: days.filter(day => day.kind === 'productive').length, markers: days.filter(day => day.kind === 'marker').length },
    changes, issues, rows: parsed.sourceRows, snapshotId, createdBy: userId });
  return serialize(metadata(run));
}
async function imports() {
  const [runs, states] = await Promise.all([Import.find().select('-rows').sort({ createdAt: -1 }).limit(100).lean(), State.find().lean()]);
  const byMonth = new Map(states.map(state => [state._id, state]));
  return { imports: serialize(runs.map(run => metadata(run, byMonth.get(run.month)))) };
}
async function getImport(id) {
  const run = await Import.findById(objectId(id)).select('-rows').lean();
  if (!run) d.fail('Importlauf nicht gefunden.', 'PAYROLL_IMPORT_NOT_FOUND', 404);
  return serialize(metadata(run, await State.findById(run.month).lean()));
}
async function activate(id, expectedRevision, userId) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) d.fail('Die geprüfte Datenstandsrevision ist erforderlich.');
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const run = await Import.findById(objectId(id)).select('-rows').session(session).lean();
      if (!run) d.fail('Importlauf nicht gefunden.', 'PAYROLL_IMPORT_NOT_FOUND', 404);
      if (!run.valid || !run.snapshotId) d.fail('Dieser Import enthält Fehler und kann nicht aktiviert werden.');
      const current = await State.findById(run.month).session(session).lean();
      // A double-click on the same successful activation is harmless.
      if (run.status === 'ACTIVE' && String(current?.importId) === String(run._id)) { result = metadata(run, current); return; }
      if (run.status !== 'PREVIEW') d.fail('Dieser Importlauf wurde bereits aktiviert. Bitte eine neue Vorschau erstellen.', 'PAYROLL_IMPORT_STALE', 409);
      if (run.baseRevision !== expectedRevision || current?.revision !== expectedRevision) d.fail('Der aktive Stundenbestand wurde seit der Vorschau geändert. Bitte die Datei erneut prüfen.', 'PAYROLL_IMPORT_STALE', 409);
      const revision = current.revision + (String(current.snapshotId) === String(run.snapshotId) ? 0 : 1);
      const state = await State.findOneAndUpdate({ _id: run.month, revision: expectedRevision }, { $set: { revision, snapshotId: run.snapshotId, importId: run._id } }, { new: true, session }).lean();
      if (!state) d.fail('Der Stundenbestand wurde gleichzeitig geändert.', 'PAYROLL_IMPORT_STALE', 409);
      const active = await Import.findOneAndUpdate({ _id: run._id, status: 'PREVIEW' }, { $set: { status: 'ACTIVE', activatedAt: new Date(), activatedBy: userId, revision } }, { new: true, session }).select('-rows').lean();
      if (!active) d.fail('Der Importlauf wurde gleichzeitig geändert.', 'PAYROLL_IMPORT_STALE', 409);
      result = metadata(active, state);
    });
  } finally { await session.endSession(); }
  return serialize(result);
}
async function month(user, employeeId, requestedMonth) {
  const period = monthValue(requestedMonth);
  const employee = await Mitarbeiter.findById(objectId(employeeId)).select('personalnr personalnrHistory vorname nachname locationV2 arbeitszeit lohnStammdaten arbeitsverhaeltnis').lean();
  if (!employee) d.fail('Mitarbeiter nicht gefunden.', 'PAYROLL_EMPLOYEE_NOT_FOUND', 404);
  if (!canAccess(user, employee.locationV2)) d.fail('Kein Zugriff auf diesen Mitarbeiterstandort.', 'PAYROLL_FORBIDDEN', 403);
  const state = await State.findById(period).lean();
  const snapshot = state?.snapshotId ? await Snapshot.findById(state.snapshotId).lean() : null;
  const refs = snapshot?.rows || [];
  const weeks = refs.length ? await Week.find({ _id: { $in: refs.map(ref => ref.versionId) }, employeeId: employee._id }).lean() : [];
  const sources = new Map(refs.map(ref => [String(ref.versionId), ref.source]));
  let entries = weeks.flatMap(row => row.days.map(day => ({ ...day, id: `${row._id}:${day.daySlot}`, personalNr: row.personalNr, week: row.week, kw: row.kw,
    source: { ...sources.get(String(row._id)), daySlot: day.daySlot, raw: row.raw }, employeeResolution: row.matchStatus }))).sort((a, b) => a.date.localeCompare(b.date) || a.personalNr.localeCompare(b.personalNr));
  const monthlyReference = entries;
  const accounting = require('../../models/Payroll/Abrechnung');
  const timeState = await accounting.State.findById(`INPUT:year:${period.slice(0, 4)}`).lean();
  const timeSnapshot = timeState?.snapshotId ? await accounting.Snapshot.findById(timeState.snapshotId).select('timeRoles').lean() : null;
  const usesTimeBookings = !!timeSnapshot?.timeRoles?.includes('STUNDUHR');
  if (usesTimeBookings) {
    const detail = await require('./AbrechnungService').bookings(user, { employeeId, month: period });
    const selectedBookings = detail.bookings.filter(row => row.date?.startsWith(period));
    const contexts = await require('./PayrollOrderContextService').contexts(user, selectedBookings);
    const booked = selectedBookings.map(row => ({ id: row._id, date: row.date, hours: row.reportedHours, kb: '', kind: 'productive', label: 'Gebuchte Arbeitsstunden', personalNr: row.personalNr, source: row.sources[0], booking: row, orderContext: contexts.get(String(row._id)) || null }));
    entries = [...entries.filter(entry => entry.kind !== 'productive'), ...booked].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }
  const issues = [], byDate = new Map(), byCode = new Map();
  for (const entry of entries.filter(entry => entry.booking)) for (const item of [...entry.booking.issues, ...(entry.booking.hints || [])]) {
    if (!issues.some(issue => issue.code === item.code)) issues.push(d.issue('WARNING', item.code, item.message));
  }
  for (const entry of entries) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
    if (!byCode.has(entry.kb)) byCode.set(entry.kb, { kb: entry.kb, label: entry.label, hours: [], dates: new Set() });
    const group = byCode.get(entry.kb); group.hours.push(entry.hours); group.dates.add(entry.date);
    if (entry.kind === 'unresolved' && !issues.some(issue => issue.kb === entry.kb)) issues.push({ ...d.issue('WARNING', `KB_${entry.resolution}`, `KB ${entry.kb}: Lohnartzuordnung ist ungeklärt.`), kb: entry.kb });
  }
  for (const [date, rows] of byDate) if (new Set(rows.map(row => row.personalNr)).size > 1) issues.push(d.issue('WARNING', 'MULTIPLE_PERSONNEL_ENTRIES', `Am ${date} liegen mehrere Personalnummern vor. Alle Quellwerte bleiben sichtbar; bitte prüfen.`));
  const employmentLabel = ['Vollzeit', 'Teilzeit', 'Geringfügig beschäftigt', 'Kurzfristig beschäftigt'][employee.arbeitsverhaeltnis?.typ] || '';
  const employeeDoc = new Mitarbeiter(employee);
  const monthlyHours = employeeDoc.getMonthlyWorkingHours ? employeeDoc.getMonthlyWorkingHours(period.slice(0, 4), period.slice(5, 7)) : null;
  // Keep disposition outside the imported facts and their payroll totals.
  const planning = await capture.monthView(user, employeeId, period);
  const bookedAssignments = new Set(entries.map(entry => entry.booking?.assignmentId || entry.orderContext?.assignment?.id).filter(Boolean).map(String));
  const planned = planning.initialData.entries.filter(entry => entry.kind === 'planned' && !bookedAssignments.has(entry.einsatzId));
  const plannedContexts = await require('./PayrollOrderContextService').contexts(user, planned.map(entry => ({ ...entry, _id: entry.id, assignmentId: entry.einsatzId })));
  const plannedEntries = planned.map(entry => ({ ...entry, id: `planned:${entry.id}`, code: 'PL', hours: entry.minutes > 0 ? String(entry.minutes / 60) : null,
    orderContext: plannedContexts.get(entry.id) || null }));
  return serialize({ employee: { id: String(employee._id), personalNr: employee.personalnr || '', name: [employee.vorname, employee.nachname].filter(Boolean).join(' '), monthlyHours: Number.isFinite(Number(monthlyHours)) ? Number(monthlyHours) : null, employmentLabel },
    month: period, entries, plannedEntries, sourceMode: usesTimeBookings ? 'TIME_BOOKINGS' : 'MONTHLY_IMPORT', monthlyReference: { entries: monthlyReference, hours: d.sumDecimals(monthlyReference.map(entry => entry.hours)), available: !!snapshot, datasetRevision: state?.revision || 0 }, totals: { hours: d.sumDecimals(entries.map(entry => entry.hours)), byCode: [...byCode.values()].map(group => ({ kb: group.kb, label: group.label, hours: d.sumDecimals(group.hours), days: group.dates.size })) }, datasetRevision: usesTimeBookings ? timeState.revision : state?.revision || 0, issues });
}
module.exports = { preview, imports, getImport, activate, month };
