const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const d = require('../domain/payroll/detailImport');
const engine = require('../domain/payroll/ausweisung');
const models = require('../models/Payroll/Abrechnung');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Auftrag = require('../models/Event/Auftrag');
const Einsatz = require('../models/Event/Einsatz');
const Lohnart = require('../models/Payroll/Lohnart');
const User = require('../models/System/User');
const service = require('../services/payroll/AbrechnungService');
const tariffModels = require('../models/Tariffs/TariffData');
const oid = () => new mongoose.Types.ObjectId();
function file(role, rows, headers = [...new Set(rows.flatMap(Object.keys))], origin = 'A1') {
  const workbook = XLSX.utils.book_new(), sheet = {};
  XLSX.utils.sheet_add_aoa(sheet, [headers, ...rows.map(row => headers.map(header => row[header] ?? null))], { origin });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Tabelle1');
  return { fieldname: role, originalname: `${role}.xlsx`, buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) };
}
const time = (overrides = {}) => ({ ID: 1, PERSONALNR: 2001193, AUFTRAGSNR: 2510476, IDARBEITSSCHICHT: 1100922, EINSORT: 1, DATUM: '2026-10-09', VON: '23:00', BIS: '03:00', STUNDEN: 4, PAUSE: 0, BEZAHLTE_PAUSE: 0, ...overrides });
const draft = (overrides = {}) => ({ ID: 2166547, PERSONALNR: 2001193, IDARBEITSSCHICHT: 1100922, DATUM: '2026-10-09', ISTZEITENVON: '23:00', ISTZEITENBIS: '03:00', ISTUEBETRAGEN: 1, BEARBEITUNGABGESCHLOSSEN: 1, PAUSE: 0, ...overrides });
const rule = (overrides = {}) => ({ ID: 1, AUFTRAGNR: 2510476, PERSONALNR: 0, EINSPERSNR: 0, EINSORTNR: 1, LOHNART: 100, VERWENDUNG: 'F', AB: '00:00', BIS: '24:00', MONTAG: 1, DIENSTAG: 1, MITTWOCH: 1, DONNERSTAG: 1, FREITAG: 1, SAMSTAG: 1, SONNTAG: 1, FEIERTAG: 0, PREIS: '35.00', PROZENT: 0, NICHTAUTOM: 0, ...overrides });
const night = (overrides = {}) => rule({ ID: 2, LOHNART: 166, AB: '23:00', BIS: '06:00', PROZENT: 25, MONTAG: 0, DIENSTAG: 0, MITTWOCH: 0, DONNERSTAG: 0, SONNTAG: 0, ...overrides });
const profile = () => engine.policies({ rounding: 'HALF_UP_PER_POSITION', dayBasis: 'SEGMENT_DATE', supplementBasis: 'RULE_PRICE', overlap: 'STACK', precedence: 'EMPLOYEE_OVER_ORDER' });
function normalized(times, rules = [], drafts = []) {
  const files = [file('STUNDUHR', times), ...(rules.length ? [file('AUFTRLOA', rules)] : []), ...(drafts.length ? [file('STUNDENVORTRAG', drafts)] : [])];
  const parsed = d.readFiles(files, 'INPUT');
  return { bookings: d.normalizeBookings(parsed.rows, 2510476, 'HOURS').map((booking, i) => ({ ...booking, _id: `booking-${i}`, employeeId: booking.personalNr === '2001193' ? 'employee' : `employee:${booking.personalNr}` })), rules: d.normalizeRules(parsed.rows, 2510476).map((value, i) => ({ ...value, _id: `rule-${i}` })),
    wageTypes: [{ lohnartNummer: '100', berechnungsartCode: '2' }, { lohnartNummer: '110', berechnungsartCode: '2' }, { lohnartNummer: '166', berechnungsartCode: '4' }, { lohnartNummer: '146', berechnungsartCode: '4' }], rates: [], side: 'F', policies: profile() };
}

