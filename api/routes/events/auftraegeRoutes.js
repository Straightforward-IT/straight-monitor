const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const requireAdmin = require('../../middleware/requireAdmin');
const Auftrag = require('../../models/Event/Auftrag');
const Einsatz = require('../../models/Event/Einsatz');
const Schicht = require('../../models/Event/Schicht');
const DispoEintrag = require('../../models/System/DispoEintrag');
const JobBewerbung = require('../../models/Event/JobBewerbung');
const Kunde = require('../../models/Customer/Kunde');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Beruf = require('../../models/Event/Beruf');
const Qualifikation = require('../../models/Event/Qualifikation');
const Einsatzort = require('../../models/Event/Einsatzort');
const Sequence = require('../../models/System/Sequence');
const User = require('../../models/System/User');
const asyncHandler = require('../../middleware/AsyncHandler');
const logger = require('../../utils/logger');
const { resolveActiveLocation, resolveLocationFromGeschSt } = require('../../services/operations/LocationResolutionService');
const StundenlisteService = require('../../services/operations/StundenlisteService');
const TelefonlisteService = require('../../services/operations/TelefonlisteService');
const { loadAuftragMitarbeiterExport } = require('../../services/operations/AuftragMitarbeiterExportService');
const R2Service = require('../../services/integrations/R2Service');
const { canAccessOfficeDocument } = require('../../services/operations/OrderDocumentAccessService');
const { documentsForOrder, documentOwner, authorizeDocumentMutation } = require('../../services/operations/OrderDocumentOwnerService');
const SignaturVorgang = require('../../models/Signature/SignaturVorgang');
const { buildStundenlistePdfFilename, contentDisposition } = require('../../utils/stundenlisteFilename');
const {
  buildPlaceholderValues,
  renderTemplate,
  resolveTemplate,
} = require('../../services/operations/EinsatzinformationService');
const { getStaffingCandidates } = require('../../services/operations/StaffingSuggestionService');
const { validateAuftragRelease } = require('../../services/operations/AuftragReleaseService');
const { withAuftragChronik } = require('../../services/operations/AuftragChronikService');
const { allocateMonitorId } = require('../../services/operations/MonitorIdService');
const { invalidateForTimeChange } = require('../../services/operations/EinsatzBestaetigungService');
const resolveQueries = require('../../utils/resolveQueries');
const { canAccess } = require('../../services/TimeCaptureService');
const { resolveGroupOrderDefaults, resolveOrderView } = require('../../services/operations/AuftragsgruppeOrderService');

router.use(require('./auftragChronikRoutes'));

const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

const EINSATZ_DOK_PREFIX = (auftragNr) => `Auftraege/${auftragNr}/docs/`;
const EINSATZ_DOK_SCOPES = new Set(['monitor', 'public']);
const EINSATZ_DOK_TYPES = new Set(['bestellung', 'einsatznachweis', 'einsatzinformation', 'ablauf', 'wegbeschreibung', 'sicherheit', 'kunde', 'sonstiges']);
const PUBLIC_RECIPIENT_RULES = new Set(['all', 'teamleiter', 'individual']);

function normalizeDocumentScope(value) {
  const scope = String(value || 'monitor').trim().toLowerCase();
  if (!EINSATZ_DOK_SCOPES.has(scope)) throw validationError('Ungültiger Dokumentbereich');
  return scope;
}

function normalizePublicRecipientRule(value, fallbackFilter = false) {
  if (!value) return fallbackFilter ? 'individual' : 'all';
  const rule = String(value).trim().toLowerCase();
  if (!PUBLIC_RECIPIENT_RULES.has(rule)) throw validationError('Ungültige Empfängerregel');
  return rule;
}

function normalizeStringList(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(entry => String(entry).trim()).filter(Boolean))];
}

function normalizeObjectIdList(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  const ids = values.map(entry => String(entry).trim()).filter(Boolean);
  if (ids.some(id => !mongoose.isValidObjectId(id))) throw validationError('Ungültige Einsatz-Auswahl');
  return [...new Set(ids)];
}

function serializeEinsatzDokument(document) {
  const effectiveScope = document.scope || (['job', 'teamleiter'].includes(document.audience) ? 'public' : 'monitor');
  const effectiveRule = effectiveScope === 'public'
    ? (document.publicRecipientRule
      || (document.audience === 'teamleiter' ? 'teamleiter' : (document.publicRecipientFilter ? 'individual' : 'all')))
    : 'all';
  return {
    _id: document._id,
    key: document.key,
    filename: document.filename,
    title: document.title || '',
    size: document.size,
    mimeType: document.mimeType,
    scope: effectiveScope,
    type: document.type || null,
    publicEinsatzIds: document.publicEinsatzIds || [],
    publicSchichtIds: document.publicSchichtIds || [],
    publicRecipientFilter: !!document.publicRecipientFilter,
    publicRecipientRule: effectiveRule,
    audience: document.audience || 'office',
    berufKeys: document.berufKeys || [],
    allowedRoles: document.allowedRoles || [],
    uploadedAt: document.uploadedAt,
    relationTarget: document.relationTarget || 'order',
    clientUploadId: document.clientUploadId,
    groupId: document.groupId,
  };
}

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const AUFTRAG_EDITABLE_FIELDS = new Set([
  'geschSt', 'locationV2', 'kundenNr', 'eventTitel', 'bediener',
  'dtAngelegtAm', 'bestDatum', 'vonDatum', 'bisDatum',
  'eventStrasse', 'eventPlz', 'eventOrt', 'eventLocation',
  'aktiv', 'auftStatus', 'referenz', 'excludedTeamleiter',
  'statusOverrideTeamleiter', 'labels', 'einsatzort', 'wizardStep',
  'bestelltext',
]);
const SCHICHT_EDITABLE_FIELDS = new Set([
  'bezeichnung', 'treffpunkt', 'treffpunktOrt', 'ansprechpartnerName',
  'ansprechpartnerTelefon', 'ansprechpartnerEmail', 'letzteAusschreibung',
  'datumVon', 'datumBis', 'uhrzeitVon', 'uhrzeitBis', 'typ', 'bedarf',
  'garantiestundenLohn', 'endeOffen',
  'berufSchl', 'qualSchl',
]);
const EINSATZ_EDITABLE_FIELDS = new Set([
  'mitarbeiterId', 'personalNr', 'berufSchl', 'qualSchl', 'bezeichnung', 'datumVon',
  'datumBis', 'cProtBediener', 'dtProtDatum', 'idAuftragArbeitsschichten',
  'schichtBezeichnung', 'treffpunkt', 'treffpunktOrt',
  'ansprechpartnerName', 'ansprechpartnerTelefon', 'ansprechpartnerEmail',
  'letzteAusschreibung', 'detailDatumVon', 'detailDatumBis', 'uhrzeitVon',
  'uhrzeitBis', 'typ', 'bedarf', 'garantiestundenLohn', 'endeOffen',
  'stundenlisteIncluded',
]);
const DATE_FIELDS = new Set([
  'dtAngelegtAm', 'bestDatum', 'vonDatum', 'bisDatum', 'letzteAusschreibung',
  'datumVon', 'datumBis', 'dtProtDatum', 'detailDatumVon', 'detailDatumBis',
]);
const NUMBER_FIELDS = new Set([
  'kundenNr', 'aktiv', 'auftStatus', 'bedarf', 'garantiestundenLohn',
  'endeOffen', 'personalNr', 'idAuftragArbeitsschichten', 'wizardStep',
]);
const TIME_FIELDS = new Set(['uhrzeitVon', 'uhrzeitBis']);

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeEditablePatch(body, allowedFields) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const unknownFields = Object.keys(input).filter(key => !allowedFields.has(key));
  if (unknownFields.length) {
    throw validationError(`Nicht editierbare Felder: ${unknownFields.join(', ')}`);
  }
  if (!Object.keys(input).length) throw validationError('Keine Änderungen übermittelt');

  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (value === null) return [key, null];
    if (DATE_FIELDS.has(key)) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw validationError(`${key} ist kein gültiges Datum`);
      return [key, date];
    }
    if (NUMBER_FIELDS.has(key)) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw validationError(`${key} muss eine Zahl sein`);
      return [key, number];
    }
    if (TIME_FIELDS.has(key) && value !== '') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) {
        throw validationError(`${key} muss das Format HH:MM haben`);
      }
      return [key, String(value)];
    }
    return [key, value];
  }));
}

function editableValueChanged(key, nextValue, currentValue) {
  if (DATE_FIELDS.has(key)) {
    const nextTime = nextValue ? new Date(nextValue).getTime() : null;
    const currentTime = currentValue ? new Date(currentValue).getTime() : null;
    return nextTime !== currentTime;
  }
  return String(nextValue ?? '') !== String(currentValue ?? '');
}

function hasEinsatzTimeChange(patch, current) {
  return ['uhrzeitVon', 'uhrzeitBis'].some((key) => (
    Object.prototype.hasOwnProperty.call(patch, key)
    && editableValueChanged(key, patch[key], current[key])
  ));
}

const STUNDENLISTE_FIELD_LABELS = {
  geschSt: 'Geschäftsstelle', locationV2: 'Standort', kundenNr: 'Kunde', eventTitel: 'Veranstaltung',
  vonDatum: 'Beginn', bisDatum: 'Ende', eventLocation: 'Location', eventStrasse: 'Straße',
  eventPlz: 'PLZ', eventOrt: 'Ort', einsatzort: 'Einsatzort', bedarf: 'Personalbedarf',
  schichtBezeichnung: 'Schicht', bezeichnung: 'Bezeichnung', datumVon: 'Beginn', datumBis: 'Ende',
  uhrzeitVon: 'Beginn', uhrzeitBis: 'Ende', personalNr: 'Mitarbeiter', berufSchl: 'Beruf', qualSchl: 'Qualifikation',
  treffpunkt: 'Treffpunktzeit', treffpunktOrt: 'Treffpunkt', ansprechpartnerName: 'Ansprechpartner',
  ansprechpartnerTelefon: 'Telefon', ansprechpartnerEmail: 'E-Mail', garantiestundenLohn: 'Garantierte Stunden',
};
const STUNDENLISTE_ENTITY_LABELS = {
  Auftragsdaten: 'Auftragsdaten wurden geändert',
  Einsatz: 'Einsatzdaten wurden geändert',
};

function formatStundenlisteChangeValue(value) {
  if (value === null || value === undefined || value === '') return 'leer';
  if (value instanceof Date) return value.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  if (Array.isArray(value)) return value.map(formatStundenlisteChangeValue).join(', ') || 'leer';
  return String(value);
}

function getStundenlisteChangeDetails(current, patch) {
  return Object.entries(patch)
    .filter(([field, value]) => formatStundenlisteChangeValue(current[field]) !== formatStundenlisteChangeValue(value))
    .map(([field, value]) => ({
      field: STUNDENLISTE_FIELD_LABELS[field] || field,
      before: formatStundenlisteChangeValue(current[field]),
      after: formatStundenlisteChangeValue(value),
    }));
}

async function recordStundenlisteChange(auftragNr, entity, details) {
  if (!details.length) return;
  await Auftrag.updateOne(
    { auftragNr },
    {
      $push: {
        stundenlisteChangeLog: {
          $each: [{ changedAt: new Date(), entity, details }],
          $slice: -100,
        },
      },
    }
  );
}

function parseAuftragNr(value) {
  const auftragNr = Number.parseInt(value, 10);
  if (!Number.isInteger(auftragNr)) throw validationError('Ungültige Auftragsnummer');
  return auftragNr;
}

function userId(req) {
  return req.user?.id || req.user?._id || null;
}

async function loadRequestUser(req) {
  const id = userId(req);
  return mongoose.isValidObjectId(id)
    ? User.findById(id).select('name email role roles locationV2 locationAccess').lean()
    : null;
}

function employeePersonalNumbers(employee) {
  return [...new Set([
    employee?.personalnr,
    ...(employee?.personalnrHistory || []).map(entry => entry?.value),
  ]
    .map(value => Number.parseInt(value, 10))
    .filter(Number.isInteger))];
}

async function resolveWritableLocation(req, locationId) {
  if (!locationId || !mongoose.isValidObjectId(locationId)) throw validationError('Ein gültiger Standort ist erforderlich');
  const [location, user] = await resolveQueries([
    () => resolveActiveLocation(locationId),
    () => loadRequestUser(req),
  ]);
  if (!location) throw validationError('Der gewählte Standort ist nicht aktiv oder existiert nicht');
  if (!user || !canAccess(user, location._id)) {
    const error = new Error('Für diesen Auftragsstandort fehlt die Berechtigung');
    error.statusCode = 403;
    throw error;
  }
  return { location, user };
}

async function assertCustomerMatchesLocation(customer, locationId) {
  if (!customer) return;
  const fallbackLocation = !customer.locationV2 && customer.geschSt
    ? await resolveLocationFromGeschSt(customer.geschSt)
    : null;
  const customerLocationId = customer.locationV2 || fallbackLocation?._id;
  if (customerLocationId && String(customerLocationId) !== String(locationId)) {
    throw validationError('Der Kunde gehört nicht zum gewählten Auftragsstandort');
  }
}

async function assertOrderHasLocation(req, auftrag) {
  if (!auftrag?.locationV2) throw validationError('Dem Auftrag ist kein Standort zugeordnet');
  const user = await loadRequestUser(req);
  if (!user || !canAccess(user, auftrag.locationV2)) {
    const error = new Error('Für diesen Auftragsstandort fehlt die Berechtigung');
    error.statusCode = 403;
    throw error;
  }
}

async function allocateMonitorIdForAuftrag(entityType, auftrag) {
  const location = await resolveActiveLocation(auftrag?.locationV2);
  if (!location) throw validationError('Dem Auftrag ist kein aktiver Standort für die Monitor-ID zugeordnet');
  return allocateMonitorId(entityType, location.externalId);
}

function conflictIdentity(conflict = {}) {
  return [conflict.type, conflict.entryId || conflict.einsatzId || conflict.label].map(value => String(value || '')).join(':');
}

function conflictOverrideCovers(override, conflicts) {
  if (!conflicts.length) return true;
  if (!override?.confirmed || !String(override.reason || '').trim()) return false;
  const confirmed = new Set((override.conflicts || []).map(conflictIdentity));
  return conflicts.every(conflict => confirmed.has(conflictIdentity(conflict)));
}

