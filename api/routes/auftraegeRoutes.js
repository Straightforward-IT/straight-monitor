const express = require('express');
const router = express.Router();
const Auftrag = require('../models/Auftrag');
const Einsatz = require('../models/Einsatz');
const Kunde = require('../models/Kunde');
const Mitarbeiter = require('../models/Mitarbeiter');
const Beruf = require('../models/Beruf');
const Qualifikation = require('../models/Qualifikation');
const asyncHandler = require('../middleware/AsyncHandler');
const logger = require('../utils/logger');

// GET /api/auftraege/filters - Get available filter options (bediener, kunden, etc)
router.get('/filters', async (req, res) => {
  try {
    const { geschSt } = req.query;
    
    // Base query for finding relevant orders if geschSt is provided
    const filterQuery = {};
    if (geschSt) {
      const stList = geschSt.split(',').map(s => s.trim()).filter(Boolean);
      if (stList.length > 0) {
        filterQuery.geschSt = { $in: stList };
      }
    }

    // Get distinct operators (filtered by geschSt)
    const bediener = await Auftrag.find(filterQuery).distinct('bediener');
    
    // Get distinct kundenNrs used in Aufträge (filtered by geschSt AND future jobs)
    // "Zukunft" = bisDatum >= today (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const customerQuery = { 
      ...filterQuery,
      bisDatum: { $gte: today },
      aktiv: { $ne: 0 } // only active orders
    };

    const usedKundenNrs = await Auftrag.find(customerQuery).distinct('kundenNr');
    
    // Fetch Customer details for these IDs
    const kunden = await Kunde.find({ kundenNr: { $in: usedKundenNrs } })
      .select('kundenNr kundName')
      .sort({ kundName: 1 })
      .lean();
    
    // Clean and sort list (remove null/empty)
    const cleanBediener = bediener
      .filter(b => b && b.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
      
    res.json({
      bediener: cleanBediener,
      kunden: kunden
    });
  } catch (error) {
    logger.error('Error fetching filter options:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Filter', error: error.message });
  }
});

// GET /api/auftraege - List auftraege with date filtering
// Query params: from, to (ISO date strings), geschSt (string), bediener (comma-separated string), kunden (comma-separated numbers)
router.get('/', async (req, res) => {
  try {
    const { from, to, geschSt, bediener, kunden: kundenQuery } = req.query;
    
    const query = {};
    
    // Build date filter: events that overlap with the requested range
    // An event overlaps if: vonDatum <= to AND bisDatum >= from
    if (from || to) {
      query.$and = [];
      
      if (from) {
        // bisDatum must be >= from (event hasn't ended before our range starts)
        query.$and.push({ bisDatum: { $gte: new Date(from) } });
      }
      
      if (to) {
        // vonDatum must be <= to (event hasn't started after our range ends)
        query.$and.push({ vonDatum: { $lte: new Date(to) } });
      }
    }

    // Geschäftsstelle Filter
    if (geschSt) {
      // Allow for multiple comma separated values or single
      const stList = geschSt.split(',').map(s => s.trim()).filter(Boolean);
      if (stList.length > 0) {
        query.geschSt = { $in: stList };
      }
    }

    // Bediener Filter
    if (bediener) {
      const bedList = bediener.split(',').map(b => b.trim()).filter(Boolean);
      if (bedList.length > 0) {
        query.bediener = { $in: bedList }; // Case-sensitive exact match for now
      }
    }

    // Kunden Filter (by kundenNr)
    if (kundenQuery) {
      const kundenList = kundenQuery.split(',').map(k => parseInt(k.trim())).filter(k => !isNaN(k));
      if (kundenList.length > 0) {
        query.kundenNr = { $in: kundenList };
      }
    }
    
    // Only get active/confirmed auftraege (auftStatus = 2 based on import query)
    // Filter out explicitly inactive ones (aktiv = 0)
    query.aktiv = { $ne: 0 };
    
    const auftraege = await Auftrag.find(query)
      .sort({ vonDatum: 1 })
      .lean();
    
    // Populate with Kunde data
    const kundenNrs = [...new Set(auftraege.map(a => a.kundenNr).filter(Boolean))];
    const kundenData = await Kunde.find({ kundenNr: { $in: kundenNrs } }).lean();
    const kundenMap = {};
    kundenData.forEach(k => { kundenMap[k.kundenNr] = k; });
    
    // Count einsätze per Auftrag and find earliest start time
    const auftragNrs = auftraege.map(a => a.auftragNr);
    const einsatzAgg = await Einsatz.aggregate([
      { $match: { auftragNr: { $in: auftragNrs } } },
      { $group: { _id: '$auftragNr', count: { $sum: 1 }, earliestUhrzeitVon: { $min: '$uhrzeitVon' }, earliestDatumVon: { $min: '$datumVon' } } }
    ]);
    const countMap = {};
    const earliestTimeMap = {};
    einsatzAgg.forEach(e => {
      countMap[e._id] = e.count;
      earliestTimeMap[e._id] = { uhrzeitVon: e.earliestUhrzeitVon, datumVon: e.earliestDatumVon };
    });
    
    // Merge data
    const result = auftraege.map(a => ({
      ...a,
      kundeData: kundenMap[a.kundenNr] || null,
      einsaetzeCount: countMap[a.auftragNr] || 0,
      earliestEinsatzTime: earliestTimeMap[a.auftragNr] || null
    }));
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error fetching Aufträge:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Aufträge', error: error.message });
  }
});