describe('operational time and independent reference domain', () => {
  it('preserves Excel row offsets, original columns, decimal source precision and explicit zero', () => {
    const parsed = d.readFiles([file('STUNDUHR', [time({ STUNDEN: 1.6800000000000002, EXTRA: false })], undefined, 'A5')], 'INPUT');
    assert.equal(parsed.rows[0].source.row, 6); assert.equal(parsed.rows[0].raw.EXTRA, false);
    assert.ok(parsed.rows[0].originalHeaders.includes('EXTRA'));
    const [booking] = d.normalizeBookings(parsed.rows, 2510476, null);
    assert.equal(booking.reportedHours, '1.6800000000000002'); assert.equal(booking.reportedBreak, '0');
    assert.equal(booking.productiveMinutes, 240);
    assert.equal(booking.end, '2026-10-10T01:00:00.000Z');
  });
  it('rejects wrong roles, ambiguous headers and mixed input/reference packages', () => {
    assert.throws(() => d.readFiles([file('RECHNUNGEN', [{ AUFTRAGNR: 1, BETRAG: 1 }])], 'INPUT'), /Unzulässige/);
    assert.throws(() => d.readFiles([file('STUNDUHR', [time()], ['PERSONALNR', 'PERSONALNR'])], 'INPUT'), /eindeutig/);
  });
  it('normalizes fractional Excel times and rejects lossy seconds and invalid dates', () => {
    assert.equal(d.clock(23 / 24), 1380); assert.equal(d.clock('24:00', true), 1440);
    assert.throws(() => d.clock(0.0001), /Sekunden/);
    assert.throws(() => d.date('2026-02-30'), /Kalender/);
    assert.equal(d.date('09.10.2026'), '2026-10-09');
    const rows = d.readFiles([file('AUFTRLOA', [rule({ AB: 0, BIS: 24 }), night({ AB: 23, BIS: 6 })])], 'INPUT').rows;
    assert.equal(d.normalizeRules(rows, 2510476)[1].issues[0].code, 'RULE_UNRESOLVED');
    assert.deepEqual(d.normalizeRules(rows, 2510476, 'DECIMAL_HOURS').map(row => [row.windowStart, row.windowEnd, row.issues.length]), [[0, 1440, 0], [1380, 360, 0]]);
  });
  it('retains and blocks ambiguous DST and missing break location rather than fabricating times', () => {
    const dst = normalized([time({ DATUM: '2026-10-25', VON: '02:30', BIS: '05:00' })]);
    assert.match(dst.bookings[0].issues[0].message, /Zeitumstellung/);
    assert.equal(engine.calculate(dst).status, 'INCOMPLETE');
    const missing = normalized([time({ PAUSE: 0.5 })], [rule(), night()]);
    assert.match(missing.bookings[0].issues[0].message, /Pausenlage/);
    assert.equal(engine.calculate(missing).fakturpositionen.length, 0);
    assert.equal(engine.calculate(missing).totals.amount, null);
  });
  it('requires the source break unit rather than assuming hours or minutes', () => {
    const parsed = d.readFiles([file('STUNDUHR', [time({ PAUSE: 30 })])], 'INPUT');
    assert.match(d.normalizeBookings(parsed.rows, 2510476, null)[0].issues[0].message, /Einheit/);
  });
  it('changes night quantity when the same pause moves across the night boundary', () => {
    const evaluate = pause => engine.calculate(normalized([time({ VON: '21:00', BIS: '01:00', STUNDEN: 3.5, PAUSE: 0.5 })], [rule(), night()], [draft({ ISTZEITENVON: '21:00', ISTZEITENBIS: '01:00', PAUSE: 0.5, PAUSE1VON: pause, PAUSE1BIS: pause === '22:00' ? '22:30' : '23:30', PAUSE1ISTBEZAHLT: 0 })]));
    const before = evaluate('22:00'), within = evaluate('23:00');
    assert.equal(before.status, 'PREVIEW'); assert.equal(within.status, 'PREVIEW');
    assert.equal(before.totals.productiveMinutes, 210); assert.equal(within.totals.productiveMinutes, 210);
    assert.equal(before.fakturpositionen.filter(position => position.wageType === '166').reduce((sum, position) => sum + position.minutes, 0), 120);
    assert.equal(within.fakturpositionen.filter(position => position.wageType === '166').reduce((sum, position) => sum + position.minutes, 0), 90);
  });
  it('blocks inconsistent breaks, overlapping bookings and multiple matching time submissions', () => {
    const inconsistent = normalized([time({ PAUSE: 1 })], [], [draft({ PAUSE: 1, PAUSE1VON: '23:00', PAUSE1BIS: '23:30', PAUSE1ISTBEZAHLT: 0 })]);
    assert.match(inconsistent.bookings[0].issues[0].message, /widersprechen/);
    assert.ok(normalized([time(), time({ ID: 2 })]).bookings.every(booking => booking.issues.some(issue => issue.code === 'BOOKING_OVERLAP')));
    assert.match(normalized([time()], [], [draft(), draft({ ID: 2 })]).bookings[0].issues[0].message, /Mehrere/);
  });
  it('keeps paid pauses distinct from productive work and marks their valuation unresolved', () => {
    const input = normalized([time({ PAUSE: 0.5, BEZAHLTE_PAUSE: 0.5 })], [rule()], [draft({ PAUSE: 0.5, PAUSE1VON: '23:00', PAUSE1BIS: '23:30', PAUSE1ISTBEZAHLT: 1 })]);
    const result = engine.calculate(input);
    assert.equal(input.bookings[0].paidBreakMinutes, 30); assert.equal(result.totals.productiveMinutes, 210);
    assert.ok(result.issues.some(issue => issue.code === 'PAID_BREAK_POLICY_UNRESOLVED')); assert.equal(result.totals.amount, null);
  });
  it('reproduces the documented order as an explicitly parameterized model, without multiplying worked time', () => {
    const people = [['2001090', '35', '16:00', '20:00'], ['2001170', '30.95', '16:00', '20:00'], ['2001193', '35', '23:00', '03:00'], ['2001120', '30.95', '23:00', '03:00']];
    const input = normalized(people.map(([person, , start, end], i) => time({ ID: i + 1, PERSONALNR: person, VON: start, BIS: end })), people.flatMap(([person, rate], i) => [rule({ ID: i * 2, PERSONALNR: person, PREIS: rate }), night({ ID: i * 2 + 1, PERSONALNR: person, PREIS: rate })]));
    const result = engine.calculate(input);
    assert.equal(result.status, 'PREVIEW'); assert.equal(result.totals.amount, '593.55'); assert.equal(result.totals.productiveMinutes, 960);
    assert.equal(result.fakturpositionen.filter(position => position.wageType === '166').reduce((sum, position) => sum + position.minutes, 0), 480);
  });
  it('does not turn F conditions into L premiums and separates 100 from 110', () => {
    const input = normalized([time()], [night()]); input.side = 'L';
    input.rates = ['2026-10-09', '2026-10-10'].map(date => ({ date, employeeId: 'employee', importId: 'tariff', baseRate: '15', allowance: '0.33' }));
    const result = engine.calculate(input);
    assert.equal(result.status, 'PREVIEW'); assert.equal(result.totals.amount, '61.32');
    assert.deepEqual([...new Set(result.lohnpositionen.map(position => position.wageType))], ['100', '110']);
    assert.equal(result.lohnpositionen.filter(position => position.wageType === '100')[0].rate, '15');
    assert.equal(result.totals.productiveMinutes, 240);
  });
  it('requires explicit precedence, supplement basis and overlap policies', () => {
    const input = normalized([time()], [rule(), rule({ ID: 3, PERSONALNR: 2001193 }), night()]);
    input.policies = engine.policies({ rounding: 'HALF_UP_PER_POSITION' });
    const result = engine.calculate(input);
    assert.equal(result.status, 'INCOMPLETE'); assert.ok(result.issues.some(issue => issue.code === 'RULE_PRECEDENCE_MISSING'));
    input.policies = profile();
    assert.equal(engine.calculate(input).totals.amount, '175.00');
  });
  it('uses defaults outside individual rule validity instead of discarding them for the entire run', () => {
    const input = normalized([time()], [rule(), rule({ ID: 3, PERSONALNR: 2001193, VONDATUM: '2026-11-01', PREIS: 100 })]);
    assert.equal(engine.calculate(input).totals.amount, '140.00');
  });
  it('blocks unmodeled source switches, missing rates and unknown calculation codes', () => {
    const input = normalized([time()], [rule({ TAKTUNG: 15 })]);
    assert.ok(engine.calculate(input).issues.some(issue => issue.code === 'RULE_CODE_UNSUPPORTED'));
    const unknown = normalized([time()], [rule()]); unknown.wageTypes[0].berechnungsartCode = '17';
    assert.ok(engine.calculate(unknown).issues.some(issue => issue.code === 'CALCULATION_TYPE_UNSUPPORTED'));
  });
  it('requires explicit day/calendar and monetary rounding instead of selecting Zvoove semantics', () => {
    const input = normalized([time()], [rule(), night({ FEIERTAG: 1 })]); input.policies = engine.policies();
    const result = engine.calculate(input);
    assert.ok(result.issues.some(issue => issue.code === 'ROUNDING_POLICY_MISSING'));
    assert.ok(result.issues.some(issue => issue.code === 'HOLIDAY_CALENDAR_MISSING'));
    assert.equal(result.totals.amount, null);
    assert.throws(() => engine.policies({ holidayDates: ['2026-02-30'] }), error => error.statusCode === 400);
  });
  it('splits actual time across calendar months without counting the whole shift in its start month', () => {
    const input = normalized([time({ DATUM: '2026-10-31' })], [rule()]);
    const october = engine.calculate({ ...input, month: '2026-10' }), november = engine.calculate({ ...input, month: '2026-11' });
    assert.equal(october.totals.productiveMinutes, 60); assert.equal(november.totals.productiveMinutes, 180);
  });
  it('compares independent invoices and refuses to label incomplete or absent reference coverage a match', () => {
    const result = { ...engine.calculate(normalized([time()], [rule()])), side: 'F' };
    const reference = [{ kind: 'RECHNUNGEN', side: 'F', auftragNr: 2510476, amount: '141' }];
    const before = JSON.stringify(result);
    assert.equal(engine.compare(result, reference, 'RECHNUNGEN').differences[0].delta, '-1.00');
    assert.equal(JSON.stringify(result), before);
    reference[0].amount = '140'; assert.equal(engine.compare(result, reference, 'RECHNUNGEN').status, 'MATCH');
    assert.equal(engine.compare({ ...result, status: 'INCOMPLETE' }, reference, 'RECHNUNGEN').status, 'INCOMPLETE');
    assert.equal(engine.compare(result, [], 'RECHNUNGEN').status, 'INCOMPLETE');
  });
  it('compares monthly wage totals and daily wage positions without inventing missing order references', () => {
    const input = normalized([time()]); input.side = 'L';
    input.rates = ['2026-10-09', '2026-10-10'].map(date => ({ date, employeeId: 'employee', importId: 'tariff', baseRate: '15', allowance: '0' }));
    const result = { ...engine.calculate(input), side: 'L' };
    assert.equal(engine.compare(result, [{ kind: 'LOHNARTENSUMMEN', personalNr: '2001193', month: '2026-10', wageType: '100', unit: 'HOUR', quantity: '4', amount: '60' }], 'LOHNARTENSUMMEN').status, 'MATCH');
    const daily = [{ date: '2026-10-09', quantity: '1', amount: '15' }, { date: '2026-10-10', quantity: '3', amount: '45' }].map(row => ({ ...row, kind: 'LOHNPOSITIONEN', personalNr: '2001193', wageType: '100', unit: 'HOUR' }));
    assert.equal(engine.compare(result, daily, 'LOHNPOSITIONEN').status, 'MATCH');
    daily[0].quantity = '0.5'; daily[0].rate = '16';
    const differences = engine.compare(result, daily, 'LOHNPOSITIONEN').differences;
    assert.ok(differences.some(row => row.code === 'QUANTITY_DIFFERENCE')); assert.ok(differences.some(row => row.code === 'RATE_DIFFERENCE'));
  });
  it('detects overlapping time even when the books were imported in different orders', () => {
    const input = normalized([time()], [rule()]);
    input.bookings.push({ ...input.bookings[0], _id: 'other-order', auftragNr: 42 });
    const result = engine.calculate(input);
    assert.ok(result.issues.some(issue => issue.code === 'BOOKING_OVERLAP')); assert.equal(result.totals.amount, null);
  });
  it('compares rate-specific quantities even when daily totals and the set of rates coincide', () => {
    const common = { personalNr: '2001193', date: '2026-10-09', month: '2026-10', wageType: '100', unit: 'HOUR' };
    const result = { side: 'L', status: 'PREVIEW', lohnpositionen: ['10', '20', '30'].map(rate => ({ ...common, rate, amount: rate, quantityNumerator: '60', quantityDenominator: '60' })) };
    const references = [['10', '0.5', '5'], ['20', '2', '40'], ['30', '0.5', '15']].map(([rate, quantity, amount]) => ({ ...common, kind: 'LOHNPOSITIONEN', rate, quantity, amount }));
    const comparison = engine.compare(result, references, 'LOHNPOSITIONEN');
    assert.equal(comparison.granularity, 'DAY_WAGE_RATE_TOTAL'); assert.equal(comparison.status, 'DIFFERENT');
    assert.equal(comparison.differences.filter(difference => difference.code === 'QUANTITY_DIFFERENCE').length, 3);
  });
});

