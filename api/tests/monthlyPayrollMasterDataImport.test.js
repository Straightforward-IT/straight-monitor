const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const XLSX = require('xlsx');
const express = require('express');
const jwt = require('jsonwebtoken');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const User = require('../models/System/User');
const ImportLog = require('../models/System/ImportLog');
const { importFile, parseRows } = require('../services/payroll/MonthlyPayrollMasterDataImport');

const headers = ['ID', 'LGJAHR', 'LGMONAT', 'PERSONALNR', 'PERSGR', 'STKLASSE', 'STFAKTOR', 'KINDERFREI', 'WOARBZEIT', 'GESAMTBRUTTO', 'LOSTEUERLFD', 'NAME'];
function workbook(rows, columns = headers) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([columns, ...rows.map(row => columns.map(field => row[field] ?? ''))]), 'LGELENA');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}
const row = overrides => ({ ID: 11, LGJAHR: 2026, LGMONAT: 1, PERSONALNR: '100001', PERSGR: 101, STKLASSE: 1, STFAKTOR: '0,92', WOARBZEIT: '35,5', KINDERFREI: 2, GESAMTBRUTTO: 5000, LOSTEUERLFD: 1000, NAME: 'Nicht speichern', ...overrides });

describe('Monatlicher LGELENA-Stammdatenimport', function () {
  this.timeout(120000);
  let mongo, employeeId, server, base, admin, staff, originalSecret;
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri('monthly_payroll_test'));
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'monthly-payroll-isolated-test-secret';
    const app = express();
    app.use(express.json());
    app.use('/api/import', require('../routes/system/dataImportRoutes'));
    app.use('/api/personal', require('../routes/employee/mitarbeiterRoutes'));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    await Mitarbeiter.collection.deleteMany({});
    await User.collection.deleteMany({});
    await ImportLog.collection.deleteMany({});
    admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN', roles: [], email: 'payroll-admin@example.test' };
    staff = { _id: new mongoose.Types.ObjectId(), role: 'USER', roles: [], email: 'payroll-staff@example.test' };
    await User.collection.insertMany([admin, staff]);
    employeeId = new mongoose.Types.ObjectId();
    await Mitarbeiter.collection.insertOne({
      _id: employeeId, asana_id: 'monthly-payroll-employee', personalnr: '100001', personalnrHistory: [{ value: '900001' }], isActive: true,
      lohnStammdaten: [
        { month: '2026-01', von: new Date('2026-02-01'), arbeitszeit: { montag: 7, zeitkontoPlusLimit: 150, woche: 20 }, steuer: { klasse: 2 } },
        { month: '2026-04', arbeitszeit: { woche: 40 } },
      ],
    });
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  });

  async function upload(user, buffer = workbook([row()])) {
    const form = new FormData();
    form.append('file', new Blob([buffer]), 'LGELENA.xlsx');
    const headers = user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), role: 'ADMIN' } }, process.env.JWT_SECRET) } : {};
    const response = await fetch(`${base}/api/import/monatliche-lohndaten`, { method: 'POST', headers, body: form });
    return { status: response.status, body: await response.json() };
  }

  it('importiert ab Januar 2026 und lässt Beträge, Name und Kinderfreibetrag außen vor', async () => {
    const stats = await importFile(workbook([
      row({ LGJAHR: 2025, LGMONAT: 12 }),
      row(),
      row({ ID: 12, PERSONALNR: '900001', LGMONAT: 2, PERSGR: 110, STKLASSE: 'IV', WOARBZEIT: 10 }),
      row({ ID: 13, LGJAHR: 2027, LGMONAT: 1 }),
      row({ ID: 14, PERSONALNR: '404' }),
    ]));
    assert.equal(stats.matched, 3);
    assert.equal(stats.skippedBefore2026, 1);
    assert.equal(stats.unmatched, 1);
    const employee = await Mitarbeiter.findById(employeeId);
    assert.equal(employee.lohnStammdaten.length, 4);
    assert.equal(employee.getPersgruppeForMonth('2026-01'), 101);
    assert.equal(employee.getPersgruppeForMonth('2026-02'), 110);
    assert.equal(employee.getPersgruppeForMonth('2026-03'), null);
    assert.equal(employee.getSteuerklasseForMonth('2026-02'), 4);
    assert.equal(employee.getArbeitszeitSnapshotForMonth('2026-01').woche, 35.5);
    const january = employee.getLohnStammdatenForMonth('2026-01');
    assert.equal(january.sourceId, '11');
    assert.equal(january.steuer.faktor, 0.92);
    assert.equal(january.arbeitszeit.montag, 7);
    assert.equal(january.arbeitszeit.zeitkontoPlusLimit, 150);
    assert.equal(employee.getArbeitszeitSnapshotForMonth('2026-04').woche, 40);
    const raw = await Mitarbeiter.collection.findOne({ _id: employeeId });
    for (const field of ['GESAMTBRUTTO', 'LOSTEUERLFD', 'KINDERFREI', 'NAME', 'monat']) {
      assert.equal(JSON.stringify(raw.lohnStammdaten).includes(`"${field}"`), false);
    }
  });
  it('ist bei Wiederholung unverändert und löscht nur explizit gelieferte leere Monatswerte', async () => {
    const file = workbook([row()]);
    await importFile(file);
    assert.equal((await importFile(file)).unchanged, 1);
    await importFile(workbook([row({ STKLASSE: '', STFAKTOR: '', WOARBZEIT: '', PERSGR: '' })]));
    const employee = await Mitarbeiter.findById(employeeId);
    const entry = employee.getLohnStammdatenForMonth('2026-01');
    assert.equal(entry.arbeitszeit.woche, null);
    assert.equal(entry.arbeitszeit.montag, 7);
    assert.equal(entry.steuer.klasse, null);
    assert.equal(entry.steuer.faktor, null);
    assert.equal(entry.persgruppe, null);
  });
  it('erhält nicht migrierte Arbeitszeitmonate und respektiert manuelle Personengruppen pro Monat', async () => {
    await Mitarbeiter.collection.updateOne({ _id: employeeId }, { $set: {
      arbeitszeit: [{ month: '2026-05', woche: 15 }],
      lohnStammdaten: [{ month: '2026-01', persgruppe: 106, persgruppe_set_explicitly: true }],
    } });
    await importFile(workbook([row()]));
    const employee = await Mitarbeiter.findById(employeeId);
    assert.equal(employee.getPersgruppeForMonth('2026-01'), 106);
    assert.equal(employee.getArbeitszeitSnapshotForMonth('2026-05').woche, 15);
  });
  it('prüft alle Zeilen vor Schreibzugriffen und lehnt Konflikte und ungültige Werte ab', async () => {
    for (const overrides of [{ LGMONAT: 13 }, { STKLASSE: '4abc' }, { PERSGR: 999 }, { WOARBZEIT: -1 }, { STFAKTOR: 2 }]) {
      await assert.rejects(importFile(workbook([row(), row({ ID: 12, LGMONAT: 2, ...overrides })])), error => error.status === 400);
    }
    await assert.rejects(importFile(workbook([row(), row({ WOARBZEIT: 20 })])), /Widersprüchliche/);
    assert.equal((await Mitarbeiter.collection.findOne({ _id: employeeId })).lohnStammdaten[0].arbeitszeit.woche, 20);
    assert.throws(() => parseRows(workbook([row()], headers.filter(field => field !== 'STKLASSE'))), /STKLASSE/);
  });
  it('lehnt mehrdeutige Personalnummern ab und akzeptiert identische Duplikate', async () => {
    assert.equal((await importFile(workbook([row(), row()]))).duplicates, 1);
    await Mitarbeiter.collection.insertOne({ _id: new mongoose.Types.ObjectId(), asana_id: 'monthly-payroll-conflict', personalnr: '900001' });
    await assert.rejects(importFile(workbook([row({ PERSONALNR: '900001' })])), /mehreren Mitarbeitern/);
  });
  it('legt Snapshots auch für Mitarbeiter ohne bestehendes Lohnstammdatenfeld an', async () => {
    await Mitarbeiter.collection.updateOne({ _id: employeeId }, { $unset: { lohnStammdaten: '' } });
    assert.equal((await importFile(workbook([row()]))).updated, 1);
  });
  it('schützt den echten Importendpunkt anhand der aktuellen Adminrolle und protokolliert Imports', async () => {
    assert.equal((await upload(null)).status, 401);
    assert.equal((await upload(staff)).status, 403);
    assert.equal((await upload(admin)).status, 200);
    const log = await ImportLog.findOne({ type: 'monatliche-lohndaten' }).lean();
    assert.equal(log.status, 'success');
    const response = await fetch(`${base}/api/import/last-uploads`);
    assert.equal((await response.json()).data['monatliche-lohndaten'].filename, 'LGELENA.xlsx');
    assert.equal((await upload(admin, workbook([row({ LGMONAT: 13 })]))).status, 400);
    assert.equal(await ImportLog.countDocuments({ type: 'monatliche-lohndaten', status: 'failed' }), 1);
  });
  it('speichert manuelle Personengruppen im gewählten Monat statt im globalen Feld', async () => {
    const response = await fetch(`${base}/api/personal/mitarbeiter/${employeeId}`, {
      method: 'PATCH', headers: {
        'Content-Type': 'application/json',
        'x-auth-token': jwt.sign({ user: { id: String(admin._id) } }, process.env.JWT_SECRET),
      },
      body: JSON.stringify({ persgruppe: 106, persgruppeMonth: '2026-01', persgruppe_set_explicitly: true }),
    });
    it('migriert globale Personengruppen nur aktuell und erhält dabei die Legacy-Arbeitszeit', async () => {
      const currentMonth = Mitarbeiter.currentPayrollMonth();
      await Mitarbeiter.collection.updateOne({ _id: employeeId }, { $set: {
        persgruppe: 109, persgruppe_set_explicitly: true,
        arbeitszeit: { woche: 30 },
      } });
      await importFile(workbook([row({ LGJAHR: 2027, LGMONAT: 8 })]));
      const employee = await Mitarbeiter.findById(employeeId);
      assert.equal(employee.getPersgruppeForMonth(currentMonth), 109);
      assert.equal(employee.getPersgruppeForMonth('2027-08'), 101);
      assert.equal(employee.getArbeitszeitSnapshotForMonth(currentMonth).woche, 30);
      const raw = await Mitarbeiter.collection.findOne({ _id: employeeId });
      assert.equal(raw.persgruppe, undefined);
      assert.equal(raw.persgruppe_set_explicitly, undefined);
      assert.equal(raw.arbeitszeit, undefined);
    });
    it('filtert die Mitarbeitersuche nach der aktuellen monatlichen Personengruppe', async () => {
      await Mitarbeiter.collection.updateOne({ _id: employeeId }, { $set: {
        persgruppe: 109,
        lohnStammdaten: [
          { month: '2025-01', persgruppe: 110 },
          { month: Mitarbeiter.currentPayrollMonth(), persgruppe: 101, sourceId: '123' },
        ],
      } });
      const headers = { 'x-auth-token': jwt.sign({ user: { id: String(admin._id) } }, process.env.JWT_SECRET) };
      for (const [group, count] of [[101, 1], [109, 0], [110, 0]]) {
        const response = await fetch(`${base}/api/personal/search?q=100001&persgruppen=${group}`, { headers });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).length, count);
      }
    });
    it('löst monatliche Personengruppen unabhängig von den Arbeitszeit-Vertragsgrenzen auf', () => {
      const employee = new Mitarbeiter({ lohnStammdaten: [
        { month: '2026-01', von: '2026-02-01', persgruppe: 101, persgruppe_set_explicitly: true },
      ] });
      assert.equal(employee.getPersgruppeForMonth('2026-01'), 101);
      assert.equal(employee.getPersgruppeForMonth('2026-02'), null);
      assert.equal(employee.getMonthlyWorkingHours('2026-01'), null);
    });
    assert.equal(response.status, 200);
    const employee = await Mitarbeiter.collection.findOne({ _id: employeeId });
    assert.equal(employee.persgruppe, undefined);
    assert.equal(employee.lohnStammdaten.find(entry => entry.month === '2026-01').persgruppe, 106);
    assert.equal(employee.lohnStammdaten.find(entry => entry.month === '2026-01').arbeitszeit.woche, 20);
    assert.equal(employee.lohnStammdaten.find(entry => entry.month === '2026-04').arbeitszeit.woche, 40);
  });
});
