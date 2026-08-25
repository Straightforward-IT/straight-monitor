const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Auftrag = require('../../models/Event/Auftrag');
const Kunde = require('../../models/Customer/Kunde');
const Einsatz = require('../../models/Event/Einsatz');
const Schicht = require('../../models/Event/Schicht');
const Location = require('../../models/System/Location');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Beruf = require('../../models/Event/Beruf');
const Qualifikation = require('../../models/Event/Qualifikation');
const Lohnart = require('../../models/Payroll/Lohnart');
const Kundenpreis = require('../../models/Customer/Kundenpreis');
const KundenKondition = require('../../models/Customer/KundenKondition');
const ImportLog = require('../../models/System/ImportLog');
const Rechnung = require('../../models/Rechnung');
const DispoEintrag = require('../../models/System/DispoEintrag');
const ZvooveVerfuegbarkeit = require('../../models/System/ZvooveVerfuegbarkeit');
const Adresse = require('../../models/System/Adresse');
const Einsatzort = require('../../models/Event/Einsatzort');
const User = require('../../models/System/User');
const logger = require('../../utils/logger');
const { sendMail } = require('../../services/integrations/EmailService');
const auth = require('../../middleware/auth');
const { encryptField } = require('../../utils/encryption');
const { deleteManyFlipUsers } = require('../../services/integrations/FlipService');
const { completeTaskById } = require('../../services/integrations/AsanaService');

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

// Helper to clean keys (trim spaces and normalize to uppercase)
const cleanKeys = (obj) => {
  const newObj = {};
  Object.keys(obj).forEach(key => {
    newObj[key.trim().toUpperCase()] = obj[key];
  });
  return newObj;
};

const optionalText = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const normalizeNumericIdentifier = (value) => {
  const text = optionalText(value);
  if (!text) return null;
  return /^\d+(?:[.,]0+)?$/.test(text)
    ? String(Number.parseInt(text, 10))
    : text;
};

const parseExcelDate = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  const match = String(value).trim().match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\.(\d{1,2})\.(\d{4}))$/);
  if (!match) return null;
  const year = Number(match[1] || match[6]);
  const month = Number(match[2] || match[5]);
  const day = Number(match[3] || match[4]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? parsed
    : null;
};

const parseEuroCents = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:[,\.]|$))/g, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

const parseDecimal = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

async function migrateEinsatzortImportKey() {
  const indexes = await Einsatzort.collection.indexes();
  for (const indexName of ['einsortNr_1', 'adresseNummer_1']) {
    if (indexes.some((index) => index.name === indexName)) {
      await Einsatzort.collection.dropIndex(indexName);
    }
  }

  const [legacySites, keyedSites] = await Promise.all([
    Einsatzort.find({
    adresse: { $ne: null },
    $or: [{ addressKey: { $exists: false } }, { addressKey: '' }],
    }).select('_id adresse').lean(),
    Einsatzort.find({ addressKey: { $exists: true, $ne: '' } }).select('addressKey').lean(),
  ]);
  if (legacySites.length) {
    const addresses = await Adresse.find({ _id: { $in: legacySites.map((site) => site.adresse) } })
      .select('_id strasse').lean();
    const addressKeyById = new Map(addresses.map((address) => [String(address._id), optionalText(address.strasse)]));
    const usedAddressKeys = new Set(keyedSites.map((site) => site.addressKey));
    const operations = legacySites
      .map((site) => ({ site, addressKey: addressKeyById.get(String(site.adresse)) }))
      .filter(({ addressKey }) => addressKey)
      .map(({ site, addressKey }) => {
        if (usedAddressKeys.has(addressKey)) {
          return { updateOne: { filter: { _id: site._id }, update: { $set: { isActive: false } } } };
        }
        usedAddressKeys.add(addressKey);
        return { updateOne: { filter: { _id: site._id }, update: { $set: { addressKey } } } };
      });
    if (operations.length) await Einsatzort.bulkWrite(operations);
  }

  await Einsatzort.collection.createIndex({ addressKey: 1 }, { unique: true, sparse: true });
}

