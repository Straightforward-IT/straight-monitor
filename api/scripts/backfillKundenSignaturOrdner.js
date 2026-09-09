const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Kunde = require('../models/Customer/Kunde');
require('../models/System/Location');
const R2Service = require('../services/integrations/R2Service');
const { sanitizeSegment } = require('../utils/signaturR2Path');

const shouldWrite = process.argv.includes('--write');

function buildFolderName(kunde) {
  const identifier = kunde.kuerzel || kunde.kundName || kunde.kundenNr || kunde._id;
  return sanitizeSegment(identifier) || String(kunde._id);
}

function buildFolderKey(kunde) {
  const locationIdentifier = kunde.locationV2?.shortName || kunde.locationV2?.nameFull;
  const locationFolder = sanitizeSegment(locationIdentifier);
  return `Signatures/${locationFolder}/kunden/${kunde.signaturOrdner}/.keep`;
}

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const kunden = await Kunde.find({ kundStatus: 2 })
    .select('_id kundenNr kundName kuerzel signaturOrdner locationV2')
    .populate('locationV2', 'nameFull shortName isActive')
    .lean();

  const report = {
    mode: shouldWrite ? 'write' : 'dry-run',
    total: kunden.length,
    ready: 0,
    assignedFolderNames: 0,
    createdFolderMarkers: 0,
    skipped: {
      missingLocation: [],
      inactiveLocation: [],
      duplicateFolder: [],
    },
  };
  const plannedFolders = new Map();
  const operations = [];

  for (const kunde of kunden) {
    if (!kunde.locationV2) {
      report.skipped.missingLocation.push(kunde.kundenNr);
      continue;
    }
    if (kunde.locationV2.isActive === false) {
      report.skipped.inactiveLocation.push(kunde.kundenNr);
      continue;
    }

    const signaturOrdner = kunde.signaturOrdner || buildFolderName(kunde);
    const folderKey = buildFolderKey({ ...kunde, signaturOrdner });
    const existingKunde = plannedFolders.get(folderKey);
    if (existingKunde) {
      report.skipped.duplicateFolder.push({
        kundenNr: kunde.kundenNr,
        conflictsWith: existingKunde.kundenNr,
        folderKey,
      });
      continue;
    }

    plannedFolders.set(folderKey, kunde);
    report.ready += 1;
    if (!kunde.signaturOrdner) {
      report.assignedFolderNames += 1;
      operations.push({
        updateOne: {
          filter: { _id: kunde._id, signaturOrdner: null },
          update: { $set: { signaturOrdner } },
        },
      });
    }
  }

  if (shouldWrite) {
    if (operations.length) await Kunde.bulkWrite(operations);
    for (const folderKey of plannedFolders.keys()) {
      await R2Service.uploadFile(folderKey, '', 'application/x-directory');
      report.createdFolderMarkers += 1;
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