describe('detail imports, immutable calculations and authorization', function () {
  this.timeout(120000);
  let repl, server, base, oldSecret, admin, staff, payroll, employee, location;
  before(async () => {
    repl = await MongoMemoryReplSet.create({ instanceOpts: [{ ip: '127.0.0.1' }], replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('abrechnung_test'));
    await Promise.all(Object.values(models).map(model => model.init()));
    oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'abrechnung-isolated-tests';
    const routes = require('../routes/payroll/abrechnungRoutes'), app = express(); app.use(express.json());
    app.use('/imports', routes.imports); app.use('/bookings', routes.bookings); app.use('/runs', routes.runs);
    server = await new Promise(resolve => { const handle = app.listen(0, '127.0.0.1', () => resolve(handle)); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    for (const model of [...Object.values(models), ...Object.values(tariffModels), Mitarbeiter, Auftrag, Einsatz, Lohnart, User]) await model.collection.deleteMany({});
    location = oid(); employee = { _id: oid(), personalnr: '2001193', vorname: 'Time', nachname: 'Fixture', locationV2: location };
    admin = { _id: oid(), email: 'admin@time.test', role: 'ADMIN', roles: ['ADMIN'], isConfirmed: true, locationV2: location };
    staff = { _id: oid(), email: 'staff@time.test', role: 'USER', isConfirmed: true, locationV2: location };
    payroll = { _id: oid(), email: 'payroll@time.test', role: 'PAYROLL', isConfirmed: true, locationV2: location };
    await Mitarbeiter.collection.insertOne(employee); await User.collection.insertMany([admin, staff, payroll]);
    await Auftrag.collection.insertOne({ _id: oid(), auftragNr: 2510476, locationV2: location });
    await Lohnart.create([{ lohnartNummer: '100', berechnungsartCode: '2' }, { lohnartNummer: '166', berechnungsartCode: '4' }]);
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (repl) await repl.stop();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  });
  async function request(path, { method = 'GET', user = admin, body, files } = {}) {
    const headers = { 'x-auth-token': jwt.sign({ user: { id: String(user._id), role: 'ADMIN' } }, process.env.JWT_SECRET) };
    let payload;
    if (files) { payload = new FormData(); for (const [key, value] of Object.entries(body || {})) payload.append(key, value); for (const item of files) payload.append(item.fieldname, new Blob([item.buffer]), item.originalname); }
    else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const response = await fetch(base + path, { method, headers, ...(payload ? { body: payload } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const preview = (files, extra = {}) => request('/imports/preview', { method: 'POST', files, body: { kind: 'INPUT', auftragNr: '2510476', pauseUnit: 'HOURS', ...extra } });
  const activate = run => request(`/imports/${run.id}/activate`, { method: 'POST', body: { expectedRevision: run.baseRevision } });
  async function ready() {
    const run = await service.preview([file('STUNDUHR', [time()]), file('AUFTRLOA', [rule(), night()])], { kind: 'INPUT', auftragNr: 2510476, pauseUnit: 'HOURS' }, admin);
    const active = await activate(run); assert.equal(active.status, 200, JSON.stringify(active.body)); return run;
  }
  const calculate = (extra = {}, user = admin) => request('/runs', { method: 'POST', user, body: { side: 'F', auftragNr: 2510476, policies: profile(), ...extra } });
  it('keeps preview isolated, activates typed bookings and preserves old snapshots', async () => {
    const run = await preview([file('STUNDUHR', [time()])]); assert.equal(run.status, 200);
    assert.equal((await request('/bookings?auftragNr=2510476')).body.bookings.length, 0);
    const active = await activate(run.body); assert.equal(active.status, 200);
    const first = (await request('/bookings?auftragNr=2510476')).body;
    assert.equal(first.bookings.length, 1); assert.equal(first.bookings[0].productiveMinutes, 240);
    assert.equal(first.bookings[0].employeeId, String(employee._id));
    const corrected = await preview([file('STUNDUHR', [time({ BIS: '04:00', STUNDEN: 5 })])]); await activate(corrected.body);
    assert.equal((await request('/bookings?auftragNr=2510476')).body.bookings[0].productiveMinutes, 300);
    assert.equal((await models.Booking.findById(first.bookings[0]._id)).productiveMinutes, 240);
    await assert.rejects(() => models.Booking.updateOne({ _id: first.bookings[0]._id }, { $set: { productiveMinutes: 10 } }), /unveränderlich/);
  });
  it('replaces the supplied table as an order snapshot, retains other roles and reuses identical imports', async () => {
    await ready(); const before = await models.Snapshot.countDocuments();
    const again = await preview([file('STUNDUHR', [time()]), file('AUFTRLOA', [rule(), night()])]); await activate(again.body);
    assert.equal(await models.Snapshot.countDocuments(), before);
    const update = await preview([file('STUNDUHR', [time({ BIS: '04:00', STUNDEN: 5 })])]); await activate(update.body);
    assert.equal((await calculate()).body.fakturpositionen.filter(position => position.wageType === '100').reduce((sum, position) => sum + position.minutes, 0), 300);
  });
  it('rejects concurrent stale activation and activation of a different-order dataset', async () => {
    await ready();
    const a = await preview([file('STUNDUHR', [time({ STUNDEN: 3 })])]), b = await preview([file('STUNDUHR', [time({ STUNDEN: 2 })])]);
    const statuses = (await Promise.all([activate(a.body), activate(b.body)])).map(result => result.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    const invalid = await preview([file('STUNDUHR', [time({ AUFTRAGSNR: 42 })])]);
    assert.equal(invalid.body.status, 'INVALID'); assert.equal((await activate(invalid.body)).status, 400);
  });
  it('stores calculation inputs, exact positions and invoice drafts separately from reference results', async () => {
    await ready();
    const first = await calculate(); assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.totals.amount, '175.00'); assert.equal(first.body.invoiceDrafts[0].netAmount, '175.00');
    assert.equal(first.body.stale, false); assert.equal(first.body.transmissionEnabled, false);
    const repeated = await calculate(); assert.equal(repeated.body._id, first.body._id);
    const ref = await preview([file('RECHNUNGEN', [{ AUFTRAGNR: 2510476, BETRAG: '180', RECHNUNGNR: 'REFERENCE-1' }])], { kind: 'REFERENCE', scope: 'order:2510476' });
    assert.equal(ref.status, 200); await activate(ref.body);
    const comparison = await request(`/runs/${first.body._id}/compare`, { method: 'POST', body: { referenceSnapshotId: ref.body.snapshotId, referenceKind: 'RECHNUNGEN' } });
    assert.equal(comparison.status, 200); assert.equal(comparison.body.status, 'DIFFERENT'); assert.equal(comparison.body.differences[0].delta, '-5.00');
    assert.equal((await calculate()).body.totals.amount, '175.00');
    assert.equal((await calculate()).body._id, first.body._id);
    await assert.rejects(() => models.Run.deleteOne({ _id: first.body._id }), /unveränderlich/);
  });
  it('invalidates results on corrected bookings or changed wage metadata without overwriting them', async () => {
    await ready(); const run = (await calculate()).body;
    await Lohnart.updateOne({ lohnartNummer: '100' }, { $set: { berechnungsartCode: '17' } });
    assert.equal((await request(`/runs/${run._id}`)).body.stale, true);
    assert.equal((await request(`/runs/${run._id}`)).body.totals.amount, '175.00');
    const next = await preview([file('STUNDUHR', [time({ BIS: '04:00', STUNDEN: 5 })])]); await activate(next.body);
    assert.equal((await request(`/runs/${run._id}`)).body.stale, true);
  });
  it('keeps the explicit order selection pinned when the employee receives another order', async () => {
    await ready(); const run = (await calculate({ employeeId: String(employee._id) })).body;
    assert.equal(run.stale, false);
    const other = await service.preview([file('STUNDUHR', [time({ AUFTRAGSNR: 42, VON: '16:00', BIS: '20:00' })])], { kind: 'INPUT', auftragNr: 42, pauseUnit: 'HOURS' }, admin);
    await service.activate(other.id, other.baseRevision, admin);
    assert.equal((await request(`/runs/${run._id}`)).body.stale, false);
  });
  it('enforces live roles and location access and prevents reference inputs from entering calculations', async () => {
    await ready();
    assert.equal((await request('/imports', { user: staff })).status, 403);
    assert.equal((await calculate({}, staff)).status, 403); assert.equal((await calculate({}, payroll)).status, 403);
    assert.equal((await calculate({ referenceResults: [{ amount: 5 }] })).status, 400);
    const run = (await calculate()).body;
    assert.equal((await request(`/runs/${run._id}`, { user: payroll })).status, 403);
    await User.updateOne({ _id: admin._id }, { $set: { role: 'USER', roles: ['USER'] } });
    assert.equal((await request('/imports')).status, 403);
    await Mitarbeiter.collection.updateOne({ _id: employee._id }, { $set: { locationV2: oid() } });
    assert.equal((await request(`/bookings?employeeId=${employee._id}&month=2026-10`, { user: staff })).status, 403);
  });
  it('connects the real tariff and allowance resolvers, pins evidence and detects tariff changes', async () => {
    await ready();
    await Lohnart.create({ lohnartNummer: '110', berechnungsartCode: '2', verrechnungCode: '0' });
    const importId = oid();
    await tariffModels.Catalog.create({ _id: '17055', activeImportId: importId, revision: 1 });
    await tariffModels.Group.collection.insertOne({ _id: oid(), importId, legacyId: 'g', name: 'Fixture', payGroups: [{ legacyId: 'p', position: 1 }], stages: [{ legacyId: 's', position: 1 }] });
    await tariffModels.Period.collection.insertOne({ _id: oid(), importId, legacyId: 'period', employeeGroupId: 'g', validFrom: '2026-01-01', validUntil: null,
      rates: [{ stagePosition: 1, groupPosition: 1, value: mongoose.Types.Decimal128.fromString('15') }], wageRules: [{ values: { ILOHNARTNR: 100 } }] });
    await tariffModels.Assignment.collection.insertOne({ _id: oid(), importId, legacyId: 'assignment', employeeId: employee._id, personalNr: employee.personalnr, matchStatus: 'MATCHED', intervalStatus: 'VALID', validFrom: '2026-01-01', validUntil: null, employeeGroupId: 'g', payGroupId: 'p', stageId: 's' });
    await tariffModels.Allowance.collection.insertOne({ _id: oid(), importId, legacyId: 'allowance', employeeId: employee._id, personalNr: employee.personalnr, matchStatus: 'MATCHED', intervalStatus: 'VALID', validFrom: '2026-01-01', validUntil: null, values: { DPREIS: mongoose.Types.Decimal128.fromString('0.33') } });
    const result = await calculate({ side: 'L', employeeId: String(employee._id), month: '2026-10' }, payroll);
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.totals.amount, '61.32');
    assert.equal(result.body.inputs.rates[0].baseEvidence.periodId, 'period'); assert.equal(result.body.inputs.rates[0].allowanceEvidence.recordId, 'allowance');
    assert.equal(result.body.lohnpositionen.some(position => position.wageType === '166'), false);
    await tariffModels.Catalog.updateOne({ _id: '17055' }, { $set: { activeImportId: oid() } });
    assert.equal((await request(`/runs/${result.body._id}`, { user: payroll })).body.stale, true);
  });
});