// GET /api/auftraege/:auftragNr/details - Get single Auftrag with all Einsätze
router.get('/:auftragNr/details', async (req, res) => {
  try {
    const { auftragNr } = req.params;
    
    const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) }).lean();
    
    if (!auftrag) {
      return res.status(404).json({ success: false, message: 'Auftrag nicht gefunden' });
    }
    
    // Get Kunde
    let kundeData = null;
    if (auftrag.kundenNr) {
      kundeData = await Kunde.findOne({ kundenNr: auftrag.kundenNr }).lean();
    }
    
    // Get all Einsätze for this Auftrag
    const einsaetze = await Einsatz.find({ auftragNr: parseInt(auftragNr) })
      .sort({ idAuftragArbeitsschichten: 1, datumVon: 1 })
      .lean();
    
    // -- Optimization: Batch fetch related data --
    const personalNrs = [...new Set(einsaetze.map(e => e.personalNr).filter(Boolean).map(String))];
    const berufKeys = [...new Set(einsaetze.map(e => parseInt(e.berufSchl)).filter(k => !isNaN(k)))];
    const qualiKeys = [...new Set(einsaetze.map(e => parseInt(e.qualSchl)).filter(k => !isNaN(k)))];

    const [mitarbeiterList, berufList, qualiList] = await Promise.all([
      personalNrs.length ? Mitarbeiter.find({ personalnr: { $in: personalNrs } })
        .select('vorname nachname email personalnr qualifikationen flip_id')
        .populate('qualifikationen')
        .lean() : [],
      berufKeys.length ? Beruf.find({ jobKey: { $in: berufKeys } }).lean() : [],
      qualiKeys.length ? Qualifikation.find({ qualificationKey: { $in: qualiKeys } }).lean() : []
    ]);

    // Create lookup maps
    const mitarbeiterMap = new Map(mitarbeiterList.map(m => [String(m.personalnr), m]));
    const berufMap = new Map(berufList.map(b => [b.jobKey, b]));
    const qualiMap = new Map(qualiList.map(q => [q.qualificationKey, q]));

    // Map data back to assignments
    const einsaetzeWithMitarbeiter = einsaetze.map(einsatz => {
      const result = { ...einsatz };
      
      if (einsatz.personalNr) {
        result.mitarbeiterData = mitarbeiterMap.get(String(einsatz.personalNr)) || null;
      }
      
      if (einsatz.berufSchl) {
        const key = parseInt(einsatz.berufSchl);
        result.berufData = berufMap.get(key) || null;
      }
      
      if (einsatz.qualSchl) {
        const key = parseInt(einsatz.qualSchl);
        result.qualifikationData = qualiMap.get(key) || null;
      }
      
      return result;
    });
    
    res.json({
      ...auftrag,
      kundeData,
      einsaetze: einsaetzeWithMitarbeiter
    });
    
  } catch (error) {
    logger.error('Error fetching Auftrag details:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Auftragsdetails', error: error.message });
  }
});

// GET /api/auftraege/search - Search auftraege
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }
    
    const searchRegex = new RegExp(q, 'i');
    
    // Search in Auftrag fields
    const auftraege = await Auftrag.find({
      $or: [
        { eventTitel: searchRegex },
        { eventOrt: searchRegex },
        { eventLocation: searchRegex }
      ]
    }).limit(50).lean();
    
    // Also search by Kunde name
    const matchingKunden = await Kunde.find({ kundName: searchRegex }).lean();
    const kundenNrs = matchingKunden.map(k => k.kundenNr);
    
    if (kundenNrs.length > 0) {
      const kundeAuftraege = await Auftrag.find({ kundenNr: { $in: kundenNrs } }).lean();
      // Merge without duplicates
      const existingIds = new Set(auftraege.map(a => a._id.toString()));
      kundeAuftraege.forEach(a => {
        if (!existingIds.has(a._id.toString())) {
          auftraege.push(a);
        }
      });
    }
    
    res.json(auftraege);
    
  } catch (error) {
    logger.error('Error searching Aufträge:', error);
    res.status(500).json({ success: false, message: 'Fehler bei der Suche', error: error.message });
  }
});

// GET /api/auftraege/sync?since=<ISO_DATE> - Incremental sync endpoint
router.get('/sync', async (req, res) => {
  try {
    const { since } = req.query;
    
    if (!since) {
      return res.status(400).json({ success: false, message: 'Parameter "since" erforderlich' });
    }
    
    const sinceDate = new Date(since);
    
    // Find all Aufträge updated since the provided timestamp
    const updated = await Auftrag.find({
      updatedAt: { $gt: sinceDate }
    }).lean();
    
    // Note: We don't track deletions in this model, so deleted array is empty
    const deleted = [];
    
    res.json({
      updated,
      deleted,
      syncedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error syncing Aufträge:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Sync', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// LABELS
// ─────────────────────────────────────────────────────────────

// GET /api/auftraege/labels – All unique label names used across all Aufträge (for autocomplete)
router.get('/labels', asyncHandler(async (req, res) => {
  const auftraege = await Auftrag.find({ 'labels.0': { $exists: true } }).select('labels').lean();
  const labelMap = new Map();
  auftraege.forEach(a => {
    (a.labels || []).forEach(l => {
      if (!labelMap.has(l.name)) labelMap.set(l.name, l.color);
    });
  });
  const result = Array.from(labelMap.entries()).map(([name, color]) => ({ name, color }));
  res.json(result);
}));

// POST /api/auftraege/:auftragNr/labels – Add a label to an Auftrag
router.post('/:auftragNr/labels', asyncHandler(async (req, res) => {
  const { auftragNr } = req.params;
  const { name, color } = req.body;
  if (!name || String(name).trim().length === 0 || String(name).trim().length > 20) {
    return res.status(400).json({ message: 'Label-Name erforderlich (max. 20 Zeichen)' });
  }
  const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) });
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });

  const trimmedName = String(name).trim();
  const exists = (auftrag.labels || []).some(l => l.name.toLowerCase() === trimmedName.toLowerCase());
  if (exists) return res.status(400).json({ message: 'Label bereits vorhanden' });

  auftrag.labels = auftrag.labels || [];
  auftrag.labels.push({ name: trimmedName, color: color || '#4f46e5' });
  await auftrag.save();
  res.json({ labels: auftrag.labels });
}));

