const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Auftrag = require('../models/Auftrag');
const Kunde = require('../models/Kunde');
const Einsatz = require('../models/Einsatz');
const Mitarbeiter = require('../models/Mitarbeiter');
const logger = require('../utils/logger');
const { sendMail } = require('../EmailService');

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
      const result = await Auftrag.bulkWrite(operations);
      const inserted = result.upsertedCount || 0;
      const updated = result.modifiedCount || 0;
      const unchanged = operations.length - inserted - updated;
      
      const response = { 
        success: true, 
        message: `${operations.length} Aufträge verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${unchanged} unverändert.`,
        details: { total: operations.length, inserted, updated, unchanged }
      };
      res.json(response);
    } else {
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
      res.json(response);
    } else {
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

module.exports = router;
