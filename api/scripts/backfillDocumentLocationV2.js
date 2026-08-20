const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
require('../models/Employee/Mitarbeiter');
const { EventReport, Laufzettel } = require('../models/Classes/FlipDocs');
const { resolveLocationFromStandortName } = require('../services/LocationResolutionService');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');
const checkpointPath = path.resolve(
  process.cwd(),
  `document-locationV2-checkpoint-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);

async function planCollection(Model, type, locationCache) {
  const documents = await Model.find()
    .select('_id location locationV2')
    .lean();
  const operations = [];
  const report = {
    total: documents.length,
    alreadySet: 0,
    matchedByLegacyName: 0,
    unresolved: [],
  };

  for (const document of documents) {
    if (document.locationV2) {
      report.alreadySet += 1;
      continue;
    }

    const legacyLocation = String(document.location || '').trim();
    const cacheKey = legacyLocation.toLocaleLowerCase('de');
    if (!locationCache.has(cacheKey)) {
      locationCache.set(cacheKey, await resolveLocationFromStandortName(legacyLocation));
    }
    const location = locationCache.get(cacheKey);

    if (!location) {
      if (report.unresolved.length < 50) {
        report.unresolved.push({
          id: String(document._id),
          location: legacyLocation || null,
        });
      }
      continue;
    }

    report.matchedByLegacyName += 1;
    operations.push({
      updateOne: {
        filter: { _id: document._id, locationV2: null },
        update: { $set: { locationV2: location._id } },
      },
    });
  }

  return { type, operations, report };
}

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const locationCache = new Map();
  const [laufzettel, eventReports] = await Promise.all([
    planCollection(Laufzettel, 'laufzettel', locationCache),
    planCollection(EventReport, 'eventReports', locationCache),
  ]);
  const report = {
    mode: shouldWrite ? 'write' : 'dry-run',
    laufzettel: laufzettel.report,
    eventReports: eventReports.report,
  };

  if (shouldWrite) {
    const checkpoint = {
      createdAt: new Date().toISOString(),
      laufzettel: laufzettel.operations.map(({ updateOne }) => String(updateOne.filter._id)),
      eventReports: eventReports.operations.map(({ updateOne }) => String(updateOne.filter._id)),
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

    const [laufzettelResult, eventReportResult] = await Promise.all([
      laufzettel.operations.length ? Laufzettel.bulkWrite(laufzettel.operations) : null,
      eventReports.operations.length ? EventReport.bulkWrite(eventReports.operations) : null,
    ]);
    report.written = {
      checkpointPath,
      laufzettel: laufzettelResult?.modifiedCount || 0,
      eventReports: eventReportResult?.modifiedCount || 0,
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