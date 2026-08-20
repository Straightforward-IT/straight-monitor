const express = require('express');
const asyncHandler = require('../middleware/AsyncHandler');
const publicAuth = require('../middleware/publicAuth');
const Auftrag = require('../models/Event/Auftrag');
const Schicht = require('../models/Event/Schicht');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

const router = express.Router();

const PUBLIC_DEV_EMAILS = new Set([
  'cedricbglx@gmail.com',
  'dh@straightforward.email',
]);

router.use(publicAuth);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function requirePrototypeOidc(req, res, next) {
  const email = normalizeEmail(req.oidcEmail);
  if (req.oidcUser?.source !== 'oidc' || !PUBLIC_DEV_EMAILS.has(email)) {
    return res.status(403).json({ msg: 'Kein Zugriff auf den Public-Monitor-Prototyp' });
  }
  return next();
}

async function resolveMitarbeiter(req) {
  const conditions = [];
  if (req.oidcFlipId) conditions.push({ flip_id: req.oidcFlipId });

  const email = normalizeEmail(req.oidcEmail);
  if (email) conditions.push({ email }, { additionalEmails: email });
  if (!conditions.length) return null;

  return Mitarbeiter.findOne({ $or: conditions })
    .select('_id locationV2')
    .lean();
}

router.get('/jobs', requirePrototypeOidc, asyncHandler(async (req, res) => {
  const mitarbeiter = await resolveMitarbeiter(req);
  if (!mitarbeiter) {
    return res.status(404).json({ msg: 'Mitarbeiter für diesen Flip-Account nicht gefunden' });
  }
  if (!mitarbeiter.locationV2) {
    return res.json({ jobs: [], reason: 'missing_location' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schichten = await Schicht.find({
    locationV2: mitarbeiter.locationV2,
    datumBis: { $gte: today },
    offen: { $gt: 0 },
  })
    .select('auftragNr idAuftragArbeitsschichten bezeichnung treffpunkt treffpunktOrt datumVon datumBis uhrzeitVon uhrzeitBis bedarf besetzt offen endeOffen')
    .sort({ datumVon: 1, uhrzeitVon: 1 })
    .limit(100)
    .lean();

  const auftragNrs = [...new Set(schichten.map((schicht) => schicht.auftragNr))];
  const auftraege = auftragNrs.length
    ? await Auftrag.find({
        auftragNr: { $in: auftragNrs },
        locationV2: mitarbeiter.locationV2,
        isPseudo: { $ne: true },
      })
        .select('auftragNr eventTitel eventLocation eventStrasse eventPlz eventOrt vonDatum bisDatum')
        .lean()
    : [];
  const auftragByNr = new Map(auftraege.map((auftrag) => [auftrag.auftragNr, auftrag]));

  const jobs = schichten.flatMap((schicht) => {
    const auftrag = auftragByNr.get(schicht.auftragNr);
    if (!auftrag) return [];

    return [{
      id: `${schicht.auftragNr}:${schicht.idAuftragArbeitsschichten}:${schicht.datumVon ? new Date(schicht.datumVon).toISOString() : 'unknown'}`,
      auftragNr: schicht.auftragNr,
      schichtId: schicht.idAuftragArbeitsschichten,
      title: auftrag.eventTitel || auftrag.eventLocation || `Auftrag ${schicht.auftragNr}`,
      role: schicht.bezeichnung || null,
      dateFrom: schicht.datumVon || auftrag.vonDatum || null,
      dateTo: schicht.datumBis || auftrag.bisDatum || null,
      timeFrom: schicht.uhrzeitVon || null,
      timeTo: schicht.uhrzeitBis || null,
      endOpen: schicht.endeOffen === 1,
      locationName: auftrag.eventLocation || null,
      city: auftrag.eventOrt || null,
      address: [auftrag.eventStrasse, [auftrag.eventPlz, auftrag.eventOrt].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
      meetingTime: schicht.treffpunkt || null,
      meetingPlace: schicht.treffpunktOrt || null,
      capacity: schicht.bedarf || null,
      occupiedPlaces: schicht.besetzt || 0,
      openPlaces: schicht.offen,
      hourlyWage: null,
      surcharges: null,
      dressCode: null,
    }];
  });

  return res.json({ jobs, source: 'database' });
}));

module.exports = router;