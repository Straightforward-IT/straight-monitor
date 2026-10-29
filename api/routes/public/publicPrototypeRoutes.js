const express = require('express');
const asyncHandler = require('../../middleware/AsyncHandler');
const publicAuth = require('../../middleware/publicAuth');
const Auftrag = require('../../models/Event/Auftrag');
const Schicht = require('../../models/Event/Schicht');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Qualifikation = require('../../models/Event/Qualifikation');
const Einsatz = require('../../models/Event/Einsatz');
const JobBewerbung = require('../../models/Event/JobBewerbung');
const mongoose = require('mongoose');
const { completeEinsatzFlipTask } = require('../../services/operations/EinsatzFlipTaskService');
const {
  hasSchichtStarted,
  expireStartedSchichtAusschreibungen,
} = require('../../services/operations/SchichtAusschreibungService');
const { createTomorrowConfirmationFixture, deleteTomorrowConfirmationFixture } = require('../../services/public/PublicNeuigkeitenFixtureService');

const router = express.Router();

const PUBLIC_DEV_EMAILS = new Set([
  'cedricbglx@gmail.com',
  'dh@straightforward.email',
  'hannah.desczyk@web.de',
]);

router.use(publicAuth);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isDevelopment() {
  return String(process.env.NODE_ENV).toLowerCase() !== 'production'
    && String(process.env.APP_ENV).toLowerCase() !== 'production';
}

function requirePrototypeOidc(req, res, next) {
  const email = normalizeEmail(req.oidcEmail || req.query.email);
  const isOidcDevUser = req.oidcUser?.source === 'oidc' && PUBLIC_DEV_EMAILS.has(email);
  const isLegacyDevUser = isDevelopment() && !req.oidcUser && PUBLIC_DEV_EMAILS.has(email);
  if (!isOidcDevUser && !isLegacyDevUser) {
    return res.status(403).json({ msg: 'Kein Zugriff auf den Public-Monitor-Prototyp' });
  }
  return next();
}

function requireDevelopment(req, res, next) {
  if (!isDevelopment()) return res.status(404).json({ msg: 'Nicht verfügbar' });
  return next();
}

async function resolveMitarbeiter(req) {
  const conditions = [];
  if (req.oidcFlipId) conditions.push({ flip_id: req.oidcFlipId });

  const email = normalizeEmail(req.oidcEmail || req.query.email);
  if (email) conditions.push({ email }, { additionalEmails: email });
  if (!conditions.length) return null;

  return Mitarbeiter.findOne({ $or: conditions })
    .select('_id flip_id locationV2 kundenwuensche qualifikationen')
    .populate('kundenwuensche.kunde', 'kundenNr kundName kuerzel')
    .populate('qualifikationen', 'qualificationKey designation')
    .lean();
}

function getBlockedKundenNrs(mitarbeiter) {
  const blocked = new Set();
  for (const wish of mitarbeiter?.kundenwuensche || []) {
    if (wish?.typ !== 'negativ') continue;
    const nr = Number(wish.kunde?.kundenNr ?? wish.kundenNr);
    if (Number.isFinite(nr) && nr > 0) blocked.add(nr);
  }
  return blocked;
}

function normalizeQualKey(raw) {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  if (!str) return '';
  const parsed = Number.parseInt(str, 10);
  return Number.isFinite(parsed) ? String(parsed) : str;
}

function getMitarbeiterQualKeys(mitarbeiter) {
  const set = new Set();
  for (const q of mitarbeiter?.qualifikationen || []) {
    const key = normalizeQualKey(q?.qualificationKey ?? q);
    if (key) {
      set.add(key);
    }
  }
  return set;
}

