const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { MongoMemoryServer } = require('mongodb-memory-server');
const models = require('../models/Tariffs/TariffData');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Location = require('../models/System/Location');
const User = require('../models/System/User');
const { TABLES } = require('../services/tariffs/tariffDomain');
const service = require('../services/tariffs/TariffService');
const oid = () => new mongoose.Types.ObjectId();

function workbooks(overrides = {}) {
  const tables = {
    contract: [{ ID: 17055, CBEZEICHNUNG: 'IGZ ./. DGB' }],
    employeeGroups: [{ ID: 21015, ID_LCS_TARIF: 17055, CGRUPPE: 'Lohn Ost KZF' }],
    payGroups: [{ ID: 21016, ID_LCS_TARIFMAGRUPPE: 21015, INR: 1, CBEZEICHNUNG: 'EG 1' }, { ID: 24932, ID_LCS_TARIFMAGRUPPE: 21015, INR: 3, CBEZEICHNUNG: 'EG 2b', INSERT_BY_DUPLICATE: 1 }],
    stages: [{ ID: 21025, ID_LCS_TARIFMAGRUPPE: 21015, INR: 1, CBEZEICHNUNG: 'Eingangsstufe' }],
    periods: [{ ID: 1107092, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '2026-01-01', DTBIS: '2026-08-31' }, { ID: 1108622, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '2026-09-01', DTBIS: null }],
    rates: [{ ID: 701, ID_LCS_TARIFZEIT: 1107092, IX: 1, IY: 1, DWERT: '14,00' }, { ID: 702, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '15,33' }, { ID: 703, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 3, DWERT: '16,08' }],
    wageRules: [{ ID: 801, ID_LCS_TARIFZEIT: 1108622, ILOHNARTNR: 166, DAB: 23, DBIS: 24, DPROZENT: 25 }, { ID: 802, ID_LCS_TARIFZEIT: 1108622, ILOHNARTNR: 166, DAB: 0, DBIS: 6, DPROZENT: 25 }],
    employeeAssignments: [{ ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2017-11-12', DTBIS: null }, { ID: 502, IPERSONALNR: 1001507, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 24932, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2022-01-01', DTBIS: null }],
    aboveTariff: [{ ID: 601, IPERSONALNR: 1000001, DTVON: '2022-04-01', DTBIS: null, DPREIS: '2,40', DPREISPROD: null, DEINSATZZULAGE: null, DPREISGEHALT: null, CUSTOM_FLAG: 'unverändert' }],
    referenceWages: [{ ID: 21026, ID_LCS_TARIFMAGRUPPE: 21015, IGRUPPE: 6, ISTUFE: 2 }],
    ...overrides,
  };
  return TABLES.map(table => {
    const rows = tables[table.key] || [];
    const headers = [...new Set([...table.requiredColumns, ...rows.flatMap(row => Object.keys(row))])];
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows.map(row => headers.map(header => row[header] ?? null))]);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Export');
    return { fieldname: table.key, originalname: table.filename, buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) };
  });
}

