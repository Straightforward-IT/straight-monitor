const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Location = require('../models/Location');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Monitoring = require('../models/Monitoring');
const Comment = require('../models/Comment');
const DispoKommentar = require('../models/DispoKommentar');
const Lead = require('../models/Lead');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');
const checkpointPath = path.resolve(
  process.cwd(),
  `widget-locationV2-checkpoint-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);

function createLocationLookup(locations) {
  return {
    byId: new Map(locations.map((location) => [String(location._id), location._id])),
    byName: new Map(locations.flatMap((location) => [
      [Location.normalize(location.nameFull), location._id],
      [Location.normalize(location.shortName), location._id],
    ])),
  };
}

function locationFromName(standort, lookup) {
  return lookup.byName.get(Location.normalize(standort)) || null;
}

async function planMonitoring(lookup) {
  const entries = await Monitoring.find({ locationV2: null })
    .select('_id locationId standort')
    .lean();
  const operations = [];
  const report = { total: entries.length, fromLocationId: 0, fromStandort: 0, unresolved: 0, samples: [] };

  for (const entry of entries) {
    const fromLocationId = lookup.byId.get(String(entry.locationId || '')) || null;
    const locationV2 = fromLocationId || locationFromName(entry.standort, lookup);
    if (!locationV2) {
      report.unresolved += 1;
      if (report.samples.length < 25) report.samples.push({ id: String(entry._id), standort: entry.standort || null });
      continue;
    }

    if (fromLocationId) report.fromLocationId += 1;
    else report.fromStandort += 1;
    operations.push({
      updateOne: {
        filter: { _id: entry._id, locationV2: null },
        update: { $set: { locationV2 } },
      },
    });
  }

  return { operations, report };
}

async function planComments(Model, label, lookup) {
  const entries = await Model.find({ locationV2: null })
    .select('_id mitarbeiter context.mitarbeiter context.resourceId context.resourceType')
    .lean();
  const mitarbeiterIds = [...new Set(entries
    .map((entry) => entry.mitarbeiter || entry.context?.mitarbeiter)
    .filter(Boolean)
    .map(String))];
  const leadIds = [...new Set(entries
    .filter((entry) => entry.context?.resourceType === 'Lead' && entry.context?.resourceId)
    .map((entry) => String(entry.context.resourceId)))];
  const [mitarbeiter, leads] = await Promise.all([
    mitarbeiterIds.length
      ? Mitarbeiter.find({ _id: { $in: mitarbeiterIds } }).select('locationV2').lean()
      : [],
    leadIds.length
      ? Lead.find({ _id: { $in: leadIds } }).select('standort').lean()
      : [],
  ]);
  const locationByMitarbeiter = new Map(mitarbeiter.map((entry) => [String(entry._id), entry.locationV2]));
  const locationByLead = new Map(leads.map((lead) => [String(lead._id), locationFromName(lead.standort, lookup)]));
  const operations = [];
  const report = { total: entries.length, matched: 0, fromMitarbeiter: 0, fromLead: 0, noMitarbeiter: 0, unresolved: 0, samples: [] };

  for (const entry of entries) {
    const mitarbeiterId = entry.mitarbeiter || entry.context?.mitarbeiter;
    const leadId = entry.context?.resourceType === 'Lead' ? entry.context.resourceId : null;
    const mitarbeiterLocationV2 = mitarbeiterId ? locationByMitarbeiter.get(String(mitarbeiterId)) : null;
    const leadLocationV2 = leadId ? locationByLead.get(String(leadId)) : null;
    const locationV2 = mitarbeiterLocationV2 || leadLocationV2;

    if (!locationV2 && !mitarbeiterId && !leadId) {
      report.noMitarbeiter += 1;
      continue;
    }

    if (!locationV2) {
      report.unresolved += 1;
      if (report.samples.length < 25) {
        report.samples.push({
          id: String(entry._id),
          mitarbeiter: mitarbeiterId ? String(mitarbeiterId) : null,
          resourceType: entry.context?.resourceType || null,
          resourceId: leadId ? String(leadId) : null,
        });
      }
      continue;
    }

    report.matched += 1;
    if (mitarbeiterLocationV2) report.fromMitarbeiter += 1;
    else report.fromLead += 1;
    operations.push({
      updateOne: {
        filter: { _id: entry._id, locationV2: null },
        update: { $set: { locationV2 } },
      },
    });
  }

  return { label, operations, report };
}

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const locations = await Location.find({ isActive: true }).select('_id nameFull shortName').lean();
  const lookup = createLocationLookup(locations);
  const [monitoring, comments, dispoKommentare] = await Promise.all([
    planMonitoring(lookup),
    planComments(Comment, 'comments', lookup),
    planComments(DispoKommentar, 'dispoKommentare', lookup),
  ]);
  const plans = { monitoring, comments, dispoKommentare };
  const report = {
    mode: shouldWrite ? 'write' : 'dry-run',
    activeLocations: locations.length,
    monitoring: monitoring.report,
    comments: comments.report,
    dispoKommentare: dispoKommentare.report,
  };

  if (shouldWrite) {
    const checkpoint = {
      createdAt: new Date().toISOString(),
      monitoring: monitoring.operations.map(({ updateOne }) => String(updateOne.filter._id)),
      comments: comments.operations.map(({ updateOne }) => String(updateOne.filter._id)),
      dispoKommentare: dispoKommentare.operations.map(({ updateOne }) => String(updateOne.filter._id)),
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    const results = await Promise.all(Object.entries(plans).map(async ([key, plan]) => [
      key,
      plan.operations.length ? await ({ monitoring: Monitoring, comments: Comment, dispoKommentare: DispoKommentar })[key].bulkWrite(plan.operations) : null,
    ]));
    report.written = {
      checkpointPath,
      ...Object.fromEntries(results.map(([key, result]) => [key, result?.modifiedCount || 0])),
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

backfill()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });