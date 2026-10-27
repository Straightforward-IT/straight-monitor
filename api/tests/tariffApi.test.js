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

// Exact output contract of the filtered Zvoove 709 query (no status column).
function personnel709Workbook(rows) {
  const columns = ['ID', 'IPERSONALNR', 'ID_LCS_TARIF', 'ID_LCS_TARIFMAGRUPPE', 'ID_LCS_TARIFGRUPPEN', 'ID_LCS_TARIFSTUFEN', 'DTVON', 'DTBIS'];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    columns, ...rows.map(row => columns.map(column => row[column] ?? null)),
  ]), 'Tabelle1');
  return { fieldname: 'employeeAssignments', originalname: '709.xlsx', buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) };
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
  for (const mode of ['709', '709+710', 'vollständig']) {
    it(`erhält ausgelassene inaktive Mitarbeiter und alte Historie beim gefilterten Acht-Spalten-709-Import (${mode})`, async () => {
      // The SQL status filter is upstream. A delivered applicant must still be
      // matched even if the local employee record is not marked active.
      const applicant = { _id: oid(), personalnr: '1001990', vorname: 'Bewerber', nachname: 'Test', isActive: false };
      await Mitarbeiter.collection.insertOne(applicant);
      await Mitarbeiter.collection.updateOne({ _id: second._id }, { $set: { isActive: false } });
      const original = {
        ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015,
        ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2017-11-12', DTBIS: null,
      };
      const inactive = { ...original, ID: 502, IPERSONALNR: 1001507, DTVON: '2022-01-01', CUSTOM_FLAG: 'inactive-original' };
      const old = { ...original, ID: 503, DTVON: '2016-01-01', DTBIS: '2017-11-11', CUSTOM_FLAG: 'closed-before-2026' };
      const candidate = { ...original, ID: 504, IPERSONALNR: 1001990, DTVON: '2025-07-01' };
      const initial = await preview({ employeeAssignments: [original, inactive, old, candidate] });
      assert.equal(initial.body.status, 'READY');
      assert.equal((await activate(initial.body)).status, 200);
      const beforeInactive = (await request(`/employee-history?key=${second._id}`)).body.assignments[0];
      const beforeOld = (await request(`/employee-history?key=${first._id}`)).body.assignments.find(row => row.legacyId === '503');

      // Older DTVON with an open DTBIS is included by the new SQL query.
      const selected = [{ ...original, ID_LCS_TARIFGRUPPEN: 24932 }, candidate];
      const upload = personnel709Workbook(selected);
      let files = [upload];
      if (mode !== '709') files = workbooks({ employeeAssignments: selected })
        .filter(file => mode === 'vollständig' || ['employeeAssignments', 'aboveTariff'].includes(file.fieldname))
        .map(file => file.fieldname === 'employeeAssignments' ? upload : file);
      const next = await request('/imports/preview', { method: 'POST', files });
      assert.equal(next.body.status, 'READY'); assert.equal(next.body.errorCount, 0);
      assert.deepEqual({ received: next.body.assignmentHistory.received, retained: next.body.assignmentHistory.retained,
        updated: next.body.assignmentHistory.updated, added: next.body.assignmentHistory.added },
      { received: 2, retained: 2, updated: 2, added: 0 });
      assert.equal(next.body.counts.employeeAssignments, 4);
      assert.equal(next.body.changes.employeeAssignments.removed, 0);
      assert.equal((await activate(next.body, initial.body._id)).status, 200);

      const afterInactive = (await request(`/employee-history?key=${second._id}`)).body.assignments;
      assert.equal(afterInactive.length, 1);
      for (const key of ['legacyId', 'validFrom', 'validUntil', 'employeeGroupId', 'payGroupId', 'stageId', 'source']) {
        assert.deepEqual(afterInactive[0][key], beforeInactive[key]);
      }
      const after = (await request(`/employee-history?key=${first._id}`)).body.assignments;
      assert.deepEqual(after.find(row => row.legacyId === '503').source, beforeOld.source);
      const changed = after.find(row => row.legacyId === '501');
      assert.equal(Object.keys(changed.source.raw).length, 8);
      assert.equal(changed.source.filename, '709.xlsx');
      assert.equal(changed.validFrom, '2017-11-12'); assert.equal(changed.validUntil, null);
      assert.equal((await request(`/employees/${first._id}/base-rate?date=2026-10-26`)).body.value, '16.08');
      assert.equal((await request(`/employees/${second._id}/base-rate?date=2026-10-26`)).body.value, '15.33');
      const applicantHistory = (await request(`/employee-history?key=${applicant._id}`)).body.assignments;
      assert.equal(applicantHistory.length, 1); assert.equal(applicantHistory[0].matchStatus, 'MATCHED');
      assert.equal((await request(`/employees/${applicant._id}/base-rate?date=2026-10-26`)).body.value, '15.33');

      const repeated = await request('/imports/preview', { method: 'POST', files });
      assert.equal(repeated.body.errorCount, 0);
      assert.equal(repeated.body.counts.employeeAssignments, 4);
      assert.equal(repeated.body.assignmentHistory.added, 0);
      assert.deepEqual(repeated.body.changes.employeeAssignments, { added: 0, changed: 0, removed: 0, unchanged: 4 });
      assert.equal(await models.Assignment.countDocuments({ importId: initial.body._id }), 4);
      assert.equal((await models.Assignment.findOne({ importId: initial.body._id, legacyId: '501' }).lean()).payGroupId, '21016');
      assert.equal((await Mitarbeiter.collection.findOne({ _id: second._id })).isActive, false);
    });
  }

  it('erhält alle Tarifzuordnungen bei einer gefilterten 709-Datei ohne Treffer mit den acht Spaltenüberschriften', async () => {
    const initial = await preview(); assert.equal((await activate(initial.body)).status, 200);
    const next = await request('/imports/preview', { method: 'POST', files: [personnel709Workbook([])] });
    assert.equal(next.body.errorCount, 0);
    assert.equal(next.body.counts.employeeAssignments, 2);
    assert.equal(next.body.assignmentHistory.received, 0);
    assert.equal(next.body.assignmentHistory.retained, 2);
    assert.equal(next.body.changes.employeeAssignments.removed, 0);
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    assert.equal((await request(`/employee-history?key=${second._id}`)).body.assignments.length, 1);
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
  it('aktiviert und reimportiert elf gültige/unwirksame ÜTZ-Paare ohne die ursprünglichen elf Schlüsselkonflikte', async () => {
    const allowances = Array.from({ length: 11 }, (_, index) => {
      const from = `2026-${String(index + 1).padStart(2, '0')}-01`;
      const until = new Date(Date.UTC(2026, index + 1, 0)).toISOString().slice(0, 10);
      const ineffectiveUntil = new Date(Date.UTC(2026, index, 0)).toISOString().slice(0, 10);
      return [
        { ID: 1000 + index * 2, IPERSONALNR: 1000001, DTVON: from, DTBIS: until, DPREIS: '2.4', CUSTOM_FLAG: `valid-${index}` },
        { ID: 1001 + index * 2, IPERSONALNR: 1000001, DTVON: from, DTBIS: ineffectiveUntil, DPREIS: '9.99', CUSTOM_FLAG: `ineffective-${index}` },
      ];
    }).flat();
    const initial = await preview({ aboveTariff: allowances });
    assert.equal(initial.body.status, 'READY'); assert.equal(initial.body.errorCount, 0);
    assert.equal(initial.body.counts.aboveTariff, 22);
    assert.ok(!initial.body.issues.some(issue => issue.code === 'DUPLICATE_ALLOWANCE_KEY'));
    assert.equal((await activate(initial.body)).status, 200);
    assert.equal(await models.Allowance.countDocuments({ importId: initial.body._id, intervalStatus: 'INEFFECTIVE' }), 11);
    const resolved = (await request(`/employees/${first._id}/wage-info?date=2026-10-15`)).body.aboveTariff;
    assert.equal(resolved.status, 'RESOLVED'); assert.equal(resolved.values.DPREIS, '2.4');
    const repeated = await preview({ aboveTariff: [...allowances].reverse() });
    assert.equal(repeated.body.duplicate, true); assert.equal(repeated.body._id, initial.body._id);
    assert.deepEqual(repeated.body.changes.aboveTariff, { added: 0, changed: 0, removed: 0, unchanged: 22 });
    const partial = await partialPreview('aboveTariff', { aboveTariff: [...allowances].reverse() });
    assert.equal(partial.body.status, 'READY'); assert.equal(partial.body.counts.aboveTariff, 22);
    assert.deepEqual(partial.body.allowanceHistory, { ...partial.body.allowanceHistory, mode: 'MERGE', received: 22, retained: 0, updated: 22, added: 0 });
    assert.equal((await activate(partial.body, initial.body._id)).status, 200);
    assert.equal((await partialPreview('aboveTariff', { aboveTariff: allowances })).body.duplicate, true);
    assert.equal(await models.Allowance.countDocuments({ importId: initial.body._id }), 22);
  });
  it('aktualisiert 709 und 710 gemeinsam mit neuen IDs und erhält ausgelassene unwirksame, ältere und fremde Mitarbeiterzeilen', async () => {
    const assignment = { ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2026-01-01', DTBIS: null };
    const allowance = { ID: 601, IPERSONALNR: 1000001, DTVON: '2026-01-01', DTBIS: null, DPREIS: '2.4' };
    const assignments = [
      assignment,
      { ...assignment, ID: 502, DTBIS: '2025-12-31', CUSTOM_FLAG: 'ineffective-original' },
      { ...assignment, ID: 503, DTVON: '2025-01-01', DTBIS: '2025-12-31', CUSTOM_FLAG: 'pre-2026' },
      { ...assignment, ID: 504, IPERSONALNR: 1001507 },
    ];
    const allowances = [
      allowance,
      { ...allowance, ID: 602, DTBIS: '2025-12-31', DPREIS: '9', CUSTOM_FLAG: 'ineffective-original' },
      { ...allowance, ID: 603, DTVON: '2025-01-01', DTBIS: '2025-12-31', CUSTOM_FLAG: 'pre-2026' },
      { ...allowance, ID: 604, IPERSONALNR: 1001507 },
    ];
    const initial = await preview({ employeeAssignments: assignments, aboveTariff: allowances });
    assert.equal(initial.body.status, 'READY'); assert.equal((await activate(initial.body)).status, 200);
    const before = (await request(`/employee-history?key=${first._id}`)).body;
    const upload = {
      employeeAssignments: [{ ...assignment, ID: 505, IPERSONALNR: '01000001', DTVON: '01.01.2026', ID_LCS_TARIFGRUPPEN: 24932 }],
      aboveTariff: [{ ...allowance, ID: 605, IPERSONALNR: '01000001', DTVON: '01.01.2026', DPREIS: '3.25' }],
    };
    const next = await request('/imports/preview', { method: 'POST', files: workbooks(upload).filter(file => ['employeeAssignments', 'aboveTariff'].includes(file.fieldname)) });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.errorCount, 0);
    for (const [table, history] of [['employeeAssignments', 'assignmentHistory'], ['aboveTariff', 'allowanceHistory']]) {
      assert.equal(next.body.counts[table], 4);
      assert.equal(next.body[history].received, 1); assert.equal(next.body[history].retained, 3);
      assert.equal(next.body[history].updated, 1); assert.equal(next.body[history].added, 0);
      assert.deepEqual(next.body.changes[table], { added: 0, changed: 1, removed: 0, unchanged: 3 });
    }
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const wage = (await request(`/employees/${first._id}/wage-info?date=2026-10-15`)).body;
    assert.equal(wage.baseRate.value, '16.08'); assert.equal(wage.aboveTariff.values.DPREIS, '3.25');
    const after = (await request(`/employee-history?key=${first._id}`)).body;
    for (const table of ['assignments', 'allowances']) {
      for (const marker of ['ineffective-original', 'pre-2026']) {
        assert.deepEqual(after[table].find(row => row.source.raw.CUSTOM_FLAG === marker).source, before[table].find(row => row.source.raw.CUSTOM_FLAG === marker).source);
      }
    }
    assert.equal((await request(`/employee-history?key=${second._id}`)).body.allowances.length, 1);
    assert.equal((await request(`/employee-history?key=${second._id}`)).body.assignments.length, 1);
    const fullAgain = await preview(upload);
    assert.equal(fullAgain.body.status, 'READY'); assert.equal(fullAgain.body.counts.aboveTariff, 4); assert.equal(fullAgain.body.counts.employeeAssignments, 4);
    assert.equal(fullAgain.body.changes.aboveTariff.removed, 0); assert.equal(fullAgain.body.changes.employeeAssignments.removed, 0);
    assert.equal(await models.Allowance.countDocuments({ importId: initial.body._id }), 4);
    assert.equal(await models.Assignment.countDocuments({ importId: initial.body._id }), 4);
  });
  it('erhält mehrfache identische unwirksame ÜTZ-Zeilen ohne Quell-ID bei wiederholten und umgeordneten Teilimporten', async () => {
    const active = { ID: 601, IPERSONALNR: 1000001, DTVON: '2026-01-01', DTBIS: null, DPREIS: '2.4' };
    const historical = { IPERSONALNR: 1000001, DTVON: '2026-01-01', DTBIS: '2025-12-31', DPREIS: '9', CUSTOM_FLAG: 'no-id-history' };
    const initial = await preview({ aboveTariff: [historical, active, { ...historical }] });
    assert.equal(initial.body.status, 'READY'); assert.equal(initial.body.counts.aboveTariff, 3);
    assert.equal((await activate(initial.body)).status, 200);
    const next = await partialPreview('aboveTariff', { aboveTariff: [active, historical, { ...historical }] });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.counts.aboveTariff, 3); assert.equal(next.body.allowanceHistory.added, 0);
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const repeated = await partialPreview('aboveTariff', { aboveTariff: [historical, { ...historical }, active] });
    assert.equal(repeated.body.duplicate, true); assert.equal(repeated.body._id, next.body._id);
    assert.equal(await models.Allowance.countDocuments({ importId: next.body._id, intervalStatus: 'INEFFECTIVE' }), 2);
    const omittedOne = await partialPreview('aboveTariff', { aboveTariff: [historical] });
    assert.equal(omittedOne.body.status, 'READY'); assert.equal(omittedOne.body.counts.aboveTariff, 3);
    assert.equal(omittedOne.body.allowanceHistory.received, 1); assert.equal(omittedOne.body.allowanceHistory.retained, 2);
    assert.equal((await request(`/employees/${first._id}/wage-info?date=2026-10-15`)).body.aboveTariff.values.DPREIS, '2.4');
  });
  it('erhält eine bekannte unwirksame ÜTZ-Quell-ID bei einem identischen Export ohne ID und importiert die bekannte ID danach ohne Doppelung', async () => {
    const original = { ID: 601, IPERSONALNR: 1000001, DTVON: '2026-01-01', DTBIS: '2025-12-31', DPREIS: '2.4', CUSTOM_FLAG: 'known-history' };
    const initial = await preview({ aboveTariff: [original] });
    assert.equal(initial.body.status, 'READY'); await activate(initial.body);
    const before = service.serialize(await models.Allowance.findOne({ importId: initial.body._id }).lean());
    const { ID, ...unidentified } = original;
    const next = await partialPreview('aboveTariff', { aboveTariff: [unidentified] });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.counts.aboveTariff, 1);
    assert.equal(next.body.allowanceHistory.added, 0);
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const stored = service.serialize(await models.Allowance.findOne({ importId: next.body._id }).lean());
    assert.equal(stored.legacyId, '601'); assert.deepEqual(stored.source, before.source);
    const repeated = await partialPreview('aboveTariff', { aboveTariff: [original] });
    assert.equal(repeated.body.status, 'ACTIVE'); assert.equal(repeated.body.counts.aboveTariff, 1);
    assert.equal(repeated.body.allowanceHistory.added, 0); assert.equal(repeated.body.duplicate, true);
    assert.equal(repeated.body._id, next.body._id);
    assert.equal(await models.Allowance.countDocuments({ importId: next.body._id }), 1);
    assert.equal((await models.Allowance.findOne({ importId: next.body._id }).lean()).source.raw.ID, 601);
  });
  it('verarbeitet 710 für einen in der gelieferten 709 ausgelassenen Mitarbeiter bei kombinierten und vollständigen Importen', async () => {
    const initial = await preview(); await activate(initial.body);
    const retained = service.serialize(await models.Assignment.findOne({ importId: initial.body._id, employeeId: first._id }).lean());
    let active = initial.body._id;
    for (const [index, full] of [false, true].entries()) {
      const upload = {
        employeeAssignments: [{ ID: 502, IPERSONALNR: 1001507, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 24932, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2022-01-01', DTBIS: null }],
        aboveTariff: [{ ID: 601, IPERSONALNR: 1000001, DTVON: '2022-04-01', DTBIS: null, DPREIS: String(3 + index) }],
      };
      const files = workbooks(upload).filter(file => full || ['employeeAssignments', 'aboveTariff'].includes(file.fieldname));
      const result = await request('/imports/preview', { method: 'POST', files });
      assert.equal(result.body.status, 'READY'); assert.equal(result.body.counts.employeeAssignments, 2);
      assert.equal(result.body.counts.aboveTariff, 1); assert.equal(result.body.allowanceHistory.received, 1);
      assert.equal(result.body.allowanceHistory.updated, 1); assert.equal(result.body.allowanceHistory.added, 0);
      assert.equal((await activate(result.body, active)).status, 200); active = result.body._id;
      const wage = (await request(`/employees/${first._id}/wage-info?date=2026-10-15`)).body;
      assert.equal(wage.baseRate.status, 'RESOLVED'); assert.equal(wage.aboveTariff.values.DPREIS, String(3 + index));
      const kept = service.serialize(await models.Assignment.findOne({ importId: active, employeeId: first._id }).lean());
      assert.deepEqual(kept.source, retained.source);
    }
  });
  it('blockiert eine mehrdeutige Tarif-Personal-Korrektur mit neuer ID und lässt den aktiven Stand unverändert', async () => {
    const original = { ID: 501, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '2026-01-01', DTBIS: null };
    const assignments = [original, { ...original, ID: 502, ID_LCS_TARIFGRUPPEN: 24932 }];
    const initial = await preview({ employeeAssignments: assignments });
    assert.equal(initial.body.status, 'READY'); await activate(initial.body);
    const invalid = await partialPreview('employeeAssignments', { employeeAssignments: [{ ...original, ID: 503, CUSTOM_FLAG: 'which-row' }] });
    assert.equal(invalid.body.status, 'INVALID');
    assert.ok(invalid.body.issues.some(issue => issue.severity === 'ERROR' && issue.code === 'AMBIGUOUS_ASSIGNMENT_UPDATE'));
    assert.equal((await activate(invalid.body, initial.body._id)).status, 409);
    assert.equal((await request('/catalog')).body.activeImportId, initial.body._id);
    assert.equal((await preview({ employeeAssignments: [...assignments].reverse() })).body.duplicate, true);
  });
  it('korrigiert eine explizit identifizierte unwirksame ÜTZ-Zeile zu gültig und erhält die andere unwirksame Quellzeile', async () => {
    const original = { ID: 601, IPERSONALNR: 1000001, DTVON: '2026-01-01', DTBIS: '2025-12-31', DPREIS: '2.4' };
    const historical = { ...original, ID: 602, DTBIS: '2025-12-30', CUSTOM_FLAG: 'separate-history' };
    const initial = await preview({ aboveTariff: [original, historical] });
    assert.equal(initial.body.status, 'READY'); await activate(initial.body);
    const next = await partialPreview('aboveTariff', { aboveTariff: [{ ...original, DTBIS: null, DPREIS: '3' }] });
    assert.equal(next.body.status, 'READY'); assert.equal(next.body.counts.aboveTariff, 2);
    assert.equal(next.body.allowanceHistory.retained, 1); assert.equal(next.body.allowanceHistory.updated, 1);
    assert.equal((await activate(next.body, initial.body._id)).status, 200);
    const rows = (await request(`/employee-history?key=${first._id}`)).body.allowances;
    assert.equal(rows.find(row => row.legacyId === '601').intervalStatus, 'VALID');
    assert.equal(rows.find(row => row.legacyId === '602').intervalStatus, 'INEFFECTIVE');
    assert.equal(rows.find(row => row.legacyId === '602').source.raw.CUSTOM_FLAG, 'separate-history');
    assert.equal((await request(`/employees/${first._id}/wage-info?date=2026-10-15`)).body.aboveTariff.values.DPREIS, '3');
    assert.equal((await models.Allowance.findOne({ importId: initial.body._id, legacyId: '601' }).lean()).intervalStatus, 'INEFFECTIVE');
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
    await Mitarbeiter.collection.updateOne({ _id: first._id }, { $set: {
      lohnStammdaten: [
        { month: '2026-08', arbeitszeit: { woche: 20 }, steuer: { klasse: 1 } },
        { month: '2026-09', arbeitszeit: { woche: 35.5 }, steuer: { klasse: 4 } },
      ],
    } });
    const result = await preview(); await activate(result.body);
    const url = `/employees/${first._id}/wage-info?date=2026-09-30`;
    const info = await request(url);
    assert.equal(info.status, 200); assert.equal(info.body.activeImportId, result.body._id);
    assert.deepEqual(info.body.payrollMasterData, { month: '2026-09', weeklyHours: 35.5, taxClass: 4, taxFactor: null, personGroup: null });
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
    const august = (await request(`/employees/${first._id}/wage-info?date=2026-08-31`)).body;
    assert.deepEqual(august.payrollMasterData, { month: '2026-08', weeklyHours: 20, taxClass: 1, taxFactor: null, personGroup: null });
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