describe('Eigenständige Tarif-API', function () {
  this.timeout(120000);
  let mongo, server, base, admin, staff, first, second, originalSecret;
  async function request(path, { user = admin, method = 'GET', body, files } = {}) {
    const headers = user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), role: 'ADMIN' } }, process.env.JWT_SECRET) } : {};
    let payload;
    if (files) {
      payload = new FormData();
      for (const file of files) payload.append(file.fieldname, new Blob([file.buffer]), file.originalname);
    } else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const response = await fetch(`${base}/api/tariffs${path}`, { method, headers, body: payload });
    return { status: response.status, body: await response.json() };
  }
  async function preview(overrides = {}) { return request('/imports/preview', { method: 'POST', files: workbooks(overrides) }); }
  async function partialPreview(role, overrides = {}) { return request('/imports/preview', { method: 'POST', files: workbooks(overrides).filter(file => file.fieldname === role) }); }
  async function activate(record, expectedActiveImportId = null) { return request(`/imports/${record._id}/activate`, { method: 'POST', body: { expectedActiveImportId } }); }
  before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongo.getUri('tariffs_test'));
    await Promise.all(Object.values(models).map(model => model.init()));
    originalSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'tariffs-isolated-test-secret';
    const app = express(); app.use(express.json()); app.use('/api/tariffs', require('../routes/tariffs/tariffRoutes'));
    app.use('/api/personal', require('../routes/employee/employeeContingentRoutes'));
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    await Promise.all([...Object.values(models), Mitarbeiter, Location, User].map(model => model.collection.deleteMany({})));
    admin = { _id: oid(), role: 'ADMIN', roles: [], isConfirmed: true, email: 'tariff-admin@example.test' };
    staff = { _id: oid(), role: 'USER', roles: [], isConfirmed: true, email: 'tariff-user@example.test' };
    first = { _id: oid(), asana_id: 'tariff-first', email: 'tariff-first@example.test', personalnr: '2000001', personalnrHistory: [{ value: '1000001' }], vorname: 'Erster', nachname: 'Test', isActive: true };
    second = { _id: oid(), asana_id: 'tariff-second', email: 'tariff-second@example.test', personalnr: '1001507', vorname: 'Zweiter', nachname: 'Test', isActive: true };
    await User.collection.insertMany([admin, staff]); await Mitarbeiter.collection.insertMany([first, second]);
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (mongo) await mongo.stop();
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  });
  it('schützt jeden Endpunkt mit der aktuellen Adminrolle, unabhängig von JWT-Claims', async () => {
    const endpoints = [['/catalog', 'GET'], ['/employees', 'GET'], ['/employee-history?key=personal:1000001', 'GET'], [`/employees/${first._id}/base-rate?date=2026-09-30`, 'GET'], [`/employees/${first._id}/wage-info?date=2026-10-07`, 'GET'], ['/imports', 'GET'], ['/imports/preview', 'POST'], [`/imports/${oid()}`, 'GET'], [`/imports/${oid()}/activate`, 'POST']];
    for (const [path, method] of endpoints) assert.equal((await request(path, { user: staff, method })).status, 403, path);
    assert.equal((await request('/catalog', { user: null })).status, 401);
    await User.updateOne({ _id: admin._id }, { $set: { role: 'USER', roles: [] } });
    assert.equal((await request('/catalog')).status, 403);
  });
  it('erlaubt Personal-Nutzern Kontingente, aber weiterhin keine Tarifverwaltung', async () => {
    const draft = await preview(); await activate(draft.body);
    const path = `${base}/api/personal/${first._id}/analytics/contingent?year=2026&month=10`;
    const token = jwt.sign({ user: { id: String(staff._id) } }, process.env.JWT_SECRET);
    const response = await fetch(path, { headers: { 'x-auth-token': token } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.group.legacyId, '21015');
    assert.equal(result.type, 'days-hours');
    assert.equal(result.dayLimit, 70);
    assert.equal(result.assignments, undefined);
    await Mitarbeiter.collection.updateOne({ _id: first._id }, { $set: { arbeitsverhaeltnis: { typ: 1 }, arbeitszeit: { monat: 100 } } });
    await models.Assignment.deleteMany({ employeeId: first._id });
    const fallback = await (await fetch(path, { headers: { 'x-auth-token': token } })).json();
    assert.equal(fallback.type, 'hours');
    assert.equal(fallback.selectionBasis, 'EMPLOYMENT_TYPE');
    assert.equal(fallback.monthlyHours, 100);
    assert.equal((await request('/catalog', { user: staff })).status, 403);
    assert.equal((await fetch(path)).status, 401);
    assert.equal((await fetch(path.replace('month=10', 'month=13'), { headers: { 'x-auth-token': token } })).status, 400);
    await User.updateOne({ _id: staff._id }, { $set: { isConfirmed: false } });
    assert.equal((await fetch(path, { headers: { 'x-auth-token': token } })).status, 401);
  });
  it('zeigt ausschließlich aktive Mitarbeiter und filtert fehlende Tarifzuordnungen nach Standort', async () => {
    const hamburg = { _id: oid(), nameFull: 'Hamburg', shortName: 'HH', nameKey: 'hamburg', shortNameKey: 'hh', isActive: true };
    const berlin = { _id: oid(), nameFull: 'Berlin', shortName: 'BE', nameKey: 'berlin', shortNameKey: 'be', isActive: true };
    const withoutTariff = { _id: oid(), asana_id: 'tariff-without', email: 'tariff-without@example.test', personalnr: '1001999', vorname: 'Ohne', nachname: 'Tarif', isActive: true, locationV2: berlin._id };
    const inactive = { _id: oid(), asana_id: 'tariff-inactive', email: 'tariff-inactive@example.test', personalnr: '1001888', vorname: 'Inaktiv', nachname: 'Tarif', isActive: false, locationV2: hamburg._id };
    first.locationV2 = hamburg._id;
    second.locationV2 = berlin._id;
    await Promise.all([
      Location.collection.insertMany([hamburg, berlin]),
      Mitarbeiter.collection.updateOne({ _id: first._id }, { $set: { locationV2: hamburg._id } }),
      Mitarbeiter.collection.updateOne({ _id: second._id }, { $set: { locationV2: berlin._id } }),
      Mitarbeiter.collection.insertMany([withoutTariff, inactive]),
    ]);
    const draft = await preview(); await activate(draft.body);
    const all = (await request('/employees')).body;
    assert.equal(all.total, 3);
    assert.equal(all.locations.length, 2);
    assert.ok(all.data.every(row => row.employeeName !== 'Inaktiv Tarif'));
    const missing = (await request('/employees?tariff=missing')).body;
    assert.deepEqual(missing.data.map(row => row.employeeId), [String(withoutTariff._id)]);
    const berlinRows = (await request(`/employees?locationId=${berlin._id}`)).body;
    assert.deepEqual(berlinRows.data.map(row => row.employeeId).sort(), [String(second._id), String(withoutTariff._id)].sort());
    assert.equal((await request('/employees?pageSize=24')).status, 400);
    assert.equal((await request('/employees?locationId=not-an-id')).status, 400);
    const missingHistory = await request(`/employee-history?key=${withoutTariff._id}`);
    assert.equal(missingHistory.status, 200);
    assert.equal(missingHistory.body.employee.personalNr, withoutTariff.personalnr);
    assert.deepEqual(missingHistory.body.assignments, []);
    const firstHistory = (await request(`/employee-history?key=${first._id}`)).body;
    assert.equal(firstHistory.employee.personalNr, first.personalnr);
    assert.equal(firstHistory.assignments[0].personalNr, '1000001');
    assert.equal(firstHistory.contract.legacyId, '17055');
    assert.equal(firstHistory.groups[0].payGroups[0].name, 'EG 1');
  });
  it('auditiert einen ausdrücklich beauftragten internen CLI-Import ohne einen Benutzer zu fingieren', async () => {
    const actor = { kind: 'CLI', label: 'Testimport', script: 'importTariffs.js' };
    const result = await service.preview(workbooks(), null, actor);
    assert.equal(result.status, 'READY'); assert.equal(result.errorCount, 0);
    let stored = await models.Import.findById(result._id).lean();
    assert.equal(stored.createdBy, null);
    assert.deepEqual(stored.createdActor, { ...actor, userId: null });
    assert.equal(stored.activatedBy, null); assert.equal(stored.activatedActor, null);
    const activated = await service.activate(result._id, null, null, actor);
    assert.equal(activated.activeImportId, String(result._id));
    stored = await models.Import.findById(result._id).lean();
    assert.equal(stored.createdBy, null); assert.equal(stored.activatedBy, null);
    assert.deepEqual(stored.createdActor, { ...actor, userId: null });
    assert.deepEqual(stored.activatedActor, { ...actor, userId: null });
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.value, '15.33');
  });
  it('weist interne Imports ohne Benutzer und ohne ausdrücklich angegebenen CLI-Actor mit 400 zurück', async () => {
    await assert.rejects(() => service.preview(workbooks(), null), error => error.status === 400);
    assert.equal(await models.Import.countDocuments(), 0);
    assert.equal((await request('/catalog')).body.activeImportId, null);
  });
  it('speichert Vorschau getrennt, aktiviert vollständig und löst beide Dokumentfälle exakt auf', async () => {
    const result = await preview(); assert.equal(result.status, 200); assert.equal(result.body.status, 'READY'); assert.equal(result.body.errorCount, 0);
    assert.equal((await request('/catalog')).body.activeImportId, null);
    const activated = await activate(result.body); assert.equal(activated.status, 200);
    const one = (await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body;
    assert.equal(one.status, 'RESOLVED'); assert.equal(one.value, '15.33'); assert.equal(one.payGroup.position, 1);
    assert.equal(one.period.legacyId, '1108622'); assert.equal(one.allowances[0].values.DPREIS, '2.4');
    assert.equal(one.period.wageRules.length, 2); assert.equal(one.assignment.personalNr, '1000001');
    assert.equal((await request(`/employees/${second._id}/base-rate?date=2026-09-30`)).body.value, '16.08');
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-08-31`)).body.value, '14');
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-01`)).body.value, '15.33');
    assert.equal((await request(`/employee-history?key=${first._id}`)).body.allowances[0].source.raw.CUSTOM_FLAG, 'unverändert');
  });
  it('erhält UTF-8-Dateinamen mit zusammengesetzten und zerlegten Umlauten über Multipart und Aktivierung', async () => {
    const filenames = { aboveTariff: 'Tarif U\u0308TZ.xlsx', noticePeriods: 'Tarifk\u00fcndigungsfrist.xlsx' };
    const files = workbooks({ noticePeriods: [{ ID_LCS_TARIF: 17055, IANZAHLANG: 20, ITYPANG: 3, IANZAHLKUEND: 7, ITYPKUEND: 2 }] })
      .map(file => ({ ...file, originalname: filenames[file.fieldname] || file.originalname }));
    const result = await request('/imports/preview', { method: 'POST', files });
    assert.equal(result.status, 200); assert.equal(result.body.status, 'READY'); assert.equal(result.body.errorCount, 0);
    assert.equal((await activate(result.body)).status, 200);
    const storedImport = await models.Import.findById(result.body._id).lean();
    for (const [key, filename] of Object.entries(filenames)) {
      assert.equal(storedImport.files.find(file => file.key === key).filename, filename);
    }
    const storedAllowance = await models.Allowance.findOne({ importId: storedImport._id }).lean();
    assert.equal(storedAllowance.source.filename, filenames.aboveTariff);
    const history = (await request(`/employee-history?key=${first._id}`)).body;
    assert.equal(history.allowances[0].source.filename, filenames.aboveTariff);
    const catalog = (await request('/catalog')).body;
    assert.equal(catalog.contract.noticePeriods[0].source.filename, filenames.noticePeriods);
  });
  it('erhält Dezimalpräzision bei Speicherung und liefert Dezimalstrings', async () => {
    const result = await preview({ rates: [{ ID: 701, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '15.33000000000000000000001' }] });
    assert.equal(result.body.errorCount, 0); assert.equal((await activate(result.body)).status, 200);
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.value, '15.33000000000000000000001');
    await assert.rejects(() => models.Period.updateOne({}, { $set: { validFrom: '2027-01-01' } }), /schreibgeschützt/);
  });
  it('verhindert doppelte Datensätze bei identischen wiederholten Importen', async () => {
    const initial = await preview(); await activate(initial.body);
    const again = await preview(); assert.equal(again.body._id, initial.body._id); assert.equal(again.body.duplicate, true); assert.equal(again.body.active, true);
    assert.equal(await models.Import.countDocuments(), 1); assert.equal(await models.Assignment.countDocuments(), 2);
    assert.equal(again.body.changes.employeeAssignments.unchanged, 2);
  });
  it('weist fehlerhafte Imports zurück und lässt den aktiven Tarifstand unverändert', async () => {
    const initial = await preview(); await activate(initial.body);
    const invalid = await preview({ rates: [{ ID: 701, ID_LCS_TARIFZEIT: 999, IX: 1, IY: 1, DWERT: '15,33' }] });
    assert.equal(invalid.body.status, 'INVALID'); assert.ok(invalid.body.errorCount);
    assert.equal((await activate(invalid.body, initial.body._id)).status, 409);
    assert.equal((await request('/catalog')).body.activeImportId, initial.body._id);
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.value, '15.33');
    const empty = await request('/imports/preview', { method: 'POST', files: [] });
    assert.equal(empty.status, 400); assert.match(empty.body.message, /mindestens eine Tarifdatei/i);
  });
  it('erlaubt Teilimporte und übernimmt alle nicht ausgewählten Tabellen aus dem aktiven Stand', async () => {
    const changed = { ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2017-11-12', DTBIS: null, CUSTOM_FLAG: 'Teilimport' };
    const beforeFirstFullImport = await partialPreview('employeeAssignments', { employeeAssignments: [changed] });
    assert.equal(beforeFirstFullImport.status, 409);
    const initial = await preview(); await activate(initial.body);
    const part = await partialPreview('employeeAssignments', { employeeAssignments: [changed] });
    assert.equal(part.status, 200); assert.equal(part.body.status, 'READY');
    assert.deepEqual(part.body.partialImportRoles, ['employeeAssignments']);
    assert.deepEqual(part.body.files.map(file => file.key), ['employeeAssignments']);
    assert.equal(part.body.counts.rates, 3); assert.equal(part.body.counts.aboveTariff, 1);
    assert.equal(part.body.changes.employeeAssignments.changed, 1);
    assert.equal(part.body.changes.rates.unchanged, 3);
    assert.equal((await activate(part.body, initial.body._id)).status, 200);
    assert.equal((await request('/catalog')).body.periods.length, 2);
    assert.equal((await models.Assignment.findOne({ importId: part.body._id, legacyId: '501' }).lean()).source.raw.CUSTOM_FLAG, 'Teilimport');
  });
  it('blockiert einen Teilimport, wenn sich der aktive Stand seit seiner Vorschau geändert hat', async () => {
    const initial = await preview(); await activate(initial.body);
    const part = await partialPreview('aboveTariff', { aboveTariff: [{ ID: 601, IPERSONALNR: 1000001, DTVON: '2022-04-01', DTBIS: null, DPREIS: '3,00' }] });
    const other = await preview({ rates: [{ ID: 702, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '16,00' }] });
    assert.equal((await activate(other.body, initial.body._id)).status, 200);
    const reopened = (await request(`/imports/${part.body._id}`)).body;
    assert.equal(reopened.requiresNewPreview, true);
    assert.equal((await activate(part.body, other.body._id)).status, 409);
    assert.equal((await request('/catalog')).body.activeImportId, other.body._id);
  });
  it('erhält ÜTZ vor 2026, aktualisiert neue Zeilen und importiert Teilauszüge idempotent', async () => {
    const old = { ID: 601, IPERSONALNR: 1000001, DTVON: '2022-04-01', DTBIS: '2025-12-31', DPREIS: '2,40', CUSTOM_FLAG: 'Historie' };
    const current = { ...old, ID: 602, DTVON: '2026-01-01', DTBIS: null, DPREIS: '2,50', CUSTOM_FLAG: 'Aktuell' };
    const initial = await preview({ aboveTariff: [old, current] }); await activate(initial.body);
    const original = service.serialize(await models.Allowance.findOne({ importId: initial.body._id, legacyId: '601' }).lean());
    const upload = { ...current, DTBIS: '2026-09-30', DPREIS: '3,1234567890123456789', CUSTOM_FLAG: 'Korrektur' };
    const added = { ...current, ID: 603, DTVON: '2026-10-01', DPREIS: '3,50' };
    const next = await preview({ aboveTariff: [upload, added] });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.counts.aboveTariff, 3);
    assert.equal(next.body.files.find(file => file.key === 'aboveTariff').rowCount, 2);
    assert.equal(next.body.allowanceHistory.retained, 1);
    assert.deepEqual(next.body.changes.aboveTariff, { added: 1, changed: 1, removed: 0, unchanged: 1 });
    assert.equal((await request(`/employees/${first._id}/wage-info?date=2026-09-30`)).body.aboveTariff.values.DPREIS, '2.5');
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const history = (await request(`/employee-history?key=${first._id}`)).body.allowances;
    assert.equal(history.length, 3);
    const retained = history.find(row => row.legacyId === '601');
    assert.deepEqual(retained.source, original.source);
    assert.deepEqual(retained.values, original.values);
    assert.equal(retained.validUntil, '2025-12-31');
    assert.equal((await request(`/employees/${first._id}/wage-info?date=2025-12-31`)).body.aboveTariff.values.DPREIS, '2.4');
    assert.equal((await request(`/employees/${first._id}/wage-info?date=2026-09-30`)).body.aboveTariff.values.DPREIS, '3.1234567890123456789');
    const again = await preview({ aboveTariff: [added, upload] });
    assert.equal(again.body._id, next.body._id); assert.equal(again.body.duplicate, true);
    assert.equal(again.body.changes.aboveTariff.unchanged, 3);
    assert.equal(await models.Allowance.countDocuments({ importId: next.body._id }), 3);
    assert.equal(await models.Import.countDocuments(), 2);
    const empty = await preview({ aboveTariff: [] });
    assert.equal(empty.body._id, next.body._id); assert.equal(empty.body.allowanceHistory.retained, 3);
    assert.equal(empty.body.changes.aboveTariff.removed, 0);
  });
  it('erhält Tarif Personal vor 2026, aktualisiert neue Zuordnungen und importiert Teilauszüge idempotent', async () => {
    const base = { IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025 };
    const old = { ...base, ID: 501, DTVON: '2025-01-01', DTBIS: '2025-12-31', CUSTOM_FLAG: 'Historie' };
    const current = { ...base, ID: 503, DTVON: '2026-01-01', DTBIS: null, CUSTOM_FLAG: 'Aktuell' };
    const other = { ...base, ID: 502, IPERSONALNR: 1001507, ID_LCS_TARIFGRUPPEN: 24932, DTVON: '2026-01-01', DTBIS: null };
    const initial = await preview({ employeeAssignments: [old, current, other] }); await activate(initial.body);
    const original = service.serialize(await models.Assignment.findOne({ importId: initial.body._id, legacyId: '501' }).lean());
    const upload = { ...current, DTBIS: '2026-09-30', CUSTOM_FLAG: 'Korrektur' };
    const added = { ...current, ID: 504, DTVON: '2026-10-01', DTBIS: null };
    const next = await preview({ employeeAssignments: [upload, added] });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.counts.employeeAssignments, 4);
    assert.equal(next.body.files.find(file => file.key === 'employeeAssignments').rowCount, 2);
    assert.equal(next.body.assignmentHistory.retained, 2);
    assert.deepEqual(next.body.changes.employeeAssignments, { added: 1, changed: 1, removed: 0, unchanged: 2 });
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const history = (await request(`/employee-history?key=${first._id}`)).body.assignments;
    assert.equal(history.length, 3);
    const retained = history.find(row => row.legacyId === '501');
    assert.deepEqual(retained.source, original.source);
    assert.equal(retained.validUntil, '2025-12-31');
    assert.equal((await request(`/employee-history?key=${second._id}`)).body.assignments.length, 1);
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.value, '15.33');
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-10-08`)).body.value, '15.33');
    const again = await preview({ employeeAssignments: [added, upload] });
    assert.equal(again.body._id, next.body._id); assert.equal(again.body.duplicate, true);
    assert.equal(again.body.changes.employeeAssignments.unchanged, 4);
    const empty = await preview({ employeeAssignments: [] });
    assert.equal(empty.body._id, next.body._id); assert.equal(empty.body.assignmentHistory.retained, 4);
    assert.equal(empty.body.changes.employeeAssignments.removed, 0);
  });
  it('aktualisiert ÜTZ ohne Quell-ID nach Personalnummer und DTVON und erhält ausgelassene Mitarbeiter', async () => {
    const old = { IPERSONALNR: 1000001, DTVON: '2025-01-01', DTBIS: '2025-12-31', DPREIS: '1,20' };
    const current = { ...old, DTVON: '2026-01-01', DTBIS: null, DPREIS: '2,20' };
    const other = { ...old, IPERSONALNR: 1001507 };
    const initial = await preview({ aboveTariff: [old, current, other] }); await activate(initial.body);
    const next = await preview({ aboveTariff: [{ ...current, IPERSONALNR: '01000001', DTVON: '01.01.2026', DPREIS: '2,80' }] });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.counts.aboveTariff, 3);
    assert.equal(next.body.allowanceHistory.updated, 1); assert.equal(next.body.allowanceHistory.retained, 2);
    assert.deepEqual(next.body.changes.aboveTariff, { added: 0, changed: 1, removed: 0, unchanged: 2 });
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    assert.equal((await request(`/employee-history?key=${second._id}`)).body.allowances.length, 1);
    assert.equal((await request(`/employees/${first._id}/wage-info?date=2026-10-08`)).body.aboveTariff.values.DPREIS, '2.8');
    assert.equal((await preview({ aboveTariff: [{ ...current, IPERSONALNR: '01000001', DTVON: '01.01.2026', DPREIS: '2,80' }] })).body.duplicate, true);
  });
  it('behält offene ÜTZ-Enddaten bei und warnt vor Überschneidungen mit übernommenen Zeilen', async () => {
    const initial = await preview(); await activate(initial.body);
    const next = await preview({ aboveTariff: [{ ID: 602, IPERSONALNR: 1000001, DTVON: '2026-01-01', DTBIS: null, DPREIS: '3' }] });
    assert.equal(next.body.counts.aboveTariff, 2);
    assert.ok(next.body.issues.some(issue => issue.code === 'OVERLAPPING_INTERVALS' && issue.table === 'aboveTariff'));
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const result = (await request(`/employees/${first._id}/wage-info?date=2026-10-08`)).body.aboveTariff;
    assert.equal(result.status, 'UNRESOLVED'); assert.equal(result.code, 'ABOVE_TARIFF_AMBIGUOUS');
    assert.equal((await models.Allowance.findOne({ importId: next.body._id, legacyId: '601' }).lean()).validUntil, null);
  });
  it('verhindert das Aktivieren einer veralteten ÜTZ-Vorschau auch nach erneutem Öffnen', async () => {
    const initial = await preview(); await activate(initial.body);
    const changed = { ID: 601, IPERSONALNR: 1000001, DTVON: '2022-04-01', DTBIS: null, DPREIS: '3' };
    const stale = await preview({ aboveTariff: [changed] });
    const other = await preview({ aboveTariff: [{ ...changed, DPREIS: '4' }, { ...changed, ID: 602, DTVON: '2026-01-01' }] });
    assert.equal((await activate(other.body, initial.body._id)).status, 200);
    const reopened = (await request(`/imports/${stale.body._id}`)).body;
    assert.equal(reopened.requiresNewPreview, true);
    assert.equal((await activate(stale.body, other.body._id)).status, 409);
    assert.equal((await request('/catalog')).body.activeImportId, other.body._id);
    const rebuilt = await preview({ aboveTariff: [changed] });
    assert.notEqual(rebuilt.body._id, stale.body._id); assert.equal(rebuilt.body.counts.aboveTariff, 2);
    assert.equal((await activate(rebuilt.body, other.body._id)).status, 200);
  });
  it('verhindert das Aktivieren einer veralteten Tarif-Personal-Vorschau', async () => {
    const initial = await preview(); await activate(initial.body);
    const changed = { ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2017-11-12', DTBIS: null, CUSTOM_FLAG: 'Korrektur' };
    const stale = await preview({ employeeAssignments: [changed] });
    const other = await preview({ employeeAssignments: [{ ...changed, CUSTOM_FLAG: 'Andere Korrektur' }] });
    assert.equal((await activate(other.body, initial.body._id)).status, 200);
    const reopened = (await request(`/imports/${stale.body._id}`)).body;
    assert.equal(reopened.requiresNewPreview, true);
    assert.equal((await activate(stale.body, other.body._id)).status, 409);
    assert.equal((await request('/catalog')).body.activeImportId, other.body._id);
  });
  it('blockiert mehrere ÜTZ-Zeilen desselben Mitarbeiters mit gleichem Beginn, auch bei unterschiedlichen IDs', async () => {
    const row = { IPERSONALNR: 1000001, DTVON: '2026-01-01', DTBIS: null, DPREIS: '2' };
    for (const rows of [[row, { ...row, DPREIS: '3' }], [{ ...row, ID: 601 }, { ...row, ID: 602 }]]) {
      const invalid = await preview({ aboveTariff: rows });
      assert.equal(invalid.body.status, 'INVALID');
      assert.ok(invalid.body.issues.some(issue => issue.code === 'DUPLICATE_ALLOWANCE_KEY'));
      assert.equal((await activate(invalid.body)).status, 409);
      assert.equal((await request('/catalog')).body.activeImportId, null);
    }
  });
  it('aktualisiert ÜTZ bei geänderter Quell-ID nach Personalnummer und Beginn statt eine Doppelung anzulegen', async () => {
    const old = { ID: 601, IPERSONALNR: 1000001, DTVON: '2025-01-01', DTBIS: '2025-12-31', DPREIS: '1' };
    const current = { ...old, ID: 602, DTVON: '2026-09-01', DTBIS: null, DPREIS: '0,22' };
    const initial = await preview({ aboveTariff: [old, current] }); await activate(initial.body);
    const changed = { ...current, ID: 603, DPREIS: '0,25' };
    const next = await partialPreview('aboveTariff', { aboveTariff: [changed] });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.counts.aboveTariff, 2);
    assert.equal(next.body.allowanceHistory.updated, 1); assert.equal(next.body.allowanceHistory.retained, 1);
    assert.deepEqual(next.body.changes.aboveTariff, { added: 0, changed: 1, removed: 0, unchanged: 1 });
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const result = (await request(`/employees/${first._id}/wage-info?date=2026-10-08`)).body.aboveTariff;
    assert.equal(result.status, 'RESOLVED'); assert.equal(result.values.DPREIS, '0.25');
    assert.equal((await models.Allowance.findOne({ importId: next.body._id, validFrom: '2026-09-01' }).lean()).source.raw.ID, 603);
    assert.equal((await partialPreview('aboveTariff', { aboveTariff: [changed] })).body.duplicate, true);
  });
  it('ersetzt beim ÜTZ-Reimport auch bereits vorhandene Doppelungen desselben Beginns und lässt andere Teilimporte unverändert', async () => {
    const current = { ID: 602, IPERSONALNR: 1000001, DTVON: '2026-09-01', DTBIS: null, DPREIS: '0,22' };
    const initial = await preview({ aboveTariff: [current] }); await activate(initial.body);
    // Simulate a previously activated snapshot produced by the old ID merge.
    const original = await models.Allowance.findOne({ importId: initial.body._id }).lean();
    await models.Allowance.collection.insertOne({ ...original, _id: oid(), legacyId: '603', source: { ...original.source, raw: { ...original.source.raw, ID: 603 } } });
    const unrelated = await partialPreview('contract');
    assert.equal(unrelated.body.status, 'READY'); assert.equal(unrelated.body.counts.aboveTariff, 2);
    const corrected = await partialPreview('aboveTariff', { aboveTariff: [{ ...current, ID: 603 }] });
    assert.equal(corrected.body.status, 'READY'); assert.equal(corrected.body.counts.aboveTariff, 1);
    assert.equal((await activate(corrected.body, initial.body._id)).status, 200);
    assert.equal((await request(`/employees/${first._id}/wage-info?date=2026-10-08`)).body.aboveTariff.status, 'RESOLVED');
    assert.equal(await models.Allowance.countDocuments({ importId: initial.body._id }), 2);
    assert.equal((await partialPreview('aboveTariff', { aboveTariff: [{ ...current, ID: 603 }] })).body.duplicate, true);
  });
  it('speichert umgekehrte Mitarbeiter- und ÜTZ-Zeiträume vollständig als unwirksame Historie', async () => {
    const assignments = [{ ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2026-09-01', DTBIS: '2026-08-31' }];
    const allowances = [{ ID: 601, IPERSONALNR: 1000001, DTVON: '2026-09-01', DTBIS: '2026-08-31', DPREIS: '2,40', DPREISPROD: null, DEINSATZZULAGE: null, DPREISGEHALT: null, CUSTOM_FLAG: 'historisch erhalten' }];
    const result = await preview({ employeeAssignments: assignments, aboveTariff: allowances });
    assert.equal(result.status, 200); assert.equal(result.body.status, 'READY'); assert.equal(result.body.errorCount, 0);
    const reversed = result.body.issues.filter(issue => issue.code === 'REVERSED_INTERVAL');
    assert.equal(reversed.length, 2); assert.ok(reversed.every(issue => issue.severity === 'WARNING'));
    assert.ok(!result.body.issues.some(issue => issue.code === 'OVERLAPPING_INTERVALS'));
    assert.equal(result.body.counts.employeeAssignments, 1); assert.equal(result.body.counts.aboveTariff, 1);
    assert.equal((await activate(result.body)).status, 200);
    const storedAssignment = await models.Assignment.findOne({ importId: result.body._id }).lean();
    const storedAllowance = await models.Allowance.findOne({ importId: result.body._id }).lean();
    assert.equal(storedAssignment.intervalStatus, 'INEFFECTIVE'); assert.equal(storedAllowance.intervalStatus, 'INEFFECTIVE');
    assert.equal(storedAssignment.validFrom, '2026-09-01'); assert.equal(storedAssignment.validUntil, '2026-08-31');
    assert.equal(storedAllowance.source.raw.CUSTOM_FLAG, 'historisch erhalten');
    const history = (await request(`/employee-history?key=${first._id}`)).body;
    assert.equal(history.assignments.length, 1); assert.equal(history.allowances.length, 1);
    assert.equal(history.assignments[0].intervalStatus, 'INEFFECTIVE'); assert.equal(history.allowances[0].intervalStatus, 'INEFFECTIVE');
    assert.equal(history.allowances[0].values.DPREIS, '2.4');
    for (const date of ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2099-12-31']) {
      const baseRate = (await request(`/employees/${first._id}/base-rate?date=${date}`)).body;
      assert.equal(baseRate.status, 'UNRESOLVED'); assert.equal(baseRate.code, 'ASSIGNMENT_MISSING');
      assert.deepEqual(baseRate.allowances, []);
    }
    assert.equal((await preview({ employeeAssignments: assignments, aboveTariff: allowances })).body.duplicate, true);
  });
  it('blockiert weiterhin ungültige Kalenderdaten und umgekehrte Tarifperioden', async () => {
    const cases = [
      { employeeAssignments: [{ ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2026-02-30', DTBIS: null }] },
      { aboveTariff: [{ ID: 601, IPERSONALNR: 1000001, DTVON: '2026-09-01', DTBIS: '2026-02-30', DPREIS: '2,40' }] },
      { periods: [{ ID: 1107092, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '2026-01-01', DTBIS: '2026-08-31' }, { ID: 1108622, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '2026-09-01', DTBIS: '2026-08-31' }] },
    ];
    for (const overrides of cases) {
      const result = await preview(overrides);
      assert.equal(result.status, 200); assert.equal(result.body.status, 'INVALID'); assert.ok(result.body.errorCount > 0);
      assert.ok(result.body.issues.some(issue => issue.severity === 'ERROR' && ['INVALID_DATE', 'REVERSED_INTERVAL'].includes(issue.code)));
      assert.equal((await activate(result.body)).status, 409);
      assert.equal((await request('/catalog')).body.activeImportId, null);
    }
  });
  it('behandelt Änderungen unbekannter Quellspalten als neuen Datenstand, auch bei gleichen Metadatennamen', async () => {
    const initial = await preview();
    const changed = await preview({ employeeGroups: [{ ID: 21015, ID_LCS_TARIF: 17055, CGRUPPE: 'Lohn Ost KZF', employeeName: 'Unbekannte Quellkonfiguration', importId: 'Quellwert' }] });
    assert.equal(changed.body.errorCount, 0); assert.equal(changed.body.duplicate, false);
    assert.notEqual(changed.body._id, initial.body._id);
    await activate(changed.body);
    assert.equal((await request('/catalog')).body.groups[0].source.raw.importId, 'Quellwert');
  });
  it('aktiviert konkurrierende Vorschauen ausschließlich mit passendem geprüftem Ausgangsstand', async () => {
    const initial = await preview(); await activate(initial.body);
    const next = await preview({ rates: [{ ID: 702, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '16' }] });
    const other = await preview({ rates: [{ ID: 702, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '17' }] });
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    assert.equal((await activate(other.body, initial.body._id)).status, 409);
    const reviewed = (await request(`/imports/${other.body._id}`)).body;
    assert.equal(reviewed.basedOnImportId, next.body._id); assert.equal(reviewed.changes.rates.changed, 1);
    assert.equal((await activate(other.body, reviewed.basedOnImportId)).status, 200);
    assert.equal((await request('/imports')).body.data.find(item => item._id === initial.body._id).status, 'SUPERSEDED');
    assert.equal(await models.Contract.countDocuments(), 3);
  });
  it('erhält ungeklärte Zuordnungen im Import, zeigt in der Mitarbeiterliste aber nur aktive Mitarbeiter', async () => {
    await Mitarbeiter.collection.deleteOne({ _id: second._id });
    await Mitarbeiter.collection.insertOne({ _id: oid(), asana_id: 'tariff-third', email: 'tariff-third@example.test', personalnr: '001000001', vorname: 'Dritter', nachname: 'Test', isActive: false });
    const result = await preview(); assert.equal(result.body.errorCount, 0); await activate(result.body);
    const list = (await request('/employees')).body;
    assert.equal(list.total, 1);
    assert.equal(list.data[0].employeeId, String(first._id));
    assert.equal(list.data[0].hasTariffAssignment, false);
    const history = (await request('/employee-history?key=personal:1001507')).body;
    assert.equal(history.assignments.length, 1); assert.equal(history.assignments[0].employeeId, null);
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.status, 'UNRESOLVED');
  });
  it('veröffentlicht bei zwei gleichzeitigen Erstaktivierungen genau einen vollständigen Datenstand', async () => {
    const firstDraft = await preview();
    const secondDraft = await preview({ rates: [{ ID: 702, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '17' }] });
    const results = await Promise.all([activate(firstDraft.body), activate(secondDraft.body)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    const active = (await request('/catalog')).body;
    const winningId = results.find(result => result.status === 200).body.activeImportId;
    assert.equal(active.activeImportId, winningId);
    assert.ok(active.groups.every(group => group.importId === winningId));
    assert.ok(active.periods.every(period => period.importId === winningId));
    const value = (await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.value;
    assert.equal(value, winningId === firstDraft.body._id ? '15.33' : '17');
  });
  it('liefert bei überlappenden Perioden einen Klärungshinweis und bei ungültigen Stichtagen 400', async () => {
    const result = await preview({ periods: [{ ID: 1107092, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '2026-01-01', DTBIS: null }, { ID: 1108622, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '2026-09-01', DTBIS: null }] });
    assert.equal(result.body.errorCount, 0); await activate(result.body);
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.code, 'PERIOD_AMBIGUOUS');
    for (const date of ['2026-99-99', '2026-02-30', '0001-01-01', 'not-a-date']) assert.equal((await request(`/employees/${first._id}/base-rate?date=${date}`)).status, 400);
  });
  it('speichert Zuordnungen ohne optionale Quell-ID mit separaten stabilen Import-Schlüsseln', async () => {
    const assignments = [{ IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2017-11-12', DTBIS: null }];
    const result = await preview({ employeeAssignments: assignments });
    assert.equal(result.status, 200); assert.equal(result.body.errorCount, 0); await activate(result.body);
    assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body.value, '15.33');
    assert.equal((await preview({ employeeAssignments: assignments })).body.duplicate, true);
  });
  it('holt nach einem Prozessabbruch eine verwaiste Importvorbereitung zurück', async () => {
    const initial = await preview();
    await models.Import.collection.updateOne({ _id: new mongoose.Types.ObjectId(initial.body._id) }, { $set: { status: 'BUILDING', updatedAt: new Date(Date.now() - 16 * 60 * 1000) } });
    const recovered = await preview(); assert.equal(recovered.status, 200); assert.equal(recovered.body.status, 'READY');
    assert.notEqual(recovered.body._id, initial.body._id); assert.equal(await models.Import.countDocuments(), 1);
    assert.equal(await models.Contract.countDocuments(), 1);
  });
  it('exposes independent date-aware Mitarbeiter methods with exact decimal strings', async () => {
    const result = await preview(); await activate(result.body);
    const employee = await Mitarbeiter.findById(first._id);
    const rate = await employee.getTariffBaseRate('2026-09-30');
    const above = await employee.getAboveTariffValues('2026-09-30');
    assert.equal(rate.value, '15.33'); assert.equal(rate.payGroup.name, 'EG 1');
    assert.equal(rate.assignment.personalNr, '1000001');
    assert.equal(above.status, 'RESOLVED'); assert.equal(above.values.DPREIS, '2.4');
    assert.equal(above.record.source.raw.CUSTOM_FLAG, 'unverändert');
    assert.equal((await employee.getAboveTariffValues()).date, service.currentTariffDate());
    assert.equal((await employee.getTariffBaseRate()).date, service.currentTariffDate());
    await models.Assignment.collection.deleteMany({ employeeId: first._id });
    assert.equal((await employee.getTariffBaseRate('2026-09-30')).code, 'ASSIGNMENT_MISSING');
    assert.equal((await employee.getAboveTariffValues('2026-09-30')).values.DPREIS, '2.4');
    await assert.rejects(() => employee.getAboveTariffValues('2026-02-30'), error => error.status === 400);
    await assert.rejects(() => employee.getTariffBaseRate(null), error => error.status === 400);
  });
  it('resolves current-number tariff and ÜTZ independently of open alias rows without changing import history', async () => {
    const original = (await service.preview(workbooks(), null, { kind: 'CLI', label: 'Alias test', script: 'test' }));
    await service.activate(original._id, null, null, { kind: 'CLI', label: 'Alias test', script: 'test' });
    const oldAssignment = await models.Assignment.findOne({ employeeId: first._id }).lean();
    const oldAllowance = await models.Allowance.findOne({ employeeId: first._id }).lean();
    await models.Assignment.collection.insertOne({ ...oldAssignment, _id: oid(), legacyId: 'current', personalNr: first.personalnr, payGroupId: '24932', validFrom: '2026-09-01' });
    await models.Allowance.collection.insertOne({ ...oldAllowance, _id: oid(), legacyId: 'current', personalNr: first.personalnr, validFrom: '2026-09-01', values: { DPREIS: mongoose.Types.Decimal128.fromString('1.83') } });
    const rate = (await request(`/employees/${first._id}/base-rate?date=2026-09-30`)).body;
    assert.equal(rate.value, '16.08'); assert.equal(rate.assignment.personalNr, first.personalnr);
    assert.equal(rate.allowances.length, 1); assert.equal(rate.allowances[0].values.DPREIS, '1.83');
    const info = (await request(`/employees/${first._id}/wage-info?date=2026-09-30`)).body;
    assert.equal(info.baseRate.value, rate.value); assert.equal(info.aboveTariff.values.DPREIS, '1.83');
    assert.deepEqual(info.baseRate.assignmentSelection.excludedPersonalNumbers, ['1000001']);
    assert.deepEqual(info.aboveTariff.selection.excludedPersonalNumbers, ['1000001']);
    assert.equal((await service.aboveTariffValues(String(first._id), '2026-09-30')).values.DPREIS, '1.83');
    const past = (await request(`/employees/${first._id}/wage-info?date=2026-08-31`)).body;
    assert.equal(past.baseRate.value, '14'); assert.equal(past.baseRate.assignment.personalNr, '1000001');
    assert.equal(past.aboveTariff.values.DPREIS, '2.4');
    const history = (await request(`/employee-history?key=${first._id}`)).body;
    assert.equal(history.assignments.length, 2); assert.equal(history.allowances.length, 2);
    assert.equal(history.assignments.find(row => row.legacyId === oldAssignment.legacyId).validUntil, null);
    assert.equal(history.activeImportId, String(original._id));
  });

  it('returns compact wage info, missing ÜTZ and overlapping ÜTZ without inventing a value', async () => {
    const result = await preview(); await activate(result.body);
    const url = `/employees/${first._id}/wage-info?date=2026-09-30`;
    const info = await request(url);
    assert.equal(info.status, 200); assert.equal(info.body.activeImportId, result.body._id);
    assert.equal(info.body.baseRate.value, '15.33'); assert.equal(info.body.baseRate.payGroup.name, 'EG 1');
    assert.equal(info.body.aboveTariff.values.DPREIS, '2.4');
    assert.equal(info.body.baseRate.period.rates, undefined); assert.equal(info.body.baseRate.group.source, undefined);
    const missing = (await request(`/employees/${second._id}/wage-info?date=2026-09-30`)).body;
    assert.equal(missing.baseRate.value, '16.08'); assert.equal(missing.aboveTariff.code, 'ABOVE_TARIFF_MISSING');
    const row = await models.Allowance.findOne({ employeeId: first._id }).lean();
    await models.Allowance.collection.insertOne({ ...row, _id: oid(), legacyId: 'overlap' });
    const overlap = (await request(url)).body;
    assert.equal(overlap.baseRate.value, '15.33'); assert.equal(overlap.aboveTariff.code, 'ABOVE_TARIFF_AMBIGUOUS');
    assert.equal(overlap.aboveTariff.values, undefined); assert.equal(overlap.aboveTariff.candidateCount, 2);
  });
  it('distinguishes no active data, missing employees and invalid dates in wage info', async () => {
    const info = await request(`/employees/${first._id}/wage-info?date=2026-09-30`);
    assert.equal(info.status, 200); assert.equal(info.body.baseRate.code, 'NO_ACTIVE_IMPORT');
    assert.equal(info.body.aboveTariff.code, 'NO_ACTIVE_IMPORT');
    assert.equal((await request(`/employees/${oid()}/wage-info?date=2026-09-30`)).status, 404);
    for (const date of ['2026-02-30', 'x', '']) assert.equal((await request(`/employees/${first._id}/wage-info?date=${date}`)).status, 400);
    assert.equal((await request('/employees/invalid/wage-info?date=2026-09-30')).status, 400);
  });
  it('keeps base rate and ÜTZ on one import even if activation changes during the read', async () => {
    const initial = await preview(); await activate(initial.body);
    const next = await preview({
      rates: [{ ID: 702, ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '99.99' }],
      aboveTariff: [{ ID: 601, IPERSONALNR: 1000001, DTVON: '2022-04-01', DTBIS: null, DPREIS: '9.99' }],
    });
    assert.equal(next.body.status, 'READY');
    const original = models.Catalog.findById;
    let reads = 0;
    models.Catalog.findById = function (...args) {
      const query = original.apply(this, args);
      return { lean: async () => {
        reads += 1;
        const captured = await query.lean();
        await models.Catalog.collection.updateOne({ _id: '17055' }, { $set: { activeImportId: new mongoose.Types.ObjectId(next.body._id) } });
        return captured;
      } };
    };
    try {
      const info = await service.wageInfo(String(first._id), '2026-09-30');
      assert.equal(reads, 1); assert.equal(info.activeImportId, initial.body._id);
      assert.equal(info.baseRate.value, '15.33'); assert.equal(info.aboveTariff.values.DPREIS, '2.4');
    } finally { models.Catalog.findById = original; }
  });

});
