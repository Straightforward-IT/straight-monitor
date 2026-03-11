const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Auftrag = require('../models/Auftrag');
const Kunde = require('../models/Kunde');
const Einsatz = require('../models/Einsatz');
const Mitarbeiter = require('../models/Mitarbeiter');
const Beruf = require('../models/Beruf');
const Qualifikation = require('../models/Qualifikation');
const ImportLog = require('../models/ImportLog');
const logger = require('../utils/logger');
const { sendMail } = require('../EmailService');
const auth = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Middleware: extend request timeout for long-running imports (10 min)
const extendTimeout = (req, res, next) => {
  req.setTimeout(600000);
  res.setTimeout(600000);
  next();
};

// Helper to log import
const logImport = async (type, filename, status, count, details, userId = null) => {
  try {
    await ImportLog.create({
      type,
      filename,
      status,
      recordCount: count,
      details,
      importedBy: userId
    });
  } catch (err) {
    logger.error(`Failed to create import log: ${err.message}`);
  }
};

// Start: Get Last Uploads
router.get('/last-uploads', async (req, res) => {
  try {
    // Aggregation to get the latest import for each type
    const latestUploads = await ImportLog.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: "$type",
          lastUpload: { $first: "$$ROOT" }
      }},
      { $replaceRoot: { newRoot: "$lastUpload" } }
    ]);
    
    // Map to a cleaner object keyed by type
    const result = {};
    latestUploads.forEach(log => {
      result[log.type] = log;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`Error fetching last uploads: ${err.message}`);
    res.status(500).json({ success: false, message: "Fehler beim Laden der Upload-Historie." });
  }
});
// End: Get Last Uploads

// Recent imports (last N, any type) – used by the dashboard widget
router.get('/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const logs = await ImportLog.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('importedBy', 'name email');
    res.json({ success: true, data: logs });
  } catch (err) {
    logger.error(`Error fetching recent imports: ${err.message}`);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Import-Historie.' });
  }
});

// Helper to parse Excel time (Date object or time string) to clean "HH:MM" string (always UTC-based)
const parseExcelTime = (val) => {
  if (!val) return null;
  // Already a clean HH:MM or HH:MM:SS string
  if (typeof val === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) {
    return val.substring(0, 5);
  }
  // Date object from xlsx cellDates: true — xlsx stores time-only values as UTC midnight + offset,
  // so getUTCHours/Minutes gives the correct local time directly (no timezone conversion needed)
  const d = (val instanceof Date) ? val : new Date(val);
  if (!isNaN(d.getTime())) {
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return String(val);
};

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
router.post('/auftrag', auth, extendTimeout, upload.single('file'), async (req, res) => {
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
      const result = await Auftrag.bulkWrite(operations);
      const inserted = result.upsertedCount || 0;
      const updated = result.modifiedCount || 0;
      const unchanged = operations.length - inserted - updated;
      
      const response = { 
        success: true, 
        message: `${operations.length} Aufträge verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${unchanged} unverändert.`,
        details: { total: operations.length, inserted, updated, unchanged }
      };

      await logImport('auftrag', req.file.originalname, 'success', operations.length, response.details, req.user?.id);

      res.json(response);
    } else {
      await logImport('auftrag', req.file.originalname, 'warning', 0, { message: 'Keine Aufträge gefunden' }, req.user?.id);
      res.json({ success: true, message: 'Keine Aufträge zum Verarbeiten gefunden.' });
    }

    const operations_length = operations.length;

    // Send email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>📊 Aufträge Import - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file.originalname}</p>
          <p><strong>Größe:</strong> ${(req.file.size / 1024).toFixed(2)} KB</p>
          <hr/>
          <h3>Ergebnis:</h3>
          <ul>
            <li>Verarbeitet: <strong>${operations_length}</strong> Aufträge</li>
            <li>Status: <strong style="color: green;">✓ Erfolgreich (Updates werden automatisch durchgeführt)</strong></li>
          </ul>
        </div>
      `;
      await sendMail('it@straightforward.email', `Aufträge Import - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send import notification email:', emailError);
    }

  } catch (error) {
    logger.error('Import Auftrag Error:', error);
    
    // Send error email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>❌ Aufträge Import Fehler - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file?.originalname || 'Unbekannt'}</p>
          <hr/>
          <h3>Fehler:</h3>
          <p style="color: red;">${error.message}</p>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${error.stack}</pre>
        </div>
      `;
      await sendMail('it@straightforward.email', `❌ Aufträge Import Fehler - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send error notification email:', emailError);
    }
    
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Aufträge.', error: error.message });
  }
});

