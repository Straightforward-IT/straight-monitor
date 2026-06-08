const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/AsyncHandler');
const publicAuth = require('../middleware/publicAuth');
const Auftrag = require('../models/Auftrag');
const Schicht = require('../models/Schicht');
const Einsatz = require('../models/Einsatz');
const Mitarbeiter = require('../models/Mitarbeiter');
const Beruf = require('../models/Beruf');
const Qualifikation = require('../models/Qualifikation');
const GuestCapacityCounter = require('../models/GuestCapacityCounter');
const GuestCapacityMeta = require('../models/GuestCapacityMeta');
const GuestCapacityChatMessage = require('../models/GuestCapacityChatMessage');
const User = require('../models/User');
const logger = require('../utils/logger');

router.use(publicAuth);

const capacityClients = new Map();

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseCapacityLimit(value) {
  if (value === null || value === undefined || value === '') return { valid: true, limit: null };
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return { valid: false, limit: null };
  return { valid: true, limit: parsed };
}

function normalizeMessage(value) {
  const body = String(value || '').trim();
  return body.length > 500 ? body.substring(0, 500) : body;
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getStartOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getEndOfToday() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getRequestEmail(req) {
  return normalizeEmail(req.oidcEmail || req.query.email || req.body?.email || req.headers['x-public-email']);
}

function getPersonalNrAliases(mitarbeiter) {
  const values = [mitarbeiter?.personalnr, ...(mitarbeiter?.personalnrHistory || []).map((entry) => entry.value)];
  return [...new Set(
    values
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];
}

function getPrimaryPersonalNr(mitarbeiter) {
  const current = Number.parseInt(mitarbeiter?.personalnr, 10);
  if (Number.isInteger(current) && current > 0) return current;
  return getPersonalNrAliases(mitarbeiter)[0] || null;
}

function requireOidcIdentity(req, res) {
  if (req.oidcFlipId || getRequestEmail(req)) return true;
  res.status(403).json({ msg: 'OIDC login oder E-Mail ist fuer den Capacity Counter erforderlich' });
  return false;
}

async function resolveOidcMitarbeiter(req) {
  const orConditions = [];
  if (req.oidcFlipId) orConditions.push({ flip_id: req.oidcFlipId });

  const email = getRequestEmail(req);
  if (email) {
    orConditions.push({ email }, { additionalEmails: email });
  }

  if (!orConditions.length) return null;

  return Mitarbeiter.findOne({ $or: orConditions })
    .select('_id personalnr personalnrHistory vorname nachname email flip_id qualifikationen')
    .lean();
}

async function getAuthenticatedMitarbeiter(req, res) {
  if (!requireOidcIdentity(req, res)) return null;

  const mitarbeiter = await resolveOidcMitarbeiter(req);
  if (!mitarbeiter) {
    res.status(404).json({ msg: 'Mitarbeiter fuer diesen Flip-Account nicht gefunden' });
    return null;
  }

  const personalNr = getPrimaryPersonalNr(mitarbeiter);
  if (!personalNr) {
    res.status(400).json({ msg: 'Mitarbeiter hat keine gueltige Personalnummer' });
    return null;
  }

  return { mitarbeiter, personalNr, aliases: getPersonalNrAliases(mitarbeiter) };
}

async function assertAssignedToAuftrag(auftragNr, aliases) {
  if (!aliases.length) return false;
  const assignment = await Einsatz.exists({ auftragNr, personalNr: { $in: aliases } });
  return !!assignment;
}

async function requireAssignedMitarbeiter(req, res, auftragNr) {
  const auth = await getAuthenticatedMitarbeiter(req, res);
  if (!auth) return null;

  const assigned = await assertAssignedToAuftrag(auftragNr, auth.aliases);
  if (!assigned) {
    res.status(403).json({ msg: 'Kein Zugriff auf diesen Auftrag' });
    return null;
  }

  return auth;
}

async function getCapacityPermissions(auth) {
  const email = normalizeEmail(auth.mitarbeiter.email);
  const userConditions = [{ mitarbeiter: auth.mitarbeiter._id }];
  if (email) userConditions.push({ email });

  const [user, teamleiterQual] = await Promise.all([
    User.findOne({ $or: userConditions }).select('role roles').lean(),
    Qualifikation.findOne({ qualificationKey: 50055 }).select('_id').lean(),
  ]);

  const roles = [user?.role, ...(user?.roles || [])]
    .filter(Boolean)
    .map((role) => String(role).trim().toUpperCase());
  const hasTeamleiterRole = roles.some((role) => ['TEAMLEITER', 'TEAMLEAD', 'TL'].includes(role));
  const teamleiterQualId = teamleiterQual ? String(teamleiterQual._id) : null;
  const hasTeamleiterQualification = teamleiterQualId
    ? (auth.mitarbeiter.qualifikationen || []).some((qualifikation) => {
        const id = String(qualifikation?._id || qualifikation);
        const key = Number.parseInt(qualifikation?.qualificationKey, 10);
        return id === teamleiterQualId || key === 50055;
      })
    : false;

  return {
    canSetCapacityLimit: hasTeamleiterRole || hasTeamleiterQualification,
    isTeamleiter: hasTeamleiterRole || hasTeamleiterQualification,
  };
}

function formatPersonName(person) {
  return [person?.vorname, person?.nachname].filter(Boolean).join(' ').trim();
}

function formatCapacityMeta(meta, totalGuests) {
  const limit = Number.isInteger(meta?.capacityLimit) ? meta.capacityLimit : null;
  return {
    limit,
    limitUpdatedAt: meta?.limitUpdatedAt || null,
    limitUpdatedByPersonalNr: meta?.limitUpdatedByPersonalNr || null,
    limitUpdatedByName: formatPersonName(meta?.limitUpdatedBy) || null,
    remainingCapacity: limit === null ? null : limit - totalGuests,
    isOverLimit: limit !== null && totalGuests > limit,
  };
}

function formatChatMessage(message, currentPersonalNr = null) {
  return {
    id: String(message._id),
    auftragNr: message.auftragNr,
    personalNr: message.personalNr,
    vorname: message.mitarbeiter?.vorname || null,
    nachname: message.mitarbeiter?.nachname || null,
    body: message.body,
    createdAt: message.createdAt,
    isCurrentUser: Number(message.personalNr) === Number(currentPersonalNr),
  };
}

function broadcastCapacityUpdate(auftragNr, data) {
  const clients = capacityClients.get(auftragNr);
  if (!clients || clients.size === 0) return;

  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
      if (typeof client.flush === 'function') client.flush();
    } catch (error) {
      logger.warn(`Capacity SSE write failed for Auftrag ${auftragNr}: ${error.message}`);
    }
  }
}

