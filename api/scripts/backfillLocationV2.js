const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Bewerber = require('../models/Employee/Bewerber');
const {
  resolveLocationFromPersonalnr,
  resolveLocationFromTeamKey,
} = require('../services/LocationResolutionService');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');
const checkpointPath = path.resolve(
  process.cwd(),
  `locationV2-checkpoint-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);

async function planMitarbeiter() {
  const mitarbeiter = await Mitarbeiter.find()
    .select('_id vorname nachname personalnr locationV2')
    .lean();
  const operations = [];
  const report = { total: mitarbeiter.length, alreadySet: 0, matched: 0, unresolved: [] };

  for (const entry of mitarbeiter) {
    if (entry.locationV2) {
      report.alreadySet += 1;
      continue;
    }
    const location = await resolveLocationFromPersonalnr(entry.personalnr);
    if (!location) {
      report.unresolved.push({
        id: String(entry._id),
        name: `${entry.vorname || ''} ${entry.nachname || ''}`.trim(),
        personalnr: entry.personalnr || null,
      });
      continue;
    }
    report.matched += 1;
    operations.push({
      updateOne: {
        filter: { _id: entry._id, locationV2: null },
        update: { $set: { locationV2: location._id } },
      },
    });
  }
  return { operations, report };
}

async function planBewerber() {
  const bewerber = await Bewerber.find()
    .select('_id vorname nachname teamKey locationV2')
    .lean();
  const operations = [];
  const report = { total: bewerber.length, alreadySet: 0, matched: 0, unresolved: [] };

  for (const entry of bewerber) {
    if (entry.locationV2) {
      report.alreadySet += 1;
      continue;
    }
    const location = await resolveLocationFromTeamKey(entry.teamKey);
    if (!location) {
      report.unresolved.push({
        id: String(entry._id),
        name: `${entry.vorname || ''} ${entry.nachname || ''}`.trim(),
        teamKey: entry.teamKey || null,
      });
      continue;
    }
    report.matched += 1;
    operations.push({
      updateOne: {
        filter: { _id: entry._id, locationV2: null },
        update: { $set: { locationV2: location._id } },
      },
    });
  }
  return { operations, report };
}

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const [mitarbeiter, bewerber] = await Promise.all([planMitarbeiter(), planBewerber()]);
  const report = {
    mode: shouldWrite ? 'write' : 'dry-run',
    mitarbeiter: mitarbeiter.report,
    bewerber: bewerber.report,
  };

  if (shouldWrite) {
    const checkpoint = {
      createdAt: new Date().toISOString(),
      mitarbeiter: mitarbeiter.operations.map(({ updateOne }) => String(updateOne.filter._id)),
      bewerber: bewerber.operations.map(({ updateOne }) => String(updateOne.filter._id)),
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    const [mitarbeiterResult, bewerberResult] = await Promise.all([
      mitarbeiter.operations.length ? Mitarbeiter.bulkWrite(mitarbeiter.operations) : null,
      bewerber.operations.length ? Bewerber.bulkWrite(bewerber.operations) : null,
    ]);
    report.written = {
      checkpointPath,
      mitarbeiter: mitarbeiterResult?.modifiedCount || 0,
      bewerber: bewerberResult?.modifiedCount || 0,
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