router.get('/jobs', requirePrototypeOidc, asyncHandler(async (req, res) => {
  const mitarbeiter = await resolveMitarbeiter(req);
  if (!mitarbeiter) {
    return res.status(404).json({ msg: 'Mitarbeiter für diesen Flip-Account nicht gefunden' });
  }
  if (!mitarbeiter.locationV2) {
    return res.json({ jobs: [], applications: {}, applicationSteps: {}, applicationReserves: {}, reason: 'missing_location' });
  }

  const existingBewerbungen = await JobBewerbung.find({ mitarbeiter: mitarbeiter._id }).lean();
  const applications = {};
  const applicationSteps = {};
  const applicationReserves = {};
  const appliedSchichtIds = [];
  for (const bew of existingBewerbungen) {
    applications[bew.jobId] = bew.status;
    if (bew.isReserve) {
      applicationReserves[bew.jobId] = true;
    }
    if (bew.status === 'scheduled') {
      applicationSteps[bew.jobId] = Number(bew.confirmationStep || 0);
    }
    if (bew.schicht && mongoose.isValidObjectId(bew.schicht)) {
      appliedSchichtIds.push(bew.schicht);
    } else if (mongoose.isValidObjectId(bew.jobId)) {
      appliedSchichtIds.push(new mongoose.Types.ObjectId(bew.jobId));
    }
  }

  const now = new Date();
  await expireStartedSchichtAusschreibungen(now);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const schichtQuery = appliedSchichtIds.length
    ? {
        $or: [
          { locationV2: mitarbeiter.locationV2, datumBis: { $gte: today }, bedarf: { $gt: 0 }, istAusgeschrieben: true },
          { _id: { $in: appliedSchichtIds } },
        ],
      }
    : {
        locationV2: mitarbeiter.locationV2,
        datumBis: { $gte: today },
        bedarf: { $gt: 0 },
        istAusgeschrieben: true,
      };

  const schichten = await Schicht.find(schichtQuery)
    .select('auftragNr idAuftragArbeitsschichten bezeichnung treffpunkt treffpunktOrt datumVon datumBis uhrzeitVon uhrzeitBis bedarf besetzt offen endeOffen qualSchl berufSchl istAusgeschrieben einsatzinformation')
    .sort({ datumVon: 1, uhrzeitVon: 1 })
    .limit(100)
    .lean();

  const blockedKundenNrs = getBlockedKundenNrs(mitarbeiter);
  const employeeQualKeys = getMitarbeiterQualKeys(mitarbeiter);

  const auftragNrs = [...new Set(schichten.map((schicht) => schicht.auftragNr))];
  const auftraege = auftragNrs.length
    ? await Auftrag.find({
        auftragNr: { $in: auftragNrs },
        locationV2: mitarbeiter.locationV2,
        isPseudo: { $ne: true },
        auftStatus: 2,
      })
        .select('auftragNr kundenNr eventTitel eventLocation eventStrasse eventPlz eventOrt vonDatum bisDatum')
        .lean()
    : [];
  const auftragByNr = new Map(
    auftraege
      .filter((auftrag) => !blockedKundenNrs.has(Number(auftrag.kundenNr)))
      .map((auftrag) => [auftrag.auftragNr, auftrag])
  );
  const legacyKeys = schichten.map(shift => shift.idAuftragArbeitsschichten).filter(value => value !== null && value !== undefined);
  const assignmentCounts = await Einsatz.aggregate([
    {
      $match: {
        auftragNr: { $in: auftragNrs },
        $or: [
          { schicht: { $in: schichten.map(shift => shift._id) } },
          ...(legacyKeys.length ? [{ idAuftragArbeitsschichten: { $in: legacyKeys } }] : []),
        ],
      },
    },
    {
      $group: {
        _id: { schicht: '$schicht', auftragNr: '$auftragNr', legacy: '$idAuftragArbeitsschichten' },
        regularCount: { $sum: { $cond: [{ $eq: ['$isReserve', true] }, 0, 1] } },
        reserveCount: { $sum: { $cond: [{ $eq: ['$isReserve', true] }, 1, 0] } },
        qualSchl: { $first: '$qualSchl' },
      },
    },
  ]);
  const occupiedById = new Map();
  const occupiedByLegacy = new Map();
  const reserveById = new Map();
  const reserveByLegacy = new Map();
  const fallbackQualById = new Map();
  const fallbackQualByLegacy = new Map();
  assignmentCounts.forEach(item => {
    if (item._id.schicht) {
      const k = String(item._id.schicht);
      occupiedById.set(k, (occupiedById.get(k) || 0) + item.regularCount);
      reserveById.set(k, (reserveById.get(k) || 0) + item.reserveCount);
      if (item.qualSchl) fallbackQualById.set(k, String(item.qualSchl).trim());
    } else {
      const k = `${item._id.auftragNr}:${item._id.legacy}`;
      occupiedByLegacy.set(k, (occupiedByLegacy.get(k) || 0) + item.regularCount);
      reserveByLegacy.set(k, (reserveByLegacy.get(k) || 0) + item.reserveCount);
      if (item.qualSchl) fallbackQualByLegacy.set(k, String(item.qualSchl).trim());
    }
  });

  const allQualKeys = new Set();
  for (const s of schichten) {
    const q = normalizeQualKey(
      s.qualSchl
      || fallbackQualById.get(String(s._id))
      || fallbackQualByLegacy.get(`${s.auftragNr}:${s.idAuftragArbeitsschichten}`)
    );
    if (q) allQualKeys.add(q);
  }
  const qualDocs = allQualKeys.size
    ? await Qualifikation.find({
        qualificationKey: {
          $in: [...allQualKeys].flatMap((k) => {
            const n = Number(k);
            return Number.isFinite(n) ? [k, n] : [k];
          }),
        },
      })
        .select('qualificationKey designation')
        .lean()
    : [];
  const qualDesignationMap = new Map(
    qualDocs.map((q) => [normalizeQualKey(q.qualificationKey), q.designation])
  );

  const jobs = schichten.flatMap((schicht) => {
    const auftrag = auftragByNr.get(schicht.auftragNr);
    if (!auftrag) return [];
    const schichtIdStr = String(schicht._id);
    const legacyKeyStr = `${schicht.auftragNr}:${schicht.idAuftragArbeitsschichten}`;
    const occupiedPlaces = occupiedById.get(schichtIdStr)
      ?? occupiedByLegacy.get(legacyKeyStr)
      ?? 0;
    const reservePlaces = reserveById.get(schichtIdStr)
      ?? reserveByLegacy.get(legacyKeyStr)
      ?? 0;
    const openPlaces = Math.max(0, Number(schicht.bedarf || 0) - occupiedPlaces);
    const hasApplication = Boolean(applications[schichtIdStr]);

    const resolvedQualSchl = normalizeQualKey(
      schicht.qualSchl ||
      fallbackQualById.get(schichtIdStr) ||
      fallbackQualByLegacy.get(legacyKeyStr) ||
      ''
    );

    if (!hasApplication) {
      if (!schicht.istAusgeschrieben) return [];
      if (hasSchichtStarted(schicht, auftrag, now)) return [];
      if (!resolvedQualSchl || !employeeQualKeys.has(resolvedQualSchl)) return [];
    }

    const qualificationDesignation = resolvedQualSchl
      ? qualDesignationMap.get(resolvedQualSchl) || schicht.bezeichnung || `Quali ${resolvedQualSchl}`
      : null;

    return [{
      id: schichtIdStr,
      auftragNr: schicht.auftragNr,
      kundenNr: auftrag.kundenNr || null,
      schichtId: schicht._id,
      legacySchichtId: schicht.idAuftragArbeitsschichten,
      title: auftrag.eventTitel || auftrag.eventLocation || `Auftrag ${schicht.auftragNr}`,
      role: schicht.bezeichnung || null,
      qualSchl: resolvedQualSchl || null,
      qualificationDesignation,
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
      occupiedPlaces,
      reservePlaces,
      openPlaces,
      isReserve: Boolean(applicationReserves[schichtIdStr]),
      einsatzinformationHtml: schicht.einsatzinformation?.renderedHtml || '',
      surcharges: null,
    }];
  });

  return res.json({ jobs, applications, applicationSteps, applicationReserves, source: 'database' });
}));

