const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const DispoEintrag = require('../models/DispoEintrag');
const Mitarbeiter = require('../models/Mitarbeiter');
const Einsatz = require('../models/Einsatz');
const Auftrag = require('../models/Auftrag');
const Kunde = require('../models/Kunde');

// ─── GET /api/dispo?von=&bis=&standort=&mitarbeiterId= ───
// Liefert DispoEinträge + Einsätze (gemerged) für den Zeitraum
router.get('/', auth, asyncHandler(async (req, res) => {
  const { von, bis, standort, mitarbeiterId } = req.query;

  if (!von || !bis) {
    return res.status(400).json({ message: 'Query-Parameter "von" und "bis" sind erforderlich.' });
  }

  const dateVon = new Date(von);
  const dateBis = new Date(bis);

  if (isNaN(dateVon.getTime()) || isNaN(dateBis.getTime())) {
    return res.status(400).json({ message: 'Ungültige Datumswerte.' });
  }

  // ── 1. Mitarbeiter laden (gefiltert nach Standort) ──
  const maFilter = { isActive: true };
  if (mitarbeiterId) {
    maFilter._id = mitarbeiterId;
  }

  let mitarbeiter = await Mitarbeiter.find(maFilter)
    .select('_id vorname nachname personalnr telefon qualifikationen berufe profilbild dispoNotiz kundenwuensche')
    .populate('qualifikationen', 'qualificationKey designation')
    .populate('berufe', 'jobKey designation')
    .populate('kundenwuensche.kunde', 'kundenNr kundName kuerzel')
    .populate('kundenwuensche.angelegtVon', 'vorname nachname')
    .lean();

  // Standort-Filter (personalnr-prefix: 1=Berlin, 2=Hamburg, 3=Köln)
  if (standort) {
    mitarbeiter = mitarbeiter.filter(ma => {
      const pnr = String(ma.personalnr || '').trim();
      return pnr.startsWith(standort);
    });
  }

  const maIds = mitarbeiter.map(m => m._id);
  const personalNrs = mitarbeiter
    .filter(m => m.personalnr)
    .map(m => parseInt(m.personalnr, 10))
    .filter(n => !isNaN(n));

  // ── 2. DispoEinträge im Zeitraum laden ──
  const eintraege = await DispoEintrag.find({
    mitarbeiter: { $in: maIds },
    datumVon: { $lte: dateBis },
    datumBis: { $gte: dateVon },
  }).lean();

  // ── 3. Einsätze im Zeitraum laden (für planned-Status) ──
  const einsaetze = await Einsatz.find({
    personalNr: { $in: personalNrs },
    datumVon: { $lte: dateBis },
    datumBis: { $gte: dateVon },
  }).select('personalNr datumVon datumBis auftragNr bezeichnung schichtBezeichnung uhrzeitVon uhrzeitBis isPseudo').lean();

  // PersonalNr → Mitarbeiter._id Mapping
  const pnrToMaId = {};
  for (const ma of mitarbeiter) {
    if (ma.personalnr) {
      pnrToMaId[parseInt(ma.personalnr, 10)] = ma._id;
    }
  }

  // Kuerzel-Lookup: auftragNr → kuerzel
  const auftragNrs = [...new Set(einsaetze.map(e => e.auftragNr).filter(Boolean))];
  let auftragNrToKuerzel = {};
  if (auftragNrs.length) {
    const auftraege = await Auftrag.find({ auftragNr: { $in: auftragNrs } }).select('auftragNr kundenNr').lean();
    const kundenNrs = [...new Set(auftraege.map(a => a.kundenNr).filter(Boolean))];
    const kunden = kundenNrs.length
      ? await Kunde.find({ kundenNr: { $in: kundenNrs } }).select('kundenNr kuerzel').lean()
      : [];
    const kundenNrToKuerzel = {};
    for (const k of kunden) kundenNrToKuerzel[k.kundenNr] = k.kuerzel || null;
    for (const a of auftraege) auftragNrToKuerzel[a.auftragNr] = kundenNrToKuerzel[a.kundenNr] || null;
  }

  // Einsätze als pseudo-DispoEinträge konvertieren
  const einsatzEintraege = einsaetze.map(e => ({
    _id: e._id,
    _source: 'einsatz',
    mitarbeiter: pnrToMaId[e.personalNr] || null,
    datumVon: e.datumVon,
    datumBis: e.datumBis,
    typ: 'planned',
    auftragNr: e.auftragNr,
    bezeichnung: e.bezeichnung,
    schichtBezeichnung: e.schichtBezeichnung,
    uhrzeitVon: e.uhrzeitVon,
    uhrzeitBis: e.uhrzeitBis,
    isPseudo: e.isPseudo,
    kuerzel: auftragNrToKuerzel[e.auftragNr] || null,
  })).filter(e => e.mitarbeiter != null);

  res.json({
    mitarbeiter,
    eintraege: [...eintraege, ...einsatzEintraege],
  });
}));

