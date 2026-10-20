const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const asyncHandler = require('../../middleware/AsyncHandler');
const logger = require('../../utils/logger');

const Reisekostenabrechnung = require('../../models/Signature/Reisekostenabrechnung');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Auftrag = require('../../models/Event/Auftrag');
const Kunde = require('../../models/Customer/Kunde');
const Location = require('../../models/System/Location');
const ReisekostenService = require('../../services/operations/ReisekostenService');
const R2Service = require('../../services/integrations/R2Service');
const { buildEmployeeR2Path } = require('../../utils/employeeR2Path');
const { computeSummen, KM_SATZ_PRIVAT_PKW_CENT } = require('../../utils/reisekostenCalc');

const router = express.Router();

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const uploadBeleg = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      const error = new Error('Nur PDF-, JPG- oder PNG-Dateien sind erlaubt.');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

const R2_PREFIX = (auftragNr) => `Auftraege/${auftragNr}/reisekosten/`;
const ANLAGEN_PREFIX = (auftragNr, id) => `Auftraege/${auftragNr}/reisekosten/${id}/anlagen/`;

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function invitationState(rk) {
  if (!rk || !rk.invitation) return 'invalid';
  if (rk.invitation.submittedAt || rk.status === 'submitted' || rk.status === 'signature_pending' || rk.status === 'completed') {
    return 'submitted';
  }
  if (rk.invitation.expiresAt && new Date(rk.invitation.expiresAt) <= new Date()) {
    return 'expired';
  }
  return 'active';
}

async function findByAccessToken(accessToken) {
  const token = String(accessToken || '').trim();
  if (!token) return null;
  const tokenHash = hashToken(token);
  return Reisekostenabrechnung.findOne({ 'invitation.accessTokenHash': tokenHash })
    .select('+invitation.accessTokenHash')
    .populate('mitarbeiter', 'vorname nachname personalnr email r2Prefix locationV2 adresse adresse2');
}

function buildAnlageR2Key(rk, mitarbeiter, originalname) {
  const safe = (originalname || 'beleg').replace(/[^a-z0-9_\-.]/gi, '_');
  const fileName = `rk_${rk._id}_${Date.now()}_${safe}`;
  if (mitarbeiter?._id) {
    try {
      return buildEmployeeR2Path(mitarbeiter, 'documents/uploads', fileName);
    } catch (_) {
      // Fallback to order path
    }
  }
  return `${ANLAGEN_PREFIX(rk.auftragNr, rk._id)}${Date.now()}-${safe}`;
}

async function loadAnlagenBuffers(anlagen = []) {
  const out = [];
  for (const a of anlagen) {
    try {
      const buffer = await R2Service.downloadFile(a.key);
      out.push({ buffer, contentType: a.contentType, filename: a.filename });
    } catch (e) {
      logger.warn(`Public Reisekosten-Anlage konnte nicht geladen werden (${a.key}): ${e.message}`);
    }
  }
  return out;
}

async function renderAndUpload(doc, id, anlagenBuffers = []) {
  let { buffer } = await ReisekostenService.buildPdf(doc, { signatureTags: false });
  if (anlagenBuffers.length) buffer = await ReisekostenService.mergeAttachments(buffer, anlagenBuffers);
  const key = `${R2_PREFIX(doc.auftragNr)}${id}.pdf`;
  await R2Service.uploadFile(key, buffer, 'application/pdf');
  return key;
}

async function resolveContextDetails(rk) {
  const auftrag = rk.auftragNr != null
    ? await Auftrag.findOne({ auftragNr: rk.auftragNr }).lean()
    : null;
  let kundenName = rk.invitation?.kundenName || '';
  if (!kundenName && auftrag?.kundenNr != null) {
    const kunde = await Kunde.findOne({ kundenNr: auftrag.kundenNr }).select('kundName kundBez').lean();
    kundenName = kunde?.kundName || kunde?.kundBez || '';
  }

  let start = rk.kopf?.start || '';
  let ziel = rk.kopf?.ziel || '';
  if ((!start || !ziel) && rk.auftragNr != null && rk.personalNr != null) {
    const defaults = await ReisekostenService.buildDefaults({
      auftragNr: rk.auftragNr,
      personalNr: rk.personalNr,
    });
    if (!start) start = defaults.kopf?.start || '';
    if (!ziel) ziel = defaults.kopf?.ziel || '';
    if (!kundenName && defaults.kundenName) kundenName = defaults.kundenName;
  }

  return {
    auftrag,
    kundenName,
    start,
    ziel,
    eventTitel: auftrag?.eventTitel || '',
    eventLocation: auftrag?.eventLocation || '',
  };
}