async function getCapacityState(auftragNr, personalNr) {
  const [aggregateResult, ownCounter, contributors, meta] = await Promise.all([
    GuestCapacityCounter.aggregate([
      { $match: { auftragNr } },
      {
        $group: {
          _id: '$auftragNr',
          totalGuests: { $sum: '$guestCount' },
          updatedAt: { $max: '$updatedAt' },
        },
      },
    ]),
    GuestCapacityCounter.findOne({ auftragNr, personalNr })
      .select('guestCount updatedAt')
      .lean(),
    GuestCapacityCounter.find({ auftragNr, guestCount: { $gt: 0 } })
      .select('personalNr mitarbeiter guestCount updatedAt')
      .populate({ path: 'mitarbeiter', select: 'vorname nachname email' })
      .sort({ guestCount: -1, updatedAt: -1 })
      .lean(),
    GuestCapacityMeta.findOne({ auftragNr })
      .select('capacityLimit limitUpdatedAt limitUpdatedBy limitUpdatedByPersonalNr')
      .populate({ path: 'limitUpdatedBy', select: 'vorname nachname' })
      .lean(),
  ]);

  const aggregate = aggregateResult[0] || null;
  const totalGuests = aggregate?.totalGuests || 0;

  return {
    totalGuests,
    myGuests: ownCounter?.guestCount || 0,
    updatedAt: ownCounter?.updatedAt || aggregate?.updatedAt || null,
    ...formatCapacityMeta(meta, totalGuests),
    contributors: contributors.map((counter) => ({
      personalNr: counter.personalNr,
      vorname: counter.mitarbeiter?.vorname || null,
      nachname: counter.mitarbeiter?.nachname || null,
      email: counter.mitarbeiter?.email || null,
      guestCount: counter.guestCount || 0,
      updatedAt: counter.updatedAt || null,
      isCurrentUser: Number(counter.personalNr) === Number(personalNr),
    })),
  };
}

