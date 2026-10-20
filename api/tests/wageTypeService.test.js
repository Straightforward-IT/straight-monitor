const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const XLSX = require('xlsx');
const Lohnart = require('../models/Payroll/Lohnart');
const KundenKondition = require('../models/Customer/KundenKondition');
const Kunde = require('../models/Customer/Kunde');
const User = require('../models/System/User');
const { FIELD_NAMES, parseWageTypeWorkbook } = require('../domain/payroll/wageTypeImport');
const { createWageTypeService } = require('../services/payroll/WageTypeService');
const { createWageTypeRouter } = require('../routes/payroll/wageTypeRoutes');

function workbook(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Import');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

describe('Lohnarten service and authenticated API (isolated MongoDB)', function () {
  this.timeout(120000);
  let mongo, server, baseUrl, service, admin, staff, oldSecret;
  const sourcePath = path.resolve(__dirname, '../../Documentation/Lohnarten/Lohnarten.xlsx');
  const sourceWorkbook = fs.readFileSync(sourcePath);
  const sourceOptions = { filename: 'Lohnarten.xlsx' };

  before(async () => {
    assert.equal(mongoose.connection.readyState, 0, 'Tests require a disconnected Mongoose instance.');
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongo.getUri('wage_type_isolated_test'));
    await Lohnart.init();
    oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'wage-type-isolated-api-test';
    service = createWageTypeService();
    const app = express();
    app.use(express.json());
    app.use('/api/import', createWageTypeRouter({ service, logImport: async () => {} }));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      instance.on('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    await Promise.all([
      Lohnart.collection.deleteMany({}), KundenKondition.collection.deleteMany({}),
      Kunde.collection.deleteMany({}), User.collection.deleteMany({}),
    ]);
    admin = { _id: new mongoose.Types.ObjectId(), email: 'wage-admin@example.test', role: 'ADMIN', roles: [] };
    staff = { _id: new mongoose.Types.ObjectId(), email: 'wage-staff@example.test', role: 'USER', roles: ['USER'] };
    await User.collection.insertMany([admin, staff]);
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongo) {
      await mongoose.disconnect();
      await mongo.stop();
    }
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });

  const token = (user, claimedRole = user?.role) => jwt.sign({ user: { id: String(user._id), role: claimedRole } }, process.env.JWT_SECRET);
  async function get(route, user = staff) {
    const response = await fetch(`${baseUrl}/api/import/${route}`, { headers: user ? { 'x-auth-token': token(user) } : {} });
    return { status: response.status, body: await response.json() };
  }
  async function upload(user, buffer = sourceWorkbook, claimedRole = user?.role) {
    const form = new FormData();
    form.append('file', new Blob([buffer]), sourceOptions.filename);
    const response = await fetch(`${baseUrl}/api/import/lohnart`, {
      method: 'POST', headers: user ? { 'x-auth-token': token(user, claimedRole) } : {}, body: form,
    });
    return { status: response.status, body: await response.json() };
  }

  it('persists every mapped setting and all 129 source columns for 153 real records', async () => {
    const response = await upload(admin);
    assert.equal(response.status, 200);
    assert.equal(response.body.details.inserted, 153);
    assert.equal(response.body.details.total, 153);
    assert.equal(await Lohnart.countDocuments(), 153);
    for (const field of FIELD_NAMES) assert.ok(Lohnart.schema.path(field), `Schema is missing ${field}`);
    const parsed = parseWageTypeWorkbook(sourceWorkbook, sourceOptions);
    const stored = await Lohnart.find({}).lean();
    const byNumber = new Map(stored.map(row => [row.lohnartNummer, row]));
    for (const source of parsed.records) {
      const row = byNumber.get(source.lohnartNummer);
      assert.equal(row.source.columns.length, 129);
      assert.deepEqual(row.source, source.source);
      for (const [field, value] of Object.entries(source.fields)) assert.equal(row[field], value, `${source.lohnartNummer}.${field}`);
    }
    assert.equal(byNumber.get('110').verrechnungCode, '3');
    assert.equal(byNumber.get('110').verrechnungslohnartNummer, '602');
    assert.equal(byNumber.get('110').verrechnungsPrioritaet, '1');
    assert.equal(byNumber.get('191').fakturierungCode, '3');
    assert.equal(byNumber.get('192').fakturierungCode, '1');
    assert.equal(byNumber.get('503').kb, 'Q');
    assert.equal(byNumber.get('506').kb, 'Q');
    assert.equal(byNumber.get('100').fuerGesamtstunden, 'Ja');
    assert.equal(byNumber.get('100').bgPflichtCode, '1');
    assert.equal(byNumber.get('100').source.columns[128].value, 0);
    assert.ok(!('bg2Code' in byNumber.get('100')));
  });

  it('re-imports identically without duplicate records, timestamps or provenance histories', async () => {
    await service.importWorkbook(sourceWorkbook, sourceOptions);
    const before = await Lohnart.findOne({ lohnartNummer: '110' }).lean();
    const repeated = await service.importWorkbook(sourceWorkbook, sourceOptions);
    assert.equal(repeated.inserted, 0);
    assert.equal(repeated.updated, 0);
    assert.equal(repeated.unchanged, 153);
    assert.equal(await Lohnart.countDocuments(), 153);
    const after = await Lohnart.findById(before._id).lean();
    assert.deepEqual(after, before);
    assert.equal(after.sourceHistory.length, 0);
  });

  it('preserves omitted settings and absent wage types while clearing an explicitly delivered blank', async () => {
    await service.importWorkbook(sourceWorkbook, sourceOptions);
    const before = await Lohnart.findOne({ lohnartNummer: '110' }).lean();
    const untouched = await Lohnart.findOne({ lohnartNummer: '100' }).lean();
    const partial = workbook([['LOHNARTNR', 'LOHNARTTXT'], [110, '']]);
    const details = await service.importWorkbook(partial, { filename: 'Teilimport.xlsx' });
    assert.equal(details.updated, 1);
    assert.equal(await Lohnart.countDocuments(), 153);
    const after = await Lohnart.findById(before._id).lean();
    assert.equal(after.lohnartBezeichnung, '');
    assert.equal(after.verrechnungCode, '3');
    assert.equal(after.verrechnungslohnartNummer, '602');
    assert.equal(after.verrechnungsPrioritaet, '1');
    assert.equal(after.durchschnittsspeicher2Code, before.durchschnittsspeicher2Code);
    assert.equal(after.source.columns.length, 2);
    assert.equal(after.sourceHistory.length, 1);
    assert.deepEqual(after.sourceHistory[0], before.source);
    assert.equal(after.sourceHistory[0].columns.length, 129);
    assert.deepEqual(await Lohnart.findById(untouched._id).lean(), untouched);
    const repeated = await service.importWorkbook(partial, { filename: 'Teilimport.xlsx' });
    assert.equal(repeated.unchanged, 1);
    assert.equal((await Lohnart.findById(before._id).lean()).sourceHistory.length, 1);
  });

  it('rejects the entire workbook before writing when a later row conflicts', async () => {
    await service.importWorkbook(sourceWorkbook, sourceOptions);
    const before = await Lohnart.find({}).sort({ lohnartNummer: 1 }).lean();
    const invalid = workbook([
      ['Lohnart', 'Lohnart-Bezeichnung', 'Code für Berechnung', 'Code für Berechnung'],
      [100, 'Muss unverändert bleiben', 2, 'Stunden * Stundenlohn'],
      [110, 'Konflikt', 2, 'Betrag'],
    ]);
    const response = await upload(admin, invalid);
    assert.equal(response.status, 400);
    assert.ok(response.body.issues.some(issue => issue.code === 'CODE_TEXT_CONFLICT'));
    assert.deepEqual(await Lohnart.find({}).sort({ lohnartNummer: 1 }).lean(), before);
  });

  it('checks the current database role, including revocation despite an ADMIN claim', async () => {
    assert.equal((await upload(null)).status, 401);
    assert.equal((await upload(staff, sourceWorkbook, 'ADMIN')).status, 403);
    await User.collection.updateOne({ _id: admin._id }, { $set: { role: 'USER', roles: ['USER'] } });
    assert.equal((await upload(admin, sourceWorkbook, 'ADMIN')).status, 403);
    assert.equal(await Lohnart.countDocuments(), 0);
  });

  it('allows the existing authenticated read access and resolves 110 to the stable 602 record', async () => {
    await service.importWorkbook(sourceWorkbook, sourceOptions);
    assert.equal((await get('lohnarten', null)).status, 401);
    const list = await get('lohnarten');
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 153);
    const utz = list.body.data.find(row => row.lohnartNummer === '110');
    const target = list.body.data.find(row => row.lohnartNummer === '602');
    assert.equal(utz.codeMetadaten.verrechnungCode.status, 'known');
    assert.equal(utz.codeMetadaten.verrechnungCode.label, 'ÜTZ');
    assert.equal(utz.codeMetadaten.fakturierungCode.code, '3');
    assert.equal(utz.berechnungsart.code, '2');
    assert.ok(!('source' in utz));
    assert.ok(!('sourceHistory' in utz));
    const detail = await get(`lohnarten/${utz._id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.source.columns.length, 129);
    assert.equal(detail.body.data.verrechnungsbezug.status, 'matched');
    assert.equal(detail.body.data.verrechnungsbezug.targetNumber, '602');
    assert.equal(detail.body.data.verrechnungsbezug.priority, '1');
    assert.equal(detail.body.data.verrechnungsbezug.target._id, target._id);
    const byNumber = await get('lohnarten/nummer/110');
    assert.equal(byNumber.status, 200);
    assert.deepEqual(byNumber.body.data, detail.body.data);
    assert.equal((await get('lohnarten/nummer/110', null)).status, 401);
    assert.equal((await get('lohnarten/nummer/invalid')).status, 400);
    assert.equal((await get('lohnarten/nummer/999999')).status, 404);
    assert.equal((await get('lohnarten/invalid')).status, 400);
    assert.equal((await get(`lohnarten/${new mongoose.Types.ObjectId()}`)).status, 404);
  });

  it('returns each customer condition with independent wage/billing use and the original rule', async () => {
    await service.importWorkbook(workbook([['Lohnart', 'Lohnart-Bezeichnung'], [170, 'Nachtzuschlag']]), { filename: 'Klein.xlsx' });
    const wage = await Lohnart.findOne({ lohnartNummer: '170' });
    const active = { _id: new mongoose.Types.ObjectId(), kundenNr: 2100030, kundName: 'Aktiver Testkunde', kundStatus: 2 };
    const inactive = { _id: new mongoose.Types.ObjectId(), kundenNr: 2100031, kundName: 'Inaktiver Testkunde', kundStatus: 3 };
    await Kunde.collection.insertMany([active, inactive]);
    for (const [index, usage] of ['F', 'L', 'X'].entries()) {
      await KundenKondition.create({ kunde: active._id, kundenNrSnapshot: active.kundenNr, lohnart: wage._id, lohnartNummer: '170',
        tabellenNr: '1', laufendeNummer: String(index + 1), sourceKey: `test-condition-${index}`,
        regelArt: 'uhrzeit', jeEinheit: 'tag', abWert: '23', bisWert: '6', preisNr: '1',
        tage: { montag: true, samstag: true }, zuschlagsProzent: 25, verwendung: usage, zvooveKonditionsId: '672571',
      });
    }
    await KundenKondition.create({ kunde: inactive._id, kundenNrSnapshot: inactive.kundenNr, lohnart: wage._id, lohnartNummer: '170', tabellenNr: '1', laufendeNummer: '4', sourceKey: 'test-inactive', verwendung: 'L' });
    const detail = await get(`lohnarten/${wage._id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.kunden.length, 1);
    assert.equal(detail.body.data.kundenkonditionen.length, 3);
    const byUsage = new Map(detail.body.data.kundenkonditionen.map(row => [row.verwendung, row]));
    assert.equal(byUsage.get('F').verwendungMetadaten.label, 'Faktur');
    assert.equal(byUsage.get('L').verwendungMetadaten.label, 'Lohn');
    assert.equal(byUsage.get('X').verwendungMetadaten, null);
    assert.equal(byUsage.get('F').abWert, '23');
    assert.equal(byUsage.get('F').bisWert, '6');
    assert.equal(byUsage.get('F').tage.samstag, true);
    assert.equal(byUsage.get('F').zuschlagsProzent, 25);
    assert.equal(byUsage.get('F').preisNr, '1');
    assert.equal(byUsage.get('F').zvooveKonditionsId, '672571');
    assert.deepEqual((await get('lohnarten/nummer/170')).body.data, detail.body.data);
  });

  it('keeps a missing offset target as a warning without adding calculated wage positions', async () => {
    const details = await service.importWorkbook(workbook([
      ['Lohnart', 'Verrechnung', 'Verrechnung', 'Verrechnungslohnart', 'Priorität Verrechnung'],
      [110, 3, 'ÜTZ', 602, 1],
    ]), sourceOptions);
    assert.ok(details.issues.some(issue => issue.code === 'OFFSET_TARGET_MISSING'));
    assert.equal(await Lohnart.countDocuments(), 1);
    const row = await Lohnart.findOne({ lohnartNummer: '110' });
    const detail = await service.detail(row._id);
    assert.equal(detail.verrechnungsbezug.status, 'missing');
    assert.equal(detail.verrechnungsbezug.target, null);
    assert.equal(detail.verrechnungsbezug.targetNumber, '602');
    assert.ok(detail.issues.some(issue => issue.code === 'OFFSET_TARGET_MISSING'));
    assert.ok(!('lohnpositionen' in detail));
  });

  it('stores and returns independent hour flags without deriving BG2 from the export value', async () => {
    await service.importWorkbook(workbook([
      ['Lohnart', 'Für Gesamtstunden', 'In Auswertungen berücksichtigen', 'Lohnart auswerten', 'IBGSPALTESTD_SUB'],
      [100, 'Ja', 'Nein', 'Ja', 0],
    ]), sourceOptions);
    const row = await Lohnart.findOne({ lohnartNummer: '100' });
    const detail = await service.detail(row._id);
    assert.equal(detail.fuerGesamtstunden, 'Ja');
    assert.equal(detail.inAuswertungenBeruecksichtigen, 'Nein');
    assert.equal(detail.lohnartAuswerten, 'Ja');
    assert.equal(detail.source.columns[4].value, 0);
    assert.ok(!Object.keys(detail).some(key => /bg2/i.test(key)));
  });
});
