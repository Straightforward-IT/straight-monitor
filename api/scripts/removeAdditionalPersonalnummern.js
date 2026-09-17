const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');

async function removeAdditionalPersonalnummern() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const filter = { personalnummern: { $exists: true } };
  const affected = await Mitarbeiter.countDocuments(filter);

  if (shouldWrite && affected) {
    await Mitarbeiter.collection.updateMany(filter, { $unset: { personalnummern: '' } });
  }

  console.log(JSON.stringify({
    mode: shouldWrite ? 'write' : 'dry-run',
    affected,
    note: shouldWrite
      ? 'Zusätzliche Personalnummern wurden entfernt.'
      : 'Keine Daten geändert. Mit --write werden die Alt-Felder entfernt.',
  }, null, 2));
}

removeAdditionalPersonalnummern()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });