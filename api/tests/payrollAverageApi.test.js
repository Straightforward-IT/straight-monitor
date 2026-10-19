const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const service = require('../services/payroll/PayrollAverageService');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Lohnart = require('../models/Payroll/Lohnart');
const User = require('../models/System/User');
const hours = require('../models/Payroll/ZvooveHours');
const accounting = require('../models/Payroll/Abrechnung');
const { weekDays } = require('../domain/payroll/zvooveHours');
const { parseWageTypeWorkbook } = require('../domain/payroll/wageTypeImport');
const oid = () => new mongoose.Types.ObjectId();

describe('historical payroll average API', function () {
  this.timeout(120000);
  let mongo, server, url, employee, admin, payroll, staff, oldSecret;
  before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongo.getUri('payroll_average_test'));
    oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'isolated-average-tests';
    const app = express(); app.use('/api/payroll', require('../routes/payroll/zvooveHoursRoutes'));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); url = `http://127.0.0.1:${server.address().port}`;
    const location = oid(); employee = { _id: oid(), personalnr: '2000638', vorname: 'Referenz', nachname: 'Test', locationV2: location };
    admin = { _id: oid(), email: 'admin@average.test', role: 'ADMIN', isConfirmed: true, locationV2: location };
    payroll = { _id: oid(), email: 'payroll@average.test', role: 'PAYROLL', isConfirmed: true, locationV2: location };
    staff = { _id: oid(), email: 'staff@average.test', role: 'USER', isConfirmed: true, locationV2: location };
    await Mitarbeiter.collection.insertOne(employee); await User.collection.insertMany([admin, payroll, staff]);
    const wages = parseWageTypeWorkbook(fs.readFileSync(path.join(__dirname, '../../Documentation/Lohnarten/Lohnarten.xlsx'))).records;
    await Lohnart.collection.insertMany(wages.map(record => ({ _id: oid(), lohnartNummer: record.lohnartNummer, ...record.fields })));
    // Daily source includes weekends as FS/U. They must not become workdays.
    for (const month of ['2026-05', '2026-06', '2026-07']) {
      const refs = [];
      for (let week = 1; week <= 6; week++) {
        const days = weekDays(2026, Number(month.slice(5)), week).map((date, index) => ({ date: date.toISOString().slice(0, 10), daySlot: index + 1, hours: null, kb: 'FS', kind: 'marker', label: 'Freischicht' })).filter(day => day.date.startsWith(month));
        if (!days.length) continue;
        if (month === '2026-07') for (const day of days) if (day.date >= '2026-07-17' && day.date <= '2026-07-24') Object.assign(day, { kb: 'U', kind: 'absence', lohnartNummer: '310', hours: '4' });
        const id = oid(), key = `${month}:${week}`;
        await hours.Week.collection.insertOne({ _id: id, contentHash: key, key, month, week, personalNr: employee.personalnr, employeeId: employee._id, raw: {}, days });
        refs.push({ key, versionId: id });
      }
      const snapshot = await hours.Snapshot.create({ month, contentHash: month, rows: refs });
      await hours.State.create({ _id: month, snapshotId: snapshot._id, revision: 1 });
    }
  });
  after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (mongo) await mongo.stop(); if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  const calculate = (user = admin, query = { cutoff: '2026-08-01', months: 3 }) => service.calculate(user, String(employee._id), query);
  const request = user => fetch(`${url}/api/payroll/employees/${employee._id}/average?cutoff=2026-08-01&months=3`, { headers: { 'x-auth-token': jwt.sign({ user: { id: String(user._id), role: 'ADMIN' } }, process.env.JWT_SECRET) } });
  it('combines original L history with independent daily data and produces the reference totals without writes', async () => {
    const result = await calculate();
    assert.equal(result.mode, 'ZVOOVE_HISTORY'); assert.equal(result.rows.length, 7);
    assert.deepEqual(result.days.map(row => row.days), ['21', '22', '23']);
    assert.deepEqual(result.totals, { hours: '264', days: '66', amount: '4855.5', averageHours: '4.00', averageAmount: '18.39', dailyRate: '73.57' });
    assert.equal(result.dayBasis, 'CALENDAR_MONDAY_TO_FRIDAY'); assert.equal(result.sources[0].hash.length, 64);
    assert.equal(await accounting.Run.countDocuments(), 0); assert.equal(await accounting.State.countDocuments(), 0);
    assert.equal(result.status, 'CALCULATED');
  });
  it('checks current roles and employee location before returning historical wage amounts', async () => {
    assert.equal((await request(payroll)).status, 200);
    assert.equal((await request(staff)).status, 403);
    await assert.rejects(() => calculate({ ...payroll, locationV2: oid() }), error => error.statusCode === 403);
    await User.updateOne({ _id: payroll._id }, { $set: { isConfirmed: false } });
    assert.equal((await request(payroll)).status, 401);
  });
  it('counts the full calendar even when a monthly daily snapshot or employee mapping is missing', async () => {
    const before = await hours.State.findById('2026-05').lean(); await hours.State.collection.deleteOne({ _id: '2026-05' });
    try {
      const result = await calculate(); assert.equal(result.totals.hours, '264'); assert.equal(result.totals.days, '66'); assert.equal(result.totals.dailyRate, '73.57');
      assert.equal(result.days[0].fsDays, null); assert.ok(result.issues.some(issue => issue.code === 'FS_SOURCE_MISSING'));
    } finally { await hours.State.collection.insertOne(before); }
    await hours.Week.collection.updateMany({ month: '2026-05' }, { $set: { employeeId: null } });
    try { assert.equal((await calculate()).totals.days, '66'); }
    finally { await hours.Week.collection.updateMany({ month: '2026-05' }, { $set: { employeeId: employee._id } }); }
  });
  it('rejects unsupported selections, missing year files and ambiguous historical personnel identities', async () => {
    await assert.rejects(() => calculate(admin, { cutoff: '2026-08-01', side: 'F' }), error => error.statusCode === 400);
    await assert.rejects(() => calculate(admin, { cutoff: '2026-02-30' }), error => error.statusCode === 400);
    await assert.rejects(() => calculate(admin, { cutoff: '2026-01-01' }), error => error.code === 'AVERAGE_HISTORY_MISSING');
    const other = { _id: oid(), asana_id: 'average-other-person', email: 'other@average.test', personalnr: '98765', personalnrHistory: [{ value: employee.personalnr }] };
    await Mitarbeiter.collection.insertOne(other);
    try { await assert.rejects(() => calculate(), error => error.code === 'AVERAGE_IDENTITY_AMBIGUOUS'); }
    finally { await Mitarbeiter.collection.deleteOne({ _id: other._id }); }
  });
});
