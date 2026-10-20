const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const domain = require('../domain/payroll/zvooveTimeImport');
const service = require('../services/payroll/ZvooveTimeImportService');
const sourceModels = require('../models/Payroll/ZvooveTimeImport');
const accounting = require('../models/Payroll/Abrechnung');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Einsatz = require('../models/Event/Einsatz');
const Auftrag = require('../models/Event/Auftrag');
const Stundenzeit = require('../models/Stundenzeit');
const User = require('../models/System/User');
const capture = require('../services/TimeCaptureService');
const engine = require('../domain/payroll/ausweisung');
const oid = () => new mongoose.Types.ObjectId();
function file(role, values) {
  const columns = domain.PROFILES[role], workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columns, ...values.map(row => columns.map(column => row[column] ?? null))]), 'Tabelle1');
  return { fieldname: role, originalname: `${role}.xlsx`, buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) };
}
const draft = extra => ({ ID: 1, DBID: 9, REPL_ID: 101, REPL_DATABASE: 9, DBIDARBEITSSCHICHT: 9, IDARBEITSSCHICHT: 17, PERSONALNR: 100001, DATUM: '2026-10-09', ISTZEITENVON: 8 / 24, ISTZEITENBIS: 16 / 24, ISTSTUNDEN: 7.5, PAUSE: 0.5, PAUSEBEZAHLT: 0, ISTUEBETRAGEN: 0, ...extra });
const work = extra => ({ REPL_ID: 201, REPL_DATABASE: 9, DBIDARBEITSSCHICHT: 9, IDARBEITSSCHICHT: 17, PERSONALNR: 100001, DATUM: '2026-10-09', AUFTRAGSNR: 2510476, EINSORT: 1, LFDNR: 1, JAHR: 2026, MONAT: 10, WOCHE: 2, TAG: 5, PAUSE: 0, STUNDEN: 7.5, VON: 8 / 24, BIS: 16 / 24, ...extra });
const pause = extra => work({ REPL_ID: 202, PAUSE: 1, STUNDEN: 0.5, VON: null, BIS: null, ...extra });
const files = (a = [draft()], b = [work(), pause()]) => [file('STUNDENVORTRAG', a), file('STUNDUHR', b)];

