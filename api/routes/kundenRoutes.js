const express = require('express');
const router = express.Router();
const Kunde = require('../models/Kunde');
const Auftrag = require('../models/Auftrag');
const Einsatz = require('../models/Einsatz');
const Schicht = require('../models/Schicht');
const Rechnung = require('../models/Rechnung');
const { decryptField } = require('../utils/encryption');
const asyncHandler = require('../middleware/AsyncHandler');
const auth = require('../middleware/auth');

// Helper: builds forecast pipeline stages that query BOTH Schicht and Einsatz collections.
// This handles the transition from 7001 (bedarf only in Einsatz) to 7011 (bedarf in Schicht,
// including shifts with no assigned employees that have no Einsatz record).
const forecastUnionPipeline = (matchCondition) => [
  { $match: { ...matchCondition, bedarf: { $gt: 0 } } },
  { $project: { auftragNr: 1, idAuftragArbeitsschichten: 1, datumVon: 1, bedarf: 1 } },
  { $unionWith: { coll: 'einsatzs', pipeline: [
    { $match: { ...matchCondition, bedarf: { $gt: 0 } } },
    { $project: { auftragNr: 1, idAuftragArbeitsschichten: 1, datumVon: 1, bedarf: 1 } }
  ]}},
  // Deduplicate: one bedarf per unique shift-day (handles overlapping Schicht + Einsatz records)
  { $group: {
    _id: { auftragNr: '$auftragNr', idAuftragArbeitsschichten: '$idAuftragArbeitsschichten', datumVon: '$datumVon' },
    bedarf: { $first: '$bedarf' }
  }}
];

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

