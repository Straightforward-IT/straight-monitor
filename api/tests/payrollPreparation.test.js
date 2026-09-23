const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { Preparation, Snapshot, Mapping } = require('../models/Payroll/Preparation');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const User = require('../models/System/User');
const Stundenzeit = require('../models/Stundenzeit');
const Lohnart = require('../models/Payroll/Lohnart');
const d = require('../services/payroll/preparationDomain');
const mapper = require('../services/payroll/lodasMapper');
const oid = () => new mongoose.Types.ObjectId();
const values = { date: '2026-09-08', start: '20:00', end: '04:00', actualStart: new Date('2026-09-08T18:00:00Z'), actualEnd: new Date('2026-09-09T02:00:00Z'), breakMinutes: 30, paidBreakMinutes: 0, netMinutes: 450, breaks: [] };
const absence = () => ({ id: 'sick-1', kind: 'ABSENCE', code: 'K', reason: 'Geprüfte Krankmeldung', startDate: '2026-09-30', endDate: '2026-10-02', daily: [{ date: '2026-09-30', minutes: 120 }, { date: '2026-10-01', minutes: 240 }, { date: '2026-10-02', minutes: 0 }] });
const quantityRule = (code, salaryTypeId = 100) => ({ code, mode: 'QUANTITY', salaryTypeId, processingCode: 1, unit: 'HOURS', sign: 1 });

describe('Offline LODAS preparation contract', () => {
  it('rejects custom bounds, enums, regex, lengths and malformed dates', () => {
    for (const payload of [{ personnel_number: 100000 }, { personnel_number: '12' }, { processing_code: 999 }, { cost_center_id: '/invalid' }, { cost_center_id: 'A'.repeat(14) }, { value: Infinity }, { month_of_emergence: '2026-09-01' }]) assert.ok(mapper.validateWire('MonthRecord', payload).length);
    assert.ok(mapper.validateWire('AbsenceLodas', { absence_start_date: '2026-02-30' }).length);
    assert.ok(mapper.validateWire('AbsenceLodas', { reason_for_absence: 99999 }).length);
  });
  it('aggregates integer minutes before deterministic conversion with source traceability', () => {
    const snapshot = { month: '2026-09', sources: [{ id: '1', values: { netMinutes: 1 } }, { id: '2', values: { netMinutes: 1 } }], items: [] };
    const mapping = { version: 1, config: mapper.normalizeConfig({ clientId: '123-45', personnelNumber: 42, rules: [quantityRule('P')] }) };
    const result = mapper.preview(snapshot, mapping);
    assert.equal(result.quantities[0].body.value, 0.03);
    assert.deepEqual(result.quantities[0].sourceIds, ['time:1', 'time:2']);
    assert.equal(result.mappingComplete, true);
    assert.deepEqual(mapper.preview(snapshot, mapping), result);
    mapping.config.rules[0].sign = -1;
    assert.equal(mapper.preview(snapshot, mapping).quantities[0].body.value, -0.03);
  });
  it('does not guess mappings, drop unknown items or duplicate a source', () => {
    const snap = { month: '2026-09', sources: [{ id: 'x', values: { netMinutes: 60 } }, { id: 'x', values: { netMinutes: 60 } }], items: [] };
    const result = mapper.preview(snap, { config: { clientId: '123-4', personnelNumber: 12, rules: [quantityRule('P')] } });
    assert.equal(result.quantities[0].body.value, 1);
    assert.ok(result.issues.some(i => i.code === 'DUPLICATE_SOURCE'));
    assert.deepEqual(result.requests, []);
    assert.ok(mapper.preview(snap).issues.some(i => i.code === 'RULE_MISSING'));
  });
  it('keeps full absence dates, separates monthly quantities and recognizes continuations', () => {
    const item = { ...absence(), credited: true };
    const config = mapper.normalizeConfig({ clientId: '123-4', personnelNumber: 12, rules: [{ ...quantityRule('K'), mode: 'BOTH', absenceReason: 32 }] });
    const result = mapper.preview({ month: '2026-10', sources: [], items: d.projectItems([item], '2026-10') }, { config });
    assert.equal(result.quantities[0].body.value, 4);
    assert.equal(result.absences[0].body.absence_start_date, '2026-09-30');
    assert.equal(result.absences[0].body.absence_end_date, '2026-10-02');
    assert.equal(result.absences[0].continuation, true);
  });
  it('rejects injected balances and duplicate, fractional or out-of-period quantities', () => {
    const types = [{ code: 'K', kind: 'sick', label: 'Krank', credited: true }];
    assert.throws(() => d.normalizeItems([{ ...absence(), bankMinutes: 10 }], '2026-09', types, []));
    assert.throws(() => d.normalizeItems([{ ...absence(), daily: [{ date: '2026-09-30', minutes: 1.5 }] }], '2026-09', types, []));
    assert.throws(() => d.normalizeItems([{ ...absence(), daily: [{ date: '2026-09-29', minutes: 10 }] }], '2026-09', types, []));
    assert.throws(() => d.normalizeItems([absence(), absence()], '2026-09', types, []));
  });
});

