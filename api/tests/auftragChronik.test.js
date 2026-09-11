const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { buildChanges, withAuftragChronik } = require('../services/operations/AuftragChronikService');
const router = require('../routes/events/auftraegeRoutes');
const Auftrag = require('../models/Event/Auftrag');
const Schicht = require('../models/Event/Schicht');
const Einsatz = require('../models/Event/Einsatz');
const Entry = require('../models/Event/AuftragChronikEntry');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const User = require('../models/System/User');
const Location = require('../models/System/Location');
const Kunde = require('../models/Customer/Kunde');
const Sequence = require('../models/System/Sequence');
const SignaturVorgang = require('../models/Signature/SignaturVorgang');
require('../models/System/SignaturTyp');
const auth = require('../middleware/auth');

describe('Auftrag Chronik field diffs', () => {
  it('compares full date/time precision and canonical arrays while ignoring technical counters', () => {
    const before = { Auftrag: [{ _id: '1', vonDatum: new Date('2026-09-10T10:00Z'), planningVersion: 1,
      labels: [{ _id: 'old', name: 'A', color: '#fff' }, { name: 'B', color: '#000' }] }] };
    const after = { Auftrag: [{ _id: '1', vonDatum: new Date('2026-09-10T11:00Z'), planningVersion: 2,
      labels: [{ name: 'B', color: '#000' }, { _id: 'new', name: 'A', color: '#fff' }] }] };
    const changes = buildChanges(before, after);
    assert.deepEqual(changes[0].fields.map(item => item.field), ['vonDatum']);
    assert.equal(changes[0].fields[0].before, '2026-09-10T10:00:00.000Z');
    assert.equal(changes[0].fields[0].after, '2026-09-10T11:00:00.000Z');
    assert.deepEqual(buildChanges(after, after), []);
  });

  it('distinguishes false and zero from missing values and keeps only meaningful template changes', () => {
    const before = { Einsatz: [{ _id: '1' }], Schicht: [{ _id: '2', einsatzinformation: { resolvedAt: new Date(0) } }] };
    const after = { Einsatz: [{ _id: '1', stundenlisteIncluded: false, bedarf: 0 }], Schicht: [{ _id: '2', einsatzinformation: { resolvedAt: new Date() } }] };
    assert.equal(buildChanges(before, after).length, 1);
    assert.deepEqual(buildChanges(before, after)[0].fields.map(item => item.after), [0, false]);
  });
});