// @route   GET /api/kunden/search?q=
// @desc    Kunden suchen (Name, Nr, Kürzel)
// @access  Private
router.get('/search', auth, asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const standort = (req.query.standort || '').trim();

  const isNum = /^\d+$/.test(q);
  const filter = isNum
    ? { kundenNr: Number(q) }
    : { $or: [
        { kundName: { $regex: q, $options: 'i' } },
        { kuerzel:  { $regex: q, $options: 'i' } },
      ]};

  // Standort-Filter: kundenNr beginnt mit Standort-Prefix
  if (standort) {
    filter.kundenNr = { ...(filter.kundenNr || {}), $gte: Number(standort) * 1000000, $lt: (Number(standort) + 1) * 1000000 };
  }

  const kunden = await Kunde.find(filter)
    .select('_id kundenNr kundName kuerzel kundStatus geschSt')
    .sort({ kundName: 1 })
    .limit(20)
    .lean();

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

  // Today boundary for IST vs Forecast split
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // 4a. Gesamt-Aggregation (IST: only records up to today)
  const istMatchStage = { ...matchStage, datumVon: { ...matchStage.datumVon, $lte: today } };
  if (von) istMatchStage.datumVon.$gte = new Date(von);
  if (bis) {
    const bisDate = new Date(bis);
    istMatchStage.datumVon.$lte = bisDate < today ? bisDate : today;
  }

  const totalPipeline = [
    { $match: istMatchStage },
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

  // 4a-forecast. Forecast: future records (datumVon > today), deduplicated by shift
  const forecastMatchStage = { auftragNr: { $in: auftragNrs }, datumVon: { $gt: today } };
  if (bis) forecastMatchStage.datumVon.$lte = new Date(bis);

  const forecastPipeline = [
    ...forecastUnionPipeline(forecastMatchStage),
    // Sum bedarf per month
    { $group: {
      _id: {
        year: { $year: '$_id.datumVon' },
        month: { $month: '$_id.datumVon' }
      },
      forecast: { $sum: '$bedarf' }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ];
  const forecastResult = await Schicht.aggregate(forecastPipeline);

  // Merge IST + Forecast into data array
  const dataMap = {};
  totalResult.forEach(r => {
    const key = `${r._id.year}-${r._id.month}`;
    dataMap[key] = {
      year: r._id.year, month: r._id.month,
      label: `${String(r._id.month).padStart(2, '0')}/${r._id.year}`,
      count: r.count, auftragCount: r.auftragCount, forecast: 0
    };
  });
  forecastResult.forEach(r => {
    const key = `${r._id.year}-${r._id.month}`;
    if (!dataMap[key]) {
      dataMap[key] = {
        year: r._id.year, month: r._id.month,
        label: `${String(r._id.month).padStart(2, '0')}/${r._id.year}`,
        count: 0, auftragCount: 0, forecast: 0
      };
    }
    dataMap[key].forecast = r.forecast;
  });
  const data = Object.values(dataMap).sort((a, b) => a.year - b.year || a.month - b.month);

  // 4b. Per-Kunde Breakdown
  let breakdown = [];
  // Calculate breakdown always if filtering (users expect stacked bars of what they selected)
  if (kundenNr) {
    const breakdownPipeline = [
      { $match: istMatchStage },
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
    const map = {}; // key: `kundenNr-year-month` → { count, auftraege: Set, forecast }
    bResult.forEach(r => {
      const originalKnr = auftragToKundeOriginal[r._id.auftragNr];
      if (!originalKnr) return;

      const effectiveNr = nrMap[originalKnr] || originalKnr; // Map to parent
      const key = `${effectiveNr}-${r._id.year}-${r._id.month}`;
      
      if (!map[key]) {
        map[key] = { count: 0, auftraege: new Set(), forecast: 0 };
      }
      map[key].count += r.count;
      map[key].auftraege.add(r._id.auftragNr);
    });

    // Forecast breakdown per Kunde
    const forecastBreakdownPipeline = [
      ...forecastUnionPipeline(forecastMatchStage),
      { $group: {
        _id: {
          auftragNr: '$_id.auftragNr',
          year: { $year: '$_id.datumVon' },
          month: { $month: '$_id.datumVon' }
        },
        forecast: { $sum: '$bedarf' }
      }}
    ];
    const fBreakdown = await Schicht.aggregate(forecastBreakdownPipeline);
    fBreakdown.forEach(r => {
      const originalKnr = auftragToKundeOriginal[r._id.auftragNr];
      if (!originalKnr) return;
      const effectiveNr = nrMap[originalKnr] || originalKnr;
      const key = `${effectiveNr}-${r._id.year}-${r._id.month}`;
      if (!map[key]) {
        map[key] = { count: 0, auftraege: new Set(), forecast: 0 };
      }
      map[key].forecast += r.forecast;
    });

    // Konvertiere zu Array
    Object.entries(map).forEach(([key, val]) => {
      const [kNr, year, month] = key.split('-').map(Number);
      breakdown.push({ 
        kundenNr: kNr, 
        year, 
        month, 
        count: val.count, 
        auftragCount: val.auftraege.size,
        forecast: val.forecast
      });
    });

    breakdown.sort((a, b) => a.year - b.year || a.month - b.month);
  }

  res.json({ data, breakdown });
}));

// @route   GET /api/kunden/analytics/einsaetze/standort
// @desc    Monatliche Einsatz-Anzahl aufgeschlüsselt nach Standort (geschSt)
// @access  Private
// Query:  von, bis (ISO), kundenNr (optional, comma-separated)
router.get('/analytics/einsaetze/standort', auth, asyncHandler(async (req, res) => {
  const { von, bis, kundenNr } = req.query;

  // 1. Bestimme relevante Kunden
  let kundenNrs = [];
  if (kundenNr) {
    const explicitNrs = kundenNr.split(',').map(Number).filter(n => !isNaN(n));
    kundenNrs = [...explicitNrs];
    const parents = await Kunde.find({ kundenNr: { $in: explicitNrs } }).select('_id kundenNr');
    const parentIds = parents.map(p => p._id);
    const children = await Kunde.find({ parentKunde: { $in: parentIds } }).distinct('kundenNr');
    kundenNrs.push(...children);
    kundenNrs = [...new Set(kundenNrs)];
  } else {
    const kunden = await Kunde.find().select('kundenNr');
    kundenNrs = kunden.map(k => k.kundenNr);
  }

  if (kundenNrs.length === 0) {
    return res.json({ data: [], standortBreakdown: [] });
  }

  // 2. Map kundenNr -> geschSt
  const kundenDocs = await Kunde.find({ kundenNr: { $in: kundenNrs } }).select('kundenNr geschSt parentKunde').populate('parentKunde', 'geschSt');
  const nrToGeschSt = {};
  kundenDocs.forEach(k => {
    // Use parent's geschSt if child, otherwise own
    if (k.parentKunde && k.parentKunde.geschSt) {
      nrToGeschSt[k.kundenNr] = k.parentKunde.geschSt;
    } else {
      nrToGeschSt[k.kundenNr] = k.geschSt || 'unbekannt';
    }
  });

  // 3. Aufträge
  const auftraege = await Auftrag.find({ kundenNr: { $in: kundenNrs } }).select('auftragNr kundenNr');
  if (auftraege.length === 0) return res.json({ data: [], standortBreakdown: [] });

  const auftragToKunde = {};
  auftraege.forEach(a => { auftragToKunde[a.auftragNr] = a.kundenNr; });
  const auftragNrs = auftraege.map(a => a.auftragNr);

  // 4. Zeitraum
  const matchStage = { auftragNr: { $in: auftragNrs } };
  if (von || bis) {
    matchStage.datumVon = {};
    if (von) matchStage.datumVon.$gte = new Date(von);
    if (bis) matchStage.datumVon.$lte = new Date(bis);
  }

  // Today boundary for IST vs Forecast split
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // IST matchStage: only records up to today
  const istMatchStage = { ...matchStage, datumVon: { ...matchStage.datumVon, $lte: today } };
  if (von) istMatchStage.datumVon.$gte = new Date(von);
  if (bis) {
    const bisDate = new Date(bis);
    istMatchStage.datumVon.$lte = bisDate < today ? bisDate : today;
  }

  // 5. Gesamt-Aggregation pro Monat (IST only)
  const totalPipeline = [
    { $match: istMatchStage },
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

  // Forecast: future records (datumVon > today)
  const forecastMatchStage = { auftragNr: { $in: auftragNrs }, datumVon: { $gt: today } };
  if (bis) forecastMatchStage.datumVon.$lte = new Date(bis);

  const forecastPipeline = [
    ...forecastUnionPipeline(forecastMatchStage),
    { $group: {
      _id: {
        year: { $year: '$_id.datumVon' },
        month: { $month: '$_id.datumVon' }
      },
      forecast: { $sum: '$bedarf' }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ];
  const forecastResult = await Schicht.aggregate(forecastPipeline);

  // Merge IST + Forecast
  const dataMap = {};
  totalResult.forEach(r => {
    const key = `${r._id.year}-${r._id.month}`;
    dataMap[key] = { year: r._id.year, month: r._id.month, count: r.count, auftragCount: r.auftragCount, forecast: 0 };
  });
  forecastResult.forEach(r => {
    const key = `${r._id.year}-${r._id.month}`;
    if (!dataMap[key]) dataMap[key] = { year: r._id.year, month: r._id.month, count: 0, auftragCount: 0, forecast: 0 };
    dataMap[key].forecast = r.forecast;
  });
  const data = Object.values(dataMap).sort((a, b) => a.year - b.year || a.month - b.month);

  // 6. Breakdown nach Standort + Monat (IST)
  const breakdownPipeline = [
    { $match: istMatchStage },
    { $group: {
      _id: { auftragNr: '$auftragNr', year: { $year: '$datumVon' }, month: { $month: '$datumVon' } },
      count: { $sum: 1 }
    }}
  ];
  const bResult = await Einsatz.aggregate(breakdownPipeline);

  const map = {}; // key: `geschSt-year-month`
  bResult.forEach(r => {
    const knr = auftragToKunde[r._id.auftragNr];
    if (!knr) return;
    const geschSt = nrToGeschSt[knr] || 'unbekannt';
    const key = `${geschSt}-${r._id.year}-${r._id.month}`;
    if (!map[key]) map[key] = { count: 0, auftraege: new Set(), forecast: 0 };
    map[key].count += r.count;
    map[key].auftraege.add(r._id.auftragNr);
  });

  // Forecast breakdown per Standort
  const forecastBreakdownPipeline = [
    ...forecastUnionPipeline(forecastMatchStage),
    { $group: {
      _id: {
        auftragNr: '$_id.auftragNr',
        year: { $year: '$_id.datumVon' },
        month: { $month: '$_id.datumVon' }
      },
      forecast: { $sum: '$bedarf' }
    }}
  ];
  const fStandortResult = await Schicht.aggregate(forecastBreakdownPipeline);
  fStandortResult.forEach(r => {
    const knr = auftragToKunde[r._id.auftragNr];
    if (!knr) return;
    const geschSt = nrToGeschSt[knr] || 'unbekannt';
    const key = `${geschSt}-${r._id.year}-${r._id.month}`;
    if (!map[key]) map[key] = { count: 0, auftraege: new Set(), forecast: 0 };
    map[key].forecast += r.forecast;
  });

  const standortBreakdown = Object.entries(map).map(([key, val]) => {
    const parts = key.split('-');
    const geschSt = parts[0];
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    return { geschSt, year, month, count: val.count, auftragCount: val.auftraege.size, forecast: val.forecast };
  });
  standortBreakdown.sort((a, b) => a.year - b.year || a.month - b.month);

  res.json({ data, standortBreakdown });
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

  // Today boundary for IST vs Forecast split
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // IST: only records up to today
  const istMatchStage = { ...matchStage, datumVon: { $gte: von, $lte: bis < today ? bis : today } };

  // Total per day (IST)
  const totalPipeline = [
    { $match: istMatchStage },
    { $group: {
      _id: { day: { $dayOfMonth: '$datumVon' } },
      count: { $sum: 1 }
    }},
    { $sort: { '_id.day': 1 } }
  ];
  const totalResult = await Einsatz.aggregate(totalPipeline);
  const data = totalResult.map(r => ({ day: r._id.day, count: r.count }));

  // Forecast per day (future only, deduplicated by shift)
  const forecastMatchStage = { auftragNr: { $in: auftragNrs }, datumVon: { $gt: today, $lte: bis } };
  const forecastDailyPipeline = [
    ...forecastUnionPipeline(forecastMatchStage),
    { $group: {
      _id: { day: { $dayOfMonth: '$_id.datumVon' } },
      forecast: { $sum: '$bedarf' }
    }},
    { $sort: { '_id.day': 1 } }
  ];
  const forecastDailyResult = await Schicht.aggregate(forecastDailyPipeline);
  const forecastData = forecastDailyResult.map(r => ({ day: r._id.day, forecast: r.forecast }));

  // Auftrag-level breakdown (IST — always returned for drill-down stacking)
  const auftragPipeline = [
    { $match: istMatchStage },
    { $group: {
      _id: { auftragNr: '$auftragNr', day: { $dayOfMonth: '$datumVon' } },
      count: { $sum: 1 }
    }}
  ];
  const auftragResult = await Einsatz.aggregate(auftragPipeline);

  // Auftrag-level forecast breakdown
  const auftragForecastPipeline = [
    ...forecastUnionPipeline(forecastMatchStage),
    { $group: {
      _id: { auftragNr: '$_id.auftragNr', day: { $dayOfMonth: '$_id.datumVon' } },
      forecast: { $sum: '$bedarf' }
    }}
  ];
  const auftragForecastResult = await Schicht.aggregate(auftragForecastPipeline);

  // Build a map of auftragNr -> eventTitel for labeling
  const allAuftragNrsFromResults = [...new Set([
    ...auftragResult.map(r => r._id.auftragNr),
    ...auftragForecastResult.map(r => r._id.auftragNr)
  ])];
  const auftragDocs = await Auftrag.find({ auftragNr: { $in: allAuftragNrsFromResults } }).select('auftragNr eventTitel kundenNr vonDatum');
  const auftragInfo = {};
  auftragDocs.forEach(a => {
    auftragInfo[a.auftragNr] = { eventTitel: a.eventTitel || `Auftrag #${a.auftragNr}`, kundenNr: a.kundenNr, vonDatum: a.vonDatum };
  });

  // Group by auftragNr -> array of { day, count } + { day, forecast }
  const auftragMap = {};
  auftragResult.forEach(r => {
    const nr = r._id.auftragNr;
    if (!auftragMap[nr]) auftragMap[nr] = { days: [], forecastDays: [] };
    auftragMap[nr].days.push({ day: r._id.day, count: r.count });
  });
  auftragForecastResult.forEach(r => {
    const nr = r._id.auftragNr;
    if (!auftragMap[nr]) auftragMap[nr] = { days: [], forecastDays: [] };
    auftragMap[nr].forecastDays.push({ day: r._id.day, forecast: r.forecast });
  });

  const auftragBreakdown = Object.entries(auftragMap).map(([nr, entry]) => {
    const info = auftragInfo[Number(nr)] || {};
    const total = entry.days.reduce((s, d) => s + d.count, 0);
    const totalForecast = entry.forecastDays.reduce((s, d) => s + d.forecast, 0);
    return {
      auftragNr: Number(nr),
      eventTitel: info.eventTitel || `#${nr}`,
      kundenNr: info.kundenNr || null,
      vonDatum: info.vonDatum || null,
      total,
      totalForecast,
      days: entry.days,
      forecastDays: entry.forecastDays
    };
  });

  // Sort by total descending (biggest at bottom of stack)
  auftragBreakdown.sort((a, b) => (b.total + b.totalForecast) - (a.total + a.totalForecast));

  res.json({ data, forecastData, auftragBreakdown });
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

// ─── Rechnungen Analytics ─────────────────────────────────────────────────────
//
// NOTE: eurNetto is AES-256-GCM encrypted in the DB, so MongoDB cannot aggregate
// it numerically. We fetch raw docs, decrypt server-side, then aggregate in JS.
//
// Grouping uses RECHNDATUM (event date) – format M/D/YY after decryption.
// BUCHDATUM (always last day of month) is only used for DB range filtering.
//
function parseRechnDatum(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  let [m, d, y] = parts.map(Number);
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// Helper: resolve kundenNrs array (incl. children) from query params.
async function resolveKundenNrs(kundenNr, geschSt) {
  let kundenNrs = [];
  if (kundenNr) {
    const explicit = kundenNr.split(',').map(Number).filter(n => !isNaN(n));
    kundenNrs = [...explicit];
    const parents = await Kunde.find({ kundenNr: { $in: explicit } }).select('_id');
    const children = await Kunde.find({ parentKunde: { $in: parents.map(p => p._id) } }).distinct('kundenNr');
    kundenNrs = [...new Set([...kundenNrs, ...children])];
    if (geschSt) {
      const valid = await Kunde.find({ kundenNr: { $in: kundenNrs }, geschSt }).distinct('kundenNr');
      kundenNrs = valid;
    }
  } else {
    const filter = geschSt ? { geschSt } : {};
    kundenNrs = await Kunde.find(filter).distinct('kundenNr');
  }
  return kundenNrs;
}

// @route   GET /api/kunden/analytics/rechnungen
// @desc    Monatlicher Umsatz (eurNetto) aus Rechnungen, optional nach Kunden gefiltert
// @access  Private
// Query: von, bis (ISO), geschSt, kundenNr (comma-sep)
router.get('/analytics/rechnungen', auth, asyncHandler(async (req, res) => {
  const { von, bis, geschSt, kundenNr } = req.query;

  const kundenNrs = await resolveKundenNrs(kundenNr, geschSt);
  if (kundenNrs.length === 0) return res.json({ data: [], breakdown: [] });

  const match = { kundenNr: { $in: kundenNrs } };
  if (von || bis) {
    match.buchDatum = {};
    if (von) match.buchDatum.$gte = new Date(von);
    if (bis) match.buchDatum.$lte = new Date(bis);
  }

  const docs = await Rechnung.find(match).select('kundenNr buchDatum dNetto').lean();

  // Build parent-mapping for breakdown (child knr → parent knr)
  const kundenDocs = await Kunde.find({ kundenNr: { $in: kundenNrs } })
    .select('kundenNr parentKunde').populate('parentKunde', 'kundenNr').lean();
  const nrMap = {};
  kundenDocs.forEach(k => {
    nrMap[k.kundenNr] = k.parentKunde ? k.parentKunde.kundenNr : k.kundenNr;
  });

  const totalMap = {};  // 'year-month' → { year, month, sum, count }
  const bdownMap = {};  // 'knr-year-month' → { kundenNr, year, month, sum, count }

  for (const doc of docs) {
    const val = parseFloat((decryptField(doc.dNetto) || '').replace(/,/g, '')) || 0;
    if (!doc.buchDatum) continue;
    const year  = doc.buchDatum.getFullYear();
    const month = doc.buchDatum.getMonth() + 1;

    const tKey = `${year}-${month}`;
    if (!totalMap[tKey]) totalMap[tKey] = { year, month, sum: 0, count: 0 };
    totalMap[tKey].sum   += val;
    totalMap[tKey].count += 1;

    if (kundenNr) {
      const effNr = nrMap[doc.kundenNr] ?? doc.kundenNr;
      const bKey = `${effNr}-${year}-${month}`;
      if (!bdownMap[bKey]) bdownMap[bKey] = { kundenNr: effNr, year, month, sum: 0, count: 0 };
      bdownMap[bKey].sum   += val;
      bdownMap[bKey].count += 1;
    }
  }

  const data = Object.values(totalMap).sort((a, b) => a.year - b.year || a.month - b.month);
  const breakdown = Object.values(bdownMap).sort((a, b) => a.year - b.year || a.month - b.month);

  res.json({ data, breakdown });
}));

// @route   GET /api/kunden/analytics/rechnungen/standort
// @desc    Monatlicher Umsatz aufgeschlüsselt nach Standort
// @access  Private
router.get('/analytics/rechnungen/standort', auth, asyncHandler(async (req, res) => {
  const { von, bis, kundenNr } = req.query;

  const kundenNrs = await resolveKundenNrs(kundenNr, null);
  if (kundenNrs.length === 0) return res.json({ data: [], standortBreakdown: [] });

  const kundenDocs = await Kunde.find({ kundenNr: { $in: kundenNrs } })
    .select('kundenNr geschSt parentKunde').populate('parentKunde', 'geschSt').lean();
  const nrToGeschSt = {};
  kundenDocs.forEach(k => {
    nrToGeschSt[k.kundenNr] = (k.parentKunde && k.parentKunde.geschSt)
      ? k.parentKunde.geschSt
      : (k.geschSt || 'unbekannt');
  });

  const match = { kundenNr: { $in: kundenNrs } };
  if (von || bis) {
    match.buchDatum = {};
    if (von) match.buchDatum.$gte = new Date(von);
    if (bis) match.buchDatum.$lte = new Date(bis);
  }

  const docs = await Rechnung.find(match).select('kundenNr buchDatum dNetto').lean();

  const totalMap = {};   // 'year-month'
  const stMap    = {};   // 'geschSt-year-month'

  for (const doc of docs) {
    const val = parseFloat((decryptField(doc.dNetto) || '').replace(/,/g, '')) || 0;
    if (!doc.buchDatum) continue;
    const year    = doc.buchDatum.getFullYear();
    const month   = doc.buchDatum.getMonth() + 1;
    const geschSt = nrToGeschSt[doc.kundenNr] || 'unbekannt';

    const tKey = `${year}-${month}`;
    if (!totalMap[tKey]) totalMap[tKey] = { year, month, sum: 0, count: 0 };
    totalMap[tKey].sum   += val;
    totalMap[tKey].count += 1;

    const sKey = `${geschSt}-${year}-${month}`;
    if (!stMap[sKey]) stMap[sKey] = { geschSt, year, month, sum: 0, count: 0 };
    stMap[sKey].sum   += val;
    stMap[sKey].count += 1;
  }

  const data = Object.values(totalMap).sort((a, b) => a.year - b.year || a.month - b.month);
  const standortBreakdown = Object.values(stMap).sort((a, b) => a.year - b.year || a.month - b.month);

  res.json({ data, standortBreakdown });
}));

// @route   GET /api/kunden/analytics/rechnungen/daily
// @desc    Täglicher Umsatz für einen bestimmten Monat (Drill-Down)
// @access  Private
// Query: year, month (required), geschSt, kundenNr
router.get('/analytics/rechnungen/daily', auth, asyncHandler(async (req, res) => {
  const { year, month, geschSt, kundenNr } = req.query;
  if (!year || !month) {
    return res.status(400).json({ message: 'year and month are required' });
  }

  const y = Number(year);
  const m = Number(month);
  const von = new Date(y, m - 1, 1);
  const bis = new Date(y, m, 0, 23, 59, 59);

  const kundenNrs = await resolveKundenNrs(kundenNr, geschSt);
  if (kundenNrs.length === 0) return res.json({ data: [], kundenBreakdown: [] });

  const kundenDocs = await Kunde.find({ kundenNr: { $in: kundenNrs } })
    .select('kundenNr kundName parentKunde').populate('parentKunde', 'kundenNr kundName').lean();
  const nrMap   = {};  // child → parent nr
  const nameMap = {};  // nr → display name
  kundenDocs.forEach(k => {
    const effNr = k.parentKunde ? k.parentKunde.kundenNr : k.kundenNr;
    nrMap[k.kundenNr]  = effNr;
    nameMap[effNr] = nameMap[effNr] || (k.parentKunde ? k.parentKunde.kundName : k.kundName) || `#${effNr}`;
  });

  const docs = await Rechnung.find({
    kundenNr: { $in: kundenNrs },
    buchDatum: { $gte: von, $lte: bis }
  }).select('kundenNr buchDatum dNetto').lean();

  const totalMap = {};   // day → { sum, count }
  const bdownMap = {};   // 'effNr-day' → { kundenNr, kundName, day, sum, count }

  for (const doc of docs) {
    const val = parseFloat((decryptField(doc.dNetto) || '').replace(/,/g, '')) || 0;
    if (!doc.buchDatum) continue;
    const day   = doc.buchDatum.getDate();
    const effNr = nrMap[doc.kundenNr] ?? doc.kundenNr;

    if (!totalMap[day]) totalMap[day] = { day, sum: 0, count: 0 };
    totalMap[day].sum   += val;
    totalMap[day].count += 1;

    const bKey = `${effNr}-${day}`;
    if (!bdownMap[bKey]) bdownMap[bKey] = { kundenNr: effNr, kundName: nameMap[effNr] || `#${effNr}`, day, sum: 0, count: 0 };
    bdownMap[bKey].sum   += val;
    bdownMap[bKey].count += 1;
  }

  const data = Object.values(totalMap).sort((a, b) => a.day - b.day);

  const byKunde = {};
  Object.values(bdownMap).forEach(e => {
    if (!byKunde[e.kundenNr]) byKunde[e.kundenNr] = { kundenNr: e.kundenNr, kundName: e.kundName, days: [], total: 0 };
    byKunde[e.kundenNr].days.push({ day: e.day, sum: e.sum, count: e.count });
    byKunde[e.kundenNr].total += e.sum;
  });
  const kundenBreakdown = Object.values(byKunde).sort((a, b) => b.total - a.total);

  res.json({ data, kundenBreakdown });
}));
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;
