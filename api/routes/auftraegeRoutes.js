const express = require('express');
const router = express.Router();
const Auftrag = require('../models/Auftrag');
const Einsatz = require('../models/Einsatz');
const Kunde = require('../models/Kunde');
const Mitarbeiter = require('../models/Mitarbeiter');
const Beruf = require('../models/Beruf');
const Qualifikation = require('../models/Qualifikation');
const logger = require('../utils/logger');

// GET /api/auftraege/filters - Get available filter options (bediener, etc)
router.get('/filters', async (req, res) => {
  try {
    // Get distinct operators
    const bediener = await Auftrag.distinct('bediener');
    
    // Clean and sort list (remove null/empty)
    const cleanBediener = bediener
      .filter(b => b && b.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
      
    res.json({
      bediener: cleanBediener
    });
  } catch (error) {
    logger.error('Error fetching filter options:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Filter', error: error.message });
  }
});

// GET /api/auftraege - List auftraege with date filtering
// Query params: from, to (ISO date strings), geschSt (string), bediener (comma-separated string)
router.get('/', async (req, res) => {
  try {
    const { from, to, geschSt, bediener } = req.query;
    
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
    
    // Only get active/confirmed auftraege (auftStatus = 2 based on import query)
    // But let's show all for now and let frontend filter if needed
    
    const auftraege = await Auftrag.find(query)
      .sort({ vonDatum: 1 })
      .lean();
    
    // Populate with Kunde data
    const kundenNrs = [...new Set(auftraege.map(a => a.kundenNr).filter(Boolean))];
    const kunden = await Kunde.find({ kundenNr: { $in: kundenNrs } }).lean();
    const kundenMap = {};
    kunden.forEach(k => { kundenMap[k.kundenNr] = k; });
    
    // Count einsätze per Auftrag
    const auftragNrs = auftraege.map(a => a.auftragNr);
    const einsatzCounts = await Einsatz.aggregate([
      { $match: { auftragNr: { $in: auftragNrs } } },
      { $group: { _id: '$auftragNr', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    einsatzCounts.forEach(e => { countMap[e._id] = e.count; });
    
    // Merge data
    const result = auftraege.map(a => ({
      ...a,
      kundeData: kundenMap[a.kundenNr] || null,
      einsaetzeCount: countMap[a.auftragNr] || 0
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
    
    // Populate Mitarbeiter, Beruf and Qualifikation for each Einsatz
    const einsaetzeWithMitarbeiter = await Promise.all(
      einsaetze.map(async (einsatz) => {
        const result = { ...einsatz };
        
        // Load Mitarbeiter
        if (einsatz.personalNr) {
          const mitarbeiter = await Mitarbeiter.findOne({ personalnr: String(einsatz.personalNr) })
            .select('vorname nachname email personalnr qualifikationen flip_id')
            .populate('qualifikationen')
            .lean();
          result.mitarbeiterData = mitarbeiter;
        }
        
        // Load Beruf by berufSchl (jobKey)
        if (einsatz.berufSchl) {
          const beruf = await Beruf.findOne({ jobKey: parseInt(einsatz.berufSchl) }).lean();
          result.berufData = beruf;
        }
        
        // Load Qualifikation by qualSchl (qualificationKey)
        if (einsatz.qualSchl) {
          const qualifikation = await Qualifikation.findOne({ qualificationKey: parseInt(einsatz.qualSchl) }).lean();
          result.qualifikationData = qualifikation;
        }
        
        return result;
      })
    );
    
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

module.exports = router;
