const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Kunde = require('../../models/Customer/Kunde');
const Auftrag = require('../../models/Event/Auftrag');
const Einsatz = require('../../models/Event/Einsatz');
const Schicht = require('../../models/Event/Schicht');
const Rechnung = require('../../models/Rechnung');
const Qualifikation = require('../../models/Event/Qualifikation');
const Kundenpreis = require('../../models/Customer/Kundenpreis');
const KundenKondition = require('../../models/Customer/KundenKondition');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Adresse = require('../../models/System/Adresse');
const Einsatzort = require('../../models/Event/Einsatzort');
const Beruf = require('../../models/Event/Beruf');
const EinsatzinformationTemplate = require('../../models/Event/EinsatzinformationTemplate');
const User = require('../../models/System/User');
const {
  PLACEHOLDERS: EINSATZINFO_PLACEHOLDERS,
  buildPlaceholderValues,
  prepareTemplate: prepareEinsatzinformationTemplate,
  renderTemplate: renderEinsatzinformation,
  resolveTemplate: resolveEinsatzinformationTemplate,
} = require('../../services/operations/EinsatzinformationService');
const { decryptField } = require('../../utils/encryption');
const asyncHandler = require('../../middleware/AsyncHandler');
const auth = require('../../middleware/auth');
const { resolveLocationFromGeschSt } = require('../../services/operations/LocationResolutionService');

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

function getMitarbeiterPersonalnummern(maDoc) {
  const numbers = new Set();

  if (maDoc?.personalnr) numbers.add(String(maDoc.personalnr).trim());
  for (const entry of maDoc?.personalnrHistory || []) {
    if (entry?.value) numbers.add(String(entry.value).trim());
  }

  return [...numbers]
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value));
}

async function getKundenCountMapForMitarbeiter(mitarbeiterId) {
  if (!mitarbeiterId) return new Map();

  const maDoc = await Mitarbeiter.findById(mitarbeiterId)
    .select('personalnr personalnrHistory')
    .lean();

  const personalnummern = getMitarbeiterPersonalnummern(maDoc);
  if (!personalnummern.length) return new Map();

  const einsaetzeByAuftrag = await Einsatz.aggregate([
    { $match: { personalNr: { $in: personalnummern }, auftragNr: { $ne: null } } },
    { $group: { _id: '$auftragNr', count: { $sum: 1 } } }
  ]);

  if (!einsaetzeByAuftrag.length) return new Map();

  const auftragNrToKunde = new Map(
    (await Auftrag.find({
      auftragNr: { $in: einsaetzeByAuftrag.map((entry) => entry._id) }
    })
      .select('auftragNr kundenNr')
      .lean())
      .filter((auftrag) => Number.isInteger(auftrag.kundenNr))
      .map((auftrag) => [auftrag.auftragNr, auftrag.kundenNr])
  );

  const countByKunde = new Map();
  for (const entry of einsaetzeByAuftrag) {
    const kundenNr = auftragNrToKunde.get(entry._id);
    if (!Number.isInteger(kundenNr)) continue;

    countByKunde.set(kundenNr, (countByKunde.get(kundenNr) || 0) + entry.count);
  }

  return countByKunde;
}