async function allocateManualAuftragNr() {
  const latest = await Auftrag.findOne({ auftragNr: { $gte: 8000001, $lt: 9000000 } })
    .sort({ auftragNr: -1 })
    .select('auftragNr')
    .lean();
  try {
    await Sequence.findOneAndUpdate(
      { key: 'auftrag-manual' },
      { $max: { value: Math.max(8000000, Number(latest?.auftragNr || 0)) } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const sequence = await Sequence.findOneAndUpdate(
    { key: 'auftrag-manual' },
    { $inc: { value: 1 } },
    { new: true }
  );
  return sequence.value;
}

async function getEinsatzortForAuftrag(kundenNr, einsatzortId) {
  if (!einsatzortId) return null;
  if (!mongoose.isValidObjectId(einsatzortId)) throw validationError('Ungültiger Einsatzort');
  const kunde = Number.isInteger(Number(kundenNr))
    ? await Kunde.findOne({ kundenNr: Number(kundenNr) }).select('_id').lean()
    : null;
  if (!kunde) throw validationError('Für einen Stammdaten-Einsatzort muss zuerst ein Kunde gewählt werden');
  const einsatzort = await Einsatzort.findOne({
    _id: einsatzortId,
    kunde: kunde._id,
    isActive: { $ne: false },
  }).populate('adresse').lean();
  if (!einsatzort) throw validationError('Der Einsatzort gehört nicht zum gewählten Kunden');
  return einsatzort;
}

function eventAddressFromEinsatzort(einsatzort) {
  if (!einsatzort) return {};
  return {
    einsatzort: einsatzort._id,
    eventLocation: einsatzort.bezeichnung || einsatzort.adresse?.name || '',
    eventStrasse: einsatzort.adresse?.strasse || '',
    eventPlz: einsatzort.adresse?.plz || '',
    eventOrt: einsatzort.adresse?.ort || '',
  };
}

async function renderShiftInformation({ auftrag, schicht, sourceHtml, customized, forceTemplate = false }) {
  const [kunde, einsatzort, beruf, qualifikation, location] = await resolveQueries([
    () => auftrag.kundenNr ? Kunde.findOne({ kundenNr: auftrag.kundenNr }).lean() : null,
    () => auftrag.einsatzort ? Einsatzort.findById(auftrag.einsatzort).populate('adresse').lean() : null,
    () => schicht.berufSchl ? Beruf.findOne({ jobKey: Number(schicht.berufSchl) }).lean() : null,
    () => schicht.qualSchl ? Qualifikation.findOne({ qualificationKey: Number(schicht.qualSchl) }).lean() : null,
    () => auftrag.locationV2 ? resolveActiveLocation(auftrag.locationV2) : null,
  ]);
  let templateResult = { template: null, resolution: null };
  const existing = schicht.einsatzinformation || {};
  const mayResolve = Boolean(kunde && auftrag.einsatzort && (!existing.customized || forceTemplate));
  if (mayResolve) {
    templateResult = await resolveTemplate({
      kundeId: kunde._id,
      einsatzortId: einsatzort?._id || null,
      berufId: beruf?._id || null,
      qualifikationId: qualifikation?._id || null,
    });
  } else if (kunde && !auftrag.einsatzort && (!existing.customized || forceTemplate)) {
    templateResult = await resolveTemplate({ kundeId: kunde._id });
  }

  const explicitSource = sourceHtml !== undefined
    && (String(sourceHtml || '').trim() !== '' || customized === true)
    && (!forceTemplate || customized === true);
  const shouldApplyTemplate = Boolean(templateResult.template)
    && (forceTemplate || (!explicitSource && !existing.sourceHtml));
  const shouldClearAutomaticSnapshot = forceTemplate
    && !templateResult.template
    && customized !== true
    && !existing.customized;
  const frozenSource = shouldClearAutomaticSnapshot
    ? ''
    : explicitSource
    ? String(sourceHtml || '').trim()
    : shouldApplyTemplate
      ? templateResult.template.htmlTemplate
      : existing.sourceHtml || '';
  if (!frozenSource) {
    return {
      template: null,
      templateVersion: null,
      resolution: 'manual',
      sourceHtml: '',
      renderedHtml: '',
      unresolvedPlaceholders: [],
      customized: Boolean(customized),
      resolvedAt: new Date(),
    };
  }

  const values = buildPlaceholderValues({ kunde: kunde || {}, auftrag, einsatzort: einsatzort || {},
    schicht, beruf: beruf || {}, qualifikation: qualifikation || {}, location: location || {} });
  const rendered = renderTemplate(frozenSource, values);
  const appliedTemplate = shouldApplyTemplate ? templateResult.template : null;
  return {
    template: appliedTemplate?._id || existing.template || null,
    templateVersion: appliedTemplate?.version || existing.templateVersion || null,
    resolution: appliedTemplate ? templateResult.resolution : existing.resolution || 'manual',
    sourceHtml: frozenSource,
    renderedHtml: rendered.renderedHtml,
    unresolvedPlaceholders: rendered.unresolvedPlaceholders,
    customized: explicitSource ? customized !== false : Boolean(existing.customized),
    resolvedAt: new Date(),
  };
}

async function invokeEditorMutation(method, path, req, params, body) {
  const layer = router.stack.find(entry => entry.route?.path === path && entry.route.methods[method]);
  const handler = layer?.route.stack.map(entry => entry.handle).find(entry => entry.mutationHandler)?.mutationHandler;
  if (!handler) throw new Error(`Auftragsmutation fehlt: ${method} ${path}`);
  const response = { statusCode: 200, body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; } };
  await handler({ ...req, params, body }, response);
  if (response.statusCode >= 400) {
    const error = new Error(response.body?.message || 'Auftragsänderung abgelehnt');
    error.statusCode = response.statusCode;
    error.code = response.body?.code;
    error.details = response.body;
    throw error;
  }
  return response.body?.toObject ? response.body.toObject() : response.body;
}

async function readEditorDetails(req, number, resolvedGroup) {
  const route = router.stack.find(entry => entry.route?.path === '/:auftragNr/details');
  let value;
  await route.route.stack.at(-1).handle({ ...req, params: { auftragNr: String(number) } },
    { status() { return this; }, json(body) { value = body; } });
  if (!value || value.success === false) throw validationError('Auftragsdetails konnten nicht geladen werden');
  const group = resolvedGroup === undefined
    ? value.auftragsgruppe
      ? await resolveGroupOrderDefaults(await require('../../models/Event/Auftragsgruppe').findById(value.auftragsgruppe).lean()) : null
    : resolvedGroup;
  value = resolveOrderView(value, group);
  value.groupRevision = group?.revision ?? null;
  value.groupStatus = group?.status ?? null;
  value.dailyOrder = Boolean(value.day);
  value.day ||= require('../../utils/orderDay').dayKey(value.vonDatum);
  value.schichten = value.schichten.map(shift => ({ ...shift, overrides: shift.overrides || [] }));
  return value;
}

router.use('/editor', auth, require('./auftragEditorRoutes')({
  invokeMutation: invokeEditorMutation, readDetails: readEditorDetails,
  getEinsatzortForAuftrag, resolveWritableLocation, assertCustomerMatchesLocation,
  normalizeEditablePatch, orderFields: AUFTRAG_EDITABLE_FIELDS, shiftFields: SCHICHT_EDITABLE_FIELDS,
  renderShiftInformation,
  employeePersonalNumbers,
}));

// GET /api/auftraege/search - Full-database search across all orders (ignores date range)
// Query params: q (string), locationV2 (optional ObjectId), limit (default 25)
router.get('/search', async (req, res) => {
  try {
    const { q, locationV2, limit } = req.query;
    const words = String(q || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return res.json([]);

    const maxResults = Math.min(parseInt(limit, 10) || 25, 50);

    const baseQuery = { aktiv: { $ne: 0 } };

    // Respect active Standort filter
    if (locationV2) {
      const location = await resolveActiveLocation(locationV2);
      if (!location) {
        return res.status(400).json({ success: false, message: 'Der gewählte Standort ist nicht aktiv oder existiert nicht.' });
      }
      baseQuery.locationV2 = location._id;
    }

    // Each word must match at least one field (AND across words, OR across fields)
    const andClauses = await Promise.all(words.map(async (word) => {
      const rx = new RegExp(escapeRegex(word), 'i');
      const matchedKundenNrs = await Kunde
        .find({ $or: [{ kundName: rx }, { kuerzel: rx }] })
        .distinct('kundenNr');

      const or = [
        { eventTitel: rx },
        { eventLocation: rx },
        { eventOrt: rx },
        { referenz: rx },
      ];
      if (matchedKundenNrs.length > 0) or.push({ kundenNr: { $in: matchedKundenNrs } });
      const asNumber = Number(word);
      if (Number.isInteger(asNumber)) or.push({ auftragNr: asNumber });

      return { $or: or };
    }));

    const query = { ...baseQuery, $and: andClauses };

    const auftraege = await Auftrag.find(query)
      .select('auftragNr eventTitel vonDatum bisDatum eventOrt eventLocation referenz kundenNr isPseudo labels')
      .sort({ vonDatum: -1 })
      .limit(maxResults)
      .lean();

    // Attach lightweight Kunde data for display
    const kundenNrs = [...new Set(auftraege.map(a => a.kundenNr).filter(Boolean))];
    const kundenData = kundenNrs.length
      ? await Kunde.find({ kundenNr: { $in: kundenNrs } }).select('kundenNr kundName kuerzel').lean()
      : [];
    const kundenMap = {};
    kundenData.forEach(k => { kundenMap[k.kundenNr] = k; });

    const result = auftraege.map(a => ({
      ...a,
      kundeData: kundenMap[a.kundenNr] || null,
    }));

    res.json(result);
  } catch (error) {
    logger.error('Error searching Aufträge:', error);
    res.status(500).json({ success: false, message: 'Fehler bei der Suche', error: error.message });
  }
});

// GET /api/auftraege/filters - Get available filter options (bediener, kunden, etc)
router.get('/filters', async (req, res) => {
  try {
    const { locationV2 } = req.query;
    
    // Base query for finding relevant orders if a Location v2 id is provided.
    const filterQuery = {};
    if (locationV2) {
      const location = await resolveActiveLocation(locationV2);
      if (!location) {
        return res.status(400).json({ success: false, message: 'Der gewählte Standort ist nicht aktiv oder existiert nicht.' });
      }
      filterQuery.locationV2 = location._id;
    }

    // Get distinct operators for the selected Location.
    const bediener = await Auftrag.find(filterQuery).distinct('bediener');
    
    // Get distinct kundenNrs used in Aufträgen for the selected Location and future jobs.
    // "Zukunft" = bisDatum >= today (including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const customerQuery = { 
      ...filterQuery,
      bisDatum: { $gte: today },
      aktiv: { $ne: 0 } // only active orders
    };

    const usedKundenNrs = await Auftrag.find(customerQuery).distinct('kundenNr');
    
    // Fetch Customer details for these IDs
    const kunden = await Kunde.find({ kundenNr: { $in: usedKundenNrs } })
      .select('kundenNr kundName')
      .sort({ kundName: 1 })
      .lean();
    
    // Clean and sort list (remove null/empty)
    const cleanBediener = bediener
      .filter(b => b && b.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
      
    res.json({
      bediener: cleanBediener,
      kunden: kunden
    });
  } catch (error) {
    logger.error('Error fetching filter options:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Filter', error: error.message });
  }
});

// GET /api/auftraege/recent-options – Standort- und kundenbezogene Schnellvorschläge
router.get('/recent-options', auth, asyncHandler(async (req, res) => {
  const locationId = req.query.locationV2;
  const { location } = await resolveWritableLocation(req, locationId);
  const kundenNr = req.query.kundenNr ? Number.parseInt(req.query.kundenNr, 10) : null;
  const einsatzortId = mongoose.isValidObjectId(req.query.einsatzortId) ? String(req.query.einsatzortId) : null;
  const recentOrders = await Auftrag.find({
    locationV2: location._id,
    aktiv: { $ne: 0 },
    ...(Number.isInteger(kundenNr) ? { kundenNr } : {}),
  }).sort({ updatedAt: -1, dtAngelegtAm: -1 }).limit(60).lean();

  const customerNumbers = [...new Set(recentOrders.map(order => order.kundenNr).filter(Number.isInteger))].slice(0, 8);
  const customers = customerNumbers.length
    ? await Kunde.find({ kundenNr: { $in: customerNumbers } }).select('_id kundenNr kundName kuerzel').lean()
    : [];
  const customerByNumber = new Map(customers.map(customer => [customer.kundenNr, customer]));
  const recentCustomers = customerNumbers.map(number => customerByNumber.get(number)).filter(Boolean);

  let recentEinsatzorte = [];
  let recentShiftPatterns = [];
  if (Number.isInteger(kundenNr)) {
    const kunde = await Kunde.findOne({ kundenNr }).select('_id').lean();
    if (kunde) {
      const sites = await Einsatzort.find({ kunde: kunde._id, isActive: { $ne: false } })
        .populate('adresse')
        .lean();
      const lastUse = new Map();
      recentOrders.forEach((order, index) => {
        if (order.einsatzort && !lastUse.has(String(order.einsatzort))) lastUse.set(String(order.einsatzort), index);
      });
      recentEinsatzorte = sites.sort((left, right) => (
        (lastUse.get(String(left._id)) ?? Number.MAX_SAFE_INTEGER)
        - (lastUse.get(String(right._id)) ?? Number.MAX_SAFE_INTEGER)
      ));

      const patternOrders = einsatzortId
        ? [
          ...recentOrders.filter(order => String(order.einsatzort || '') === einsatzortId),
          ...recentOrders.filter(order => String(order.einsatzort || '') !== einsatzortId),
        ]
        : recentOrders;
      const sourceOrders = [...new Set(patternOrders.slice(0, 8).map(order => order.auftragNr))];
      recentShiftPatterns = sourceOrders.length
        ? await Schicht.find({ auftragNr: { $in: sourceOrders } })
          .sort({ updatedAt: -1 })
          .select('auftragNr bezeichnung datumVon datumBis uhrzeitVon uhrzeitBis bedarf berufSchl qualSchl garantiestundenLohn treffpunkt treffpunktOrt ansprechpartnerName ansprechpartnerTelefon ansprechpartnerEmail')
          .limit(12)
          .lean()
        : [];
    }
  }

  res.json({ recentCustomers, recentEinsatzorte, recentShiftPatterns });
}));

// GET /api/auftraege - List auftraege with date filtering
// Query params: from, to (ISO date strings), locationV2 (ObjectId), bediener (comma-separated string), kunden (comma-separated numbers), bedarfStatus (voll/offen), pseudoEinsatz (boolean)
router.get('/', async (req, res) => {
  try {
    const { from, to, locationV2, bediener, kunden: kundenQuery, bedarfStatus, pseudoEinsatz } = req.query;
    
    const query = {};
    
    // Build date filter: events that overlap with the requested range
    // An event overlaps if: vonDatum <= to AND bisDatum >= from
    if (from || to) {
      query.$and = [];
      
      if (from) {
        // bisDatum must be >= from (event hasn't ended before our range starts)
        query.$and.push({ bisDatum: { $gte: new Date(from) } });
      }
      
      if (to) {
        // vonDatum must be <= to (event hasn't started after our range ends)
        query.$and.push({ vonDatum: { $lte: new Date(to) } });
      }
    }

    // Location v2 filter
    if (locationV2) {
      const location = await resolveActiveLocation(locationV2);
      if (!location) {
        return res.status(400).json({ success: false, message: 'Der gewählte Standort ist nicht aktiv oder existiert nicht.' });
      }
      query.locationV2 = location._id;
    }

    // Bediener Filter
    if (bediener) {
      const bedList = bediener.split(',').map(b => b.trim()).filter(Boolean);
      if (bedList.length > 0) {
        query.bediener = { $in: bedList }; // Case-sensitive exact match for now
      }
    }

    // Kunden Filter (by kundenNr)
    if (kundenQuery) {
      const kundenList = kundenQuery.split(',').map(k => parseInt(k.trim())).filter(k => !isNaN(k));
      if (kundenList.length > 0) {
        query.kundenNr = { $in: kundenList };
      }
    }

    if (pseudoEinsatz === 'true') {
      query.auftragNr = { $in: await Einsatz.distinct('auftragNr', { isPseudo: true }) };
    }
    
    // Only get active/confirmed auftraege (auftStatus = 2 based on import query)
    // Filter out explicitly inactive ones (aktiv = 0)
    query.aktiv = { $ne: 0 };
    
    const auftraege = await Auftrag.find(query)
      .populate('locationV2', 'nameFull shortName color externalId')
      .sort({ vonDatum: 1 })
      .lean();
    
    // Populate with Kunde data (list view only needs name/kürzel — full Kunde comes via /:auftragNr/details)
    const kundenNrs = [...new Set(auftraege.map(a => a.kundenNr).filter(Boolean))];
    const kundenData = await Kunde.find({ kundenNr: { $in: kundenNrs } })
      .select('_id kundenNr kundName kuerzel')
      .lean();
    const kundenMap = {};
    kundenData.forEach(k => { kundenMap[k.kundenNr] = k; });
    
    // Count einsätze per Auftrag and find earliest start time
    const auftragNrs = auftraege.map(a => a.auftragNr);
    const einsatzAgg = await Einsatz.aggregate([
      { $match: { auftragNr: { $in: auftragNrs } } },
      { $group: { _id: '$auftragNr', count: { $sum: 1 }, earliestUhrzeitVon: { $min: '$uhrzeitVon' }, earliestDatumVon: { $min: '$datumVon' } } }
    ]);
    const countMap = {};
    const earliestTimeMap = {};
    einsatzAgg.forEach(e => {
      countMap[e._id] = e.count;
      earliestTimeMap[e._id] = { uhrzeitVon: e.earliestUhrzeitVon, datumVon: e.earliestDatumVon };
    });

    // Fetch mitarbeiter names per Auftrag for search
    const allEinsaetze = await Einsatz.find(
      { auftragNr: { $in: auftragNrs }, personalNr: { $ne: null } },
      { auftragNr: 1, schicht: 1, idAuftragArbeitsschichten: 1, personalNr: 1, updatedAt: 1 }
    ).lean();
    const allPersonalNrs = [...new Set(allEinsaetze.map(e => String(e.personalNr)).filter(Boolean))];
    const maList = allPersonalNrs.length
      ? await Mitarbeiter.find(
          { personalnr: { $in: allPersonalNrs } },
          { personalnr: 1, vorname: 1, nachname: 1, updatedAt: 1 }
        ).lean()
      : [];
    // Map nach ALLEN Nummern des MA (primär + Zusatznummern), damit auch Einsätze
    // einer zweiten Niederlassung dem richtigen Mitarbeiter zugeordnet werden.
    const maNameMap = new Map();
    const maUpdatedAtMap = new Map();
    maList.forEach(m => {
      const name = `${m.vorname || ''} ${m.nachname || ''}`.trim();
      const nrs = new Set([m.personalnr].filter(Boolean).map(String));
      nrs.forEach(nr => {
        maNameMap.set(nr, name);
        maUpdatedAtMap.set(nr, m.updatedAt);
      });
    });
    const mitarbeiterNamesMap = {};
    const mitarbeiterBySchichtMap = {};
    allEinsaetze.forEach(e => {
      const name = maNameMap.get(String(e.personalNr));
      if (name) {
        if (!mitarbeiterNamesMap[e.auftragNr]) mitarbeiterNamesMap[e.auftragNr] = [];
        if (!mitarbeiterNamesMap[e.auftragNr].includes(name)) mitarbeiterNamesMap[e.auftragNr].push(name);
        if (e.schicht || e.idAuftragArbeitsschichten) {
          const key = e.schicht ? `id_${e.schicht}` : `legacy_${e.auftragNr}_${e.idAuftragArbeitsschichten}`;
          if (!mitarbeiterBySchichtMap[key]) mitarbeiterBySchichtMap[key] = [];
          if (!mitarbeiterBySchichtMap[key].includes(name)) mitarbeiterBySchichtMap[key].push(name);
        }
      }
    });
    
    // Aggregate schichten bedarf/besetzt status per auftrag
    // besetzt is not stored reliably — compute from actual Einsatz records
    const schichten = await Schicht.find(
      { auftragNr: { $in: auftragNrs }, bedarf: { $gt: 0 } },
      { auftragNr: 1, idAuftragArbeitsschichten: 1, bedarf: 1, bezeichnung: 1, uhrzeitVon: 1, uhrzeitBis: 1, datumVon: 1 }
    ).lean();

    // Count actual Einsätze per (auftragNr, idAuftragArbeitsschichten)
    const einsatzBySchicht = await Einsatz.aggregate([
      { $match: { auftragNr: { $in: auftragNrs } } },
      { $group: { _id: { auftragNr: '$auftragNr', schicht: '$schicht', legacy: '$idAuftragArbeitsschichten' }, besetzt: { $sum: 1 } } }
    ]);
    const einsatzSchichtMap = {};
    einsatzBySchicht.forEach(({ _id, besetzt }) => {
      const key = _id.schicht ? `id_${_id.schicht}` : `legacy_${_id.auftragNr}_${_id.legacy}`;
      einsatzSchichtMap[key] = besetzt;
    });

    // Compute status per auftrag
    const schichtStatusMap = {};
    const schichtGroups = {};
    schichten.forEach(s => {
      if (!schichtGroups[s.auftragNr]) schichtGroups[s.auftragNr] = [];
      schichtGroups[s.auftragNr].push(s);
    });
    for (const [auftragNr, group] of Object.entries(schichtGroups)) {
      let empty = 0, underbooked = 0, overbooked = 0, full = 0;
      group.forEach(s => {
        const key = `id_${s._id}`;
        const legacyKey = `legacy_${s.auftragNr}_${s.idAuftragArbeitsschichten}`;
        const besetzt = einsatzSchichtMap[key] || einsatzSchichtMap[legacyKey] || 0;
        if (besetzt === 0)             empty++;
        else if (besetzt < s.bedarf)   underbooked++;
        else if (besetzt > s.bedarf)   overbooked++;
        else                           full++;
      });
      const total = group.length;
      let schichtStatus;
      if (empty === total)       schichtStatus = 'all-empty';
      else if (empty > 0)        schichtStatus = 'some-empty';
      else if (underbooked > 0)  schichtStatus = 'underbooked';
      else if (overbooked > 0)   schichtStatus = 'overbooked';
      else                       schichtStatus = 'full';
      schichtStatusMap[Number(auftragNr)] = schichtStatus;
    }

    // Batch-fetch Stundenliste signature status (most recent non-cancelled per auftrag)
    const sigVorgaenge = await SignaturVorgang.find(
      { typKey: 'stundenliste', auftragNr: { $in: auftragNrs }, status: { $ne: 'cancelled' } },
      { auftragNr: 1, status: 1, createdAt: 1 }
    ).sort({ createdAt: -1 }).lean();
    const stundenlisteSignaturStatusMap = {};
    sigVorgaenge.forEach(v => {
      if (!stundenlisteSignaturStatusMap[v.auftragNr]) {
        stundenlisteSignaturStatusMap[v.auftragNr] = v.status;
      }
    });
    const stundenlisteIsOutdatedMap = {};
    auftraege.forEach(auftrag => {
      const vorgang = sigVorgaenge.find(v => v.auftragNr === auftrag.auftragNr);
      if (!vorgang) return;
      const refDate = vorgang.createdAt;
      stundenlisteIsOutdatedMap[auftrag.auftragNr] = Boolean(
        auftrag.updatedAt > refDate
        || allEinsaetze.some(e => e.auftragNr === auftrag.auftragNr && e.updatedAt > refDate)
        || allEinsaetze.some(e => e.auftragNr === auftrag.auftragNr && maUpdatedAtMap.get(String(e.personalNr)) > refDate)
      );
    });

    // Build schichten display map (times + occupancy per shift, grouped by auftragNr)
    const schichtenDisplayMap = {};
    schichten.forEach(s => {
      const key = `id_${s._id}`;
      const legacyKey = `legacy_${s.auftragNr}_${s.idAuftragArbeitsschichten}`;
      const besetzt = einsatzSchichtMap[key] || einsatzSchichtMap[legacyKey] || 0;
      if (!schichtenDisplayMap[s.auftragNr]) schichtenDisplayMap[s.auftragNr] = [];
      schichtenDisplayMap[s.auftragNr].push({
        id: s.idAuftragArbeitsschichten || s._id,
        bezeichnung: s.bezeichnung || null,
        uhrzeitVon: s.uhrzeitVon || null,
        uhrzeitBis: s.uhrzeitBis || null,
        datumVon: s.datumVon || null,
        bedarf: s.bedarf,
        besetzt,
        einsaetze: mitarbeiterBySchichtMap[key] || mitarbeiterBySchichtMap[legacyKey] || []
      });
    });

    // Merge data
    let result = auftraege.map(a => ({
      ...a,
      kundeData: kundenMap[a.kundenNr] || null,
      einsaetzeCount: countMap[a.auftragNr] || 0,
      earliestEinsatzTime: earliestTimeMap[a.auftragNr] || null,
      mitarbeiterNames: mitarbeiterNamesMap[a.auftragNr] || [],
      schichtStatus: schichtStatusMap[a.auftragNr] || 'none',
      schichten: schichtenDisplayMap[a.auftragNr] || [],
      stundenlisteSignaturStatus: stundenlisteSignaturStatusMap[a.auftragNr] || null,
      stundenlisteIsOutdated: stundenlisteIsOutdatedMap[a.auftragNr] || false,
    }));

    if (bedarfStatus) {
      const requested = new Set(bedarfStatus.split(',').map(status => status.trim()).filter(Boolean));
      const allowedStatuses = new Set();
      if (requested.has('voll')) {
        allowedStatuses.add('full');
        allowedStatuses.add('overbooked');
      }
      if (requested.has('offen')) {
        allowedStatuses.add('all-empty');
        allowedStatuses.add('some-empty');
        allowedStatuses.add('underbooked');
      }
      if (allowedStatuses.size > 0) {
        result = result.filter(auftrag => allowedStatuses.has(auftrag.schichtStatus));
      }
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error fetching Aufträge:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Aufträge', error: error.message });
  }
});

// GET /api/auftraege/:auftragNr/details - Get single Auftrag with all Einsätze
router.get('/:auftragNr/details', auth, async (req, res) => {
  try {
    const { auftragNr } = req.params;
    
    const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) })
      .populate('locationV2', 'nameFull shortName color externalId')
      .populate({ path: 'einsatzort', populate: { path: 'adresse' } })
      .lean();
    
    if (!auftrag) {
      return res.status(404).json({ success: false, message: 'Auftrag nicht gefunden' });
    }
    
    // Get Kunde
    let kundeData = null;
    if (auftrag.kundenNr) {
      kundeData = await Kunde.findOne({ kundenNr: auftrag.kundenNr }).lean();
    }
    
    // Get all Einsätze for this Auftrag
    const einsaetze = await Einsatz.find({ auftragNr: parseInt(auftragNr) })
      .populate('schicht', 'bezeichnung datumVon datumBis uhrzeitVon uhrzeitBis')
      .sort({ idAuftragArbeitsschichten: 1, datumVon: 1 })
      .lean();

    // Get all Schichten for this Auftrag (7011 import data)
    const schichten = await Schicht.find({ auftragNr: parseInt(auftragNr) })
      .sort({ idAuftragArbeitsschichten: 1, datumVon: 1 })
      .lean();
    
    // -- Optimization: Batch fetch related data --
    const personalNrs = [...new Set(einsaetze.map(e => e.personalNr).filter(Boolean).map(String))];
    const berufKeys = [...new Set(einsaetze.map(e => parseInt(e.berufSchl)).filter(k => !isNaN(k)))];
    const qualiKeys = [...new Set(einsaetze.map(e => parseInt(e.qualSchl)).filter(k => !isNaN(k)))];

    const [mitarbeiterList, berufList, qualiList] = await Promise.all([
      personalNrs.length ? Mitarbeiter.find({ personalnr: { $in: personalNrs } })
        .select('vorname nachname email personalnr qualifikationen flip_id profilbild persgruppe lohnStammdaten isActive isBewerberstatus')
        .populate('qualifikationen')
        .lean() : [],
      berufKeys.length ? Beruf.find({ jobKey: { $in: berufKeys } }).lean() : [],
      qualiKeys.length ? Qualifikation.find({ qualificationKey: { $in: qualiKeys } }).lean() : []
    ]);

    const mitarbeiterMap = new Map();
    mitarbeiterList.forEach(m => {
      const nrs = new Set([m.personalnr].filter(Boolean).map(String));
      nrs.forEach(nr => mitarbeiterMap.set(nr, m));
    });
    const berufMap = new Map(berufList.map(b => [b.jobKey, b]));
    const qualiMap = new Map(qualiList.map(q => [q.qualificationKey, q]));

    // Map data back to assignments
    const einsaetzeWithMitarbeiter = einsaetze.map(einsatz => {
      const result = { ...einsatz };
      
      if (einsatz.personalNr) {
        result.mitarbeiterData = mitarbeiterMap.get(String(einsatz.personalNr)) || null;
      }
      
      if (einsatz.berufSchl) {
        const key = parseInt(einsatz.berufSchl);
        result.berufData = berufMap.get(key) || null;
      }
      
      if (einsatz.qualSchl) {
        const key = parseInt(einsatz.qualSchl);
        result.qualifikationData = qualiMap.get(key) || null;
      }
      
      return result;
    });
    
    res.json({
      ...auftrag,
      kundeData,
      einsaetze: einsaetzeWithMitarbeiter,
      schichten
    });
    
  } catch (error) {
    logger.error('Error fetching Auftrag details:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Auftragsdetails', error: error.message });
  }
});
// Helper — returns a signed inline URL for an unsigned Stundenliste PDF if it exists in R2.
async function getUnsignedStundenlisteUrl(r2Key) {
  try {
    const objects = await R2Service.listObjects(r2Key);
    if (objects.some(o => o.Key === r2Key)) {
      return await R2Service.getSignedDownloadUrl(r2Key, 7200, { inline: true });
    }
  } catch (_) { /* file not yet uploaded — ignore */ }
  return null;
}