async function getChatMessages(auftragNr, personalNr) {
  const messages = await GuestCapacityChatMessage.find({ auftragNr })
    .select('auftragNr personalNr mitarbeiter body createdAt')
    .populate({ path: 'mitarbeiter', select: 'vorname nachname' })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return messages.reverse().map((message) => formatChatMessage(message, personalNr));
}

function isCurrentOrFutureEvent(auftrag, einsaetzeForAuftrag) {
  const today = getStartOfToday();
  const latestEnd = toDateOrNull(auftrag?.bisDatum)
    || einsaetzeForAuftrag.reduce((latest, einsatz) => {
      const einsatzEnd = toDateOrNull(einsatz.datumBis || einsatz.detailDatumBis);
      return einsatzEnd && (!latest || einsatzEnd > latest) ? einsatzEnd : latest;
    }, null);
  const earliestStart = toDateOrNull(auftrag?.vonDatum)
    || einsaetzeForAuftrag.reduce((earliest, einsatz) => {
      const einsatzStart = toDateOrNull(einsatz.datumVon || einsatz.detailDatumVon);
      return einsatzStart && (!earliest || einsatzStart < earliest) ? einsatzStart : earliest;
    }, null);

  if (latestEnd) return latestEnd >= today;
  if (earliestStart) return earliestStart >= today;
  return false;
}

function isTodayEvent(auftrag, einsaetzeForAuftrag) {
  const startOfToday = getStartOfToday();
  const endOfToday = getEndOfToday();
  const start = toDateOrNull(auftrag?.vonDatum)
    || einsaetzeForAuftrag.map((einsatz) => toDateOrNull(einsatz.datumVon || einsatz.detailDatumVon)).filter(Boolean).sort((left, right) => left - right)[0]
    || null;
  const end = toDateOrNull(auftrag?.bisDatum)
    || einsaetzeForAuftrag.map((einsatz) => toDateOrNull(einsatz.datumBis || einsatz.detailDatumBis)).filter(Boolean).sort((left, right) => right - left)[0]
    || start;

  return !!start && !!end && start <= endOfToday && end >= startOfToday;
}

function getEarliestEinsatz(einsaetzeForAuftrag) {
  return [...einsaetzeForAuftrag].sort((left, right) => {
    const leftDate = toDateOrNull(left.datumVon || left.detailDatumVon)?.getTime() || Number.MAX_SAFE_INTEGER;
    const rightDate = toDateOrNull(right.datumVon || right.detailDatumVon)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) return leftDate - rightDate;
    return String(left.uhrzeitVon || '').localeCompare(String(right.uhrzeitVon || ''));
  })[0] || null;
}

async function buildAuftragDetails(auftragNr) {
  const [auftrag, schichten, einsaetze] = await Promise.all([
    Auftrag.findOne({ auftragNr })
      .select('auftragNr geschSt kundenNr eventTitel bediener dtAngelegtAm bestDatum vonDatum bisDatum eventStrasse eventPlz eventOrt eventLocation aktiv auftStatus labels')
      .lean(),
    Schicht.find({ auftragNr })
      .select('auftragNr idAuftragArbeitsschichten bezeichnung treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon ansprechpartnerEmail letzteAusschreibung datumVon datumBis uhrzeitVon uhrzeitBis typ bedarf garantiestundenLohn endeOffen besetzt offen')
      .sort({ datumVon: 1, uhrzeitVon: 1, idAuftragArbeitsschichten: 1 })
      .lean(),
    Einsatz.find({ auftragNr })
      .select('auftragNr personalNr berufSchl qualSchl bezeichnung datumVon datumBis idAuftragArbeitsschichten schichtBezeichnung treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon ansprechpartnerEmail detailDatumVon detailDatumBis uhrzeitVon uhrzeitBis typ bedarf garantiestundenLohn endeOffen isPseudo')
      .sort({ idAuftragArbeitsschichten: 1, personalNr: 1 })
      .lean(),
  ]);

  if (!auftrag) return null;

  const personalNrs = [...new Set(einsaetze.map((einsatz) => Number.parseInt(einsatz.personalNr, 10)).filter((value) => Number.isInteger(value) && value > 0))];
  const berufKeys = [...new Set(einsaetze.map((einsatz) => Number.parseInt(einsatz.berufSchl, 10)).filter((value) => Number.isInteger(value)))];

  const [mitarbeiterList, berufe, teamleiterQual] = await Promise.all([
    personalNrs.length
      ? Mitarbeiter.find({ personalnr: { $in: personalNrs.map(String) } })
          .select('personalnr vorname nachname telefon qualifikationen flip_id')
          .lean()
      : [],
    berufKeys.length
      ? Beruf.find({ jobKey: { $in: berufKeys } }).select('jobKey designation').lean()
      : [],
    Qualifikation.findOne({ qualificationKey: 50055 }).select('_id').lean(),
  ]);

  const mitarbeiterByPersonalNr = new Map(mitarbeiterList.map((mitarbeiter) => [String(mitarbeiter.personalnr), mitarbeiter]));
  const berufByKey = new Map(berufe.map((beruf) => [beruf.jobKey, beruf]));
  const teamleiterQualId = teamleiterQual ? String(teamleiterQual._id) : null;
  const schichtById = new Map(schichten.map((schicht) => [schicht.idAuftragArbeitsschichten, schicht]));
  const groupedSchichten = new Map();

  for (const schicht of schichten) {
    groupedSchichten.set(schicht.idAuftragArbeitsschichten, {
      ...schicht,
      id: schicht.idAuftragArbeitsschichten,
      mitarbeiter: [],
    });
  }

  for (const einsatz of einsaetze) {
    const schichtId = einsatz.idAuftragArbeitsschichten ?? 0;
    const schichtMeta = schichtById.get(schichtId) || null;
    if (!groupedSchichten.has(schichtId)) {
      groupedSchichten.set(schichtId, {
        id: schichtId,
        idAuftragArbeitsschichten: schichtId,
        bezeichnung: schichtMeta?.bezeichnung || einsatz.schichtBezeichnung || null,
        treffpunkt: schichtMeta?.treffpunkt || einsatz.treffpunkt || null,
        treffpunktOrt: schichtMeta?.treffpunktOrt || einsatz.treffpunktOrt || null,
        ansprechpartnerName: schichtMeta?.ansprechpartnerName || einsatz.ansprechpartnerName || null,
        ansprechpartnerTelefon: schichtMeta?.ansprechpartnerTelefon || einsatz.ansprechpartnerTelefon || null,
        ansprechpartnerEmail: schichtMeta?.ansprechpartnerEmail || einsatz.ansprechpartnerEmail || null,
        datumVon: schichtMeta?.datumVon || einsatz.detailDatumVon || einsatz.datumVon || null,
        datumBis: schichtMeta?.datumBis || einsatz.detailDatumBis || einsatz.datumBis || null,
        uhrzeitVon: schichtMeta?.uhrzeitVon || einsatz.uhrzeitVon || null,
        uhrzeitBis: schichtMeta?.uhrzeitBis || einsatz.uhrzeitBis || null,
        typ: schichtMeta?.typ || einsatz.typ || null,
        bedarf: schichtMeta?.bedarf ?? einsatz.bedarf ?? null,
        garantiestundenLohn: schichtMeta?.garantiestundenLohn ?? einsatz.garantiestundenLohn ?? null,
        endeOffen: schichtMeta?.endeOffen ?? einsatz.endeOffen ?? null,
        besetzt: schichtMeta?.besetzt ?? null,
        offen: schichtMeta?.offen ?? null,
        mitarbeiter: [],
      });
    }

    const personalNr = Number.parseInt(einsatz.personalNr, 10);
    const mitarbeiter = mitarbeiterByPersonalNr.get(String(personalNr));
    const berufKey = Number.parseInt(einsatz.berufSchl, 10);
    const beruf = Number.isInteger(berufKey) ? berufByKey.get(berufKey) || null : null;
    const isTeamleiter = teamleiterQualId
      ? (mitarbeiter?.qualifikationen || []).some((qualifikation) => String(qualifikation) === teamleiterQualId)
      : false;

    groupedSchichten.get(schichtId).mitarbeiter.push({
      personalNr: Number.isInteger(personalNr) ? personalNr : null,
      vorname: mitarbeiter?.vorname || null,
      nachname: mitarbeiter?.nachname || null,
      telefon: mitarbeiter?.telefon || null,
      flipId: mitarbeiter?.flip_id || null,
      isTeamleiter,
      bezeichnung: einsatz.bezeichnung || null,
      berufSchl: einsatz.berufSchl || null,
      berufKey: Number.isInteger(berufKey) ? berufKey : null,
      berufDesignation: beruf?.designation || null,
      qualSchl: einsatz.qualSchl || null,
      isPseudo: einsatz.isPseudo || false,
    });
  }

  const grouped = [...groupedSchichten.values()].sort((left, right) => {
    const leftDate = toDateOrNull(left.datumVon)?.getTime() || Number.MAX_SAFE_INTEGER;
    const rightDate = toDateOrNull(right.datumVon)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) return leftDate - rightDate;
    return (left.id || 0) - (right.id || 0);
  });

  return {
    auftrag,
    schichten: grouped,
    einsaetze,
  };
}