// @route   GET /api/kunden
// @desc    Alle Kunden abrufen
// @access  Private
router.get('/', auth, asyncHandler(async (req, res) => {
  const kunden = await Kunde.find()
    .populate('locationV2', 'nameFull shortName color externalId')
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
  const locationV2 = (req.query.locationV2 || '').trim();
  const mitarbeiterId = (req.query.mitarbeiterId || '').trim();

  if (q.length < 2 && !mitarbeiterId) return res.json([]);
  if (locationV2 && !mongoose.isValidObjectId(locationV2)) {
    return res.status(400).json({ message: 'Ungültige locationV2.' });
  }

  const countByKunde = mitarbeiterId
    ? await getKundenCountMapForMitarbeiter(mitarbeiterId)
    : new Map();

  let kunden = [];

  if (q.length >= 2) {
    const isNum = /^\d+$/.test(q);
    let filter;

    if (isNum) {
      filter = { kundenNr: Number(q) };
      if (locationV2) filter.locationV2 = locationV2;
    } else {
      filter = {
        $or: [
          { kundName: { $regex: q, $options: 'i' } },
          { kuerzel: { $regex: q, $options: 'i' } },
        ]
      };

      if (locationV2) {
        filter.locationV2 = locationV2;
      }
    }

    kunden = await Kunde.find(filter)
      .select('_id kundenNr kundName kuerzel kundStatus locationV2')
      .populate('locationV2', 'shortName nameFull')
      .sort({ kundName: 1 })
      .limit(20)
      .lean();
  } else {
    let kundenNrs = [...countByKunde.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kundenNr]) => kundenNr);

    if (!kundenNrs.length) return res.json([]);

    const kundenQuery = { kundenNr: { $in: kundenNrs } };
    if (locationV2) kundenQuery.locationV2 = locationV2;

    const kundenDocs = await Kunde.find(kundenQuery)
      .select('_id kundenNr kundName kuerzel kundStatus locationV2')
      .populate('locationV2', 'shortName nameFull')
      .lean();

    const kundeByNr = new Map(kundenDocs.map((kunde) => [kunde.kundenNr, kunde]));
    kunden = kundenNrs
      .map((kundenNr) => kundeByNr.get(kundenNr))
      .filter(Boolean)
      .slice(0, 20);
  }

  res.json(kunden.map((kunde) => ({
    ...kunde,
    einsatzCount: countByKunde.get(kunde.kundenNr) || 0,
  })));
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

    // De-duplicate
    kundenNrs = [...new Set(explicitNrs)];

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

  // Simple identity map (no parent aggregation)
  const nrMap = {};
  kundenNrs.forEach(nr => { nrMap[nr] = nr; });

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
    kundenNrs = [...new Set(explicitNrs)];
  } else {
    const kunden = await Kunde.find().select('kundenNr');
    kundenNrs = kunden.map(k => k.kundenNr);
  }

  if (kundenNrs.length === 0) {
    return res.json({ data: [], standortBreakdown: [] });
  }

  // 2. Map kundenNr -> geschSt
  const kundenDocs = await Kunde.find({ kundenNr: { $in: kundenNrs } }).select('kundenNr geschSt');
  const nrToGeschSt = {};
  kundenDocs.forEach(k => {
    nrToGeschSt[k.kundenNr] = k.geschSt || 'unbekannt';
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
    kundenNrs = [...new Set(explicitNrs)];

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

// @route   GET /api/kunden/analytics/kennzahlen
// @desc    Umfassende Kennzahlen für einen einzelnen Kunden
//          (Einsätze/Positionen pro Jahr, Umsatz pro Jahr, Anteile, Qualifikationen)
// @access  Private
// Query:   kundenNr (required), geschSt (optional)
router.get('/analytics/kennzahlen', auth, asyncHandler(async (req, res) => {
  const { kundenNr, geschSt } = req.query;
  if (!kundenNr) return res.status(400).json({ message: 'kundenNr required' });

  const kNr = Number(kundenNr);

  const kundenNrs = [kNr];

  // All Auftrag numbers for this customer
  const auftraege = await Auftrag.find({ kundenNr: { $in: kundenNrs } }).select('auftragNr').lean();
  const auftragNrs = auftraege.map(a => a.auftragNr);

  // ── 1. EINSÄTZE per year (IST only, no forecast) ──────────────────────────
  const einsatzPerYear = await Einsatz.aggregate([
    { $match: { auftragNr: { $in: auftragNrs } } },
    { $group: {
      _id: {
        year: { $year: '$datumVon' },
        month: { $month: '$datumVon' },
        auftragNr: '$auftragNr'
      },
      einsaetze: { $sum: 1 }
    }},
    { $group: {
      _id: { year: '$_id.year', month: '$_id.month' },
      einsaetze: { $sum: '$einsaetze' },
      auftraege: { $addToSet: '$_id.auftragNr' }
    }},
    { $group: {
      _id: '$_id.year',
      einsaetze: { $sum: '$einsaetze' },
      auftraegeAll: { $push: '$auftraege' },
      activeMonths: { $sum: 1 }
    }},
    { $sort: { '_id': 1 } }
  ]);

  // Flatten nested auftrag arrays per year and count distinct
  const einsatzStats = einsatzPerYear.map(r => {
    const allNrs = new Set(r.auftraegeAll.flat());
    const auftraegeCount = allNrs.size;
    return {
      year: r._id,
      einsaetze: r.einsaetze,
      auftraege: auftraegeCount,
      activeMonths: r.activeMonths,
      avgPositionenPerAuftrag: auftraegeCount > 0 ? Math.round((r.einsaetze / auftraegeCount) * 10) / 10 : 0
    };
  });

  // Totals across all years
  const totalEinsaetze = einsatzStats.reduce((s, r) => s + r.einsaetze, 0);
  const totalAuftraege = einsatzStats.reduce((s, r) => s + r.auftraege, 0);
  const avgPositionenTotal = totalAuftraege > 0 ? Math.round((totalEinsaetze / totalAuftraege) * 10) / 10 : 0;

  // ── 2. UMSATZ from Rechnung (encrypted netto field) ───────────────────────
  const rechnungenRaw = await Rechnung.find({ kundenNr: { $in: kundenNrs } })
    .select('kundenNr buchDatum netto')
    .lean();

  // Decrypt netto for each Rechnung
  const umsatzPerYear = {};
  let totalNetto = 0;

  for (const r of rechnungenRaw) {
    const netto = parseFloat(decryptField(r.netto)) || 0;
    if (!r.buchDatum || netto === 0) continue;
    totalNetto += netto;
    const year = new Date(r.buchDatum).getFullYear();
    const month = new Date(r.buchDatum).getMonth();
    if (!umsatzPerYear[year]) umsatzPerYear[year] = { months: new Set(), netto: 0 };
    umsatzPerYear[year].netto += netto;
    umsatzPerYear[year].months.add(month);
  }

  const umsatzStats = Object.entries(umsatzPerYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, data]) => {
      const activeMonths = data.months.size;
      const annualizedNetto = activeMonths > 0 && activeMonths < 12
        ? Math.round((data.netto / activeMonths) * 12)
        : Math.round(data.netto);
      return {
        year: Number(year),
        netto: Math.round(data.netto),
        activeMonths,
        annualizedNetto
      };
    });

  // ── 3. UMSATZ SHARES (global + Standort) ──────────────────────────────────
  // Total netto across ALL customers
  const allRechnungen = await Rechnung.find({}).select('kundenNr buchDatum netto').lean();
  let globalNetto = 0;
  const standortNettoMap = {}; // geschSt -> netto

  // We need to know the geschSt for each kundenNr
  const kundeGeschStMap = {};
  if (geschSt) {
    // If geschSt is passed, use it for this customer
    kundenNrs.forEach(n => { kundeGeschStMap[n] = String(geschSt); });
  } else {
    const allKunden = await Kunde.find({}).select('kundenNr geschSt').lean();
    allKunden.forEach(k => { kundeGeschStMap[k.kundenNr] = String(k.geschSt || ''); });
  }

  // We need full geschSt map even if not filtered
  if (!geschSt) {
    // already populated above
  } else {
    const allKunden = await Kunde.find({}).select('kundenNr geschSt').lean();
    allKunden.forEach(k => { kundeGeschStMap[k.kundenNr] = String(k.geschSt || ''); });
  }

  const thisGeschSt = kundeGeschStMap[kNr] || null;
  let standortNetto = 0;

  for (const r of allRechnungen) {
    const netto = parseFloat(decryptField(r.netto)) || 0;
    if (netto === 0 || !r.buchDatum) continue;
    globalNetto += netto;
    const gs = kundeGeschStMap[r.kundenNr] || '';
    if (gs && !standortNettoMap[gs]) standortNettoMap[gs] = 0;
    if (gs) standortNettoMap[gs] += netto;
  }

  standortNetto = thisGeschSt ? (standortNettoMap[thisGeschSt] || 0) : 0;

  const shareGlobal = globalNetto > 0 ? Math.round((totalNetto / globalNetto) * 10000) / 100 : 0;
  const shareStandort = standortNetto > 0 ? Math.round((totalNetto / standortNetto) * 10000) / 100 : 0;

  // ── 4. QUALIFIKATION breakdown ────────────────────────────────────────────
  const qualAgg = await Einsatz.aggregate([
    { $match: { auftragNr: { $in: auftragNrs }, qualSchl: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$qualSchl', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Resolve qualification names
  const qualKeys = qualAgg.map(q => q._id).filter(k => !isNaN(Number(k))).map(Number);
  const qualDocs = await Qualifikation.find({ qualificationKey: { $in: qualKeys } }).lean();
  const qualNameMap = {};
  qualDocs.forEach(q => { qualNameMap[q.qualificationKey] = q.designation; });

  const totalQualEinsaetze = qualAgg.reduce((s, q) => s + q.count, 0);
  const qualifikationen = qualAgg.map(q => ({
    qualSchl: q._id,
    name: qualNameMap[Number(q._id)] || q._id,
    count: q.count,
    share: totalQualEinsaetze > 0 ? Math.round((q.count / totalQualEinsaetze) * 1000) / 10 : 0
  }));

  res.json({
    einsatz: {
      total: totalEinsaetze,
      auftraegeTotal: totalAuftraege,
      avgPositionenPerAuftrag: avgPositionenTotal,
      perYear: einsatzStats
    },
    umsatz: {
      total: Math.round(totalNetto),
      shareGlobal,
      shareStandort,
      geschSt: thisGeschSt,
      perYear: umsatzStats
    },
    qualifikationen
  });
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
    kundenNrs = [...new Set(explicit)];
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
      const bKey = `${doc.kundenNr}-${year}-${month}`;
      if (!bdownMap[bKey]) bdownMap[bKey] = { kundenNr: doc.kundenNr, year, month, sum: 0, count: 0 };
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
    .select('kundenNr geschSt').lean();
  const nrToGeschSt = {};
  kundenDocs.forEach(k => {
    nrToGeschSt[k.kundenNr] = k.geschSt || 'unbekannt';
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
    .select('kundenNr kundName').lean();
  const nameMap = {};  // nr → display name
  kundenDocs.forEach(k => {
    nameMap[k.kundenNr] = k.kundName || `#${k.kundenNr}`;
  });

  const docs = await Rechnung.find({
    kundenNr: { $in: kundenNrs },
    buchDatum: { $gte: von, $lte: bis }
  }).select('kundenNr buchDatum dNetto').lean();

  const totalMap = {};   // day → { sum, count }
  const bdownMap = {};   // 'knr-day' → { kundenNr, kundName, day, sum, count }

  for (const doc of docs) {
    const val = parseFloat((decryptField(doc.dNetto) || '').replace(/,/g, '')) || 0;
    if (!doc.buchDatum) continue;
    const day = doc.buchDatum.getDate();

    if (!totalMap[day]) totalMap[day] = { day, sum: 0, count: 0 };
    totalMap[day].sum   += val;
    totalMap[day].count += 1;

    const bKey = `${doc.kundenNr}-${day}`;
    if (!bdownMap[bKey]) bdownMap[bKey] = { kundenNr: doc.kundenNr, kundName: nameMap[doc.kundenNr] || `#${doc.kundenNr}`, day, sum: 0, count: 0 };
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

// @route   GET /api/kunden/:kundenNr/adressen
// @desc    Importierte Zvoove-Adressen für einen Kunden abrufen
// @access  Private
router.get('/:kundenNr/adressen', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  if (!Number.isInteger(kundenNr)) {
    return res.status(400).json({ message: 'Ungültige Kunden-Nr.' });
  }

  const adressen = await Adresse.find({ knr: String(kundenNr), isActive: { $ne: false } })
    .sort({ art: 1, name: 1 })
    .lean();

  res.json(adressen);
}));

// @route   POST /api/kunden/:kundenNr/adressen
// @desc    Manuelle Adresse für einen Kunden anlegen
// @access  Private
router.post('/:kundenNr/adressen', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  if (!Number.isInteger(kundenNr)) {
    return res.status(400).json({ message: 'Ungültige Kunden-Nr.' });
  }

  const kundeExists = await Kunde.exists({ kundenNr });
  if (!kundeExists) return res.status(404).json({ message: 'Kunde nicht gefunden.' });

  const toNullableText = (value) => {
    const text = String(value ?? '').trim();
    return text || null;
  };
  const art = ['K', 'A', 'P'].includes(req.body.art) ? req.body.art : 'K';
  const name = toNullableText(req.body.name);
  if (!name) return res.status(400).json({ message: 'Bitte einen Namen angeben.' });

  const adresse = await Adresse.create({
    nummer: `MANUAL-${new mongoose.Types.ObjectId()}`,
    art,
    name,
    name1: name,
    branche: toNullableText(req.body.branche),
    strasse: toNullableText(req.body.strasse),
    plz: toNullableText(req.body.plz),
    ort: toNullableText(req.body.ort),
    land: toNullableText(req.body.land),
    anrede: toNullableText(req.body.anrede),
    telefone: Array.isArray(req.body.telefone)
      ? req.body.telefone.map(toNullableText).filter(Boolean)
      : [],
    email: toNullableText(req.body.email)?.toLowerCase() || null,
    homepage: toNullableText(req.body.homepage),
    knr: String(kundenNr),
    isActive: true,
  });

  res.status(201).json({ adresse: adresse.toObject() });
}));

// @route   DELETE /api/kunden/:kundenNr/adressen/:nummer
// @desc    Zvoove-Adresse deaktivieren, damit sie bei späteren Imports verborgen bleibt
// @access  Private
router.delete('/:kundenNr/adressen/:nummer', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  const nummer = String(req.params.nummer || '').trim();
  if (!Number.isInteger(kundenNr) || !nummer) {
    return res.status(400).json({ message: 'Ungültige Kunden- oder Adressnummer.' });
  }

  const adresse = await Adresse.findOneAndUpdate(
    { nummer, knr: String(kundenNr), isActive: { $ne: false } },
    { $set: { isActive: false } },
    { new: true },
  ).lean();
  if (!adresse) return res.status(404).json({ message: 'Adresse nicht gefunden oder bereits deaktiviert.' });

  res.json({ success: true });
}));

// @route   PATCH /api/kunden/:kundenNr/adressen/:nummer/rechnungsanschrift
// @desc    Rechnungsanschrift eines Kunden festlegen oder entfernen
// @access  Private
router.patch('/:kundenNr/adressen/:nummer/rechnungsanschrift', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  const nummer = String(req.params.nummer || '').trim();
  if (!Number.isInteger(kundenNr) || !nummer || typeof req.body.isRechnAdr !== 'boolean') {
    return res.status(400).json({ message: 'Ungültige Kunden-, Adressnummer oder Auswahl.' });
  }

  const filter = {
    nummer,
    knr: String(kundenNr),
    art: { $ne: 'A' },
    isActive: { $ne: false },
  };
  const existing = await Adresse.findOne(filter).select('_id').lean();
  if (!existing) return res.status(404).json({ message: 'Adresse nicht gefunden oder nicht als Rechnungsanschrift geeignet.' });

  if (req.body.isRechnAdr) {
    await Adresse.updateMany(
      { knr: String(kundenNr), isRechnAdr: true },
      { $set: { isRechnAdr: false } },
    );
  }

  const adresse = await Adresse.findOneAndUpdate(
    filter,
    { $set: { isRechnAdr: req.body.isRechnAdr } },
    { new: true, runValidators: true },
  ).lean();

  res.json({ adresse });
}));

// @route   PATCH /api/kunden/:kundenNr/adressen/:nummer/postanschrift
// @desc    Postanschrift eines Kunden festlegen oder entfernen
// @access  Private
router.patch('/:kundenNr/adressen/:nummer/postanschrift', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  const nummer = String(req.params.nummer || '').trim();
  if (!Number.isInteger(kundenNr) || !nummer || typeof req.body.isPostAdr !== 'boolean') {
    return res.status(400).json({ message: 'Ungültige Kunden-, Adressnummer oder Auswahl.' });
  }

  const filter = {
    nummer,
    knr: String(kundenNr),
    art: { $ne: 'A' },
    isActive: { $ne: false },
  };
  const existing = await Adresse.findOne(filter).select('_id').lean();
  if (!existing) return res.status(404).json({ message: 'Adresse nicht gefunden oder nicht als Postanschrift geeignet.' });

  if (req.body.isPostAdr) {
    await Adresse.updateMany(
      { knr: String(kundenNr), isPostAdr: true },
      { $set: { isPostAdr: false } },
    );
  }

  const adresse = await Adresse.findOneAndUpdate(
    filter,
    { $set: { isPostAdr: req.body.isPostAdr } },
    { new: true, runValidators: true },
  ).lean();

  res.json({ adresse });
}));

