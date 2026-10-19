const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const service = require('../services/payroll/PayrollPositionsService');
const accounting = require('../models/Payroll/Abrechnung');
const tariff = require('../models/Tariffs/TariffData');
const hours = require('../models/Payroll/ZvooveHours');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Lohnart = require('../models/Payroll/Lohnart');
const Auftrag = require('../models/Event/Auftrag');
const Einsatz = require('../models/Event/Einsatz');
const Kunde = require('../models/Customer/Kunde');
const Kundenpreis = require('../models/Customer/Kundenpreis');
const KundenKondition = require('../models/Customer/KundenKondition');
const User = require('../models/System/User');
const oid = () => new mongoose.Types.ObjectId();

describe('own payroll position preview', function () {
  this.timeout(120000);
  let repl, server, url, admin, payroll, staff, employee, assignment, snapshot, oldSecret;
  const allModels = [...Object.values(accounting), ...Object.values(tariff), ...Object.values(hours), Mitarbeiter, Lohnart, Auftrag, Einsatz, Kunde, Kundenpreis, KundenKondition, User];
  before(async () => {
    repl = await MongoMemoryReplSet.create({ instanceOpts: [{ ip: '127.0.0.1' }], replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('payroll_positions_test'));
    await Promise.all(allModels.map(model => model.init()));
    oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'positions-isolated-tests';
    const app = express(); app.use('/api/payroll', require('../routes/payroll/zvooveHoursRoutes'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); url = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    for (const model of allModels) await model.collection.deleteMany({});
    const location = oid(); employee = { _id: oid(), personalnr: '100001', locationV2: location };
    admin = { _id: oid(), email: 'admin@positions.test', role: 'ADMIN', isConfirmed: true, locationV2: location };
    payroll = { _id: oid(), email: 'payroll@positions.test', role: 'PAYROLL', isConfirmed: true, locationV2: location };
    staff = { _id: oid(), email: 'staff@positions.test', role: 'USER', isConfirmed: true, locationV2: location };
    assignment = { _id: oid(), personalNr: 100001, auftragNr: 2510476, qualSchl: '10' };
    await Mitarbeiter.collection.insertOne(employee); await User.collection.insertMany([admin, payroll, staff]); await Einsatz.collection.insertOne(assignment);
    await Auftrag.collection.insertOne({ _id: oid(), auftragNr: 2510476, kundenNr: 42, eventTitel: 'Testauftrag', locationV2: location });
    await Lohnart.create([
      { lohnartNummer: '100', lohnartBezeichnung: 'Normalstunden', berechnungsartCode: '2', fuerGesamtstunden: 'Ja' },
      { lohnartNummer: '110', lohnartBezeichnung: 'Übertarifliche Zulage', berechnungsartCode: '2', fuerGesamtstunden: 'Nein', verrechnungCode: '3', verrechnungslohnartNummer: '602', verrechnungsPrioritaet: '1' },
      { lohnartNummer: '166', lohnartBezeichnung: 'Nachtzuschlag', berechnungsartCode: '4', fuerGesamtstunden: '0' },
      { lohnartNummer: '310', lohnartBezeichnung: 'Urlaub bezahlt', kb: 'U', berechnungsartCode: '17', fuerGesamtstunden: '0' },
    ]);
    snapshot = await accounting.Snapshot.create({ kind: 'INPUT', scope: 'year:2026', contentHash: 'fixture', timeRoles: ['STUNDUHR'] });
    await accounting.State.create({ _id: 'INPUT:year:2026', snapshotId: snapshot._id, revision: 1 });
    await tariffData(); await booked(); await baseRule();
  });
  after(async () => { if(server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if(repl) await repl.stop(); if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret; });
  async function tariffData() {
    const importId = oid();
    await tariff.Catalog.create({ _id: '17055', activeImportId: importId });
    await tariff.Group.collection.insertOne({ _id: oid(), importId, legacyId: 'g', payGroups: [{ legacyId: 'p', position: 1 }], stages: [{ legacyId: 's', position: 1 }] });
    await tariff.Period.collection.insertOne({ _id: oid(), importId, legacyId: 'period', employeeGroupId: 'g', validFrom: '2026-01-01', validUntil: null, rates: [{ stagePosition: 1, groupPosition: 1, value: mongoose.Types.Decimal128.fromString('15') }], wageRules: [] });
    await tariff.Assignment.collection.insertOne({ _id: oid(), importId, legacyId: 'assignment', employeeId: employee._id, personalNr: '100001', matchStatus: 'MATCHED', intervalStatus: 'VALID', validFrom: '2026-01-01', validUntil: null, employeeGroupId: 'g', payGroupId: 'p', stageId: 's' });
    await tariff.Allowance.collection.insertOne({ _id: oid(), importId, legacyId: 'allowance', employeeId: employee._id, personalNr: '100001', matchStatus: 'MATCHED', intervalStatus: 'VALID', validFrom: '2026-01-01', validUntil: null, values: { DPREIS: mongoose.Types.Decimal128.fromString('1.39') } });
  }
  async function booked(extra = {}) {
    return accounting.Booking.create({ snapshotId: snapshot._id, ordinal: await accounting.Booking.countDocuments(), employeeId: employee._id, assignmentId: assignment._id, personalNr: '100001', auftragNr: 2510476, einsortNr: '1', date: '2026-10-09', start: '2026-10-09T06:00:00Z', end: '2026-10-09T14:30:00Z', timeZone: 'Europe/Berlin', productiveMinutes: 480, reportedHours: '8', breakMinutes: 30, paidBreakMinutes: 0, breaks: [], breakLocationKnown: false, issues: [], hints: [], sources: [{ role: 'STUNDUHR' }], ...extra });
  }
  async function baseRule(extra = {}) { return accounting.Rule.create({ snapshotId: snapshot._id, auftragNr: 2510476, side: 'F', wageType: '100', windowStart: 0, windowEnd: 1440, weekdays: [0,1,2,3,4,5,6], holiday: false, automatic: true, rate: '33', percent: '0', issues: [], ...extra }); }
  const preview = user => service.month(user || admin, String(employee._id), '2026-10');
  it('calculates L and F separately from independent data and keeps 110 out of total hours', async () => {
    const result = await preview();
    const normal = result.rows.find(row => row.side === 'L' && row.wageType === '100');
    const allowance = result.rows.find(row => row.side === 'L' && row.wageType === '110');
    assert.equal(normal.rate, '15'); assert.equal(normal.amount, '120.00'); assert.equal(normal.countForTotalHours, true);
    assert.equal(allowance.rate, '1.39'); assert.equal(allowance.amount, '11.12'); assert.equal(allowance.countForTotalHours, false);
    assert.deepEqual(allowance.offset, { code: '3', label: 'ÜTZ', target: '602', priority: '1' }); assert.equal(allowance.status, 'PARTIAL');
    assert.equal(result.rows.find(row => row.side === 'F').amount, '264.00');
    assert.equal(await accounting.Run.countDocuments(), 0); assert.equal(await accounting.Booking.countDocuments(), 1);
    await accounting.Snapshot.create({ kind: 'REFERENCE', scope: 'month:2026-10', contentHash: 'unrelated', references: [{ kind: 'LOHNARTENSUMMEN', amount: '999999', personalNr: '100001', wageType: '100', month: '2026-10' }] });
    assert.equal((await preview()).rows.find(row => row.side === 'F').amount, '264.00');
  });
  it('preserves known quantities and blocks unknown time premiums instead of inventing pause locations', async () => {
    await baseRule({ wageType: '166', windowStart: 0, windowEnd: 1440, percent: '25' });
    const result = await preview(); assert.equal(result.rows.find(row => row.side === 'F' && row.wageType === '100').amount, '264.00');
    const pending = result.rows.find(row => row.wageType === '166'); assert.equal(pending.hours, null); assert.equal(pending.amount, null); assert.equal(pending.status, 'PENDING');
    assert.ok(result.issues.some(issue => issue.code === 'BREAK_LOCATION_REQUIRED')); assert.equal(result.rows.find(row => row.side === 'F').status, 'PARTIAL');
  });
  it('keeps missing tariffs visible as unpriced positions', async () => {
    await tariff.Catalog.updateOne({ _id: '17055' }, { $set: { activeImportId: null } });
    const result = await preview(); const row = result.rows.find(row => row.side === 'L' && row.wageType === '100');
    assert.equal(row.hours, '8'); assert.equal(row.amount, null); assert.equal(row.rate, null); assert.equal(row.status, 'PENDING');
  });
  it('keeps absence quantities and FS separate while the average procedure remains open', async () => {
    const week = await hours.Week.create({ contentHash: 'week', key: 'week', month: '2026-10', personalNr: '100001', employeeId: employee._id, raw: {}, days: [
      { date: '2026-10-08', hours: '4.05', kb: 'U', kind: 'absence', lohnartNummer: '310', label: 'Urlaub' },
      { date: '2026-10-07', hours: null, kb: 'FS', kind: 'marker', label: 'Freischicht' },
    ] });
    const state = await hours.Snapshot.create({ month: '2026-10', contentHash: 'monthly', rows: [{ key: 'week', versionId: week._id }] });
    await hours.State.create({ _id: '2026-10', snapshotId: state._id });
    const result = await preview(); const vacation = result.rows.find(row => row.wageType === '310');
    assert.equal(vacation.hours, '4.05'); assert.equal(vacation.auftragNr, null); assert.equal(vacation.amount, null); assert.equal(vacation.issues[0].code, 'AVERAGE_NOT_IMPLEMENTED');
    assert.equal(result.rows.find(row => row.kb === 'FS').kind, 'marker'); assert.equal(result.rows.filter(row => row.side === 'F' && row.kind !== 'productive').length, 0);
  });
  it('uses a unique valid qualification price only for base previews and never overrides order prices', async () => {
    await accounting.Rule.collection.deleteMany({});
    const customer = { _id: oid(), kundenNr: 42 }; await Kunde.collection.insertOne(customer);
    await Kundenpreis.collection.insertOne({ _id: oid(), sourceId: 'price-1', kunde: customer._id, qualSchluessel: 10, validFrom: new Date('2026-01-01'), validTill: null, hourlyRateCents: 3500 });
    const result = await preview(); assert.equal(result.rows.find(row => row.side === 'F').amount, '280.00'); assert.equal(result.rows.find(row => row.side === 'F').status, 'PARTIAL');
    await baseRule(); assert.equal((await preview()).rows.find(row => row.side === 'F').amount, '264.00');
    await accounting.Rule.collection.deleteMany({});
    await Kundenpreis.collection.insertOne({ _id: oid(), sourceId: 'price-2', kunde: customer._id, qualSchluessel: 10, validFrom: new Date('2026-09-01'), validTill: null, hourlyRateCents: 4000 });
    assert.equal((await preview()).rows.find(row => row.side === 'F').amount, null);
  });
  it('enforces current roles and location permissions without exposing F to PAYROLL', async () => {
    await assert.rejects(() => preview(staff), error => error.statusCode === 403);
    const own = await preview(payroll); assert.deepEqual(own.allowedSides, ['L']); assert.ok(own.rows.every(row => row.side === 'L'));
    await assert.rejects(() => preview({ ...payroll, locationV2: oid() }), error => error.statusCode === 403);
    const token = jwt.sign({ user: { id: String(staff._id), role: 'ADMIN' } }, process.env.JWT_SECRET);
    const response = await fetch(`${url}/api/payroll/employees/${employee._id}/positions?month=2026-10`, { headers: { 'x-auth-token': token } }); assert.equal(response.status, 403);
  });
  it('values monthly source quantities without guessing an order or adding old detail hours twice', async () => {
    await accounting.State.collection.deleteMany({});
    const week = await hours.Week.create({ contentHash: 'quantity', key: 'quantity', month: '2026-10', personalNr: '100001', employeeId: employee._id, raw: {}, days: [{ date: '2026-10-09', hours: '8', kb: '', kind: 'productive', label: 'Produktiv' }] });
    const snapshot = await hours.Snapshot.create({ month: '2026-10', contentHash: 'quantity-snapshot', rows: [{ key: 'quantity', versionId: week._id }] });
    await hours.State.create({ _id: '2026-10', snapshotId: snapshot._id });
    const result = await preview();
    const normal = result.rows.filter(row => row.side === 'L' && row.wageType === '100');
    assert.equal(normal.length, 1); assert.equal(normal[0].hours, '8'); assert.equal(normal[0].amount, '120.00'); assert.equal(normal[0].auftragNr, null);
    assert.equal(result.rows.find(row => row.side === 'F').amount, null);
    await accounting.State.create({ _id: 'INPUT:order:2510476', snapshotId: snapshot._id });
    // Publish the earlier canonical booking's scope without including its
    // productive monthly aggregate as a second source.
    const booking = await accounting.Booking.findOne().lean();
    await accounting.State.collection.updateOne({ _id: 'INPUT:order:2510476' }, { $set: { snapshotId: booking.snapshotId } });
    assert.equal((await preview()).rows.filter(row => row.side === 'L' && row.wageType === '100').length, 1);
  });
  it('keeps overnight segments associated with their selected booking day', async () => {
    await accounting.Booking.collection.deleteMany({});
    await booked({ start: '2026-10-09T21:00:00Z', end: '2026-10-10T01:00:00Z', productiveMinutes: 240, reportedHours: '4', breakMinutes: 0, breakLocationKnown: true });
    const result = await preview(); const normal = result.rows.filter(row => row.side === 'L' && row.wageType === '100');
    assert.equal(normal.length, 2); assert.ok(normal.every(row => row.date === '2026-10-09')); assert.ok(normal.some(row => row.serviceDate === '2026-10-10'));
    assert.equal(normal.reduce((sum, row) => sum + Number(row.quantityNumerator), 0), 240);
  });
});
