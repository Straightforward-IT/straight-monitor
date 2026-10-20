const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/AsyncHandler');
const logger = require('../../utils/logger');

const Reisekostenabrechnung = require('../../models/Signature/Reisekostenabrechnung');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Auftrag = require('../../models/Event/Auftrag');
const Kunde = require('../../models/Customer/Kunde');
const Location = require('../../models/System/Location');
const SignaturVorgang = require('../../models/Signature/SignaturVorgang');
const ReisekostenService = require('../../services/operations/ReisekostenService');
const R2Service = require('../../services/integrations/R2Service');
const { sendReisekostenInvitationEmail } = require('../../services/integrations/EmailService');
const { buildEmployeeR2Path } = require('../../utils/employeeR2Path');
const registry = require('../../config/registry');
const { computeSummen } = require('../../utils/reisekostenCalc');

const router = express.Router();

const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const R2_PREFIX = (auftragNr) => `Auftraege/${auftragNr}/reisekosten/`;
const ANLAGEN_PREFIX = (auftragNr, id) => `Auftraege/${auftragNr}/reisekosten/${id}/anlagen/`;
const EDITABLE_STATUSES = new Set(['draft', 'invited', 'submitted']);
const INVITATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function getPublicReisekostenUrl(accessToken) {
  const baseUrl = (process.env.REISEKOSTEN_PUBLIC_BASE_URL || process.env.APP_URL || 'https://straightmonitor.com').replace(/\/$/, '');
  return `${baseUrl}/reisekosten/${accessToken}`;
}

async function resolveLocationSenderKey(locationId) {
  if (!locationId) return 'it';
  const loc = await Location.findById(locationId).select('contact.mainEmail').lean();
  const locationEmail = String(loc?.contact?.mainEmail || '').trim().toLowerCase();
  if (!locationEmail) return 'it';
  const team = registry.listTeams({ includeDevelopmentOnly: true }).find((candidate) =>
    String(candidate?.email?.address || '').trim().toLowerCase() === locationEmail
  );
  return team ? team.key : 'it';
}

function buildAnlageR2Key(rk, mitarbeiter, originalname) {
  const safe = (originalname || 'anlage').replace(/[^a-z0-9_\-.]/gi, '_');
  const fileName = `rk_${rk._id}_${Date.now()}_${safe}`;
  if (mitarbeiter?._id) {
    try {
      return buildEmployeeR2Path(mitarbeiter, 'documents/uploads', fileName);
    } catch (_) {
      // Fallback to order path if employee prefix cannot be built
    }
  }
  return `${ANLAGEN_PREFIX(rk.auftragNr, rk._id)}${Date.now()}-${safe}`;
}

// ── Sanitizers ────────────────────────────────────────────────────────────────
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const str = (v) => (v == null ? '' : String(v));

const sanitizeBetragRow = (r = {}) => ({
  bezeichnung: str(r.bezeichnung),
  bemessungCent: num(r.bemessungCent),
  betragCent: num(r.betragCent),
  prozent: Number(r.prozent) || 0,
});
const sanitizeKmRow = (r = {}) => ({
  bezeichnung: str(r.bezeichnung),
  start: str(r.start),
  ziel: str(r.ziel),
  kilometer: Number(r.kilometer) || 0,
  satzCent: num(r.satzCent),
});
const sanitizePauschalRow = (r = {}) => ({
  anzahl: Number(r.anzahl) || 0,
  tage: Number(r.tage) || 0,
  satzCent: num(r.satzCent),
});

