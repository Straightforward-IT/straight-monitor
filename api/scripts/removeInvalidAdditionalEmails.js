const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');

// Entfernt alle Einträge aus `additionalEmails`, die keine E-Mail-Adresse sind
// (kein '@' enthalten). Läuft standardmäßig als Dry-Run; mit --write wird geschrieben.
async function removeInvalidAdditionalEmails() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const filter = { additionalEmails: { $elemMatch: { $not: /@/ } } };
  const docs = await Mitarbeiter.find(filter).select('_id additionalEmails').lean();

  let invalidEntries = 0;
  const samples = [];
  const bulkOps = [];
  for (const doc of docs) {
    const valid = (doc.additionalEmails || []).filter(value => String(value ?? '').includes('@'));
    const invalid = (doc.additionalEmails || []).filter(value => !String(value ?? '').includes('@'));
    invalidEntries += invalid.length;
    if (samples.length < 20) samples.push(...invalid.slice(0, 20 - samples.length));
    bulkOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { additionalEmails: valid } } } });
  }

  let documentsUpdated = 0;
  if (shouldWrite && bulkOps.length) {
    const result = await Mitarbeiter.bulkWrite(bulkOps, { ordered: false });
    documentsUpdated = result.modifiedCount;
  }

  console.log(JSON.stringify({
    mode: shouldWrite ? 'write' : 'dry-run',
    documentsWithInvalid: docs.length,
    invalidEntries,
    documentsUpdated,
    sampleInvalidValues: samples,
    note: shouldWrite
      ? 'Ungültige additionalEmails (ohne @) entfernt.'
      : 'Dry-Run: keine Daten geändert. Mit --write werden die Einträge entfernt.',
  }, null, 2));
}

removeInvalidAdditionalEmails()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
