const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Location = require('../models/Location');
const Auftrag = require('../models/Auftrag');
const Kunde = require('../models/Kunde');
const Schicht = require('../models/Schicht');
const Einsatz = require('../models/Einsatz');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');

async function getLocationsByExternalId() {
  const locations = await Location.find({ isActive: true })
    .select('_id externalId nameFull')
    .lean();
  const byExternalId = new Map();

  for (const location of locations) {
    const externalId = String(location.externalId || '').trim();
    if (!externalId) continue;
    if (byExternalId.has(externalId)) {
      throw new Error(`Doppelte externe Standort-ID '${externalId}'`);
    }
    byExternalId.set(externalId, location);
  }
  return byExternalId;
}

function locationForGeschSt(geschSt, locationsByExternalId) {
  const externalId = String(geschSt || '').trim();
  return externalId ? locationsByExternalId.get(externalId) || null : null;
}

function locationForKundenNr(kundenNr, locationsByExternalId) {
  const externalId = String(kundenNr || '').trim().match(/^\d/)?.[0];
  return externalId ? locationsByExternalId.get(externalId) || null : null;
}

async function planAuftraege(locationsByExternalId) {
  const auftraege = await Auftrag.find({ locationV2: null })
    .select('_id auftragNr geschSt')
    .lean();
  const operations = [];
  const byAuftragNr = new Map();
  const report = { total: auftraege.length, matched: 0, unresolved: [] };

  for (const auftrag of auftraege) {
    const location = locationForGeschSt(auftrag.geschSt, locationsByExternalId);
    if (!location) {
      report.unresolved.push({ auftragNr: auftrag.auftragNr, geschSt: auftrag.geschSt || null });
      continue;
    }
    report.matched += 1;
    byAuftragNr.set(String(auftrag.auftragNr), location._id);
    operations.push({
      updateOne: {
        filter: { _id: auftrag._id, locationV2: null },
        update: { $set: { locationV2: location._id } },
      },
    });
  }

  const existing = await Auftrag.find({ locationV2: { $ne: null } })
    .select('auftragNr locationV2')
    .lean();
  for (const auftrag of existing) byAuftragNr.set(String(auftrag.auftragNr), auftrag.locationV2);
  return { operations, byAuftragNr, report };
}

async function planKunden(locationsByExternalId) {
  const kunden = await Kunde.find({ locationV2: null })
    .select('_id kundenNr geschSt')
    .lean();
  const operations = [];
  const report = { total: kunden.length, matched: 0, byKundenNrFallback: 0, unresolved: [] };

  for (const kunde of kunden) {
    const hasGeschSt = Boolean(String(kunde.geschSt || '').trim());
    const location = hasGeschSt
      ? locationForGeschSt(kunde.geschSt, locationsByExternalId)
      : locationForKundenNr(kunde.kundenNr, locationsByExternalId);
    if (!location) {
      report.unresolved.push({ kundenNr: kunde.kundenNr, geschSt: kunde.geschSt || null });
      continue;
    }
    if (!hasGeschSt) report.byKundenNrFallback += 1;
    report.matched += 1;
    operations.push({
      updateOne: {
        filter: { _id: kunde._id, locationV2: null },
        update: { $set: { locationV2: location._id } },
      },
    });
  }
  return { operations, report };
}

async function planByAuftragNr(Model, byAuftragNr) {
  const documents = await Model.find({ locationV2: null })
    .select('_id auftragNr')
    .lean();
  const operations = [];
  const report = { total: documents.length, matched: 0, unresolved: [] };

  for (const document of documents) {
    const locationId = byAuftragNr.get(String(document.auftragNr));
    if (!locationId) {
      report.unresolved.push({ auftragNr: document.auftragNr });
      continue;
    }
    report.matched += 1;
    operations.push({
      updateOne: {
        filter: { _id: document._id, locationV2: null },
        update: { $set: { locationV2: locationId } },
      },
    });
  }
  return { operations, report };
}

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const locationsByExternalId = await getLocationsByExternalId();
  const auftraege = await planAuftraege(locationsByExternalId);
  const kunden = await planKunden(locationsByExternalId);
  const schichten = await planByAuftragNr(Schicht, auftraege.byAuftragNr);
  const einsaetze = await planByAuftragNr(Einsatz, auftraege.byAuftragNr);
  const plans = { auftraege, kunden, schichten, einsaetze };
  const report = {
    mode: shouldWrite ? 'write' : 'dry-run',
    auftrag: auftraege.report,
    kunde: kunden.report,
    schicht: schichten.report,
    einsatz: einsaetze.report,
  };

  if (shouldWrite) {
    const models = { auftraege: Auftrag, kunden: Kunde, schichten: Schicht, einsaetze: Einsatz };
    report.written = {};
    for (const [key, plan] of Object.entries(plans)) {
      report.written[key] = plan.operations.length
        ? (await models[key].bulkWrite(plan.operations)).modifiedCount
        : 0;
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

backfill().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});