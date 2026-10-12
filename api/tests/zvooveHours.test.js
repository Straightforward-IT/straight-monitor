const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const d = require('../domain/payroll/zvooveHours');
const service = require('../services/payroll/ZvooveHoursService');
const { Week, Snapshot, Import, State } = require('../models/Payroll/ZvooveHours');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Lohnart = require('../models/Payroll/Lohnart');
const User = require('../models/System/User');
const oid = () => new mongoose.Types.ObjectId();
const row = (overrides = {}) => ({ ...Object.fromEntries(d.COLUMNS.map(column => [column, null])), PERSONALNR: 100001, JAHR: 2026, MONAT: 1, WOCHE: 2, KW: 2, ...overrides });
function buffer(rows, headers = d.COLUMNS, origin = 'A1') {
  const workbook = XLSX.utils.book_new(), sheet = {};
  XLSX.utils.sheet_add_aoa(sheet, [headers, ...rows.map(record => headers.map(header => record[header] ?? null))], { origin });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Stunden');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
const parse = rows => d.parseWorkbook(buffer(rows), 'Januar.xlsx');

describe('Zvoove monthly hours domain', () => {
  it('retains exact decimal hours, zero and empty values as distinct source facts', () => {
    const parsed = parse([row({ T1: 1.6800000000000002, T2: 0, T3: null, KZ4: 'FS' })]);
    assert.equal(parsed.issues.length, 0);
    assert.deepEqual(parsed.rows[0].days.map(day => [day.date, day.hours, day.kb]), [['2026-01-05', '1.6800000000000002', ''], ['2026-01-06', '0', ''], ['2026-01-08', null, 'FS']]);
    assert.equal(d.decimal('1.25e-7'), '0.000000125');
    assert.equal(d.decimal(-2.3), '-2.3');
    assert.equal(d.sumDecimals(['1.6800000000000002', '0.32', '-0.0000000000000002']), '2');
  });
  it('uses monthly week positions across year and month boundaries, including real sixth weeks', () => {
    const january = parse([row({ WOCHE: 1, KW: 1, T4: 6 }), row({ WOCHE: 6, KW: null })]);
    assert.equal(january.issues.length, 0); assert.equal(january.rows.length, 2); assert.equal(january.rows[0].days[0].date, '2026-01-01'); assert.equal(january.rows[1].days.length, 0);
    const february = parse([row({ MONAT: 2, WOCHE: 1, KW: 5, T7: 1 })]);
    assert.equal(february.rows[0].days[0].date, '2026-02-01');
    const march = parse([row({ MONAT: 3, WOCHE: 6, KW: 14, T1: 4 })]);
    assert.equal(march.issues.length, 0); assert.equal(march.rows[0].days[0].date, '2026-03-30');
  });
  it('rejects invalid calendar cells, keys, columns, different duplicates and mixed months', () => {
    for (const records of [[row({ WOCHE: 1, KW: 1, T1: 1 })], [row({ KW: 3 })], [row({ WOCHE: 9 })], [row({ PERSONALNR: '' })], [row({ T1: 'NaN' })], [row({ T1: 1 }), row({ T1: 2 })], [row(), row({ MONAT: 2, KW: 6 })]]) {
      assert.ok(parse(records).issues.some(issue => issue.severity === 'ERROR'));
    }
    assert.equal(d.parseWorkbook(buffer([row()], ['PERSONALNR'])).issues[0].code, 'INVALID_COLUMNS');
    assert.equal(parse([row({ T1: 1 }), row({ T1: 1 })]).rows.length, 1);
  });
  it('retains invalid source rows and actual Excel row offsets', () => {
    const parsed = d.parseWorkbook(buffer([row({ KW: 99 })], d.COLUMNS, 'A5'), 'Offset.xlsx');
    assert.equal(parsed.issues[0].source.row, 6);
    assert.equal(parsed.sourceRows[0].source.row, 6);
    assert.equal(parsed.sourceRows[0].raw.KW, 99);
  });
  it('resolves historical personnel and KB generically, and never treats empty KB as absence', () => {
    const parsed = parse([row({ PERSONALNR: '900001', T1: 6, T2: 0, KZ2: 'k', KZ3: 'FS', KZ4: 'üG', KZ5: 'XX' })]);
    const employee = { _id: oid(), personalnr: '100001', personalnrHistory: [{ value: '900001' }] };
    const resolved = d.resolveRows(parsed.rows, [employee], [{ kb: 'K', lohnartNummer: '320', lohnartBezeichnung: 'Krank' }, { kb: 'ÜG', lohnartNummer: '400' }]);
    assert.equal(resolved.rows[0].employeeId, String(employee._id));
    assert.deepEqual(resolved.rows[0].days.map(day => day.kind), ['productive', 'absence', 'marker', 'absence', 'unresolved']);
    assert.equal(resolved.rows[0].days[2].lohnartNummer, undefined);
    assert.equal(resolved.rows[0].raw.KZ2, 'k');
    assert.equal(resolved.issues[0].code, 'KB_MISSING');
    const ambiguous = d.resolveRows(parsed.rows, [employee, { _id: oid(), personalnr: '900001' }], [{ kb: 'K', lohnartNummer: '320' }, { kb: 'K', lohnartNummer: '321' }]);
    assert.equal(ambiguous.rows[0].employeeId, null); assert.equal(ambiguous.rows[0].days[1].kind, 'unresolved');
  });
  it('changes business hashes on repaired mappings while reusing different-file provenance', () => {
    const rows = parse([row({ T1: 2, KZ1: 'K' })]).rows;
    const unresolved = d.resolveRows(rows, [], []).rows[0];
    const resolved = d.resolveRows(rows, [{ _id: oid(), personalnr: '100001' }], [{ kb: 'K', lohnartNummer: '320' }]).rows[0];
    assert.notEqual(d.rowHash(unresolved), d.rowHash(resolved));
    assert.equal(d.rowHash(resolved), d.rowHash({ ...resolved, source: { filename: 'Wiederholung.xlsx', row: 99 } }));
  });
});

describe('Zvoove monthly hours storage and access', function () {
  this.timeout(120000);
  let repl, server, base, oldSecret, employee, admin, staff, location;
  before(async () => {
    repl = await MongoMemoryReplSet.create({ instanceOpts: [{ ip: '127.0.0.1' }], replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('zvoove_hours_test'));
    await Promise.all([Week.init(), Snapshot.init(), Import.init(), State.init(), Lohnart.init()]);
    oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'zvoove-hours-isolated-tests';
    const app = express(); app.use(express.json()); app.use('/api/payroll', require('../routes/payroll/zvooveHoursRoutes'));
    server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)); });
    base = `http://127.0.0.1:${server.address().port}/api/payroll`;
  });
  beforeEach(async () => {
    for (const model of [Week, Snapshot, Import, State, Mitarbeiter, Lohnart, User]) await model.collection.deleteMany({});
    location = oid(); employee = { _id: oid(), personalnr: '100001', personalnrHistory: [{ value: '900001' }], vorname: 'Anna', nachname: 'Import', locationV2: location, arbeitszeit: { monat: 80 } };
    admin = { _id: oid(), email: 'admin@import.test', role: 'ADMIN', roles: ['ADMIN'], isConfirmed: true, locationV2: location };
    staff = { _id: oid(), email: 'staff@import.test', role: 'USER', roles: ['USER'], isConfirmed: true, locationV2: location };
    await Mitarbeiter.collection.insertOne(employee); await User.collection.insertMany([admin, staff]);
    await Lohnart.create({ lohnartNummer: '320', kb: 'K', lohnartBezeichnung: 'Krank mit Lohnfortzahlung' });
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (repl) await repl.stop();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  });
  async function request(path, { user = admin, method = 'GET', body, upload } = {}) {
    const headers = { 'x-auth-token': jwt.sign({ user: { id: String(user._id), role: 'ADMIN' } }, process.env.JWT_SECRET) };
    let payload;
    if (upload) { payload = new FormData(); payload.append('file', new Blob([buffer(upload)]), 'Januar.xlsx'); }
    else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const response = await fetch(base + path, { method, headers, ...(payload ? { body: payload } : {}) });
    return { status: response.status, body: await response.json() };
  }
  async function preview(rows) { const result = await request('/imports/preview', { method: 'POST', upload: rows }); assert.equal(result.status, 200); return result.body; }
  const activate = run => request(`/imports/${run.id}/activate`, { method: 'POST', body: { expectedRevision: run.baseRevision } });
  const month = user => request(`/employees/${employee._id}/month?month=2026-01`, { user });
  it('previews separately, activates atomically and returns raw decimal source facts', async () => {
    const run = await preview([row({ T1: 1.6800000000000002, T2: 0, KZ3: 'FS', T4: 3, KZ4: 'K' })]);
    assert.equal(run.valid, true); assert.equal(run.counts.days, 4); assert.equal((await month()).body.entries.length, 0);
    assert.equal((await activate(run)).status, 200);
    const result = (await month(staff)).body;
    assert.equal(result.employee.name, 'Anna Import'); assert.equal(result.totals.hours, '4.6800000000000002');
    assert.equal(result.entries[0].kind, 'productive'); assert.equal(result.entries[0].source.row, 2); assert.equal(result.entries[0].source.raw.T1, 1.6800000000000002);
    assert.equal(result.entries[2].hours, null); assert.equal(result.entries[2].kind, 'marker');
    assert.equal((await request('/imports')).body.imports[0].rows, undefined);
  });
  it('replaces supplied complete weeks, clears values and preserves absent weeks and immutable versions', async () => {
    const first = await preview([row({ T1: 6, T2: 2 }), row({ WOCHE: 3, KW: 3, T1: 4 })]); await activate(first);
    const stateBefore = await State.findById('2026-01').lean();
    const second = await preview([row({ T1: null, T2: 0, KZ2: 'FS' })]);
    assert.equal(second.changes.updated, 1); assert.equal(second.changes.retained, 1); await activate(second);
    const result = (await month()).body;
    assert.deepEqual(result.entries.map(entry => [entry.date, entry.hours]), [['2026-01-06', '0'], ['2026-01-12', '4']]);
    const originalSnapshot = await Snapshot.findById(stateBefore.snapshotId).lean();
    const oldWeek = await Week.findById(originalSnapshot.rows[0].versionId).lean(); assert.equal(oldWeek.raw.T1, 6);
    assert.equal((await request(`/imports/${first.id}`)).body.status, 'SUPERSEDED');
    await assert.rejects(() => Week.updateOne({ _id: oldWeek._id }, { $set: { raw: {} } }), /Immutable/);
  });
  it('reuses identical business versions and dataset revisions', async () => {
    const first = await preview([row({ T1: 6 })]); await activate(first);
    const second = await preview([row({ T1: 6 })]); assert.equal(second.changes.unchanged, 1); await activate(second);
    assert.equal(await Week.countDocuments(), 1); assert.equal(await Snapshot.countDocuments(), 1); assert.equal((await month()).body.datasetRevision, 1);
  });
  it('allows concurrent identical previews without duplicate business versions', async () => {
    const runs = await Promise.all([preview([row({ T1: 6 })]), preview([row({ T1: 6 })])]);
    assert.ok(runs.every(run => run.valid)); assert.equal(await Week.countDocuments(), 1); assert.equal(await Snapshot.countDocuments(), 1);
  });
  it('keeps invalid imports and conflicting activations away from the active dataset', async () => {
    const first = await preview([row({ T1: 6 })]); await activate(first);
    const invalid = await preview([row({ T1: 7, KW: 99 })]); assert.equal(invalid.valid, false); assert.equal((await activate(invalid)).status, 400);
    assert.equal((await Import.findById(invalid.id).lean()).rows[0].raw.KW, 99);
    const a = await preview([row({ T1: 7 })]), b = await preview([row({ T1: 8 })]);
    const responses = await Promise.all([activate(a), activate(b)]); assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const result = (await month()).body; assert.equal(result.datasetRevision, 2); assert.ok(['7', '8'].includes(result.totals.hours));
  });
  it('repairs missing identity/mapping on identical-file reimport and preserves overlapping aliases', async () => {
    const first = await preview([row({ PERSONALNR: 100009, T1: 2, KZ1: 'XX' })]); await activate(first);
    assert.ok(first.issues.some(issue => issue.code === 'EMPLOYEE_MISSING'));
    await Mitarbeiter.collection.updateOne({ _id: employee._id }, { $push: { personalnrHistory: { value: '100009' } } });
    await Lohnart.create({ lohnartNummer: '900', kb: 'XX' });
    const second = await preview([row({ PERSONALNR: 100009, T1: 2, KZ1: 'XX' }), row({ PERSONALNR: 900001, T1: 3 })]); await activate(second);
    const result = (await month()).body; assert.equal(result.entries.length, 2); assert.equal(result.totals.hours, '5');
    assert.equal(result.issues[0].code, 'MULTIPLE_PERSONNEL_ENTRIES'); assert.equal(result.entries.find(entry => entry.kb === 'XX').lohnartNummer, '900');
  });
  it('checks live admin roles, confirmation and employee locations, not JWT role claims', async () => {
    assert.equal((await request('/imports', { user: staff })).status, 403);
    assert.equal((await request('/imports/preview', { user: staff, method: 'POST', upload: [row()] })).status, 403);
    assert.equal((await month(staff)).status, 200);
    await User.collection.updateOne({ _id: staff._id }, { $set: { locationV2: oid() } }); assert.equal((await month(staff)).status, 403);
    await User.collection.updateOne({ _id: admin._id }, { $set: { role: 'USER', roles: ['USER'] } }); assert.equal((await request('/imports')).status, 403);
    await User.collection.updateOne({ _id: staff._id }, { $set: { isConfirmed: false } }); assert.equal((await month(staff)).status, 401);
  });
});
