const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const service = require('../services/TimeCaptureService');
const Stundenzeit = require('../models/Stundenzeit');
const Einsatz = require('../models/Event/Einsatz');
const Auftrag = require('../models/Event/Auftrag');
const Schicht = require('../models/Event/Schicht');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const User = require('../models/System/User');
const { EventReport } = require('../models/Classes/EventReport');
const Signature = require('../models/Signature/SignaturVorgang');

describe('Operational time capture calculation', () => {
  it('derives overnight minutes and paid breaks on the server', () => {
    const actual = service.calculate('2020-09-08', { start: '17:00', end: '04:00', breakMinutes: 60, paidBreakMinutes: 15 });
    assert.equal(actual.netMinutes, 615);
    assert.equal(actual.actualEnd.toISOString(), '2020-09-09T02:00:00.000Z');
    assert.equal(service.calculate('2020-09-08', { start: '17:00', end: '04:00', breakMinutes: 60, paidBreakMinutes: 15 }, true).netMinutes, 600);
  });
  it('rejects invalid minutes, overlapping pauses and ambiguous DST clocks', () => {
    for (const breakMinutes of [-1, 0.5, '30', 700]) assert.throws(() => service.calculate('2020-09-08', { start: '10:00', end: '18:00', breakMinutes }));
    assert.throws(() => service.calculate('2020-09-08', { start: '10:00', end: '18:00', breaks: [
      { start: '12:00', end: '13:00', paid: false }, { start: '12:30', end: '13:30', paid: false },
    ] }));
    assert.throws(() => service.calculate('2020-10-25', { start: '02:30', end: '06:00' }));
  });
});