function sanitizeDoc(body = {}) {
  const kopf = body.kopf || {};
  const pausch = body.pauschalen || {};
  return {
    auftragNr: body.auftragNr != null ? Number(body.auftragNr) : null,
    personalNr: body.personalNr != null ? Number(body.personalNr) : null,
    locationV2: body.locationV2 || null,
    kopf: {
      titel: str(kopf.titel),
      name: str(kopf.name),
      vorname: str(kopf.vorname),
      firma: str(kopf.firma) || 'H. & P. Straightforward GmbH',
      zweck: str(kopf.zweck),
      reiseziel: str(kopf.reiseziel),
      start: str(kopf.start),
      ziel: str(kopf.ziel),
      reisebeginn: kopf.reisebeginn ? new Date(kopf.reisebeginn) : null,
      reiseende: kopf.reiseende ? new Date(kopf.reiseende) : null,
      transportmittel: str(kopf.transportmittel) || 'privatpkw',
      transportmittelFreitext: str(kopf.transportmittelFreitext),
      tage: Number(kopf.tage) || 0,
      stunden: str(kopf.stunden),
      nummernschild: str(kopf.nummernschild),
      kostenstelle: str(kopf.kostenstelle),
    },
    fahrtkosten: (Array.isArray(body.fahrtkosten) ? body.fahrtkosten : []).map(sanitizeBetragRow),
    kilometerpauschale: (Array.isArray(body.kilometerpauschale) ? body.kilometerpauschale : []).map(sanitizeKmRow),
    uebernachtung: (Array.isArray(body.uebernachtung) ? body.uebernachtung : []).map(sanitizeBetragRow),
    pauschalen: {
      uebernachtungen: (Array.isArray(pausch.uebernachtungen) ? pausch.uebernachtungen : []).map(sanitizePauschalRow),
      tage24: sanitizePauschalRow(pausch.tage24),
      tage14: sanitizePauschalRow(pausch.tage14),
      tage8: sanitizePauschalRow(pausch.tage8),
    },
    nebenkosten: (Array.isArray(body.nebenkosten) ? body.nebenkosten : []).map(sanitizeBetragRow),
    reisedaten: (Array.isArray(body.reisedaten) ? body.reisedaten : []).map((r = {}) => ({
      datum: r.datum ? new Date(r.datum) : null,
      start: str(r.start),
      ziel: str(r.ziel),
      kilometer: Number(r.kilometer) || 0,
    })),
    vorschussCent: num(body.vorschussCent),
    ort: str(body.ort),
  };
}

function summenSubset(doc) {
  const s = computeSummen(doc);
  return {
    bruttoCent: s.bruttoCent,
    vorsteuerGesamtCent: s.vorsteuerGesamtCent,
    nettoCent: s.nettoCent,
    auszuzahlenCent: s.auszuzahlenCent,
  };
}

/** Renders the unsigned PDF (with merged attachments) and (re)uploads it to R2. Returns the r2Key. */
async function renderAndUpload(doc, id, anlagenBuffers = []) {
  let { buffer } = await ReisekostenService.buildPdf(doc, { signatureTags: false });
  if (anlagenBuffers.length) buffer = await ReisekostenService.mergeAttachments(buffer, anlagenBuffers);
  const key = `${R2_PREFIX(doc.auftragNr)}${id}.pdf`;
  await R2Service.uploadFile(key, buffer, 'application/pdf');
  return key;
}

/** Resolve the Kostenstelle (KST) for a location (kostenstelle, fallback externalId). */
async function resolveKostenstelle(locationId) {
  if (!locationId) return '';
  const loc = await Location.findById(locationId).select('kostenstelle externalId').lean();
  return loc ? (loc.kostenstelle || loc.externalId || '') : '';
}