describe('actual Zvoove year export contracts', () => {
  it('models all 40 and 34 source columns explicitly, preserving blanks and source row IDs', () => {
    assert.equal(domain.VORTRAG_COLUMNS.length, 40); assert.equal(domain.UHR_COLUMNS.length, 34);
    const parsed = domain.parse(files(), 2026);
    assert.equal(parsed.rows.length, 3); assert.equal(parsed.rows[0].sourceKey, 'STUNDENVORTRAG:9:101');
    assert.equal(parsed.rows[1].fields.PAUSE, '0'); assert.equal(parsed.rows[2].fields.VON, null);
    assert.equal(Object.keys(parsed.rows[0].fields).length, 40);
    for (const column of domain.VORTRAG_COLUMNS) assert.ok(sourceModels.Row.schema.path('vortrag').schema.path(column));
    for (const column of domain.UHR_COLUMNS) assert.ok(sourceModels.Row.schema.path('stunduhr').schema.path(column));
  });
  it('uses work STUNDEN once and pause STUNDEN as duration, with optional exact intervals', () => {
    const unlocated = domain.normalize(domain.parse(files(), 2026).rows);
    assert.equal(unlocated.productiveHours, '7.5'); assert.equal(unlocated.pauseHours, '0.5');
    assert.equal(unlocated.bookings[0].productiveMinutes, 450); assert.equal(unlocated.bookings[0].breakMinutes, 30);
    assert.equal(unlocated.bookings[0].breakLocationKnown, false); assert.deepEqual(unlocated.bookings[0].issues, []);
    const located = domain.normalize(domain.parse(files([draft()], [work(), pause({ VON: 12 / 24, BIS: 12.5 / 24 })]), 2026).rows);
    assert.equal(located.bookings[0].breaks.length, 1); assert.equal(located.bookings[0].breakLocationKnown, true);
    assert.equal(located.bookings[0].productiveMinutes, 450); assert.equal(located.bookings[0].breaks[0].paid, false);
  });
  it('handles the observed placeholder only with one unique work row and preserves ambiguous orphan rows', () => {
    const good = domain.normalize(domain.parse(files([draft()], [work(), pause({ DBIDARBEITSSCHICHT: -1, IDARBEITSSCHICHT: 9 })]), 2026).rows);
    assert.equal(good.counts.orphanRows, 0); assert.equal(good.bookings[0].breakMinutes, 30);
    assert.ok(good.bookings[0].hints.some(hint => hint.code === 'SHIFT_DATABASE_PLACEHOLDER'));
    const ambiguous = domain.normalize(domain.parse(files([], [work(), work({ REPL_ID: 203, IDARBEITSSCHICHT: 18 }), pause({ DBIDARBEITSSCHICHT: -1, IDARBEITSSCHICHT: 9 })]), 2026).rows);
    assert.equal(ambiguous.counts.orphanRows, 1);
  });
  it('does not guess source identity, accept mixed years or merge LFDNR-distinct bookings', () => {
    assert.throws(() => domain.parse(files([draft({ REPL_ID: null })]), 2026), /REPL/);
    assert.throws(() => domain.parse(files([draft({ DATUM: '2025-01-01' })]), 2026), /Importjahr/);
    assert.throws(() => domain.parse(files([draft(), draft()]), 2026), /mehrfach/);
    const two = domain.normalize(domain.parse(files([], [work(), pause(), work({ REPL_ID: 203, LFDNR: 2 }), pause({ REPL_ID: 204, LFDNR: 2 })]), 2026).rows);
    assert.equal(two.counts.bookings, 2);
  });
  it('routes original row-type STUNDUHR away from the older pause-duration adapter', () => {
    assert.throws(() => require('../domain/payroll/detailImport').readFiles([file('STUNDUHR', [work(), pause()])], 'INPUT'), /Jahresstand/);
  });
  it('values unlocated net quantities for base hours while blocking applicable time premiums', () => {
    const normalized = domain.normalize(domain.parse(files(), 2026).rows);
    const booking = { ...normalized.bookings[0], _id: 'booking' };
    const base = { _id: 'base', auftragNr: 2510476, side: 'F', wageType: '100', personalNr: null, windowStart: 0, windowEnd: 1440, weekdays: [0, 1, 2, 3, 4, 5, 6], holiday: false, automatic: true, rate: '20', percent: '0', issues: [] };
    const input = { bookings: [booking], rules: [base], side: 'F', rates: [], wageTypes: [{ lohnartNummer: '100', berechnungsartCode: '2' }], policies: engine.policies({ rounding: 'HALF_UP_PER_POSITION' }) };
    const result = engine.calculate(input); assert.equal(result.totals.amount, '150.00'); assert.equal(result.totals.productiveMinutes, 450);
    const withPremium = engine.calculate({ ...input, rules: [base, { ...base, _id: 'premium', wageType: '166', percent: '25' }] });
    assert.equal(withPremium.status, 'INCOMPLETE'); assert.ok(withPremium.issues.some(issue => issue.code === 'BREAK_LOCATION_REQUIRED'));
    assert.equal(withPremium.fakturpositionen[0].amount, '150.00');
    const paidUnknown = engine.calculate({ ...input, bookings: [{ ...booking, paidBreakMinutes: null, hints: [{ code: 'PAID_BREAK_STATUS_UNKNOWN' }] }] });
    assert.equal(paidUnknown.status, 'INCOMPLETE'); assert.equal(paidUnknown.totals.amount, null);
  });
  it('reads every real 2026 row and reconciles work and pause totals independently', function () {
    this.timeout(30000);
    const names = [['STUNDENVORTRAG', 'Stundenvortrag 2026.xlsx'], ['STUNDUHR', 'Stunduhr 2026.xlsx']];
    if (names.some(([, name]) => !fs.existsSync(path.join(__dirname, '../assets', name)))) this.skip();
    const input = names.map(([fieldname, originalname]) => ({ fieldname, originalname, buffer: fs.readFileSync(path.join(__dirname, '../assets', originalname)) }));
    const parsed = domain.parse(input, 2026), result = domain.normalize(parsed.rows);
    assert.equal(parsed.rows.length, 47015); assert.equal(result.counts.vortraege, 18188);
    assert.equal(result.counts.stunduhr, 28827); assert.equal(result.counts.workRows, 17681); assert.equal(result.counts.pauseRows, 11146);
    assert.equal(result.counts.bookings, 17681); assert.equal(result.counts.orphanRows, 0);
    assert.equal(result.productiveHours, '115831'); assert.equal(result.pauseHours, '6102');
    assert.equal(new Set(parsed.rows.map(row => row.sourceKey)).size, parsed.rows.length);
  });
});

