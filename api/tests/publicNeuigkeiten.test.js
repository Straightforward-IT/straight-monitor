const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Einsatz = require('../models/Event/Einsatz');
const Auftrag = require('../models/Event/Auftrag');
const Schicht = require('../models/Event/Schicht');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
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
    await Promise.all([Einsatz.deleteMany({}), Auftrag.deleteMany({}), Schicht.deleteMany({}), Mitarbeiter.deleteMany({}), Sequence.deleteMany({})]);
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
    assert.equal(new Date(einsatz.datumVon).toDateString(), new Date(fixture.datum).toDateString());

    const deleted = await deleteTomorrowConfirmationFixture();
    assert.deepEqual(deleted, { deleted: true, auftragNr: fixture.auftragNr });
    assert.equal(await Auftrag.exists({ auftragNr: fixture.auftragNr }), null);
    assert.equal(await Schicht.exists({ auftragNr: fixture.auftragNr }), null);
    assert.equal(await Einsatz.exists({ auftragNr: fixture.auftragNr }), null);
  });
});