// GET /api/auftraege/:auftragNr/stundenliste-status
// Returns the active Stundenliste SignaturVorgang for this Auftrag (if any) plus an
// isOutdated flag that is true when Auftrag, Einsatz or Mitarbeiter data changed after
// the Stundenliste was generated.
router.get('/:auftragNr/stundenliste-status', auth, asyncHandler(async (req, res) => {
  const auftragNr = parseInt(req.params.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) return res.status(400).json({ message: 'Ungültige Auftragsnummer' });

  const [auftrag, vorgang] = await Promise.all([
    Auftrag.findOne({ auftragNr }).lean(),
    SignaturVorgang
      .findOne({ typKey: 'stundenliste', auftragNr, status: { $ne: 'cancelled' } })
      .populate('typ', 'key label')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!vorgang) {
    return res.json({ vorgang: null, isOutdated: false, outdatedReasons: [], unsignedPdfUrl: null });
  }

  // The PDF is generated at vorgang.createdAt — compare everything against that.
  const refDate = vorgang.createdAt;
  const outdatedReasons = [];
  const recordedChanges = (auftrag?.stundenlisteChangeLog || [])
    .filter(change => new Date(change.changedAt) > refDate)
    .map(change => ({
      entity: change.entity,
      label: STUNDENLISTE_ENTITY_LABELS[change.entity] || `${change.entity} wurden geändert`,
      details: change.details || [],
      changedAt: change.changedAt,
    }));

  // 1. Auftrag fields that affect the Stundenliste PDF changed?
  if (auftrag && auftrag.updatedAt > refDate && !recordedChanges.some(change => change.entity === 'Auftragsdaten')) {
    outdatedReasons.push({ entity: 'Auftrag', label: 'Auftragsdaten wurden geändert' });
  }
  outdatedReasons.push(...recordedChanges);

  // 2. Any Einsatz for this Auftrag updated after creation?
  const latestEinsatz = await Einsatz
    .findOne({ auftragNr })
    .sort({ updatedAt: -1 })
    .select('updatedAt')
    .lean();
  if (latestEinsatz && latestEinsatz.updatedAt > refDate && !recordedChanges.some(change => change.entity === 'Einsatz')) {
    outdatedReasons.push({ entity: 'Einsätze', label: 'Einsatzdaten wurden geändert' });
  }

  // 3. Any involved Mitarbeiter updated after creation?
  const einsaetze = await Einsatz.find({ auftragNr }).select('personalNr').lean();
  const personalNrStrings = [
    ...new Set(einsaetze.map(e => e.personalNr).filter(Boolean).map(String)),
  ];
  if (personalNrStrings.length) {
    const latestMA = await Mitarbeiter
      .findOne({
        $or: [
          { personalnr:     { $in: personalNrStrings } },
        ],
      })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();
    if (latestMA && latestMA.updatedAt > refDate) {
      outdatedReasons.push({ entity: 'Mitarbeiter', label: 'Mitarbeiterdaten wurden geändert' });
    }
  }

  // Return signed download URL for the completed/signed PDF when available
  let signedPdfUrl = null;
  if (vorgang.r2KeySigned) {
    try {
      signedPdfUrl = await R2Service.getSignedDownloadUrl(vorgang.r2KeySigned, 7200, { inline: false });
    } catch (_) { /* key may not exist yet */ }
  }

  let unsignedPdfUrl = null;
  if (vorgang.status === 'draft') {
    unsignedPdfUrl = await getUnsignedStundenlisteUrl(
      vorgang.r2KeyUnsigned || `stundenlisten/${auftragNr}.pdf`
    );
  }

  res.json({ vorgang, isOutdated: outdatedReasons.length > 0, outdatedReasons, unsignedPdfUrl, signedPdfUrl });
}));
// GET /api/auftraege/:auftragNr/stundenliste — Stundenliste (Überlassungsvertrag) als PDF
router.get('/:auftragNr/stundenliste', asyncHandler(async (req, res) => {
  const { auftragNr } = req.params;
  const excludePseudo = req.query.excludePseudo === 'true';

  const { buffer, auftrag } = await StundenlisteService.buildStundenliste(auftragNr, { excludePseudo });
  const pdfFilename = buildStundenlistePdfFilename(auftrag);

  // Im Hintergrund nach R2 sichern (ein Dokument pro Auftrag, wird überschrieben)
  const r2Key = `stundenlisten/${auftragNr}.pdf`;
  R2Service.uploadFile(r2Key, buffer, 'application/pdf')
    .catch(err => logger.error(`Stundenliste R2-Upload fehlgeschlagen (${r2Key}):`, err));

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': contentDisposition(pdfFilename),
    'Content-Length': buffer.length,
  });
  res.send(buffer);
}));

// GET /api/auftraege/:auftragNr/telefonliste — Telefonliste als PDF
router.get('/:auftragNr/telefonliste', auth, asyncHandler(async (req, res) => {
  const { buffer, auftragNr } = await TelefonlisteService.buildTelefonliste(req.params.auftragNr);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Telefonliste-${auftragNr}.pdf"`,
    'Content-Length': buffer.length,
  });
  res.send(buffer);
}));

// GET /api/auftraege/:auftragNr/mitarbeiter-export - selected-column Excel source data
router.get('/:auftragNr/mitarbeiter-export', auth, asyncHandler(async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);

  const { data } = await loadAuftragMitarbeiterExport(auftragNr);
  res.json(data);
}));

// DELETE /api/auftraege/:auftragNr/stundenliste — Löscht die unsignierte Stundenliste aus R2.
// Wird blockiert wenn ein aktiver Signaturprozess (open/draft) existiert.
router.delete('/:auftragNr/stundenliste', auth, asyncHandler(async (req, res) => {
  const auftragNr = parseInt(req.params.auftragNr, 10);
  if (!Number.isFinite(auftragNr)) return res.status(400).json({ message: 'Ungültige Auftragsnummer' });

  const activeVorgang = await SignaturVorgang.findOne({
    typKey: 'stundenliste',
    auftragNr,
    status: { $in: ['open', 'draft'] },
  }).lean();

  if (activeVorgang) {
    return res.status(409).json({ message: 'Stundenliste kann nicht gelöscht werden – es läuft ein aktiver Signaturprozess.' });
  }

  const r2Key = `stundenlisten/${auftragNr}.pdf`;
  try {
    await R2Service.deleteFile(r2Key);
  } catch (err) {
    logger.warn(`Stundenliste R2-Löschen fehlgeschlagen (${r2Key}): ${err.message}`);
  }

  res.json({ success: true });
}));