describe('year import storage, editable projections and payroll', function () {
  this.timeout(120000);
  let repl, server, base, oldSecret, admin, staff, assignment, employee;
  before(async () => {
    repl = await MongoMemoryReplSet.create({ instanceOpts: [{ ip: '127.0.0.1' }], replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('time_year_import_test'));
    await Promise.all([...Object.values(sourceModels), ...Object.values(accounting), Stundenzeit].map(model => model.init()));
    oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'isolated-year-import-tests';
    const app = express(); app.use(express.json()); app.use('/imports', require('../routes/payroll/zvooveTimeImportRoutes'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    for (const model of [...Object.values(sourceModels), ...Object.values(accounting), Stundenzeit, Mitarbeiter, Einsatz, Auftrag, User]) await model.collection.deleteMany({});
    const location = oid(); employee = { _id: oid(), personalnr: '100001', locationV2: location };
    assignment = { _id: oid(), personalNr: 100001, auftragNr: 2510476, idAuftragArbeitsschichten: 17, detailDatumVon: new Date('2026-10-09'), datumVon: new Date('2026-10-09'), locationV2: location };
    admin = { _id: oid(), email: 'admin@year.test', role: 'ADMIN', isConfirmed: true, locationV2: location };
    staff = { _id: oid(), email: 'staff@year.test', role: 'USER', isConfirmed: true, locationV2: location };
    await Mitarbeiter.collection.insertOne(employee); await Einsatz.collection.insertOne(assignment);
    await Auftrag.collection.insertOne({ _id: oid(), auftragNr: 2510476, locationV2: location }); await User.collection.insertMany([admin, staff]);
  });
  after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (repl) await repl.stop(); if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  it('keeps the preview separate, activates all sources and makes a linked draft editable', async () => {
    const run = await service.preview(files(), 2026, admin);
    assert.equal(run.counts.editableProjections, 1); assert.equal(await Stundenzeit.countDocuments(), 0);
    await service.activate(run.id, run.baseRevision, admin);
    const entry = await Stundenzeit.findById(assignment._id).lean();
    assert.equal(entry.current.netMinutes, 450); assert.equal(entry.current.breakMinutes, 30); assert.equal(entry.status, 'SUBMITTED');
    assert.equal(entry.employeeSubmission, null); assert.equal(await sourceModels.Row.countDocuments(), 3);
    await capture.saveReview(staff, 2510476, { action: 'save', entries: [{ einsatzId: String(assignment._id), revision: entry.revision, start: '08:00', end: '17:00', breakMinutes: 30 }] });
    assert.equal((await Stundenzeit.findById(assignment._id)).importSource.editedLocally, true);
    const next = await service.preview(files([draft({ ISTZEITENBIS: 15.5 / 24, ISTSTUNDEN: 7 })]), 2026, admin);
    assert.equal((await service.activate(next.id, next.baseRevision, admin)).projectionResult.protected, 1);
    assert.equal((await Stundenzeit.findById(assignment._id)).current.end, '17:00');
  });
  it('shows work quantities in payroll without adding pauses and retains original row history', async () => {
    const run = await service.preview(files([draft({ ISTUEBETRAGEN: 1 })]), 2026, admin); await service.activate(run.id, run.baseRevision, admin);
    const month = await require('../services/payroll/ZvooveHoursService').month(staff, String(employee._id), '2026-10');
    assert.equal(month.sourceMode, 'TIME_BOOKINGS'); assert.equal(month.totals.hours, '7.5'); assert.equal(month.entries.length, 1);
    assert.equal(month.entries[0].booking.breakMinutes, 30); assert.equal((await Stundenzeit.findById(assignment._id)).status, 'RELEASED');
    assert.equal(month.entries[0].orderContext.order.number, 2510476);
    assert.equal(month.entries[0].orderContext.assignment.id, String(assignment._id));
    const again = await service.preview(files([draft({ ISTUEBETRAGEN: 1 })]), 2026, admin);
    assert.equal(again.snapshotId, run.snapshotId); await service.activate(again.id, again.baseRevision, admin);
    assert.equal(await sourceModels.Row.countDocuments(), 3); assert.equal(await accounting.Booking.countDocuments(), 1);
    const page = await service.sourceRows(run.id, 'STUNDUHR', 0, admin); assert.equal(page.total, 2);
    assert.equal(Object.keys(page.rows[0].stunduhr).length, 34);
    await assert.rejects(() => sourceModels.Row.updateOne({}, { $set: { date: '2000-01-01' } }), /unveränderlich/);
  });
  it('shows accessible planned assignments separately without double-counting imported work', async () => {
    await Mitarbeiter.collection.updateOne({ _id: employee._id }, { $set: { personalnrHistory: [{ value: '900001' }] } });
    const futureId = oid(), secondId = oid(), missingTimesId = oid();
    await Auftrag.collection.insertOne({ _id: oid(), auftragNr: 2510999, locationV2: oid() });
    await Einsatz.collection.insertMany([
      { _id: futureId, personalNr: 900001, auftragNr: 2510476, idAuftragArbeitsschichten: 18, datumVon: new Date('2026-10-21'), uhrzeitVon: '22:00', uhrzeitBis: '06:00' },
      { _id: secondId, personalNr: 100001, auftragNr: 2510476, idAuftragArbeitsschichten: 19, datumVon: new Date('2026-10-09'), uhrzeitVon: '18:00', uhrzeitBis: '20:00' },
      { _id: missingTimesId, personalNr: 100001, auftragNr: 2510476, datumVon: new Date('2026-10-22') },
      { _id: oid(), personalNr: 100001, auftragNr: 2510476, datumVon: new Date('2026-10-23'), isPseudo: true },
      { _id: oid(), personalNr: 100001, auftragNr: 2510999, datumVon: new Date('2026-10-24') },
      { _id: oid(), personalNr: 100001, auftragNr: 2510476, datumVon: new Date('2026-11-01') },
    ]);
    const hours = require('../services/payroll/ZvooveHoursService');
    const empty = await hours.month(staff, String(employee._id), '2026-10');
    assert.equal(empty.entries.length, 0); assert.equal(empty.plannedEntries.length, 4); assert.equal(empty.totals.hours, '0');
    // STUNDUHR can exist before the editable projection has been released.
    const run = await service.preview(files(), 2026, admin); await service.activate(run.id, run.baseRevision, admin);
    const month = await hours.month(staff, String(employee._id), '2026-10');
    assert.equal(month.entries.length, 1); assert.equal(month.totals.hours, '7.5');
    assert.deepEqual(new Set(month.plannedEntries.map(entry => entry.einsatzId)), new Set([String(futureId), String(secondId), String(missingTimesId)]));
    const future = month.plannedEntries.find(entry => entry.einsatzId === String(futureId));
    assert.equal(future.kind, 'planned'); assert.equal(future.credited, false); assert.equal(future.hours, '8');
    assert.equal(future.plannedStart, '22:00'); assert.equal(future.plannedEnd, '06:00');
    assert.equal(future.orderContext.assignment.id, String(futureId));
    assert.equal(month.plannedEntries.find(entry => entry.einsatzId === String(missingTimesId)).hours, null);
  });
  it('retains a missing employee/assignment as source and merges separately supplied table roles', async () => {
    await Mitarbeiter.collection.deleteMany({});
    const first = await service.preview([file('STUNDENVORTRAG', [draft()])], 2026, admin); await service.activate(first.id, first.baseRevision, admin);
    const second = await service.preview([file('STUNDUHR', [work(), pause()])], 2026, admin);
    assert.equal(second.counts.vortraege, 1); assert.equal(second.counts.bookings, 1); assert.equal(second.counts.editableProjections, 0);
    await service.activate(second.id, second.baseRevision, admin); assert.equal(await sourceModels.Row.countDocuments(), 3);
    assert.equal(await Stundenzeit.countDocuments(), 0);
  });
  it('keeps identical REPL_ID values in different source databases separate when linking transferred drafts', async () => {
    const input = files([draft({ ISTUEBETRAGEN: 1 }), draft({ REPL_DATABASE: 10, DBID: 10, DBIDARBEITSSCHICHT: 10, IDARBEITSSCHICHT: 18, PERSONALNR: 100002, ISTUEBETRAGEN: 1 })], [work(), pause(), work({ REPL_DATABASE: 10, DBIDARBEITSSCHICHT: 10, IDARBEITSSCHICHT: 18, PERSONALNR: 100002 }), pause({ REPL_DATABASE: 10, DBIDARBEITSSCHICHT: 10, IDARBEITSSCHICHT: 18, PERSONALNR: 100002 })]);
    const run = await service.preview(input, 2026, admin);
    assert.equal(run.counts.bookings, 2); assert.equal(run.counts.editableProjections, 1);
    await service.activate(run.id, run.baseRevision, admin);
    assert.equal((await Stundenzeit.findById(assignment._id)).status, 'RELEASED');
  });
  it('rejects stale activation and checks current roles rather than token claims', async () => {
    const [a, b] = await Promise.all([service.preview(files(), 2026, admin), service.preview(files([draft({ ISTSTUNDEN: 7 })]), 2026, admin)]);
    await service.activate(a.id, a.baseRevision, admin); await assert.rejects(() => service.activate(b.id, b.baseRevision, admin), error => error.statusCode === 409);
    const headers = { 'x-auth-token': jwt.sign({ user: { id: String(staff._id), role: 'ADMIN' } }, process.env.JWT_SECRET) };
    assert.equal((await fetch(`${base}/imports`, { headers })).status, 403);
  });
  it('persists the complete supplied year in bounded source documents and activates it atomically', async function () {
    this.timeout(180000);
    const names = [['STUNDENVORTRAG', 'Stundenvortrag 2026.xlsx'], ['STUNDUHR', 'Stunduhr 2026.xlsx']];
    if (names.some(([, name]) => !fs.existsSync(path.join(__dirname, '../assets', name)))) this.skip();
    const input = names.map(([fieldname, originalname]) => ({ fieldname, originalname, buffer: fs.readFileSync(path.join(__dirname, '../assets', originalname)) }));
    const run = await service.preview(input, 2026, admin);
    assert.equal(await sourceModels.Row.countDocuments(), 47015); assert.equal(await accounting.Booking.countDocuments(), 17681);
    assert.equal(run.productiveHours, '115831'); assert.equal(run.pauseHours, '6102');
    await service.activate(run.id, run.baseRevision, admin);
    assert.equal(String((await accounting.State.findById('INPUT:year:2026')).snapshotId), run.snapshotId);
    const snapshot = await accounting.Snapshot.findById(run.snapshotId).lean(); assert.equal(snapshot.sourceRowIds.length, 47015);
    assert.deepEqual(snapshot.timeRoles, ['STUNDENVORTRAG', 'STUNDUHR']);
  });
});