function serializePublicForm(rk, context) {
  return {
    id: String(rk._id),
    auftragNr: rk.auftragNr,
    mitarbeiterName: [rk.kopf?.vorname || rk.mitarbeiter?.vorname, rk.kopf?.name || rk.mitarbeiter?.nachname].filter(Boolean).join(' '),
    anlass: 'Einsatzfahrt',
    zweck: rk.kopf?.zweck || 'Einsatzfahrt',
    kundenName: context.kundenName || '—',
    eventTitel: context.eventTitel || '',
    eventLocation: context.eventLocation || '',
    start: context.start || '',
    ziel: context.ziel || '',
    datum: rk.kopf?.reisebeginn || context.auftrag?.vonDatum || null,
    kmSatzCent: KM_SATZ_PRIVAT_PKW_CENT,
    nummernschild: rk.kopf?.nummernschild || '',
    anlagen: (rk.anlagen || []).map((a) => ({
      _id: String(a._id),
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    })),
  };
}

// GET /api/public/reisekosten/:accessToken — load form context
router.get('/:accessToken', asyncHandler(async (req, res) => {
  const rk = await findByAccessToken(req.params.accessToken);
  if (!rk) {
    return res.status(404).json({ message: 'Formular-Link nicht gefunden.', state: 'invalid' });
  }
  const state = invitationState(rk);
  if (state !== 'active') {
    return res.status(410).json({
      message: state === 'submitted'
        ? 'Diese Reisekostenabrechnung wurde bereits eingereicht.'
        : 'Dieser Link ist abgelaufen.',
      state,
    });
  }

  const context = await resolveContextDetails(rk);
  res.json({
    state: 'active',
    data: serializePublicForm(rk, context),
  });
}));

// POST /api/public/reisekosten/:accessToken/belege — upload receipt (respecting category limits)
router.post('/:accessToken/belege', uploadBeleg.single('file'), asyncHandler(async (req, res) => {
  const rk = await findByAccessToken(req.params.accessToken);
  if (!rk) return res.status(404).json({ message: 'Formular-Link nicht gefunden.' });
  if (invitationState(rk) !== 'active') {
    return res.status(410).json({ message: 'Dieses Formular ist nicht mehr aktiv.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Bitte eine Datei auswählen.' });
  }

  const category = String(req.body?.category || rk.invitation?.category || '').trim();
  const maxFiles = category === 'mietwagen' ? 1 : (category === 'oeffi' ? 2 : 2);
  if ((rk.anlagen || []).length >= maxFiles) {
    return res.status(400).json({
      message: maxFiles === 1
        ? 'Beim Tankbeleg Mietwagen kann maximal 1 Beleg eingereicht werden.'
        : `Es können maximal ${maxFiles} Belege hochgeladen werden.`,
    });
  }

  let mitarbeiter = rk.mitarbeiter;
  if (mitarbeiter && !mitarbeiter.r2Prefix && mitarbeiter._id) {
    const generatedPrefix = `employees/${mitarbeiter._id}`;
    await Mitarbeiter.collection.updateOne(
      { _id: mitarbeiter._id, $or: [{ r2Prefix: { $exists: false } }, { r2Prefix: null }, { r2Prefix: '' }] },
      { $set: { r2Prefix: generatedPrefix } }
    );
    mitarbeiter.r2Prefix = generatedPrefix;
  }

  const key = buildAnlageR2Key(rk, mitarbeiter, req.file.originalname);
  await R2Service.uploadFile(key, req.file.buffer, req.file.mimetype || 'application/octet-stream');

  rk.anlagen.push({
    key,
    filename: req.file.originalname || 'Beleg',
    contentType: req.file.mimetype || '',
    size: req.file.size || 0,
  });
  await rk.save();

  res.status(201).json({
    anlagen: rk.anlagen.map((a) => ({
      _id: String(a._id),
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    })),
  });
}));