router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const auth = await getAuthenticatedMitarbeiter(req, res);
    if (!auth) return;

    const einsaetze = await Einsatz.find({ personalNr: { $in: auth.aliases } })
      .select('auftragNr datumVon datumBis detailDatumVon detailDatumBis uhrzeitVon uhrzeitBis bezeichnung idAuftragArbeitsschichten')
      .sort({ datumVon: 1, uhrzeitVon: 1 })
      .lean();

    if (!einsaetze.length) return res.json([]);

    const auftragNrs = [...new Set(einsaetze.map((einsatz) => einsatz.auftragNr).filter(Boolean))];
    const auftraege = await Auftrag.find({ auftragNr: { $in: auftragNrs }, aktiv: { $ne: 0 } })
      .select('auftragNr eventTitel kundenNr geschSt eventLocation eventStrasse eventPlz eventOrt vonDatum bisDatum labels aktiv auftStatus')
      .lean();

    const auftragByNr = new Map(auftraege.map((auftrag) => [auftrag.auftragNr, auftrag]));
    const einsaetzeByAuftrag = new Map();
    for (const einsatz of einsaetze) {
      if (!einsaetzeByAuftrag.has(einsatz.auftragNr)) einsaetzeByAuftrag.set(einsatz.auftragNr, []);
      einsaetzeByAuftrag.get(einsatz.auftragNr).push(einsatz);
    }

    const events = [];
    for (const [auftragNr, einsaetzeForAuftrag] of einsaetzeByAuftrag.entries()) {
      const auftrag = auftragByNr.get(auftragNr);
      if (!auftrag || !isCurrentOrFutureEvent(auftrag, einsaetzeForAuftrag)) continue;

      const earliest = getEarliestEinsatz(einsaetzeForAuftrag);
      events.push({
        auftragNr,
        eventTitel: auftrag.eventTitel || earliest?.bezeichnung || `Auftrag #${auftragNr}`,
        vonDatum: auftrag.vonDatum || earliest?.datumVon || earliest?.detailDatumVon || null,
        bisDatum: auftrag.bisDatum || earliest?.datumBis || earliest?.detailDatumBis || null,
        eventLocation: auftrag.eventLocation || null,
        eventStrasse: auftrag.eventStrasse || null,
        eventPlz: auftrag.eventPlz || null,
        eventOrt: auftrag.eventOrt || null,
        labels: auftrag.labels || [],
        earliestDatumVon: earliest?.datumVon || earliest?.detailDatumVon || null,
        earliestUhrzeitVon: earliest?.uhrzeitVon || null,
        earliestUhrzeitBis: earliest?.uhrzeitBis || null,
        isToday: isTodayEvent(auftrag, einsaetzeForAuftrag),
      });
    }

    events.sort((left, right) => {
      if (left.isToday !== right.isToday) return left.isToday ? -1 : 1;
      const leftTime = toDateOrNull(left.earliestDatumVon || left.vonDatum)?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightTime = toDateOrNull(right.earliestDatumVon || right.vonDatum)?.getTime() || Number.MAX_SAFE_INTEGER;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return String(left.earliestUhrzeitVon || '').localeCompare(String(right.earliestUhrzeitVon || ''));
    });

    res.json(events);
  })
);

