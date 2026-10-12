const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');

// Migriert die monatlichen Arbeitszeit-Snapshots aus dem Legacy-Feld `arbeitszeit`
// in das kombinierte Lohn-/Gehalt-Stammdatenfeld `lohnStammdaten`
// ({ month, von, bis, arbeitszeit, steuer }). Die Steuerklasse bleibt leer und wird
// beim naechsten Liste-7002-Import (Spalte AU) oder manuell befuellt.
// Bereits migrierte Monate werden nicht ueberschrieben.
async function backfillLohnStammdaten() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const cursor = Mitarbeiter.collection
    .find({ $or: [{ arbeitszeit: { $exists: true } }, { persgruppe: { $exists: true } }, { persgruppe_set_explicitly: { $exists: true } }] })
    .project({ arbeitszeit: 1, lohnStammdaten: 1, persgruppe: 1, persgruppe_set_explicitly: 1 });

  let inspected = 0;
  let migrated = 0;
  let entriesWritten = 0;

  for await (const doc of cursor) {
    inspected += 1;

    const existing = Array.isArray(doc.lohnStammdaten) ? doc.lohnStammdaten : [];
    const merged = Mitarbeiter.collectLohnStammdaten(doc);

    migrated += 1;
    entriesWritten += Math.max(0, merged.length - existing.length);

    if (shouldWrite) {
      const result = await Mitarbeiter.collection.updateOne(
        { _id: doc._id, lohnStammdaten: doc.lohnStammdaten ?? { $exists: false } },
        { $set: { lohnStammdaten: merged }, $unset: { arbeitszeit: '', persgruppe: '', persgruppe_set_explicitly: '' } }
      );
      if (!result.matchedCount) throw new Error(`Mitarbeiter ${doc._id} wurde parallel geändert. Migration erneut starten.`);
    }
  }

  console.log(JSON.stringify({
    mode: shouldWrite ? 'write' : 'dry-run',
    inspected,
    migrated,
    entriesWritten,
    note: shouldWrite
      ? 'arbeitszeit und die aktuelle globale Personengruppe wurden nach lohnStammdaten migriert und die Legacy-Felder entfernt.'
      : 'Dry-Run: keine Daten geaendert. Mit --write wird migriert.',
  }, null, 2));
}

backfillLohnStammdaten()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