/** Download all attachment buffers from R2 for merging into the PDF. */
async function loadAnlagenBuffers(anlagen = []) {
  const out = [];
  for (const a of anlagen) {
    try {
      const buffer = await R2Service.downloadFile(a.key);
      out.push({ buffer, contentType: a.contentType, filename: a.filename });
    } catch (e) {
      logger.warn(`Reisekosten-Anlage konnte nicht geladen werden (${a.key}): ${e.message}`);
    }
  }
  return out;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/reisekosten/defaults?auftragNr=&personalNr=
router.get('/defaults', auth, asyncHandler(async (req, res) => {
  const { auftragNr, personalNr } = req.query;
  const defaults = await ReisekostenService.buildDefaults({ auftragNr, personalNr });
  res.json(defaults);
}));

// GET /api/reisekosten/address-search?q=  — address autocomplete via Photon (OpenStreetMap).
router.get('/address-search', auth, asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) return res.json({ suggestions: [] });
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=6`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'StraightMonitor/1.0 (reisekosten)' } });
    if (!resp.ok) return res.json({ suggestions: [] });
    const data = await resp.json();
    const seen = new Set();
    const suggestions = [];
    for (const f of data.features || []) {
      const p = f.properties || {};
      const line1 = [p.street || p.name, p.housenumber].filter(Boolean).join(' ');
      const city = p.city || p.town || p.village || p.county || '';
      const line2 = [p.postcode, city].filter(Boolean).join(' ');
      const label = [line1 || p.name, line2].filter(Boolean).join(', ');
      if (label && !seen.has(label)) { seen.add(label); suggestions.push(label); }
    }
    res.json({ suggestions });
  } catch (e) {
    logger.warn(`Reisekosten Adresssuche fehlgeschlagen: ${e.message}`);
    res.json({ suggestions: [] });
  }
}));

// GET /api/reisekosten?auftragNr=
router.get('/', auth, asyncHandler(async (req, res) => {
  const auftragNr = parseInt(req.query.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) {
    return res.status(400).json({ message: 'auftragNr erforderlich' });
  }
  const docs = await Reisekostenabrechnung.find({ auftragNr })
    .populate('mitarbeiter', 'vorname nachname personalnr email')
    .populate('signaturVorgang', 'status submitters')
    .sort({ createdAt: -1 })
    .lean();

  // Self-heal stale status from the (authoritative) linked signature process.
  const fixes = [];
  for (const d of docs) {
    const vStatus = d.signaturVorgang?.status;
    const target = vStatus === 'completed' ? 'completed' : (vStatus === 'cancelled' ? 'draft' : null);
    if (target && d.status !== target) {
      d.status = target;
      fixes.push({ _id: d._id, status: target });
    }
  }
  if (fixes.length) {
    await Promise.all(fixes.map(f => Reisekostenabrechnung.updateOne({ _id: f._id }, { $set: { status: f.status } })));
  }

  res.json({ data: docs });
}));

// POST /api/reisekosten/preview — render from unsaved body, stream PDF blob
router.post('/preview', auth, asyncHandler(async (req, res) => {
  const doc = sanitizeDoc(req.body || {});
  const { buffer } = await ReisekostenService.buildPdf(doc, { signatureTags: false });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="reisekosten-vorschau.pdf"',
    'Content-Length': buffer.length,
  });
  res.send(buffer);
}));

// POST /api/reisekosten — create
router.post('/', auth, asyncHandler(async (req, res) => {
  const doc = sanitizeDoc(req.body || {});
  if (!Number.isFinite(doc.auftragNr)) {
    return res.status(400).json({ message: 'auftragNr erforderlich' });
  }

  // Resolve Mitarbeiter (link + location fallback)
  let mitarbeiter = null;
  if (doc.personalNr != null) {
    mitarbeiter = await Mitarbeiter.findOne({
      $or: [{ personalnr: String(doc.personalNr) }, { 'personalnrHistory.value': String(doc.personalNr) }],
    }).select('_id locationV2').lean();
  }

  const created = new Reisekostenabrechnung({
    ...doc,
    mitarbeiter: mitarbeiter?._id || null,
    locationV2: doc.locationV2 || mitarbeiter?.locationV2 || null,
    summen: summenSubset(doc),
    status: 'draft',
    createdBy: req.user.id,
  });
  // Kostenstelle serverseitig aus der Location ableiten.
  created.kopf.kostenstelle = await resolveKostenstelle(created.locationV2) || doc.kopf.kostenstelle || '';

  created.r2Key = await renderAndUpload(created.toObject(), created._id);
  await created.save();

  await created.populate('mitarbeiter', 'vorname nachname personalnr email');
  res.status(201).json({ data: created });
}));

// GET /api/reisekosten/:id
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const doc = await Reisekostenabrechnung.findById(req.params.id)
    .populate('mitarbeiter', 'vorname nachname personalnr email')
    .populate('signaturVorgang', 'status submitters')
    .lean();
  if (!doc) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });
  res.json({ data: doc });
}));

// GET /api/reisekosten/:id/pdf — signed URL to the stored PDF
router.get('/:id/pdf', auth, asyncHandler(async (req, res) => {
  const doc = await Reisekostenabrechnung.findById(req.params.id).lean();
  if (!doc || !doc.r2Key) return res.status(404).json({ message: 'PDF nicht gefunden' });
  const filename = `Reisekostenabrechnung-${doc.kopf?.name || doc._id}.pdf`.replace(/[^a-z0-9_\-. ]/gi, '_');
  const url = await R2Service.getSignedDownloadUrl(doc.r2Key, 3600, { inline: true, filename });
  res.json({ url });
}));

// PUT /api/reisekosten/:id — update (draft / invited / submitted)
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const existing = await Reisekostenabrechnung.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });
  if (!EDITABLE_STATUSES.has(existing.status)) {
    return res.status(409).json({ message: 'Nur Entwürfe oder eingereichte Abrechnungen können bearbeitet werden.' });
  }

  const doc = sanitizeDoc({ ...req.body, auftragNr: existing.auftragNr });

  let mitarbeiter = null;
  if (doc.personalNr != null) {
    mitarbeiter = await Mitarbeiter.findOne({
      $or: [{ personalnr: String(doc.personalNr) }, { 'personalnrHistory.value': String(doc.personalNr) }],
    }).select('_id locationV2').lean();
  }

  existing.set({
    ...doc,
    auftragNr: existing.auftragNr,
    mitarbeiter: mitarbeiter?._id || existing.mitarbeiter,
    locationV2: doc.locationV2 || mitarbeiter?.locationV2 || existing.locationV2,
    summen: summenSubset(doc),
  });
  existing.kopf.kostenstelle = await resolveKostenstelle(existing.locationV2) || doc.kopf.kostenstelle || '';
  const anlagenBuffers = await loadAnlagenBuffers(existing.anlagen);
  existing.r2Key = await renderAndUpload(existing.toObject(), existing._id, anlagenBuffers);
  await existing.save();

  await existing.populate('mitarbeiter', 'vorname nachname personalnr email');
  res.json({ data: existing });
}));

// POST /api/reisekosten/:id/send-invite — send public form link to employee via email
router.post('/:id/send-invite', auth, asyncHandler(async (req, res) => {
  const rk = await Reisekostenabrechnung.findById(req.params.id)
    .populate('mitarbeiter', 'vorname nachname personalnr email locationV2 r2Prefix');
  if (!rk) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });
  if (!EDITABLE_STATUSES.has(rk.status)) {
    return res.status(409).json({ message: 'Für diese Abrechnung läuft bereits ein Signaturprozess.' });
  }

  let mitarbeiter = rk.mitarbeiter;
  if (!mitarbeiter && rk.personalNr != null) {
    mitarbeiter = await Mitarbeiter.findOne({
      $or: [{ personalnr: String(rk.personalNr) }, { 'personalnrHistory.value': String(rk.personalNr) }],
    }).select('vorname nachname personalnr email locationV2 r2Prefix');
    if (mitarbeiter) rk.mitarbeiter = mitarbeiter._id;
  }

  const recipientEmail = String(req.body?.email || mitarbeiter?.email || '').trim().toLowerCase();
  if (!recipientEmail) {
    return res.status(400).json({ message: 'Für diesen Mitarbeiter ist keine E-Mail-Adresse hinterlegt.' });
  }

  const auftrag = rk.auftragNr != null
    ? await Auftrag.findOne({ auftragNr: rk.auftragNr }).select('auftragNr eventTitel kundenNr vonDatum bisDatum locationV2').lean()
    : null;
  let kundenName = rk.invitation?.kundenName || '';
  if (!kundenName && auftrag?.kundenNr != null) {
    const kunde = await Kunde.findOne({ kundenNr: auftrag.kundenNr }).select('kundName kundBez').lean();
    kundenName = kunde?.kundName || kunde?.kundBez || '';
  }

  // Ensure purpose & defaults are populated for the employee form
  if (!rk.kopf.zweck) {
    rk.kopf.zweck = auftrag?.eventTitel ? `Einsatzfahrt – ${auftrag.eventTitel}` : 'Einsatzfahrt';
  }
  if ((!rk.kopf.start || !rk.kopf.ziel) && rk.auftragNr != null && rk.personalNr != null) {
    const defaults = await ReisekostenService.buildDefaults({ auftragNr: rk.auftragNr, personalNr: rk.personalNr });
    if (!rk.kopf.start && defaults.kopf?.start) rk.kopf.start = defaults.kopf.start;
    if (!rk.kopf.ziel && defaults.kopf?.ziel) rk.kopf.ziel = defaults.kopf.ziel;
    if (!kundenName && defaults.kundenName) kundenName = defaults.kundenName;
  }

  const accessToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
  const publicUrl = getPublicReisekostenUrl(accessToken);

  const datumSource = rk.kopf?.reisebeginn || auftrag?.vonDatum;
  const datumText = datumSource
    ? new Date(datumSource).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  const senderKey = await resolveLocationSenderKey(rk.locationV2 || auftrag?.locationV2 || mitarbeiter?.locationV2);

  await sendReisekostenInvitationEmail({
    recipientEmail,
    vorname: mitarbeiter?.vorname || rk.kopf?.vorname || '',
    kundenName,
    eventTitel: auftrag?.eventTitel || '',
    datumText,
    publicUrl,
    senderKey,
  });

  rk.status = 'invited';
  rk.invitation = {
    ...(rk.invitation?.toObject ? rk.invitation.toObject() : (rk.invitation || {})),
    accessTokenHash: hashToken(accessToken),
    recipientEmail,
    sentAt: now,
    expiresAt,
    submittedAt: null,
    kundenName,
  };
  await rk.save();
  await rk.populate('mitarbeiter', 'vorname nachname personalnr email');

  res.json({
    data: rk,
    publicUrl,
  });
}));

// DELETE /api/reisekosten/:id
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const doc = await Reisekostenabrechnung.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });

  if (doc.signaturVorgang) {
    const vorgang = await SignaturVorgang.findById(doc.signaturVorgang).select('status').lean();
    if (vorgang && !['cancelled'].includes(vorgang.status)) {
      return res.status(409).json({ message: 'Löschen nicht möglich – es läuft ein aktiver Signaturprozess.' });
    }
  }

  if (doc.r2Key) {
    try {
      await R2Service.deleteFile(doc.r2Key);
    } catch (err) {
      logger.warn(`Reisekosten R2-Löschen fehlgeschlagen (${doc.r2Key}): ${err.message}`);
    }
  }
  for (const a of doc.anlagen || []) {
    try { await R2Service.deleteFile(a.key); } catch (err) { logger.warn(`Reisekosten-Anlage Löschen fehlgeschlagen (${a.key}): ${err.message}`); }
  }
  await doc.deleteOne();
  res.json({ success: true });
}));

// GET /api/reisekosten/:id/anlagen/:anlageId/url — signed R2 URL for DocumentPreviewModal
router.get('/:id/anlagen/:anlageId/url', auth, asyncHandler(async (req, res) => {
  const rk = await Reisekostenabrechnung.findById(req.params.id).select('anlagen').lean();
  if (!rk) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });

  const param = String(req.params.anlageId || '');
  const anlage = (rk.anlagen || []).find((a) => String(a._id) === param || a.key === param);
  if (!anlage || !anlage.key) return res.status(404).json({ message: 'Beleg nicht gefunden' });

  const download = req.query.download === '1' || req.query.download === 'true';
  const filename = (anlage.filename || 'Beleg').replace(/[^a-z0-9_\-. ]/gi, '_');
  const url = await R2Service.getSignedDownloadUrl(anlage.key, 900, { inline: !download, filename });
  res.json({ url, filename: anlage.filename, contentType: anlage.contentType });
}));

// POST /api/reisekosten/:id/anlagen — upload Belege (draft / invited / submitted)
router.post('/:id/anlagen', auth, uploadMem.array('files', 20), asyncHandler(async (req, res) => {
  const rk = await Reisekostenabrechnung.findById(req.params.id);
  if (!rk) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });
  if (!EDITABLE_STATUSES.has(rk.status)) return res.status(409).json({ message: 'Anlagen nur vor Signaturstart änderbar.' });

  let mitarbeiter = null;
  if (rk.mitarbeiter) {
    mitarbeiter = await Mitarbeiter.findById(rk.mitarbeiter).select('_id r2Prefix').lean();
  } else if (rk.personalNr != null) {
    mitarbeiter = await Mitarbeiter.findOne({
      $or: [{ personalnr: String(rk.personalNr) }, { 'personalnrHistory.value': String(rk.personalNr) }],
    }).select('_id r2Prefix').lean();
  }

  const files = req.files || [];
  for (const f of files) {
    const safe = (f.originalname || 'anlage').replace(/[^a-z0-9_\-.]/gi, '_');
    const key = buildAnlageR2Key(rk, mitarbeiter, f.originalname);
    await R2Service.uploadFile(key, f.buffer, f.mimetype || 'application/octet-stream');
    rk.anlagen.push({ key, filename: f.originalname || safe, contentType: f.mimetype || '', size: f.size || 0 });
  }

  const anlagenBuffers = await loadAnlagenBuffers(rk.anlagen);
  rk.r2Key = await renderAndUpload(rk.toObject(), rk._id, anlagenBuffers);
  await rk.save();
  res.json({ data: rk });
}));

// DELETE /api/reisekosten/:id/anlagen — remove one Beleg (draft / invited / submitted). Body: { key }
router.delete('/:id/anlagen', auth, asyncHandler(async (req, res) => {
  const rk = await Reisekostenabrechnung.findById(req.params.id);
  if (!rk) return res.status(404).json({ message: 'Reisekostenabrechnung nicht gefunden' });
  if (!EDITABLE_STATUSES.has(rk.status)) return res.status(409).json({ message: 'Anlagen nur vor Signaturstart änderbar.' });

  const { key } = req.body || {};
  if (!key) return res.status(400).json({ message: 'key erforderlich' });
  rk.anlagen = rk.anlagen.filter((a) => a.key !== key);
  try { await R2Service.deleteFile(key); } catch (err) { logger.warn(`Reisekosten-Anlage Löschen fehlgeschlagen (${key}): ${err.message}`); }

  const anlagenBuffers = await loadAnlagenBuffers(rk.anlagen);
  rk.r2Key = await renderAndUpload(rk.toObject(), rk._id, anlagenBuffers);
  await rk.save();
  res.json({ data: rk });
}));

module.exports = router;
