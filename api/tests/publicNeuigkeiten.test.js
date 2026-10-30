const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Einsatz = require('../models/Event/Einsatz');
const Auftrag = require('../models/Event/Auftrag');
const Schicht = require('../models/Event/Schicht');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Stundenzeit = require('../models/Stundenzeit');
const User = require('../models/System/User');
require('../models/Customer/Kunde');
const Sequence = require('../models/System/Sequence');
const { INVALIDATED_REASON_TIME_CHANGED, invalidateForTimeChange } = require('../services/operations/EinsatzBestaetigungService');
const {
  TEST_MITARBEITER_ID,
  createTomorrowConfirmationFixture,
  deleteTomorrowConfirmationFixture,
} = require('../services/public/PublicNeuigkeitenFixtureService');

describe('Public Neuigkeiten API', function () {
  this.timeout(120000);
  let repl;
  let server;
  let base;
  let employee;
  let other;
  let assignment;
  let oldSecret;

  function token(email) {
    return jwt.sign({ source: 'oidc', email }, process.env.JWT_SECRET, {
      issuer: 'straight-monitor', expiresIn: '5m',
    });
  }

  async function request(path, { method = 'GET', email = employee.email } = {}) {
    const response = await fetch(`${base}/api/public${path}`, {
      method,
      headers: { 'x-public-token': token(email) },
    });
    const contentType = response.headers.get('content-type') || '';
    return {
      status: response.status,
      body: contentType.includes('application/json') ? await response.json() : await response.text(),
    };
  }

  before(async () => {
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('public_neuigkeiten_test'));
    oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'public-neuigkeiten-test-secret';
    const app = express();
    app.use(express.json());
    app.use('/api/public', require('../routes/public/publicRoutes'));
    app.use(require('../middleware/ErrorHandler'));
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    await Promise.all([Einsatz.deleteMany({}), Auftrag.deleteMany({}), Schicht.deleteMany({}), Mitarbeiter.deleteMany({}), Stundenzeit.deleteMany({}), User.deleteMany({}), Sequence.deleteMany({})]);
    employee = { _id: new mongoose.Types.ObjectId(), personalnr: '310001', asana_id: 'public-news-anna', email: 'anna@example.test', vorname: 'Anna', nachname: 'Test', isActive: true };
    other = { _id: new mongoose.Types.ObjectId(), personalnr: '310002', asana_id: 'public-news-bert', email: 'bert@example.test', vorname: 'Bert', nachname: 'Test', isActive: true };
    await Mitarbeiter.collection.insertMany([employee, other]);
    const future = new Date();
    future.setDate(future.getDate() + 2);
    await Auftrag.collection.insertOne({ auftragNr: 9310001, eventTitel: 'Messe Hamburg', eventLocation: 'Messehalle', vonDatum: future, bisDatum: future });
    assignment = await Einsatz.create({
      auftragNr: 9310001,
      personalNr: 310001,
      source: 'monitor',
      datumVon: future,
      datumBis: future,
      uhrzeitVon: '10:00',
      uhrzeitBis: '18:00',
      bestaetigungErforderlich: true,
    });
    const past = new Date();
    past.setDate(past.getDate() - 1);
    await Einsatz.create({ auftragNr: 9310001, personalNr: 310001, source: 'monitor', datumVon: past, datumBis: past, bestaetigungErforderlich: true });
    await Einsatz.create({ auftragNr: 9310001, personalNr: 310001, source: 'zvoove', datumVon: future, datumBis: future, bestaetigungErforderlich: true });
    await Einsatz.create({ auftragNr: 9310001, personalNr: 310001, source: 'monitor', datumVon: future, datumBis: future, bestaetigungErforderlich: false });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (repl) await repl.stop();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });

  it('exposes only an explicit linked Monitor user flag, independent of email and team leader status', async () => {
    const profilePath = `/mitarbeiter?email=${encodeURIComponent(employee.email)}`;
    const unlinked = await request(profilePath);
    assert.equal(unlinked.status, 200);
    assert.equal(unlinked.body.hasUser, false);

    const userId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: userId, email: employee.email, mitarbeiter: other._id, password: 'fixture-only', isConfirmed: true });
    assert.equal((await request(profilePath)).body.hasUser, false);
    const linked = await request(`/mitarbeiter?email=${encodeURIComponent(other.email)}`, { email: other.email });
    assert.equal(linked.status, 200);
    assert.equal(linked.body.hasUser, true);
    assert.equal(linked.body.isTeamleiter, false);
    for (const field of ['password', 'user', 'userId', 'roles']) assert.equal(field in linked.body, false);
  });

  it('marks assignments with any existing time capture without exposing the captured values', async () => {
    const assignments = await Einsatz.find({ personalNr: Number(employee.personalnr) }).lean();
    const recorded = assignments.slice(0, 3);
    const statuses = ['SUBMITTED', 'DRAFT', 'RELEASED'];
    const values = { date: '2026-10-01', start: '10:00', end: '18:00', actualStart: new Date('2026-10-01T08:00:00Z'), actualEnd: new Date('2026-10-01T16:00:00Z'), breakMinutes: 30, paidBreakMinutes: 0, netMinutes: 450 };
    await Stundenzeit.create(recorded.map((assignment, index) => ({
      _id: assignment._id, mitarbeiter: employee._id, personalNr: Number(employee.personalnr), auftragNr: assignment.auftragNr,
      status: statuses[index], current: values, ...(index === 0 ? { employeeSubmission: values } : {}),
    })));
    // An unrelated capture must not mark another assignment of the same employee.
    await Stundenzeit.create({ _id: new mongoose.Types.ObjectId(), mitarbeiter: employee._id, personalNr: Number(employee.personalnr), auftragNr: assignment.auftragNr, status: 'SUBMITTED', current: values });
    const result = await request(`/einsaetze?personalNr=${employee.personalnr}`);
    assert.equal(result.status, 200); assert.equal(result.body.length, assignments.length);
    const recordedIds = new Set(recorded.map(row => String(row._id)));
    for (const row of result.body) {
      assert.equal(row.hasWorkingTimeEntry, recordedIds.has(row._id));
      assert.equal('employeeSubmission' in row, false); assert.equal('current' in row, false); assert.equal('released' in row, false);
    }
    assert.equal(result.body.filter(row => !row.hasWorkingTimeEntry).length, 1);
    assert.ok(result.body.every(row => row.auftrag?.eventTitel === 'Messe Hamburg'));
    assert.deepEqual((await request(`/einsaetze?personalNr=${other.personalnr}`)).body, []);
  });

  it('keeps pseudo jobs accessible with optional time capture at assignment, shift and order level', async () => {
    await Einsatz.updateOne({ _id: assignment._id }, { $set: { isPseudo: true } });
    await Auftrag.collection.insertOne({ auftragNr: 9310002, eventTitel: 'Pseudo-Auftrag', isPseudo: true });
    const [pseudoShift, legacyPseudoShift, regularShift] = await Schicht.create([
      { auftragNr: 9310001, idAuftragArbeitsschichten: 7123, isPseudo: true },
      { auftragNr: 9310001, source: 'monitor', isPseudo: false },
      { auftragNr: 9310001, source: 'monitor', day: '2026-10-29', groupShiftKey: 'regular', isPseudo: false },
    ]);
    const common = { personalNr: Number(employee.personalnr), source: 'monitor', datumVon: assignment.datumVon, datumBis: assignment.datumBis };
    const added = await Einsatz.create([
      { ...common, auftragNr: 9310002 },
      { ...common, auftragNr: 9310001, schicht: pseudoShift._id },
      { ...common, auftragNr: 9310001, idAuftragArbeitsschichten: 7123 },
      { ...common, auftragNr: 9310001, schicht: legacyPseudoShift._id },
      { ...common, auftragNr: 9310001, schicht: regularShift._id },
    ]);
    const optionalIds = new Set([assignment._id, ...added.slice(0, 4).map(row => row._id)].map(String));
    const result = await request(`/einsaetze?personalNr=${employee.personalnr}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.length, 9);
    for (const row of result.body) {
      assert.equal(row.workingTimeOptional, optionalIds.has(row._id));
      assert.equal(row.hasWorkingTimeEntry, false);
    }
    assert.equal(result.body.find(row => row.auftragNr === 9310002).auftrag.isPseudo, true);
  });

  it('lists only the employee’s current monitor confirmations and persists each ordered step', async () => {
    const listed = await request('/neuigkeiten');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.items.length, 1);
    assert.equal(listed.body.items[0].einsatz.id, String(assignment._id));
    assert.equal(listed.body.items[0].confirmation.currentStep.key, 'einsatzzeitenGelesen');
    assert.equal((await request('/neuigkeiten', { email: other.email })).body.items.length, 0);

    assert.equal((await request(`/neuigkeiten/einsatzbestaetigungen/${assignment._id}/ankunftspuffer`, { method: 'POST' })).status, 409);
    assert.equal((await request(`/neuigkeiten/einsatzbestaetigungen/${assignment._id}/einsatzzeitenGelesen`, { method: 'POST' })).status, 200);
    assert.equal((await request(`/neuigkeiten/einsatzbestaetigungen/${assignment._id}/einsatzkleidung`, { method: 'POST' })).status, 200);
    const completed = await request(`/neuigkeiten/einsatzbestaetigungen/${assignment._id}/ankunftspuffer`, { method: 'POST' });
    assert.deepEqual(completed.body, { completed: true, nextStep: null });

    const saved = await Einsatz.findById(assignment._id).lean();
    assert.equal(saved.bestaetigt, true);
    assert.ok(saved.bestaetigung.einsatzzeitenGelesenAt);
    assert.ok(saved.bestaetigung.einsatzkleidungAt);
    assert.ok(saved.bestaetigung.ankunftspufferAt);
    assert.ok(saved.bestaetigung.completedAt);
    assert.equal((await request('/neuigkeiten')).body.items.length, 0);
    assert.equal((await request(`/neuigkeiten/einsatzbestaetigungen/${assignment._id}/einsatzzeitenGelesen`, { method: 'POST', email: other.email })).status, 404);
  });

  it('resets only required confirmations and keeps the completed acknowledgement as history', async () => {
    const now = new Date();
    await Einsatz.updateOne({ _id: assignment._id }, {
      $set: {
        bestaetigt: true,
        bestaetigung: {
          version: 'einsatz-confirmation-v1',
          einsatzzeitenGelesenAt: now,
          einsatzkleidungAt: now,
          ankunftspufferAt: now,
          completedAt: now,
        },
      },
    });
    const untouched = await Einsatz.create({
      auftragNr: 9310001,
      personalNr: 310001,
      source: 'monitor',
      datumVon: new Date(Date.now() + 86400000),
      bestaetigungErforderlich: false,
      bestaetigt: true,
    });

    await invalidateForTimeChange({ _id: { $in: [assignment._id, untouched._id] } });

    const reset = await Einsatz.findById(assignment._id).lean();
    const stillUntouched = await Einsatz.findById(untouched._id).lean();
    assert.equal(reset.bestaetigt, false);
    assert.equal(reset.bestaetigung.completedAt, null);
    assert.equal(reset.bestaetigungsHistorie.length, 1);
    assert.equal(reset.bestaetigungsHistorie[0].invalidatedReason, INVALIDATED_REASON_TIME_CHANGED);
    assert.equal(stillUntouched.bestaetigt, true);
  });

  it('creates the requested tomorrow fixture once as a monitor assignment that triggers confirmation', async () => {
    await Mitarbeiter.collection.insertOne({
      _id: new mongoose.Types.ObjectId(TEST_MITARBEITER_ID),
      personalnr: '310067',
      asana_id: 'public-news-fixture',
      email: 'cedric-fixture@example.test',
      vorname: 'Cedric',
      nachname: 'Fixture',
      isActive: true,
    });

    const fixture = await createTomorrowConfirmationFixture();
    const duplicate = await createTomorrowConfirmationFixture();
    const einsatz = await Einsatz.findById(fixture.einsatzId).lean();
    const auftrag = await Auftrag.findOne({ auftragNr: fixture.auftragNr }).lean();
    const schicht = await Schicht.findById(fixture.schichtId).lean();

    assert.equal(fixture.created, true);
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.einsatzId, fixture.einsatzId);
    assert.equal(auftrag.source, 'monitor');
    assert.equal(schicht.source, 'monitor');
    assert.equal(einsatz.source, 'monitor');
    assert.equal(einsatz.bestaetigungErforderlich, true);
    assert.equal(einsatz.bestaetigt, false);
    assert.equal(new Date(einsatz.datumVon).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }), new Date(fixture.datum).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }));

    const deleted = await deleteTomorrowConfirmationFixture();
    assert.deepEqual(deleted, { deleted: true, auftragNr: fixture.auftragNr });
    assert.equal(await Auftrag.exists({ auftragNr: fixture.auftragNr }), null);
    assert.equal(await Schicht.exists({ auftragNr: fixture.auftragNr }), null);
    assert.equal(await Einsatz.exists({ auftragNr: fixture.auftragNr }), null);
  });
});
