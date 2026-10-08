const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { PDFDocument } = require('pdf-lib');
const service = require('../services/operations/KuendigungService');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Location = require('../models/System/Location');
const r2Service = require('../services/integrations/R2Service');

const employeeId = '507f1f77bcf86cd799439011';
const locationId = '507f1f77bcf86cd799439012';
const userId = '507f1f77bcf86cd799439013';
const location = {
  _id: locationId,
  nameFull: 'Hamburg',
  address: { city: 'Hamburg' },
};
const validParameters = {
  anrede: 'frau',
  locationId,
  briefdatum: '2026-10-08',
  beendigungsdatum: '2026-11-30',
  freistellung: 'beides',
  freistellungAb: '2026-11-01',
  arbeitszeitkontoStunden: '12.5',
  resturlaubTage: '3.5',
};

describe('KuendigungService', () => {
  let originals;
  let employee;
  let uploaded;
  let deleted;
  let update;

  beforeEach(() => {
    originals = {
      findById: Mitarbeiter.findById,
      findByIdAndUpdate: Mitarbeiter.findByIdAndUpdate,
      find: Location.find,
      findOne: Location.findOne,
      uploadFile: r2Service.uploadFile,
      deleteFile: r2Service.deleteFile,
    };
    employee = {
      _id: employeeId,
      vorname: 'Ada',
      nachname: 'Test',
      adresse: { strasse: 'Teststraße 1', plz: '20095', ort: 'Hamburg' },
      locationV2: locationId,
      isActive: true,
    };
    uploaded = [];
    deleted = [];
    update = null;
    Mitarbeiter.findById = () => ({ lean: async () => employee });
    Mitarbeiter.findByIdAndUpdate = async (id, changes, options) => {
      update = { id, changes, options };
      return employee;
    };
    Location.find = () => ({
      select() { return this; },
      sort() { return this; },
      lean: async () => [location],
    });
    Location.findOne = () => ({
      select() { return this; },
      lean: async () => location,
    });
    r2Service.uploadFile = async (...args) => { uploaded.push(args); };
    r2Service.deleteFile = async key => { deleted.push(key); };
  });

  afterEach(() => {
    Mitarbeiter.findById = originals.findById;
    Mitarbeiter.findByIdAndUpdate = originals.findByIdAndUpdate;
    Location.find = originals.find;
    Location.findOne = originals.findOne;
    r2Service.uploadFile = originals.uploadFile;
    r2Service.deleteFile = originals.deleteFile;
  });

  it('prefills the employee location and exposes all required modal parameters', async () => {
    const defaults = await service.getDefaults(employeeId);
    assert.equal(defaults.ready, true);
    assert.equal(defaults.parameters.anrede, 'herr');
    assert.equal(defaults.parameters.locationId, locationId);
    assert.match(defaults.parameters.briefdatum, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(defaults.parameters.freistellung, 'none');
    assert.deepEqual(defaults.locations, [{ _id: locationId, name: 'Hamburg', ort: 'Hamburg' }]);
  });

  it('renders a one-page, letter-formatted PDF with the selected location and dates', async () => {
    const buffer = await service.buildKuendigung(employee, validParameters);
    const pdf = await PDFDocument.load(buffer);
    assert.equal(pdf.getPageCount(), 1);
    assert.ok(buffer.length > 4_000);
  });

  it('uses the employee name without a salutation in the postal address', async () => {
    const prepared = await service._validateParameters(employee, validParameters);
    assert.equal(prepared.recipient.split('\n')[0], 'Ada Test');
  });

  it('supports each independent release mode', async () => {
    const noRelease = await service._validateParameters(employee, {
      ...validParameters,
      freistellung: 'none',
      freistellungAb: '',
      arbeitszeitkontoStunden: '',
      resturlaubTage: '',
    });
    assert.equal(noRelease.freistellungText, '');
    const timeAccount = await service._validateParameters(employee, {
      ...validParameters,
      freistellung: 'arbeitszeitkonto',
      resturlaubTage: '',
    });
    assert.match(timeAccount.freistellungText, /Arbeitszeitkontos.*12,5 Stunden/);
    assert.doesNotMatch(timeAccount.freistellungText, /Resturlaubes/);
    const vacation = await service._validateParameters(employee, {
      ...validParameters,
      freistellung: 'resturlaub',
      arbeitszeitkontoStunden: '',
    });
    assert.match(vacation.freistellungText, /Resturlaubes.*3,5 Tagen/);
    assert.doesNotMatch(vacation.freistellungText, /Arbeitszeitkontos/);
    const both = await service._validateParameters(employee, validParameters);
    assert.match(both.freistellungText, /Arbeitszeitkontos.*sowie Ihres verbleibenden Resturlaubes/);
    assert.match(both.freistellungText, /ab dem 01\.11\.2026 frei/);
  });

  it('rejects invalid employee data and incomplete or invalid parameters', async () => {
    await assert.rejects(service.getDefaults('not-an-id'), { statusCode: 400 });
    employee = null;
    await assert.rejects(service.getDefaults(employeeId), { statusCode: 404 });
    employee = {
      _id: employeeId,
      vorname: 'Ada',
      nachname: 'Test',
      adresse: { strasse: 'Teststraße 1', plz: '20095', ort: 'Hamburg' },
    };
    await assert.rejects(service.buildKuendigung(employee, { ...validParameters, anrede: 'divers' }), /Anrede/);
    await assert.rejects(service.buildKuendigung(employee, { ...validParameters, locationId: '' }), /Standort/);
    await assert.rejects(service.buildKuendigung(employee, { ...validParameters, beendigungsdatum: '' }), /Beendigungsdatum/);
    await assert.rejects(service.buildKuendigung(employee, { ...validParameters, freistellung: 'beides', resturlaubTage: '-1' }), /Resturlaub/);
    await assert.rejects(service.buildKuendigung(employee, { ...validParameters, freistellung: 'resturlaub', freistellungAb: '' }), /Freistellung ab/);
    employee.adresse = { strasse: 'Teststraße 1' };
    await assert.rejects(service.buildKuendigung(employee, validParameters), /Straße, PLZ und Ort/);
  });

  it('uploads the generated PDF, persists immutable parameters and leaves employment data unchanged', async () => {
    const document = await service.createAndStore(employeeId, validParameters, userId);
    assert.equal(document.filename, 'Kuendigung_Ada_Test_2026-10-08.pdf');
    assert.equal(document.r2Key, `employees/${employeeId}/documents/${document.filename}`);
    assert.equal(document.parameters.anrede, 'frau');
    assert.equal(document.parameters.ort, 'Hamburg');
    assert.equal(document.parameters.briefdatum, '2026-10-08');
    assert.equal(document.parameters.beendigungsdatum, '2026-11-30');
    assert.deepEqual(uploaded.map(([key, , contentType]) => [key, contentType]), [[document.r2Key, 'application/pdf']]);
    assert.equal((await PDFDocument.load(uploaded[0][1])).getPageCount(), 1);
    assert.equal(update.id, employeeId);
    assert.equal(update.changes.$push.generierteDokumente.parameters.freistellung, 'beides');
    assert.equal(employee.isActive, true);
    assert.equal(employee.austrittsdatum, undefined);
    const model = new Mitarbeiter({
      vorname: 'Ada',
      nachname: 'Test',
      generierteDokumente: [document],
    });
    assert.equal(model.validateSync(), undefined);
    assert.ok(model.generierteDokumente[0]._id instanceof mongoose.Types.ObjectId);
  });

  it('removes the R2 object after a database-linking failure', async () => {
    Mitarbeiter.findByIdAndUpdate = async () => { throw new Error('DB unavailable'); };
    await assert.rejects(service.createAndStore(employeeId, validParameters, userId), /DB unavailable/);
    assert.equal(deleted[0], uploaded[0][0]);
  });
});