// DELETE /api/auftraege/:auftragNr/labels/:labelId – Remove a label from an Auftrag
router.delete('/:auftragNr/labels/:labelId', asyncHandler(async (req, res) => {
  const { auftragNr, labelId } = req.params;
  const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) });
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  auftrag.labels = (auftrag.labels || []).filter(l => String(l._id) !== labelId);
  await auftrag.save();
  res.json({ labels: auftrag.labels });
}));

// ─────────────────────────────────────────────────────────────
// PSEUDO-EINSÄTZE
// ─────────────────────────────────────────────────────────────

// POST /api/auftraege/:auftragNr/pseudo-einsatz – Schedule a pseudo-employee
router.post('/:auftragNr/pseudo-einsatz', asyncHandler(async (req, res) => {
  const { auftragNr } = req.params;
  const { mitarbeiterId, schichtId } = req.body;
  if (!mitarbeiterId) return res.status(400).json({ message: 'mitarbeiterId erforderlich' });

  const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) });
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });

  const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId).lean();
  if (!mitarbeiter) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });

  const personalnrInt = mitarbeiter.personalnr ? parseInt(mitarbeiter.personalnr) : null;

  // Check for duplicate pseudo-einsatz
  const duplicate = await Einsatz.findOne({
    auftragNr: parseInt(auftragNr),
    personalNr: personalnrInt,
    isPseudo: true,
    ...(schichtId ? { idAuftragArbeitsschichten: parseInt(schichtId) } : {})
  });
  if (duplicate) return res.status(400).json({ message: 'Mitarbeiter bereits in dieser Schicht eingeplant' });

  // Copy metadata from an existing Einsatz in the same schicht
  const templateQuery = { auftragNr: parseInt(auftragNr) };
  if (schichtId) templateQuery.idAuftragArbeitsschichten = parseInt(schichtId);
  const template = await Einsatz.findOne(templateQuery).lean();

  const newEinsatz = new Einsatz({
    auftragNr: parseInt(auftragNr),
    personalNr: personalnrInt,
    datumVon: template?.datumVon || auftrag.vonDatum,
    datumBis: template?.datumBis || auftrag.bisDatum,
    idAuftragArbeitsschichten: schichtId ? parseInt(schichtId) : template?.idAuftragArbeitsschichten,
    schichtBezeichnung: template?.schichtBezeichnung,
    uhrzeitVon: template?.uhrzeitVon,
    uhrzeitBis: template?.uhrzeitBis,
    treffpunkt: template?.treffpunkt,
    ansprechpartnerName: template?.ansprechpartnerName,
    ansprechpartnerTelefon: template?.ansprechpartnerTelefon,
    bezeichnung: template?.bezeichnung,
    berufSchl: template?.berufSchl,
    qualSchl: template?.qualSchl,
    isPseudo: true,
  });
  await newEinsatz.save();

  res.status(201).json({
    ...newEinsatz.toObject(),
    mitarbeiterData: {
      _id: mitarbeiter._id,
      vorname: mitarbeiter.vorname,
      nachname: mitarbeiter.nachname,
      personalnr: mitarbeiter.personalnr,
    }
  });
}));

// DELETE /api/auftraege/:auftragNr/pseudo-einsatz/:einsatzId – Remove a pseudo-Einsatz
router.delete('/:auftragNr/pseudo-einsatz/:einsatzId', asyncHandler(async (req, res) => {
  const { einsatzId } = req.params;
  const einsatz = await Einsatz.findOne({ _id: einsatzId, isPseudo: true });
  if (!einsatz) return res.status(404).json({ message: 'Pseudo-Einsatz nicht gefunden' });
  await einsatz.deleteOne();
  res.json({ ok: true });
}));

module.exports = router;