router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }
    
    const searchRegex = new RegExp(q, 'i');
    
    // Search in Auftrag fields
    const auftraege = await Auftrag.find({
      $or: [
        { eventTitel: searchRegex },
        { eventOrt: searchRegex },
        { eventLocation: searchRegex }
      ]
    }).limit(50).lean();
    
    // Also search by Kunde name
    const matchingKunden = await Kunde.find({ kundName: searchRegex }).lean();
    const kundenNrs = matchingKunden.map(k => k.kundenNr);
    
    if (kundenNrs.length > 0) {
      const kundeAuftraege = await Auftrag.find({ kundenNr: { $in: kundenNrs } }).lean();
      // Merge without duplicates
      const existingIds = new Set(auftraege.map(a => a._id.toString()));
      kundeAuftraege.forEach(a => {
        if (!existingIds.has(a._id.toString())) {
          auftraege.push(a);
        }
      });
    }
    
    res.json(auftraege);
    
  } catch (error) {
    logger.error('Error searching Aufträge:', error);
    res.status(500).json({ success: false, message: 'Fehler bei der Suche', error: error.message });
  }
});

// GET /api/auftraege/berufe/search?q=... - compact selector data for rule editors
router.get('/berufe/search', auth, asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();
  const search = query
    ? {
        $or: [
          { designation: { $regex: escapeRegex(query), $options: 'i' } },
          ...(Number.isInteger(Number(query)) ? [{ jobKey: Number(query) }] : []),
        ],
      }
    : {};
  const berufe = await Beruf.find(search).select('jobKey designation').sort({ jobKey: 1 }).limit(100).lean();
  res.json(berufe);
}));

// GET /api/auftraege/qualifikationen/search?q=... - compact selector data for qualification searchbars
router.get('/qualifikationen/search', auth, asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();
  const search = query
    ? {
        $or: [
          { designation: { $regex: escapeRegex(query), $options: 'i' } },
          ...(Number.isInteger(Number(query)) ? [{ qualificationKey: Number(query) }] : []),
        ],
      }
    : {};
  const qualifikationen = await Qualifikation.find(search)
    .select('qualificationKey designation')
    .sort({ qualificationKey: 1 })
    .limit(100)
    .lean();
  res.json(qualifikationen);
}));

// GET /api/auftraege/sync?since=<ISO_DATE> - Incremental sync endpoint
router.get('/sync', async (req, res) => {
  try {
    const { since } = req.query;
    
    if (!since) {
      return res.status(400).json({ success: false, message: 'Parameter "since" erforderlich' });
    }
    
    const sinceDate = new Date(since);
    
    // Find all Aufträge updated since the provided timestamp
    const updated = await Auftrag.find({
      updatedAt: { $gt: sinceDate }
    }).lean();

    // Enrich with kundeData + einsaetzeCount (same as main GET /)
    if (updated.length > 0) {
      const kundenNrs = [...new Set(updated.map(a => a.kundenNr).filter(Boolean))];
      const kundenData = await Kunde.find({ kundenNr: { $in: kundenNrs } }).lean();
      const kundenMap = {};
      kundenData.forEach(k => { kundenMap[k.kundenNr] = k; });

      const auftragNrs = updated.map(a => a.auftragNr);
      const einsatzAgg = await Einsatz.aggregate([
        { $match: { auftragNr: { $in: auftragNrs } } },
        { $group: { _id: '$auftragNr', count: { $sum: 1 }, earliestUhrzeitVon: { $min: '$uhrzeitVon' }, earliestDatumVon: { $min: '$datumVon' } } }
      ]);
      const countMap = {};
      const earliestTimeMap = {};
      einsatzAgg.forEach(e => {
        countMap[e._id] = e.count;
        earliestTimeMap[e._id] = { uhrzeitVon: e.earliestUhrzeitVon, datumVon: e.earliestDatumVon };
      });

      updated.forEach((a, i) => {
        updated[i] = {
          ...a,
          kundeData: kundenMap[a.kundenNr] || null,
          einsaetzeCount: countMap[a.auftragNr] || 0,
          earliestEinsatzTime: earliestTimeMap[a.auftragNr] || null,
        };
      });
    }
    
    // Note: We don't track deletions in this model, so deleted array is empty
    const deleted = [];
    
    res.json({
      updated,
      deleted,
      syncedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error syncing Aufträge:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Sync', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// JOB BEWERBUNGEN (PublicDevPortal -> Admin Auftrags-Workspace)
// ─────────────────────────────────────────────────────────────

const BEWERBUNG_MITARBEITER_SELECT = '_id vorname nachname personalnr email telefon profilbild flip_id persgruppe arbeitsverhaeltnis lohnStammdaten qualifikationen berufe locationV2 isActive isBewerberstatus kundenwuensche dispoNotiz vorarbeitgebertage';

async function listJobBewerbungenHandler(req, res) {
  const rawAuftragNr = req.params.auftragNr ?? req.query.auftragNr;
  const parsedAuftragNr = rawAuftragNr !== undefined && rawAuftragNr !== null && rawAuftragNr !== ''
    ? parseInt(rawAuftragNr, 10)
    : null;
  const statusFilter = req.query.status && req.query.status !== 'all' ? String(req.query.status).trim() : null;
  const includeAll = req.query.scope === 'all';

  const query = {};
  if (statusFilter) {
    query.status = statusFilter;
  }
  if (!includeAll && Number.isInteger(parsedAuftragNr)) {
    query.auftragNr = parsedAuftragNr;
  }

  const docs = await JobBewerbung.find(query)
    .populate({
      path: 'mitarbeiter',
      select: BEWERBUNG_MITARBEITER_SELECT,
      populate: [
        { path: 'qualifikationen', select: 'qualificationKey designation' },
        { path: 'berufe', select: 'jobKey designation' },
        { path: 'kundenwuensche.kunde', select: 'kundenNr kundName kuerzel' },
        { path: 'locationV2', select: 'nameFull shortName color externalId' },
      ],
    })
    .populate('schicht', '_id bezeichnung uhrzeitVon uhrzeitBis datumVon datumBis idAuftragArbeitsschichten auftragNr bedarf')
    .sort({ createdAt: -1 })
    .lean();

  const validDocs = docs.filter((doc) => doc.mitarbeiter != null);
  res.json({ bewerbungen: validDocs });
}

async function deleteJobBewerbungenHandler(req, res) {
  const rawAuftragNr = req.params.auftragNr ?? req.query.auftragNr;
  const parsedAuftragNr = rawAuftragNr !== undefined && rawAuftragNr !== null && rawAuftragNr !== ''
    ? parseInt(rawAuftragNr, 10)
    : null;
  const filter = Number.isInteger(parsedAuftragNr) && req.query.scope !== 'all'
    ? { auftragNr: parsedAuftragNr }
    : {};
  const result = await JobBewerbung.deleteMany(filter);
  res.json({ ok: true, deletedCount: result.deletedCount || 0 });
}

async function decideJobBewerbungHandler(req, res) {
  const { bewerbungId } = req.params;
  if (!mongoose.isValidObjectId(bewerbungId)) {
    return res.status(400).json({ message: 'Ungültige Bewerbungs-ID' });
  }

  const bewerbung = await JobBewerbung.findById(bewerbungId);
  if (!bewerbung) {
    return res.status(404).json({ message: 'Bewerbung nicht gefunden' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();
  const explicitStatus = String(req.body?.status || '').trim().toLowerCase();
  let nextStatus = explicitStatus;
  if (action === 'accept') nextStatus = 'scheduled';
  else if (action === 'deny' || action === 'reject') nextStatus = 'rejected';

  if (!['submitted', 'scheduled', 'confirmed', 'rejected'].includes(nextStatus)) {
    return res.status(400).json({ message: 'Ungültige Aktion oder Status für Bewerbung' });
  }

  const mitarbeiter = await Mitarbeiter.findById(bewerbung.mitarbeiter).lean();
  if (!mitarbeiter) {
    return res.status(404).json({ message: 'Zugehöriger Mitarbeiter nicht gefunden' });
  }

  let createdOrExistingEinsatz = null;
  const rawAuftragNr = req.params.auftragNr ?? req.body?.auftragNr ?? bewerbung.auftragNr;
  const parsedAuftragNr = rawAuftragNr !== undefined && rawAuftragNr !== null && rawAuftragNr !== ''
    ? parseInt(rawAuftragNr, 10)
    : null;

  if (nextStatus === 'scheduled' && Number.isInteger(parsedAuftragNr)) {
    const auftrag = await Auftrag.findOne({ auftragNr: parsedAuftragNr });
    if (auftrag) {
      await assertOrderHasLocation(req, auftrag);
      const personalnrInt = mitarbeiter.personalnr ? parseInt(mitarbeiter.personalnr, 10) : null;
      const requestedSchichtId = req.body?.schichtId || (bewerbung.auftragNr === parsedAuftragNr ? bewerbung.schicht : null);
      const requestedLegacyId = bewerbung.auftragNr === parsedAuftragNr ? bewerbung.idAuftragArbeitsschichten : null;

      let schichtTemplate = null;
      const isRequestedObjectId =
        typeof requestedSchichtId === 'string' &&
        /^[0-9a-fA-F]{24}$/.test(requestedSchichtId.trim());
      if (isRequestedObjectId) {
        schichtTemplate = await Schicht.findOne({ _id: requestedSchichtId.trim(), auftragNr: parsedAuftragNr }).lean();
      }
      if (!schichtTemplate && requestedSchichtId != null && !Number.isNaN(parseInt(requestedSchichtId, 10))) {
        schichtTemplate = await Schicht.findOne({
          auftragNr: parsedAuftragNr,
          idAuftragArbeitsschichten: parseInt(requestedSchichtId, 10),
        }).lean();
      }
      if (!schichtTemplate && requestedLegacyId != null) {
        schichtTemplate = await Schicht.findOne({
          auftragNr: parsedAuftragNr,
          idAuftragArbeitsschichten: requestedLegacyId,
        }).lean();
      }
      if (!schichtTemplate) {
        schichtTemplate = await Schicht.findOne({ auftragNr: parsedAuftragNr })
          .sort({ idAuftragArbeitsschichten: 1, datumVon: 1 })
          .lean();
      }

      const duplicateFilter = {
        auftragNr: parsedAuftragNr,
        personalNr: personalnrInt,
      };
      if (schichtTemplate?._id) {
        duplicateFilter.$or = [
          { schicht: schichtTemplate._id },
          ...(schichtTemplate.idAuftragArbeitsschichten != null
            ? [{ idAuftragArbeitsschichten: schichtTemplate.idAuftragArbeitsschichten }]
            : []),
        ];
      }
      createdOrExistingEinsatz = await Einsatz.findOne(duplicateFilter);

      if (!createdOrExistingEinsatz) {
        const templateEinsatz = await Einsatz.findOne({
          auftragNr: parsedAuftragNr,
          ...(schichtTemplate?.idAuftragArbeitsschichten != null
            ? { idAuftragArbeitsschichten: schichtTemplate.idAuftragArbeitsschichten }
            : {}),
        }).lean();
        const tpl = schichtTemplate || templateEinsatz;

        let monitorId = undefined;
        try {
          monitorId = await allocateMonitorIdForAuftrag('einsatz', auftrag);
        } catch (_) {
          monitorId = undefined;
        }

        createdOrExistingEinsatz = await Einsatz.create({
          ...(monitorId ? { monitorId } : {}),
          creationOrigin: 'manual',
          source: 'monitor',
          plannedBy: userId(req),
          auftragNr: parsedAuftragNr,
          locationV2: auftrag.locationV2 || null,
          schicht: schichtTemplate?._id || tpl?.schicht || null,
          personalNr: personalnrInt,
          datumVon: schichtTemplate?.datumVon || tpl?.datumVon || auftrag.vonDatum,
          datumBis: schichtTemplate?.datumBis || tpl?.datumBis || auftrag.bisDatum,
          idAuftragArbeitsschichten: schichtTemplate?.idAuftragArbeitsschichten ?? tpl?.idAuftragArbeitsschichten ?? null,
          schichtBezeichnung: schichtTemplate?.bezeichnung || tpl?.schichtBezeichnung || tpl?.bezeichnung || bewerbung.schichtBezeichnung || 'Schicht',
          bezeichnung: schichtTemplate?.bezeichnung || tpl?.bezeichnung || bewerbung.schichtBezeichnung || 'Einsatz',
          uhrzeitVon: schichtTemplate?.uhrzeitVon || tpl?.uhrzeitVon,
          uhrzeitBis: schichtTemplate?.uhrzeitBis || tpl?.uhrzeitBis,
          treffpunkt: schichtTemplate?.treffpunkt || tpl?.treffpunkt,
          treffpunktOrt: schichtTemplate?.treffpunktOrt || tpl?.treffpunktOrt,
          ansprechpartnerName: schichtTemplate?.ansprechpartnerName || tpl?.ansprechpartnerName,
          ansprechpartnerTelefon: schichtTemplate?.ansprechpartnerTelefon || tpl?.ansprechpartnerTelefon,
          berufSchl: schichtTemplate?.berufSchl || tpl?.berufSchl,
          qualSchl: schichtTemplate?.qualSchl || tpl?.qualSchl,
          bedarf: schichtTemplate?.bedarf ?? tpl?.bedarf,
          isPseudo: true,
          stundenlisteIncluded: false,
          bestaetigungErforderlich: true,
          bestaetigt: false,
        });
      }

      bewerbung.auftragNr = parsedAuftragNr;
      if (schichtTemplate?._id) bewerbung.schicht = schichtTemplate._id;
      if (schichtTemplate?.idAuftragArbeitsschichten != null) {
        bewerbung.idAuftragArbeitsschichten = schichtTemplate.idAuftragArbeitsschichten;
      }
      if (schichtTemplate?.bezeichnung) {
        bewerbung.schichtBezeichnung = schichtTemplate.bezeichnung;
      }
      bewerbung.einsatz = createdOrExistingEinsatz._id;
    }
  } else if (nextStatus === 'rejected' && bewerbung.einsatz) {
    await Einsatz.findOneAndDelete({ _id: bewerbung.einsatz, isPseudo: true });
    bewerbung.einsatz = null;
  }

  bewerbung.status = nextStatus;
  if (nextStatus === 'scheduled') {
    bewerbung.confirmationStep = 0;
  }
  bewerbung.decidedBy = userId(req);
  bewerbung.decidedAt = new Date();
  await bewerbung.save();

  const populated = await JobBewerbung.findById(bewerbung._id)
    .populate({
      path: 'mitarbeiter',
      select: BEWERBUNG_MITARBEITER_SELECT,
      populate: [
        { path: 'qualifikationen', select: 'qualificationKey designation' },
        { path: 'berufe', select: 'jobKey designation' },
        { path: 'kundenwuensche.kunde', select: 'kundenNr kundName kuerzel' },
        { path: 'locationV2', select: 'nameFull shortName color externalId' },
      ],
    })
    .populate('schicht', '_id bezeichnung uhrzeitVon uhrzeitBis datumVon datumBis idAuftragArbeitsschichten auftragNr bedarf')
    .lean();

  res.json({
    ok: true,
    bewerbung: populated,
    einsatz: createdOrExistingEinsatz ? createdOrExistingEinsatz.toObject?.() || createdOrExistingEinsatz : null,
  });
}

router.get('/bewerbungen', auth, requireAdmin, asyncHandler(listJobBewerbungenHandler));
router.get('/:auftragNr/bewerbungen', auth, requireAdmin, asyncHandler(listJobBewerbungenHandler));
router.delete('/bewerbungen', auth, requireAdmin, asyncHandler(deleteJobBewerbungenHandler));
router.delete('/:auftragNr/bewerbungen', auth, requireAdmin, asyncHandler(deleteJobBewerbungenHandler));
router.patch('/bewerbungen/:bewerbungId', auth, requireAdmin, asyncHandler(decideJobBewerbungHandler));
router.patch('/:auftragNr/bewerbungen/:bewerbungId', auth, requireAdmin, withAuftragChronik('Einsatz.created', decideJobBewerbungHandler));

// ─────────────────────────────────────────────────────────────
// LABELS
// ─────────────────────────────────────────────────────────────

// GET /api/auftraege/labels – All unique label names used across all Aufträge (for autocomplete)
router.get('/labels', asyncHandler(async (req, res) => {
  const auftraege = await Auftrag.find({ 'labels.0': { $exists: true } }).select('labels').lean();
  const labelMap = new Map();
  auftraege.forEach(a => {
    (a.labels || []).forEach(l => {
      if (!labelMap.has(l.name)) labelMap.set(l.name, l.color);
    });
  });
  const result = Array.from(labelMap.entries()).map(([name, color]) => ({ name, color }));
  res.json(result);
}));

// POST /api/auftraege/:auftragNr/labels – Add a label to an Auftrag
router.post('/:auftragNr/labels', auth, withAuftragChronik('Auftrag.updated', async (req, res) => {
  const { auftragNr } = req.params;
  const { name, color } = req.body;
  if (!name || String(name).trim().length === 0 || String(name).trim().length > 20) {
    return res.status(400).json({ message: 'Label-Name erforderlich (max. 20 Zeichen)' });
  }
  const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) });
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);

  const trimmedName = String(name).trim();
  const exists = (auftrag.labels || []).some(l => l.name.toLowerCase() === trimmedName.toLowerCase());
  if (exists) return res.status(400).json({ message: 'Label bereits vorhanden' });

  auftrag.labels = auftrag.labels || [];
  auftrag.labels.push({ name: trimmedName, color: color || '#4f46e5' });
  await auftrag.save();
  res.json({ labels: auftrag.labels });
}));

// DELETE /api/auftraege/:auftragNr/labels/:labelId – Remove a label from an Auftrag
router.delete('/:auftragNr/labels/:labelId', auth, withAuftragChronik('Auftrag.updated', async (req, res) => {
  const { auftragNr, labelId } = req.params;
  const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr) });
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  auftrag.labels = (auftrag.labels || []).filter(l => String(l._id) !== labelId);
  await auftrag.save();
  res.json({ labels: auftrag.labels });
}));

// ─────────────────────────────────────────────────────────────
// MONITOR-AUFTRÄGE UND PSEUDO-AUFTRÄGE
// ─────────────────────────────────────────────────────────────

// POST /api/auftraege – Früh gespeicherten Wizard-Entwurf anlegen
router.post('/', auth, withAuftragChronik('Auftrag.created', async (req, res) => {
  const input = req.body || {};
  if (!String(input.eventTitel || '').trim() || !input.vonDatum || !input.bisDatum) {
    throw validationError('Titel, Beginn und Ende sind erforderlich');
  }
  const vonDatum = new Date(input.vonDatum);
  const bisDatum = new Date(input.bisDatum);
  if (Number.isNaN(vonDatum.getTime()) || Number.isNaN(bisDatum.getTime()) || bisDatum < vonDatum) {
    throw validationError('Der Auftragszeitraum ist ungültig');
  }
  const { location, user } = await resolveWritableLocation(req, input.locationV2);
  const kundenNr = input.kundenNr === null || input.kundenNr === undefined || input.kundenNr === ''
    ? null
    : Number.parseInt(input.kundenNr, 10);
  if (!Number.isInteger(kundenNr)) throw validationError('Ein Kunde ist erforderlich');
  const customer = Number.isInteger(kundenNr)
    ? await Kunde.findOne({ kundenNr }).select('_id locationV2 geschSt').lean()
    : null;
  if (Number.isInteger(kundenNr) && !customer) throw validationError('Kunde nicht gefunden');
  await assertCustomerMatchesLocation(customer, location._id);

  let auftragNr = await allocateManualAuftragNr();

  const einsatzort = input.einsatzort
    ? await getEinsatzortForAuftrag(kundenNr, input.einsatzort)
    : null;
  if (!einsatzort) throw validationError('Ein gespeicherter Kunden-Einsatzort ist erforderlich');
  const createData = {
    monitorId: await allocateMonitorId('auftrag', location.externalId),
    creationOrigin: 'manual',
    eventTitel: String(input.eventTitel).trim(),
    vonDatum,
    bisDatum,
    bestDatum: input.bestDatum ? new Date(input.bestDatum) : null,
    referenz: input.referenz === null ? null : String(input.referenz ?? '').trim(),
    bestelltext: String(input.bestelltext ?? ''),
    labels: Array.isArray(input.labels) ? input.labels : [],
    geschSt: location.externalId || null,
    locationV2: location._id,
    kundenNr,
    ...eventAddressFromEinsatzort(einsatzort),
    eventLocation: einsatzort?.bezeichnung || String(input.eventLocation || '').trim(),
    eventStrasse: einsatzort?.adresse?.strasse || String(input.eventStrasse || '').trim(),
    eventPlz: einsatzort?.adresse?.plz || String(input.eventPlz || '').trim(),
    eventOrt: einsatzort?.adresse?.ort || String(input.eventOrt || '').trim(),
    bediener: user?.name || user?.email || '',
    dtAngelegtAm: new Date(),
    createdBy: user?._id || userId(req),
    source: 'monitor',
    aktiv: 1,
    auftStatus: 1,
    wizardStep: 0,
    planningVersion: 0,
    isPseudo: false,
  };
  let auftrag;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      auftrag = await Auftrag.create({ ...createData, auftragNr });
      break;
    } catch (error) {
      if (error?.code !== 11000 || attempt === 4) throw error;
      auftragNr = await allocateManualAuftragNr();
    }
  }
  await auftrag.populate([
    { path: 'locationV2', select: 'nameFull shortName color externalId', ordered: true },
    { path: 'einsatzort', populate: { path: 'adresse' } },
  ]);
  res.status(201).json(auftrag.toObject());
}));

