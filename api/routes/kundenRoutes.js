const express = require('express');
const router = express.Router();
const Kunde = require('../models/Kunde');
const Auftrag = require('../models/Auftrag');
const Einsatz = require('../models/Einsatz');
const asyncHandler = require('../middleware/AsyncHandler');
const auth = require('../middleware/auth');

// @route   GET /api/kunden
// @desc    Alle Kunden abrufen
// @access  Private
router.get('/', auth, asyncHandler(async (req, res) => {
  const kunden = await Kunde.find()
    .populate('parentKunde', 'kundName kundenNr') // Populate Parent info
    .populate('kontakte.angelegtVon', 'name email')
    .populate('kontakte.kommentare.verfasser', 'name email')
    .sort({ kundName: 1 });
  
  res.json(kunden);
}));

// @route   GET /api/kunden/active-list
// @desc    Liefert eine Liste aller Kunden-Nummern, die mindestens einen Auftrag haben
// @access  Private
router.get('/active-list', auth, asyncHandler(async (req, res) => {
  // Finde alle eindeutigen kundenNr in der Auftrag-Collection
  const activeIds = await Auftrag.distinct('kundenNr');
  res.json(activeIds); // Array von Nummern
}));

// @route   GET /api/kunden/analytics/einsaetze
// @desc    Monatliche Einsatz-Anzahl, optional gefiltert nach Standort und/oder mehreren Kunden
// @access  Private
// Query:  von, bis (ISO), geschSt (optional), kundenNr (optional, comma-separated)
router.get('/analytics/einsaetze', auth, asyncHandler(async (req, res) => {
  const { von, bis, geschSt, kundenNr } = req.query;

  // 1. Bestimme relevante Kunden-Nummern
  let kundenNrs = [];

  if (kundenNr) {
    // Explizit gewählte Kunden
    const explicitNrs = kundenNr.split(',').map(Number).filter(n => !isNaN(n));
    kundenNrs = [...explicitNrs];

    // Check optional: Should we include children if a Parent is selected?
    // Yes, find IDs of the selected customers
    const parents = await Kunde.find({ kundenNr: { $in: explicitNrs } }).select('_id kundenNr');
    const parentIds = parents.map(p => p._id);
    
    // Find children
    const children = await Kunde.find({ parentKunde: { $in: parentIds } }).distinct('kundenNr');
    kundenNrs.push(...children);
    
    // De-duplicate
    kundenNrs = [...new Set(kundenNrs)];

    // Filter by Standort if provided
    if (geschSt) {
      const validKunden = await Kunde.find({ kundenNr: { $in: kundenNrs }, geschSt }).distinct('kundenNr');
      kundenNrs = validKunden;
    }
  } else {
    // Alle Kunden (optional nach Standort)
    const kundeFilter = {};
    if (geschSt) kundeFilter.geschSt = geschSt;
    const kunden = await Kunde.find(kundeFilter).select('kundenNr');
    kundenNrs = kunden.map(k => k.kundenNr);
  }

  if (kundenNrs.length === 0) {
    return res.json({ data: [], breakdown: [] });
  }

  // 2. Finde alle Aufträge dieser Kunden (mit kundenNr-Zuordnung)
  // Fetch Kunde docs to map children to parents
  const kundenDocs = await Kunde.find({ kundenNr: { $in: kundenNrs } }).select('kundenNr parentKunde').populate('parentKunde');
  
  // Create Map: kundenNr -> effectiveNr (Parent's Nr if exists and parent is in the selection or if we just want to aggregate up)
  // Actually, we should always map to Parent if it exists? 
  // The user wants "displayed as one customer". So if we have Child -> Parent, we map Child Data to Parent.
  const nrMap = {};
  kundenDocs.forEach(k => {
    if (k.parentKunde) {
      nrMap[k.kundenNr] = k.parentKunde.kundenNr;
    } else {
      nrMap[k.kundenNr] = k.kundenNr;
    }
  });

  const auftraege = await Auftrag.find({ kundenNr: { $in: kundenNrs } }).select('auftragNr kundenNr');

  if (auftraege.length === 0) {
    return res.json({ data: [], breakdown: [] });
  }

  // Map: auftragNr → kundenNr  (für die Breakdown-Zuordnung)
  const auftragToKundeOriginal = {};
  auftraege.forEach(a => { auftragToKundeOriginal[a.auftragNr] = a.kundenNr; });
  const auftragNrs = auftraege.map(a => a.auftragNr);

  // 3. Zeitraum-Filter
  const matchStage = { auftragNr: { $in: auftragNrs } };
  if (von || bis) {
    matchStage.datumVon = {};
    if (von) matchStage.datumVon.$gte = new Date(von);
    if (bis) matchStage.datumVon.$lte = new Date(bis);
  }

  // 4a. Gesamt-Aggregation (alle Kunden pro Monat)
  const totalPipeline = [
    { $match: matchStage },
    { $group: {
      _id: {
        auftragNr: '$auftragNr',
        year: { $year: '$datumVon' },
        month: { $month: '$datumVon' }
      },
      count: { $sum: 1 }
    }},
    { $group: {
      _id: { year: '$_id.year', month: '$_id.month' },
      count: { $sum: '$count' },
      auftragCount: { $sum: 1 }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ];
  const totalResult = await Einsatz.aggregate(totalPipeline);
  const data = totalResult.map(r => ({
    year: r._id.year, month: r._id.month,
    label: `${String(r._id.month).padStart(2, '0')}/${r._id.year}`,
    count: r.count,
    auftragCount: r.auftragCount
  }));

  // 4b. Per-Kunde Breakdown
  let breakdown = [];
  // Calculate breakdown always if filtering (users expect stacked bars of what they selected)
  if (kundenNr) {
    const breakdownPipeline = [
      { $match: matchStage },
      { $group: {
        _id: {
          auftragNr: '$auftragNr',
          year: { $year: '$datumVon' },
          month: { $month: '$datumVon' }
        },
        count: { $sum: 1 }
      }}
    ];
    const bResult = await Einsatz.aggregate(breakdownPipeline);

    // Gruppiere nach kundenNr + Monat (using MAPPED nr)
    const map = {}; // key: `kundenNr-year-month` → { count, auftraege: Set }
    bResult.forEach(r => {
      const originalKnr = auftragToKundeOriginal[r._id.auftragNr];
      if (!originalKnr) return;

      const effectiveNr = nrMap[originalKnr] || originalKnr; // Map to parent
      const key = `${effectiveNr}-${r._id.year}-${r._id.month}`;
      
      if (!map[key]) {
        map[key] = { count: 0, auftraege: new Set() };
      }
      map[key].count += r.count;
      map[key].auftraege.add(r._id.auftragNr);
    });

    // Konvertiere zu Array
    Object.entries(map).forEach(([key, val]) => {
      const [kNr, year, month] = key.split('-').map(Number);
      breakdown.push({ 
        kundenNr: kNr, 
        year, 
        month, 
        count: val.count, 
        auftragCount: val.auftraege.size 
      });
    });

    breakdown.sort((a, b) => a.year - b.year || a.month - b.month);
  }

  res.json({ data, breakdown });
}));

// @route   GET /api/kunden/analytics/einsaetze/daily
// @desc    Tägliche Einsatz-Anzahl für einen bestimmten Monat
// @access  Private
// Query:  year, month (required), geschSt (optional), kundenNr (optional, comma-separated)
router.get('/analytics/einsaetze/daily', auth, asyncHandler(async (req, res) => {
  const { year, month, geschSt, kundenNr } = req.query;

  if (!year || !month) {
    return res.status(400).json({ message: 'year and month are required' });
  }

  const y = Number(year);
  const m = Number(month);
  const von = new Date(y, m - 1, 1);
  const bis = new Date(y, m, 0, 23, 59, 59); // Last day of month

  // 1. Determine relevant kundenNrs (same logic as monthly)
  let kundenNrs = [];
  if (kundenNr) {
    const explicitNrs = kundenNr.split(',').map(Number).filter(n => !isNaN(n));
    kundenNrs = [...explicitNrs];
    const parents = await Kunde.find({ kundenNr: { $in: explicitNrs } }).select('_id kundenNr');
    const parentIds = parents.map(p => p._id);
    const children = await Kunde.find({ parentKunde: { $in: parentIds } }).distinct('kundenNr');
    kundenNrs.push(...children);
    kundenNrs = [...new Set(kundenNrs)];

    // Filter by Standort if provided
    if (geschSt) {
      const validKunden = await Kunde.find({ kundenNr: { $in: kundenNrs }, geschSt }).distinct('kundenNr');
      kundenNrs = validKunden;
    }
  } else {
    const kundeFilter = {};
    if (geschSt) kundeFilter.geschSt = geschSt;
    const kunden = await Kunde.find(kundeFilter).select('kundenNr');
    kundenNrs = kunden.map(k => k.kundenNr);
  }

  if (kundenNrs.length === 0) return res.json({ data: [], auftragBreakdown: [] });

  const auftraege = await Auftrag.find({ kundenNr: { $in: kundenNrs } }).select('auftragNr kundenNr');
  if (auftraege.length === 0) return res.json({ data: [], auftragBreakdown: [] });

  const auftragNrs = auftraege.map(a => a.auftragNr);

  const matchStage = {
    auftragNr: { $in: auftragNrs },
    datumVon: { $gte: von, $lte: bis }
  };

  // Total per day
  const totalPipeline = [
    { $match: matchStage },
    { $group: {
      _id: { day: { $dayOfMonth: '$datumVon' } },
      count: { $sum: 1 }
    }},
    { $sort: { '_id.day': 1 } }
  ];
  const totalResult = await Einsatz.aggregate(totalPipeline);
  const data = totalResult.map(r => ({ day: r._id.day, count: r.count }));

  // Auftrag-level breakdown (always returned for drill-down stacking)
  const auftragPipeline = [
    { $match: matchStage },
    { $group: {
      _id: { auftragNr: '$auftragNr', day: { $dayOfMonth: '$datumVon' } },
      count: { $sum: 1 }
    }}
  ];
  const auftragResult = await Einsatz.aggregate(auftragPipeline);

  // Build a map of auftragNr -> eventTitel for labeling
  const relevantAuftragNrs = [...new Set(auftragResult.map(r => r._id.auftragNr))];
  const auftragDocs = await Auftrag.find({ auftragNr: { $in: relevantAuftragNrs } }).select('auftragNr eventTitel kundenNr vonDatum');
  const auftragInfo = {};
  auftragDocs.forEach(a => {
    auftragInfo[a.auftragNr] = { eventTitel: a.eventTitel || `Auftrag #${a.auftragNr}`, kundenNr: a.kundenNr, vonDatum: a.vonDatum };
  });

  // Group by auftragNr -> array of { day, count }
  const auftragMap = {};
  auftragResult.forEach(r => {
    const nr = r._id.auftragNr;
    if (!auftragMap[nr]) auftragMap[nr] = [];
    auftragMap[nr].push({ day: r._id.day, count: r.count });
  });

  const auftragBreakdown = Object.entries(auftragMap).map(([nr, days]) => {
    const info = auftragInfo[Number(nr)] || {};
    const total = days.reduce((s, d) => s + d.count, 0);
    return {
      auftragNr: Number(nr),
      eventTitel: info.eventTitel || `#${nr}`,
      kundenNr: info.kundenNr || null,
      vonDatum: info.vonDatum || null,
      total,
      days
    };
  });

  // Sort by total descending (biggest at bottom of stack)
  auftragBreakdown.sort((a, b) => b.total - a.total);

  res.json({ data, auftragBreakdown });
}));

// @route   GET /api/kunden/:id
// @desc    Einzelnen Kunden abrufen
// @access  Private
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const kunde = await Kunde.findById(req.params.id)
    .populate('kontakte.angelegtVon', 'name email')
    .populate('kontakte.kommentare.verfasser', 'name email');

  if (!kunde) {
    return res.status(404).json({ msg: 'Kunde nicht gefunden' });
  }

  res.json(kunde);
}));

