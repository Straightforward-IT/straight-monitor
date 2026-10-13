const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const router = require('../routes/events/auftraegeRoutes');
const Auftrag = require('../models/Event/Auftrag');
const Schicht = require('../models/Event/Schicht');
const Einsatz = require('../models/Event/Einsatz');
const Group = require('../models/Event/Auftragsgruppe');
const Submission = require('../models/Event/AuftragEditorSubmission');
const Day = require('../models/Event/AuftragEditorDay');
const Entry = require('../models/Event/AuftragChronikEntry');
const Location = require('../models/System/Location');
const User = require('../models/System/User');
const Kunde = require('../models/Customer/Kunde');
const Einsatzort = require('../models/Event/Einsatzort');
const Adresse = require('../models/System/Adresse');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const R2 = require('../services/integrations/R2Service');
const { shiftWindow } = require('../services/operations/StaffingSuggestionService');
const { addDays, atTime } = require('../utils/orderDay');
const { BATCH_SIZE } = { BATCH_SIZE: 10 };

describe('Staged daily Auftrag editor', function () {
  this.timeout(180000);
  let repl, server, base, user, other, location, customer, site, secondSite, employee, secret;
  let uploads, deleted, oldUpload, oldDelete, oldList, oldDownload;
  const oid = () => new mongoose.Types.ObjectId();
  const tokens = actor => jwt.sign({ user: { id: String(actor._id), role: 'USER' } }, process.env.JWT_SECRET);
  async function request(method, path, body, actor = user) {
    const result = await fetch(`${base}/api/auftraege${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-auth-token': tokens(actor) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: result.status, body: await result.json() };
  }
  const shiftDto = (extra = {}) => ({ clientId: 'service', bezeichnung: 'Service', bedarf: 2,
    uhrzeitVon: '18:00', uhrzeitBis: '23:00', treffpunktOrt: 'Eingang', ...extra });
  const createDto = (extra = {}) => ({ mode: 'create', clientSubmissionId: oid().toString(),
    order: { eventTitel: 'Test Veranstaltung', kundenNr: customer.kundenNr, locationV2: String(location._id),
      einsatzort: String(site._id), day: '2026-10-24', bestelltext: 'Gemeinsame Bestellung' },
    dates: ['2026-10-24'], shifts: [shiftDto()], planning: [], ...extra });
  async function submit(dto) {
    const result = await request('POST', '/editor/submissions', dto);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  }
  async function finish(progress) {
    const orders = [];
    while (progress.status !== 'completed') {
      const response = await request('POST', `/editor/submissions/${progress.id}/process`, {});
      assert.equal(response.status, 200, JSON.stringify(response.body));
      progress = response.body;
      orders.push(...progress.orders);
      if (progress.status === 'incomplete') assert.fail(JSON.stringify(progress));
    }
    return { progress, orders };
  }
  async function editDto(number, changes = {}) {
    const response = await request('GET', `/editor/context/${number}`);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const { order, group } = response.body;
    return { mode: 'edit', clientSubmissionId: oid().toString(), auftragNr: order.auftragNr,
      expectedUpdatedAt: order.updatedAt, planningVersion: order.planningVersion, groupRevision: group?.revision,
      order: { kundenNr: order.kundenNr, locationV2: String(location._id), einsatzort: String(order.einsatzort._id) },
      shifts: [], planning: [], ...changes };
  }
  before(async () => {
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(repl.getUri('auftrag_editor_test'));
    for (const model of Object.values(mongoose.models)) await model.init();
    secret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'editor-local-test-secret';
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/auftraege', router);
    app.use((error, req, res, next) => res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : error.statusCode || 500)
      .json({ message: error.message, code: error.code }));
    server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)); });
    base = `http://127.0.0.1:${server.address().port}`;
    oldUpload = R2.uploadFile; oldDelete = R2.deleteFile; oldList = R2.listObjects; oldDownload = R2.getSignedDownloadUrl;
    R2.uploadFile = async key => { uploads.push(key); };
    R2.deleteFile = async key => { deleted.push(key); };
    R2.listObjects = async () => [];
    R2.getSignedDownloadUrl = async key => `https://example.test/${key}`;
  });
  beforeEach(async () => {
    for (const model of Object.values(mongoose.models)) await model.deleteMany({});
    location = await Location.create({ nameFull: 'Test Hamburg', shortName: 'HH', externalId: '2', isActive: true });
    user = { _id: oid(), name: 'Disponent', email: 'dispatcher@example.test', role: 'USER', roles: ['USER'], locationV2: location._id };
    other = { ...user, _id: oid(), email: 'other@example.test' };
    await User.collection.insertMany([user, other]);
    customer = await Kunde.create({ kundenNr: 123, kundName: 'Testkunde', locationV2: location._id });
    const address = { _id: oid(), strasse: 'Teststraße 1', plz: '20095', ort: 'Hamburg' };
    await Adresse.collection.insertOne(address);
    site = await Einsatzort.create({ kunde: customer._id, adresse: address._id, bezeichnung: 'Saal', isActive: true });
    secondSite = await Einsatzort.create({ kunde: customer._id, adresse: address._id, bezeichnung: 'Halle', isActive: true });
    employee = { _id: oid(), personalnr: '200001', email: 'employee@example.test', asana_id: 'test-editor-employee',
      vorname: 'Anna', nachname: 'Test', isActive: true, locationV2: location._id };
    await Mitarbeiter.collection.insertOne(employee);
    uploads = []; deleted = [];
  });
  after(async () => {
    R2.uploadFile = oldUpload; R2.deleteFile = oldDelete; R2.listObjects = oldList; R2.getSignedDownloadUrl = oldDownload;
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if (repl) await repl.stop();
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
  });

  it('stages without entities, deduplicates nonconsecutive days, preserves overnight and only plans the selected current day', async () => {
    const dto = createDto({ dates: ['2026-10-24', '2026-10-26', '2026-10-24'],
      order: { ...createDto().order, day: '2026-10-26' },
      shifts: [shiftDto({ uhrzeitVon: '23:00', uhrzeitBis: '03:00' })],
      planning: [{ type: 'assign', clientShiftId: 'service', mitarbeiterId: String(employee._id) }] });
    const submitted = await submit(dto);
    assert.equal(submitted.total, 2);
    assert.equal(await Auftrag.countDocuments(), 0);
    assert.equal(await Schicht.countDocuments(), 0);
    const result = await finish(submitted);
    assert.equal(result.orders.length, 2);
    assert.equal(new Set(result.orders.map(order => order.monitorId)).size, 2);
    const dailyOrders = await Auftrag.find().sort({ day: 1 }).lean();
    const assignments = await Einsatz.find().lean();
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].auftragNr, dailyOrders[1].auftragNr);
    const shift = await Schicht.findOne({ auftragNr: dailyOrders[0].auftragNr }).lean();
    assert.equal(shift.endDayOffset, 1);
    const window = shiftWindow(shift);
    // Overnight through the fall-back DST boundary has five actual hours.
    assert.equal(window.end - window.start, 5 * 3600000);
    assert.equal((await Group.findOne()).bestelltext, 'Gemeinsame Bestellung');
    assert.equal(await Entry.countDocuments(), 2);
    const context = await request('GET', `/editor/context/${dailyOrders[0].auftragNr}`);
    assert.equal(context.body.group.shifts[0].groupShiftKey, shift.groupShiftKey);
    assert.equal(context.body.order.bestelltext, 'Gemeinsame Bestellung');
  });

  it('processes more than 90 dates in bounded durable batches and never duplicates a retried submission/process', async () => {
    const dates = Array.from({ length: 91 }, (_, index) => addDays('2026-10-24', index));
    const dto = createDto({ dates });
    let submitted = await submit(dto);
    assert.equal(submitted.total, 91);
    assert.equal(await Day.countDocuments(), 91);
    assert.equal((await Group.findOne()).toObject().members, undefined);
    assert.equal((await submit(dto)).id, submitted.id);
    let batches = 0;
    while (submitted.status !== 'completed') {
      const response = await request('POST', `/editor/submissions/${submitted.id}/process`, {});
      assert.equal(response.status, 200);
      submitted = response.body;
      assert.notEqual(submitted.status, 'incomplete', JSON.stringify(submitted.errors));
      assert.ok(submitted.orders.length <= BATCH_SIZE);
      batches += 1;
    }
    assert.equal(batches, 10);
    assert.equal(await Auftrag.countDocuments(), 91);
    assert.equal(await Schicht.countDocuments(), 91);
    assert.equal(await Entry.countDocuments(), 91);
    const repeat = await request('POST', `/editor/submissions/${submitted.id}/process`, {});
    assert.equal(repeat.body.completed, 91);
    assert.deepEqual(repeat.body.orders, []);
    assert.equal(await Entry.countDocuments(), 91);
    const page = await request('GET', `/editor/context/${(await Auftrag.findOne()).auftragNr}`);
    assert.equal(page.body.members.length, 50);
    const next = await request('GET', `/editor/context/${page.body.order.auftragNr}?cursor=${page.body.nextCursor}`);
    assert.equal(next.body.members.length, 41);
    const dtoEdit = await editDto(page.body.order.auftragNr, { shifts: [{
      _id: page.body.order.schichten[0]._id, clientId: 'service', overrides: [], bedarf: 3,
    }] });
    const revision = (await Group.findOne()).revision;
    const beforeReview = [await Submission.countDocuments(), await Day.countDocuments(), await Entry.countDocuments()];
    const reviewed = await request('POST', '/editor/review', dtoEdit);
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.totalAffected, 91);
    assert.equal(reviewed.body.orders.length, 50);
    assert.ok(reviewed.body.orders.every(order => order.changes.some(change => change.key.endsWith(':bedarf')
      && change.before === 2 && change.after === 3)));
    const reviewPage = await request('POST', `/editor/review?cursor=${reviewed.body.nextCursor}`, dtoEdit);
    assert.equal(reviewPage.body.orders.length, 41);
    assert.deepEqual([await Submission.countDocuments(), await Day.countDocuments(), await Entry.countDocuments()], beforeReview);
    assert.equal((await Group.findOne()).revision, revision);
    assert.equal((await Schicht.findOne()).bedarf, 2);
  });

  it('rolls back failed batches including audit, keeps previous batches, guards pending groups and resumes only unfinished days', async () => {
    const dates = Array.from({ length: 12 }, (_, index) => addDays('2026-10-24', index));
    const submitted = await submit(createDto({ dates }));
    const first = await request('POST', `/editor/submissions/${submitted.id}/process`, {});
    assert.equal(first.body.completed, 10);
    const order = first.body.orders[0];
    const blocked = await request('PATCH', `/${order.auftragNr}`, { eventTitel: 'Blocked' });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'GROUP_PENDING');
    const original = Entry.create;
    Entry.create = async () => { throw new Error('Injected audit failure'); };
    let failure;
    try { failure = await request('POST', `/editor/submissions/${submitted.id}/process`, {}); }
    finally { Entry.create = original; }
    assert.equal(failure.body.status, 'incomplete');
    assert.equal(failure.body.failedDays.length, 2);
    assert.equal(failure.body.completed, 10);
    assert.equal(await Auftrag.countDocuments(), 10);
    assert.equal(await Schicht.countDocuments(), 10);
    assert.equal(await Entry.countDocuments(), 10);
    const reopened = await request('GET', `/editor/context/${order.auftragNr}`);
    assert.equal(reopened.body.pendingSubmission.id, submitted.id);
    assert.equal(reopened.body.pendingSubmission.completed, 10);
    assert.equal(reopened.body.pendingSubmission.failedDays.length, 2);
    const resumed = await finish(failure.body);
    assert.equal(resumed.progress.completed, 12);
    assert.equal(await Auftrag.countDocuments(), 12);
    assert.equal(await Entry.countDocuments(), 12);
    assert.equal((await Group.findOne()).status, 'completed');
    assert.equal((await request('GET', `/editor/submissions/${submitted.id}`, undefined, other)).status, 404);
  });

  it('propagates only dirty inherited fields; preserves zero/empty/equal explicit day overrides and explicit reset', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'] })));
    const secondShift = orders[1].schichten[0];
    const local = await editDto(orders[1].auftragNr, { shifts: [{ _id: secondShift._id, clientId: 'service',
      overrides: ['bedarf', 'treffpunktOrt'], bedarf: 0, treffpunktOrt: '' }],
    });
    await finish(await submit(local));
    const mainShift = orders[0].schichten[0];
    const shared = await editDto(orders[0].auftragNr, { shifts: [{ _id: mainShift._id, clientId: 'service',
      overrides: [], bedarf: 5, treffpunktOrt: 'Nord' }] });
    await finish(await submit(shared));
    const inherited = await Schicht.findById(mainShift._id).lean();
    const overridden = await Schicht.findById(secondShift._id).lean();
    assert.equal(inherited.bedarf, 5);
    assert.equal(overridden.bedarf, 0);
    assert.equal(overridden.treffpunktOrt, '');
    assert.deepEqual(overridden.overrides, ['bedarf', 'treffpunktOrt']);
    const equalValue = await editDto(orders[1].auftragNr, { shifts: [{ _id: secondShift._id, clientId: 'service',
      overrides: ['bedarf', 'treffpunktOrt'], bedarf: 5 }] });
    await finish(await submit(equalValue));
    const nextShared = await editDto(orders[0].auftragNr, { shifts: [{ _id: mainShift._id, clientId: 'service',
      overrides: [], bedarf: 6 }] });
    await finish(await submit(nextShared));
    assert.equal((await Schicht.findById(secondShift._id)).bedarf, 5);
    const reset = await editDto(orders[1].auftragNr, { shifts: [{ _id: secondShift._id, clientId: 'service', overrides: [] }] });
    await finish(await submit(reset));
    assert.equal((await Schicht.findById(secondShift._id)).bedarf, 6);
    assert.equal((await Schicht.findById(secondShift._id)).treffpunktOrt, 'Nord');
  });

  it('supports day-only additions/suppression and common structural addition/deletion without cloning staff', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'] })));
    const extra = await editDto(orders[0].auftragNr, { shifts: [shiftDto({ clientId: 'extra', dayOnly: true })] });
    await finish(await submit(extra));
    assert.equal(await Schicht.countDocuments({ auftragNr: orders[0].auftragNr }), 2);
    assert.equal(await Schicht.countDocuments({ auftragNr: orders[1].auftragNr }), 1);
    const added = await editDto(orders[0].auftragNr, { shifts: [shiftDto({ clientId: 'common-new' })] });
    await finish(await submit(added));
    assert.equal(await Schicht.countDocuments({ auftragNr: orders[1].auftragNr }), 2);
    const original = orders[0].schichten[0];
    const suppress = await editDto(orders[0].auftragNr, { shifts: [{ _id: original._id, clientId: 'service', deleted: true, dayOnly: true }] });
    await finish(await submit(suppress));
    assert.equal(await Schicht.countDocuments({ auftragNr: orders[0].auftragNr, groupShiftKey: original.groupShiftKey }), 0);
    assert.equal(await Schicht.countDocuments({ auftragNr: orders[1].auftragNr, groupShiftKey: original.groupShiftKey }), 1);
    const remove = await editDto(orders[1].auftragNr, { shifts: [{ _id: orders[1].schichten[0]._id, clientId: 'service', deleted: true }] });
    await finish(await submit(remove));
    assert.equal(await Schicht.countDocuments({ groupShiftKey: original.groupShiftKey }), 0);
    assert.equal(await Einsatz.countDocuments(), 0);
  });

  it('adds a new shift through standalone edit without requiring a groupShiftKey', async () => {
    const { orders } = await finish(await submit(createDto()));
    const originalId = orders[0].schichten[0]._id;
    const dto = await editDto(orders[0].auftragNr, { shifts: [
      shiftDto({ clientId: 'standalone-new', bezeichnung: 'Zusätzliche Schicht', bedarf: 0 }),
    ] });
    const reviewed = await request('POST', '/editor/review', dto);
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.totalAffected, 1);
    const saved = await finish(await submit(dto));
    assert.equal(saved.orders[0].schichten.length, 2);
    assert.ok(saved.orders[0].schichten.some(shift => shift._id === originalId));
    const added = saved.orders[0].schichten.find(shift => shift.clientId === 'standalone-new');
    assert.equal(added.bedarf, 0);
    assert.equal(added.groupShiftKey, undefined);
    assert.equal(await Group.countDocuments(), 0);
  });

  it('seeds new edit common shifts from commonShifts while applying main-day overrides only to that day', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'] })));
    const dto = await editDto(orders[0].auftragNr, {
      commonShifts: [shiftDto({ clientId: 'common-new', bezeichnung: 'Gemeinsame neue Schicht', bedarf: 4, overrides: [] })],
      shifts: [shiftDto({ clientId: 'common-new', bezeichnung: 'Gemeinsame neue Schicht',
        bedarf: 0, overrides: ['bedarf'] })],
    });
    const reviewed = await request('POST', '/editor/review', dto);
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.totalAffected, 2);
    assert.ok(reviewed.body.orders.find(order => order.auftragNr === orders[0].auftragNr)
      .changes.some(change => change.key.endsWith(':bedarf') && change.after === 0));
    assert.ok(reviewed.body.orders.find(order => order.auftragNr === orders[1].auftragNr)
      .changes.some(change => change.key.endsWith(':bedarf') && change.after === 4));
    await finish(await submit(dto));
    const main = await Schicht.findOne({ auftragNr: orders[0].auftragNr, clientId: 'common-new' }).lean();
    const sibling = await Schicht.findOne({ auftragNr: orders[1].auftragNr, groupShiftKey: main.groupShiftKey }).lean();
    assert.equal(main.bedarf, 0);
    assert.deepEqual(main.overrides, ['bedarf']);
    assert.equal(sibling.bedarf, 4);
    assert.deepEqual(sibling.overrides, []);
    assert.equal((await Group.findOne()).shiftDefaults.find(definition => definition.key === main.groupShiftKey).fields.bedarf, 4);
    assert.equal(await Einsatz.countDocuments(), 0);
  });

  it('keeps a new day-only edit shift local even when a matching common seed is supplied', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'] })));
    const dto = await editDto(orders[0].auftragNr, {
      commonShifts: [shiftDto({ clientId: 'local-new', bedarf: 4, overrides: [] })],
      shifts: [shiftDto({ clientId: 'local-new', dayOnly: true, bedarf: 0, overrides: ['bedarf'] })],
    });
    const saved = await finish(await submit(dto));
    assert.equal(saved.progress.total, 1);
    const local = await Schicht.findOne({ auftragNr: orders[0].auftragNr, clientId: 'local-new' }).lean();
    assert.equal(local.bedarf, 0);
    assert.equal(local.groupShiftKey, undefined);
    assert.equal(await Schicht.countDocuments({ auftragNr: orders[1].auftragNr }), 1);
    assert.equal((await Group.findOne()).shiftDefaults.length, 1);
  });

  it('saves zero-shift standalone and linked drafts and edits them without relaxing release validation', async () => {
    for (const dates of [['2026-10-24'], ['2026-10-24', '2026-10-26']]) {
      const { orders } = await finish(await submit(createDto({ dates, shifts: [], commonShifts: [] })));
      assert.equal(orders.length, dates.length);
      assert.ok(orders.every(order => order.schichten.length === 0 && order.auftStatus === 1));
      const dto = await editDto(orders[0].auftragNr);
      dto.order.eventTitel = 'Überarbeiteter Entwurf ohne Schichten';
      const reviewed = await request('POST', '/editor/review', dto);
      assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
      const saved = await finish(await submit(dto));
      assert.equal(saved.orders[0].schichten.length, 0);
      assert.equal(saved.orders[0].eventTitel, dto.order.eventTitel);
      const released = await request('POST', `/${orders[0].auftragNr}/release`, {
        planningVersion: saved.orders[0].planningVersion,
      });
      assert.equal(released.status, 422, JSON.stringify(released.body));
      assert.ok(released.body.errors.some(error => error.field === 'schichten'));
    }
    assert.equal(await Schicht.countDocuments(), 0);
    assert.equal(await Einsatz.countDocuments(), 0);
  });

  it('allows removing the last shift from a draft without requiring replacement staffing', async () => {
    for (const dates of [['2026-10-24'], ['2026-10-24', '2026-10-26']]) {
      const { orders } = await finish(await submit(createDto({ dates })));
      const dto = await editDto(orders[0].auftragNr, { shifts: [{
        _id: orders[0].schichten[0]._id, clientId: 'service', deleted: true,
      }] });
      const saved = await finish(await submit(dto));
      assert.ok(saved.orders.every(order => order.schichten.length === 0 && order.auftStatus === 1));
      assert.equal(saved.progress.total, dates.length);
    }
    assert.equal(await Schicht.countDocuments(), 0);
  });

  it('rejects fixed-customer changes and missing/mismatched sites, while trusted writes and legacy/Pseudo reading still work', async () => {
    await Kunde.create({ kundenNr: 456, kundName: 'Anderer Kunde', locationV2: location._id });
    const dto = createDto();
    const noSite = await request('POST', '/editor/submissions', { ...dto, order: { ...dto.order, einsatzort: null } });
    assert.equal(noSite.status, 400);
    const { orders } = await finish(await submit(dto));
    const order = orders[0];
    assert.equal((await request('PATCH', `/${order.auftragNr}`, { kundenNr: 456 })).status, 400);
    const edit = await editDto(order.auftragNr);
    assert.equal((await request('POST', '/editor/submissions', { ...edit,
      order: { ...edit.order, kundenNr: 456 } })).status, 400);
    await Auftrag.updateOne({ auftragNr: order.auftragNr }, { $set: { kundenNr: 456 } });
    assert.equal((await Auftrag.findOne({ auftragNr: order.auftragNr })).kundenNr, 456);
    assert.equal((await request('PATCH', `/${order.auftragNr}`, { eventTitel: 'Mismatch' })).status, 400);
    const legacy = await Auftrag.create({ auftragNr: 1000, kundenNr: customer.kundenNr, locationV2: location._id,
      eventTitel: 'Legacy', vonDatum: '2026-09-01', bisDatum: '2026-09-03', eventStrasse: 'Straße', eventPlz: '12345', eventOrt: 'Ort' });
    const before = legacy.updatedAt.getTime();
    const read = await request('GET', '/editor/context/1000');
    assert.equal(read.status, 200);
    assert.equal((await Auftrag.findById(legacy._id)).updatedAt.getTime(), before);
    assert.equal((await request('PATCH', '/1000', { eventTitel: 'Edit' })).status, 400);
    assert.equal((await request('POST', '/1000/release', { planningVersion: 0 })).status, 400);
    await Auftrag.updateOne({ _id: legacy._id }, { $set: { isPseudo: true } });
    assert.equal((await request('PATCH', '/1000', { eventTitel: 'Pseudo edit' })).status, 200);
  });

  it('supports editing legacy imported multi-day records without splitting or imposing a new day identity', async () => {
    const legacy = await Auftrag.create({ auftragNr: 1000, kundenNr: customer.kundenNr, einsatzort: site._id,
      locationV2: location._id, eventTitel: 'Legacy', vonDatum: '2026-09-01', bisDatum: '2026-09-03', auftStatus: 2 });
    const shift = await Schicht.create({ auftragNr: 1000, datumVon: '2026-09-02', datumBis: '2026-09-03',
      bezeichnung: 'Legacy shift', uhrzeitVon: '23:00', uhrzeitBis: '03:00', bedarf: 1 });
    const edit = await editDto(1000, { shifts: [{ _id: String(shift._id), clientId: 'legacy', overrides: [], treffpunktOrt: 'West' }] });
    await finish(await submit(edit));
    assert.equal((await Auftrag.findById(legacy._id)).day, undefined);
    assert.equal((await Schicht.findById(shift._id)).datumVon.toISOString(), '2026-09-02T00:00:00.000Z');
    assert.equal(await Auftrag.countDocuments(), 1);
  });

  it('exposes imported site mismatches read-only and permits explicit day-site repair without freezing trusted customer corrections', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'] })));
    const correctedCustomer = await Kunde.create({ kundenNr: 456, kundName: 'Korrigierter Kunde', locationV2: location._id });
    const correctedSite = await Einsatzort.create({ kunde: correctedCustomer._id, bezeichnung: 'Korrigierter Einsatzort' });
    await Auftrag.updateOne({ auftragNr: orders[0].auftragNr }, { $set: { kundenNr: correctedCustomer.kundenNr } });
    const before = (await Auftrag.findOne({ auftragNr: orders[0].auftragNr })).updatedAt;
    const context = await request('GET', `/editor/context/${orders[0].auftragNr}`);
    assert.equal(context.body.order.einsatzortValid, false);
    assert.equal(context.body.order.groupCustomerMismatch, true);
    assert.equal((await Auftrag.findOne({ auftragNr: orders[0].auftragNr })).updatedAt.getTime(), before.getTime());
    const dto = await editDto(orders[0].auftragNr);
    dto.order = { ...dto.order, einsatzort: String(correctedSite._id), einsatzortOverride: true };
    await finish(await submit(dto));
    assert.equal((await Auftrag.findOne({ auftragNr: orders[0].auftragNr })).kundenNr, 456);
    assert.equal((await Auftrag.findOne({ auftragNr: orders[1].auftragNr })).kundenNr, customer.kundenNr);
    assert.equal((await Group.findOne()).kundenNr, customer.kundenNr);
    const repaired = await request('GET', `/editor/context/${orders[0].auftragNr}`);
    assert.equal(repaired.body.order.einsatzortValid, true);
    assert.equal(repaired.body.order.einsatzortIssue, null);
  });

  it('normalizes role keys without false inherited changes and rejects malformed information before staging writes', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'],
      shifts: [shiftDto({ berufSchl: 1, qualSchl: 2 })] })));
    const noop = await editDto(orders[0].auftragNr);
    assert.equal((await request('POST', '/editor/submissions', noop)).status, 400);
    const invalid = await editDto(orders[0].auftragNr, { shifts: [{ _id: orders[0].schichten[0]._id,
      clientId: 'service', overrides: [], einsatzinformationSourceHtml: '<p>{{unbekannt}}</p>' }] });
    const result = await request('POST', '/editor/submissions', invalid);
    assert.equal(result.status, 400);
    assert.equal(result.body.code, 'INFORMATION_INVALID');
    assert.equal((await Group.findOne()).activeSubmission, null);
  });

  it('keeps creation defaults separate from overridden main-day fields and honors other days staffing', async () => {
    const common = shiftDto();
    const selected = shiftDto({ overrides: ['bedarf', 'treffpunktOrt'], bedarf: 0, treffpunktOrt: '' });
    const baseDto = createDto();
    const dto = { ...baseDto, dates: ['2026-10-24', '2026-10-26'], commonShifts: [common], shifts: [selected],
      commonOrder: { einsatzort: String(site._id), bestelltext: 'Gemeinsame Bestellung' },
      order: { ...baseDto.order, day: '2026-10-26', einsatzort: String(secondSite._id),
        einsatzortOverride: true, bestelltext: '', bestelltextOverride: true },
      planning: [{ type: 'assign', clientShiftId: 'service', mitarbeiterId: String(employee._id) }],
      dayOverrides: [{ day: '2026-10-24', planning: [{ type: 'assign', clientShiftId: 'service', mitarbeiterId: String(employee._id) }] }],
    };
    const { orders } = await finish(await submit(dto));
    const main = orders.find(order => order.day === '2026-10-26');
    const sibling = orders.find(order => order.day === '2026-10-24');
    assert.equal(main.schichten[0].bedarf, 0);
    assert.equal(main.schichten[0].treffpunktOrt, '');
    assert.equal(main.bestelltext, '');
    assert.equal(main.einsatzort._id, String(secondSite._id));
    assert.equal(sibling.schichten[0].bedarf, 2);
    assert.equal(sibling.bestelltext, 'Gemeinsame Bestellung');
    assert.equal(sibling.einsatzort._id, String(site._id));
    assert.equal(await Einsatz.countDocuments(), 2);
    assert.equal((await Group.findOne()).shiftDefaults[0].fields.bedarf, 2);
  });

  it('revalidates stale shifts and renders per-day information while propagating real time changes and invalidating confirmation', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'],
      shifts: [shiftDto({ einsatzinformationSourceHtml: '<p>{{schicht.datum}} {{schicht.zeitraum}}</p>',
        einsatzinformationCustomized: true })],
      planning: [{ type: 'assign', clientShiftId: 'service', mitarbeiterId: String(employee._id) }],
    })));
    assert.notEqual(orders[0].schichten[0].einsatzinformation.renderedHtml, orders[1].schichten[0].einsatzinformation.renderedHtml);
    const assignment = await Einsatz.findOne();
    await Einsatz.updateOne({ _id: assignment._id }, { $set: { bestaetigt: true,
      bestaetigung: { version: 'test-version', completedAt: new Date() } } });
    const dto = await editDto(orders[0].auftragNr, { shifts: [{ _id: orders[0].schichten[0]._id,
      clientId: 'service', overrides: [], uhrzeitVon: '19:00', uhrzeitBis: '02:00', endDayOffset: 1 }] });
    const reviewed = await request('POST', '/editor/review', dto);
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.totalAffected, 2);
    assert.ok(reviewed.body.orders[0].changes.some(change => change.key.includes('renderedHtml')));
    await finish(await submit(dto));
    const updated = await Einsatz.findById(assignment._id);
    assert.equal(updated.uhrzeitVon, '19:00');
    assert.equal(updated.endDayOffset, 1);
    assert.equal(updated.bestaetigt, false);
    assert.equal(updated.bestaetigungsHistorie.length, 1);
    assert.equal(await Einsatz.countDocuments(), 1);
    const stale = await editDto(orders[0].auftragNr, { shifts: [{ _id: orders[0].schichten[0]._id,
      clientId: 'service', overrides: [], treffpunktOrt: 'Reviewed' }] });
    const submission = await submit(stale);
    await Schicht.updateOne({ _id: orders[1].schichten[0]._id }, { $set: { treffpunktOrt: 'Imported' } });
    const response = await request('POST', `/editor/submissions/${submission.id}/process`, {});
    assert.equal(response.body.status, 'incomplete');
    assert.ok(response.body.errors.some(error => error.code === 'SHIFT_STALE'));
    assert.equal((await Schicht.findById(orders[1].schichten[0]._id)).treffpunktOrt, 'Imported');
  });

  it('rejects empty/stale/idempotency-conflicting submissions and stale batch changes without overwriting data', async () => {
    const { orders } = await finish(await submit(createDto()));
    const dto = await editDto(orders[0].auftragNr);
    assert.equal((await request('POST', '/editor/submissions', dto)).status, 400);
    const stale = { ...dto, order: { ...dto.order, eventTitel: 'Reviewed' } };
    const staged = await submit(stale);
    const duplicate = await request('POST', '/editor/submissions', { ...stale, order: { ...stale.order, eventTitel: 'Different' } });
    assert.equal(duplicate.status, 409);
    await Auftrag.updateOne({ auftragNr: dto.auftragNr }, { $set: { eventTitel: 'Concurrent' } });
    const process = await request('POST', `/editor/submissions/${staged.id}/process`, {});
    assert.equal(process.body.status, 'incomplete');
    assert.equal(process.body.errors[0].code, 'ORDER_STALE');
    assert.equal((await Auftrag.findOne({ auftragNr: dto.auftragNr })).eventTitel, 'Concurrent');
    assert.equal((await request('POST', '/editor/submissions', { ...stale, clientSubmissionId: oid().toString() })).status, 409);
  });

  it('has read-only unsaved candidate previews with staged conflicts and honors staged removals', async () => {
    const { orders } = await finish(await submit(createDto({ shifts: [shiftDto(), shiftDto({ clientId: 'other', bezeichnung: 'Andere' })] })));
    const firstShift = orders[0].schichten[0];
    const secondShift = orders[0].schichten[1];
    const counts = [await Auftrag.countDocuments(), await Schicht.countDocuments(), await Einsatz.countDocuments(), await Entry.countDocuments()];
    const preview = await request('POST', '/editor/candidates', {
      auftragNr: orders[0].auftragNr, kundenNr: customer.kundenNr, einsatzort: String(site._id), locationV2: String(location._id),
      schicht: { ...shiftDto({ clientId: 'unsaved', datumVon: '2026-10-24', datumBis: '2026-10-24' }) },
      stagedAssignments: [{ type: 'assign', schichtId: firstShift._id, mitarbeiterId: String(employee._id) }],
    });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.candidates[0].status, 'conflict');
    assert.deepEqual([await Auftrag.countDocuments(), await Schicht.countDocuments(), await Einsatz.countDocuments(), await Entry.countDocuments()], counts);
    const assignment = await Einsatz.create({ auftragNr: orders[0].auftragNr, schicht: firstShift._id,
      personalNr: Number(employee.personalnr), datumVon: firstShift.datumVon, datumBis: firstShift.datumBis,
      uhrzeitVon: '18:00', uhrzeitBis: '23:00', day: '2026-10-24', endDayOffset: 0 });
    const removals = await request('POST', '/editor/candidates', {
      auftragNr: orders[0].auftragNr, schicht: { _id: secondShift._id, clientId: 'other' },
      stagedAssignments: [{ type: 'remove', einsatzId: String(assignment._id) }],
    });
    assert.equal(removals.status, 200, JSON.stringify(removals.body));
    assert.equal(removals.body.candidates[0].conflicts.length, 0);
    assert.equal(await Einsatz.countDocuments(), 1);
  });

  it('validates scheduling conflicts between different staged dates and rejects nonexistent DST times', async () => {
    const dto = createDto({ dates: ['2026-10-24', '2026-10-25'],
      shifts: [shiftDto({ uhrzeitVon: '18:00', uhrzeitBis: '20:00', endDayOffset: 1 })],
      planning: [{ type: 'assign', clientShiftId: 'service', mitarbeiterId: String(employee._id) }],
      dayOverrides: [{ day: '2026-10-25', planning: [{ type: 'assign', clientShiftId: 'service', mitarbeiterId: String(employee._id) }] }],
    });

    it('previews cached linked-day operations with partial embedded shift DTOs and true cross-day windows without writes', async () => {
      const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-25'],
        shifts: [shiftDto({ uhrzeitVon: '18:00', uhrzeitBis: '20:00', endDayOffset: 1 })] })));
      const preview = await request('POST', '/editor/candidates', {
        auftragNr: orders[0].auftragNr, schicht: { _id: orders[0].schichten[0]._id, clientId: 'service' },
        stagedAssignments: [{ type: 'assign', auftragNr: orders[1].auftragNr, day: orders[1].day,
          schichtId: orders[1].schichten[0]._id, mitarbeiterId: String(employee._id),
          schicht: { _id: orders[1].schichten[0]._id, clientId: 'service', uhrzeitVon: '19:00' } }],
      });
      assert.equal(preview.status, 200, JSON.stringify(preview.body));
      assert.equal(preview.body.candidates[0].status, 'conflict');
      assert.equal(await Einsatz.countDocuments(), 0);
    });
    const conflict = await request('POST', '/editor/submissions', dto);
    assert.equal(conflict.status, 409, JSON.stringify(conflict.body));
    assert.equal(conflict.body.code, 'PLANNING_CONFLICT');
    assert.equal(await Submission.countDocuments(), 0);
    assert.equal(await Group.countDocuments(), 0);
    assert.throws(() => atTime('2026-03-29', '02:30'), /existiert/);
    assert.equal(shiftWindow({ day: '2026-12-31', endDayOffset: 1, uhrzeitVon: '23:00', uhrzeitBis: '02:00' }).end.toISOString(), '2027-01-01T01:00:00.000Z');
  });

  it('shares Bestellung notes/sites with explicit day overrides and reset without changing customer', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'] })));
    const local = await editDto(orders[1].auftragNr);
    local.order = { ...local.order, bestelltext: '', bestelltextOverride: true, einsatzort: String(secondSite._id), einsatzortOverride: true };
    await finish(await submit(local));
    const common = await editDto(orders[0].auftragNr);
    common.order = { ...common.order, bestelltext: 'Neue gemeinsame Bestellung' };
    await finish(await submit(common));
    assert.equal((await Auftrag.findOne({ auftragNr: orders[0].auftragNr })).bestelltext, 'Neue gemeinsame Bestellung');
    assert.equal((await Auftrag.findOne({ auftragNr: orders[1].auftragNr })).bestelltext, '');
    const reset = await editDto(orders[1].auftragNr);
    reset.order.bestelltextOverride = false; reset.order.einsatzortOverride = false;
    await finish(await submit(reset));
    const restored = await Auftrag.findOne({ auftragNr: orders[1].auftragNr });
    assert.equal(restored.bestelltext, 'Neue gemeinsame Bestellung');
    assert.equal(String(restored.einsatzort), String(site._id));
  });

  it('creates shared title/reference/order-date/note defaults with independent per-day overrides', async () => {
    const dates = ['2026-10-24', '2026-10-26', '2026-10-28', '2026-10-30'];
    const shared = { eventTitel: 'Gemeinsamer Titel', referenz: 'REF-COMMON', bestDatum: '2026-10-01',
      bestelltext: 'Gemeinsame Notiz', einsatzort: String(site._id) };
    const base = createDto();
    const { orders } = await finish(await submit({ ...base, dates, shifts: [], commonShifts: [],
      commonOrder: { ...shared, eventTitel: ` ${shared.eventTitel} `, referenz: ` ${shared.referenz} ` },
      order: { ...base.order, eventTitel: 'Lokaler Titel', eventTitelOverride: true },
      dayOverrides: [
        { day: dates[1], order: { referenz: '', referenzOverride: true } },
        { day: dates[2], order: { bestDatum: null, bestDatumOverride: true } },
        { day: dates[3], order: { bestelltext: '', bestelltextOverride: true } },
      ],
    }));
    const fields = ['eventTitel', 'referenz', 'bestDatum', 'bestelltext'];
    for (const [index, field] of fields.entries()) {
      assert.equal(orders[index][`${field}Override`], true);
      for (const otherField of fields.filter(value => value !== field)) {
        assert.equal(orders[index][`${otherField}Override`], false);
        assert.equal(orders[index][otherField], otherField === 'bestDatum'
          ? '2026-10-01T00:00:00.000Z' : shared[otherField]);
      }
    }
    assert.equal(orders[0].eventTitel, 'Lokaler Titel');
    assert.equal(orders[1].referenz, '');
    assert.equal(orders[2].bestDatum, null);
    assert.equal(orders[3].bestelltext, '');
    const context = await request('GET', `/editor/context/${orders[2].auftragNr}`);
    for (const field of fields) {
      assert.equal(context.body.group[field], field === 'bestDatum' ? '2026-10-01T00:00:00.000Z' : shared[field]);
    }
    assert.equal((await Group.findOne()).kundenNr, customer.kundenNr);
  });

  it('synchronizes all four order fields independently, reviews exact inherited changes and restores inheritance', async () => {
    const fields = ['eventTitel', 'referenz', 'bestDatum', 'bestelltext'];
    const original = { eventTitel: 'Gemeinsamer Titel', referenz: 'REF-OLD', bestDatum: '2026-10-01', bestelltext: 'Gemeinsame Notiz' };
    const base = createDto();
    const { orders } = await finish(await submit({ ...base, dates: ['2026-10-24', '2026-10-26', '2026-10-28'],
      order: { ...base.order, ...original }, shifts: [], commonShifts: [] }));
    const localValues = { eventTitel: 'Lokaler Titel', referenz: '', bestDatum: null, bestelltext: '' };
    for (const field of fields) {
      const dto = await editDto(orders[1].auftragNr);
      dto.order[field] = localValues[field];
      dto.order[`${field}Override`] = true;
      const saved = await finish(await submit(dto));
      assert.equal(saved.progress.total, 1);
      assert.equal(saved.orders[0][field], localValues[field]);
      assert.equal(saved.orders[0][`${field}Override`], true);
      const common = await Group.findOne().lean();
      assert.equal(field === 'bestDatum' ? common[field].toISOString() : common[field],
        field === 'bestDatum' ? '2026-10-01T00:00:00.000Z' : original[field]);
    }
    const changes = { eventTitel: 'Neuer gemeinsamer Titel', referenz: 'REF-NEW', bestDatum: '2026-10-02', bestelltext: 'Neue gemeinsame Notiz' };
    const sharedEdit = await editDto(orders[0].auftragNr);
    Object.assign(sharedEdit.order, changes);
    const reviewed = await request('POST', '/editor/review', sharedEdit);
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.totalAffected, 2);
    for (const order of reviewed.body.orders) {
      assert.notEqual(order.auftragNr, orders[1].auftragNr);
      for (const field of fields) {
        const change = order.changes.find(item => item.key.endsWith(`:${field}`));
        assert.equal(change.before, field === 'bestDatum' ? '2026-10-01T00:00:00.000Z' : original[field]);
        assert.equal(change.after, field === 'bestDatum' ? '2026-10-02T00:00:00.000Z' : changes[field]);
      }
    }
    await finish(await submit(sharedEdit));
    const untouchedLocal = await Auftrag.findOne({ auftragNr: orders[1].auftragNr }).lean();
    for (const field of fields) assert.equal(untouchedLocal[field], localValues[field]);
    const reset = await editDto(orders[1].auftragNr);
    Object.assign(reset.order, Object.fromEntries(fields.map(field => [`${field}Override`, false])));
    const resetReview = await request('POST', '/editor/review', reset);
    assert.equal(resetReview.status, 200, JSON.stringify(resetReview.body));
    assert.equal(resetReview.body.totalAffected, 1);
    for (const field of fields) assert.ok(resetReview.body.orders[0].changes.some(change =>
      change.key.endsWith(`:${field}Override`) && change.before === true && change.after === false));
    const restored = await finish(await submit(reset));
    for (const field of fields) {
      assert.equal(restored.orders[0][field], field === 'bestDatum' ? '2026-10-02T00:00:00.000Z' : changes[field]);
      assert.equal(restored.orders[0][`${field}Override`], false);
    }
    const lastEntry = await Entry.findOne({ auftragNr: orders[1].auftragNr }).sort({ createdAt: -1, _id: -1 }).lean();
    for (const field of fields) assert.ok(lastEntry.changes[0].fields.some(item => item.field === `${field}Override`));
  });

  it('preserves equal-value title overrides, nullable references and empty date overrides and rejects linked-field bypasses', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'], shifts: [] })));
    const override = await editDto(orders[1].auftragNr);
    Object.assign(override.order, { eventTitel: orders[1].eventTitel, eventTitelOverride: true,
      referenz: null, referenzOverride: true, bestDatum: '', bestDatumOverride: true });
    const saved = await finish(await submit(override));
    assert.equal(saved.orders[0].eventTitelOverride, true);
    assert.equal(saved.orders[0].referenz, null);
    assert.equal(saved.orders[0].referenzOverride, true);
    assert.equal(saved.orders[0].bestDatum, null);
    assert.equal(saved.orders[0].bestDatumOverride, true);
    const sharedEdit = await editDto(orders[0].auftragNr);
    Object.assign(sharedEdit.order, { eventTitel: 'Anderer gemeinsamer Titel', referenz: 'Neue Referenz', bestDatum: '2026-10-03' });
    await finish(await submit(sharedEdit));
    const local = await request('GET', `/editor/context/${orders[1].auftragNr}`);
    assert.equal(local.body.order.eventTitel, orders[1].eventTitel);
    assert.equal(local.body.order.referenz, null);
    assert.equal(local.body.order.bestDatum, null);
    for (const field of ['eventTitel', 'referenz', 'bestDatum', 'eventTitelOverride', 'referenzOverride', 'bestDatumOverride']) {
      const result = await request('PATCH', `/${orders[0].auftragNr}`, { [field]: field.endsWith('Override') ? true : '2026-10-04' });
      assert.equal(result.status, 409, JSON.stringify(result.body));
      assert.equal(result.body.code, 'GROUP_EDITOR_REQUIRED');
    }
  });

  it('derives legacy defaults deterministically without read/review writes and retains differing member values on unrelated saves', async () => {
    const group = await Group.create({ kundenNr: customer.kundenNr, locationV2: location._id, einsatzort: site._id,
      bestelltext: 'Alte gemeinsame Notiz', shiftDefaults: [], status: 'completed', createdBy: user._id });
    const now = new Date();
    const common = { eventTitel: 'Kanonischer Titel', referenz: 'REF-CANON', bestDatum: new Date('2026-10-01') };
    const local = { eventTitel: 'Abweichender Titel', referenz: '', bestDatum: null };
    const rows = [common, local].map((values, index) => ({ _id: oid(), auftragNr: 8000001 + index,
      ...values, day: index ? '2026-10-26' : '2026-10-24',
      auftragsgruppe: group._id, kundenNr: customer.kundenNr, locationV2: location._id, einsatzort: site._id,
      bestelltext: group.bestelltext, suppressedGroupShiftKeys: [], source: 'monitor', aktiv: 1, auftStatus: 1, planningVersion: 0,
      vonDatum: atTime(index ? '2026-10-26' : '2026-10-24'), bisDatum: atTime(index ? '2026-10-26' : '2026-10-24'),
      createdAt: now, updatedAt: now }));
    await Auftrag.collection.insertMany(rows);
    const beforeGroup = await Group.findById(group._id).lean();
    const firstContext = await request('GET', '/editor/context/8000002');
    assert.equal(firstContext.status, 200, JSON.stringify(firstContext.body));
    for (const field of ['eventTitel', 'referenz', 'bestDatum']) {
      assert.equal(firstContext.body.group[field], field === 'bestDatum' ? common[field].toISOString() : common[field]);
      assert.equal(firstContext.body.order[field], local[field]);
      assert.equal(firstContext.body.order[`${field}Override`], true);
    }
    const canonicalContext = await request('GET', '/editor/context/8000001');
    for (const field of ['eventTitel', 'referenz', 'bestDatum']) assert.equal(canonicalContext.body.order[`${field}Override`], false);
    const dto = await editDto(8000002);
    dto.order.bestelltext = 'Nur die gemeinsame Notiz ändern';
    const reviewed = await request('POST', '/editor/review', dto);
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.totalAffected, 2);
    assert.ok(reviewed.body.orders.every(order => order.changes.every(change => change.key.endsWith(':bestelltext'))));
    assert.deepEqual(await Group.findById(group._id).lean(), beforeGroup);
    assert.equal(await Submission.countDocuments(), 0);
    assert.equal(await Entry.countDocuments(), 0);
    for (const row of await Auftrag.find({ auftragsgruppe: group._id }).lean()) {
      assert.equal(row.eventTitelOverride, undefined);
      assert.equal(row.updatedAt.getTime(), now.getTime());
    }
    await finish(await submit(dto));
    const preserved = await Auftrag.findOne({ auftragNr: 8000002 }).lean();
    for (const field of ['eventTitel', 'referenz', 'bestDatum']) {
      assert.equal(preserved[field], local[field]);
      assert.equal(preserved[`${field}Override`], true);
    }
    const unrelatedAudit = await Entry.findOne({ auftragNr: 8000002 }).lean();
    assert.deepEqual(unrelatedAudit.changes[0].fields.map(field => field.field), ['bestelltext']);
    const canonicalLocal = await editDto(8000001);
    Object.assign(canonicalLocal.order, { eventTitel: 'Kanonischer Tag ist jetzt lokal', eventTitelOverride: true });
    await finish(await submit(canonicalLocal));
    const stable = await request('GET', '/editor/context/8000002');
    assert.equal(stable.body.group.eventTitel, common.eventTitel);
    assert.equal(stable.body.order.eventTitel, local.eventTitel);
  });

  it('stores shared Bestellung files once, retries idempotently, lists/downloads through both days and requires explicit group deletion', async () => {
    const { orders } = await finish(await submit(createDto({ dates: ['2026-10-24', '2026-10-26'] })));
    async function upload(number, uploadId, content = 'Test Bestellung') {
      const data = new FormData();
      data.append('file', new Blob([content], { type: 'text/plain' }), 'Bestellung.txt');
      data.append('type', 'bestellung'); data.append('relationTarget', 'group'); data.append('clientUploadId', uploadId);
      const response = await fetch(`${base}/api/auftraege/${number}/einsatzdokumente`,
        { method: 'POST', headers: { 'x-auth-token': tokens(user) }, body: data });
      return { status: response.status, body: await response.json() };
    }
    const uploaded = await upload(orders[0].auftragNr, 'upload-1');
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    const repeated = await upload(orders[1].auftragNr, 'upload-1');
    assert.equal(repeated.body.data._id, uploaded.body.data._id);
    assert.equal(uploads.length, 1);
    assert.equal((await Group.findOne()).einsatzdokumente.length, 1);
    assert.equal((await Auftrag.findOne()).einsatzdokumente.length, 0);
    assert.equal((await upload(orders[0].auftragNr, 'upload-1', 'Changed')).status, 409);
    const listed = await request('GET', `/${orders[1].auftragNr}/einsatzdokumente`);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].relationTarget, 'group');
    const documentId = uploaded.body.data._id;
    assert.equal((await request('GET', `/${orders[1].auftragNr}/einsatzdokumente/${documentId}/download`)).status, 200);
    assert.equal((await request('DELETE', `/${orders[1].auftragNr}/einsatzdokumente/${documentId}`, {})).status, 409);
    assert.equal(deleted.length, 0);
    assert.equal((await request('DELETE', `/${orders[1].auftragNr}/einsatzdokumente/${documentId}`, { relationTarget: 'group' })).status, 200);
    assert.equal(deleted.length, 1);
    assert.equal((await Group.findOne()).einsatzdokumente.length, 0);
  });

  it('keeps declared attachments blocking release until explicit verified completion and resumes failed R2 uploads without DB rewrites', async () => {
    const content = 'Test Bestellung';
    const dto = createDto({ dates: ['2026-10-24', '2026-10-26'], attachments: [{
      clientUploadId: 'declared-file', relationTarget: 'group', day: '2026-10-24',
      filename: 'Bestellung.txt', size: Buffer.byteLength(content),
    }] });
    const { progress, orders } = await finish(await submit(dto));
    assert.equal(progress.status, 'completed');
    assert.equal(progress.ready, false);
    assert.equal(progress.attachmentsPending, 1);
    assert.equal((await Group.findOne()).status, 'incomplete');
    const reopened = await request('GET', `/editor/context/${orders[1].auftragNr}`);
    assert.equal(reopened.body.pendingSubmission.id, progress.id);
    assert.equal(reopened.body.pendingSubmission.canResume, true);
    assert.equal(reopened.body.pendingSubmission.attachments[0].uploaded, false);
    assert.equal(reopened.body.pendingSubmission.attachments[0].auftragNr, orders[0].auftragNr);
    const anotherModal = await request('GET', `/editor/context/${orders[1].auftragNr}`, undefined, other);
    assert.equal(anotherModal.body.pendingSubmission.canResume, false);
    const release = await request('POST', `/${orders[1].auftragNr}/release`, { planningVersion: orders[1].planningVersion });
    assert.equal(release.status, 409);
    assert.equal(release.body.code, 'ATTACHMENTS_PENDING');
    const completeBeforeUpload = await request('POST', `/editor/submissions/${progress.id}/complete`, {});
    assert.equal(completeBeforeUpload.status, 409);
    async function upload(actor = user) {
      const data = new FormData();
      data.append('file', new Blob([content], { type: 'text/plain' }), 'Bestellung.txt');
      data.append('type', 'bestellung'); data.append('relationTarget', 'group'); data.append('clientUploadId', 'declared-file');
      const response = await fetch(`${base}/api/auftraege/${orders[0].auftragNr}/einsatzdokumente`,
        { method: 'POST', headers: { 'x-auth-token': tokens(actor) }, body: data });
      return { status: response.status, body: await response.json() };
    }
    assert.equal((await upload(other)).status, 403);
    const originalUpload = R2.uploadFile;
    R2.uploadFile = async () => { throw new Error('Injected R2 failure'); };
    try { assert.equal((await upload()).status, 500); }
    finally { R2.uploadFile = originalUpload; }
    const reserved = (await Group.findOne()).einsatzdokumente[0];
    assert.equal(reserved.uploadStatus, 'pending');
    assert.equal((await request('GET', `/${orders[0].auftragNr}/einsatzdokumente`)).body.data.length, 0);
    const uploaded = await upload();
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.data._id, String(reserved._id));
    const uploadedProgress = await request('GET', `/editor/submissions/${progress.id}`);
    assert.equal(uploadedProgress.body.attachments[0].uploaded, true);
    assert.equal(uploadedProgress.body.attachments[0].completed, false);
    const feedCount = await Entry.countDocuments();
    const completed = await request('POST', `/editor/submissions/${progress.id}/complete`, {});
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.ready, true);
    assert.equal(completed.body.attachmentsPending, 0);
    assert.equal((await Group.findOne()).activeSubmission, null);
    assert.equal((await Group.findOne()).status, 'completed');
    assert.equal((await request('GET', `/editor/context/${orders[1].auftragNr}`)).body.pendingSubmission, null);
    assert.equal(await Entry.countDocuments(), feedCount);
    assert.equal((await upload()).status, 200);
    assert.equal(uploads.length, 1);
    assert.equal((await request('POST', `/editor/submissions/${progress.id}/complete`, {})).body.ready, true);
    assert.equal(await Auftrag.countDocuments(), 2);
  });

  it('retains the 30 MB file limit and rejects invalid attachment manifests', async () => {
    const manifest = createDto({ attachments: [{ clientUploadId: 'too-large', relationTarget: 'order',
      day: '2026-10-24', filename: 'Large.pdf', size: 30 * 1024 * 1024 + 1 }] });
    assert.equal((await request('POST', '/editor/submissions', manifest)).status, 400);
    const { orders } = await finish(await submit(createDto()));
    const data = new FormData();
    data.append('file', new Blob([new Uint8Array(30 * 1024 * 1024 + 1)]), 'Large.pdf');
    data.append('type', 'bestellung');
    const response = await fetch(`${base}/api/auftraege/${orders[0].auftragNr}/einsatzdokumente`,
      { method: 'POST', headers: { 'x-auth-token': tokens(user) }, body: data });
    assert.equal(response.status, 413);
    assert.equal(uploads.length, 0);
    assert.equal((await Auftrag.findOne()).einsatzdokumente.length, 0);
  });
});