// DELETE /api/auftraege/:auftragNr – Delete a pseudo Auftrag (and its pseudo Einsätze)
router.delete('/:auftragNr', auth, withAuftragChronik('Auftrag.deleted', async (req, res) => {
  const { auftragNr } = req.params;
  const auftrag = await Auftrag.findOne({ auftragNr: parseInt(auftragNr), isPseudo: true });
  if (!auftrag) return res.status(404).json({ message: 'Pseudo-Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  await Einsatz.deleteMany({ auftragNr: parseInt(auftragNr) });
  await Schicht.deleteMany({ auftragNr: parseInt(auftragNr) });
  await auftrag.deleteOne();
  res.json({ ok: true });
}));

// ─────────────────────────────────────────────────────────────
// PSEUDO-EINSÄTZE
// ─────────────────────────────────────────────────────────────

// POST /api/auftraege/:auftragNr/pseudo-einsatz – Schedule a pseudo-employee or create a new pseudo-shift
router.post('/:auftragNr/pseudo-einsatz', auth, withAuftragChronik('Einsatz.created', async (req, res) => {
  const { auftragNr } = req.params;
  const parsedAuftragNr = parseInt(auftragNr, 10);
  const {
    mitarbeiterId,
    schichtId,
    isNewPseudoSchicht,
    forceCreateNewSchicht,
    newSchichtBezeichnung,
    newUhrzeitVon,
    newUhrzeitBis,
    newBerufSchl,
    newQualSchl,
    newBedarf,
    newDatumVon,
    newDatumBis,
    newTreffpunkt,
    newTreffpunktOrt,
    newAnsprechpartnerName,
    newAnsprechpartnerTelefon,
    newAnsprechpartnerEmail,
    replanFromEinsatzIds,
  } = req.body;
  if (!mitarbeiterId && !isNewPseudoSchicht) {
    return res.status(400).json({ message: 'mitarbeiterId oder neue Pseudo-Schicht erforderlich' });
  }
  if (isNewPseudoSchicht && !String(newSchichtBezeichnung || '').trim()) {
    return res.status(400).json({ message: 'Bezeichnung für neue Pseudo-Schicht erforderlich' });
  }

  const auftrag = await Auftrag.findOne({ auftragNr: parsedAuftragNr });
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);

  const mitarbeiter = mitarbeiterId ? await Mitarbeiter.findById(mitarbeiterId).lean() : null;
  if (mitarbeiterId && !mitarbeiter) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });

  const personalnrInt = mitarbeiter?.personalnr ? parseInt(mitarbeiter.personalnr, 10) : null;

  // Optional replanning: remove previous shift assignments before creating the new one
  if (Array.isArray(replanFromEinsatzIds) && replanFromEinsatzIds.length) {
    const validIds = replanFromEinsatzIds.filter(
      (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim())
    );
    if (validIds.length) {
      await Einsatz.deleteMany({
        _id: { $in: validIds },
        ...(personalnrInt != null ? { personalNr: personalnrInt } : {}),
      });
    }
  }

  // Create or find a Schicht record when creating a new pseudo-shift
  let createdPseudoSchicht = null;
  if (isNewPseudoSchicht) {
    const trimmedName = String(newSchichtBezeichnung).trim();
    const parsedBedarf = Number.isInteger(Number(newBedarf)) && Number(newBedarf) > 0 ? Number(newBedarf) : 1;
    if (!forceCreateNewSchicht) {
      createdPseudoSchicht = await Schicht.findOne({
        auftragNr: parsedAuftragNr,
        source: 'monitor',
        bezeichnung: trimmedName,
        uhrzeitVon: newUhrzeitVon || null,
        uhrzeitBis: newUhrzeitBis || null,
      }).lean();
    }

    if (!createdPseudoSchicht) {
      let schichtMonitorId = undefined;
      try {
        schichtMonitorId = await allocateMonitorIdForAuftrag('schicht', auftrag);
      } catch (_) {
        schichtMonitorId = undefined;
      }
      const savedSchicht = await Schicht.create({
        ...(schichtMonitorId ? { monitorId: schichtMonitorId } : {}),
        creationOrigin: 'manual',
        source: 'monitor',
        createdBy: userId(req),
        auftragNr: parsedAuftragNr,
        locationV2: auftrag.locationV2 || null,
        idAuftragArbeitsschichten: null,
        bezeichnung: trimmedName,
        datumVon: newDatumVon ? new Date(newDatumVon) : auftrag.vonDatum,
        datumBis: newDatumBis ? new Date(newDatumBis) : (auftrag.bisDatum || auftrag.vonDatum),
        uhrzeitVon: newUhrzeitVon || undefined,
        uhrzeitBis: newUhrzeitBis || undefined,
        treffpunkt: newTreffpunkt || undefined,
        treffpunktOrt: newTreffpunktOrt || undefined,
        ansprechpartnerName: newAnsprechpartnerName || undefined,
        ansprechpartnerTelefon: newAnsprechpartnerTelefon || undefined,
        ansprechpartnerEmail: newAnsprechpartnerEmail || undefined,
        berufSchl: newBerufSchl ? String(newBerufSchl).trim() : undefined,
        qualSchl: newQualSchl ? String(newQualSchl).trim() : undefined,
        bedarf: parsedBedarf,
      });
      createdPseudoSchicht = savedSchicht.toObject();
    }

    if (!mitarbeiter) {
      return res.status(201).json({
        ok: true,
        schicht: createdPseudoSchicht,
      });
    }
  }

  // 'none' means the shift group with no idAuftragArbeitsschichten (null); null means auto (first shift)
  const isNoneGroup = schichtId === 'none';
  const isPseudoNamedGroup = typeof schichtId === 'string' && schichtId.startsWith('pseudo:');
  const [, pseudoName, pseudoVon, pseudoBis] = isPseudoNamedGroup ? schichtId.split(':') : [];
  const isObjectIdSchicht =
    typeof schichtId === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(schichtId.trim());
  const numericSchichtId =
    schichtId != null && !isNoneGroup && !isPseudoNamedGroup && !isObjectIdSchicht
      ? parseInt(schichtId, 10)
      : NaN;
  const hasNumericSchichtId = Number.isInteger(numericSchichtId);

  let schichtTemplate = null;
  if (!isNewPseudoSchicht && !isPseudoNamedGroup) {
    if (isObjectIdSchicht) {
      schichtTemplate = await Schicht.findOne({ _id: schichtId.trim(), auftragNr: parsedAuftragNr }).lean();
    } else if (hasNumericSchichtId) {
      schichtTemplate = await Schicht.findOne({
        auftragNr: parsedAuftragNr,
        idAuftragArbeitsschichten: numericSchichtId,
      }).lean();
    } else if (!isNoneGroup) {
      schichtTemplate = await Schicht.findOne({ auftragNr: parsedAuftragNr }).sort({ idAuftragArbeitsschichten: 1, datumVon: 1 }).lean();
    }
  }

  // Check for duplicate pseudo-einsatz (skip strict check for new pseudo schichten)
  if (!isNewPseudoSchicht) {
    const duplicateFilter = {
      auftragNr: parsedAuftragNr,
      personalNr: personalnrInt,
    };
    if (isPseudoNamedGroup) {
      duplicateFilter.idAuftragArbeitsschichten = null;
      duplicateFilter.schichtBezeichnung = pseudoName || null;
    } else if (schichtTemplate?._id) {
      duplicateFilter.$or = [
        { schicht: schichtTemplate._id },
        ...(schichtTemplate.idAuftragArbeitsschichten != null
          ? [{ idAuftragArbeitsschichten: schichtTemplate.idAuftragArbeitsschichten }]
          : []),
      ];
    } else if (hasNumericSchichtId) {
      duplicateFilter.idAuftragArbeitsschichten = numericSchichtId;
    } else if (isNoneGroup) {
      duplicateFilter.idAuftragArbeitsschichten = null;
    }
    const duplicate = await Einsatz.findOne(duplicateFilter);
    if (duplicate) return res.status(400).json({ message: 'Mitarbeiter bereits in dieser Schicht eingeplant' });
  }

  let tpl = null;
  if (!isNewPseudoSchicht) {
    // Copy metadata from an existing Einsatz or Schicht in the same schicht
    const templateQuery = { auftragNr: parsedAuftragNr };
    if (isPseudoNamedGroup) {
      templateQuery.idAuftragArbeitsschichten = null;
      templateQuery.schichtBezeichnung = pseudoName || null;
    } else if (schichtTemplate?._id) {
      templateQuery.$or = [
        { schicht: schichtTemplate._id },
        ...(schichtTemplate.idAuftragArbeitsschichten != null
          ? [{ idAuftragArbeitsschichten: schichtTemplate.idAuftragArbeitsschichten }]
          : []),
      ];
    } else if (hasNumericSchichtId) {
      templateQuery.idAuftragArbeitsschichten = numericSchichtId;
    } else if (isNoneGroup) {
      templateQuery.idAuftragArbeitsschichten = null;
    }
    const template = await Einsatz.findOne(templateQuery).lean();
    tpl = template || schichtTemplate;
  }

  let monitorId = undefined;
  try {
    monitorId = await allocateMonitorIdForAuftrag('einsatz', auftrag);
  } catch (_) {
    monitorId = undefined;
  }

  const newEinsatz = new Einsatz({
    ...(monitorId ? { monitorId } : {}),
    creationOrigin: 'manual',
    source: 'monitor',
    plannedBy: userId(req),
    auftragNr: parsedAuftragNr,
    locationV2: auftrag.locationV2 || null,
    schicht: createdPseudoSchicht?._id || schichtTemplate?._id || tpl?.schicht || null,
    personalNr: personalnrInt,
    datumVon: schichtTemplate?.datumVon || tpl?.datumVon || auftrag.vonDatum,
    datumBis: schichtTemplate?.datumBis || tpl?.datumBis || auftrag.bisDatum,
    idAuftragArbeitsschichten: isNewPseudoSchicht || isPseudoNamedGroup
      ? null
      : (schichtTemplate?.idAuftragArbeitsschichten ?? (hasNumericSchichtId ? numericSchichtId : isNoneGroup ? null : tpl?.idAuftragArbeitsschichten)),
    schichtBezeichnung: isNewPseudoSchicht
      ? newSchichtBezeichnung
      : isPseudoNamedGroup
        ? (pseudoName || tpl?.schichtBezeichnung)
        : (schichtTemplate?.bezeichnung || tpl?.schichtBezeichnung || tpl?.bezeichnung),
    uhrzeitVon: isNewPseudoSchicht
      ? (newUhrzeitVon || undefined)
      : isPseudoNamedGroup
        ? (pseudoVon || tpl?.uhrzeitVon || undefined)
        : (schichtTemplate?.uhrzeitVon || tpl?.uhrzeitVon),
    uhrzeitBis: isNewPseudoSchicht
      ? (newUhrzeitBis || undefined)
      : isPseudoNamedGroup
        ? (pseudoBis || tpl?.uhrzeitBis || undefined)
        : (schichtTemplate?.uhrzeitBis || tpl?.uhrzeitBis),
    treffpunkt: schichtTemplate?.treffpunkt || tpl?.treffpunkt,
    treffpunktOrt: schichtTemplate?.treffpunktOrt || tpl?.treffpunktOrt,
    ansprechpartnerName: schichtTemplate?.ansprechpartnerName || tpl?.ansprechpartnerName,
    ansprechpartnerTelefon: schichtTemplate?.ansprechpartnerTelefon || tpl?.ansprechpartnerTelefon,
    bezeichnung: isNewPseudoSchicht
      ? newSchichtBezeichnung
      : (schichtTemplate?.bezeichnung || tpl?.bezeichnung || pseudoName),
    berufSchl: isNewPseudoSchicht
      ? (newBerufSchl ? String(newBerufSchl).trim() : undefined)
      : (schichtTemplate?.berufSchl || tpl?.berufSchl),
    qualSchl: isNewPseudoSchicht
      ? (newQualSchl ? String(newQualSchl).trim() : undefined)
      : (schichtTemplate?.qualSchl || tpl?.qualSchl),
    bedarf: isNewPseudoSchicht
      ? (Number.isInteger(Number(newBedarf)) && Number(newBedarf) > 0 ? Number(newBedarf) : 1)
      : (schichtTemplate?.bedarf ?? tpl?.bedarf),
    isPseudo: true,
    stundenlisteIncluded: false,
    bestaetigungErforderlich: false,
    bestaetigt: false,
  });
  await newEinsatz.save();

  // Sync any matching JobBewerbung for this employee
  await JobBewerbung.updateMany(
    {
      mitarbeiter: mitarbeiter._id,
      status: 'submitted',
      $or: [
        { auftragNr: parsedAuftragNr },
        ...(schichtTemplate?._id ? [{ jobId: String(schichtTemplate._id) }, { schicht: schichtTemplate._id }] : []),
      ],
    },
    {
      $set: {
        status: 'scheduled',
        confirmationStep: 0,
        einsatz: newEinsatz._id,
        decidedBy: userId(req),
        decidedAt: new Date(),
      },
    }
  );

  res.status(201).json({
    ...newEinsatz.toObject(),
    mitarbeiterData: {
      _id: mitarbeiter._id,
      vorname: mitarbeiter.vorname,
      nachname: mitarbeiter.nachname,
      personalnr: mitarbeiter.personalnr,
    }
  });
}));