// --- Kunde Import ---
router.post('/kunde', auth, upload.single('file'), async (req, res) => {
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
      const result = await Kunde.bulkWrite(operations);
      const inserted = result.upsertedCount || 0;
      const updated = result.modifiedCount || 0;
      const unchanged = operations.length - inserted - updated;
      
      const response = { 
        success: true, 
        message: `${operations.length} Kunden verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${unchanged} unverändert.`,
        details: { total: operations.length, inserted, updated, unchanged }
      };

      await logImport('kunde', req.file.originalname, 'success', operations.length, response.details, req.user?.id);

      res.json(response);
    } else {
      await logImport('kunde', req.file.originalname, 'warning', 0, { message: 'Keine Kunden gefunden' }, req.user?.id);
      res.json({ success: true, message: 'Keine Kunden zum Verarbeiten gefunden.' });
    }

    const operations_length = operations.length;

    // Send email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>👥 Kunden Import - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file.originalname}</p>
          <p><strong>Größe:</strong> ${(req.file.size / 1024).toFixed(2)} KB</p>
          <hr/>
          <h3>Ergebnis:</h3>
          <ul>
            <li>Verarbeitet: <strong>${operations_length}</strong> Kunden</li>
            <li>Status: <strong style="color: green;">✓ Erfolgreich (Updates werden automatisch durchgeführt)</strong></li>
          </ul>
        </div>
      `;
      await sendMail('it@straightforward.email', `Kunden Import - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send import notification email:', emailError);
    }

  } catch (error) {
    logger.error('Import Kunde Error:', error);
    
    // Send error email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>❌ Kunden Import Fehler - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file?.originalname || 'Unbekannt'}</p>
          <hr/>
          <h3>Fehler:</h3>
          <p style="color: red;">${error.message}</p>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${error.stack}</pre>
        </div>
      `;
      await sendMail('it@straightforward.email', `❌ Kunden Import Fehler - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send error notification email:', emailError);
    }
    
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Kunden.', error: error.message });
  }
});

