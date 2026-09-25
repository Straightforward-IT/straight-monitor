const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Lead = require('../models/Lead');
const Location = require('../models/System/Location');
const Comment = require('../models/System/Comment');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');
const EXTERNAL_ID_BY_LEGACY_STANDORT = {
  Berlin: '1',
  Hamburg: '2',
  Köln: '3',
};

async function planBackfill() {
  const [leads, locations] = await Promise.all([
    Lead.find({ locationV2: null }).select('_id title standort').lean(),
    Location.find({
      isActive: true,
      externalId: { $in: Object.values(EXTERNAL_ID_BY_LEGACY_STANDORT) },
    }).select('_id externalId').lean(),
  ]);
  const locationsByExternalId = new Map(
    locations.map((location) => [String(location.externalId), location._id]),
  );
  const operations = [];
  const locationByLeadId = new Map();
  const report = { total: leads.length, matched: 0, unresolved: [] };

  for (const lead of leads) {
    const externalId = EXTERNAL_ID_BY_LEGACY_STANDORT[String(lead.standort || '').trim()];
    const locationId = locationsByExternalId.get(externalId);
    if (!locationId) {
      report.unresolved.push({ id: String(lead._id), title: lead.title, standort: lead.standort || null });
      continue;
    }
    report.matched += 1;
    locationByLeadId.set(String(lead._id), locationId);
    operations.push({
      updateOne: {
        filter: { _id: lead._id, locationV2: null },
        update: { $set: { locationV2: locationId } },
      },
    });
  }

  const comments = locationByLeadId.size
    ? await Comment.find({
      scope: 'lead_chronik',
      locationV2: null,
      'context.resourceType': 'Lead',
      'context.resourceId': { $in: [...locationByLeadId.keys()] },
    }).select('_id context.resourceId').lean()
    : [];
  const commentOperations = comments.map((comment) => ({
    updateOne: {
      filter: { _id: comment._id, locationV2: null },
      update: { $set: { locationV2: locationByLeadId.get(String(comment.context.resourceId)) } },
    },
  }));

  return { operations, commentOperations, report: { ...report, chronikComments: comments.length } };
}

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);
  const plan = await planBackfill();
  const report = { mode: shouldWrite ? 'write' : 'dry-run', leads: plan.report };

  if (shouldWrite) {
    const [leadResult, commentResult] = await Promise.all([
      plan.operations.length ? Lead.bulkWrite(plan.operations) : null,
      plan.commentOperations.length ? Comment.bulkWrite(plan.commentOperations) : null,
    ]);
    report.written = {
      leads: leadResult?.modifiedCount || 0,
      chronikComments: commentResult?.modifiedCount || 0,
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