// ─────────────────────────────────────────────────────────────
// EDITABLE EVENT RESOURCES
// ─────────────────────────────────────────────────────────────

router.patch('/:auftragNr', auth, withAuftragChronik('Auftrag.updated', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const patch = normalizeEditablePatch(req.body, AUFTRAG_EDITABLE_FIELDS);
  const current = await Auftrag.findOne({ auftragNr });
  if (!current) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, current);
  if (!current.isPseudo && Object.hasOwn(patch, 'kundenNr') && Number(patch.kundenNr) !== Number(current.kundenNr)) {
    throw validationError('Der Kunde eines bestehenden Auftrags kann nicht geändert werden');
  }
  if (!current.isPseudo) {
    const siteId = Object.hasOwn(patch, 'einsatzort') ? patch.einsatzort : current.einsatzort;
    if (!siteId) throw validationError('Ein gespeicherter Kunden-Einsatzort ist erforderlich');
    await getEinsatzortForAuftrag(current.kundenNr, siteId);
  }
  if (current.day) {
    const { dayKey } = require('../../utils/orderDay');
    for (const key of ['vonDatum', 'bisDatum']) {
      if (Object.hasOwn(patch, key) && dayKey(patch[key]) !== current.day) {
        throw validationError('Der Starttag eines Tagesauftrags kann nicht geändert werden');
      }
    }
  }
  if (current.source === 'monitor'
    && Object.prototype.hasOwnProperty.call(patch, 'auftStatus')
    && Number(patch.auftStatus) !== Number(current.auftStatus)) {
    throw validationError('Der Status eines Monitor-Auftrags kann nur über die Freigabe geändert werden');
  }
  const templateContextChanged = ['kundenNr', 'einsatzort'].some(key => (
    Object.prototype.hasOwnProperty.call(patch, key)
    && editableValueChanged(key, patch[key], current[key])
  ));
  const renderContextChanged = [
    'kundenNr', 'eventTitel', 'vonDatum', 'bisDatum', 'eventLocation',
    'eventStrasse', 'eventPlz', 'eventOrt', 'einsatzort', 'locationV2',
  ].some(key => (
    Object.prototype.hasOwnProperty.call(patch, key)
    && editableValueChanged(key, patch[key], current[key])
  ));

  if (Object.prototype.hasOwnProperty.call(patch, 'locationV2') && patch.locationV2) {
    const { location } = await resolveWritableLocation(req, patch.locationV2);
    patch.locationV2 = location._id;
    patch.geschSt = location.externalId || null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'kundenNr') && patch.kundenNr !== null) {
    const customerExists = await Kunde.exists({ kundenNr: patch.kundenNr });
    if (!customerExists) throw validationError('Kunde nicht gefunden');
  }
  const effectiveKundenNr = Object.prototype.hasOwnProperty.call(patch, 'kundenNr') ? patch.kundenNr : current.kundenNr;
  const effectiveLocationId = patch.locationV2 || current.locationV2;
  const effectiveCustomer = Number.isInteger(Number(effectiveKundenNr))
    ? await Kunde.findOne({ kundenNr: Number(effectiveKundenNr) }).select('_id locationV2 geschSt').lean()
    : null;
  await assertCustomerMatchesLocation(effectiveCustomer, effectiveLocationId);
  if (Object.prototype.hasOwnProperty.call(patch, 'einsatzort')) {
    const einsatzort = await getEinsatzortForAuftrag(effectiveKundenNr, patch.einsatzort);
    Object.assign(patch, eventAddressFromEinsatzort(einsatzort));
  } else if (Object.prototype.hasOwnProperty.call(patch, 'kundenNr') && Number(patch.kundenNr) !== Number(current.kundenNr)) {
    patch.einsatzort = null;
    patch.eventLocation = '';
    patch.eventStrasse = '';
    patch.eventPlz = '';
    patch.eventOrt = '';
  }
  for (const key of ['excludedTeamleiter', 'statusOverrideTeamleiter']) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    if (!Array.isArray(patch[key]) || patch[key].some(id => !mongoose.isValidObjectId(id))) {
      throw validationError(`${key} muss gültige Mitarbeiter-IDs enthalten`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'labels')) {
    if (!Array.isArray(patch.labels) || patch.labels.some(label => (
      !label?.name || String(label.name).trim().length > 20
    ))) {
      throw validationError('Labels benötigen einen Namen mit maximal 20 Zeichen');
    }
    patch.labels = patch.labels.map(label => ({
      name: String(label.name).trim(),
      color: String(label.color || '#4f46e5').trim(),
    }));
  }

  const effectiveFrom = patch.vonDatum || current.vonDatum;
  const effectiveTo = patch.bisDatum || current.bisDatum;
  if (effectiveFrom && effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) {
    throw validationError('Der Auftragszeitraum ist ungültig');
  }

  const auftrag = await Auftrag.findOneAndUpdate(
    { _id: current._id },
    { $set: patch },
    { new: true, runValidators: true }
  ).populate([
    { path: 'locationV2', select: 'nameFull shortName color externalId', ordered: true },
    { path: 'einsatzort', populate: { path: 'adresse' } },
  ]);

  if (renderContextChanged) {
    const monitorShifts = await Schicht.find({ auftragNr, source: 'monitor' });
    for (const shift of monitorShifts) {
      const existingInformation = shift.einsatzinformation || {};
      shift.einsatzinformation = await renderShiftInformation({
        auftrag: auftrag.toObject(),
        schicht: shift.toObject(),
        sourceHtml: existingInformation.sourceHtml,
        customized: Boolean(existingInformation.customized),
        forceTemplate: templateContextChanged && !existingInformation.customized,
      });
      await shift.save();
    }
  }

  await recordStundenlisteChange(auftragNr, 'Auftragsdaten', getStundenlisteChangeDetails(current, patch));
  logger.info(`Auftrag ${auftragNr} edited by user ${req.user?.id || 'unknown'}: ${Object.keys(patch).join(', ')}`);
  res.json(auftrag);
}));

router.post('/:auftragNr/schichten', auth, withAuftragChronik('Schicht.created', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const auftrag = await Auftrag.findOne({ auftragNr });
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  const input = req.body || {};
  const editableInput = Object.fromEntries(
    Object.entries(input).filter(([key]) => SCHICHT_EDITABLE_FIELDS.has(key))
  );
  if (!String(editableInput.bezeichnung || '').trim()) throw validationError('Eine Schichtbezeichnung ist erforderlich');
  editableInput.datumVon ||= auftrag.vonDatum;
  editableInput.datumBis ||= editableInput.datumVon || auftrag.bisDatum;
  editableInput.bedarf ??= 1;
  const patch = normalizeEditablePatch(editableInput, SCHICHT_EDITABLE_FIELDS);
  if (auftrag.day && require('../../utils/orderDay').dayKey(patch.datumVon) !== auftrag.day) {
    throw validationError('Die Schicht muss am Starttag des Auftrags beginnen');
  }
  const schicht = new Schicht({
    ...patch,
    monitorId: await allocateMonitorIdForAuftrag('schicht', auftrag),
    creationOrigin: 'manual',
    auftragNr,
    locationV2: auftrag.locationV2,
    source: 'monitor',
    createdBy: userId(req),
    idAuftragArbeitsschichten: null,
  });
  schicht.einsatzinformation = await renderShiftInformation({
    auftrag: auftrag.toObject(),
    schicht: schicht.toObject(),
    sourceHtml: input.einsatzinformationSourceHtml,
    customized: input.einsatzinformationCustomized,
    forceTemplate: Boolean(input.applyLatestTemplate),
  });
  await schicht.save();
  await Auftrag.updateOne({ _id: auftrag._id }, { $max: { wizardStep: 2 }, $inc: { planningVersion: 1 } });
  res.status(201).json(schicht);
}));

router.patch('/:auftragNr/schichten/:schichtId', auth, withAuftragChronik('Schicht.updated', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  if (!mongoose.isValidObjectId(req.params.schichtId)) throw validationError('Ungültige Schicht-ID');
  const input = req.body || {};
  const editableInput = Object.fromEntries(
    Object.entries(input).filter(([key]) => SCHICHT_EDITABLE_FIELDS.has(key))
  );
  if (!Object.keys(editableInput).length
    && !Object.prototype.hasOwnProperty.call(input, 'einsatzinformationSourceHtml')
    && !input.applyLatestTemplate) {
    throw validationError('Keine Änderungen übermittelt');
  }
  const patch = Object.keys(editableInput).length
    ? normalizeEditablePatch(editableInput, SCHICHT_EDITABLE_FIELDS)
    : {};
  const [auftrag, current] = await resolveQueries([
    () => Auftrag.findOne({ auftragNr }).lean(),
    () => Schicht.findOne({ _id: req.params.schichtId, auftragNr }),
  ]);
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  if (!current) return res.status(404).json({ message: 'Schicht nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  if (auftrag.day && Object.hasOwn(patch, 'datumVon')
    && require('../../utils/orderDay').dayKey(patch.datumVon) !== auftrag.day) {
    throw validationError('Die Schicht muss am Starttag des Auftrags beginnen');
  }
  const selectionChanged = ['berufSchl', 'qualSchl'].some(key => (
    Object.prototype.hasOwnProperty.call(patch, key)
    && editableValueChanged(key, patch[key], current[key])
  ));
  const confirmationTimeChanged = hasEinsatzTimeChange(patch, current)
    || ['datumVon', 'datumBis'].some(key => Object.hasOwn(patch, key) && editableValueChanged(key, patch[key], current[key]));
  const beforeShift = current.toObject();
  Object.assign(current, patch);
  current.einsatzinformation = await renderShiftInformation({
    auftrag,
    schicht: current.toObject(),
    sourceHtml: input.einsatzinformationSourceHtml,
    customized: input.einsatzinformationCustomized,
    forceTemplate: Boolean(input.applyLatestTemplate || (selectionChanged && !current.einsatzinformation?.customized)),
  });

  const schicht = await current.save();

  const einsatzPatch = {};
  const copiedFields = [
    'treffpunkt', 'treffpunktOrt', 'ansprechpartnerName',
    'ansprechpartnerTelefon', 'ansprechpartnerEmail', 'letzteAusschreibung',
    'uhrzeitVon', 'uhrzeitBis', 'typ', 'bedarf', 'garantiestundenLohn', 'endeOffen', 'berufSchl', 'qualSchl',
  ];
  copiedFields.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) einsatzPatch[key] = patch[key];
  });
  if (Object.prototype.hasOwnProperty.call(patch, 'bezeichnung')) {
    einsatzPatch.schichtBezeichnung = patch.bezeichnung;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'datumVon')) {
    einsatzPatch.datumVon = patch.datumVon;
    einsatzPatch.detailDatumVon = patch.datumVon;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'datumBis')) {
    einsatzPatch.datumBis = patch.datumBis;
    einsatzPatch.detailDatumBis = patch.datumBis;
  }
  if (Object.keys(einsatzPatch).length) {
    await Einsatz.updateMany(
      {
        auftragNr,
        $or: [
          { schicht: schicht._id },
          ...(schicht.idAuftragArbeitsschichten !== null
            ? [{ idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten }]
            : []),
        ],
      },
      { $set: einsatzPatch },
      { runValidators: true }
    );
  }
  if (confirmationTimeChanged) {
    await invalidateForTimeChange({
      auftragNr,
      $or: [
        { schicht: schicht._id },
        ...(schicht.idAuftragArbeitsschichten !== null
          ? [{ idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten }]
          : []),
      ],
    });
  }
  await Auftrag.updateOne({ auftragNr }, { $inc: { planningVersion: 1 } });
  await recordStundenlisteChange(auftragNr, 'Schicht', getStundenlisteChangeDetails(beforeShift, patch));

  logger.info(`Schicht ${schicht._id} in Auftrag ${auftragNr} edited by user ${req.user?.id || 'unknown'}: ${Object.keys(patch).join(', ')}`);
  res.json(schicht);
}));

router.delete('/:auftragNr/schichten/:schichtId', auth, withAuftragChronik('Schicht.deleted', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const rawSchichtId = String(req.params.schichtId || '').trim();
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(rawSchichtId);
  const numericSchichtId = !isObjectId && Number.isFinite(Number(rawSchichtId)) ? Number(rawSchichtId) : null;
  if (!isObjectId && numericSchichtId === null) throw validationError('Ungültige Schicht-ID');

  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });

  const schicht = await Schicht.findOneAndDelete(
    isObjectId
      ? { _id: rawSchichtId, auftragNr }
      : { idAuftragArbeitsschichten: numericSchichtId, auftragNr }
  );

  const einsatzFilter = {
    auftragNr,
    $or: [
      ...(schicht?._id ? [{ schicht: schicht._id }] : []),
      ...(isObjectId ? [{ schicht: rawSchichtId }] : []),
      ...(schicht?.idAuftragArbeitsschichten != null
        ? [{ idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten }]
        : numericSchichtId !== null
          ? [{ idAuftragArbeitsschichten: numericSchichtId }]
          : []),
    ],
  };

  if (!schicht && !einsatzFilter.$or.length) {
    return res.status(404).json({ message: 'Schicht nicht gefunden' });
  }

  if (einsatzFilter.$or.length) {
    const einsaetzeToDelete = await Einsatz.find(einsatzFilter).select('_id').lean();
    const einsatzIds = einsaetzeToDelete.map((e) => e._id);
    if (einsatzIds.length) {
      await DispoEintrag.deleteMany({
        typ: 'einsatz',
        'referenz.einsatzId': { $in: einsatzIds },
      });
      await Einsatz.deleteMany({ _id: { $in: einsatzIds } });
    }
  }

  await Auftrag.updateOne({ auftragNr }, { $inc: { planningVersion: 1 } });
  res.json({ ok: true });
}));

router.get('/:auftragNr/schichten/:schichtId/candidates', auth, asyncHandler(async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  if (!mongoose.isValidObjectId(req.params.schichtId)) throw validationError('Ungültige Schicht-ID');
  const [auftrag, schicht] = await Promise.all([
    Auftrag.findOne({ auftragNr }).lean(),
    Schicht.findOne({ _id: req.params.schichtId, auftragNr }).lean(),
  ]);
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  if (!schicht) return res.status(404).json({ message: 'Schicht nicht gefunden' });
  const candidates = await getStaffingCandidates({
    auftrag,
    schicht,
    includeOtherLocations: req.query.includeOtherLocations === 'true',
  });
  const shiftAssignmentFilter = {
    auftragNr,
    $or: [
      { schicht: schicht._id },
      ...(schicht.idAuftragArbeitsschichten !== null
        ? [{ idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten }]
        : []),
    ],
  };
  const assignedPersonalNumbers = await Einsatz.distinct('personalNr', shiftAssignmentFilter);
  const assignedSet = new Set(assignedPersonalNumbers.map(Number));
  const availableCandidates = candidates.filter(candidate => !(candidate.personalNumbers || [candidate.personalnr])
    .some(number => assignedSet.has(Number(number))));
  res.json({ candidates: availableCandidates, assignmentCount: assignedPersonalNumbers.length, bedarf: schicht.bedarf || 0, planningVersion: auftrag.planningVersion || 0 });
}));