describe('Payroll monthly preparation API', function () {
  this.timeout(120000);
  let repl, server, base, employee, staff, reviewer, outsider, admin, sourceId, oldSecret;
  async function request(path, { user = staff, method = 'GET', body } = {}) {
    const token = jwt.sign({ user: { id: String(user._id), role: 'ADMIN' } }, process.env.JWT_SECRET);
    const response = await fetch(`${base}/api/payroll/employees/${employee._id}${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-auth-token': token }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const read = (month = '2026-09') => request(`/months/${month}`);
  async function save(items = [], extra = {}, month = '2026-09') {
    const state = (await read(month)).body;
    return request(`/months/${month}`, { method: 'PUT', body: { revision: state.revision, sourceHash: state.sourceHash, items, reason: 'Geprüft', ...extra } });
  }
  async function act(action, state, user = reviewer) { return request(`/months/2026-09/${action}`, { user, method: 'POST', body: { revision: state.revision, sourceHash: state.sourceHash, reason: 'Monatsprüfung' } }); }
  before(async () => {
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('payroll_preparation_test'));
    await Promise.all([Preparation, Snapshot, Mapping, Stundenzeit, Lohnart].map(model => model.init()));
    oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'payroll-preparation-isolated-test';
    const app = express(); app.use(express.json()); app.use('/api/payroll', require('../routes/payroll/preparationRoutes'));
    server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    for (const model of [Preparation, Snapshot, Mapping, Stundenzeit, Mitarbeiter, User, Lohnart]) await model.collection.deleteMany({});
    const location = oid();
    employee = { _id: oid(), vorname: 'Test', nachname: 'Employee', personalnr: '100001', locationV2: location };
    staff = { _id: oid(), role: 'USER', roles: [], isConfirmed: true, locationV2: location };
    reviewer = { ...staff, _id: oid(), roles: ['PAYROLL'] };
    outsider = { ...reviewer, _id: oid(), locationV2: oid() };
    admin = { ...staff, _id: oid(), role: 'ADMIN', locationV2: oid() };
    await Mitarbeiter.collection.insertOne(employee); await User.collection.insertMany([staff, reviewer, outsider, admin].map(u => ({ ...u, email: `${u._id}@example.test` })));
    await Lohnart.create({ lohnartNummer: '999', kb: 'K', lohnartBezeichnung: 'Krank' });
    sourceId = oid();
    await Stundenzeit.create({ _id: sourceId, mitarbeiter: employee._id, personalNr: 100001, auftragNr: 12, revision: 1, status: 'RELEASED', current: values, released: values, releasedAt: new Date('2026-09-10'), history: [{ revision: 1, action: 'RELEASED', at: new Date('2026-09-10'), values }] });
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (repl) await repl.stop();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  });
  it('saves absences and AZK proposals across reloads without an account balance or altered work facts', async () => {
    const items = [absence(), { id: 'deposit', kind: 'TRANSFER', date: '2026-09-08', minutes: 60, source: String(sourceId), target: 'AZK', reason: 'Zur Prüfung' }];
    assert.equal((await save(items)).status, 200);
    const current = (await read()).body;
    assert.equal(current.items.length, 2); assert.equal(current.totals.workedMinutes, 450);
    assert.equal(current.totals.proposedDepositMinutes, 60);
    assert.equal(current.timeAccount.status, 'UNAVAILABLE'); assert.equal(current.timeAccount.minutes, undefined);
    const october = (await read('2026-10')).body;
    assert.equal(october.inherited[0].startDate, '2026-09-30'); assert.equal(october.totals.absenceMinutes, 240);
    const stored = JSON.stringify(await Preparation.findOne().lean());
    assert.equal(/bankMinutes|openingBalance|balance/i.test(stored), false);
    assert.equal((await Stundenzeit.findById(sourceId)).released.netMinutes, 450);
    assert.equal((await Stundenzeit.findById(sourceId)).released.actualEnd.toISOString(), values.actualEnd.toISOString());
  });
  it('enforces live roles and locations despite an admin claim in the JWT', async () => {
    const saved = await save([]);
    assert.equal((await act('finalize', saved.body, staff)).status, 403);
    assert.equal((await request('/months/2026-09', { user: outsider })).status, 403);
    assert.equal((await request('/months/2026-09', { user: admin })).status, 200);
    await User.updateOne({ _id: reviewer._id }, { $set: { roles: [] } });
    assert.equal((await act('finalize', saved.body, reviewer)).status, 403);
    assert.equal((await request('/lodas-mapping')).status, 403);
  });
  it('rejects simultaneous saves and does not overwrite the winning revision', async () => {
    const state = (await read()).body;
    const body = { revision: 0, sourceHash: state.sourceHash, items: [], reason: 'Concurrent' };
    const results = await Promise.all([request('/months/2026-09', { method: 'PUT', body }), request('/months/2026-09', { method: 'PUT', body })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal(await Preparation.countDocuments(), 1);
  });
  it('freezes snapshots and requires reopening and reconciliation for changed releases', async () => {
    const saved = await save([absence()]);
    const final = await act('finalize', saved.body);
    assert.equal(final.status, 200);
    const id = final.body.snapshots[0]._id;
    const original = (await request(`/snapshots/${id}`)).body;
    assert.equal((await save([])).status, 409);
    await assert.rejects(() => Snapshot.updateOne({ _id: id }, { $set: { contentHash: 'forged' } }), /Immutable/);
    await Stundenzeit.updateOne({ _id: sourceId }, { $set: { revision: 2, 'current.netMinutes': 400, status: 'DRAFT' } });
    assert.equal((await read()).body.stale, false, 'office draft must not invalidate released sources');
    await Stundenzeit.updateOne({ _id: sourceId }, { $set: { 'released.netMinutes': 420 }, $push: { history: { revision: 3, action: 'RELEASED', at: new Date(), values: { ...values, netMinutes: 420 } } } });
    const changed = (await read()).body; assert.equal(changed.stale, true);
    assert.equal((await act('reopen', changed)).status, 200);
    assert.equal((await save([absence()])).status, 409);
    const reconciled = await save([absence()], { reconcile: true }); assert.equal(reconciled.status, 200);
    assert.equal((await act('finalize', reconciled.body)).status, 200);
    const historic = (await request(`/snapshots/${id}`)).body;
    assert.equal(historic.contentHash, original.contentHash); assert.deepEqual(historic.payload, original.payload);
    assert.equal(historic.stale, true); assert.equal(historic.current, false);
    assert.equal(await Snapshot.countDocuments(), 2);
  });
  it('marks a reviewed later month stale when an originating absence changes', async () => {
    await save([absence()]);
    const october = await save([], {}, '2026-10');
    assert.equal(october.status, 200);
    const item = absence(); item.daily[1].minutes = 180;
    await save([item]);
    assert.equal((await read('2026-10')).body.stale, true);
  });
  it('stores versioned mappings and produces offline previews without needing credentials', async () => {
    const final = await act('finalize', (await save([])).body);
    const id = final.body.snapshots[0]._id;
    const empty = await request(`/snapshots/${id}/preview`, { user: reviewer });
    assert.equal(empty.body.mappingComplete, false); assert.equal(empty.body.transmissionEnabled, false);
    const config = { clientId: '123-45', personnelNumber: 42, rules: [quantityRule('P')] };
    assert.equal((await request('/lodas-mapping', { user: reviewer, method: 'PUT', body: { version: 0, config } })).status, 200);
    assert.equal((await request('/lodas-mapping', { user: reviewer, method: 'PUT', body: { version: 0, config } })).status, 409);
    const ready = (await request(`/snapshots/${id}/preview`, { user: reviewer })).body;
    assert.equal(ready.mappingComplete, true); assert.equal(ready.quantities[0].body.value, 7.5);
    assert.equal(ready.quantities[0].body.personnel_number, 42);
    assert.equal((await Mitarbeiter.findById(employee._id)).personalnr, '100001');
  });
  it('rejects balances, unowned source references and overlapping absence periods', async () => {
    assert.equal((await save([], { balance: 60 })).status, 400);
    assert.equal((await save([{ id: 'fake', kind: 'TRANSFER', date: '2026-09-01', minutes: 20, source: String(oid()), target: 'AZK', reason: 'Invalid' }])).status, 400);
    assert.equal((await save([absence(), { ...absence(), id: 'duplicate' }])).status, 400);
  });
});
