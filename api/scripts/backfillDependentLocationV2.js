const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Location = require('../models/Location');
const Auftrag = require('../models/Event/Auftrag');
const Kunde = require('../models/Kunde');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Rechnung = require('../models/Rechnung');
const ZvooveVerfuegbarkeit = require('../models/ZvooveVerfuegbarkeit');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');

async function planRechnungen() {
  const rechnungen = await Rechnung.find({ locationV2: null })
    .select('_id auftragNr kundenNr')
    .lean();
  const auftragNrs = [...new Set(rechnungen.map((rechnung) => rechnung.auftragNr).filter(Number.isFinite))];
  const kundenNrs = [...new Set(rechnungen.map((rechnung) => rechnung.kundenNr).filter(Number.isFinite))];
  const [auftraege, kunden, activeLocations] = await Promise.all([
    auftragNrs.length ? Auftrag.find({ auftragNr: { $in: auftragNrs } }).select('auftragNr geschSt locationV2').lean() : [],
    kundenNrs.length ? Kunde.find({ kundenNr: { $in: kundenNrs } }).select('kundenNr geschSt locationV2').lean() : [],
    Location.find({ isActive: true }).select('_id externalId').lean(),
  ]);
  const locationsByExternalId = new Map(activeLocations.map((location) => [String(location.externalId || '').trim(), location._id]));
  const locationForGeschSt = (geschSt) => locationsByExternalId.get(String(geschSt || '').trim()) || null;
  const locationByAuftragNr = new Map(auftraege.map((auftrag) => [auftrag.auftragNr, auftrag.locationV2 || locationForGeschSt(auftrag.geschSt)]));
  const locationByKundenNr = new Map(kunden.map((kunde) => [kunde.kundenNr, kunde.locationV2 || locationForGeschSt(kunde.geschSt)]));
  const operations = [];
  const report = { total: rechnungen.length, fromAuftrag: 0, fromKunde: 0, unresolved: 0, unresolvedEntries: [] };

  for (const rechnung of rechnungen) {
    const locationId = locationByAuftragNr.get(rechnung.auftragNr)
      || locationByKundenNr.get(rechnung.kundenNr);
    if (!locationId) {
      report.unresolved += 1;
      if (report.unresolvedEntries.length < 30) {
        report.unresolvedEntries.push({ auftragNr: rechnung.auftragNr || null, kundenNr: rechnung.kundenNr || null });
      }
      continue;
    }
    if (locationByAuftragNr.get(rechnung.auftragNr)) report.fromAuftrag += 1;
    else report.fromKunde += 1;
    operations.push({
      updateOne: {
        filter: { _id: rechnung._id, locationV2: null },
        update: { $set: { locationV2: locationId } },
      },
    });
  }
  return { operations, report };
}

async function planVerfuegbarkeiten() {
  const verfuegbarkeiten = await ZvooveVerfuegbarkeit.find({ locationV2: null })
    .select('_id personalnr')
    .lean();
  const personalnrs = [...new Set(verfuegbarkeiten.map((entry) => String(entry.personalnr)).filter(Boolean))];
  const [mitarbeiter, activeLocations] = await Promise.all([
    personalnrs.length
    ? await Mitarbeiter.find({ $or: [{ personalnr: { $in: personalnrs } }, { personalnummern: { $in: personalnrs } }] })
      .select('personalnr personalnummern locationV2')
      .lean()
    : [],
    Location.find({ isActive: true }).select('_id externalId').lean(),
  ]);
  const locationsByExternalId = new Map(activeLocations.map((location) => [String(location.externalId || '').trim(), location._id]));
  const locationByPersonalnr = new Map();
  for (const ma of mitarbeiter) {
    const primaryLocation = ma.locationV2 || locationsByExternalId.get(String(ma.personalnr || '').trim().match(/^\d/)?.[0]) || null;
    for (const personalnr of [ma.personalnr, ...(ma.personalnummern || [])].filter(Boolean)) {
      locationByPersonalnr.set(String(personalnr), primaryLocation);
    }
  }
  const operations = [];
  const report = { total: verfuegbarkeiten.length, matched: 0, unresolved: 0, unresolvedEntries: [] };
  const unresolvedPersonalnrs = new Set();

  for (const verfuegbarkeit of verfuegbarkeiten) {
    const locationId = locationByPersonalnr.get(String(verfuegbarkeit.personalnr));
    if (!locationId) {
      report.unresolved += 1;
      if (!unresolvedPersonalnrs.has(verfuegbarkeit.personalnr) && report.unresolvedEntries.length < 30) {
        unresolvedPersonalnrs.add(verfuegbarkeit.personalnr);
        report.unresolvedEntries.push({ personalnr: verfuegbarkeit.personalnr });
      }
      continue;
    }
    report.matched += 1;
    operations.push({
      updateOne: {
        filter: { _id: verfuegbarkeit._id, locationV2: null },
        update: { $set: { locationV2: locationId } },
      },
    });
  }
  return { operations, report };
}

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const [rechnungen, verfuegbarkeiten] = await Promise.all([planRechnungen(), planVerfuegbarkeiten()]);
  const report = {
    mode: shouldWrite ? 'write' : 'dry-run',
    rechnung: rechnungen.report,
    verfuegbarkeit: verfuegbarkeiten.report,
  };

  if (shouldWrite) {
    const [rechnungenResult, verfuegbarkeitenResult] = await Promise.all([
      rechnungen.operations.length ? Rechnung.bulkWrite(rechnungen.operations) : null,
      verfuegbarkeiten.operations.length ? ZvooveVerfuegbarkeit.bulkWrite(verfuegbarkeiten.operations) : null,
    ]);
    report.written = {
      rechnung: rechnungenResult?.modifiedCount || 0,
      verfuegbarkeit: verfuegbarkeitenResult?.modifiedCount || 0,
    };
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

backfill().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});