router.put('/:auftragNr/planning', auth, withAuftragChronik('planning.updated', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const expectedVersion = Number(req.body?.planningVersion);
  const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
  if (!Number.isSafeInteger(expectedVersion)) throw validationError('Eine gültige Planungsversion ist erforderlich');
  const [auftrag, schichten] = await resolveQueries([
    () => Auftrag.findOne({ auftragNr }).lean(),
    () => Schicht.find({ auftragNr }).lean(),
  ]);
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  if (Number(auftrag.planningVersion || 0) !== expectedVersion) {
    return res.status(409).json({ code: 'PLANNING_STALE', message: 'Die Planung wurde zwischenzeitlich geändert', planningVersion: auftrag.planningVersion || 0 });
  }
  const shiftById = new Map(schichten.map(shift => [String(shift._id), shift]));
  if (!operations.length) {
    const existingAssignments = await Einsatz.find({ auftragNr, schicht: { $ne: null }, source: 'monitor' }).lean();
    for (const assignment of existingAssignments) {
      const schicht = shiftById.get(String(assignment.schicht));
      if (!schicht) continue;
      const employee = await Mitarbeiter.findOne({
        $or: [
          { personalnr: String(assignment.personalNr) },
          { 'personalnrHistory.value': String(assignment.personalNr) },
        ],
      }).select('_id').lean();
      if (!employee) continue;
      const [candidate] = await getStaffingCandidates({ auftrag, schicht, includeOtherLocations: true, employeeIds: [employee._id] });
      if (!candidate) {
        return res.status(403).json({ message: 'Eine Einplanung liegt außerhalb der freigegebenen Standorte', einsatzId: assignment._id });
      }
      if (!conflictOverrideCovers(assignment.conflictOverride, candidate?.conflicts || [])) {
        return res.status(409).json({
          code: 'PLANNING_CONFLICT',
          message: `${candidate.vorname} ${candidate.nachname} hat einen neuen oder noch nicht bestätigten Planungskonflikt`,
          einsatzId: assignment._id,
          conflicts: candidate.conflicts,
        });
      }
    }
    const validationReservation = await Auftrag.updateOne(
      { _id: auftrag._id, planningVersion: expectedVersion },
      { $inc: { planningVersion: 1 }, $max: { wizardStep: 3 } }
    );
    if (!validationReservation.modifiedCount) {
      return res.status(409).json({ code: 'PLANNING_STALE', message: 'Die Planung wurde während der Prüfung geändert' });
    }
    return res.json({ planningVersion: expectedVersion + 1, assignments: await Einsatz.find({ auftragNr }).lean(), validated: true });
  }
  const prepared = [];
  const assignmentKeys = new Set();

  for (const operation of operations) {
    if (operation.type === 'remove') {
      if (!mongoose.isValidObjectId(operation.einsatzId)) throw validationError('Ungültiger Einsatz in der Planung');
      const exists = await Einsatz.exists({ _id: operation.einsatzId, auftragNr });
      if (!exists) throw validationError('Zu entfernender Einsatz wurde nicht gefunden');
      prepared.push({ type: 'remove', einsatzId: operation.einsatzId });
      continue;
    }
    if (operation.type !== 'assign' || !mongoose.isValidObjectId(operation.schichtId) || !mongoose.isValidObjectId(operation.mitarbeiterId)) {
      throw validationError('Ungültige Planungsänderung');
    }
    const schicht = shiftById.get(String(operation.schichtId));
    if (!schicht) throw validationError('Schicht der Planungsänderung wurde nicht gefunden');
    const mitarbeiter = await Mitarbeiter.findById(operation.mitarbeiterId).lean();
    if (!mitarbeiter) throw validationError('Mitarbeiter der Planungsänderung wurde nicht gefunden');
    const personalNr = Number.parseInt(mitarbeiter.personalnr, 10);
    const assignmentKey = `${schicht._id}:${personalNr}`;
    if (!Number.isInteger(personalNr) || assignmentKeys.has(assignmentKey)) throw validationError('Doppelte Einplanung in derselben Schicht');
    assignmentKeys.add(assignmentKey);
    const duplicate = await Einsatz.exists({ auftragNr, personalNr: { $in: employeePersonalNumbers(mitarbeiter) }, schicht: schicht._id });
    if (duplicate) return res.status(409).json({ message: 'Mitarbeiter ist bereits in dieser Schicht eingeplant' });
    const [candidate] = await getStaffingCandidates({
      auftrag,
      schicht,
      includeOtherLocations: Boolean(req.body?.includeOtherLocations),
      employeeIds: [mitarbeiter._id],
      ...(req.editorScheduling || {}),
    });
    if (!candidate) return res.status(403).json({ message: 'Mitarbeiter liegt außerhalb der freigegebenen Standorte' });
    const override = operation.conflictOverride || {};
    if (!conflictOverrideCovers(override, candidate.conflicts)) {
      return res.status(409).json({ code: 'PLANNING_CONFLICT', message: 'Konflikte müssen bestätigt und begründet werden', operation, conflicts: candidate.conflicts });
    }
    prepared.push({ type: 'assign', schicht, personalNr, conflicts: candidate.conflicts, override });
  }

  const versionReservation = await Auftrag.updateOne(
    { _id: auftrag._id, planningVersion: expectedVersion },
    { $inc: { planningVersion: 1 }, $max: { wizardStep: 3 } }
  );
  if (!versionReservation.modifiedCount) {
    return res.status(409).json({ code: 'PLANNING_STALE', message: 'Die Planung wurde zwischenzeitlich geändert' });
  }
  for (const operation of prepared) {
    if (operation.type === 'remove') {
      await Einsatz.deleteOne({ _id: operation.einsatzId, auftragNr });
      continue;
    }
    const { schicht } = operation;
    await Einsatz.create({
      monitorId: await allocateMonitorIdForAuftrag('einsatz', auftrag),
      creationOrigin: 'manual',
      auftragNr,
      locationV2: auftrag.locationV2 || null,
      schicht: schicht._id,
      source: 'monitor',
      plannedBy: userId(req),
      bestaetigungErforderlich: true,
      bestaetigt: false,
      personalNr: operation.personalNr,
      idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten,
      schichtBezeichnung: schicht.bezeichnung,
      datumVon: schicht.datumVon || auftrag.vonDatum,
      datumBis: schicht.datumBis || auftrag.bisDatum,
      detailDatumVon: schicht.datumVon,
      detailDatumBis: schicht.datumBis,
      uhrzeitVon: schicht.uhrzeitVon,
      uhrzeitBis: schicht.uhrzeitBis,
      day: schicht.day,
      endDayOffset: schicht.endDayOffset,
      editorConflictKey: req.editorConflictKey,
      treffpunkt: schicht.treffpunkt,
      treffpunktOrt: schicht.treffpunktOrt,
      ansprechpartnerName: schicht.ansprechpartnerName,
      ansprechpartnerTelefon: schicht.ansprechpartnerTelefon,
      ansprechpartnerEmail: schicht.ansprechpartnerEmail,
      berufSchl: schicht.berufSchl,
      qualSchl: schicht.qualSchl,
      isPseudo: Boolean(auftrag.isPseudo),
      conflictOverride: operation.conflicts.length ? {
        confirmed: true,
        reason: String(operation.override.reason).trim(),
        confirmedBy: userId(req),
        confirmedAt: new Date(),
        conflicts: operation.conflicts,
      } : undefined,
    });
  }
  const assignments = await Einsatz.find({ auftragNr }).lean();
  res.json({ planningVersion: expectedVersion + 1, assignments });
}));

router.post('/:auftragNr/release', auth, withAuftragChronik('Auftrag.released', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const [auftrag, schichten] = await resolveQueries([
    () => Auftrag.findOne({ auftragNr }),
    () => Schicht.find({ auftragNr }).lean(),
  ]);
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  if (!auftrag.isPseudo) {
    if (!auftrag.einsatzort) throw validationError('Ein gespeicherter Kunden-Einsatzort ist erforderlich');
    await getEinsatzortForAuftrag(auftrag.kundenNr, auftrag.einsatzort);
    if ((auftrag.einsatzdokumente || []).some(document => document.uploadStatus === 'pending')) {
      return res.status(409).json({ code: 'DOCUMENTS_PENDING', message: 'Dokument-Uploads sind noch nicht abgeschlossen' });
    }
    if (auftrag.auftragsgruppe) {
      const group = await require('../../models/Event/Auftragsgruppe').findById(auftrag.auftragsgruppe).lean();
      if (group?.status !== 'completed' || group.einsatzdokumente?.some(document => document.uploadStatus === 'pending')) {
        return res.status(409).json({ code: 'GROUP_PENDING', message: 'Die Auftragsgruppe oder ihre Dokumente sind noch unvollständig' });
      }
    }
  }
  await assertOrderHasLocation(req, auftrag);
  const errors = validateAuftragRelease(auftrag, schichten);
  const shiftById = new Map(schichten.map(shift => [String(shift._id), shift]));
  const plannedAssignments = await Einsatz.find({ auftragNr, source: 'monitor', schicht: { $ne: null } }).lean();
  for (const assignment of plannedAssignments) {
    const shift = shiftById.get(String(assignment.schicht));
    if (!shift) continue;
    const employee = await Mitarbeiter.findOne({
      $or: [
        { personalnr: String(assignment.personalNr) },
        { 'personalnrHistory.value': String(assignment.personalNr) },
      ],
    }).select('_id vorname nachname').lean();
    if (!employee) {
      errors.push({ step: 3, field: `einsatz-${assignment._id}`, message: `Personal ${assignment.personalNr} konnte nicht mehr aufgelöst werden` });
      continue;
    }
    const [candidate] = await getStaffingCandidates({ auftrag: auftrag.toObject(), schicht: shift, includeOtherLocations: true, employeeIds: [employee._id] });
    if (!candidate) {
      errors.push({ step: 3, field: `einsatz-${assignment._id}`, message: `${employee.vorname} ${employee.nachname} liegt außerhalb der freigegebenen Standorte` });
    } else if (!conflictOverrideCovers(assignment.conflictOverride, candidate.conflicts || [])) {
      errors.push({ step: 3, field: `einsatz-${assignment._id}`, message: `${employee.vorname} ${employee.nachname}: Neuer oder unbestätigter Planungskonflikt` });
    }
  }
  if (errors.length) return res.status(422).json({ code: 'RELEASE_VALIDATION', message: 'Der Auftrag kann noch nicht freigegeben werden', errors });
  const released = await Auftrag.findOneAndUpdate(
    { _id: auftrag._id, planningVersion: auftrag.planningVersion || 0 },
    { $set: { auftStatus: 2, wizardStep: 4, wizardCompletedAt: new Date() } },
    { new: true, runValidators: true }
  );
  if (!released) return res.status(409).json({ code: 'PLANNING_STALE', message: 'Die Planung wurde während der Freigabe geändert' });
  res.json({ ok: true, auftrag: released });
}));

router.post('/:auftragNr/einsaetze', auth, withAuftragChronik('Einsatz.created', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const { mitarbeiterId, schichtId } = req.body || {};
  if (!mongoose.isValidObjectId(mitarbeiterId)) throw validationError('Ungültige Mitarbeiter-ID');
  if (!mongoose.isValidObjectId(schichtId)) throw validationError('Ungültige Schicht-ID');

  const [auftrag, mitarbeiter, schicht] = await resolveQueries([
    () => Auftrag.findOne({ auftragNr }).lean(),
    () => Mitarbeiter.findById(mitarbeiterId).lean(),
    () => Schicht.findOne({ _id: schichtId, auftragNr }).lean(),
  ]);
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  if (!mitarbeiter) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
  if (!schicht) return res.status(404).json({ message: 'Schicht nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);

  const personalNr = Number.parseInt(mitarbeiter.personalnr, 10);
  if (!Number.isInteger(personalNr)) throw validationError('Mitarbeiter hat keine gültige Personalnummer');
  const duplicate = await Einsatz.exists({
    auftragNr,
    personalNr: { $in: employeePersonalNumbers(mitarbeiter) },
    $or: [
      { schicht: schicht._id },
      ...(schicht.idAuftragArbeitsschichten !== null
        ? [{ idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten }]
        : []),
    ],
  });
  if (duplicate) return res.status(409).json({ message: 'Mitarbeiter ist bereits in dieser Schicht eingeplant' });

  const [candidate] = await getStaffingCandidates({
    auftrag,
    schicht,
    includeOtherLocations: Boolean(req.body?.includeOtherLocations),
    employeeIds: [mitarbeiter._id],
  });
  if (!candidate) return res.status(403).json({ message: 'Mitarbeiter liegt außerhalb der freigegebenen Standorte' });
  const override = req.body?.conflictOverride || {};
  if (candidate.conflicts.length && (!override.confirmed || !String(override.reason || '').trim())) {
    return res.status(409).json({
      message: 'Die Einplanung enthält Konflikte und benötigt Bestätigung sowie Begründung',
      code: 'PLANNING_CONFLICT',
      conflicts: candidate.conflicts,
    });
  }

  const einsatz = await Einsatz.create({
    monitorId: await allocateMonitorIdForAuftrag('einsatz', auftrag),
    creationOrigin: 'manual',
    auftragNr,
    locationV2: auftrag.locationV2 || null,
    schicht: schicht._id,
    source: 'monitor',
    plannedBy: userId(req),
    bestaetigungErforderlich: true,
    bestaetigt: false,
    personalNr,
    idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten,
    schichtBezeichnung: schicht.bezeichnung,
    datumVon: schicht.datumVon || auftrag.vonDatum,
    datumBis: schicht.datumBis || auftrag.bisDatum,
    detailDatumVon: schicht.datumVon,
    detailDatumBis: schicht.datumBis,
    uhrzeitVon: schicht.uhrzeitVon,
    uhrzeitBis: schicht.uhrzeitBis,
    treffpunkt: schicht.treffpunkt,
    treffpunktOrt: schicht.treffpunktOrt,
    ansprechpartnerName: schicht.ansprechpartnerName,
    ansprechpartnerTelefon: schicht.ansprechpartnerTelefon,
    ansprechpartnerEmail: schicht.ansprechpartnerEmail,
    typ: schicht.typ,
    bedarf: schicht.bedarf,
    garantiestundenLohn: schicht.garantiestundenLohn,
    endeOffen: schicht.endeOffen,
    isPseudo: Boolean(auftrag.isPseudo),
    conflictOverride: candidate.conflicts.length ? {
      confirmed: true,
      reason: String(override.reason).trim(),
      confirmedBy: userId(req),
      confirmedAt: new Date(),
      conflicts: candidate.conflicts,
    } : undefined,
  });

  await Auftrag.updateOne({ _id: auftrag._id }, { $inc: { planningVersion: 1 }, $max: { wizardStep: 3 } });

  logger.info(`Einsatz ${einsatz._id} created in Auftrag ${auftragNr} by user ${req.user?.id || 'unknown'}`);
  res.status(201).json(einsatz);
}));

router.patch('/:auftragNr/einsaetze/:einsatzId', auth, withAuftragChronik('Einsatz.updated', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  if (!mongoose.isValidObjectId(req.params.einsatzId)) throw validationError('Ungültige Einsatz-ID');
  const patch = normalizeEditablePatch(req.body, EINSATZ_EDITABLE_FIELDS);
  const mitarbeiterId = patch.mitarbeiterId;
  delete patch.mitarbeiterId;

  if (mitarbeiterId !== undefined) {
    if (!mongoose.isValidObjectId(mitarbeiterId)) throw validationError('Ungültige Mitarbeiter-ID');
    const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId).lean();
    if (!mitarbeiter) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
    patch.personalNr = Number.parseInt(mitarbeiter.personalnr, 10);
    if (!Number.isInteger(patch.personalNr)) throw validationError('Mitarbeiter hat keine gültige Personalnummer');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'idAuftragArbeitsschichten')) {
    const targetShift = await Schicht.findOne({
      auftragNr,
      idAuftragArbeitsschichten: patch.idAuftragArbeitsschichten,
    }).lean();
    if (!targetShift) throw validationError('Zielschicht nicht gefunden');

    const targetShiftFields = {
      locationV2: targetShift.locationV2,
      schichtBezeichnung: targetShift.bezeichnung,
      datumVon: targetShift.datumVon,
      datumBis: targetShift.datumBis,
      detailDatumVon: targetShift.datumVon,
      detailDatumBis: targetShift.datumBis,
      uhrzeitVon: targetShift.uhrzeitVon,
      uhrzeitBis: targetShift.uhrzeitBis,
      treffpunkt: targetShift.treffpunkt,
      treffpunktOrt: targetShift.treffpunktOrt,
      ansprechpartnerName: targetShift.ansprechpartnerName,
      ansprechpartnerTelefon: targetShift.ansprechpartnerTelefon,
      ansprechpartnerEmail: targetShift.ansprechpartnerEmail,
      typ: targetShift.typ,
      bedarf: targetShift.bedarf,
      garantiestundenLohn: targetShift.garantiestundenLohn,
      endeOffen: targetShift.endeOffen,
    };
    Object.entries(targetShiftFields).forEach(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(patch, key) && value !== undefined) patch[key] = value;
    });
  }

  const current = await Einsatz.findOne({ _id: req.params.einsatzId, auftragNr }).lean();
  if (!current) return res.status(404).json({ message: 'Einsatz nicht gefunden' });
  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  const isStundenlisteInclusionOnly = Object.keys(patch).length === 1 && Object.hasOwn(patch, 'stundenlisteIncluded');
  if (!isStundenlisteInclusionOnly) {
    await assertOrderHasLocation(req, auftrag);
  }
  const confirmationTimeChanged = hasEinsatzTimeChange(patch, current);
  if (Object.hasOwn(patch, 'personalNr') || Object.hasOwn(patch, 'idAuftragArbeitsschichten')) {
    const personalNr = patch.personalNr ?? current.personalNr;
    const shiftKey = patch.idAuftragArbeitsschichten ?? current.idAuftragArbeitsschichten;
    const duplicate = await Einsatz.exists({
      _id: { $ne: current._id },
      auftragNr,
      personalNr,
      idAuftragArbeitsschichten: shiftKey,
    });
    if (duplicate) return res.status(409).json({ message: 'Mitarbeiter ist bereits in dieser Schicht eingeplant' });
  }

  const einsatz = await Einsatz.findByIdAndUpdate(
    current._id,
    { $set: patch },
    { new: true, runValidators: true }
  );
  if (confirmationTimeChanged) await invalidateForTimeChange({ _id: current._id });
  await Auftrag.updateOne({ auftragNr }, { $inc: { planningVersion: 1 } });
  await recordStundenlisteChange(auftragNr, 'Einsatz', getStundenlisteChangeDetails(current, patch));
  logger.info(`Einsatz ${einsatz._id} in Auftrag ${auftragNr} edited by user ${req.user?.id || 'unknown'}: ${Object.keys(patch).join(', ')}`);
  res.json(einsatz);
}));

