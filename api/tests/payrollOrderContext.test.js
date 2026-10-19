const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const service = require('../services/payroll/PayrollOrderContextService');
const Auftrag = require('../models/Event/Auftrag');
const Einsatz = require('../models/Event/Einsatz');
const Schicht = require('../models/Event/Schicht');
const Kunde = require('../models/Customer/Kunde');
const Einsatzort = require('../models/Event/Einsatzort');
const oid = () => new mongoose.Types.ObjectId();

describe('productive payroll order context', function () {
  this.timeout(120000);
  let mongo, user, order, shift, assignment, booking;
  const models = [Auftrag, Einsatz, Schicht, Kunde, Einsatzort];
  before(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongo.getUri('payroll_order_context_test'));
    await Promise.all(models.map(model => model.init()));
  });
  beforeEach(async () => {
    for (const model of models) await model.collection.deleteMany({});
    const location = oid(), site = { _id: oid(), bezeichnung: 'Messehalle' };
    user = { role: 'USER', locationV2: location };
    order = { _id: oid(), auftragNr: 2510476, eventTitel: 'Messe Hamburg', kundenNr: 42, locationV2: location, einsatzort: site._id, eventOrt: 'Hamburg' };
    shift = { _id: oid(), auftragNr: order.auftragNr, idAuftragArbeitsschichten: 17, day: '2026-09-09', bezeichnung: 'Service Früh', uhrzeitVon: '08:00', uhrzeitBis: '16:30', treffpunkt: '07:45', treffpunktOrt: 'Haupteingang', ansprechpartnerName: 'Schichtleitung' };
    assignment = { _id: oid(), auftragNr: order.auftragNr, personalNr: 100001, schicht: shift._id, idAuftragArbeitsschichten: 17, day: '2026-09-09', datumVon: new Date('2026-09-09'), datumBis: new Date('2026-09-09'), bezeichnung: 'Servicehost', uhrzeitVon: '08:00', uhrzeitBis: '16:30', garantiestundenLohn: 0, zvooveEinspersNr: '10017' };
    booking = { _id: oid(), auftragNr: order.auftragNr, personalNr: '100001', date: '2026-09-09', shiftId: '17', assignmentId: assignment._id, reportedHours: '7.5' };
    await Auftrag.collection.insertOne(order); await Einsatzort.collection.insertOne(site);
    await Kunde.collection.insertOne({ _id: oid(), kundenNr: 42, kundName: 'Messekunde' });
    await Schicht.collection.insertOne(shift); await Einsatz.collection.insertOne(assignment);
  });
  after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
  const context = async (row = booking, actor = user) => (await service.contexts(actor, [row])).get(String(row._id));

  it('resolves only matching order, shift and employee assignment, retaining zero guarantees', async () => {
    const before = JSON.stringify(booking), result = await context();
    assert.equal(result.status, 'AVAILABLE'); assert.equal(result.order.customerName, 'Messekunde'); assert.equal(result.order.site, 'Messehalle');
    assert.equal(result.shift.status, 'MATCHED'); assert.equal(result.shift.label, 'Service Früh'); assert.equal(result.shift.meetingPoint, 'Haupteingang');
    assert.equal(result.assignment.id, String(assignment._id)); assert.equal(result.assignment.title, 'Servicehost');
    assert.equal(result.assignment.externalNumber, '10017'); assert.equal(result.assignment.guaranteedHours, 0);
    assert.equal(JSON.stringify(booking), before);
  });
  it('uses the external shift, day, order and original personnel number when the mapping is absent', async () => {
    const result = await context({ ...booking, assignmentId: null });
    assert.equal(result.assignment.id, String(assignment._id)); assert.equal(result.shift.id, String(shift._id));
    assert.equal((await context({ ...booking, assignmentId: null, personalNr: '100002' })).assignment.status, 'MISSING');
    assert.equal((await context({ ...booking, date: '2026-09-10' })).assignment.status, 'MISSING');
  });
  it('never guesses an assignment from only employee and day or from ambiguous external keys', async () => {
    assert.equal((await context({ ...booking, assignmentId: null, shiftId: null })).assignment.status, 'MISSING');
    await Einsatz.collection.insertOne({ ...assignment, _id: oid(), schicht: null, bezeichnung: 'Zweiter Kandidat' });
    const ambiguous = await context({ ...booking, assignmentId: null });
    assert.equal(ambiguous.assignment.status, 'AMBIGUOUS'); assert.equal(ambiguous.assignment.id, null); assert.equal(ambiguous.assignment.title, null);
    assert.equal((await context()).assignment.id, String(assignment._id));
  });
  it('rejects a stale direct mapping and reports ambiguous shifts without picking a candidate', async () => {
    const unrelated = { ...assignment, _id: oid(), personalNr: 100002, schicht: null };
    await Einsatz.collection.insertOne(unrelated);
    assert.equal((await context({ ...booking, assignmentId: unrelated._id, shiftId: null })).assignment.status, 'MISSING');
    await Schicht.collection.insertOne({ ...shift, _id: oid(), bezeichnung: 'Falscher Kandidat' });
    const result = await context({ ...booking, assignmentId: null, personalNr: '100003' });
    assert.equal(result.shift.status, 'AMBIGUOUS'); assert.equal(result.shift.id, null); assert.equal(result.shift.label, null);
  });
  it('can display denormalized shift information from a matched assignment if the shift is missing', async () => {
    await Schicht.collection.deleteMany({});
    await Einsatz.collection.updateOne({ _id: assignment._id }, { $set: { schichtBezeichnung: 'Importierte Frühschicht' } });
    const result = await context();
    assert.equal(result.shift.status, 'FROM_ASSIGNMENT'); assert.equal(result.shift.label, 'Importierte Frühschicht'); assert.equal(result.shift.start, '08:00');
  });
  it('keeps multiple jobs on the same day separate even when their external shift IDs coincide', async () => {
    const otherOrder = { ...order, _id: oid(), auftragNr: 2510477, eventTitel: 'Abendeinsatz' };
    const otherShift = { ...shift, _id: oid(), auftragNr: otherOrder.auftragNr, bezeichnung: 'Abendschicht' };
    const otherAssignment = { ...assignment, _id: oid(), auftragNr: otherOrder.auftragNr, schicht: otherShift._id, bezeichnung: 'Abendservice' };
    const otherBooking = { ...booking, _id: oid(), auftragNr: otherOrder.auftragNr, assignmentId: null };
    await Auftrag.collection.insertOne(otherOrder); await Schicht.collection.insertOne(otherShift); await Einsatz.collection.insertOne(otherAssignment);
    const results = await service.contexts(user, [booking, otherBooking]);
    assert.equal(results.get(String(booking._id)).order.number, order.auftragNr);
    assert.equal(results.get(String(otherBooking._id)).order.number, otherOrder.auftragNr);
    assert.equal(results.get(String(otherBooking._id)).shift.id, String(otherShift._id));
    assert.equal(results.get(String(otherBooking._id)).assignment.title, 'Abendservice');
  });
  it('omits details outside the current order location and explicitly reports missing orders', async () => {
    assert.deepEqual(await context(booking, { role: 'USER', locationV2: oid() }), { status: 'FORBIDDEN', order: null, shift: null, assignment: null });
    assert.equal((await context(booking, { role: 'USER', locationAccess: [order.locationV2] })).status, 'AVAILABLE');
    assert.equal((await context(booking, { role: 'ADMIN' })).status, 'AVAILABLE');
    await Auftrag.collection.deleteMany({});
    assert.deepEqual(await context(), { status: 'ORDER_MISSING', order: null, shift: null, assignment: null });
    assert.equal((await service.contexts(user, [])).size, 0);
  });
});