// @route   POST /api/kunden
// @desc    Neuen Kunden erstellen
// @access  Private
router.post('/', auth, asyncHandler(async (req, res) => {
  const newKunde = new Kunde({
    ...req.body
  });

  const savedKunde = await newKunde.save();
  res.json(savedKunde);
}));

// @route   PUT /api/kunden/:id
// @desc    Kunden aktualisieren
// @access  Private
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const kunde = await Kunde.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  )
    .populate('kontakte.angelegtVon', 'name email')
    .populate('kontakte.kommentare.verfasser', 'name email');

  if (!kunde) {
    return res.status(404).json({ msg: 'Kunde nicht gefunden' });
  }

  res.json(kunde);
}));

// @route   POST /api/kunden/:id/kontakte
// @desc    Kontakt zu einem Kunden hinzufügen
// @access  Private
router.post('/:id/kontakte', auth, asyncHandler(async (req, res) => {
  const kunde = await Kunde.findById(req.params.id);
  
  if (!kunde) {
    return res.status(404).json({ msg: 'Kunde nicht gefunden' });
  }

  const { vorname, nachname, email, telefon, kommentare } = req.body;

  const newKontakt = {
    vorname,
    nachname,
    email,
    telefon,
    angelegtVon: req.user.id,
    kommentare: kommentare ? kommentare : [] 
  };

  kunde.kontakte.push(newKontakt);
  await kunde.save();

  // Re-fetch to populate user
  const updatedKunde = await Kunde.findById(req.params.id)
    .populate('kontakte.angelegtVon', 'name email')
    .populate('kontakte.kommentare.verfasser', 'name email');

  res.json(updatedKunde);
}));