router.get('/applications', requirePrototypeOidc, asyncHandler(async (req, res) => {
  const mitarbeiter = await resolveMitarbeiter(req);
  if (!mitarbeiter) {
    return res.status(404).json({ msg: 'Mitarbeiter für diesen Flip-Account nicht gefunden' });
  }
  const items = await JobBewerbung.find({ mitarbeiter: mitarbeiter._id }).lean();
  const applications = {};
  const applicationSteps = {};
  for (const item of items) {
    applications[item.jobId] = item.status;
    if (item.status === 'scheduled') {
      applicationSteps[item.jobId] = Number(item.confirmationStep || 0);
    }
  }
  return res.json({ applications, applicationSteps, items });
}));

router.put('/applications/:jobId', requirePrototypeOidc, asyncHandler(async (req, res) => {
  const mitarbeiter = await resolveMitarbeiter(req);
  if (!mitarbeiter) {
    return res.status(404).json({ msg: 'Mitarbeiter für diesen Flip-Account nicht gefunden' });
  }
  const jobId = String(req.params.jobId || '').trim();
  if (!jobId) {
    return res.status(400).json({ msg: 'Job-ID ist erforderlich' });
  }

  const status = req.body?.status ? String(req.body.status).trim() : null;
  if (!status) {
    await JobBewerbung.findOneAndDelete({ jobId, mitarbeiter: mitarbeiter._id });
    return res.json({ ok: true, jobId, status: null });
  }

  if (!['submitted', 'scheduled', 'confirmed', 'rejected'].includes(status)) {
    return res.status(400).json({ msg: 'Ungültiger Bewerbungsstatus' });
  }

  let schicht = null;
  let auftrag = null;
  if (mongoose.isValidObjectId(jobId)) {
    schicht = await Schicht.findById(jobId).lean();
    if (schicht?.auftragNr) {
      auftrag = await Auftrag.findOne({ auftragNr: schicht.auftragNr }).select('auftragNr kundenNr eventTitel eventLocation').lean();
    }
  }

  const blockedKundenNrs = getBlockedKundenNrs(mitarbeiter);
  if (auftrag?.kundenNr != null && blockedKundenNrs.has(Number(auftrag.kundenNr))) {
    return res.status(403).json({ msg: 'Diese Schicht ist für dich nicht verfügbar.' });
  }

  const confirmationStep = Number.isInteger(Number(req.body?.confirmationStep))
    ? Math.max(0, Number(req.body.confirmationStep))
    : 0;

  const update = {
    jobId,
    mitarbeiter: mitarbeiter._id,
    status,
    confirmationStep: status === 'scheduled' ? confirmationStep : 0,
    auftragNr: schicht?.auftragNr ?? (Number.isInteger(Number(req.body?.auftragNr)) ? Number(req.body.auftragNr) : null),
    schicht: schicht?._id || null,
    idAuftragArbeitsschichten: schicht?.idAuftragArbeitsschichten ?? null,
    schichtBezeichnung: schicht?.bezeichnung || req.body?.role || null,
    jobTitle: auftrag?.eventTitel || auftrag?.eventLocation || req.body?.jobTitle || null,
  };

  const bewerbung = await JobBewerbung.findOneAndUpdate(
    { jobId, mitarbeiter: mitarbeiter._id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (status === 'confirmed' && bewerbung.einsatz) {
    const now = new Date();
    const updatedEinsatz = await Einsatz.findByIdAndUpdate(
      bewerbung.einsatz,
      {
        $set: {
          bestaetigt: true,
          'bestaetigung.version': 'einsatz-confirmation-v1',
          'bestaetigung.einsatzzeitenGelesenAt': now,
          'bestaetigung.einsatzkleidungAt': now,
          'bestaetigung.ankunftspufferAt': now,
          'bestaetigung.completedAt': now,
        },
      },
      { new: true }
    );
    if (updatedEinsatz) {
      await completeEinsatzFlipTask({
        einsatz: updatedEinsatz,
        mitarbeiter,
        bearerToken: req.oidcUser?.flip_access_token || null,
      });
    }
  }

  return res.json({ ok: true, bewerbung });
}));

router.delete('/applications', requirePrototypeOidc, asyncHandler(async (req, res) => {
  const mitarbeiter = await resolveMitarbeiter(req);
  if (!mitarbeiter) {
    return res.status(404).json({ msg: 'Mitarbeiter für diesen Flip-Account nicht gefunden' });
  }
  await JobBewerbung.deleteMany({ mitarbeiter: mitarbeiter._id });
  return res.json({ ok: true });
}));

// Local-only fixture for exercising the public news confirmation flow.
router.post('/news-confirmation-fixture', requirePrototypeOidc, requireDevelopment, asyncHandler(async (_req, res) => {
  const fixture = await createTomorrowConfirmationFixture();
  res.status(fixture.created ? 201 : 200).json({ fixture });
}));

router.delete('/news-confirmation-fixture', requirePrototypeOidc, requireDevelopment, asyncHandler(async (_req, res) => {
  res.json({ fixture: await deleteTomorrowConfirmationFixture() });
}));

module.exports = router;