// --- Adressen Import (Zvoove Liste 7034) ---
router.post('/adressen', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawCheck = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const checkStart = rawCheck.length > 0 && Number.isNaN(Number(rawCheck[0][0])) ? 1 : 0;
    if (rawCheck.length > checkStart && Number(rawCheck[checkStart][0]) !== 7034) {
      return res.status(400).json({ success: false, message: 'Falsche Liste: Für den Adressen-Import wird Prüffeld 7034 erwartet.' });
    }

    const operations = [];
    let skipped = 0;
    for (const rawRow of XLSX.utils.sheet_to_json(sheet, { defval: '' })) {
      const row = cleanKeys(rawRow);
      const nummer = optionalText(row.NUMMER);
      const art = optionalText(row.ART)?.toUpperCase();
      if (!nummer || !['K', 'A', 'P'].includes(art)) {
        skipped += 1;
        continue;
      }

      const name1 = optionalText(row.NAME1);
      const name2 = optionalText(row.NAME2);
      const telefone = [optionalText(row.TELEFON1), optionalText(row.TELEFON2)].filter(Boolean);
      operations.push({
        updateOne: {
          filter: { nummer },
          update: {
            $set: {
              art,
              name1,
              name2,
              name: [name1, name2].filter(Boolean).join(' ') || null,
              branche: optionalText(row.BRANCHE),
              strasse: optionalText(row.STRASSE),
              nat: optionalText(row.NAT),
              plz: optionalText(row.PLZ),
              ort: optionalText(row.ORT),
              telefone,
              land: optionalText(row.LAND),
              anrede: optionalText(row.ANREDE),
              knr: optionalText(row.KNR),
              trans: optionalText(row.TRANS),
              email: optionalText(row.EMAIL)?.toLowerCase() || null,
              homepage: optionalText(row.HOMEPAGE),
              importiertAm: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (!operations.length) {
      await logImport('adressen', req.file.originalname, 'warning', 0, { skipped });
      return res.json({ success: true, message: 'Keine gültigen Adressen zum Verarbeiten gefunden.', details: { total: 0, inserted: 0, updated: 0, unchanged: 0, skipped } });
    }

    const result = await Adresse.bulkWrite(operations);
    const inserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    const unchanged = operations.length - inserted - updated;
    const details = { total: operations.length, inserted, updated, unchanged, skipped };
    await logImport('adressen', req.file.originalname, 'success', operations.length, details, req.user?.id);
    res.json({
      success: true,
      message: `${operations.length} Adressen verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${unchanged} unverändert${skipped ? `, ${skipped} übersprungen` : ''}.`,
      details,
    });
  } catch (error) {
    logger.error('Import Adressen Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Adressen.', error: error.message });
  }
});

// --- Einsatzorte Import (Zvoove Liste 3202) ---
router.post('/einsatzorte', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawCheck = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const checkStart = rawCheck.length > 0 && Number.isNaN(Number(rawCheck[0][0])) ? 1 : 0;
    if (rawCheck.length > checkStart && Number(rawCheck[checkStart][0]) !== 3202) {
      return res.status(400).json({ success: false, message: 'Falsche Liste: Für den Einsatzorte-Import wird Prüffeld 3202 erwartet.' });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(cleanKeys);
    const customerAddressNumbers = new Set();
    const validRows = [];
    let skipped = 0;

    for (const row of rows) {
      const addressKey = optionalText(row.ADRESSE);
      if (!addressKey) {
        skipped += 1;
        continue;
      }

      const customerAddressNumber = optionalText(row.ADRNR);
      validRows.push({ row, addressKey, customerAddressNumber });
      if (customerAddressNumber) customerAddressNumbers.add(customerAddressNumber);
    }

    if (!validRows.length) {
      const details = { total: 0, inserted: 0, updated: 0, unchanged: 0, skipped };
      await logImport('einsatzort', req.file.originalname, 'warning', 0, details, req.user?.id);
      return res.json({ success: true, message: 'Keine gültigen Einsatzorte zum Verarbeiten gefunden.', details });
    }

    await migrateEinsatzortImportKey();

    const addressOperations = [];
    for (const { row, addressKey } of validRows) {
      const name = optionalText(row.ADRESSNAME);
      addressOperations.push({
        updateOne: {
          filter: { nummer: `EINSATZORT-${crypto.createHash('sha256').update(addressKey).digest('hex').slice(0, 24)}` },
          update: {
            $set: {
              art: 'K',
              name1: name,
              name2: null,
              name,
              strasse: optionalText(row.ADRESSE),
              plz: optionalText(row.ADRESSE_PLZ),
              ort: optionalText(row.ADRESSE_ORT),
              land: 'Deutschland',
              importiertAm: new Date(),
            },
          },
          upsert: true,
        },
      });
    }
    await Adresse.bulkWrite(addressOperations);

    const [addresses, customers] = await Promise.all([
      Adresse.find({ nummer: { $in: validRows.map(({ addressKey }) => `EINSATZORT-${crypto.createHash('sha256').update(addressKey).digest('hex').slice(0, 24)}`) } }).select('_id nummer').lean(),
      Kunde.find({ 'adressen.nummer': { $in: [...customerAddressNumbers] } }).select('_id adressen.nummer').lean(),
    ]);
    const addressesByKey = new Map(addresses.map((address) => [String(address.nummer).replace('EINSATZORT-', ''), address]));
    const customersByAddressNumber = new Map();
    for (const customer of customers) {
      for (const address of customer.adressen || []) {
        const addressNumber = optionalText(address.nummer);
        if (addressNumber && customerAddressNumbers.has(addressNumber) && !customersByAddressNumber.has(addressNumber)) {
          customersByAddressNumber.set(addressNumber, customer);
        }
      }
    }
    const operations = [];
    const resolution = { adresse: 0, kunde: 0, kundenUnaufgeloest: 0 };
    for (const { row, addressKey, customerAddressNumber } of validRows) {
      const addressHash = crypto.createHash('sha256').update(addressKey).digest('hex').slice(0, 24);
      const address = addressesByKey.get(addressHash);
      const customer = customerAddressNumber ? customersByAddressNumber.get(customerAddressNumber) : null;
      if (address) resolution.adresse += 1;
      if (customer) resolution.kunde += 1;
      else if (customerAddressNumber) resolution.kundenUnaufgeloest += 1;

      operations.push({
        updateOne: {
          filter: { addressKey },
          update: {
            $set: {
              bezeichnung: optionalText(row.BEZEICHN) || '',
              addressKey,
              adresse: address?._id || null,
              kunde: customer?._id || null,
              kundenAdresseNr: customerAddressNumber || '',
              bundesland: optionalText(row.BUNDESLAND) || '',
            },
          },
          upsert: true,
        },
      });
    }

    const result = await Einsatzort.bulkWrite(operations);
    const inserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    const unchanged = operations.length - inserted - updated;
    const details = { total: operations.length, inserted, updated, unchanged, skipped, resolution };
    await logImport('einsatzort', req.file.originalname, 'success', operations.length, details, req.user?.id);
    res.json({
      success: true,
      message: `${operations.length} Einsatzorte verarbeitet: ${inserted} neu, ${updated} aktualisiert, ${unchanged} unverändert${skipped ? `, ${skipped} übersprungen` : ''}.`,
      details,
    });
  } catch (error) {
    logger.error('Import Einsatzorte Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Einsatzorte.', error: error.message });
  }
});

// Helper to filter valid rows (e.g., rows with essential IDs)
const isValidRow = (row, idField) => {
  return row && row[idField] !== undefined && row[idField] !== null;
};

// Helper to build Kunden-Adressen from the ADR1_/ADR2_/ADR3_ columns of the 7001 export.
// Skips address blocks without a NUMMER (empty join result).
const buildAdressen = (row) => {
  const adressen = [];
  for (const prefix of ['ADR1', 'ADR2', 'ADR3']) {
    const nummer = row[`${prefix}_NUMMER`];
    if (nummer === undefined || nummer === null || nummer === '') continue;
    const trim = (v) => (typeof v === 'string' ? v.trim() : v);
    const name = trim(row[`${prefix}_LNAME`]);
    adressen.push({
      nummer,
      name: name || undefined,
      branche: trim(row[`${prefix}_BRANCHE`]) || undefined,
      lbranche: trim(row[`${prefix}_LBRANCHE`]) || undefined,
      strasse: trim(row[`${prefix}_STRASSE`]) || undefined,
      plz: row[`${prefix}_PLZ`] != null ? String(row[`${prefix}_PLZ`]).trim() : undefined,
      ort: trim(row[`${prefix}_ORT`]) || undefined,
      land: trim(row[`${prefix}_LAND`]) || undefined,
      telefon1: row[`${prefix}_TELEFON1`] != null ? String(row[`${prefix}_TELEFON1`]).trim() : undefined,
      telefon2: row[`${prefix}_TELEFON2`] != null ? String(row[`${prefix}_TELEFON2`]).trim() : undefined,
      email: trim(row[`${prefix}_EMAIL`]) || undefined,
      homepage: trim(row[`${prefix}_HOMEPAGE`]) || undefined
    });
  }
  return adressen;
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

    const activeLocations = await Location.find({ isActive: true })
      .select('_id externalId')
      .lean();
    const locationsByExternalId = new Map();
    const duplicateExternalIds = new Set();
    for (const location of activeLocations) {
      const externalId = String(location.externalId || '').trim();
      if (!externalId) continue;
      if (locationsByExternalId.has(externalId)) duplicateExternalIds.add(externalId);
      else locationsByExternalId.set(externalId, location);
    }
    if (duplicateExternalIds.size) {
      return res.status(409).json({
        success: false,
        message: `Doppelte externe Standort-IDs: ${[...duplicateExternalIds].join(', ')}. Import abgebrochen.`,
      });
    }

    const operationsAuftrag = [];
    const operationsKunde = [];
    const newEinsaetze = [];
    const newSchichten = [];
    const processedSchichten = new Set(); // Dedup: (auftragNr, idSchicht, datumVon)
    const auftragNrs = new Set();
    
    let minDate = null;
    let maxDate = null;

    // Sets to avoid duplicate operations in one batch
    const processedAuftraege = new Set();
    const processedKunden = new Set();
    const locationResolution = {
      auftrag: { resolved: 0, unresolved: 0 },
      kunde: { resolved: 0, unresolved: 0, customerNumberFallback: 0 },
      schicht: { resolved: 0, unresolved: 0 },
      einsatz: { resolved: 0, unresolved: 0 },
      unresolvedEntries: [],
    };

    function resolveLocation(externalId, entity, context, source) {
      const normalizedExternalId = String(externalId || '').trim();
      const location = normalizedExternalId ? locationsByExternalId.get(normalizedExternalId) : null;
      if (location) {
        locationResolution[entity].resolved += 1;
        if (source === 'kundenNr') locationResolution.kunde.customerNumberFallback += 1;
        return location;
      }

      locationResolution[entity].unresolved += 1;
      if (locationResolution.unresolvedEntries.length < 30) {
        locationResolution.unresolvedEntries.push({
          entity,
          externalId: normalizedExternalId || null,
          source,
          ...context,
        });
      }
      return null;
    }

    for (const rawRow of rawData) {
      const row = cleanKeys(rawRow);
      // Skip if no Order Number (Main linking key)
      if (!isValidRow(row, 'AUFTRAGNR')) continue;

      const auftragNr = row['AUFTRAGNR'];
      auftragNrs.add(auftragNr);
      const auftragGeschSt = row['A_GESCHST'] || row['GESCHST'];

      // IST_PSEUDO=1 means the row represents an unfilled shift (no real employee)
      // Pseudo rows have no DATUMVON/DATUMBIS (no employee assigned), use DETAIL_DATUMVON as fallback
      const isPseudoRow = row['IST_PSEUDO'] == 1;
      const rowDate = row['DATUMVON'] || row['DETAIL_DATUMVON'];

      if (rowDate && rowDate instanceof Date && !isNaN(rowDate)) {
        if (!minDate || rowDate < minDate) minDate = rowDate;
        if (!maxDate || rowDate > maxDate) maxDate = rowDate;
      }

      // 1. Prepare Auftrag Update/Upsert
      if (!processedAuftraege.has(auftragNr)) {
        processedAuftraege.add(auftragNr);
        const auftragLocation = resolveLocation(auftragGeschSt, 'auftrag', { auftragNr }, 'geschSt');
        const auftragFields = {
          geschSt: auftragGeschSt,
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
          auftStatus: row['AUFTSTATUS'],
          referenz: row['REFERENZ'] || undefined,
        };
        if (auftragLocation) auftragFields.locationV2 = auftragLocation._id;
        operationsAuftrag.push({
          updateOne: {
            filter: { auftragNr: auftragNr },
            update: { $set: auftragFields },
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

        const adressen = buildAdressen(row);
        const kundenGeschSt = row['K_GESCHST'] || row['GESCHST'];
        const kundenSource = kundenGeschSt ? 'geschSt' : 'kundenNr';
        const kundenLocation = resolveLocation(
          kundenGeschSt || String(kundenNr).trim().match(/^\d/)?.[0],
          'kunde',
          { kundenNr },
          kundenSource,
        );
        const kundenFields = {
          kundName: row['KUNDNAME'],
          kundeSeit: row['KUNDESEIT'],
          kundStatus: row['KUNDSTATUS'],
          geschSt: kundenGeschSt,
          kostenSt: row['K_KOSTENST'] || row['KOSTENST'],
          bemerkung: bemerkungen,
          adressen,
        };
        if (kundenLocation) kundenFields.locationV2 = kundenLocation._id;

        operationsKunde.push({
          updateOne: {
            filter: { kundenNr: kundenNr },
            update: { $set: kundenFields },
            upsert: true
          }
        });
      }

      // 3. Schicht Record (one per unique shift+date, regardless of IST_PSEUDO)
      // rowDate is already computed above: DATUMVON (real rows) or DETAIL_DATUMVON (pseudo rows)
      const idSchicht = row['ID_AUFTRAG_ARBEITSSCHICHTEN'];
      const schichtKey = `${auftragNr}_${idSchicht}_${rowDate instanceof Date ? rowDate.getTime() : rowDate}`;
      if (idSchicht && !processedSchichten.has(schichtKey)) {
        processedSchichten.add(schichtKey);
        const bedarf = typeof row['BEDARF'] === 'number' ? row['BEDARF'] : (parseInt(row['BEDARF']) || 0);
        const schichtLocation = resolveLocation(auftragGeschSt, 'schicht', { auftragNr, idSchicht }, 'geschSt');
        newSchichten.push({
          auftragNr,
          ...(schichtLocation ? { locationV2: schichtLocation._id } : {}),
          idAuftragArbeitsschichten: idSchicht,
          bezeichnung: row['BEZEICHNUNG'],
          treffpunkt: row['TREFFPUNKTUHRZEIT'],
          treffpunktOrt: row['TREFFPUNKTORT'],
          ansprechpartnerName: row['ANSP_NAME'],
          ansprechpartnerTelefon: row['ANSP_TELEFON'],
          ansprechpartnerEmail: row['ANSP_EMAIL'],
          letzteAusschreibung: row['LETZTEAUSSCHREIBUNG'],
          datumVon: rowDate,
          datumBis: row['DATUMBIS'] || row['DETAIL_DATUMBIS'],
          uhrzeitVon: parseExcelTime(row['UHRZEITVON']),
          uhrzeitBis: parseExcelTime(row['UHRZEITBIS']),
          typ: row['TYP'],
          bedarf,
          garantiestundenLohn: row['GARANTIESTD_LOHN'],
          endeOffen: row['ENDEOFFEN']
        });
      }

      // 4. Einsatz Record — skip pseudo rows (IST_PSEUDO=1 means unfilled shift)
      if (!isPseudoRow) {
        const einsatzLocation = resolveLocation(auftragGeschSt, 'einsatz', { auftragNr, personalNr: row['PERSONALNR'] || null }, 'geschSt');
        newEinsaetze.push({
          auftragNr: auftragNr,
          ...(einsatzLocation ? { locationV2: einsatzLocation._id } : {}),
          personalNr: row['PERSONALNR'],
          berufSchl: row['BERUFSCHL'],
          qualSchl: row['QUALSCHL'],
          bezeichnung: row['BEZEICHN'],
          datumVon: row['DATUMVON'],
          datumBis: row['DATUMBIS'],
          cProtBediener: row['CPROTBEDIENER'],
          dtProtDatum: row['DTPROTDATUM'],
          idAuftragArbeitsschichten: idSchicht,
          
          // Shift Detail Fields
          schichtBezeichnung: row['BEZEICHNUNG'],
          treffpunkt: row['TREFFPUNKTUHRZEIT'],
          treffpunktOrt: row['TREFFPUNKTORT'],
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
    }

    // Execute Operations
    let stats = {
      auftrag: { upserted: 0, matched: 0, deactivated: 0 },
      kunde: { upserted: 0, matched: 0 },
      schicht: { inserted: 0, deleted: 0 },
      einsatz: { inserted: 0, deleted: 0 },
      locationResolution,
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

    // 5. Cleanup orphaned records (orders not in the list, within date range)
    const cleanupBase = { auftragNr: { $nin: Array.from(auftragNrs) } };
    if (minDate && maxDate) cleanupBase.datumVon = { $gte: minDate, $lte: maxDate };

    const cleanupSchichtRes = await Schicht.deleteMany(cleanupBase);
    stats.schicht.deleted += cleanupSchichtRes.deletedCount;

    const cleanupEinsatzRes = await Einsatz.deleteMany({ ...cleanupBase, isPseudo: { $ne: true } });
    stats.einsatz.deleted += cleanupEinsatzRes.deletedCount;

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

    // Full-Sync: Delete existing Schichten + Einsätze for imported orders within date range
    const auftragNrArray = Array.from(auftragNrs);
    const dateFilter = (minDate && maxDate) ? { $gte: minDate, $lte: maxDate } : undefined;

    const delSchichtFilter = { auftragNr: { $in: auftragNrArray } };
    if (dateFilter) delSchichtFilter.datumVon = dateFilter;
    const delSchichtRes = await Schicht.deleteMany(delSchichtFilter);
    stats.schicht.deleted = delSchichtRes.deletedCount;

    const delEinsatzFilter = { auftragNr: { $in: auftragNrArray }, isPseudo: { $ne: true } };
    if (dateFilter) delEinsatzFilter.datumVon = dateFilter;
    const delEinsatzRes = await Einsatz.deleteMany(delEinsatzFilter);
    stats.einsatz.deleted = delEinsatzRes.deletedCount;

    if (newSchichten.length > 0) {
      const insSchicht = await Schicht.insertMany(newSchichten);
      stats.schicht.inserted = insSchicht.length;
    }

    if (newEinsaetze.length > 0) {
      const insEinsatz = await Einsatz.insertMany(newEinsaetze);
      stats.einsatz.inserted = insEinsatz.length;

      // Cleanup: Manuelle "eingeplant"-Platzhalter löschen, wenn echte Einsätze importiert wurden
      const importedPnrs = [...new Set(newEinsaetze.map(e => e.personalNr))];
      const importedPnrStrs = importedPnrs.map(String);
      const maWithEinsatz = await Mitarbeiter.find(
        { $or: [{ personalnr: { $in: importedPnrStrs } }, { personalnummern: { $in: importedPnrStrs } }] },
        '_id'
      ).lean();
      const maIdsWithEinsatz = maWithEinsatz.map(m => m._id);
      if (maIdsWithEinsatz.length > 0) {
        const eingeplantCleanup = {
          mitarbeiter: { $in: maIdsWithEinsatz },
          verfuegbarkeit: 'eingeplant',
        };
        if (minDate && maxDate) {
          eingeplantCleanup.datumVon = { $gte: minDate, $lte: maxDate };
        }
        const delResult = await DispoEintrag.deleteMany(eingeplantCleanup);
        if (delResult.deletedCount > 0) {
          logger.info(`[Import] ${delResult.deletedCount} manuelle Eingeplant-Platzhalter gelöscht`);
        }
      }
    }

    const unresolvedLocationCount = locationResolution.auftrag.unresolved
      + locationResolution.kunde.unresolved
      + locationResolution.schicht.unresolved
      + locationResolution.einsatz.unresolved;
    const resolvedLocationCount = locationResolution.auftrag.resolved
      + locationResolution.kunde.resolved
      + locationResolution.schicht.resolved
      + locationResolution.einsatz.resolved;
    const message = `Verarbeitung abgeschlossen:\n` +
      `- Schichten: ${stats.schicht.inserted} neu, ${stats.schicht.deleted} gelöscht/ersetzt\n` +
      `- Einsätze: ${stats.einsatz.inserted} neu, ${stats.einsatz.deleted} gelöscht/ersetzt\n` +
      `- Aufträge: ${stats.auftrag.upserted} neu, ${stats.auftrag.matched} aktualisiert, ${stats.auftrag.deactivated} deaktiviert\n` +
      `- Kunden: ${stats.kunde.upserted} neu, ${stats.kunde.matched} aktualisiert\n` +
      `- Standorte: ${resolvedLocationCount} aufgelöst, ${unresolvedLocationCount} offene Zuordnungen`;

    await logImport('einsatz-komplett', req.file.originalname, 'success', newSchichten.length, stats, req.user?.id);
    
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
            <li><strong>Schichten:</strong> ${stats.schicht.inserted} (Importiert), ${stats.schicht.deleted} (Ersetzt)</li>
            <li><strong>Einsätze:</strong> ${stats.einsatz.inserted} (Importiert), ${stats.einsatz.deleted} (Ersetzt)</li>
            <li><strong>Aufträge:</strong> ${stats.auftrag.upserted} (Neu), ${stats.auftrag.matched} (Update)</li>
            <li><strong>Kunden:</strong> ${stats.kunde.upserted} (Neu), ${stats.kunde.matched} (Update)</li>
            <li><strong>Standorte:</strong> ${resolvedLocationCount} aufgelöst, ${unresolvedLocationCount} offen</li>
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

// --- Personal Import (kombiniert: Personalnr, Persstatus, Geburtsdatum, Geburtsname, Geburtsort, Eintritt, Austrittsdatum, Beruf/Quali, Persgruppe, Adresse(n), Email, Telefon) ---
// Spalten (mit Prüffeld, neu 7002): A=Prüffeld(7002), B=Personalnr, C=Persstatus(6=Ausgetreten), D=Geburtsdatum(GEBDATUM), E=Geburtsname(GEBNAME), F=Geburtsort(GEBORT), G=Eintritt1, H=Austritt1, I=Berufsschlüssel(komma), J=Qualischlüssel(komma), K=Persgruppe, L=Strasse, M=PLZ, N=Ort, O=Land, P=Telefon, Q=Email, R=Strasse2, S=PLZ2, T=Ort2, U=Land2, V=Telefon2, W=Email2
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

    let matched = 0, updated = 0, unchanged = 0, skipped = 0, pnrUpdated = 0, deactivated = 0, pnrAdded = 0;
    const notFoundPnrs = [];
    const pnrUpdatedList = [];
    const pnrAddedList = [];

    const operations = [];

    for (let i = startRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 1) continue;

      const hasNewFormat = colOffset === 1;

      // Helper: parse a cell into a Date (or null)
      const parseDate = (val) => {
        if (!val) return null;
        const d = val instanceof Date ? val : new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };
      const parseStr = (val) => (val != null && String(val).trim() !== '' ? String(val).trim() : null);
      const parseKeys = (val) => (val
        ? String(val).split(',').map(k => String(parseInt(k.trim(), 10))).filter(k => k !== 'NaN')
        : []);

      // Fixed column indices per format.
      // New 7002 (colOffset=1): A=Prüffeld, B=Personalnr, C=Persstatus, D=Geburtsdatum,
      //   E=Geburtsname, F=Geburtsort, G=Eintritt1, H=Austritt1, I=Berufsschl, J=Qualschl, K=Persgruppe,
      //   L=Strasse, M=PLZ, N=Ort, O=Land, P=Tel, Q=Email,
      //   R=Strasse2, S=PLZ2, T=Ort2, U=Land2, V=Tel2, W=Email2
      // Legacy (colOffset=0): A=Personalnr, B=ignoriert, C=Austritt, D=Berufsschl,
      //   E=Qualschl, F=Persgruppe, G=Email, H=Telefon
      let personalnr, persstatus, geburtsdatum, geburtsname, geburtsort, eintrittsdatum, austrittsdatum;
      let berufKeys, qualiKeys, persgruppRaw, email, telefon;
      let adresse = null, adresse2 = null;

      if (hasNewFormat) {
        personalnr = parseStr(row[1]);
        if (!personalnr) continue;
        persstatus = row[2] != null ? parseInt(row[2], 10) : null;
        geburtsdatum = parseDate(row[3]);
        geburtsname = parseStr(row[4]);
        geburtsort = parseStr(row[5]);
        eintrittsdatum = parseDate(row[6]);
        austrittsdatum = parseDate(row[7]);
        berufKeys = parseKeys(row[8]);
        qualiKeys = parseKeys(row[9]);
        persgruppRaw = row[10] != null ? parseInt(row[10], 10) : null;
        // Adresse 1 (Hauptadresse) — Tel/Email fließen in die Primärfelder
        const strasse = parseStr(row[11]);
        const plz = parseStr(row[12]);
        const ort = parseStr(row[13]);
        const land = parseStr(row[14]);
        telefon = parseStr(row[15]);
        email = parseStr(row[16]) ? String(row[16]).trim().toLowerCase() : null;
        if (strasse || plz || ort || land) {
          adresse = { strasse, plz, ort, land };
        }
        // Adresse 2 (Zweitadresse) inkl. eigener Tel/Email
        const strasse2 = parseStr(row[17]);
        const plz2 = parseStr(row[18]);
        const ort2 = parseStr(row[19]);
        const land2 = parseStr(row[20]);
        const tel2 = parseStr(row[21]);
        const email2 = parseStr(row[22]) ? String(row[22]).trim().toLowerCase() : null;
        if (strasse2 || plz2 || ort2 || land2 || tel2 || email2) {
          adresse2 = { strasse: strasse2, plz: plz2, ort: ort2, land: land2, telefon: tel2, email: email2 };
        }
      } else {
        personalnr = parseStr(row[0]);
        if (!personalnr) continue;
        persstatus = null;
        geburtsdatum = null;
        geburtsort = null;
        eintrittsdatum = null;
        austrittsdatum = parseDate(row[2]);
        berufKeys = parseKeys(row[3]);
        qualiKeys = parseKeys(row[4]);
        persgruppRaw = row[5] != null ? parseInt(row[5], 10) : null;
        email = parseStr(row[6]) ? String(row[6]).trim().toLowerCase() : null;
        telefon = parseStr(row[7]);
      }

      const berufIds = berufKeys.map(k => berufMap.get(k)).filter(Boolean);
      const qualiIds = qualiKeys.map(k => qualiMap.get(k)).filter(Boolean);
      const persgruppe = persgruppRaw != null && VALID_PERSGRUPPEN.has(persgruppRaw) ? persgruppRaw : null;

      // Build $set payload — only include fields that have a value
      const setFields = {
        berufe: berufIds,
        qualifikationen: qualiIds,
      };
      if (geburtsdatum) setFields.geburtsdatum = geburtsdatum;
      if (geburtsname) setFields.geburtsname = geburtsname;
      if (geburtsort) setFields.geburtsort = geburtsort;
      if (eintrittsdatum) setFields.eintrittsdatum = eintrittsdatum;
      // Immer setzen: leeres Feld soll einen bestehenden Wert in der DB explizit löschen
      setFields.austrittsdatum = austrittsdatum ?? null;
      if (persgruppe != null) setFields.persgruppe = persgruppe;
      if (email) setFields.email = email;
      if (telefon) setFields.telefon = telefon;
      if (adresse) setFields.adresse = adresse;
      if (adresse2) setFields.adresse2 = adresse2;
      // Persstatus 1 = Bewerber (noch kein vollständiger MA), 2 = Mitarbeiter
      if (persstatus != null) setFields.isBewerberstatus = persstatus === 1;

      operations.push({ personalnr, persstatus, setFields });
    }

    if (operations.length === 0) {
      return res.json({ success: true, message: 'Keine gültigen Zeilen gefunden.' });
    }

    // Deduplizierung: Wenn dieselbe E-Mail mehrfach vorkommt und eine Zeile
    // hat Persstatus 6, die andere nicht → Persstatus-6-Zeile ignorieren.
    const emailOccurrences = new Map(); // email → [op, ...]
    for (const op of operations) {
      const email = op.setFields.email;
      if (!email) continue;
      if (!emailOccurrences.has(email)) emailOccurrences.set(email, []);
      emailOccurrences.get(email).push(op);
    }
    const filteredOperations = operations.filter(op => {
      const email = op.setFields.email;
      if (!email) return true;
      const group = emailOccurrences.get(email);
      if (group.length <= 1) return true;
      // Wenn es in der Gruppe mindestens eine Zeile ohne Persstatus 6 gibt,
      // dann Persstatus-6-Zeilen aus der Gruppe herausfiltern
      const hasNonExited = group.some(o => o.persstatus !== 6);
      return !(hasNonExited && op.persstatus === 6);
    });

    if (filteredOperations.length === 0) {
      return res.json({ success: true, message: 'Keine gültigen Zeilen gefunden.' });
    }

    const activeLocations = await Location.find({ isActive: true })
      .select('_id externalId')
      .lean();
    const locationsByExternalId = new Map();
    const duplicateExternalIds = new Set();
    for (const location of activeLocations) {
      const externalId = String(location.externalId || '').trim();
      if (!externalId) continue;
      if (locationsByExternalId.has(externalId)) duplicateExternalIds.add(externalId);
      else locationsByExternalId.set(externalId, location);
    }
    if (duplicateExternalIds.size) {
      return res.status(409).json({
        success: false,
        message: `Doppelte externe Standort-IDs: ${[...duplicateExternalIds].join(', ')}. Import abgebrochen.`,
      });
    }
    for (const operation of filteredOperations) {
      const externalId = String(operation.personalnr || '').trim().match(/^\d/)?.[0] || null;
      operation.locationResolution = {
        externalId,
        location: externalId ? locationsByExternalId.get(externalId) || null : null,
      };
    }

    // Respond immediately to avoid Heroku's 30s request timeout on large imports.
    // Processing continues in the background; results are sent via e-mail.
    res.json({
      success: true,
      message: `Import gestartet: ${filteredOperations.length} Zeilen werden verarbeitet. Du erhältst eine E-Mail, wenn der Import abgeschlossen ist.`,
      details: { total: filteredOperations.length, async: true }
    });

    // Background processing (fire-and-forget)
    const originalFilename = req.file.originalname;
    const importedBy = req.user?.id;
    const updatedBy = req.user?.email || req.user?.id || 'import';

    ;(async () => {
      try {
        // Set aller in DIESEM Import als aktiv geführten Personalnummern.
        // Dient dazu, eine „zweite aktive Nummer“ (z.B. weitere Niederlassung) von
        // einer echten Personalnr-Korrektur zu unterscheiden.
        const importPnrSet = new Set(filteredOperations.map(o => o.personalnr).filter(Boolean));
        const locationResolution = {
          resolved: 0,
          updated: 0,
          unchanged: 0,
          unresolved: 0,
          ignoredAdditionalNumbers: 0,
          unresolvedEntries: [],
        };

        // Execute bulk updates (find by Personalnr, Fallback per E-Mail)
        for (const op of filteredOperations) {
          let ma = await Mitarbeiter.findOne({
            $or: [{ personalnr: op.personalnr }, { personalnummern: op.personalnr }]
          }).select('_id personalnr personalnummern personalnrHistory persgruppe_set_explicitly email additionalEmails flip_id asana_id isActive locationV2').lean();
          let pnrChanged = false;      // echte Korrektur: primäre personalnr wird überschrieben
          let pnrAddedToArray = false; // zusätzliche aktive Nr (z.B. zweite Niederlassung)

          if (!ma) {
            // Fallback: suche per E-Mail aus der Excel-Zeile
            const fallbackEmail = op.setFields.email;
            if (fallbackEmail) {
              ma = await Mitarbeiter.findOne({
                $or: [{ email: fallbackEmail }, { additionalEmails: fallbackEmail }]
              }).select('_id personalnr personalnummern personalnrHistory persgruppe_set_explicitly email additionalEmails flip_id asana_id isActive locationV2').lean();
              if (ma && ma.personalnr !== op.personalnr) {
                // Führt Zvoove die bereits gespeicherte Nummer in DIESEM Import noch als
                // aktiv? Dann ist op.personalnr eine ZUSÄTZLICHE aktive Nummer (Doppel-
                // führung), keine Korrektur → ins Array statt die primäre Nr zu überschreiben.
                const existingStillActive = ma.personalnr && importPnrSet.has(ma.personalnr);
                const alreadyInArray = Array.isArray(ma.personalnummern) && ma.personalnummern.includes(op.personalnr);
                if (existingStillActive && !alreadyInArray) {
                  pnrAddedToArray = true;
                } else if (!alreadyInArray) {
                  pnrChanged = true;
                }
              }
            }

            if (!ma) {
              skipped++;
              if (notFoundPnrs.length < 30) notFoundPnrs.push(op.personalnr);
              continue;
            }
          }

          matched++;

          // Persstatus 6 = Ausgetreten: Flip löschen, Monitor deaktivieren, Asana abschließen
          if (op.persstatus === 6 && ma.isActive) {
            op.setFields.isActive = false;
            if (ma.flip_id) {
              op.setFields.flip_id = null;
              try {
                await deleteManyFlipUsers([ma.flip_id]);
              } catch (err) {
                logger.error(`[PersonalImport] Flip-Löschung fehlgeschlagen für ${ma._id}: ${err.message}`);
              }
            }
            if (ma.asana_id) {
              try {
                await completeTaskById(ma.asana_id);
              } catch (err) {
                logger.error(`[PersonalImport] Asana-Abschluss fehlgeschlagen für ${ma._id}: ${err.message}`);
              }
            }
            deactivated++;
          }

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

          // Personalnr-Korrektur: neue PNr setzen, alte in Historie schieben
          if (pnrChanged) {
            op.setFields.personalnr = op.personalnr;
            pnrUpdated++;
            if (pnrUpdatedList.length < 30) {
              pnrUpdatedList.push({ alt: ma.personalnr || '(leer)', neu: op.personalnr, email: ma.email });
            }
          }

          // Zusätzliche aktive Personalnr (Doppelführung, z.B. zweite Niederlassung):
          // ins Array aufnehmen, primäre personalnr bleibt unverändert.
          const addPersonalnummern = [];
          if (pnrAddedToArray) {
            if (ma.personalnr) addPersonalnummern.push(ma.personalnr); // primäre Nr im Array spiegeln
            addPersonalnummern.push(op.personalnr);
            pnrAdded++;
            if (pnrAddedList.length < 30) {
              pnrAddedList.push({ primaer: ma.personalnr || '(leer)', zusatz: op.personalnr, email: ma.email });
            }
          }

          const importedNumberIsPrimary = ma.personalnr === op.personalnr || pnrChanged;
          if (importedNumberIsPrimary) {
            const resolvedLocation = op.locationResolution.location;
            if (resolvedLocation) {
              locationResolution.resolved++;
              if (String(ma.locationV2 || '') !== String(resolvedLocation._id)) {
                op.setFields.locationV2 = resolvedLocation._id;
                locationResolution.updated++;
              } else {
                locationResolution.unchanged++;
              }
            } else {
              locationResolution.unresolved++;
              if (locationResolution.unresolvedEntries.length < 30) {
                locationResolution.unresolvedEntries.push({
                  mitarbeiterId: String(ma._id),
                  personalnr: op.personalnr,
                  externalId: op.locationResolution.externalId,
                  reason: op.locationResolution.externalId ? 'unknown-external-id' : 'missing-prefix',
                });
              }
            }
          } else if (pnrAddedToArray) {
            locationResolution.ignoredAdditionalNumbers++;
          }

          const updateOps = { $set: op.setFields };
          const addToSet = {};
          if (addToAdditional.length > 0) {
            addToSet.additionalEmails = { $each: addToAdditional };
          }
          if (addPersonalnummern.length > 0) {
            addToSet.personalnummern = { $each: addPersonalnummern };
          }
          if (Object.keys(addToSet).length > 0) {
            updateOps.$addToSet = addToSet;
          }
          // Alte Personalnr in Historie schreiben (falls vorhanden und geändert)
          if (pnrChanged && ma.personalnr) {
            updateOps.$push = {
              personalnrHistory: {
                value: ma.personalnr,
                updatedAt: new Date(),
                updatedBy,
                source: 'import'
              }
            };
          }

          const result = await Mitarbeiter.updateOne({ _id: ma._id }, updateOps);
          if (result.modifiedCount > 0) updated++; else unchanged++;
        }

        const details = {
          total: operations.length,
          matched,
          updated,
          unchanged,
          notFound: skipped,
          notFoundPnrs: notFoundPnrs.length > 0 ? notFoundPnrs : undefined,
          pnrUpdated,
          pnrUpdatedList: pnrUpdatedList.length > 0 ? pnrUpdatedList : undefined,
          pnrAdded,
          pnrAddedList: pnrAddedList.length > 0 ? pnrAddedList : undefined,
          deactivated,
          locationResolution,
        };

        await logImport('personal', originalFilename, 'success', matched, details, importedBy);

        // Email notification
        const timestamp = new Date().toLocaleString('de-DE');
        const notFoundHtml = notFoundPnrs.length
          ? `<h3>ℹ️ Nicht gefunden (${skipped}):</h3><ul>${notFoundPnrs.map(p => `<li>${p}</li>`).join('')}${skipped > notFoundPnrs.length ? `<li>…und ${skipped - notFoundPnrs.length} weitere</li>` : ''}</ul>`
          : '';
        const emailContent = `
          <div style="font-family:Arial,sans-serif;color:#333">
            <h2>Personal Import (kombiniert) – ${timestamp}</h2>
            <p><strong>Datei:</strong> ${originalFilename}</p>
            <hr/>
            <ul>
              <li>Zeilen: <strong>${operations.length}</strong></li>
              <li>Gefunden &amp; aktualisiert: <strong>${matched}</strong></li>
              <li>Davon geändert: <strong>${updated}</strong></li>
              <li>Unverändert: <strong>${unchanged}</strong></li>
              <li>Nicht gefunden: <strong>${skipped}</strong></li>
              ${pnrUpdated > 0 ? `<li>Personalnr per E-Mail korrigiert: <strong>${pnrUpdated}</strong></li>` : ''}
              ${pnrAdded > 0 ? `<li>Zusätzliche Personalnr (Doppelführung): <strong>${pnrAdded}</strong></li>` : ''}
              <li>Standorte: <strong>${locationResolution.resolved}</strong> aufgelöst, <strong>${locationResolution.updated}</strong> geändert, <strong>${locationResolution.unresolved}</strong> offen</li>
            </ul>
            ${notFoundHtml}
            ${pnrUpdatedList.length > 0 ? `<h3>🔄 Personalnr korrigiert (${pnrUpdated}):</h3><ul>${pnrUpdatedList.map(p => `<li>${p.email}: <code>${p.alt}</code> → <code>${p.neu}</code></li>`).join('')}${pnrUpdated > pnrUpdatedList.length ? `<li>…und ${pnrUpdated - pnrUpdatedList.length} weitere</li>` : ''}</ul>` : ''}
            ${pnrAddedList.length > 0 ? `<h3>➕ Zusätzliche Personalnr (${pnrAdded}):</h3><ul>${pnrAddedList.map(p => `<li>${p.email}: primär <code>${p.primaer}</code> + zusätzlich <code>${p.zusatz}</code></li>`).join('')}${pnrAdded > pnrAddedList.length ? `<li>…und ${pnrAdded - pnrAddedList.length} weitere</li>` : ''}</ul>` : ''}
          </div>`;
        await sendMail('it@straightforward.email', `Personal Import – ${timestamp}`, emailContent, 'it');
      } catch (bgError) {
        logger.error('Background PersonalImport Error:', bgError);
        await logImport('personal', originalFilename, 'failed', 0, { error: bgError.message }, importedBy).catch(() => {});
      }
    })();

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
      // Column D (Index 3): Tätigkeitsschlüssel (optional)
      const keyVal = row[0];
      const designationVal = row[2];
      const taetigkeitsschluesselVal = row[3];

      const jobKey = parseInt(keyVal, 10);
      if (isNaN(jobKey)) continue; // Skip header or invalid rows

      const designation = designationVal ? String(designationVal).trim() : '';
      if (!designation) continue;

      const update = { designation };
      if (taetigkeitsschluesselVal !== undefined && taetigkeitsschluesselVal !== '') {
        update.taetigkeitsschluessel = String(taetigkeitsschluesselVal).trim();
      }

      operations.push({
        updateOne: {
          filter: { jobKey: jobKey },
          update: { $set: update },
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

    const allBerufeForQuali = await Beruf.find({}).select('_id jobKey').lean();
    const berufByJobKey = new Map(allBerufeForQuali.map(b => [b.jobKey, b._id]));

    for (const row of rawData) {
      if (!row || row.length < 1) continue;
      
      // Column A (Index 0): Key
      // Column B (Index 1): Designation
      // Column C (Index 2): Beruf jobKey (optional, clears assignment if empty)
      const keyVal = row[0];
      const designationVal = row[1];
      const berufKeyVal = row[2];

      const qualificationKey = parseInt(keyVal, 10);
      if (isNaN(qualificationKey)) continue;

      const designation = designationVal ? String(designationVal).trim() : '';
      if (!designation) continue;

      const berufJobKey = berufKeyVal !== undefined && berufKeyVal !== '' ? parseInt(berufKeyVal, 10) : null;
      const berufId = (!isNaN(berufJobKey) && berufJobKey !== null) ? (berufByJobKey.get(berufJobKey) || null) : null;

      operations.push({
        updateOne: {
          filter: { qualificationKey: qualificationKey },
          update: { $set: { designation: designation, beruf: berufId } },
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

// --- Lohnarten Import (LOHNART) ---
router.get('/lohnarten', auth, async (req, res) => {
  try {
    const [lohnarten, kundenKonditionen] = await Promise.all([
      Lohnart.find({}).sort({ lohnartNummer: 1 }).lean(),
      KundenKondition.find({})
        .select('lohnart kunde')
        .populate({
          path: 'kunde',
          select: 'kundenNr kundName kuerzel kundStatus geschSt',
          match: { kundStatus: 2 },
        })
        .lean(),
    ]);
    const kundenByLohnart = new Map();
    for (const kondition of kundenKonditionen) {
      if (!kondition.lohnart || !kondition.kunde) continue;

      const lohnartId = String(kondition.lohnart);
      const kunden = kundenByLohnart.get(lohnartId) || new Map();
      kunden.set(String(kondition.kunde._id), kondition.kunde);
      kundenByLohnart.set(lohnartId, kunden);
    }
    const data = lohnarten.map((lohnart) => ({
      ...lohnart,
      kunden: [...(kundenByLohnart.get(String(lohnart._id))?.values() || [])]
        .sort((left, right) => String(left.kundName || '').localeCompare(String(right.kundName || ''), 'de')),
    }));
    res.json({ success: true, data });
  } catch (error) {
    logger.error('GET Lohnarten Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Abrufen der Lohnarten.', error: error.message });
  }
});

router.post('/lohnart', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    const columns = [
      ['LOHNARTNR', 'lohnartNummer'], ['LOHNARTKUR', 'lohnartKurzzeichen'], ['LOHNARTTXT', 'lohnartBezeichnung'],
      ['RECHNUNGST', 'rechnungstext'], ['KOSTENART', 'kostenart'], ['FREMDLOHNA', 'fremdLohnartNummer'],
      ['CBERECHNUN', 'berechnungsartCode'], ['CDURCHSPEI', 'durchschnittsspeicherCode'], ['CZUSCHLAG', 'zuschlagsProzent'], ['ZUSCHAUEGR', 'zuschlagsgruppeWert'],
      ['CSTEUERKRA', 'steuerartCode'], ['CSTEUERSPE', 'steuerSpezialCode'], ['CSOZIAL', 'sozialversicherungCode'], ['CPFAENDUNG', 'pfaendungCode'],
      ['AUSWERT', 'auswerten'], ['AUSWERTSTD', 'inStundenauswertung'], ['CGLEITZEIT', 'gleitzeitCode'],
      ['RECHSPALTE', 'rechnungsspalte'], ['BGSPALTE', 'berechnungsgrundlageSpalte'], ['ILOHNFAKTUR', 'fakturierungCode'],
      ['IBRANCHENZUSCHLAG', 'branchenzuschlagCode'], ['ILOHNARTBRANCHENZ', 'branchenzuschlagLohnartNummer'], ['PRIORITAETBZ', 'branchenzuschlagPrioritaet'], ['EQUALPAY', 'equalPayRelevanz'],
    ];
    const header = rawData[0]?.map((value) => String(value).trim().toUpperCase()) || [];
    const hasHeader = header.includes('LOHNARTNR');
    const indexByColumn = new Map(columns.map(([source], index) => [source, hasHeader ? header.indexOf(source) : index]));
    const operations = [];

    for (const row of rawData.slice(hasHeader ? 1 : 0)) {
      const lohnartNummer = String(row[indexByColumn.get('LOHNARTNR')] ?? '').trim();
      if (!lohnartNummer) continue;

      const fields = {};
      for (const [source, target] of columns) {
        fields[target] = String(row[indexByColumn.get(source)] ?? '').trim();
      }
      operations.push({
        updateOne: {
          filter: { lohnartNummer },
          update: { $set: fields },
          upsert: true,
        },
      });
    }

    if (!operations.length) {
      await logImport('lohnart', req.file.originalname, 'warning', 0, { message: 'Keine gültigen Lohnarten gefunden' }, req.user?.id);
      return res.json({ success: true, message: 'Keine gültigen Lohnarten gefunden. (Erwarte LOHNARTNR als erste Spalte oder Spaltenüberschrift.)' });
    }

    const result = await Lohnart.bulkWrite(operations);
    const inserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    const unchanged = operations.length - inserted - updated;
    const response = {
      success: true,
      message: `${operations.length} Lohnarten verarbeitet: ${inserted} neu, ${updated} aktualisiert.`,
      details: { total: operations.length, inserted, updated, unchanged },
    };
    await logImport('lohnart', req.file.originalname, 'success', operations.length, response.details, req.user?.id);
    res.json(response);
  } catch (error) {
    logger.error('Import Lohnart Error:', error);
    await logImport('lohnart', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Lohnarten.', error: error.message });
  }
});

// --- Kundenkonditionen Import (KUNDEN_KOND) ---
router.post('/kundenkondition', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true }).map(cleanKeys);
    const [kunden, lohnarten] = await Promise.all([
      Kunde.find({}).select('_id kundenNr').lean(),
      Lohnart.find({}).select('_id lohnartNummer').lean(),
    ]);
    const kundeByNr = new Map(kunden.map((kunde) => [kunde.kundenNr, kunde]));
    const lohnartByNr = new Map();
    for (const lohnart of lohnarten) {
      lohnartByNr.set(String(lohnart.lohnartNummer), lohnart);
      lohnartByNr.set(normalizeNumericIdentifier(lohnart.lohnartNummer), lohnart);
    }
    const operations = [];
    const sourceKeys = new Set();
    let invalid = 0;
    let unresolvedCustomers = 0;
    let unresolvedLohnarten = 0;
    let duplicates = 0;

    for (const row of rows) {
      const kundenNr = Number.parseInt(row.KUNDENNR, 10);
      const lohnartNummer = optionalText(row.LOHNART);
      const tabellenNr = optionalText(row.TABNR);
      const laufendeNummer = optionalText(row.LFDNR);
      if (!Number.isInteger(kundenNr) || !lohnartNummer || !tabellenNr || !laufendeNummer) {
        invalid += 1;
        continue;
      }

      const kunde = kundeByNr.get(kundenNr);
      const lohnart = lohnartByNr.get(lohnartNummer) || lohnartByNr.get(normalizeNumericIdentifier(lohnartNummer));
      if (!kunde) {
        unresolvedCustomers += 1;
        continue;
      }
      if (!lohnart) {
        unresolvedLohnarten += 1;
        continue;
      }

      const preisNr = optionalText(row.PREISNR);
      const sourceKey = [kundenNr, tabellenNr, laufendeNummer, preisNr || '', lohnartNummer].join(':');
      if (sourceKeys.has(sourceKey)) {
        duplicates += 1;
        continue;
      }
      sourceKeys.add(sourceKey);

      const regelCode = optionalText(row.STD_UHR)?.toUpperCase();
      const einheitCode = optionalText(row.JE)?.toUpperCase();
      operations.push({
        updateOne: {
          filter: { sourceKey },
          update: { $set: {
            kunde: kunde._id,
            kundenNrSnapshot: kundenNr,
            lohnart: lohnart._id,
            lohnartNummer,
            tabellenNr,
            tabellenBezeichnung: optionalText(row.TABBEZ) || '',
            laufendeNummer,
            regelArt: regelCode === 'S' ? 'stunden' : regelCode === 'U' ? 'uhrzeit' : null,
            jeEinheit: einheitCode === 'T' ? 'tag' : einheitCode === 'W' ? 'woche' : null,
            abWert: optionalText(row.AB),
            bisWert: optionalText(row.BIS),
            tage: {
              montag: optionalText(row.MONTAG)?.toUpperCase() === 'J',
              dienstag: optionalText(row.DIENSTAG)?.toUpperCase() === 'J',
              mittwoch: optionalText(row.MITTWOCH)?.toUpperCase() === 'J',
              donnerstag: optionalText(row.DONNERSTAG)?.toUpperCase() === 'J',
              freitag: optionalText(row.FREITAG)?.toUpperCase() === 'J',
              samstag: optionalText(row.SAMSTAG)?.toUpperCase() === 'J',
              sonntag: optionalText(row.SONNTAG)?.toUpperCase() === 'J',
              feiertag: optionalText(row.FEIERTAG)?.toUpperCase() === 'J',
            },
            preisNr,
            zuschlagsProzent: parseDecimal(row.PROZENT) || 0,
            verwendung: optionalText(row.VERWENDUNG),
            preisBetrag: parseDecimal(row.PREIS) || null,
            abStundenGrenze: parseDecimal(row.ABSTUNDENGRENZE) || null,
            nichtAutomatisch: optionalText(row.NICHTAUTOM) === '*',
            branchenzuschlagAddieren: Number(row.BRANCHENZUSCHLAGADDIEREN) === 1,
            berufsSchluessel: optionalText(row.BERUFSCHL),
            zvooveKonditionsId: optionalText(row.FID),
          }, $setOnInsert: { sourceKey } },
          upsert: true,
        },
      });
    }

    if (!operations.length) {
      const details = { total: rows.length, invalid, unresolvedCustomers, unresolvedLohnarten, duplicates };
      await logImport('kundenkondition', req.file.originalname, 'warning', 0, details, req.user?.id);
      return res.json({ success: true, message: 'Keine verknüpfbaren Kundenkonditionen gefunden.', details });
    }

    const result = await KundenKondition.bulkWrite(operations);
    const inserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;
    const unchanged = operations.length - inserted - updated;
    const details = { total: rows.length, processed: operations.length, inserted, updated, unchanged, invalid, unresolvedCustomers, unresolvedLohnarten, duplicates };
    await logImport('kundenkondition', req.file.originalname, 'success', operations.length, details, req.user?.id);
    res.json({ success: true, message: `${operations.length} Kundenkonditionen verarbeitet: ${inserted} neu, ${updated} aktualisiert.`, details });
  } catch (error) {
    logger.error('Import Kundenkondition Error:', error);
    await logImport('kundenkondition', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Kundenkonditionen.', error: error.message });
  }
});

// --- Kundenpreis Import (Liste 3202) ---
router.post('/kundenpreis', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true }).map(cleanKeys);
    const [kunden, qualifikationen] = await Promise.all([
      Kunde.find({}).select('_id kundenNr').lean(),
      Qualifikation.find({}).select('_id qualificationKey beruf').lean(),
    ]);
    const kundeByNr = new Map(kunden.map((kunde) => [kunde.kundenNr, kunde]));
    const qualiByKey = new Map(qualifikationen.map((quali) => [quali.qualificationKey, quali]));
    const operations = [];
    const versionKeys = new Set();
    let invalid = 0;
    let unresolved = 0;
    let duplicates = 0;

    for (const row of rows) {
      if (Number(row.CODE) !== 3202) {
        invalid += 1;
        continue;
      }

      const sourceId = row.ID == null ? '' : String(row.ID).trim();
      const kundenNr = Number(row.KUNDENNR);
      const qualSchluessel = Number(row.QUALSCHL);
      const validFrom = parseExcelDate(row.DATUMVON);
      const validTill = parseExcelDate(row.DATUMBIS);
      const hourlyRateCents = parseEuroCents(row.PREIS1);
      const kunde = kundeByNr.get(kundenNr);
      const qualifikation = qualiByKey.get(qualSchluessel);

      if (!sourceId || !Number.isInteger(kundenNr) || !Number.isInteger(qualSchluessel)
        || !validFrom || hourlyRateCents == null || hourlyRateCents < 0
        || (validTill && validTill < validFrom)) {
        invalid += 1;
        continue;
      }
      if (!kunde || !qualifikation || !qualifikation.beruf) {
        unresolved += 1;
        continue;
      }

      const versionKey = `${kundenNr}:${qualSchluessel}:${validFrom.toISOString()}`;
      if (versionKeys.has(versionKey)) {
        duplicates += 1;
        continue;
      }
      versionKeys.add(versionKey);

      operations.push({
        updateOne: {
          filter: { sourceId },
          update: {
            $set: { validTill, hourlyRateCents },
            $setOnInsert: {
              kunde: kunde._id,
              kundenNrSnapshot: kundenNr,
              qualifikation: qualifikation._id,
              qualSchluessel,
              validFrom,
              sourceId,
              source: 'zvoove-import',
            },
          },
          upsert: true,
        },
      });
    }

    const result = operations.length ? await Kundenpreis.bulkWrite(operations) : null;
    const inserted = result?.upsertedCount || 0;
    const updated = result?.modifiedCount || 0;
    const details = {
      total: rows.length,
      inserted,
      updated,
      unchanged: operations.length - inserted - updated,
      invalid,
      notFound: unresolved,
      duplicates,
    };
    const hasWarnings = invalid || unresolved || duplicates;
    const message = `${operations.length} Kundenpreise verarbeitet: ${inserted} neu, ${updated} aktualisiert.${hasWarnings ? ` ${invalid + unresolved + duplicates} Zeilen übersprungen.` : ''}`;

    await logImport('kundenpreis', req.file.originalname, hasWarnings ? 'warning' : 'success', operations.length, details, req.user?.id);
    res.json({ success: true, message, details });
  } catch (error) {
    logger.error('Import Kundenpreis Error:', error);
    await logImport('kundenpreis', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Kundenpreise.', error: error.message });
  }
});

// --- Kundenstammdaten Import (Liste 3203) ---
router.post('/kunden', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true }).map(cleanKeys);
    const customerOperations = [];
    const addressOperations = [];
    const referencedAddressNumbers = new Set();
    let invalid = 0;

    for (const row of rows) {
      if (Number(row.CODE) !== 3203 || !Number.isInteger(Number(row.KUNDENNR))) {
        invalid += 1;
        continue;
      }

      const kundenNr = Number(row.KUNDENNR);
      const bemerkung = [row.BEMERKUNG2, row.CHEFANW, row.BONUSTEXT]
        .map(optionalText)
        .filter(Boolean);
      const postAdresseNr = optionalText(row.ADRNR1);
      const rechnungsAdresseNr = optionalText(row.ADRNR2);
      if (postAdresseNr) referencedAddressNumbers.add(postAdresseNr);
      if (rechnungsAdresseNr) referencedAddressNumbers.add(rechnungsAdresseNr);

      customerOperations.push({
        updateOne: {
          filter: { kundenNr },
          update: {
            $set: {
              kundName: optionalText(row.KUNDNAME),
              kundeSeit: parseExcelDate(row.KUNDESEIT),
              kundStatus: Number.isInteger(Number(row.KUNDSTATUS)) ? Number(row.KUNDSTATUS) : null,
              geschSt: optionalText(row.GESCHST),
              kostenSt: optionalText(row.KOSTENST),
              zvoove_debitorkonto: optionalText(row.DEBITORKTO),
              sammelrechnung: String(row.SAMMELRECH || '').trim().toUpperCase() === 'A',
              ustId: optionalText(row.USTID),
              steuerNummer: optionalText(row.STEUERNUMMER),
              handelsregisterNr: optionalText(row.HANDELSREGISTERNR),
              l1RechGruppe: optionalText(row.L1RECHGRUPPE),
              bemerkung,
            },
          },
          upsert: true,
        },
      });

      addressOperations.push({
        updateMany: {
          filter: { knr: String(kundenNr) },
          update: { $set: { isPostAdr: false, isRechnAdr: false } },
        },
      });
      if (postAdresseNr) {
        addressOperations.push({
          updateOne: {
            filter: { nummer: postAdresseNr },
            update: { $set: { knr: String(kundenNr), isPostAdr: true } },
          },
        });
      }
      if (rechnungsAdresseNr) {
        addressOperations.push({
          updateOne: {
            filter: { nummer: rechnungsAdresseNr },
            update: { $set: { knr: String(kundenNr), isRechnAdr: true } },
          },
        });
      }
    }

    const existingAddressNumbers = new Set((await Adresse.find({
      nummer: { $in: [...referencedAddressNumbers] },
    }).select('nummer').lean()).map((adresse) => adresse.nummer));
    const missingAddresses = [...referencedAddressNumbers]
      .filter((nummer) => !existingAddressNumbers.has(nummer)).length;

    const [customerResult, addressResult] = await Promise.all([
      customerOperations.length ? Kunde.bulkWrite(customerOperations) : null,
      addressOperations.length ? Adresse.bulkWrite(addressOperations, { ordered: false }) : null,
    ]);
    const details = {
      total: rows.length,
      inserted: customerResult?.upsertedCount || 0,
      updated: customerResult?.modifiedCount || 0,
      unchanged: customerOperations.length - (customerResult?.upsertedCount || 0) - (customerResult?.modifiedCount || 0),
      invalid,
      addressUpdated: addressResult?.modifiedCount || 0,
      missingAddresses,
    };
    const hasWarnings = invalid || missingAddresses;
    const message = `${customerOperations.length} Kunden verarbeitet: ${details.inserted} neu, ${details.updated} aktualisiert.${hasWarnings ? ` ${invalid + missingAddresses} Zeilen mit Warnungen.` : ''}`;

    await logImport('kunden', req.file.originalname, hasWarnings ? 'warning' : 'success', customerOperations.length, details, req.user?.id);
    res.json({ success: true, message, details });
  } catch (error) {
    logger.error('Import Kundenstammdaten Error:', error);
    await logImport('kunden', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Kundenstammdaten.', error: error.message });
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
    const [berufe, counts] = await Promise.all([
      Beruf.find({}).sort({ jobKey: 1 }).lean(),
      Qualifikation.aggregate([{ $match: { beruf: { $ne: null } } }, { $group: { _id: '$beruf', count: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map(c => [String(c._id), c.count]));
    const data = berufe.map(b => ({ ...b, qualifikationCount: countMap.get(String(b._id)) || 0 }));
    res.json({ success: true, data });
  } catch (error) {
    logger.error('GET Berufe Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Abrufen der Berufe.', error: error.message });
  }
});

// --- POST create Beruf ---
router.post('/berufe', auth, async (req, res) => {
  try {
    const { jobKey, designation, taetigkeitsschluessel } = req.body;
    if (!jobKey || !designation) {
      return res.status(400).json({ success: false, message: 'jobKey und designation sind erforderlich.' });
    }
    const beruf = new Beruf({
      jobKey: parseInt(jobKey, 10),
      designation: designation.trim(),
      taetigkeitsschluessel: taetigkeitsschluessel ? String(taetigkeitsschluessel).trim() : undefined,
    });
    await beruf.save();
    res.status(201).json({ success: true, data: beruf });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Ein Eintrag mit diesem Schlüssel existiert bereits.' });
    logger.error('POST Beruf Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen des Berufs.', error: error.message });
  }
});

// --- PUT update Beruf ---
router.put('/berufe/:id', auth, async (req, res) => {
  try {
    const { jobKey, designation, taetigkeitsschluessel } = req.body;
    const update = {};
    if (jobKey !== undefined) update.jobKey = parseInt(jobKey, 10);
    if (designation !== undefined) update.designation = designation.trim();
    if (taetigkeitsschluessel !== undefined) update.taetigkeitsschluessel = taetigkeitsschluessel ? String(taetigkeitsschluessel).trim() : '';
    const beruf = await Beruf.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!beruf) return res.status(404).json({ success: false, message: 'Beruf nicht gefunden.' });
    res.json({ success: true, data: beruf });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Ein Eintrag mit diesem Schlüssel existiert bereits.' });
    logger.error('PUT Beruf Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren des Berufs.', error: error.message });
  }
});

// --- DELETE Beruf ---
router.delete('/berufe/:id', auth, async (req, res) => {
  try {
    const beruf = await Beruf.findByIdAndDelete(req.params.id);
    if (!beruf) return res.status(404).json({ success: false, message: 'Beruf nicht gefunden.' });
    // Remove dangling references from qualifikationen
    await Qualifikation.updateMany({ beruf: beruf._id }, { $set: { beruf: null } });
    res.json({ success: true, message: 'Beruf gelöscht.' });
  } catch (error) {
    logger.error('DELETE Beruf Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Löschen des Berufs.', error: error.message });
  }
});

// --- GET all Qualifikationen (for frontend cache) ---
router.get('/qualifikationen', async (req, res) => {
  try {
    const [qualifikationen, counts] = await Promise.all([
      Qualifikation.find({}).sort({ qualificationKey: 1 }).populate('beruf', 'jobKey designation').lean(),
      Mitarbeiter.aggregate([{ $unwind: '$qualifikationen' }, { $group: { _id: '$qualifikationen', count: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map(c => [String(c._id), c.count]));
    const data = qualifikationen.map(q => ({ ...q, mitarbeiterCount: countMap.get(String(q._id)) || 0 }));
    res.json({ success: true, data });
  } catch (error) {
    logger.error('GET Qualifikationen Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Abrufen der Qualifikationen.', error: error.message });
  }
});

// --- POST create Qualifikation ---
router.post('/qualifikationen', auth, async (req, res) => {
  try {
    const { qualificationKey, designation, beruf } = req.body;
    if (!qualificationKey || !designation) {
      return res.status(400).json({ success: false, message: 'qualificationKey und designation sind erforderlich.' });
    }
    const qual = new Qualifikation({
      qualificationKey: parseInt(qualificationKey, 10),
      designation: designation.trim(),
      beruf: beruf || null,
    });
    await qual.save();
    await qual.populate('beruf', 'jobKey designation');
    res.status(201).json({ success: true, data: qual });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Ein Eintrag mit diesem Schlüssel existiert bereits.' });
    logger.error('POST Qualifikation Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Erstellen der Qualifikation.', error: error.message });
  }
});

// --- PUT update Qualifikation ---
router.put('/qualifikationen/:id', auth, async (req, res) => {
  try {
    const { qualificationKey, designation, beruf } = req.body;
    const update = {};
    if (qualificationKey !== undefined) update.qualificationKey = parseInt(qualificationKey, 10);
    if (designation !== undefined) update.designation = designation.trim();
    if (beruf !== undefined) update.beruf = beruf || null;
    const qual = await Qualifikation.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate('beruf', 'jobKey designation');
    if (!qual) return res.status(404).json({ success: false, message: 'Qualifikation nicht gefunden.' });
    res.json({ success: true, data: qual });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Ein Eintrag mit diesem Schlüssel existiert bereits.' });
    logger.error('PUT Qualifikation Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren der Qualifikation.', error: error.message });
  }
});

// --- DELETE Qualifikation ---
router.delete('/qualifikationen/:id', auth, async (req, res) => {
  try {
    const qual = await Qualifikation.findByIdAndDelete(req.params.id);
    if (!qual) return res.status(404).json({ success: false, message: 'Qualifikation nicht gefunden.' });
    res.json({ success: true, message: 'Qualifikation gelöscht.' });
  } catch (error) {
    logger.error('DELETE Qualifikation Error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Löschen der Qualifikation.', error: error.message });
  }
});

// --- Rechnung Import (Liste 6001) — Admin only ---
router.post('/rechnung', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    // Admin guard — JWT only carries user ID, so we must hit the DB
    const caller = await User.findById(req.user.id).select('roles');
    if (!caller || !caller.roles?.includes('ADMIN')) {
      return res.status(403).json({ success: false, message: 'Nur Admins dürfen Rechnungen importieren.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

    // Column index mapping (0-based), matching the SQL SELECT order:
    // 0=Prüffeld(6001), 1=KOSTENST, 2=RECHART, 3=RECHSTATUS,
    // 4=KUNDENNR, 5=AUFTRAGNR,
    // 6=RECHNDATUM, 7=BUCHDATUM,
    // 8=NATCODE,
    // 9=DNETTO, 10=DMWST, 11=DBRUTTO,
    // 12=EURNETTO, 13=EURMWST, 14=EURBRUTTO,
    // 15=NETTO, 16=MWST, 17=BRUTTO,
    // 18=DEBITORKTO, 19=RECHALTNR, 20=RECHTEXT,
    // 21=LFDLEISTNR, 22=RECHNUNGNR

    const docs = [];
    let minDate = null;
    let maxDate = null;
    const seenRechnungNr = new Set();

    for (const row of rawData) {
      if (!row || row.length < 8) continue;

      // Validate Prüffeld
      const prueffeld = parseInt(row[0], 10);
      if (prueffeld !== 6001) continue;

      // Parse BUCHDATUM — xlsx cellDates:true returns Date objects when raw:false is NOT set
      // With dateNF + raw:false it returns formatted strings; parse robustly:
      const buchDatumRaw = row[7];
      let buchDatum = null;
      if (buchDatumRaw instanceof Date) {
        buchDatum = buchDatumRaw;
      } else if (buchDatumRaw) {
        // Handle 'DD.MM.YYYY' or 'YYYY-MM-DD' coming from dateNF formatting
        const str = String(buchDatumRaw).trim();
        const deDe = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (deDe) {
          buchDatum = new Date(`${deDe[3]}-${deDe[2]}-${deDe[1]}T00:00:00Z`);
        } else {
          buchDatum = new Date(str);
        }
      }
      if (!buchDatum || isNaN(buchDatum.getTime())) continue;

      // Track date range for selective delete
      if (!minDate || buchDatum < minDate) minDate = new Date(buchDatum);
      if (!maxDate || buchDatum > maxDate) maxDate = new Date(buchDatum);

      const rechnungNr = row[22] !== undefined && row[22] !== null && row[22] !== ''
        ? String(row[22]).trim() : null;

      // Skip duplicates within the same file (keep first occurrence)
      if (rechnungNr && seenRechnungNr.has(rechnungNr)) continue;
      if (rechnungNr) seenRechnungNr.add(rechnungNr);

      docs.push({
        // Plaintext
        buchDatum,
        kundenNr:   row[4] !== undefined ? Number(row[4]) : null,
        auftragNr:  row[5] !== undefined ? Number(row[5]) : null,
        rechnungNr,

        // Encrypted
        kostenSt:   encryptField(row[1]),
        rechArt:    encryptField(row[2]),
        rechStatus: encryptField(row[3]),
        rechnDatum: encryptField(row[6]),
        natCode:    encryptField(row[8]),
        dNetto:     encryptField(row[9]),
        dMwst:      encryptField(row[10]),
        dBrutto:    encryptField(row[11]),
        eurNetto:   encryptField(row[12]),
        eurMwst:    encryptField(row[13]),
        eurBrutto:  encryptField(row[14]),
        netto:      encryptField(row[15]),
        mwst:       encryptField(row[16]),
        brutto:     encryptField(row[17]),
        debitorKto: encryptField(row[18]),
        rechAltNr:  encryptField(row[19]),
        rechText:   encryptField(row[20]),
        lfdLeistNr: encryptField(row[21]),
      });
    }

    if (docs.length === 0) {
      return res.json({
        success: false,
        message: 'Keine gültigen Rechnungsdaten gefunden. Prüffeld (Spalte A) muss 6001 enthalten und BUCHDATUM (Spalte H) muss gesetzt sein.'
      });
    }

    const auftragNrs = [...new Set(docs.map((doc) => doc.auftragNr).filter(Number.isFinite))];
    const kundenNrs = [...new Set(docs.map((doc) => doc.kundenNr).filter(Number.isFinite))];
    const [auftraege, kunden, activeLocations] = await Promise.all([
      auftragNrs.length ? Auftrag.find({ auftragNr: { $in: auftragNrs } }).select('auftragNr geschSt locationV2').lean() : [],
      kundenNrs.length ? Kunde.find({ kundenNr: { $in: kundenNrs } }).select('kundenNr geschSt locationV2').lean() : [],
      Location.find({ isActive: true }).select('_id externalId').lean(),
    ]);
    const locationsByExternalId = new Map(activeLocations.map((location) => [String(location.externalId || '').trim(), location._id]));
    const locationForGeschSt = (geschSt) => locationsByExternalId.get(String(geschSt || '').trim()) || null;
    const locationByAuftragNr = new Map(auftraege.map((auftrag) => [auftrag.auftragNr, auftrag.locationV2 || locationForGeschSt(auftrag.geschSt)]));
    const locationByKundenNr = new Map(kunden.map((kunde) => [kunde.kundenNr, kunde.locationV2 || locationForGeschSt(kunde.geschSt)]));
    const locationResolution = { auftrag: 0, kunde: 0, legacyGeschSt: 0, unresolved: 0, unresolvedEntries: [] };
    for (const doc of docs) {
      const auftragLocation = locationByAuftragNr.get(doc.auftragNr);
      const kundenLocation = locationByKundenNr.get(doc.kundenNr);
      if (auftragLocation) {
        doc.locationV2 = auftragLocation;
        locationResolution.auftrag += 1;
        if (!auftraege.find((auftrag) => auftrag.auftragNr === doc.auftragNr)?.locationV2) locationResolution.legacyGeschSt += 1;
      } else if (kundenLocation) {
        doc.locationV2 = kundenLocation;
        locationResolution.kunde += 1;
        if (!kunden.find((kunde) => kunde.kundenNr === doc.kundenNr)?.locationV2) locationResolution.legacyGeschSt += 1;
      } else {
        locationResolution.unresolved += 1;
        if (locationResolution.unresolvedEntries.length < 30) {
          locationResolution.unresolvedEntries.push({ auftragNr: doc.auftragNr || null, kundenNr: doc.kundenNr || null });
        }
      }
    }

    // Upsert strategy: for each record with a rechnungNr, replace the existing
    // document if it already exists; insert if it doesn't. Records NOT in the
    // upload are never touched.
    // Records without a rechnungNr (sparse unique field, rare) are always inserted.
    const bulkOps = docs.map(doc => {
      if (doc.rechnungNr) {
        return {
          updateOne: {
            filter: { rechnungNr: doc.rechnungNr },
            update: { $set: doc },
            upsert: true
          }
        };
      }
      return { insertOne: { document: doc } };
    });

    const bulkResult = await Rechnung.bulkWrite(bulkOps, { ordered: false });

    const stats = {
      inserted: bulkResult.upsertedCount + bulkResult.insertedCount,
      updated: bulkResult.modifiedCount,
      dateRange: {
        from: minDate.toISOString().split('T')[0],
        to:   maxDate.toISOString().split('T')[0]
      },
      locationResolution,
    };

    const message = `Rechnungen importiert: ${stats.inserted} neu, ${stats.updated} aktualisiert (${stats.dateRange.from} – ${stats.dateRange.to}). Standorte: ${locationResolution.auftrag + locationResolution.kunde} aufgelöst, ${locationResolution.unresolved} offen.`;

    await logImport('rechnung', req.file.originalname, 'success', stats.inserted, stats, req.user?.id);
    logger.info(`[Import Rechnung] ${message} by user ${req.user?.id}`);

    res.json({ success: true, message, details: stats });

  } catch (error) {
    logger.error('[Import Rechnung] Error:', error);
    await logImport('rechnung', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Rechnungen.', error: error.message });
  }
});


// --- Verfügbarkeiten Import (Zvoove Liste 7003) ---
// Spalten: A=Prüffeld(7003), B=ID, C=PERSONALNR, D=DATUM, E=VON, F=BIS, G=INFO, H=VERFUEGBAR, I=ANLAGEBEDIENER, J=ZULETZTBEARBEITET, K=GANZTAEGIG
router.post('/verfuegbarkeit', auth, extendTimeout, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });
    }

    // Parse datetime strings like "24.04.2026 13:15:00" (DD.MM.YYYY HH:mm:ss) or a JS Date
    const parseDEDatetime = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      if (typeof val === 'string') {
        const m = val.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (m) {
          // Construct as local time; store as UTC in MongoDB
          return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] || '00'}`);
        }
      }
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Prüffeld-Validierung: Spalte A muss 7003 enthalten
    const rawCheck = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const checkStart = (rawCheck.length > 0 && isNaN(rawCheck[0][0])) ? 1 : 0;
    if (rawCheck.length > checkStart) {
      const prueffeld = parseInt(rawCheck[checkStart][0], 10);
      if (prueffeld !== 7003) {
        return res.status(400).json({
          success: false,
          message: `Falsches Prüffeld: Spalte A enthält "${rawCheck[checkStart][0]}" – erwartet wird 7003 (Verfügbarkeiten).`
        });
      }
    }

    // Parse columns by position (header row optional, skip if first col is not a number)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const dataStart = (rows.length > 0 && isNaN(rows[0][0])) ? 1 : 0;
    const dataRows = rows.slice(dataStart);

    const operations = [];
    const now = new Date();
    const personalnrs = [...new Set(dataRows.map((cols) => String(cols?.[2] || '').trim()).filter(Boolean))];
    const [mitarbeiter, activeLocations] = await Promise.all([
      personalnrs.length
      ? await Mitarbeiter.find({ $or: [{ personalnr: { $in: personalnrs } }, { personalnummern: { $in: personalnrs } }] })
        .select('personalnr personalnummern locationV2')
        .lean()
      : [],
      Location.find({ isActive: true }).select('_id externalId').lean(),
    ]);
    const locationsByExternalId = new Map(activeLocations.map((location) => [String(location.externalId || '').trim(), location._id]));
    const locationByPersonalnr = new Map();
    for (const ma of mitarbeiter) {
      const primaryLocation = ma.locationV2 || locationsByExternalId.get(String(ma.personalnr || '').trim().match(/^\d/)?.[0]) || null;
      for (const personalnr of [ma.personalnr, ...(ma.personalnummern || [])].filter(Boolean)) {
        locationByPersonalnr.set(String(personalnr), primaryLocation);
      }
    }
    const locationResolution = { resolved: 0, unresolved: 0, unresolvedEntries: [] };
    const unresolvedPersonalnrs = new Set();

    for (const cols of dataRows) {
      // Col A (0) = CODE/Prüffeld, B (1) = ID, C (2) = PERSONALNR, D (3) = DATUM,
      // E (4) = VON, F (5) = BIS, G (6) = INFO, H (7) = VERFUEGBAR,
      // I (8) = ANLAGEBEDIENER, J (9) = ZULETZTBEARBEITET, K (10) = GANZTAEGIG
      const zvooveId = parseInt(cols[1], 10);
      const personalnr = parseInt(cols[2], 10);
      if (!zvooveId || !personalnr) continue;

      const doc = {
        zvooveId,
        personalnr,
        datum: parseDEDatetime(cols[3]),
        von: parseDEDatetime(cols[4]),
        bis: parseDEDatetime(cols[5]),
        info: cols[6] ? String(cols[6]).trim() : null,
        verfuegbar: parseInt(cols[7], 10) === 1,
        anlagebediener: cols[8] ? String(cols[8]).trim() : null,
        zuletztBearbeitet: parseDEDatetime(cols[9]),
        ganztaegig: parseInt(cols[10], 10) === 1,
        importiertAm: now,
      };
      const location = locationByPersonalnr.get(String(personalnr));
      if (location) {
        doc.locationV2 = location;
        locationResolution.resolved += 1;
      } else {
        locationResolution.unresolved += 1;
        if (!unresolvedPersonalnrs.has(personalnr) && locationResolution.unresolvedEntries.length < 30) {
          unresolvedPersonalnrs.add(personalnr);
          locationResolution.unresolvedEntries.push({ personalnr });
        }
      }

      operations.push({
        updateOne: {
          filter: { zvooveId: doc.zvooveId },
          update: { $set: doc },
          upsert: true,
        }
      });
    }

    if (operations.length === 0) {
      await logImport('verfuegbarkeit', req.file.originalname, 'warning', 0, { message: 'Keine Einträge gefunden' }, req.user?.id);
      return res.json({ success: true, message: 'Keine Verfügbarkeiten zum Verarbeiten gefunden.' });
    }

    const result = await ZvooveVerfuegbarkeit.bulkWrite(operations, { ordered: false });
    const inserted = result.upsertedCount || 0;
    const updated = result.modifiedCount || 0;

    const stats = { total: operations.length, inserted, updated, locationResolution };
    const message = `${operations.length} Verfügbarkeiten verarbeitet: ${inserted} neu, ${updated} aktualisiert. Standorte: ${locationResolution.resolved} aufgelöst, ${locationResolution.unresolved} offen.`;

    await logImport('verfuegbarkeit', req.file.originalname, 'success', operations.length, stats, req.user?.id);
    logger.info(`[Import Verfuegbarkeit] ${message} by user ${req.user?.id}`);

    res.json({ success: true, message, details: stats });

  } catch (error) {
    logger.error('[Import Verfuegbarkeit] Error:', error);
    await logImport('verfuegbarkeit', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Verfügbarkeiten.', error: error.message });
  }
});


// POST /personalnr-history – Import Personalnr-Historien (Prüffeld 3201)
// Spaltenstruktur: A=Prüffeld(3201), B=Sozversnr (ignoriert), C=Personalnr-Blob (kommagetrennt)
// Logik: Finde Mitarbeiter dessen aktuelle personalnr in der Blob-Liste vorkommt,
//        dann alle anderen Werte aus der Blob-Liste in personalnrHistory eintragen (keine Duplikate).
router.post('/personalnr-history', auth, extendTimeout, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Keine Datei hochgeladen.' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Header row detection: skip first row if col[0] is not numeric
    const startRow = rows.length > 0 && isNaN(rows[0][0]) ? 1 : 0;

    // Validate Prüffeld
    if (!rows[startRow] || parseInt(rows[startRow][0], 10) !== 3201) {
      return res.status(400).json({
        success: false,
        message: `Prüffeld-Fehler: Spalte A enthält "${rows[startRow]?.[0] ?? '(leer)'}" – erwartet wird 3201 (Personalnr-Historien Liste).`
      });
    }

    const stats = { total: 0, matched: 0, added: 0, skippedDuplicates: 0, unmatched: 0 };

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      // Col C (index 2): comma-separated personalnr blob
      const blobRaw = String(row[2] ?? '').trim();
      if (!blobRaw) continue;

      const pnrArray = blobRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (pnrArray.length === 0) continue;

      stats.total++;

      // Find the Mitarbeiter whose current personalnr matches any value in the blob
      const mitarbeiter = await Mitarbeiter.findOne(
        { personalnr: { $in: pnrArray } },
        { _id: 1, personalnr: 1, personalnrHistory: 1 }
      ).lean();

      if (!mitarbeiter) {
        stats.unmatched++;
        continue;
      }

      stats.matched++;

      // Collect existing history values to prevent duplicates
      const existingValues = new Set(
        (mitarbeiter.personalnrHistory || []).map(h => h.value)
      );
      // Also exclude the current active personalnr
      existingValues.add(mitarbeiter.personalnr);

      const newEntries = pnrArray
        .filter(pnr => pnr !== mitarbeiter.personalnr && !existingValues.has(pnr))
        .map(pnr => ({
          value: pnr,
          updatedAt: new Date(),
          updatedBy: req.user?.email || 'system',
          source: 'import'
        }));

      const duplicatesInThisRow = pnrArray.filter(
        pnr => pnr !== mitarbeiter.personalnr && existingValues.has(pnr)
      ).length;

      stats.skippedDuplicates += duplicatesInThisRow;

      if (newEntries.length > 0) {
        await Mitarbeiter.updateOne(
          { _id: mitarbeiter._id },
          { $push: { personalnrHistory: { $each: newEntries } } }
        );
        stats.added += newEntries.length;
      }
    }

    const status = stats.matched > 0 ? 'success' : 'warning';
    const message = `Verarbeitung abgeschlossen: ${stats.matched} Mitarbeiter gefunden, ${stats.added} neue Historien-Einträge hinzugefügt, ${stats.skippedDuplicates} Duplikate übersprungen.`;

    await logImport('personalnr-history', req.file.originalname, status, stats.matched, stats, req.user?.id);
    logger.info(`[Import Personalnr-History] ${message}`);

    res.json({ success: true, message, details: stats });

  } catch (error) {
    logger.error('[Import Personalnr-History] Error:', error);
    await logImport('personalnr-history', req.file?.originalname, 'failed', 0, { error: error.message }, req.user?.id);
    res.status(500).json({ success: false, message: 'Fehler beim Importieren der Personalnr-Historien.', error: error.message });
  }
});


module.exports = router;