// @route   PATCH /api/kunden/:kundenNr/adressen/:nummer
// @desc    Importierte Zvoove-Adresse manuell ergänzen oder korrigieren
// @access  Private
router.patch('/:kundenNr/adressen/:nummer', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  const nummer = String(req.params.nummer || '').trim();
  if (!Number.isInteger(kundenNr) || !nummer) {
    return res.status(400).json({ message: 'Ungültige Kunden- oder Adressnummer.' });
  }

  const toNullableText = (value) => {
    const text = String(value ?? '').trim();
    return text || null;
  };
  const update = {
    name: toNullableText(req.body.name),
    branche: toNullableText(req.body.branche),
    strasse: toNullableText(req.body.strasse),
    plz: toNullableText(req.body.plz),
    ort: toNullableText(req.body.ort),
    land: toNullableText(req.body.land),
    anrede: toNullableText(req.body.anrede),
    telefone: Array.isArray(req.body.telefone)
      ? req.body.telefone.map(toNullableText).filter(Boolean)
      : [],
    email: toNullableText(req.body.email)?.toLowerCase() || null,
    homepage: toNullableText(req.body.homepage),
  };
  if (['K', 'A', 'P'].includes(req.body.art)) update.art = req.body.art;

  const adresse = await Adresse.findOneAndUpdate(
    { nummer, knr: String(kundenNr), isActive: { $ne: false } },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();
  if (!adresse) return res.status(404).json({ message: 'Adresse nicht gefunden oder deaktiviert.' });

  res.json({ adresse });
}));

