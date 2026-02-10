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
    .populate('kontakte.angelegtVon', 'name email')
    .populate('kontakte.kommentare.verfasser', 'name email')
    .sort({ kundName: 1 });
  
  res.json(kunden);
}));

// @route   GET /api/kunden/analytics/einsaetze
// @desc    Monatliche Einsatz-Anzahl für einen Kunden (über Aufträge)
// @access  Private
router.get('/analytics/einsaetze', auth, asyncHandler(async (req, res) => {
  const { kundenNr, von, bis } = req.query;

  if (!kundenNr) {
    return res.status(400).json({ msg: 'kundenNr ist erforderlich' });
  }

  // 1. Finde alle Aufträge dieses Kunden
  const auftraege = await Auftrag.find({ kundenNr: Number(kundenNr) }).select('auftragNr');
  const auftragNrs = auftraege.map(a => a.auftragNr);

  if (auftragNrs.length === 0) {
    return res.json({ kundenNr: Number(kundenNr), data: [] });
  }

  // 2. Zeitraum-Filter für Einsätze
  const matchStage = { auftragNr: { $in: auftragNrs } };

  if (von || bis) {
    matchStage.datumVon = {};
    if (von) matchStage.datumVon.$gte = new Date(von);
    if (bis) matchStage.datumVon.$lte = new Date(bis);
  }

  // 3. Aggregation: Gruppiere nach Jahr+Monat
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$datumVon' },
          month: { $month: '$datumVon' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ];

  const result = await Einsatz.aggregate(pipeline);

  // 4. Formatierte Ausgabe
  const data = result.map(r => ({
    year: r._id.year,
    month: r._id.month,
    label: `${String(r._id.month).padStart(2, '0')}/${r._id.year}`,
    count: r.count
  }));

  res.json({ kundenNr: Number(kundenNr), data });
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

module.exports = router;