// ─── POST /api/dispo ───
router.post('/', auth, asyncHandler(async (req, res) => {
  const { mitarbeiter, datumVon, datumBis, typ, verfuegbarkeit, abwesenheitsKategorie, text, zeitVon, zeitBis, farbe } = req.body;

  if (!mitarbeiter || !datumVon || !typ) {
    return res.status(400).json({ message: 'mitarbeiter, datumVon und typ sind erforderlich.' });
  }

  const VALID_TYPEN = ['verfuegbarkeit', 'abwesenheit', 'notiz', 'hinweis'];
  if (!VALID_TYPEN.includes(typ)) {
    return res.status(400).json({ message: `Ungültiger Typ. Erlaubt: ${VALID_TYPEN.join(', ')}` });
  }

  if (typ === 'verfuegbarkeit' && !['available', 'partially', 'blocked'].includes(verfuegbarkeit)) {
    return res.status(400).json({ message: 'Bei typ=verfuegbarkeit muss verfuegbarkeit gesetzt sein (available/partially/blocked).' });
  }

  if (typ === 'abwesenheit' && !['urlaub', 'krank', 'feiertag', 'ueberstunden', 'sonstiges'].includes(abwesenheitsKategorie)) {
    return res.status(400).json({ message: 'Bei typ=abwesenheit muss abwesenheitsKategorie gesetzt sein.' });
  }

  const eintrag = new DispoEintrag({
    mitarbeiter,
    datumVon: new Date(datumVon),
    datumBis: datumBis ? new Date(datumBis) : new Date(datumVon),
    typ,
    verfuegbarkeit: typ === 'verfuegbarkeit' ? verfuegbarkeit : undefined,
    abwesenheitsKategorie: typ === 'abwesenheit' ? abwesenheitsKategorie : undefined,
    text,
    zeitVon,
    zeitBis,
    farbe,
    erstellt_von: req.user.id,
  });

  await eintrag.save();
  res.status(201).json(eintrag);
}));

// ─── PUT /api/dispo/:id ───
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const { typ, verfuegbarkeit, abwesenheitsKategorie, text, datumVon, datumBis, zeitVon, zeitBis, farbe } = req.body;

  const update = {};
  if (typ !== undefined) update.typ = typ;
  if (verfuegbarkeit !== undefined) update.verfuegbarkeit = verfuegbarkeit;
  if (abwesenheitsKategorie !== undefined) update.abwesenheitsKategorie = abwesenheitsKategorie;
  if (text !== undefined) update.text = text;
  if (datumVon !== undefined) update.datumVon = new Date(datumVon);
  if (datumBis !== undefined) update.datumBis = new Date(datumBis);
  if (zeitVon !== undefined) update.zeitVon = zeitVon;
  if (zeitBis !== undefined) update.zeitBis = zeitBis;
  if (farbe !== undefined) update.farbe = farbe;

  const eintrag = await DispoEintrag.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!eintrag) {
    return res.status(404).json({ message: 'Eintrag nicht gefunden.' });
  }

  res.json(eintrag);
}));

// ─── DELETE /api/dispo/:id ───
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const eintrag = await DispoEintrag.findByIdAndDelete(req.params.id);

  if (!eintrag) {
    return res.status(404).json({ message: 'Eintrag nicht gefunden.' });
  }

  res.json({ message: 'Eintrag gelöscht.' });
}));

// ─── PATCH /api/dispo/notiz/:mitarbeiterId ───
router.patch('/notiz/:mitarbeiterId', auth, asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.status(400).json({ message: '"text" ist erforderlich.' });
  }
  const ma = await Mitarbeiter.findByIdAndUpdate(
    req.params.mitarbeiterId,
    { dispoNotiz: text },
    { new: true, select: '_id dispoNotiz' }
  );
  if (!ma) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden.' });
  res.json({ _id: ma._id, dispoNotiz: ma.dispoNotiz });
}));

module.exports = router;