// --- Einsatz Import (Zvoove Komplett-Export) ---
router.post('/einsatz', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Prüffeld-Validierung: Spalte A muss 7001 enthalten
    const rawCheck = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const checkStart = (rawCheck.length > 0 && isNaN(rawCheck[0][0])) ? 1 : 0;
    if (rawCheck.length > checkStart) {
      const prueffeld = parseInt(rawCheck[checkStart][0], 10);
      if (prueffeld === 7002) {
        return res.status(400).json({ success: false, message: 'Falsche Liste: Die Datei enthält das Prüffeld 7002 (Personal). Für den Einsatz-Import wird Liste 7001 erwartet.' });
      }
    }

    const rawData = XLSX.utils.sheet_to_json(sheet);

    const operationsAuftrag = [];
    const operationsKunde = [];
    const newEinsaetze = [];
    const auftragNrs = new Set();
    
    let minDate = null;
    let maxDate = null;

    // Sets to avoid duplicate operations in one batch
    const processedAuftraege = new Set();
    const processedKunden = new Set();

    for (const rawRow of rawData) {
      const row = cleanKeys(rawRow);
      // Skip if no Order Number (Main linking key)
      if (!isValidRow(row, 'AUFTRAGNR')) continue;

      const auftragNr = row['AUFTRAGNR'];
      auftragNrs.add(auftragNr);

      if (row['DATUMVON'] && row['DATUMVON'] instanceof Date && !isNaN(row['DATUMVON'])) {
        if (!minDate || row['DATUMVON'] < minDate) minDate = row['DATUMVON'];
        if (!maxDate || row['DATUMVON'] > maxDate) maxDate = row['DATUMVON'];
      }

      // 1. Prepare Auftrag Update/Upsert
      if (!processedAuftraege.has(auftragNr)) {
        processedAuftraege.add(auftragNr);
        operationsAuftrag.push({
          updateOne: {
            filter: { auftragNr: auftragNr },
            update: { $set: {
              geschSt: row['A_GESCHST'] || row['GESCHST'], // Fallback if old column name
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
            }},
            upsert: true
          }
        });
      }

      // 2. Prepare Kunde Update/Upsert
      if (isValidRow(row, 'KUNDENNR') && !processedKunden.has(row['KUNDENNR'])) {
        const kundenNr = row['KUNDENNR'];
        processedKunden.add(kundenNr);
        
        const bemerkungen = [];
        if (row['BEMERKUNG']) bemerkungen.push(String(row['BEMERKUNG']));
        if (row['BEMERKUNG2']) bemerkungen.push(String(row['BEMERKUNG2']));
        if (row['BEMERKUNG3']) bemerkungen.push(String(row['BEMERKUNG3']));

        operationsKunde.push({
          updateOne: {
            filter: { kundenNr: kundenNr },
            update: { $set: {
              kundName: row['KUNDNAME'],
              kundeSeit: row['KUNDESEIT'],
              kundStatus: row['KUNDSTATUS'],
              geschSt: row['K_GESCHST'] || row['GESCHST'],
              kostenSt: row['K_KOSTENST'] || row['KOSTENST'],
              bemerkung: bemerkungen
            }},
            upsert: true
          }
        });
      }

      // 3. Prepare Einsatz Insert
      newEinsaetze.push({
        auftragNr: auftragNr,
        personalNr: row['PERSONALNR'],
        berufSchl: row['BERUFSCHL'],
        qualSchl: row['QUALSCHL'],
        bezeichnung: row['BEZEICHN'],
        datumVon: row['DATUMVON'],
        datumBis: row['DATUMBIS'],
        cProtBediener: row['CPROTBEDIENER'],
        dtProtDatum: row['DTPROTDATUM'],
        idAuftragArbeitsschichten: row['ID_AUFTRAG_ARBEITSSCHICHTEN'],
        
        // New Detail Fields
        schichtBezeichnung: row['BEZEICHNUNG'],
        treffpunkt: row['TREFFPUNKTUHRZEIT'],
        ansprechpartnerName: row['ANSP_NAME'],
        ansprechpartnerTelefon: row['ANSP_TELEFON'],
        ansprechpartnerEmail: row['ANSP_EMAIL'],
        letzteAusschreibung: row['LETZTEAUSSCHREIBUNG'],

        detailDatumVon: row['DETAIL_DATUMVON'],
        detailDatumBis: row['DETAIL_DATUMBIS'],
        uhrzeitVon: parseExcelTime(row['UHRZEITVON']),
        uhrzeitBis: parseExcelTime(row['UHRZEITBIS']),
        typ: row['TYP'],
        bedarf: row['BEDARF'],
        garantiestundenLohn: row['GARANTIESTD_LOHN'],
        endeOffen: row['ENDEOFFEN']
      });
    }

    // Execute Operations
    let stats = {
      auftrag: { upserted: 0, matched: 0, deactivated: 0 },
      kunde: { upserted: 0, matched: 0 },
      einsatz: { inserted: 0, deleted: 0 }
    };

    // 4. Deactivate Auftraege not in the list, but only within the imported date range
    // This prevents deactivating past orders that are not part of the current export
    const deactivateQuery = { auftragNr: { $nin: Array.from(auftragNrs) }, aktiv: { $ne: 0 } };
    if (minDate && maxDate) {
      // Only deactivate orders whose date range overlaps with the imported period
      deactivateQuery.$and = [
        { bisDatum: { $gte: minDate } },
        { vonDatum: { $lte: maxDate } }
      ];
    }
    const deactivateResult = await Auftrag.updateMany(deactivateQuery, { $set: { aktiv: 0 } });
    stats.auftrag.deactivated = deactivateResult.modifiedCount;

    // 5. Cleanup Einsätze for orders that are not in the list (orphaned/cancelled)
    // Only delete within the uploaded time range to preserve other periods
    // Never delete pseudo-Einsätze (manually created)
    const cleanupFilter = { auftragNr: { $nin: Array.from(auftragNrs) }, isPseudo: { $ne: true } };
    if (minDate && maxDate) {
      cleanupFilter.datumVon = { $gte: minDate, $lte: maxDate };
    }
    const cleanupEinsaetzeResult = await Einsatz.deleteMany(cleanupFilter);
    stats.einsatz.deleted += cleanupEinsaetzeResult.deletedCount;

    if (operationsAuftrag.length > 0) {
      const resA = await Auftrag.bulkWrite(operationsAuftrag);
      stats.auftrag.upserted = resA.upsertedCount;
      stats.auftrag.matched = resA.matchedCount;
    }

    if (operationsKunde.length > 0) {
      const resK = await Kunde.bulkWrite(operationsKunde);
      stats.kunde.upserted = resK.upsertedCount;
      stats.kunde.matched = resK.matchedCount;
    }

    if (newEinsaetze.length > 0) {
      // Clean up existing entries for these orders (Full Sync for these orders)
      // Only delete within the uploaded time range
      // Never delete pseudo-Einsätze (manually created)
      const delFilter = { auftragNr: { $in: Array.from(auftragNrs) }, isPseudo: { $ne: true } };
      if (minDate && maxDate) {
        delFilter.datumVon = { $gte: minDate, $lte: maxDate };
      }
      const delRes = await Einsatz.deleteMany(delFilter);
      stats.einsatz.deleted = delRes.deletedCount;
      
      const insRes = await Einsatz.insertMany(newEinsaetze);
      stats.einsatz.inserted = insRes.length;
    }

    const message = `Verarbeitung abgeschlossen:\n` +
      `- Einsätze: ${stats.einsatz.inserted} neu, ${stats.einsatz.deleted} gelöscht/ersetzt\n` +
      `- Aufträge: ${stats.auftrag.upserted} neu, ${stats.auftrag.matched} aktualisiert, ${stats.auftrag.deactivated} deaktiviert\n` +
      `- Kunden: ${stats.kunde.upserted} neu, ${stats.kunde.matched} aktualisiert`;

    await logImport('einsatz-komplett', req.file.originalname, 'success', newEinsaetze.length, stats, req.user?.id);
    
    // Simple response structure for frontend
    res.json({ success: true, message: message, details: stats });

    // Send email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>📦 Zvoove Komplett-Import - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file.originalname}</p>
          <hr/>
          <h3>Statistik:</h3>
          <ul>
            <li><strong>Einsätze:</strong> ${stats.einsatz.inserted} (Importiert), ${stats.einsatz.deleted} (Ersetzt)</li>
            <li><strong>Aufträge:</strong> ${stats.auftrag.upserted} (Neu), ${stats.auftrag.matched} (Update)</li>
            <li><strong>Kunden:</strong> ${stats.kunde.upserted} (Neu), ${stats.kunde.matched} (Update)</li>
          </ul>
          <p style="color: green;">✓ System erfolgreich synchronisiert.</p>
        </div>
      `;
      await sendMail('it@straightforward.email', `Zvoove Import - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send import notification email:', emailError);
    }

  } catch (error) {
    logger.error('Import Einsatz Error:', error);
    
    // Send error email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      await sendMail('it@straightforward.email', `❌ Zvoove Import Fehler - ${timestamp}`, `Fehler: ${error.message}\n${error.stack}`, 'it');
    } catch (e) {}
    
    res.status(500).json({ success: false, message: 'Fehler beim Komplett-Import.', error: error.message });
  }
});

// --- Personal Import (kombiniert: Personalnr, Austrittsdatum, Beruf/Quali, Persgruppe, Email, Telefon) ---
// Spalten (mit Prüffeld): A=Prüffeld(7002), B=Personalnr, C=ignoriert, D=Austrittsdatum, E=Berufsschlüssel(komma), F=Qualischlüssel(komma), G=Persgruppe, H=Email, I=Telefon
// Spalten (ohne Prüffeld, Legacy): A=Personalnr, B=ignoriert, C=Austrittsdatum, D=Berufsschlüssel(komma), E=Qualischlüssel(komma), F=Persgruppe, G=Email, H=Telefon
router.post('/personal', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    // Pre-fetch Beruf/Quali lookup maps
    const [allBerufe, allQualis] = await Promise.all([
      Beruf.find({}).lean(),
      Qualifikation.find({}).lean(),
    ]);
    const berufMap = new Map(allBerufe.map(b => [String(b.jobKey), b._id]));
    const qualiMap = new Map(allQualis.map(q => [String(q.qualificationKey), q._id]));

    const VALID_PERSGRUPPEN = new Set([101, 110, 109, 106]);

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Skip header row if first cell looks like text
    const startRow = (rawData.length > 0 && isNaN(rawData[0][0])) ? 1 : 0;

    // Prüffeld-Validierung: Spalte A muss 7002 enthalten (falls vorhanden)
    // If present, all data columns are shifted one to the right
    let colOffset = 0;
    if (rawData.length > startRow) {
      const firstVal = parseInt(rawData[startRow][0], 10);
      if (firstVal === 7001) {
        return res.status(400).json({ success: false, message: 'Falsche Liste: Die Datei enthält das Prüffeld 7001 (Einsatz-Komplett). Für den Personal-Import wird Liste 7002 erwartet.' });
      }
      if (firstVal === 7002) {
        colOffset = 1;
      }
    }

    let matched = 0, updated = 0, unchanged = 0, skipped = 0;
    const notFoundPnrs = [];

    const operations = [];

    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 1) continue;

      const personalnr = row[0 + colOffset] != null ? String(row[0 + colOffset]).trim() : null;
      if (!personalnr) continue;

      // Col C (index 2): Austrittsdatum
      let austrittsdatum = null;
      if (row[2 + colOffset]) {
        const d = row[2 + colOffset] instanceof Date ? row[2 + colOffset] : new Date(row[2 + colOffset]);
        if (!isNaN(d.getTime())) austrittsdatum = d;
      }

      // Col D (index 3): Berufsschlüssel kommagetrennt
      // Normalize keys: "00040" → "40" so leading zeros in the Excel don't break the lookup
      const berufKeys = row[3 + colOffset]
        ? String(row[3 + colOffset]).split(',').map(k => String(parseInt(k.trim(), 10))).filter(k => k !== 'NaN')
        : [];
      const berufIds = berufKeys.map(k => berufMap.get(k)).filter(Boolean);

      // Col E (index 4): Qualifikationsschlüssel kommagetrennt
      const qualiKeys = row[4 + colOffset]
        ? String(row[4 + colOffset]).split(',').map(k => String(parseInt(k.trim(), 10))).filter(k => k !== 'NaN')
        : [];
      const qualiIds = qualiKeys.map(k => qualiMap.get(k)).filter(Boolean);

      // Col F (index 5): Personengruppe
      const persgruppRaw = row[5 + colOffset] != null ? parseInt(row[5 + colOffset], 10) : null;
      const persgruppe = persgruppRaw != null && VALID_PERSGRUPPEN.has(persgruppRaw) ? persgruppRaw : null;

      // Col G (index 6): Email
      const email = row[6 + colOffset] ? String(row[6 + colOffset]).trim().toLowerCase() : null;

      // Col H (index 7): Telefon
      const telefon = row[7 + colOffset] ? String(row[7 + colOffset]).trim() : null;

      // Build $set payload — only include fields that have a value
      const setFields = {
        berufe: berufIds,
        qualifikationen: qualiIds,
      };
      if (austrittsdatum) setFields.austrittsdatum = austrittsdatum;
      if (persgruppe != null) setFields.persgruppe = persgruppe;
      if (email) setFields.email = email;
      if (telefon) setFields.telefon = telefon;

      operations.push({ personalnr, setFields });
    }

    if (operations.length === 0) {
      return res.json({ success: true, message: 'Keine gültigen Zeilen gefunden.' });
    }

    // Execute bulk updates (find by Personalnr)
    for (const op of operations) {
      const ma = await Mitarbeiter.findOne({ personalnr: op.personalnr }).select('_id personalnr persgruppe_set_explicitly email additionalEmails').lean();
      if (!ma) {
        skipped++;
        if (notFoundPnrs.length < 30) notFoundPnrs.push(op.personalnr);
        continue;
      }
      matched++;
      // Respektiere manuell gesetztes persgruppe
      if (ma.persgruppe_set_explicitly && op.setFields.persgruppe != null) {
        delete op.setFields.persgruppe;
      }

      // Flip ist Primary Source für E-Mail: Zvoove-E-Mail darf die
      // primäre E-Mail nicht überschreiben. Stattdessen wird sie zu
      // additionalEmails hinzugefügt (falls abweichend und noch nicht vorhanden).
      const addToAdditional = [];
      if (op.setFields.email && ma.email && ma.email !== op.setFields.email) {
        const zvooveEmail = op.setFields.email;
        const existing = (ma.additionalEmails || []).map(e => e.toLowerCase());
        if (!existing.includes(zvooveEmail) && zvooveEmail !== ma.email) {
          addToAdditional.push(zvooveEmail);
        }
        delete op.setFields.email; // nicht als Primary überschreiben
      }

      const updateOps = { $set: op.setFields };
      if (addToAdditional.length > 0) {
        updateOps.$addToSet = { additionalEmails: { $each: addToAdditional } };
      }

      const result = await Mitarbeiter.updateOne({ _id: ma._id }, updateOps);
      if (result.modifiedCount > 0) updated++; else unchanged++;
    }

    const message = `${matched} Mitarbeiter aktualisiert, ${updated} geändert, ${unchanged} unverändert, ${skipped} Personalnr nicht gefunden.`;
    const responseData = {
      success: true,
      message,
      details: {
        total: operations.length,
        matched,
        updated,
        unchanged,
        notFound: skipped,
        notFoundPnrs: notFoundPnrs.length > 0 ? notFoundPnrs : undefined,
      }
    };

    await logImport('personal', req.file.originalname, 'success', matched, responseData.details, req.user?.id);
    res.json(responseData);

    // Email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const notFoundHtml = notFoundPnrs.length
        ? `<h3>ℹ️ Nicht gefunden (${skipped}):</h3><ul>${notFoundPnrs.map(p => `<li>${p}</li>`).join('')}${skipped > notFoundPnrs.length ? `<li>…und ${skipped - notFoundPnrs.length} weitere</li>` : ''}</ul>`
        : '';
      const emailContent = `
        <div style="font-family:Arial,sans-serif;color:#333">
          <h2>Personal Import (kombiniert) – ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file.originalname}</p>
          <hr/>
          <ul>
            <li>Zeilen: <strong>${operations.length}</strong></li>
            <li>Gefunden &amp; aktualisiert: <strong>${matched}</strong></li>
            <li>Davon geändert: <strong>${updated}</strong></li>
            <li>Unverändert: <strong>${unchanged}</strong></li>
            <li>Nicht gefunden: <strong>${skipped}</strong></li>
          </ul>
          ${notFoundHtml}
        </div>`;
      await sendMail('it@straightforward.email', `Personal Import – ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send import notification email:', emailError);
    }

  } catch (error) {
    logger.error('Import Personal Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren.', error: error.message });
  }
});


// --- Beruf Import ---
router.post('/beruf', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Read as array of arrays to handle column positions
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const operations = [];

    // Skip potential header row? Let's check if first row is possibly header
    // But user didn't specify, usually assumed. Let's start from 1 if row 0 looks like header, else 0.
    // However, simplest is to iterate and check if column A is a number.
    
    for (const row of rawData) {
      if (!row || row.length < 1) continue;
      
      // Column A (Index 0): Key
      // Column C (Index 2): Designation
      const keyVal = row[0];
      const designationVal = row[2];

      const jobKey = parseInt(keyVal, 10);
      if (isNaN(jobKey)) continue; // Skip header or invalid rows

      const designation = designationVal ? String(designationVal).trim() : '';
      if (!designation) continue;

      operations.push({
        updateOne: {
          filter: { jobKey: jobKey },
          update: { $set: { designation: designation } },
          upsert: true
        }
      });
    }

    if (operations.length > 0) {
      const result = await Beruf.bulkWrite(operations);
      const inserted = result.upsertedCount || 0;
      const updated = result.modifiedCount || 0;
      const unchanged = operations.length - inserted - updated;
      
      const response = { 
        success: true, 
        message: `${operations.length} Berufe verarbeitet: ${inserted} neu, ${updated} aktualisiert.`,
        details: { total: operations.length, inserted, updated, unchanged }
      };

      await logImport('beruf', req.file.originalname, 'success', operations.length, response.details, req.user?.id);
      res.json(response);

    } else {
      await logImport('beruf', req.file.originalname, 'warning', 0, { message: 'Keine gültigen Berufsdaten gefunden' }, req.user?.id);
      res.json({ success: true, message: 'Keine gültigen Berufe gefunden. (Erwarte Spalte A: Key, Spalte C: Bezeichnung)' });
    }

  } catch (error) {
    logger.error('Import Beruf Error:', error);
    await logImport('beruf', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Berufe.', error: error.message });
  }
});

// --- Qualifikation Import ---
router.post('/qualifikation', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const operations = [];

    for (const row of rawData) {
      if (!row || row.length < 1) continue;
      
      // Column A (Index 0): Key
      // Column B (Index 1): Designation
      const keyVal = row[0];
      const designationVal = row[1];

      const qualificationKey = parseInt(keyVal, 10);
      if (isNaN(qualificationKey)) continue;

      const designation = designationVal ? String(designationVal).trim() : '';
      if (!designation) continue;

      operations.push({
        updateOne: {
          filter: { qualificationKey: qualificationKey },
          update: { $set: { designation: designation } },
          upsert: true
        }
      });
    }

    if (operations.length > 0) {
      const result = await Qualifikation.bulkWrite(operations);
      const inserted = result.upsertedCount || 0;
      const updated = result.modifiedCount || 0;
      const unchanged = operations.length - inserted - updated;
      
      const response = { 
        success: true, 
        message: `${operations.length} Qualifikationen verarbeitet: ${inserted} neu, ${updated} aktualisiert.`,
        details: { total: operations.length, inserted, updated, unchanged }
      };

      await logImport('qualifikation', req.file.originalname, 'success', operations.length, response.details, req.user?.id);
      res.json(response);

    } else {
      await logImport('qualifikation', req.file.originalname, 'warning', 0, { message: 'Keine gültigen Qualifikationsdaten gefunden' }, req.user?.id);
      res.json({ success: true, message: 'Keine gültigen Qualifikationen gefunden. (Erwarte Spalte A: Key, Spalte B: Bezeichnung)' });
    }

  } catch (error) {
    logger.error('Import Qualifikation Error:', error);
    await logImport('qualifikation', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Qualifikationen.', error: error.message });
  }
});

// --- Personal Qualifikation/Beruf Import ---
router.post('/personal_quali', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    // 1. Pre-fetch all Berufe and Qualifikationen for quick lookup
    const allBerufe = await Beruf.find({}).lean();
    const allQualis = await Qualifikation.find({}).lean();
    
    // Create maps: key -> _id
    const berufMap = new Map();
    allBerufe.forEach(b => berufMap.set(b.jobKey, b._id));
    
    const qualiMap = new Map();
    allQualis.forEach(q => qualiMap.set(q.qualificationKey, q._id));
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // 2. Group data by Personalnr
    // Structure: Personalnr -> { berufKeys: Set, qualiKeys: Set }
    const personalMap = new Map();
    
    let processedRows = 0;

    for (const row of rawData) {
      if (!row || row.length < 3) continue;

      const pnr = row[0] ? String(row[0]).trim() : null;
      const jobKey = parseInt(row[1], 10);
      const qualiKey = parseInt(row[2], 10);

      if (!pnr) continue;

      if (!personalMap.has(pnr)) {
        personalMap.set(pnr, { jobs: new Set(), qualis: new Set() });
      }

      const entry = personalMap.get(pnr);
      if (!isNaN(jobKey)) entry.jobs.add(jobKey);
      if (!isNaN(qualiKey)) entry.qualis.add(qualiKey);
      
      processedRows++;
    }

    if (personalMap.size === 0) {
      await logImport('personal_quali', req.file.originalname, 'warning', 0, { message: 'Keine gültigen Zuordnungen gefunden' }, req.user?.id);
      return res.json({ success: true, message: 'Keine gültigen Daten gefunden (Spalten: A=Personalnr, B=BerufKey, C=QualiKey).' });
    }

    // 3. Update Mitarbeiter
    // For each unique personalnr found in file:
    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundPnrs = [];

    const operations = [];

    for (const [pnr, data] of personalMap.entries()) {
      // Resolve keys to IDs
      const berufIds = [];
      data.jobs.forEach(key => {
        if (berufMap.has(key)) berufIds.push(berufMap.get(key));
      });

      const qualiIds = [];
      data.qualis.forEach(key => {
        if (qualiMap.has(key)) qualiIds.push(qualiMap.get(key));
      });

      // Prepare Bulk Update operation
      // Finding user by personalnr
      // Use $set to fully replace berufe/qualifikationen — entries not in the import are removed
      operations.push({
        updateOne: {
          filter: { personalnr: pnr },
          update: { 
            $set: { 
              berufe: berufIds,
              qualifikationen: qualiIds
            } 
          }
        }
      });
    }

    if (operations.length > 0) {
      const result = await Mitarbeiter.bulkWrite(operations);
      updatedCount = result.modifiedCount;
      const matchedCount = result.matchedCount; // matched users
      
      // Calculate how many were not found (requested updates - matched)
      // Note: matchedCount might double count if pnr duplicates were processed multiple times, but here we grouped by PNR first.
      // So matchedCount == number of found employees.
      notFoundCount = operations.length - matchedCount;
      
      // Since bulkWrite doesn't return which ones failed to match easily without ordered=false and checking errors for upserts, 
      // strict 'not found list' requires a separate find or comparison.
      // For performance, we'll just report counts. 
      // If needed properly: Find all PNRs existing in DB from the Map keys first.

      const response = {
        success: true,
        message: `Zuordnungen verarbeitet: ${updatedCount} Mitarbeiter aktualisiert. (${notFoundCount} Personalnummern nicht im System)`,
        details: { totalFileRows: processedRows, uniquePersonalNrs: operations.length, updated: updatedCount, notFound: notFoundCount }
      };

      await logImport('personal_quali', req.file.originalname, 'success', operations.length, response.details, req.user?.id);
      res.json(response);

    } else {
      res.json({ success: true, message: 'Keine verarbeitbaren Operationen.' });
    }

  } catch (error) {
    logger.error('Import Personal-Quali Error:', error);
    await logImport('personal_quali', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Zuordnungen.', error: error.message });
  }
});

// --- GET all Berufe (for frontend cache) ---
router.get('/berufe', async (req, res) => {
  try {
    const berufe = await Beruf.find({}).lean();
    res.json({ success: true, data: berufe });
  } catch (error) {
    logger.error('GET Berufe Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Abrufen der Berufe.', error: error.message });
  }
});

// --- GET all Qualifikationen (for frontend cache) ---
router.get('/qualifikationen', async (req, res) => {
  try {
    const qualifikationen = await Qualifikation.find({}).lean();
    res.json({ success: true, data: qualifikationen });
  } catch (error) {
    logger.error('GET Qualifikationen Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Abrufen der Qualifikationen.', error: error.message });
  }
});


module.exports = router;
