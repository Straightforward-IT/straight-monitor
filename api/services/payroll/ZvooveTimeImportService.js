const mongoose = require('mongoose');
const time = require('../../domain/payroll/zvooveTimeImport');
const d = require('../../domain/payroll/detailImport');
const models = require('../../models/Payroll/Abrechnung');
const { Row, Import, Projection } = require('../../models/Payroll/ZvooveTimeImport');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Einsatz = require('../../models/Event/Einsatz');
const Stundenzeit = require('../../models/Stundenzeit');
const { isAdmin } = require('../../middleware/requireAdmin');
const serialize = value => JSON.parse(JSON.stringify(value));
const key = year => `INPUT:year:${year}`;
const id = value => { if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) d.fail('Ungültige ID.'); return value; };
const admin = user => { if (!isAdmin(user)) d.fail('Jahresimporte sind Admin-Aufgabe.', 'TIME_IMPORT_FORBIDDEN', 403); };
async function transaction(work) { const session = await mongoose.startSession(); try { return await session.withTransaction(() => work(session)); } finally { await session.endSession(); } }
async function batches(values, work) { for (let i = 0; i < values.length; i += 1000) await work(values.slice(i, i + 1000)); }
const hydrate = row => ({ ...row, fields: row.role === 'STUNDENVORTRAG' ? row.vortrag : row.stunduhr });
async function resolve(rows, bookings) {
  const numbers = [...new Set(rows.map(row => row.personalNr))];
  const [employees, assignments] = await Promise.all([
    Mitarbeiter.find({ $or: [{ personalnr: { $in: numbers } }, { 'personalnrHistory.value': { $in: numbers } }] }).select('personalnr personalnrHistory').lean(),
    Einsatz.find({ personalNr: { $in: numbers.map(Number) }, isPseudo: { $ne: true } }).select('personalNr auftragNr schicht idAuftragArbeitsschichten detailDatumVon datumVon zvooveEinspersNr garantiestundenLohn').lean(),
  ]);
  const people = new Map(), assignmentMap = new Map();
  for (const employee of employees) for (const number of new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(item => item.value)].filter(v => v != null).map(String))) {
    const list = people.get(number) || []; list.push(employee); people.set(number, list);
  }
  const assignmentKey = (person, shift, day) => JSON.stringify([String(person), String(shift), day]);
  for (const assignment of assignments) {
    const day = (assignment.detailDatumVon || assignment.datumVon)?.toISOString().slice(0, 10);
    const k = assignmentKey(assignment.personalNr, assignment.idAuftragArbeitsschichten, day), list = assignmentMap.get(k) || [];
    list.push(assignment); assignmentMap.set(k, list);
  }
  const lookup = row => ({ people: people.get(row.personalNr) || [], assignments: assignmentMap.get(assignmentKey(row.personalNr, row.shiftId, row.date)) || [] });
  for (const booking of bookings) {
    const match = lookup(booking);
    if (match.people.length === 1) booking.employeeId = String(match.people[0]._id);
    else booking.issues.push({ code: 'EMPLOYEE_UNRESOLVED', message: 'Personalnummer ist nicht eindeutig einem Mitarbeiter zugeordnet.' });
    const matches = match.assignments.filter(a => a.auftragNr === booking.auftragNr);
    if (matches.length === 1) {
      booking.assignmentId = String(matches[0]._id); booking.assignmentNumber = matches[0].zvooveEinspersNr || null;
      booking.guaranteedMinutes = matches[0].garantiestundenLohn == null ? null : matches[0].garantiestundenLohn * 60;
    } else if (matches.length > 1) booking.issues.push({ code: 'ASSIGNMENT_AMBIGUOUS', message: 'Mehrere Einsätze passen zur Buchung.' });
  }
  return lookup;
}
const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function legacy(values, day) {
  if (!values.start || !values.end || values.netMinutes == null || values.breakMinutes == null || values.paidBreakMinutes == null || values.issues?.length) return null;
  return { date: day, start: local.format(new Date(values.start)).slice(11, 16), end: local.format(new Date(values.end)).slice(11, 16), actualStart: values.start, actualEnd: values.end,
    netMinutes: values.netMinutes, breakMinutes: values.breakMinutes, paidBreakMinutes: values.paidBreakMinutes,
    breaks: values.breaks.map(block => ({ start: local.format(new Date(block.start)).slice(11, 16), end: local.format(new Date(block.end)).slice(11, 16), paid: values.paidBreakMinutes === 0 ? false : block.paid === true })) };
}
async function preview(files, year, user) {
  admin(user);
  const parsed = time.parse(files, year), state = await models.State.findById(key(year)).lean();
  const previous = state?.snapshotId ? await models.Snapshot.findById(state.snapshotId).select('sourceRowIds timeRoles').lean() : null;
  const retained = previous?.sourceRowIds?.length ? await Row.find({ _id: { $in: previous.sourceRowIds }, role: { $nin: parsed.roles } }).lean() : [];
  await Row.init();
  await batches(parsed.rows, async part => {
    const operations = part.map(row => {
      const { fields, ...rest } = row;
      return { updateOne: { filter: { contentHash: row.contentHash }, update: { $setOnInsert: { ...rest, [row.role === 'STUNDENVORTRAG' ? 'vortrag' : 'stunduhr']: fields, createdAt: new Date(), updatedAt: new Date() } }, upsert: true } };
    });
    try { await Row.collection.bulkWrite(operations, { ordered: false }); }
    catch (error) { if (error.code !== 11000 || error.writeErrors?.some(item => item.code !== 11000)) throw error; }
  });
  const incoming = await Row.find({ contentHash: { $in: parsed.rows.map(row => row.contentHash) } }).lean();
  const rows = [...retained, ...incoming].map(hydrate).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
  const normalized = time.normalize(rows), lookup = await resolve(rows, normalized.bookings);
  const bookedByDraft = new Map();
  for (const booking of normalized.bookings) for (const source of booking.sources.filter(s => s.role === 'STUNDENVORTRAG')) {
    const list = bookedByDraft.get(source.sourceKey) || []; list.push(booking); bookedByDraft.set(source.sourceKey, list);
  }
  const mappings = [];
  for (const row of normalized.vortraege) {
    const match = lookup(row), current = legacy(time.rowValues(row), row.date);
    if (match.people.length !== 1 || match.assignments.length !== 1 || !current) continue;
    const transferred = row.fields.ISTUEBETRAGEN === '1', booked = bookedByDraft.get(row.sourceKey) || [];
    let released = null;
    if (transferred) {
      if (booked.length !== 1 || booked[0].issues.length) continue;
      const b = booked[0];
      released = legacy({ ...b, netMinutes: b.productiveMinutes, issues: [] }, row.date);
      if (!released) continue;
    }
    const assignment = match.assignments[0];
    mappings.push({ rowId: row._id, assignmentId: assignment._id, employeeId: match.people[0]._id, personalNr: Number(row.personalNr), auftragNr: assignment.auftragNr, schicht: assignment.schicht || null, transferred, sourceKey: row.sourceKey, sourceHash: row.contentHash, current, released });
  }
  const mappingCounts = new Map(); mappings.forEach(mapping => mappingCounts.set(String(mapping.assignmentId), (mappingCounts.get(String(mapping.assignmentId)) || 0) + 1));
  const uniqueMappings = mappings.filter(mapping => mappingCounts.get(String(mapping.assignmentId)) === 1);
  const counts = { ...normalized.counts, editableProjections: uniqueMappings.length };
  const timeRoles = [...new Set([...(previous?.timeRoles || []), ...parsed.roles])].sort();
  const contentHash = d.hash({ rows: rows.map(row => String(row._id)), bookings: normalized.bookings, mappings: uniqueMappings, timeRoles });
  await models.Snapshot.init();
  let snapshot = await models.Snapshot.findOne({ kind: 'INPUT', scope: `year:${year}`, contentHash }).lean();
  if (!snapshot) {
    const snapshotId = new mongoose.Types.ObjectId();
    try {
      await transaction(async session => {
        await models.Snapshot.create([{ _id: snapshotId, kind: 'INPUT', scope: `year:${year}`, contentHash, sourceRowIds: rows.map(row => row._id), timeRoles, rows: [], references: [], issues: [] }], { session });
        await batches(normalized.bookings, part => models.Booking.insertMany(part.map(booking => ({ ...booking, snapshotId })), { session, ordered: true }));
      });
      snapshot = { _id: snapshotId };
    } catch (error) { if (error.code !== 11000) throw error; snapshot = await models.Snapshot.findOne({ kind: 'INPUT', scope: `year:${year}`, contentHash }).lean(); if (!snapshot) throw error; }
  }
  const run = await Import.create({ year, status: 'BUILDING', snapshotId: snapshot._id, baseRevision: state?.revision || 0, files: parsed.files, counts,
    productiveHours: normalized.productiveHours, pauseHours: normalized.pauseHours, issues: [
      ...(counts.vortraege > uniqueMappings.length ? [{ code: 'UNPROJECTED_VORTRAEGE', message: `${counts.vortraege - uniqueMappings.length} Vorträge bleiben als Original erhalten; keine eindeutige oder vollständige Übernahme in die Schnellerfassung.` }] : []),
      ...normalized.orphanPauses.slice(0, 50).map(item => ({ code: item.code, message: item.sourceKey })),
    ], createdBy: user._id });
  try {
    await batches(uniqueMappings, part => Projection.insertMany(part.map(mapping => ({ importId: run._id, mapping })), { ordered: true }));
    await Import.updateOne({ _id: run._id, status: 'BUILDING' }, { $set: { status: 'PREVIEW' } });
  } catch (error) { await Import.updateOne({ _id: run._id }, { $set: { status: 'INVALID' } }); throw error; }
  return metadata({ ...run.toObject(), status: 'PREVIEW' });
}
function metadata(run, state) {
  return serialize({ id: run._id, year: run.year, status: run.status === 'ACTIVE' && state && String(state.importId) !== String(run._id) ? 'SUPERSEDED' : run.status, snapshotId: run.snapshotId, baseRevision: run.baseRevision, files: run.files, counts: run.counts, productiveHours: run.productiveHours, pauseHours: run.pauseHours, issues: run.issues, projectionResult: run.projectionResult, createdAt: run.createdAt, activatedAt: run.activatedAt });
}
async function list(user) { admin(user); const rows = await Import.find().select('-mappings').sort({ createdAt: -1 }).limit(50).lean(); const states = await models.State.find({ _id: /^INPUT:year:/ }).lean(); return { imports: rows.map(row => metadata(row, states.find(state => state._id === key(row.year)))) }; }
async function get(importId, user) { admin(user); const run = await Import.findById(id(importId)).select('-mappings').lean(); if (!run) d.fail('Jahresimport nicht gefunden.', 'TIME_IMPORT_NOT_FOUND', 404); return metadata(run, await models.State.findById(key(run.year)).lean()); }
async function sourceRows(importId, role, page, user) {
  admin(user); if (!time.PROFILES[role] || !Number.isSafeInteger(page) || page < 0) d.fail('Tabellenrolle oder Seite ungültig.');
  const run = await Import.findById(id(importId)).lean(); if (!run) d.fail('Import nicht gefunden.', 'TIME_IMPORT_NOT_FOUND', 404);
  const snapshot = await models.Snapshot.findById(run.snapshotId).select('sourceRowIds').lean();
  const filter = { _id: { $in: snapshot.sourceRowIds }, role };
  return serialize({ page, rows: await Row.find(filter).sort({ sourceKey: 1 }).skip(page * 100).limit(100).lean(), total: await Row.countDocuments(filter) });
}
async function activate(importId, expectedRevision, user) {
  admin(user); if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) d.fail('expectedRevision ist erforderlich.');
  try {
    await transaction(async session => {
      const run = await Import.findById(id(importId)).session(session).lean(); if (!run) d.fail('Jahresimport nicht gefunden.', 'TIME_IMPORT_NOT_FOUND', 404);
      let state = await models.State.findById(key(run.year)).session(session).lean();
      if (run.status === 'ACTIVE' && String(state?.importId) === String(run._id)) return;
      if (run.status !== 'PREVIEW' || run.baseRevision !== expectedRevision || (state?.revision || 0) !== expectedRevision) d.fail('Datenstand wurde seit der Vorschau geändert.', 'TIME_IMPORT_STALE', 409);
      const mappings = (await Projection.find({ importId: run._id }).session(session).lean()).map(row => row.mapping);
      if (mappings.length !== run.counts.editableProjections) d.fail('Importvorbereitung ist unvollständig. Vorschau erneut erstellen.');
      if (!state) { await models.State.create([{ _id: key(run.year), revision: 0 }], { session }); state = { revision: 0 }; }
      const existing = await Stundenzeit.find({ _id: { $in: mappings.map(mapping => mapping.assignmentId) } }).session(session).lean();
      const byId = new Map(existing.map(row => [String(row._id), row])), operations = [], result = { created: 0, updated: 0, unchanged: 0, protected: 0 };
      for (const mapping of mappings) {
        const before = byId.get(String(mapping.assignmentId));
        if (before && (!before.importSource?.key || before.importSource.key !== mapping.sourceKey || before.importSource.editedLocally)) { result.protected++; continue; }
        if (before?.importSource.contentHash === mapping.sourceHash && d.hash(serialize(before.released || null)) === d.hash(serialize(mapping.released || null))) { result.unchanged++; continue; }
        const revision = (before?.revision || 0) + 1;
        const identity = { mitarbeiter: mapping.employeeId, personalNr: mapping.personalNr, auftragNr: mapping.auftragNr, schicht: mapping.schicht };
        if (before && (String(before.mitarbeiter) !== String(mapping.employeeId) || before.auftragNr !== mapping.auftragNr)) { result.protected++; continue; }
        const patch = { revision, status: mapping.transferred ? 'RELEASED' : 'SUBMITTED', current: mapping.current, released: mapping.released,
          importSource: { key: mapping.sourceKey, rowId: mapping.rowId, contentHash: mapping.sourceHash, importId: run._id, editedLocally: false } };
        if (mapping.transferred) { patch.releasedAt = new Date(); patch.releasedBy = user._id; }
        const candidate = new Stundenzeit({ _id: mapping.assignmentId, ...identity, ...patch }); const validation = candidate.validateSync(); if (validation) throw validation;
        operations.push({ updateOne: { filter: { _id: mapping.assignmentId, ...(before ? { revision: before.revision } : {}) }, update: { $set: patch, $setOnInsert: identity,
          $push: { history: { revision, action: 'IMPORTED', at: new Date(), by: user._id, reason: 'Zvoove-Jahresimport', values: mapping.current } } }, upsert: !before } });
        result[before ? 'updated' : 'created']++;
      }
      await batches(operations, async part => { const written = await Stundenzeit.bulkWrite(part, { session, ordered: true }); if (written.matchedCount + written.upsertedCount !== part.length) d.fail('Vortrag wurde gleichzeitig geändert.', 'TIME_IMPORT_STALE', 409); });
      const changed = String(state.snapshotId) !== String(run.snapshotId);
      const updated = await models.State.updateOne({ _id: key(run.year), revision: expectedRevision }, { $set: { snapshotId: run.snapshotId, importId: run._id, revision: expectedRevision + Number(changed) } }, { session });
      if (updated.matchedCount !== 1) d.fail('Import wurde gleichzeitig aktiviert.', 'TIME_IMPORT_STALE', 409);
      await Import.updateOne({ _id: run._id }, { $set: { status: 'ACTIVE', activatedBy: user._id, activatedAt: new Date(), projectionResult: result } }, { session });
    });
  } catch (error) { if (error.code === 11000) d.fail('Import oder Vortrag wurde gleichzeitig geändert.', 'TIME_IMPORT_STALE', 409); throw error; }
  return get(importId, user);
}
module.exports = { preview, activate, list, get, sourceRows };