// @route   POST /api/kunden/group
// @desc    Kunden gruppieren (Parent zuweisen oder erstellen)
// @body    { childIds: [], parentId?: string, newParentName?: string }
router.post('/group', auth, asyncHandler(async (req, res) => {
  const { childIds, parentId, newParentName } = req.body;

  if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
    return res.status(400).json({ message: 'No child customers selected' });
  }

  let parentKundeId;

  if (parentId) {
    // Existing parent
    const p = await Kunde.findById(parentId);
    if (!p) return res.status(404).json({ message: 'Parent customer not found' });
    parentKundeId = p._id;
  } else if (newParentName) {
    // Create new SuperKunde
    const last = await Kunde.findOne().sort({ kundenNr: -1 });
    let newNr = (last && last.kundenNr) ? last.kundenNr + 1 : 100000;
    if (newNr < 100000) newNr = 100000;

    const newParent = await Kunde.create({
      kundenNr: newNr,
      kundName: newParentName,
      kundStatus: 2
    });
    parentKundeId = newParent._id;
  } else {
    return res.status(400).json({ message: 'Provide parentId or newParentName' });
  }

  // Update children
  await Kunde.updateMany(
    { _id: { $in: childIds } },
    { $set: { parentKunde: parentKundeId } }
  );

  res.json({ success: true, parentId: parentKundeId });
}));

module.exports = router;