function einsatzortText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function einsatzortAddressUpdate(body) {
  return {
    name: einsatzortText(body.adressName),
    name1: einsatzortText(body.adressName),
    strasse: einsatzortText(body.strasse),
    plz: einsatzortText(body.plz),
    ort: einsatzortText(body.ort),
    land: einsatzortText(body.land) || 'Deutschland',
  };
}

function nullableObjectId(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!mongoose.isValidObjectId(value)) {
    const error = new Error(`Ungültige ${label}.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

async function getEinsatzinformationContext(kundenNr, body = {}) {
  const kunde = await Kunde.findOne({ kundenNr: Number.parseInt(kundenNr, 10) }).lean();
  if (!kunde) {
    const error = new Error('Kunde nicht gefunden.');
    error.statusCode = 404;
    throw error;
  }

  const einsatzortId = nullableObjectId(body.einsatzortId, 'Einsatzort-ID');
  const berufId = nullableObjectId(body.berufId, 'Berufs-ID');
  const qualifikationId = nullableObjectId(body.qualifikationId, 'Qualifikations-ID');
  if ((berufId || qualifikationId) && !einsatzortId) {
    const error = new Error('Berufs- und Qualifikationsvarianten benötigen einen Einsatzort.');
    error.statusCode = 400;
    throw error;
  }

  const [einsatzort, beruf, qualifikation] = await Promise.all([
    einsatzortId
      ? Einsatzort.findOne({ _id: einsatzortId, kunde: kunde._id }).populate('adresse', 'name strasse plz ort land').lean()
      : null,
    berufId ? Beruf.findById(berufId).lean() : null,
    qualifikationId ? Qualifikation.findById(qualifikationId).lean() : null,
  ]);
  if (einsatzortId && !einsatzort) {
    const error = new Error('Der Einsatzort gehört nicht zu diesem Kunden.');
    error.statusCode = 400;
    throw error;
  }
  if (berufId && !beruf) {
    const error = new Error('Beruf nicht gefunden.');
    error.statusCode = 400;
    throw error;
  }
  if (qualifikationId && !qualifikation) {
    const error = new Error('Qualifikation nicht gefunden.');
    error.statusCode = 400;
    throw error;
  }
  return { kunde, einsatzort, beruf, qualifikation, einsatzortId, berufId, qualifikationId };
}

async function assertEinsatzinformationLocationAccess(req, kunde) {
  const requestUserId = req.user?.id || req.user?._id;
  const user = mongoose.isValidObjectId(requestUserId)
    ? await User.findById(requestUserId).select('role roles locationV2 locationAccess').lean()
    : null;
  const roles = [user?.role, ...(user?.roles || [])].map(role => String(role || '').toUpperCase());
  if (roles.includes('ADMIN')) return;

  const fallbackLocation = !kunde.locationV2 && kunde.geschSt
    ? await resolveLocationFromGeschSt(kunde.geschSt)
    : null;
  const customerLocationId = kunde.locationV2 || fallbackLocation?._id;
  // Nicht zugeordnete Alt-Kunden bleiben pflegbar, bis ihr Standort migriert ist.
  if (!customerLocationId) return;
  const allowed = new Set([user?.locationV2, ...(user?.locationAccess || [])].filter(Boolean).map(String));
  if (!allowed.has(String(customerLocationId))) {
    const error = new Error('Für den Standort dieses Kunden fehlt die Berechtigung.');
    error.statusCode = 403;
    throw error;
  }
}

function templateName(body, context) {
  const explicit = String(body.name || '').trim();
  if (explicit) return explicit;
  if (!context.einsatzort) return 'Allgemeiner Kunden-Default';
  const suffix = [context.beruf?.designation, context.qualifikation?.designation].filter(Boolean).join(' · ');
  return suffix ? `${context.einsatzort.bezeichnung} · ${suffix}` : `${context.einsatzort.bezeichnung} · Default`;
}

function populateEinsatzinformation(query) {
  return query
    .populate('einsatzort', 'bezeichnung isActive adresse')
    .populate('beruf', 'jobKey designation')
    .populate('qualifikation', 'qualificationKey designation')
    .populate('createdBy updatedBy', 'name email');
}

async function ensureEinsatzinformationScopeAvailable(context, excludeId = null) {
  const duplicate = await EinsatzinformationTemplate.exists({
    kunde: context.kunde._id,
    einsatzort: context.einsatzortId,
    beruf: context.berufId,
    qualifikation: context.qualifikationId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (duplicate) {
    const error = new Error('Für diese Kombination aus Einsatzort, Beruf und Qualifikation existiert bereits eine Vorlage.');
    error.statusCode = 409;
    throw error;
  }
}

// ── Einsatzinformationen: Kundendefault → Einsatzort → Beruf/Qualifikation ──
router.get('/:kundenNr/einsatzinformationen', auth, asyncHandler(async (req, res) => {
  const kunde = await Kunde.findOne({ kundenNr: Number.parseInt(req.params.kundenNr, 10) }).select('_id locationV2 geschSt').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });
  await assertEinsatzinformationLocationAccess(req, kunde);
  const templates = await populateEinsatzinformation(
    EinsatzinformationTemplate.find({ kunde: kunde._id }).sort({ einsatzort: 1, beruf: 1, qualifikation: 1, name: 1 })
  ).lean();
  res.json({ templates, placeholders: EINSATZINFO_PLACEHOLDERS });
}));

router.get('/:kundenNr/einsatzinformationen/resolve', auth, asyncHandler(async (req, res) => {
  const context = await getEinsatzinformationContext(req.params.kundenNr, req.query);
  await assertEinsatzinformationLocationAccess(req, context.kunde);
  const resolved = await resolveEinsatzinformationTemplate({
    kundeId: context.kunde._id,
    einsatzortId: context.einsatzortId,
    berufId: context.berufId,
    qualifikationId: context.qualifikationId,
  });
  res.json({ ...resolved, placeholders: EINSATZINFO_PLACEHOLDERS });
}));

router.post('/:kundenNr/einsatzinformationen/preview', auth, asyncHandler(async (req, res) => {
  const context = await getEinsatzinformationContext(req.params.kundenNr, req.body);
  await assertEinsatzinformationLocationAccess(req, context.kunde);
  const values = buildPlaceholderValues({
    ...context,
    auftrag: req.body.auftrag || { auftragNr: 12345, eventTitel: 'Sommerfest', vonDatum: new Date(), bisDatum: new Date() },
    schicht: req.body.schicht || { bezeichnung: 'Service', datumVon: new Date(), datumBis: new Date(), uhrzeitVon: '17:00', uhrzeitBis: '01:00' },
    location: req.body.location || { shortName: 'Hamburg' },
  });
  res.json(renderEinsatzinformation(req.body.htmlTemplate, values));
}));

router.post('/:kundenNr/einsatzinformationen', auth, asyncHandler(async (req, res) => {
  const context = await getEinsatzinformationContext(req.params.kundenNr, req.body);
  await assertEinsatzinformationLocationAccess(req, context.kunde);
  await ensureEinsatzinformationScopeAvailable(context);
  const template = await EinsatzinformationTemplate.create({
    kunde: context.kunde._id,
    einsatzort: context.einsatzortId,
    beruf: context.berufId,
    qualifikation: context.qualifikationId,
    name: templateName(req.body, context),
    htmlTemplate: prepareEinsatzinformationTemplate(req.body.htmlTemplate),
    isActive: req.body.isActive !== false,
    createdBy: req.user.id || req.user._id,
    updatedBy: req.user.id || req.user._id,
  });
  await template.populate([
    { path: 'einsatzort', select: 'bezeichnung isActive adresse' },
    { path: 'beruf', select: 'jobKey designation' },
    { path: 'qualifikation', select: 'qualificationKey designation' },
    { path: 'createdBy updatedBy', select: 'name email' },
  ]);
  res.status(201).json({ template });
}));

router.put('/:kundenNr/einsatzinformationen/:id', auth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Ungültige Vorlagen-ID.' });
  const context = await getEinsatzinformationContext(req.params.kundenNr, req.body);
  await assertEinsatzinformationLocationAccess(req, context.kunde);
  await ensureEinsatzinformationScopeAvailable(context, req.params.id);
  const template = await EinsatzinformationTemplate.findOne({ _id: req.params.id, kunde: context.kunde._id });
  if (!template) return res.status(404).json({ message: 'Einsatzinformation nicht gefunden.' });
  template.einsatzort = context.einsatzortId;
  template.beruf = context.berufId;
  template.qualifikation = context.qualifikationId;
  template.name = templateName(req.body, context);
  template.htmlTemplate = prepareEinsatzinformationTemplate(req.body.htmlTemplate);
  template.isActive = req.body.isActive !== false;
  template.version += 1;
  template.updatedBy = req.user.id || req.user._id;
  await template.save();
  await template.populate([
    { path: 'einsatzort', select: 'bezeichnung isActive adresse' },
    { path: 'beruf', select: 'jobKey designation' },
    { path: 'qualifikation', select: 'qualificationKey designation' },
    { path: 'createdBy updatedBy', select: 'name email' },
  ]);
  res.json({ template });
}));

router.delete('/:kundenNr/einsatzinformationen/:id', auth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Ungültige Vorlagen-ID.' });
  const kunde = await Kunde.findOne({ kundenNr: Number.parseInt(req.params.kundenNr, 10) }).select('_id locationV2 geschSt').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });
  await assertEinsatzinformationLocationAccess(req, kunde);
  const deleted = await EinsatzinformationTemplate.findOneAndDelete({ _id: req.params.id, kunde: kunde._id });
  if (!deleted) return res.status(404).json({ message: 'Einsatzinformation nicht gefunden.' });
  res.status(204).end();
}));

// @route   GET /api/kunden/:kundenNr/einsatzorte
// @desc    Einsatzorte eines Kunden mit Adresse und Standort abrufen
// @access  Private
router.get('/:kundenNr/einsatzorte', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  if (!Number.isInteger(kundenNr)) return res.status(400).json({ message: 'Ungültige Kunden-Nr.' });

  const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });

  const einsatzorte = await Einsatzort.find({ kunde: kunde._id })
    .populate('adresse', 'name strasse plz ort land')
    .sort({ isActive: -1, bezeichnung: 1 })
    .lean();
  res.json(einsatzorte);
}));

// @route   POST /api/kunden/:kundenNr/einsatzorte
// @desc    Einsatzort samt zugehöriger Adresse anlegen
// @access  Private
router.post('/:kundenNr/einsatzorte', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  const bezeichnung = einsatzortText(req.body.bezeichnung);
  if (!Number.isInteger(kundenNr) || !bezeichnung) {
    return res.status(400).json({ message: 'Kunden-Nr. und Bezeichnung sind erforderlich.' });
  }

  const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });

  const adresse = await Adresse.create({
    nummer: `MANUAL-EINSATZORT-${new mongoose.Types.ObjectId()}`,
    art: 'K',
    ...einsatzortAddressUpdate(req.body),
    isActive: true,
  });
  const einsatzort = await Einsatzort.create({
    bezeichnung,
    adresse: adresse._id,
    kunde: kunde._id,
    bundesland: einsatzortText(req.body.bundesland) || '',
    isActive: true,
  });
  await einsatzort.populate([
    { path: 'adresse', select: 'name strasse plz ort land' },
  ]);
  res.status(201).json({ einsatzort });
}));

// @route   PATCH /api/kunden/:kundenNr/einsatzorte/:id
// @desc    Einsatzort und seine Adresse bearbeiten
// @access  Private
router.patch('/:kundenNr/einsatzorte/:id', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  const bezeichnung = einsatzortText(req.body.bezeichnung);
  if (!Number.isInteger(kundenNr) || !mongoose.isValidObjectId(req.params.id) || !bezeichnung) {
    return res.status(400).json({ message: 'Ungültige Angaben zum Einsatzort.' });
  }

  const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });
  const einsatzort = await Einsatzort.findOne({ _id: req.params.id, kunde: kunde._id });
  if (!einsatzort) return res.status(404).json({ message: 'Einsatzort nicht gefunden.' });

  if (einsatzort.adresse) {
    await Adresse.findByIdAndUpdate(einsatzort.adresse, { $set: einsatzortAddressUpdate(req.body) }, { runValidators: true });
  }
  einsatzort.bezeichnung = bezeichnung;
  einsatzort.bundesland = einsatzortText(req.body.bundesland) || '';
  await einsatzort.save();
  await einsatzort.populate([
    { path: 'adresse', select: 'name strasse plz ort land' },
  ]);
  res.json({ einsatzort });
}));

// @route   PATCH /api/kunden/:kundenNr/einsatzorte/:id/status
// @desc    Einsatzort aktivieren oder deaktivieren
// @access  Private
router.patch('/:kundenNr/einsatzorte/:id/status', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  if (!Number.isInteger(kundenNr) || !mongoose.isValidObjectId(req.params.id) || typeof req.body.isActive !== 'boolean') {
    return res.status(400).json({ message: 'Ungültige Angaben zum Einsatzortstatus.' });
  }
  const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });
  const einsatzort = await Einsatzort.findOneAndUpdate(
    { _id: req.params.id, kunde: kunde._id },
    { $set: { isActive: req.body.isActive } },
    { new: true },
  ).populate('adresse', 'name strasse plz ort land').lean();
  if (!einsatzort) return res.status(404).json({ message: 'Einsatzort nicht gefunden.' });
  res.json({ einsatzort });
}));

// @route   DELETE /api/kunden/:kundenNr/einsatzorte/:id
// @desc    Einsatzort entfernen; die verknüpfte Adresse bleibt als Historie erhalten
// @access  Private
router.delete('/:kundenNr/einsatzorte/:id', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  if (!Number.isInteger(kundenNr) || !mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige Angaben zum Einsatzort.' });
  }
  const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });
  const einsatzort = await Einsatzort.findOneAndDelete({ _id: req.params.id, kunde: kunde._id }).lean();
  if (!einsatzort) return res.status(404).json({ message: 'Einsatzort nicht gefunden.' });
  res.json({ success: true });
}));

// @route   GET /api/kunden/:kundenNr/preise
// @route   GET /api/kunden/:kundenNr/konditionen
// @desc    Aus Zvoove importierte Zuschlags- und Konditionsregeln
// @access  Private
router.get('/:kundenNr/konditionen', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  if (!Number.isInteger(kundenNr)) {
    return res.status(400).json({ message: 'Ungültige Kunden-Nr.' });
  }

  const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });

  const konditionen = await KundenKondition.find({ kunde: kunde._id })
    .populate('lohnart', 'lohnartNummer lohnartKurzzeichen lohnartBezeichnung')
    .sort({ tabellenNr: 1, laufendeNummer: 1 })
    .lean();
  res.json(konditionen);
}));

// @route   GET /api/kunden/:kundenNr/preise
// @desc    Kundenpreise inklusive Historie, Qualifikation und zugeordnetem Beruf
// @access  Private
router.get('/:kundenNr/preise', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  if (!Number.isInteger(kundenNr)) {
    return res.status(400).json({ message: 'Ungültige Kunden-Nr.' });
  }

  const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });

  const prices = await Kundenpreis.find({ kunde: kunde._id })
    .populate({
      path: 'qualifikation',
      select: 'qualificationKey designation beruf',
      populate: { path: 'beruf', select: 'jobKey designation' },
    })
    .sort({ validFrom: -1 })
    .lean();

  res.json(prices.filter((price) => price.qualifikation?.beruf));
}));

// @route   POST /api/kunden/:kundenNr/preise
// @desc    Neue Preisversion für eine Qualifikation anlegen
// @access  Private
router.post('/:kundenNr/preise', auth, asyncHandler(async (req, res) => {
  const kundenNr = Number.parseInt(req.params.kundenNr, 10);
  const qualificationId = String(req.body.qualifikation || '').trim();
  const hourlyRateCents = Number(req.body.hourlyRateCents);
  const validFrom = new Date(req.body.validFrom);

  if (!Number.isInteger(kundenNr) || !mongoose.isValidObjectId(qualificationId)
    || !Number.isInteger(hourlyRateCents) || hourlyRateCents < 0
    || Number.isNaN(validFrom.getTime())) {
    return res.status(400).json({ message: 'Qualifikation, Preis und DatumVon sind erforderlich.' });
  }

  const [kunde, qualifikation] = await Promise.all([
    Kunde.findOne({ kundenNr }).select('_id').lean(),
    Qualifikation.findById(qualificationId).select('_id qualificationKey beruf').lean(),
  ]);
  if (!kunde) return res.status(404).json({ message: 'Kunde nicht gefunden.' });
  if (!qualifikation?.beruf) {
    return res.status(400).json({ message: 'Qualifikation ist keinem Beruf zugeordnet.' });
  }

  const dayStart = new Date(validFrom);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const existing = await Kundenpreis.exists({
    kunde: kunde._id,
    qualifikation: qualifikation._id,
    validFrom: { $gte: dayStart, $lt: dayEnd },
  });
  if (existing) {
    return res.status(409).json({ message: 'Für diese Qualifikation existiert an diesem Datum bereits ein Preis.' });
  }

  const price = await Kundenpreis.create({
    kunde: kunde._id,
    kundenNrSnapshot: kundenNr,
    qualifikation: qualifikation._id,
    qualSchluessel: qualifikation.qualificationKey,
    hourlyRateCents,
    validFrom: dayStart,
    validTill: null,
    sourceId: `monitor-${new mongoose.Types.ObjectId()}`,
    source: 'monitor',
    createdBy: req.user?.id || null,
  });

  const populated = await Kundenpreis.findById(price._id)
    .populate({
      path: 'qualifikation',
      select: 'qualificationKey designation beruf',
      populate: { path: 'beruf', select: 'jobKey designation' },
    })
    .lean();
  res.status(201).json(populated);
}));

// @route   GET /api/kunden/:kundenNr/top-mitarbeiter
// @desc    Top-Mitarbeiter eines Kunden (nach Einsatz-Anzahl), nur aktive MA
// @access  Private
router.get('/:kundenNr/top-mitarbeiter', auth, asyncHandler(async (req, res) => {
  const kundenNr = parseInt(req.params.kundenNr);
  if (isNaN(kundenNr)) return res.status(400).json({ message: 'Ungültige Kunden-Nr.' });

  // 1. Alle Aufträge dieses Kunden
  const auftragNrs = await Auftrag.distinct('auftragNr', { kundenNr });
  if (auftragNrs.length === 0) return res.json([]);

  // 2. Einsatz-Zählungen je personalNr
  const raw = await Einsatz.aggregate([
    { $match: { auftragNr: { $in: auftragNrs }, personalNr: { $ne: null } } },
    { $group: { _id: '$personalNr', count: { $sum: 1 } } }
  ]);

  if (raw.length === 0) return res.json([]);

  // countByNr: string(personalNr) → count
  const countByNr = {};
  for (const { _id, count } of raw) {
    countByNr[String(_id)] = (countByNr[String(_id)] || 0) + count;
  }
  const allNrs = Object.keys(countByNr);

  // 3. Aktive Mitarbeiter die eine dieser Nummern aktuell oder historisch hatten
  const mitarbeiterDocs = await Mitarbeiter.find({
    isActive: true,
    $or: [
      { personalnr: { $in: allNrs } },
      { 'personalnrHistory.value': { $in: allNrs } }
    ]
  }).select('_id vorname nachname personalnr personalnrHistory').lean();

  // 4. Für jeden MA alle zugehörigen personalNrs summieren
  const results = [];
  for (const ma of mitarbeiterDocs) {
    const nrs = new Set();
    if (ma.personalnr) nrs.add(String(ma.personalnr));
    for (const h of (ma.personalnrHistory || [])) {
      if (h.value) nrs.add(String(h.value));
    }
    let total = 0;
    for (const nr of nrs) total += countByNr[nr] || 0;
    if (total > 0) {
      results.push({
        _id: ma._id,
        vorname: ma.vorname,
        nachname: ma.nachname,
        personalnr: ma.personalnr,
        count: total
      });
    }
  }

  results.sort((a, b) => b.count - a.count);
  res.json(results);
}));

// @route   GET /api/kunden/:kundenNr/top-mitarbeiter/:mitarbeiterId/einsaetze
// @desc    Alle Einsätze eines Mitarbeiters bei einem Kunden (neueste zuerst, max 50)
// @access  Private
router.get('/:kundenNr/top-mitarbeiter/:mitarbeiterId/einsaetze', auth, asyncHandler(async (req, res) => {
  const kundenNr = parseInt(req.params.kundenNr);
  const { mitarbeiterId } = req.params;
  if (isNaN(kundenNr)) return res.status(400).json({ message: 'Ungültige Kunden-Nr.' });

  const ma = await Mitarbeiter.findById(mitarbeiterId).select('personalnr personalnrHistory').lean();
  if (!ma) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });

  const personalNrs = new Set();
  if (ma.personalnr) personalNrs.add(Number(ma.personalnr));
  for (const h of (ma.personalnrHistory || [])) {
    if (h.value) personalNrs.add(Number(h.value));
  }
  if (personalNrs.size === 0) return res.json([]);

  const auftragNrs = await Auftrag.distinct('auftragNr', { kundenNr });
  if (auftragNrs.length === 0) return res.json([]);

  const einsaetze = await Einsatz.find({
    auftragNr: { $in: auftragNrs },
    personalNr: { $in: Array.from(personalNrs) }
  })
    .select('auftragNr datumVon datumBis schichtBezeichnung uhrzeitVon uhrzeitBis bezeichnung')
    .sort({ datumVon: -1 })
    .limit(50)
    .lean();

  if (einsaetze.length === 0) return res.json([]);

  const uniqueNrs = [...new Set(einsaetze.map(e => e.auftragNr))];
  const auftraege = await Auftrag.find({ auftragNr: { $in: uniqueNrs } })
    .select('auftragNr eventTitel vonDatum bisDatum eventOrt')
    .lean();
  const auftragMap = Object.fromEntries(auftraege.map(a => [a.auftragNr, a]));

  res.json(einsaetze.map(e => ({ ...e, auftrag: auftragMap[e.auftragNr] || null })));
}));

module.exports = router;
