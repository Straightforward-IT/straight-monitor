const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');

// Entfernt das fehlerhafte Legacy-Feld `personalnummern` sowie `personalnrHistory`
// ersatzlos aus allen Dokumenten. Die Historie wird anschließend manuell über den
// Personalnr-History-Import (Prüffeld 3201) neu eingespielt.
async function removeAdditionalPersonalnummern() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const filter = { $or: [{ personalnummern: { $exists: true } }, { personalnrHistory: { $exists: true } }] };
  const affected = await Mitarbeiter.countDocuments(filter);

  let removed = 0;
  if (shouldWrite && affected) {
    const result = await Mitarbeiter.collection.updateMany(filter, {
      $unset: { personalnummern: '', personalnrHistory: '' },
    });
    removed = result.modifiedCount;
  }

  console.log(JSON.stringify({
    mode: shouldWrite ? 'write' : 'dry-run',
    documentsWithField: affected,
    fieldsRemoved: removed,
    note: shouldWrite
      ? 'personalnummern und personalnrHistory ersatzlos aus allen Dokumenten entfernt.'
      : 'Dry-Run: keine Daten geändert. Mit --write werden beide Felder entfernt.',
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