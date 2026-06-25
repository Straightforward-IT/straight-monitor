/**
 * Seed the SignaturTyp collection with the initial document types.
 *
 * Safe to run multiple times — existing types are left untouched (upsert by key).
 *
 * Usage:
 *   cd api && node scripts/seedSignaturTypen.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose  = require('mongoose');
const SignaturTyp = require('../models/SignaturTyp');
const logger    = require('../utils/logger');

const INITIAL_TYPES = [
  { key: 'stundenliste',          label: 'Stundenliste',          linkedTo: 'Kunde',       order: 1 },
  { key: 'preisblatt',            label: 'Preisblatt',            linkedTo: 'Kunde',       order: 2 },
  { key: 'auerv',                 label: 'AÜRV',                  linkedTo: 'Kunde',       order: 3 },
  { key: 'lohnvorschuss',         label: 'Lohnvorschuss',         linkedTo: 'Mitarbeiter', order: 4 },
  { key: 'arbeitsvertrag',        label: 'Arbeitsvertrag',        linkedTo: 'Mitarbeiter', order: 5 },
  { key: 'reisekostenabrechnung', label: 'Reisekostenabrechnung', linkedTo: 'Mitarbeiter', order: 6 },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.error('MONGO_URI is not set. Aborting seed.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  logger.info('Connected to MongoDB.');

  for (const t of INITIAL_TYPES) {
    const existing = await SignaturTyp.findOne({ key: t.key });
    if (existing) {
      logger.info(`  SKIP  ${t.key} (already exists, _id: ${existing._id})`);
      continue;
    }
    const doc = await SignaturTyp.create({ ...t, isActive: true });
    logger.info(`  CREATE ${doc.key} (${doc.label}) → _id: ${doc._id}`);
  }

  logger.info('Seed complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
