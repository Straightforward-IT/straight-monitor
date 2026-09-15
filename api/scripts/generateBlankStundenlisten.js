const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Kunde = require('../models/Customer/Kunde');
const StundenlisteService = require('../services/operations/StundenlisteService');

const OUTPUT_DIR = path.resolve(__dirname, '../generated/stundenlisten-kcg');
const VARIANTS = [
  ...[1, 2, 3, 4, 5].map(rows => ({ name: `01-schicht-${rows}-einsatz${rows === 1 ? '' : 'e'}`, rows: [rows] })),
  { name: '02-schichten-1-1-einsaetze', rows: [1, 1] },
  { name: '02-schichten-1-3-einsaetze', rows: [1, 3] },
  { name: '02-schichten-2-5-einsaetze', rows: [2, 5] },
  { name: '02-schichten-5-5-einsaetze', rows: [5, 5] },
  { name: '03-schichten-1-1-1-einsaetze', rows: [1, 1, 1] },
  { name: '03-schichten-1-2-5-einsaetze', rows: [1, 2, 5] },
  { name: '03-schichten-3-3-3-einsaetze', rows: [3, 3, 3] },
  { name: '03-schichten-5-5-5-einsaetze', rows: [5, 5, 5] },
];

function createBlankData(kunde, rowsPerShift) {
  const schichten = rowsPerShift.map((_, index) => ({
    idAuftragArbeitsschichten: index + 1,
    bezeichnung: '',
  }));
  const einsaetze = rowsPerShift.flatMap((rowCount, shiftIndex) => (
    Array.from({ length: rowCount }, (_, rowIndex) => ({
      idAuftragArbeitsschichten: shiftIndex + 1,
      personalNr: `blank-${shiftIndex + 1}-${rowIndex + 1}`,
      mitarbeiterData: { vorname: '', nachname: '' },
    }))
  ));

  return {
    auftrag: {
    },
    kunde,
    einsaetze,
    schichten,
    niederlassung: {
      name: 'Köln',
      betriebsNr: '74934500',
      telefone: ['+49 221 777 100 22', '+49 176 769 666 39'],
      email: 'teamkoeln@straightforward.email',
    },
  };
}

async function generate() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const kunde = await Kunde.findOne({ kuerzel: 'KCG' }).lean();
  if (!kunde) throw new Error('Kunde mit kuerzel "KCG" wurde nicht gefunden');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const variant of VARIANTS) {
    const buffer = await StundenlisteService._renderPdf(createBlankData(kunde, variant.rows), {
      blankMissingValues: true,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, `Stundenliste-KCG-${variant.name}.pdf`), buffer);
  }

  console.log(`Erstellt: ${VARIANTS.length} Blanko-Stundenlisten in ${OUTPUT_DIR}`);
}

generate()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });