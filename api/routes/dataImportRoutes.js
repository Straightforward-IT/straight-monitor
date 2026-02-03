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

const upload = multer({ storage: multer.memoryStorage() });

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
      const result = await Auftrag.bulkWrite(operations);
      const inserted = result.upsertedCount || 0;
      const updated = result.modifiedCount || 0;
      const unchanged = operations.length - inserted - updated;
      
      const response = { 
        success: true, 
        message: `${operations.length} Aufträge verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${unchanged} unverändert.`,
        details: { total: operations.length, inserted, updated, unchanged }
      };

      await logImport('auftrag', req.file.originalname, 'success', operations.length, response.details, req.user?._id);

      res.json(response);
    } else {
      await logImport('auftrag', req.file.originalname, 'warning', 0, { message: 'Keine Aufträge gefunden' }, req.user?._id);
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
      const result = await Kunde.bulkWrite(operations);
      const inserted = result.upsertedCount || 0;
      const updated = result.modifiedCount || 0;
      const unchanged = operations.length - inserted - updated;
      
      const response = { 
        success: true, 
        message: `${operations.length} Kunden verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${unchanged} unverändert.`,
        details: { total: operations.length, inserted, updated, unchanged }
      };

      await logImport('kunde', req.file.originalname, 'success', operations.length, response.details, req.user?._id);

      res.json(response);
    } else {
      await logImport('kunde', req.file.originalname, 'warning', 0, { message: 'Keine Kunden gefunden' }, req.user?._id);
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

    const result = { success: true, message: `${newEinsaetze.length} Einsätze verarbeitet (alte für betroffene Aufträge ersetzt).` };
    await logImport('einsatz', req.file.originalname, 'success', newEinsaetze.length, { auftragNrsCount: auftragNrs.size }, req.user?._id);
    res.json(result);

    // Send email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>📅 Einsätze Import - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file.originalname}</p>
          <p><strong>Größe:</strong> ${(req.file.size / 1024).toFixed(2)} KB</p>
          <hr/>
          <h3>Ergebnis:</h3>
          <ul>
            <li>Verarbeitet: <strong>${newEinsaetze.length}</strong> Einsätze</li>
            <li>Betroffene Aufträge: <strong>${auftragNrs.size}</strong></li>
            <li>Status: <strong style="color: green;">✓ Erfolgreich</strong></li>
          </ul>
          <p><em>Alte Einsätze für betroffene Aufträge wurden ersetzt.</em></p>
        </div>
      `;
      await sendMail('it@straightforward.email', `Einsätze Import - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send import notification email:', emailError);
    }

  } catch (error) {
    logger.error('Import Einsatz Error:', error);
    
    // Send error email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>❌ Einsätze Import Fehler - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file?.originalname || 'Unbekannt'}</p>
          <hr/>
          <h3>Fehler:</h3>
          <p style="color: red;">${error.message}</p>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${error.stack}</pre>
        </div>
      `;
      await sendMail('it@straightforward.email', `❌ Einsätze Import Fehler - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send error notification email:', emailError);
    }
    
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Einsätze.', error: error.message });
  }
});

// --- Personal Import (Personalnummern) ---
// Verknüpft Mitarbeiter mit Personalnummern aus Zvoove anhand der E-Mail
router.post('/personal', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Read as array of arrays

    let matched = 0;
    let updated = 0;
    let unchanged = 0;
    let notFound = 0;
    let conflicts = 0;
    const notFoundEntries = [];
    const conflictDetails = [];
    const updateErrors = [];

    // Skip header row if present (check if first row looks like headers)
    const startRow = (rawData.length > 0 && typeof rawData[0][0] === 'string' && 
                      (rawData[0][0].toLowerCase().includes('personal') || 
                       rawData[0][0].toLowerCase().includes('nr') ||
                       rawData[0][1]?.toLowerCase().includes('mail'))) ? 1 : 0;

    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 2) continue;

      const personalnr = row[0] ? String(row[0]).trim() : null;
      const email = row[1] ? String(row[1]).trim().toLowerCase() : null;

      if (!personalnr || !email) continue;

      // Find Mitarbeiter by primary email OR in additionalEmails array
      let mitarbeiter = await Mitarbeiter.findOne({ email: email });
      if (!mitarbeiter) {
        mitarbeiter = await Mitarbeiter.findOne({ additionalEmails: email });
      }

      if (mitarbeiter) {
        matched++;

        // Check if personalnr needs to be updated
        if (mitarbeiter.personalnr === personalnr) {
          unchanged++;
          continue;
        }

        // Check if this personalnr is already used by another Mitarbeiter (conflict)
        const existingWithSameNr = await Mitarbeiter.findOne({ 
          personalnr: personalnr,
          _id: { $ne: mitarbeiter._id }
        });

        if (existingWithSameNr) {
          conflicts++;
          conflictDetails.push({
            personalnr: personalnr,
            email: email,
            name: `${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
            conflictWith: {
              email: existingWithSameNr.email,
              name: `${existingWithSameNr.vorname} ${existingWithSameNr.nachname}`
            }
          });
          continue;
        }

        try {
          // Update with history tracking
          const updateData = {
            personalnr: personalnr
          };

          // Add to history if there was a previous value
          if (mitarbeiter.personalnr) {
            updateData.$push = {
              personalnrHistory: {
                value: mitarbeiter.personalnr,
                updatedAt: new Date(),
                updatedBy: 'system',
                source: 'import'
              }
            };
          }

          await Mitarbeiter.updateOne(
            { _id: mitarbeiter._id },
            updateData
          );
          updated++;
        } catch (updateError) {
          updateErrors.push({
            email: email,
            personalnr: personalnr,
            error: updateError.message
          });
        }
      } else {
        notFound++;
        if (notFoundEntries.length < 20) { // Limit to first 20 for the response
          notFoundEntries.push({ email, personalnr });
        }
      }
    }

    let message = `${matched} Mitarbeiter gefunden, ${updated} Personalnummern aktualisiert`;
    if (unchanged > 0) message += `, ${unchanged} unverändert`;
    if (conflicts > 0) message += `, ${conflicts} Konflikte`;
    if (notFound > 0) message += `, ${notFound} E-Mails nicht gefunden`;
    message += '.';

    const response = { 
      success: conflicts === 0 && updateErrors.length === 0, 
      message,
      details: {
        matched,
        updated,
        unchanged,
        conflicts,
        notFound,
        conflictDetails: conflictDetails.length > 0 ? conflictDetails : undefined,
        notFoundEntries: notFoundEntries.length > 0 ? notFoundEntries : undefined,
        updateErrors: updateErrors.length > 0 ? updateErrors : undefined
      }
    };

    await logImport('personal', req.file.originalname, response.success ? 'success' : 'warning', matched, response.details, req.user?._id);

    res.json(response);

    // Send email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      let conflictsHtml = '';
      if (conflictDetails.length > 0) {
        conflictsHtml = '<h3 style="color: orange;">⚠️ Konflikte:</h3><ul>';
        conflictDetails.forEach(c => {
          conflictsHtml += `<li><strong>Personalnr ${c.personalnr}</strong> für ${c.name} (${c.email})<br/>wird bereits verwendet von ${c.conflictWith.name} (${c.conflictWith.email})</li>`;
        });
        conflictsHtml += '</ul>';
      }
      
      let notFoundHtml = '';
      if (notFoundEntries.length > 0) {
        notFoundHtml = '<h3>ℹ️ Nicht gefunden:</h3><ul>';
        notFoundEntries.forEach(entry => {
          notFoundHtml += `<li>${entry.email} (Personalnr: ${entry.personalnr})</li>`;
        });
        notFoundHtml += '</ul>';
      }
      
      const statusColor = response.success ? 'green' : 'orange';
      const statusIcon = response.success ? '✓' : '⚠';
      
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Personal Import - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file.originalname}</p>
          <p><strong>Größe:</strong> ${(req.file.size / 1024).toFixed(2)} KB</p>
          <hr/>
          <h3>Ergebnis:</h3>
          <ul>
            <li>Gefunden: <strong>${matched}</strong> Mitarbeiter</li>
            <li>Aktualisiert: <strong>${updated}</strong> Personalnummern</li>
            <li>Unverändert: <strong>${unchanged}</strong></li>
            <li>Konflikte: <strong>${conflicts}</strong></li>
            <li>Nicht gefunden: <strong>${notFound}</strong> E-Mails</li>
            <li>Status: <strong style="color: ${statusColor};">${statusIcon} ${response.success ? 'Erfolgreich' : 'Mit Warnungen'}</strong></li>
          </ul>
          ${conflictsHtml}
          ${notFoundHtml}
        </div>
      `;
      await sendMail('it@straightforward.email', `Personal Import - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send import notification email:', emailError);
    }

  } catch (error) {
    logger.error('Import Personal Error:', error);
    
    // Send error email notification
    try {
      const timestamp = new Date().toLocaleString('de-DE');
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>❌ Personal Import Fehler - ${timestamp}</h2>
          <p><strong>Datei:</strong> ${req.file?.originalname || 'Unbekannt'}</p>
          <hr/>
          <h3>Fehler:</h3>
          <p style="color: red;">${error.message}</p>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${error.stack}</pre>
        </div>
      `;
      await sendMail('it@straightforward.email', `❌ Personal Import Fehler - ${timestamp}`, emailContent, 'it');
    } catch (emailError) {
      logger.error('Failed to send error notification email:', emailError);
    }
    
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Personalnummern.', error: error.message });
  }
});

// --- Beruf Import ---
router.post('/beruf', upload.single('file'), async (req, res) => {
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

      await logImport('beruf', req.file.originalname, 'success', operations.length, response.details, req.user?._id);
      res.json(response);

    } else {
      await logImport('beruf', req.file.originalname, 'warning', 0, { message: 'Keine gültigen Berufsdaten gefunden' }, req.user?._id);
      res.json({ success: true, message: 'Keine gültigen Berufe gefunden. (Erwarte Spalte A: Key, Spalte C: Bezeichnung)' });
    }

  } catch (error) {
    logger.error('Import Beruf Error:', error);
    await logImport('beruf', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?._id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Berufe.', error: error.message });
  }
});

// --- Qualifikation Import ---
router.post('/qualifikation', upload.single('file'), async (req, res) => {
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

      await logImport('qualifikation', req.file.originalname, 'success', operations.length, response.details, req.user?._id);
      res.json(response);

    } else {
      await logImport('qualifikation', req.file.originalname, 'warning', 0, { message: 'Keine gültigen Qualifikationsdaten gefunden' }, req.user?._id);
      res.json({ success: true, message: 'Keine gültigen Qualifikationen gefunden. (Erwarte Spalte A: Key, Spalte B: Bezeichnung)' });
    }

  } catch (error) {
    logger.error('Import Qualifikation Error:', error);
    await logImport('qualifikation', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?._id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Qualifikationen.', error: error.message });
  }
});

// --- Personal Qualifikation/Beruf Import ---
router.post('/personal_quali', upload.single('file'), async (req, res) => {
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
      await logImport('personal_quali', req.file.originalname, 'warning', 0, { message: 'Keine gültigen Zuordnungen gefunden' }, req.user?._id);
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
      operations.push({
        updateOne: {
          filter: { personalnr: pnr },
          update: { 
            $addToSet: { 
              berufe: { $each: berufIds },
              qualifikationen: { $each: qualiIds }
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

      await logImport('personal_quali', req.file.originalname, 'success', operations.length, response.details, req.user?._id);
      res.json(response);

    } else {
      res.json({ success: true, message: 'Keine verarbeitbaren Operationen.' });
    }

  } catch (error) {
    logger.error('Import Personal-Quali Error:', error);
    await logImport('personal_quali', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?._id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Zuordnungen.', error: error.message });
  }
});



module.exports = router;