// DELETE /api/public/reisekosten/:accessToken/belege/:anlageId — remove receipt before submit
router.delete('/:accessToken/belege/:anlageId', asyncHandler(async (req, res) => {
  const rk = await findByAccessToken(req.params.accessToken);
  if (!rk) return res.status(404).json({ message: 'Formular-Link nicht gefunden.' });
  if (invitationState(rk) !== 'active') {
    return res.status(410).json({ message: 'Dieses Formular ist nicht mehr aktiv.' });
  }

  const anlageId = String(req.params.anlageId || '');
  const target = (rk.anlagen || []).find((a) => String(a._id) === anlageId);
  if (!target) return res.status(404).json({ message: 'Beleg nicht gefunden.' });

  rk.anlagen = rk.anlagen.filter((a) => String(a._id) !== anlageId);
  try {
    await R2Service.deleteFile(target.key);
  } catch (err) {
    logger.warn(`Public Reisekosten-Beleg Löschen fehlgeschlagen (${target.key}): ${err.message}`);
  }
  await rk.save();

  res.json({
    anlagen: rk.anlagen.map((a) => ({
      _id: String(a._id),
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    })),
  });
}));

// POST /api/public/reisekosten/:accessToken/submit — finalize employee travel expense claim
router.post('/:accessToken/submit', asyncHandler(async (req, res) => {
  const rk = await findByAccessToken(req.params.accessToken);
  if (!rk) return res.status(404).json({ message: 'Formular-Link nicht gefunden.' });
  if (invitationState(rk) !== 'active') {
    return res.status(410).json({ message: 'Diese Reisekostenabrechnung wurde bereits eingereicht oder ist abgelaufen.' });
  }

  const body = req.body || {};
  const category = String(body.category || '').trim();
  if (!['mietwagen', 'oeffi', 'privatpkw'].includes(category)) {
    return res.status(400).json({ message: 'Bitte wähle die Art der Reisekosten aus.' });
  }

  const context = await resolveContextDetails(rk);
  const kundenName = context.kundenName || '';
  const eventSuffix = [kundenName, context.eventTitel].filter(Boolean).join(' – ');
  rk.kopf.zweck = eventSuffix ? `Einsatzfahrt – ${eventSuffix}` : 'Einsatzfahrt';

  if (category === 'mietwagen') {
    if ((rk.anlagen || []).length < 1) {
      return res.status(400).json({ message: 'Bitte lade deinen Tankbeleg hoch.' });
    }
    if ((rk.anlagen || []).length > 1) {
      return res.status(400).json({ message: 'Beim Tankbeleg Mietwagen darf nur 1 Beleg eingereicht werden.' });
    }
    const betragCent = Math.round(Number(body.betragCent) || 0);
    if (betragCent <= 0) {
      return res.status(400).json({ message: 'Bitte gib einen gültigen Betrag ein.' });
    }
    if (!body.originalReceiptNoteAccepted) {
      return res.status(400).json({ message: 'Bitte bestätige den Hinweis zur Vorlage des Originalbelegs im Büro.' });
    }

    rk.kopf.transportmittel = 'mietwagen';
    rk.kopf.nummernschild = String(body.nummernschild || '').trim();
    rk.fahrtkosten = [{
      bezeichnung: rk.kopf.nummernschild
        ? `Tankbeleg Mietwagen (${rk.kopf.nummernschild})`
        : 'Tankbeleg Mietwagen',
      bemessungCent: 0,
      betragCent,
      prozent: 0,
    }];
    rk.kilometerpauschale = [];
    rk.reisedaten = [];
  } else if (category === 'oeffi') {
    if ((rk.anlagen || []).length < 1) {
      return res.status(400).json({ message: 'Bitte lade mindestens einen Ticket-Beleg hoch.' });
    }
    if ((rk.anlagen || []).length > 2) {
      return res.status(400).json({ message: 'Es können maximal 2 Belege (Hin- und Rückfahrt) eingereicht werden.' });
    }
    const betragCent = Math.round(Number(body.betragCent) || 0);
    if (betragCent <= 0) {
      return res.status(400).json({ message: 'Bitte gib einen gültigen Betrag ein.' });
    }

    rk.kopf.transportmittel = 'bahn';
    rk.kopf.nummernschild = '';
    rk.fahrtkosten = [{
      bezeichnung: (rk.anlagen || []).length === 2 ? 'ÖPNV-Ticket (Hin- & Rückfahrt)' : 'ÖPNV-Ticket',
      bemessungCent: 0,
      betragCent,
      prozent: 0,
    }];
    rk.kilometerpauschale = [];
    rk.reisedaten = [];
  } else if (category === 'privatpkw') {
    const nummernschild = String(body.nummernschild || '').trim();
    if (!nummernschild) {
      return res.status(400).json({ message: 'Bei Fahrten mit dem Privat-PKW ist das Kennzeichen ein Pflichtfeld.' });
    }
    const start = String(body.start || context.start || '').trim();
    const ziel = String(body.ziel || context.ziel || '').trim();
    if (!start || !ziel) {
      return res.status(400).json({ message: 'Start- und Zieladresse sind erforderlich.' });
    }
    const kilometer = Number(body.kilometer) || 0;
    if (!Number.isFinite(kilometer) || kilometer <= 0) {
      return res.status(400).json({ message: 'Bitte gib die gefahrenen Kilometer ein.' });
    }
    const isRoundTrip = Boolean(body.isRoundTrip);
    const datum = rk.kopf?.reisebeginn || context.auftrag?.vonDatum || new Date();

    rk.kopf.transportmittel = 'privatpkw';
    rk.kopf.nummernschild = nummernschild;
    rk.kopf.start = start;
    rk.kopf.ziel = ziel;
    rk.kopf.reiseziel = ziel;
    rk.fahrtkosten = [];

    if (isRoundTrip) {
      const halfKm = Math.round((kilometer / 2) * 10) / 10;
      rk.reisedaten = [
        { datum, start, ziel, kilometer: halfKm },
        { datum: rk.kopf?.reiseende || datum, start: ziel, ziel: start, kilometer: Math.round((kilometer - halfKm) * 10) / 10 },
      ];
    } else {
      rk.reisedaten = [
        { datum, start, ziel, kilometer },
      ];
    }

    rk.kilometerpauschale = rk.reisedaten.map((r) => ({
      bezeichnung: isRoundTrip ? 'Kilometerpauschale (Hin-/Rückfahrt)' : 'Kilometerpauschale (Einfache Fahrt)',
      start: r.start,
      ziel: r.ziel,
      kilometer: r.kilometer,
      satzCent: KM_SATZ_PRIVAT_PKW_CENT,
    }));
  }

  if (!rk.kopf.kostenstelle && rk.locationV2) {
    const loc = await Location.findById(rk.locationV2).select('kostenstelle externalId').lean();
    rk.kopf.kostenstelle = loc ? (loc.kostenstelle || loc.externalId || '') : '';
  }

  const summen = computeSummen(rk.toObject());
  rk.summen = {
    bruttoCent: summen.bruttoCent,
    vorsteuerGesamtCent: summen.vorsteuerGesamtCent,
    nettoCent: summen.nettoCent,
    auszuzahlenCent: summen.auszuzahlenCent,
  };

  rk.status = 'submitted';
  rk.invitation = {
    ...(rk.invitation?.toObject ? rk.invitation.toObject() : (rk.invitation || {})),
    category,
    isRoundTrip: Boolean(body.isRoundTrip),
    singleWayKm: Number(body.singleWayKm) || 0,
    kundenName,
    originalReceiptNoteAccepted: Boolean(body.originalReceiptNoteAccepted),
    submittedAt: new Date(),
  };

  const anlagenBuffers = await loadAnlagenBuffers(rk.anlagen);
  rk.r2Key = await renderAndUpload(rk.toObject(), rk._id, anlagenBuffers);
  await rk.save();

  res.json({
    success: true,
    data: {
      id: String(rk._id),
      status: rk.status,
      auszuzahlenCent: rk.summen.auszuzahlenCent,
    },
  });
}));

module.exports = router;
