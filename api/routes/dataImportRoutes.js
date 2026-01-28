const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Auftrag = require('../models/Auftrag');
const Kunde = require('../models/Kunde');
const Einsatz = require('../models/Einsatz');
const logger = require('../utils/logger'); // Assuming logger exists based on app.js

const upload = multer({ storage: multer.memoryStorage() });

// Helper to clean keys (trim spaces)
const cleanKeys = (obj) => {
  const newObj = {};
  Object.keys(obj).forEach(key => {
    newObj[key.trim()] = obj[key];
  });
  return newObj;
};

// Helper to filter valid rows (e.g., rows with essential IDs)
const isValidRow = (row, idField) => {
  return row && row[idField] !== undefined && row[idField] !== null;
};

// --- Auftrag Import ---
router.post('/auftrag', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // raw: false attempts to format, but true keeps original which might be better for numbers. 
    // cellDates: true converts Excel dates to JS Date objects.
    const rawData = XLSX.utils.sheet_to_json(sheet);

    const operations = [];

    for (const rawRow of rawData) {
      const row = cleanKeys(rawRow);
      
      if (!isValidRow(row, 'AUFTRAGNR')) continue;

      const filter = { auftragNr: row['AUFTRAGNR'] };
      const update = {
        geschSt: row['GESCHST'],
        kundenNr: row['KUNDENNR'],
        eventTitel: row['EVENTTITEL'],
        bediener: row['BEDIENER'],
        dtAngelegtAm: row['DTANGELEGTAM'],
        bestDatum: row['BESTDATUM'],
        vonDatum: row['VONDATUM'],
        bisDatum: row['BISDATUM'],
        eventStrasse: row['EVENT_STRASSE'],
        eventPlz: row['EVENT_PLZ'],
        eventOrt: row['EVENT_ORT'],
        eventLocation: row['EVENT_LOCATION'],
        aktiv: row['AKTIV'],
        auftStatus: row['AUFTSTATUS']
      };

      operations.push({
        updateOne: {
          filter: filter,
          update: { $set: update },
          upsert: true
        }
      });
    }

    if (operations.length > 0) {
      await Auftrag.bulkWrite(operations);
    }

    res.json({ success: true, message: `${operations.length} Aufträge verarbeitet.` });

  } catch (error) {
    logger.error('Import Auftrag Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Aufträge.', error: error.message });
  }
});

// --- Kunde Import ---
router.post('/kunde', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    const operations = [];

    for (const rawRow of rawData) {
      const row = cleanKeys(rawRow);
      
      if (!isValidRow(row, 'KUNDENNR')) continue;

      const bemerkungen = [];
      if (row['BEMERKUNG']) bemerkungen.push(String(row['BEMERKUNG']));
      if (row['BEMERKUNG2']) bemerkungen.push(String(row['BEMERKUNG2']));
      if (row['BEMERKUNG3']) bemerkungen.push(String(row['BEMERKUNG3']));

      const filter = { kundenNr: row['KUNDENNR'] };
      const update = {
        kundName: row['KUNDNAME'],
        kundeSeit: row['KUNDESEIT'],
        kundStatus: row['KUNDSTATUS'],
        geschSt: row['GESCHST'],
        kostenSt: row['KOSTENST'],
        bemerkung: bemerkungen
      };

      operations.push({
        updateOne: {
          filter: filter,
          update: { $set: update },
          upsert: true
        }
      });
    }

    if (operations.length > 0) {
      await Kunde.bulkWrite(operations);
    }

    res.json({ success: true, message: `${operations.length} Kunden verarbeitet.` });

  } catch (error) {
    logger.error('Import Kunde Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Kunden.', error: error.message });
  }
});

// --- Einsatz Import ---
router.post('/einsatz', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    // For Einsätze, maybe we want to delete old ones or just add?
    // strategy: insertMany. Duplicates might happen if we import same file twice.
    // Ideally we would delete for the imported AuftragNrs first, or have a unique key.
    // For now: Plain Insert.
    
    // Better strategy: Delete all Einsätze contained in the imported file's AUFTRAGNR list, then insert new ones.
    // This allows updating an Auftrag's shifts by re-uploading.
    
    const newEinsaetze = [];
    const auftragNrs = new Set();

    for (const rawRow of rawData) {
      const row = cleanKeys(rawRow);
      if (!isValidRow(row, 'AUFTRAGNR')) continue;

      auftragNrs.add(row['AUFTRAGNR']);

      newEinsaetze.push({
        auftragNr: row['AUFTRAGNR'],
        personalNr: row['PERSONALNR'],
        berufSchl: row['BERUFSCHL'],
        qualSchl: row['QUALSCHL'],
        bezeichnung: row['BEZEICHN'],
        datumVon: row['DATUMVON'],
        datumBis: row['DATUMBIS'],
        cProtBediener: row['CPROTBEDIENER'],
        dtProtDatum: row['DTPROTDATUM'],
        idAuftragArbeitsschichten: row['ID_AUFTRAG_ARBEITSSCHICHTEN']
      });
    }

    if (newEinsaetze.length > 0) {
      // Clean up existing entries for these orders to avoid duplication on re-import
      await Einsatz.deleteMany({ auftragNr: { $in: Array.from(auftragNrs) } });
      
      await Einsatz.insertMany(newEinsaetze);
    }

    res.json({ success: true, message: `${newEinsaetze.length} Einsätze verarbeitet (alte für betroffene Aufträge ersetzt).` });

  } catch (error) {
    logger.error('Import Einsatz Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Einsätze.', error: error.message });
  }
});

module.exports = router;