router.get(
  '/state',
  asyncHandler(async (req, res) => {
    const auftragNr = parsePositiveInt(req.query.auftragNr);
    if (!auftragNr) return res.status(400).json({ msg: 'auftragNr parameter is required' });

    const auth = await requireAssignedMitarbeiter(req, res, auftragNr);
    if (!auth) return;

    const details = await buildAuftragDetails(auftragNr);
    if (!details) return res.status(404).json({ msg: 'Auftrag nicht gefunden' });

    const [capacity, permissions, chatMessages] = await Promise.all([
      getCapacityState(auftragNr, auth.personalNr),
      getCapacityPermissions(auth),
      getChatMessages(auftragNr, auth.personalNr),
    ]);
    res.json({
      ...details,
      capacity,
      chatMessages,
      currentUser: {
        personalNr: auth.personalNr,
        vorname: auth.mitarbeiter.vorname,
        nachname: auth.mitarbeiter.nachname,
        canSetCapacityLimit: permissions.canSetCapacityLimit,
        isTeamleiter: permissions.isTeamleiter,
      },
    });
  })
);

router.post(
  '/adjust',
  asyncHandler(async (req, res) => {
    const auftragNr = parsePositiveInt(req.body.auftragNr);
    const delta = Number.parseInt(req.body.delta, 10);
    if (!auftragNr || ![1, -1].includes(delta)) {
      return res.status(400).json({ msg: 'auftragNr and delta (+1/-1) are required' });
    }

    const auth = await requireAssignedMitarbeiter(req, res, auftragNr);
    if (!auth) return;

    const adjustment = { delta, createdAt: new Date(), source: 'capacity-counter' };
    const identityFields = {
      mitarbeiter: auth.mitarbeiter._id,
      flipId: auth.mitarbeiter.flip_id || req.oidcFlipId || null,
      email: normalizeEmail(auth.mitarbeiter.email || getRequestEmail(req)) || null,
    };

    let counter;
    if (delta === 1) {
      const update = {
        $setOnInsert: {
          auftragNr,
          personalNr: auth.personalNr,
        },
        $set: identityFields,
        $inc: { guestCount: 1 },
        $push: { adjustments: adjustment },
      };

      try {
        counter = await GuestCapacityCounter.findOneAndUpdate(
          { auftragNr, personalNr: auth.personalNr },
          update,
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        counter = await GuestCapacityCounter.findOneAndUpdate(
          { auftragNr, personalNr: auth.personalNr },
          {
            $set: identityFields,
            $inc: { guestCount: 1 },
            $push: { adjustments: adjustment },
          },
          { new: true }
        );
      }
    } else {
      counter = await GuestCapacityCounter.findOneAndUpdate(
        { auftragNr, personalNr: auth.personalNr, guestCount: { $gt: 0 } },
        {
          $set: identityFields,
          $inc: { guestCount: -1 },
          $push: { adjustments: adjustment },
        },
        { new: true }
      );

      if (!counter) {
        const capacity = await getCapacityState(auftragNr, auth.personalNr);
        return res.status(409).json({ msg: 'Eigener Gaestezaehler ist bereits 0', capacity });
      }
    }

    const capacity = await getCapacityState(auftragNr, auth.personalNr);
    const payload = {
      type: 'capacity:update',
      auftragNr,
      personalNr: auth.personalNr,
      myGuests: counter.guestCount,
      totalGuests: capacity.totalGuests,
      limit: capacity.limit,
      remainingCapacity: capacity.remainingCapacity,
      isOverLimit: capacity.isOverLimit,
      contributors: capacity.contributors,
      updatedAt: capacity.updatedAt || new Date(),
    };
    broadcastCapacityUpdate(auftragNr, payload);

    res.json({ capacity, personalNr: auth.personalNr });
  })
);

router.post(
  '/limit',
  asyncHandler(async (req, res) => {
    const auftragNr = parsePositiveInt(req.body.auftragNr);
    const parsedLimit = parseCapacityLimit(req.body.limit);
    if (!auftragNr || !parsedLimit.valid) {
      return res.status(400).json({ msg: 'auftragNr und gueltige Kapazitaetsgrenze sind erforderlich' });
    }

    const auth = await requireAssignedMitarbeiter(req, res, auftragNr);
    if (!auth) return;

    const permissions = await getCapacityPermissions(auth);
    if (!permissions.canSetCapacityLimit) {
      return res.status(403).json({ msg: 'Nur Teamleiter koennen die Kapazitaetsgrenze setzen' });
    }

    const now = new Date();
    const existing = await GuestCapacityMeta.findOne({ auftragNr }).select('capacityLimit').lean();
    await GuestCapacityMeta.findOneAndUpdate(
      { auftragNr },
      {
        $setOnInsert: { auftragNr },
        $set: {
          capacityLimit: parsedLimit.limit,
          limitUpdatedBy: auth.mitarbeiter._id,
          limitUpdatedByPersonalNr: auth.personalNr,
          limitUpdatedAt: now,
        },
        $push: {
          limitChanges: {
            previousLimit: Number.isInteger(existing?.capacityLimit) ? existing.capacityLimit : null,
            nextLimit: parsedLimit.limit,
            changedBy: auth.mitarbeiter._id,
            changedByPersonalNr: auth.personalNr,
            createdAt: now,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const capacity = await getCapacityState(auftragNr, auth.personalNr);
    const payload = {
      type: 'capacity:limit',
      auftragNr,
      capacity,
      updatedBy: {
        personalNr: auth.personalNr,
        vorname: auth.mitarbeiter.vorname,
        nachname: auth.mitarbeiter.nachname,
      },
    };
    broadcastCapacityUpdate(auftragNr, payload);

    res.json({ capacity });
  })
);

router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const auftragNr = parsePositiveInt(req.body.auftragNr);
    const body = normalizeMessage(req.body.message);
    if (!auftragNr || !body) {
      return res.status(400).json({ msg: 'auftragNr und Nachricht sind erforderlich' });
    }

    const auth = await requireAssignedMitarbeiter(req, res, auftragNr);
    if (!auth) return;

    const message = await GuestCapacityChatMessage.create({
      auftragNr,
      mitarbeiter: auth.mitarbeiter._id,
      personalNr: auth.personalNr,
      flipId: auth.mitarbeiter.flip_id || req.oidcFlipId || null,
      email: normalizeEmail(auth.mitarbeiter.email || getRequestEmail(req)) || null,
      body,
    });

    const populated = await GuestCapacityChatMessage.findById(message._id)
      .select('auftragNr personalNr mitarbeiter body createdAt')
      .populate({ path: 'mitarbeiter', select: 'vorname nachname' })
      .lean();
    const formatted = formatChatMessage(populated, auth.personalNr);

    broadcastCapacityUpdate(auftragNr, {
      type: 'chat:message',
      auftragNr,
      message: formatted,
    });

    res.status(201).json({ message: formatted });
  })
);

router.get(
  '/stream',
  asyncHandler(async (req, res) => {
    const auftragNr = parsePositiveInt(req.query.auftragNr);
    if (!auftragNr) return res.status(400).json({ msg: 'auftragNr parameter is required' });

    const auth = await requireAssignedMitarbeiter(req, res, auftragNr);
    if (!auth) return;

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    if (req.socket) req.socket.setNoDelay(true);

    res.write(`data: ${JSON.stringify({ type: 'connected', auftragNr, personalNr: auth.personalNr })}\n\n`);

    if (!capacityClients.has(auftragNr)) capacityClients.set(auftragNr, new Set());
    capacityClients.get(auftragNr).add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {}
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      const clients = capacityClients.get(auftragNr);
      if (!clients) return;
      clients.delete(res);
      if (clients.size === 0) capacityClients.delete(auftragNr);
    });
  })
);

module.exports = router;