describe('Operational time capture API', function () {
  this.timeout(120000);
  let repl, server, base, oldSecret, oldPublicToken, employee, other, user, einsatz, second, order, location;
  const oid = () => new mongoose.Types.ObjectId();
  const publicToken = () => jwt.sign({ source: 'oidc', email: employee.email }, process.env.JWT_SECRET, { issuer: 'straight-monitor', expiresIn: '5m' });
  const userToken = () => jwt.sign({ user: { id: String(user._id), role: 'ADMIN' } }, process.env.JWT_SECRET, { expiresIn: '5m' });
  async function request(path, { publicAccess = false, token, method = 'GET', body } = {}) {
    const response = await fetch(`${base}/api/${publicAccess ? 'public/' : ''}working-times${path}`, {
      method, headers: { 'Content-Type': 'application/json', [publicAccess ? 'x-public-token' : 'x-auth-token']: token || (publicAccess ? publicToken() : userToken()) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  const time = () => ({ start: '10:00', end: '18:00', breakMinutes: 30 });
  const submit = (id = einsatz._id) => request(`/${id}`, { publicAccess: true, method: 'POST', body: time() });
  const update = (action, revision, values = time(), reason = 'Mit Mitarbeiter abgestimmt') => request(`/orders/${order.auftragNr}`, { method: 'POST', body: { action, reason, entries: [{ einsatzId: String(einsatz._id), revision, ...values }] } });
  const month = () => request(`/employees/${employee._id}/month?month=2020-09`);
  before(async () => {
    // Disposable local DB only. No application/database connection settings used.
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('time_capture_test'));
    await Stundenzeit.init();
    oldSecret = process.env.JWT_SECRET; oldPublicToken = process.env.FLIP_PUBLIC_JWT;
    process.env.JWT_SECRET = 'time-capture-isolated-test-secret';
    process.env.FLIP_PUBLIC_JWT = 'shared-legacy-test-token';
    const app = express(); app.use(express.json());
    app.use('/api/working-times', require('../routes/employee/timeCaptureRoutes'));
    app.use('/api/public/working-times', require('../routes/public/publicTimeCaptureRoutes'));
    server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)); });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    for (const model of [Stundenzeit, Einsatz, Auftrag, Schicht, Mitarbeiter, User, EventReport, Signature]) await model.deleteMany({});
    location = oid();
    employee = { _id: oid(), personalnr: '100001', asana_id: 'time-test-1', email: 'employee@example.test', vorname: 'Anna', nachname: 'Test', isActive: true, locationV2: location, arbeitszeit: { monat: 100 } };
    other = { _id: oid(), personalnr: '100002', asana_id: 'time-test-2', email: 'other@example.test', isActive: true, locationV2: location };
    user = { _id: oid(), name: 'Office', email: 'office@example.test', role: 'USER', roles: ['USER'], isConfirmed: true, locationV2: location };
    await Mitarbeiter.collection.insertMany([employee, other]); await User.collection.insertOne(user);
    order = await Auftrag.create({ auftragNr: 9100001, locationV2: location, eventTitel: 'Testauftrag' });
    const shift = await Schicht.create({ auftragNr: order.auftragNr, datumVon: new Date('2020-09-08'), uhrzeitVon: '10:00', uhrzeitBis: '18:00' });
    einsatz = await Einsatz.create({ auftragNr: order.auftragNr, schicht: shift._id, personalNr: Number(employee.personalnr), datumVon: new Date('2020-09-08') });
    second = await Einsatz.create({ auftragNr: order.auftragNr, personalNr: Number(employee.personalnr), datumVon: new Date('2020-09-09') });
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); if (repl) await repl.stop();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
    if (oldPublicToken === undefined) delete process.env.FLIP_PUBLIC_JWT; else process.env.FLIP_PUBLIC_JWT = oldPublicToken;
  });
  it('accepts exactly one simultaneous employee submission and reloads the permanent lock', async () => {
    const results = await Promise.all([submit(), submit()]);
    assert.deepEqual(results.map(item => item.status).sort(), [201, 409]);
    assert.equal(await Stundenzeit.countDocuments(), 1);
    const state = await request(`/${einsatz._id}`, { publicAccess: true });
    assert.equal(state.body.locked, true);
    assert.equal(state.body.original.netMinutes, 450);
    assert.equal((await submit(second._id)).status, 201); // another shift in the same order
  });
  it('allows entries before the scheduled end and an optional office note', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const futureShift = await Schicht.create({ auftragNr: order.auftragNr, datumVon: new Date(`${futureDate}T00:00:00Z`), uhrzeitVon: '10:00', uhrzeitBis: '18:00' });
    const future = await Einsatz.create({ auftragNr: order.auftragNr, schicht: futureShift._id, personalNr: Number(employee.personalnr), datumVon: new Date(`${futureDate}T00:00:00Z`) });
    assert.equal((await submit(future._id)).status, 201);
    assert.equal((await update('save', 0, time(), '')).status, 200);
  });
  it('rejects shared tokens, forged employee identities and public tokens on internal routes', async () => {
    assert.equal((await request(`/${einsatz._id}`, { publicAccess: true, token: 'shared-legacy-test-token', method: 'POST', body: { ...time(), email: employee.email } })).status, 403);
    await Einsatz.updateOne({ _id: einsatz._id }, { $set: { personalNr: Number(other.personalnr) } });
    assert.equal((await submit()).status, 404);
    assert.equal((await request(`/orders/${order.auftragNr}`, { token: publicToken() })).status, 401);
  });
  it('keeps employee original, office draft and released month separate through corrections', async () => {
    assert.equal((await submit()).status, 201);
    assert.equal((await month()).body.initialData.entries.length, 0);
    assert.equal((await update('save', 1, { ...time(), end: '19:00' })).status, 200);
    assert.equal((await month()).body.initialData.entries.length, 0);
    assert.equal((await submit()).status, 409);
    assert.equal((await update('release', 2, { ...time(), end: '19:00' })).status, 200);
    assert.equal((await month()).body.initialData.entries[0].minutes, 510);
    assert.equal((await update('save', 3, { ...time(), end: '20:00' })).status, 200);
    assert.equal((await month()).body.initialData.entries[0].minutes, 510);
    assert.equal((await update('release', 4, { ...time(), end: '20:00' })).status, 200);
    const latest = (await month()).body.initialData.entries;
    assert.equal(latest.length, 1); assert.equal(latest[0].minutes, 570); assert.equal(latest[0].originalMinutes, 450);
    assert.equal((await submit()).status, 409);
    assert.equal((await update('release', 4)).status, 409);
    const review = (await request(`/orders/${order.auftragNr}`)).body;
    assert.equal(review.einsaetze[0].mitarbeiterData.vorname, 'Anna');
    assert.equal(review.entries[0].employeeSubmission.netMinutes, 450);
    assert.equal(review.entries[0].history.length, 5);
  });
  it('locks employee capture after an office-created entry and rolls back conflicting batches', async () => {
    assert.equal((await update('save', 0)).status, 200);
    assert.equal((await submit()).status, 409);
    const response = await request(`/orders/${order.auftragNr}`, { method: 'POST', body: { action: 'release', reason: 'Prüfung', entries: [
      { einsatzId: String(second._id), revision: 0, ...time() },
      { einsatzId: String(einsatz._id), revision: 0, ...time() },
    ] } });
    assert.equal(response.status, 409);
    assert.equal(await Stundenzeit.findById(second._id), null);
    assert.equal((await month()).body.initialData.entries.length, 0);
  });
  it('checks live location access and does not reveal a previous employee submission on reassignment', async () => {
    await submit();
    await Einsatz.updateOne({ _id: einsatz._id }, { $set: { personalNr: Number(other.personalnr) } });
    const token = jwt.sign({ source: 'oidc', email: other.email }, process.env.JWT_SECRET, { issuer: 'straight-monitor' });
    const state = await request(`/${einsatz._id}`, { publicAccess: true, token });
    assert.equal(state.body.locked, true); assert.equal(state.body.original, null);
    await User.updateOne({ _id: user._id }, { $set: { locationV2: oid() } });
    assert.equal((await request(`/orders/${order.auftragNr}`)).status, 403);
    assert.equal((await month()).status, 403);
    assert.equal((await update('release', 1)).status, 403);
  });
  it('resolves secondary personal numbers to the same employee across the workflow', async () => {
    await Mitarbeiter.updateOne({ _id: employee._id }, { $set: { personalnummern: ['200001'] } });
    await Einsatz.updateOne({ _id: einsatz._id }, { $set: { personalNr: 200001 } });
    assert.equal((await submit()).status, 201);
    const review = await request(`/orders/${order.auftragNr}?employeeId=${employee._id}`);
    assert.equal(review.body.einsaetze.find(row => row.personalNr === 200001).mitarbeiterData._id, String(employee._id));
    assert.equal((await update('release', 1)).status, 200);
    assert.equal((await month()).body.initialData.entries.length, 1);
  });
  it('lists linked documents, prioritizes completed hours lists and renders a report PDF', async () => {
    const report = await EventReport.create({ auftragnummer: String(order.auftragNr), name_teamleiter: 'Testleitung', kunde: 'Testkunde', location: 'Hamburg', datum: new Date('2020-09-08'), sonstiges: 'Gespeicherter Bericht mit Umlauten: äöü.' });
    await EventReport.create({ auftragnummer: '123456', name_teamleiter: 'Fremd', kunde: 'Anderer Kunde', location: 'Berlin', datum: new Date('2020-09-08') });
    await Signature.collection.insertMany([
      { name: 'Ausgefüllte Stundenliste', typKey: 'stundenliste', auftragNr: order.auftragNr, status: 'completed', r2KeySigned: 'test/signed.pdf', r2KeyUnsigned: 'test/blank.pdf' },
      { name: 'Wartet auf Datei', typKey: 'stundenliste', auftragNr: order.auftragNr, status: 'completed', r2KeyUnsigned: 'test/blank.pdf' },
    ]);
    const response = await request(`/orders/${order.auftragNr}/documents`);
    assert.equal(response.status, 200);
    assert.equal(response.body.documents.length, 3);
    assert.equal(response.body.documents[0].completed, true);
    assert.equal(response.body.documents.find(doc => doc.title === 'Wartet auf Datei').available, false);
    assert.equal(JSON.stringify(response.body).includes('test/signed.pdf'), false);
    const pdf = await fetch(`${base}/api/working-times/orders/${order.auftragNr}/documents/eventreport/${report._id}/preview`, { headers: { 'x-auth-token': userToken() } });
    assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    const { PDFDocument } = require('pdf-lib');
    assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1);
    const foreign = await EventReport.findOne({ auftragnummer: '123456' }).lean();
    assert.equal((await request(`/orders/${order.auftragNr}/documents/eventreport/${foreign._id}/preview`)).status, 404);
  });
  it('resolves only the linked signed file, checks location again and never serves a blank as completed', async () => {
    const id = oid(), waitingId = oid();
    await Signature.collection.insertMany([
      { _id: id, name: 'Stundenliste', typKey: 'stundenliste', auftragNr: order.auftragNr, status: 'completed', r2KeySigned: 'test/signed.pdf', r2KeyUnsigned: 'test/blank.pdf' },
      { _id: waitingId, name: 'Wartet', typKey: 'stundenliste', auftragNr: order.auftragNr, status: 'completed', r2KeyUnsigned: 'test/blank.pdf' },
    ]);
    const storage = require('../services/integrations/R2Service');
    const original = storage.getSignedDownloadUrl; let actualKey;
    storage.getSignedDownloadUrl = async key => { actualKey = key; return 'https://storage.example.test/signed.pdf'; };
    try {
      const result = await request(`/orders/${order.auftragNr}/documents/signature/${id}/preview?key=foreign.pdf`);
      assert.equal(result.status, 200); assert.equal(actualKey, 'test/signed.pdf');
      assert.equal((await request(`/orders/${order.auftragNr}/documents/signature/${waitingId}/preview`)).status, 409);
      await User.updateOne({ _id: user._id }, { $set: { locationV2: oid() } });
      assert.equal((await request(`/orders/${order.auftragNr}/documents/signature/${id}/preview`)).status, 403);
      assert.equal((await request(`/orders/${order.auftragNr}/documents`)).status, 403);
    } finally { storage.getSignedDownloadUrl = original; }
  });
});
