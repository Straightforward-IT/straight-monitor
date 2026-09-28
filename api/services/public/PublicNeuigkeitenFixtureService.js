const Auftrag = require('../../models/Event/Auftrag');
const Schicht = require('../../models/Event/Schicht');
const Einsatz = require('../../models/Event/Einsatz');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Sequence = require('../../models/System/Sequence');

const TEST_MITARBEITER_ID = '67c03cb7457dc9c77702bcf2';
const FIXTURE_PREFIX = 'DEV-PUBLIC-NEWS-CONFIRMATION';

function tomorrow() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

function fixtureReference(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${FIXTURE_PREFIX}-${year}-${month}-${day}`;
}

async function allocateFixtureAuftragNr() {
  const sequence = await Sequence.findOneAndUpdate(
    { key: 'public-neuigkeiten-fixture-auftrag' },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return 990000000 + sequence.value;
}

async function createTomorrowConfirmationFixture() {
  const mitarbeiter = await Mitarbeiter.findById(TEST_MITARBEITER_ID)
    .select('_id personalnr locationV2 vorname nachname')
    .lean();
  if (!mitarbeiter) {
    const error = new Error('Der Test-Mitarbeiter wurde nicht gefunden.');
    error.statusCode = 404;
    throw error;
  }
  const personalNr = Number.parseInt(mitarbeiter.personalnr, 10);
  if (!Number.isInteger(personalNr)) {
    const error = new Error('Der Test-Mitarbeiter hat keine gültige Personalnummer.');
    error.statusCode = 422;
    throw error;
  }

  const datum = tomorrow();
  const referenz = fixtureReference(datum);
  let auftrag = await Auftrag.findOne({ referenz }).lean();
  if (!auftrag) {
    auftrag = await Auftrag.create({
      auftragNr: await allocateFixtureAuftragNr(),
      creationOrigin: 'manual',
      source: 'monitor',
      locationV2: mitarbeiter.locationV2 || null,
      eventTitel: 'DEV · Einsatzbestätigung testen',
      eventLocation: 'Straightforward Hamburg',
      eventOrt: 'Hamburg',
      referenz,
      vonDatum: datum,
      bisDatum: datum,
      auftStatus: 2,
      wizardStep: 4,
      wizardCompletedAt: new Date(),
    });
    auftrag = auftrag.toObject();
  }

  let schicht = await Schicht.findOne({ auftragNr: auftrag.auftragNr, source: 'monitor', bezeichnung: 'Bürohilfskraft · Bestätigungstest' });
  if (!schicht) {
    schicht = await Schicht.create({
      creationOrigin: 'manual',
      auftragNr: auftrag.auftragNr,
      locationV2: mitarbeiter.locationV2 || null,
      source: 'monitor',
      bezeichnung: 'Bürohilfskraft · Bestätigungstest',
      datumVon: datum,
      datumBis: datum,
      uhrzeitVon: '10:00',
      uhrzeitBis: '18:00',
      treffpunkt: '09:45',
      treffpunktOrt: 'Straightforward Hamburg',
      bedarf: 1,
      idAuftragArbeitsschichten: null,
    });
  }

  let einsatz = await Einsatz.findOne({ auftragNr: auftrag.auftragNr, schicht: schicht._id, personalNr });
  let created = false;
  if (!einsatz) {
    created = true;
    einsatz = await Einsatz.create({
      creationOrigin: 'manual',
      auftragNr: auftrag.auftragNr,
      locationV2: mitarbeiter.locationV2 || null,
      schicht: schicht._id,
      source: 'monitor',
      personalNr,
      schichtBezeichnung: schicht.bezeichnung,
      datumVon: datum,
      datumBis: datum,
      detailDatumVon: datum,
      detailDatumBis: datum,
      uhrzeitVon: schicht.uhrzeitVon,
      uhrzeitBis: schicht.uhrzeitBis,
      treffpunkt: schicht.treffpunkt,
      treffpunktOrt: schicht.treffpunktOrt,
      bedarf: schicht.bedarf,
      bestaetigungErforderlich: true,
      bestaetigt: false,
    });
  }

  return {
    auftragNr: auftrag.auftragNr,
    schichtId: String(schicht._id),
    einsatzId: String(einsatz._id),
    datum,
    created,
  };
}

async function deleteTomorrowConfirmationFixture() {
  const referenz = fixtureReference(tomorrow());
  const auftrag = await Auftrag.findOne({
    referenz,
    source: 'monitor',
    eventTitel: 'DEV · Einsatzbestätigung testen',
  }).lean();
  if (!auftrag) return { deleted: false, auftragNr: null };

  await Einsatz.deleteMany({ auftragNr: auftrag.auftragNr, source: 'monitor' });
  await Schicht.deleteMany({ auftragNr: auftrag.auftragNr, source: 'monitor' });
  await Auftrag.deleteOne({ _id: auftrag._id });
  return { deleted: true, auftragNr: auftrag.auftragNr };
}

module.exports = {
  TEST_MITARBEITER_ID,
  createTomorrowConfirmationFixture,
  deleteTomorrowConfirmationFixture,
};