describe('Auftrag Chronik routes with real transactions', function () {
  this.timeout(120000);
  let repl, server, base, oldSecret, user, admin, otherAdmin, location, order, shift, employee, replacement;
  const oid = () => new mongoose.Types.ObjectId();
  const models = [Auftrag, Schicht, Einsatz, Entry, Mitarbeiter, User, Location, Kunde, Sequence, SignaturVorgang];
  const token = actor => jwt.sign({ user: { id: String(actor._id), role: 'ADMIN' } }, process.env.JWT_SECRET);
  async function request(method, path, body, actor = user) {
    const result = await fetch(`${base}/api/auftraege${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(actor ? { 'x-auth-token': token(actor) } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: result.status, body: await result.json() };
  }
  const feed = () => Entry.find({ auftragId: order._id }).sort({ createdAt: 1, _id: 1 }).lean();

  before(async () => {
    // Always use an isolated, disposable LOCAL replica set. Never use MONGO_URI here.
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('auftrag_chronik_test'));
    for (const model of Object.values(mongoose.models)) await model.init();
    oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'chronik-local-test-secret';
    const app = express();
    app.use(express.json());
    // A controlled late rejection tests rollback even if a handler has already written.
    app.patch('/api/auftraege/:auftragNr/reject-after-write', auth, withAuftragChronik('Auftrag.updated', async (req, res) => {
      await Auftrag.updateOne({ auftragNr: Number(req.params.auftragNr) }, { $set: { eventTitel: 'Must roll back' } });
      res.status(409).json({ message: 'Rejected' });
    }));
    app.use('/api/auftraege', router);
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
    server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)); });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    for (const model of models) await model.deleteMany({});
    location = await Location.create({ nameFull: 'Test Hamburg', shortName: 'THH', externalId: '2', isActive: true });
    user = { _id: oid(), email: 'dispatcher@example.test', name: 'Test Disponent', role: 'USER', roles: ['USER'], locationV2: location._id };
    admin = { _id: oid(), email: 'admin@example.test', name: 'Test Admin', role: 'Admin', roles: ['USER'] };
    otherAdmin = { _id: oid(), email: 'admin2@example.test', name: 'Zweiter Admin', role: 'USER', roles: ['admin'] };
    await User.collection.insertMany([user, admin, otherAdmin]);
    employee = { _id: oid(), personalnr: '200001', email: 'anna@example.test', asana_id: 'test-employee-1', vorname: 'Anna', nachname: 'Test', isActive: true, locationV2: location._id };
    replacement = { _id: oid(), personalnr: '200002', email: 'ben@example.test', asana_id: 'test-employee-2', vorname: 'Ben', nachname: 'Test', isActive: true, locationV2: location._id };
    await Mitarbeiter.collection.insertMany([employee, replacement]);
    order = await Auftrag.create({ auftragNr: 9012345, eventTitel: 'Testauftrag', locationV2: location._id,
      source: 'monitor', isPseudo: true, aktiv: 1, auftStatus: 1, vonDatum: new Date('2026-09-10'), bisDatum: new Date('2026-09-11') });
    shift = await Schicht.create({ auftragNr: order.auftragNr, locationV2: location._id, source: 'monitor',
      bezeichnung: 'Service', datumVon: new Date('2026-09-10'), datumBis: new Date('2026-09-10'),
      uhrzeitVon: '18:00', uhrzeitBis: '23:00', bedarf: 3 });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (repl) await repl.stop();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  });

  it('records a non-Admin edit to an imported order, preserves Stundenliste diffs and skips no-ops', async () => {
    await Auftrag.updateOne({ _id: order._id }, { $set: { source: 'zvoove' } });
    // An open signature without storage keys exercises the legacy reader without R2 access.
    await SignaturVorgang.collection.insertOne({ _id: oid(), name: 'Test Stundenliste', typ: null,
      typKey: 'stundenliste', auftragNr: order.auftragNr, status: 'open', createdAt: new Date(0) });
    const path = `/${order.auftragNr}`;
    assert.equal((await request('PATCH', path, { eventTitel: 'Neuer Titel', vonDatum: '2026-09-10T12:30:00Z' })).status, 200);
    let rows = await feed();
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].actor.id), String(user._id));
    assert.equal(rows[0].actor.name, user.name);
    assert.equal(rows[0].changes[0].fields.find(item => item.field === 'eventTitel').before, 'Testauftrag');
    assert.equal((await Auftrag.findById(order._id)).stundenlisteChangeLog.length, 1);
    const status = await request('GET', `${path}/stundenliste-status`);
    assert.equal(status.status, 200, JSON.stringify(status.body));
    assert.equal(status.body.isOutdated, true);
    const detail = status.body.outdatedReasons.find(reason => reason.entity === 'Auftragsdaten').details[0];
    assert.deepEqual({ field: detail.field, before: detail.before, after: detail.after },
      { field: 'Veranstaltung', before: 'Testauftrag', after: 'Neuer Titel' });
    assert.equal((await request('PATCH', path, { eventTitel: 'Neuer Titel', wizardStep: 3 })).status, 200);
    assert.equal((await feed()).length, 1);
    assert.equal((await request('PATCH', path, { unknown: 'bad' })).status, 400);
    assert.equal((await feed()).length, 1);
    // Direct updates / imports are deliberately outside the route recorder.
    await Auftrag.updateOne({ _id: order._id }, { $set: { eventTitel: 'Import' } });
    assert.equal((await feed()).length, 1);
  });

  it('rejects partial or unsafe order numbers before legacy parseInt handlers can write', async () => {
    for (const number of [`${order.auftragNr}invalid`, `${order.auftragNr}.5`, '0', '9007199254740992']) {
      assert.equal((await request('PATCH', `/${number}`, { eventTitel: 'Must not be written' })).status, 400);
    }
    assert.equal((await Auftrag.findById(order._id)).eventTitel, 'Testauftrag');
    assert.equal((await feed()).length, 0);
  });

  it('protects every endpoint, checks current database roles and limits deletion to own notes', async () => {
    const path = `/${order.auftragNr}/chronik`;
    for (const actor of [null, user]) {
      const expected = actor ? 403 : 401;
      assert.equal((await request('GET', path, undefined, actor)).status, expected);
      assert.equal((await request('POST', `${path}/notes`, { text: 'Denied' }, actor)).status, expected);
      assert.equal((await request('DELETE', `${path}/${oid()}`, undefined, actor)).status, expected);
    }
    const note = await request('POST', `${path}/notes`, { text: 'Notiz', isSystem: true, actor: user }, admin);
    assert.equal(note.status, 201);
    assert.equal(note.body.kind, 'note');
    assert.equal(note.body.actor.id, String(admin._id));
    const anotherOrder = await Auftrag.create({ auftragNr: 9012346, eventTitel: 'Anderer Auftrag', locationV2: location._id });
    assert.equal((await request('DELETE', `/${anotherOrder.auftragNr}/chronik/${note.body._id}`, undefined, admin)).status, 404);
    assert.equal((await request('GET', path, undefined, otherAdmin)).status, 200);
    assert.equal((await request('DELETE', `${path}/${note.body._id}`, undefined, otherAdmin)).status, 403);
    assert.equal((await request('DELETE', `${path}/${note.body._id}`, undefined, admin)).status, 200);
    await request('PATCH', `/${order.auftragNr}`, { eventTitel: 'Changed' });
    const [entry] = await feed();
    assert.equal((await request('DELETE', `${path}/${entry._id}`, undefined, admin)).status, 403);
    const oldToken = token(admin);
    await User.updateOne({ _id: admin._id }, { $set: { role: 'USER', roles: ['USER'] } });
    const revoked = await fetch(`${base}/api/auftraege${path}`, { headers: { 'x-auth-token': oldToken } });
    assert.equal(revoked.status, 403);
  });

  it('validates input and pagination, with no duplicates when timestamps match', async () => {
    const path = `/${order.auftragNr}/chronik`;
    for (let i = 0; i < 3; i++) assert.equal((await request('POST', `${path}/notes`, { text: `Note ${i}` }, admin)).status, 201);
    await Entry.updateMany({}, { $set: { createdAt: new Date('2026-09-10') } }, { overwriteImmutable: true });
    const first = await request('GET', `${path}?limit=2`, undefined, admin);
    assert.equal(first.body.entries.length, 2);
    assert.ok(first.body.nextCursor);
    const second = await request('GET', `${path}?limit=2&cursor=${first.body.nextCursor}`, undefined, admin);
    assert.equal(second.body.entries.length, 1);
    assert.equal(second.body.nextCursor, null);
    assert.equal(new Set([...first.body.entries, ...second.body.entries].map(item => item._id)).size, 3);
    for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'cursor=invalid']) assert.equal((await request('GET', `${path}?${query}`, undefined, admin)).status, 400);
    for (const text of ['', ' '.repeat(3), 'x'.repeat(5001), {}]) assert.equal((await request('POST', `${path}/notes`, { text }, admin)).status, 400);
  });

  it('records employee replacement and preserves employee names after later master-data changes', async () => {
    const assigned = await request('POST', `/${order.auftragNr}/einsaetze`, { mitarbeiterId: employee._id, schichtId: shift._id });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    const edited = await request('PATCH', `/${order.auftragNr}/einsaetze/${assigned.body._id}`, { mitarbeiterId: replacement._id, uhrzeitVon: '19:30', stundenlisteIncluded: false });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    const rows = await feed();
    const fields = rows[1].changes[0].fields;
    assert.equal(fields.find(item => item.field === 'personalNr').beforeLabel, 'Anna Test (#200001)');
    assert.equal(fields.find(item => item.field === 'personalNr').afterLabel, 'Ben Test (#200002)');
    assert.equal(fields.find(item => item.field === 'uhrzeitVon').before, '18:00');
    await Mitarbeiter.updateOne({ _id: replacement._id }, { $set: { nachname: 'Renamed' } });
    assert.match((await feed())[1].changes[0].label, /Ben Test/);
    assert.equal((await request('DELETE', `/${order.auftragNr}/einsaetze/${assigned.body._id}`)).status, 200);
    assert.equal((await feed())[2].changes[0].action, 'deleted');
  });

  it('groups shift time propagation and cascade deletion with all affected assignment details', async () => {
    for (const person of [employee, replacement]) await request('POST', `/${order.auftragNr}/einsaetze`, { mitarbeiterId: person._id, schichtId: shift._id });
    const changed = await request('PATCH', `/${order.auftragNr}/schichten/${shift._id}`, { uhrzeitVon: '20:00' });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    const rows = await feed();
    assert.equal(rows.length, 3);
    assert.equal(rows[2].changes.length, 3);
    for (const change of rows[2].changes) assert.equal(change.fields.find(item => item.field === 'uhrzeitVon').after, '20:00');
    assert.equal((await request('DELETE', `/${order.auftragNr}/schichten/${shift._id}`)).status, 200);
    assert.equal((await feed())[3].changes.filter(item => item.action === 'deleted').length, 3);
    assert.equal(await Einsatz.countDocuments({ auftragNr: order.auftragNr }), 0);
  });

  it('captures bulk planning once, suppresses validation-only changes and rejects stale versions', async () => {
    const result = await request('PUT', `/${order.auftragNr}/planning`, { planningVersion: 0,
      operations: [employee, replacement].map(person => ({ type: 'assign', schichtId: shift._id, mitarbeiterId: person._id })) });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal((await feed()).length, 1);
    assert.equal((await feed())[0].changes.length, 2);
    assert.equal((await request('PUT', `/${order.auftragNr}/planning`, { planningVersion: 1, operations: [] })).status, 200);
    assert.equal((await feed()).length, 1);
    assert.equal((await request('PUT', `/${order.auftragNr}/planning`, { planningVersion: 0, operations: [] })).status, 409);
    assert.equal((await feed()).length, 1);
    const removed = await request('PUT', `/${order.auftragNr}/planning`, { planningVersion: 2,
      operations: result.body.assignments.map(assignment => ({ type: 'remove', einsatzId: assignment._id })) });
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    const rows = await feed();
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1].changes.map(change => change.action), ['deleted', 'deleted']);
  });

  it('records labels, release, pseudo assignments and pseudo-order deletion without removing history', async () => {
    const labels = await request('POST', `/${order.auftragNr}/labels`, { name: 'Test', color: '#000' });
    assert.equal(labels.status, 200);
    assert.equal((await request('DELETE', `/${order.auftragNr}/labels/${labels.body.labels[0]._id}`)).status, 200);
    assert.equal((await request('POST', `/${order.auftragNr}/release`)).status, 200);
    const pseudo = await request('POST', `/${order.auftragNr}/pseudo-einsatz`, { mitarbeiterId: employee._id, isNewPseudoSchicht: true, newSchichtBezeichnung: 'Pseudo-Service' });
    assert.equal(pseudo.status, 201, JSON.stringify(pseudo.body));
    assert.equal((await request('DELETE', `/${order.auftragNr}/pseudo-einsatz/${pseudo.body._id}`)).status, 200);
    assert.equal((await request('DELETE', `/${order.auftragNr}`)).status, 200);
    const rows = await feed();
    assert.equal(rows.length, 6);
    assert.equal(rows[2].action, 'Auftrag.released');
    assert.equal(rows.at(-1).changes.filter(item => item.action === 'deleted').length, 2);
    assert.equal(await Auftrag.countDocuments({ _id: order._id }), 0);
    assert.equal((await request('GET', `/${order.auftragNr}/chronik`, undefined, admin)).status, 404);
    await Auftrag.create({ auftragNr: order.auftragNr, eventTitel: 'Wiederverwendete Nummer', locationV2: location._id });
    assert.deepEqual((await request('GET', `/${order.auftragNr}/chronik`, undefined, admin)).body.entries, []);
    assert.equal((await feed()).length, 6);
  });

  it('records newly created regular/pseudo orders and shifts only after persistence', async () => {
    await Kunde.collection.insertOne({ _id: oid(), kundenNr: 123, locationV2: location._id });
    for (const isPseudo of [false, true]) {
      const created = await request('POST', '/', { auftragNr: 12345, isPseudo, kundenNr: 123, eventTitel: 'New order', locationV2: location._id, vonDatum: '2026-09-10', bisDatum: '2026-09-11' });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(await Entry.countDocuments({ auftragId: created.body._id, action: 'Auftrag.created' }), 1);
      const newShift = await request('POST', `/${created.body.auftragNr}/schichten`, { bezeichnung: 'Neue Schicht', uhrzeitVon: '09:00', uhrzeitBis: '15:00' });
      assert.equal(newShift.status, 201, JSON.stringify(newShift.body));
      assert.equal(await Entry.countDocuments({ auftragId: created.body._id, action: 'Schicht.created' }), 1);
    }
  });

  it('rolls back the business mutation if recording fails or a handler rejects after writing', async () => {
    const originalCreate = Entry.create;
    Entry.create = async () => { throw new Error('Simulated audit storage failure'); };
    try {
      assert.equal((await request('PATCH', `/${order.auftragNr}`, { eventTitel: 'Must roll back' })).status, 500);
    } finally { Entry.create = originalCreate; }
    assert.equal((await Auftrag.findById(order._id)).eventTitel, 'Testauftrag');
    assert.equal((await feed()).length, 0);
    assert.equal((await request('PATCH', `/${order.auftragNr}/reject-after-write`, {})).status, 409);
    assert.equal((await Auftrag.findById(order._id)).eventTitel, 'Testauftrag');
    assert.equal((await feed()).length, 0);
  });

  it('keeps concurrent edits attributed to their own actors', async () => {
    const responses = await Promise.all([
      request('POST', `/${order.auftragNr}/labels`, { name: 'One' }, user),
      request('POST', `/${order.auftragNr}/labels`, { name: 'Two' }, admin),
    ]);
    assert.deepEqual(responses.map(result => result.status), [200, 200]);
    const rows = await feed();
    assert.equal(rows.length, 2);
    for (const [actor, label] of [[user, 'One'], [admin, 'Two']]) {
      const field = rows.find(row => String(row.actor.id) === String(actor._id)).changes[0].fields[0];
      const previous = new Set((field.before || []).map(item => item.name));
      assert.deepEqual(field.after.filter(item => !previous.has(item.name)).map(item => item.name), [label]);
    }
  });

  it('retains order/location boundaries and never adds Chronik to ordinary order data', async () => {
    await request('PATCH', `/${order.auftragNr}`, { eventTitel: 'Changed' });
    const response = await request('PATCH', `/${order.auftragNr}`, { referenz: 'Test' });
    assert.equal(response.body.chronik, undefined);
    assert.equal(response.body.changes, undefined);
    await Auftrag.updateOne({ _id: order._id }, { $set: { locationV2: oid() } });
    assert.equal((await request('PATCH', `/${order.auftragNr}`, { eventTitel: 'Denied' })).status, 403);
    assert.equal((await request('GET', `/${order.auftragNr}/chronik`, undefined, admin)).status, 200);
    await Auftrag.updateOne({ _id: order._id }, { $set: { locationV2: null } });
    assert.equal((await request('GET', `/${order.auftragNr}/chronik`, undefined, admin)).status, 400);
    assert.equal((await request('GET', '/999999/chronik', undefined, admin)).status, 404);
  });
});