router.delete('/:auftragNr/einsaetze/:einsatzId', auth, withAuftragChronik('Einsatz.deleted', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  if (!mongoose.isValidObjectId(req.params.einsatzId)) throw validationError('Ungültige Einsatz-ID');
  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  const einsatz = await Einsatz.findOneAndDelete({ _id: req.params.einsatzId, auftragNr });
  if (!einsatz) return res.status(404).json({ message: 'Einsatz nicht gefunden' });
  await DispoEintrag.deleteMany({
    typ: 'einsatz',
    'referenz.einsatzId': einsatz._id,
  });
  await JobBewerbung.updateMany(
    { einsatz: einsatz._id },
    { $set: { einsatz: null } }
  );
  await Auftrag.updateOne({ auftragNr }, { $inc: { planningVersion: 1 } });

  logger.info(`Einsatz ${einsatz._id} deleted from Auftrag ${auftragNr} by user ${req.user?.id || 'unknown'}`);
  res.json({ ok: true });
}));

// DELETE /api/auftraege/:auftragNr/pseudo-schicht/:schichtId – Delete a pseudo-shift and its Einsätze
router.delete('/:auftragNr/pseudo-schicht/:schichtId', auth, withAuftragChronik('Schicht.deleted', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const rawSchichtId = String(req.params.schichtId || '').trim();
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(rawSchichtId);
  const numericSchichtId = !isObjectId && Number.isFinite(Number(rawSchichtId)) ? Number(rawSchichtId) : null;
  if (!isObjectId && numericSchichtId === null) throw validationError('Ungültige Schicht-ID');

  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });

  const schicht = await Schicht.findOneAndDelete(
    isObjectId
      ? { _id: rawSchichtId, auftragNr }
      : { idAuftragArbeitsschichten: numericSchichtId, auftragNr }
  );

  const einsatzFilter = {
    auftragNr,
    $or: [
      ...(schicht?._id ? [{ schicht: schicht._id }] : []),
      ...(isObjectId ? [{ schicht: rawSchichtId }] : []),
      ...(schicht?.idAuftragArbeitsschichten != null
        ? [{ idAuftragArbeitsschichten: schicht.idAuftragArbeitsschichten }]
        : numericSchichtId !== null
          ? [{ idAuftragArbeitsschichten: numericSchichtId }]
          : []),
    ],
  };

  if (!schicht && !einsatzFilter.$or.length) {
    return res.status(404).json({ message: 'Schicht nicht gefunden' });
  }

  if (einsatzFilter.$or.length) {
    const einsaetzeToDelete = await Einsatz.find(einsatzFilter).select('_id').lean();
    const einsatzIds = einsaetzeToDelete.map((e) => e._id);
    if (einsatzIds.length) {
      await DispoEintrag.deleteMany({
        typ: 'einsatz',
        'referenz.einsatzId': { $in: einsatzIds },
      });
      await JobBewerbung.updateMany(
        { einsatz: { $in: einsatzIds } },
        { $set: { einsatz: null } }
      );
      await Einsatz.deleteMany({ _id: { $in: einsatzIds } });
    }
  }

  await Auftrag.updateOne({ auftragNr }, { $inc: { planningVersion: 1 } });
  res.json({ ok: true });
}));

// DELETE /api/auftraege/:auftragNr/pseudo-einsatz/:einsatzId – Remove a pseudo-Einsatz
router.delete('/:auftragNr/pseudo-einsatz/:einsatzId', auth, withAuftragChronik('Einsatz.deleted', async (req, res) => {
  const auftragNr = parseAuftragNr(req.params.auftragNr);
  const { einsatzId } = req.params;
  if (!mongoose.isValidObjectId(einsatzId)) throw validationError('Ungültige Einsatz-ID');
  const auftrag = await Auftrag.findOne({ auftragNr }).lean();
  if (!auftrag) return res.status(404).json({ message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  const einsatz = await Einsatz.findOne({ _id: einsatzId, auftragNr, isPseudo: true });
  if (!einsatz) return res.status(404).json({ message: 'Pseudo-Einsatz nicht gefunden' });
  await einsatz.deleteOne();
  await DispoEintrag.deleteMany({
    typ: 'einsatz',
    'referenz.einsatzId': einsatz._id,
  });
  await JobBewerbung.updateMany(
    { einsatz: einsatz._id },
    { $set: { einsatz: null } }
  );
  await Auftrag.updateOne({ auftragNr }, { $inc: { planningVersion: 1 } });
  res.json({ ok: true });
}));

// ── Einsatzdokumente (R2 file storage per Auftrag) ────────────────────────────

// GET /api/auftraege/:auftragNr/einsatzdokumente
router.get('/:auftragNr/einsatzdokumente', auth, asyncHandler(async (req, res) => {
  const { auftragNr } = req.params;
  const auftrag = await Auftrag.findOne({ auftragNr: parseAuftragNr(auftragNr) }).lean();
  if (!auftrag) return res.status(404).json({ success: false, message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  const knownDocuments = auftrag.einsatzdokumente || [];
  const knownKeys = new Set(knownDocuments.map(document => document.key));
  const prefix = EINSATZ_DOK_PREFIX(auftragNr);
  const legacyDocuments = (await R2Service.listObjects(prefix))
    .filter(object => object.Key !== prefix && !knownKeys.has(object.Key))
    .map(object => ({
      _id: new mongoose.Types.ObjectId(),
      key: object.Key,
      filename: object.Key.slice(prefix.length),
      size: object.Size || 0,
      mimeType: 'application/octet-stream',
      audience: 'office',
      berufKeys: [],
      allowedRoles: [],
      uploadedAt: object.LastModified || new Date(),
    }));
  if (legacyDocuments.length) {
    await Auftrag.updateOne({ _id: auftrag._id }, { $push: { einsatzdokumente: { $each: legacyDocuments } } });
  }
  const documents = await Promise.all([...(await documentsForOrder(auftrag)), ...legacyDocuments].map(async (document) => (
    (await canAccessOfficeDocument(document, req.user)) ? document : null
  )));
  const docs = documents.filter(Boolean);
  res.json({ success: true, data: docs });
}));

// GET /api/auftraege/:auftragNr/einsatzdokumente/:documentId/download
router.get('/:auftragNr/einsatzdokumente/:documentId/download', auth, asyncHandler(async (req, res) => {
  const auftrag = await Auftrag.findOne({ auftragNr: parseAuftragNr(req.params.auftragNr) }).lean();
  if (!auftrag) return res.status(404).json({ success: false, message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  const document = (await documentsForOrder(auftrag)).find(item => String(item._id) === req.params.documentId);
  if (!document || !(await canAccessOfficeDocument(document, req.user))) {
    return res.status(404).json({ success: false, message: 'Dokument nicht gefunden' });
  }
  const url = await R2Service.getSignedDownloadUrl(document.key, 300, { inline: true });
  res.json({ success: true, data: { url } });
}));

// POST /api/auftraege/:auftragNr/einsatzdokumente
router.post('/:auftragNr/einsatzdokumente', auth, uploadMem.single('file'), asyncHandler(async (req, res) => {
  const { auftragNr } = req.params;
  if (!req.file) return res.status(400).json({ success: false, message: 'Keine Datei übermittelt' });
  const auftrag = await Auftrag.findOne({ auftragNr: parseAuftragNr(auftragNr) }).lean();
  if (!auftrag) return res.status(404).json({ success: false, message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);

  // Sanitise filename to prevent path traversal
  const safeName = req.file.originalname.replace(/[/\\:*?"<>|]/g, '_');
  const title = String(req.body.title || '').trim();
  if (title.length > 200) return res.status(400).json({ success: false, message: 'Die Bezeichnung ist zu lang' });
  const scope = normalizeDocumentScope(req.body.scope);
  const publicEinsatzIds = normalizeObjectIdList(req.body.publicEinsatzIds);
  const publicSchichtIds = normalizeStringList(req.body.publicSchichtIds);
  const rawRecipientFilter = scope === 'public' && String(req.body.publicRecipientFilter) === 'true';
  const publicRecipientRule = scope === 'public'
    ? normalizePublicRecipientRule(req.body.publicRecipientRule, rawRecipientFilter)
    : 'all';
  const publicRecipientFilter = scope === 'public' && (rawRecipientFilter || publicRecipientRule !== 'all');
  const type = scope === 'monitor' ? String(req.body.type || 'einsatznachweis').trim().toLowerCase() : null;
  if (scope === 'monitor' && !EINSATZ_DOK_TYPES.has(type)) {
    return res.status(400).json({ success: false, message: 'Ungültiger Dokumenttyp' });
  }
  const relationTarget = String(req.body.relationTarget || 'order');
  const { model, owner, prefix } = await documentOwner(auftrag, relationTarget);
  if ((type === 'bestellung' && scope !== 'monitor') || (req.body.type === 'bestellung' && scope !== 'monitor')
    || (relationTarget === 'group' && (type !== 'bestellung' || scope !== 'monitor'))) {
    throw validationError('Bestellungen und Gruppendokumente sind ausschließlich interne Office-Dokumente');
  }
  const clientUploadId = String(req.body.clientUploadId || '').trim();
  if (clientUploadId.length > 200) throw validationError('Die Upload-ID ist zu lang');
  await authorizeDocumentMutation(auftrag, owner, relationTarget, userId(req),
    { clientUploadId, filename: safeName, size: req.file.size, type });
  const uploadHash = crypto.createHash('sha256').update(req.file.buffer)
    .update(JSON.stringify({ safeName, title, type, scope, relationTarget })).digest('hex');
  let previous = clientUploadId ? owner.einsatzdokumente?.find(doc => doc.clientUploadId === clientUploadId) : null;
  if (previous && previous.uploadHash !== uploadHash) return res.status(409).json({
    code: 'UPLOAD_IDEMPOTENCY_CONFLICT', message: 'Diese Upload-ID wurde für eine andere Datei verwendet' });
  if (previous?.uploadStatus === 'ready') return res.json({ success: true, data: serializeEinsatzDokument(previous) });
  const documentId = previous?._id || new mongoose.Types.ObjectId();
  const key = previous?.key || `${prefix}${documentId}-${safeName}`;
  if (scope !== 'public' && (publicEinsatzIds.length || publicSchichtIds.length || rawRecipientFilter || req.body.publicRecipientRule)) {
    return res.status(400).json({ success: false, message: 'Empfänger können nur für Public-Monitor-Dokumente gewählt werden' });
  }
  if (publicRecipientFilter && publicEinsatzIds.length) {
    const assignments = await Einsatz.find({
      _id: { $in: publicEinsatzIds },
      auftragNr: parseAuftragNr(auftragNr),
    }).select('_id').lean();
    if (assignments.length !== publicEinsatzIds.length) {
      return res.status(400).json({ success: false, message: 'Die Empfängerauswahl enthält keine Einsätze dieses Auftrags' });
    }
  }

  const document = {
    _id: documentId,
    key,
    filename: safeName,
    title,
    size: req.file.size,
    mimeType: req.file.mimetype,
    scope,
    type,
    publicEinsatzIds: scope === 'public' && publicRecipientRule === 'individual' ? publicEinsatzIds : [],
    publicSchichtIds: scope === 'public' && publicRecipientRule === 'individual' ? publicSchichtIds : [],
    publicRecipientFilter,
    publicRecipientRule,
    audience: scope === 'public' ? (publicRecipientRule === 'teamleiter' ? 'teamleiter' : 'job') : 'office',
    berufKeys: [],
    allowedRoles: [],
    uploadedBy: req.user?._id || req.user?.id || null,
    uploadedAt: new Date(),
    relationTarget,
    clientUploadId: clientUploadId || undefined,
    uploadHash,
    uploadStatus: 'pending',
  };
  if (!previous) {
    const reservation = await model.updateOne({ _id: owner._id,
      ...(clientUploadId ? { 'einsatzdokumente.clientUploadId': { $ne: clientUploadId } } : {}) },
    { $push: { einsatzdokumente: document } });
    if (!reservation.modifiedCount && clientUploadId) {
      const refreshed = await model.findById(owner._id).lean();
      previous = refreshed.einsatzdokumente.find(doc => doc.clientUploadId === clientUploadId);
      if (!previous || previous.uploadHash !== uploadHash) return res.status(409).json({
        code: 'UPLOAD_IDEMPOTENCY_CONFLICT', message: 'Diese Upload-ID wurde für eine andere Datei verwendet' });
      if (previous.uploadStatus === 'ready') return res.json({ success: true, data: serializeEinsatzDokument(previous) });
      // A concurrent reservation owns the key. A retry uses it, never creates a second binary/metadata owner.
      return res.status(409).json({ code: 'UPLOAD_PENDING', message: 'Dieser Upload ist bereits vorgemerkt. Bitte erneut versuchen.' });
    }
  }
  await R2Service.uploadFile(key, req.file.buffer, req.file.mimetype);
  await model.updateOne({ _id: owner._id, 'einsatzdokumente._id': documentId },
    { $set: { 'einsatzdokumente.$.uploadStatus': 'ready' } });
  document.uploadStatus = 'ready';

  logger.info(`Einsatzdok uploaded: ${key} (${req.file.size} bytes) by user ${req.user?.id}`);
  res.json({ success: true, data: serializeEinsatzDokument(document) });
}));

// DELETE /api/auftraege/:auftragNr/einsatzdokumente
// Body: { key } — the full R2 key of the file to remove
router.delete('/:auftragNr/einsatzdokumente/:documentId', auth, asyncHandler(async (req, res) => {
  const { auftragNr } = req.params;
  const auftrag = await Auftrag.findOne({ auftragNr: parseAuftragNr(auftragNr) }).lean();
  if (!auftrag) return res.status(404).json({ success: false, message: 'Auftrag nicht gefunden' });
  await assertOrderHasLocation(req, auftrag);
  const document = (await documentsForOrder(auftrag)).find(item => String(item._id) === req.params.documentId);
  if (!document || !(await canAccessOfficeDocument(document, req.user))) {
    return res.status(404).json({ success: false, message: 'Dokument nicht gefunden' });
  }
  if (document.relationTarget === 'group' && (req.body?.relationTarget || req.query.relationTarget) !== 'group') {
    return res.status(409).json({ code: 'GROUP_DOCUMENT_SCOPE_REQUIRED',
      message: 'Das gemeinsame Dokument kann nur ausdrücklich für die gesamte Gruppe gelöscht werden.' });
  }
  const { model, owner } = await documentOwner(auftrag, document.relationTarget);
  await authorizeDocumentMutation(auftrag, owner, document.relationTarget, userId(req));
  await R2Service.deleteFile(document.key);
  await model.updateOne({ _id: owner._id }, { $pull: { einsatzdokumente: { _id: document._id } } });
  res.json({ success: true });
}));

module.exports = router;
