const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const multer = require('multer');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const Lead = require('../models/Lead');
const LeadLabel = require('../models/LeadLabel');
const LeadConfig = require('../models/LeadConfig');
const User = require('../models/User');
const Comment = require('../models/Comment');
const R2Service = require('../R2Service');
const registry = require('../config/registry');
const { createSalesTask, updateTask } = require('../AsanaService');

// Multer — memory storage, max 25 MB per file, up to 20 files per request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ─── Label maps for human-readable system events ────────────────────
const STUFE_LABELS = {
  neu: 'Neu', qualifiziert: 'Qualifiziert', angebot: 'Angebot',
  verhandlung: 'Verhandlung', gewonnen: 'Gewonnen', verloren: 'Verloren',
};
const STATUS_LABELS = {
  open: 'Offen', won: 'Gewonnen', lost: 'Verloren', archived: 'Archiviert',
};
const QUELLE_LABELS = {
  web: 'Web', messe: 'Messe', empfehlung: 'Empfehlung',
  kaltakquise: 'Kaltakquise', social_media: 'Social Media', sonstiges: 'Sonstiges',
};

// ─── Create a system event in the lead chronik ──────────────────────
async function createChronikEvent(leadId, authorId, authorName, text) {
  try {
    await Comment.create({
      scope: 'lead_chronik',
      text,
      author: authorName,
      authorId,
      readBy: [authorId],
      isSystem: true,
      context: { resourceId: leadId, resourceType: 'Lead' },
    });
  } catch (_) {
    // Non-critical — don't block main flow
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert a display name to a URL-safe key slug.
 * e.g. "Unternehmensgröße" → "unternehmensgroesse"
 */
function nameToKey(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 60);
}

// ──────────────────────────────────────────────────────────────────────────────
// LeadConfig routes  →  /api/leads/config
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  quelleOptions: [
    { label: 'Web', value: 'web' },
    { label: 'Messe', value: 'messe' },
    { label: 'Empfehlung', value: 'empfehlung' },
    { label: 'Kaltakquise', value: 'kaltakquise' },
    { label: 'Social Media', value: 'social_media' },
    { label: 'Sonstiges', value: 'sonstiges' },
  ],
  currencies: ['EUR', 'USD', 'GBP', 'CHF'],
};

// @route   GET /api/leads/config
// @desc    Lead module config (quelle options, currencies) abrufen
// @access  Private
router.get('/config', auth, asyncHandler(async (req, res) => {
  let config = await LeadConfig.findOne();
  if (!config) {
    config = await LeadConfig.create(DEFAULT_CONFIG);
  }
  res.json(config);
}));

// @route   PUT /api/leads/config
// @desc    Lead module config aktualisieren
// @access  Private
router.put('/config', auth, asyncHandler(async (req, res) => {
  const { quelleOptions, currencies } = req.body;

  // Basic validation
  if (!Array.isArray(quelleOptions) || !Array.isArray(currencies)) {
    return res.status(400).json({ msg: 'quelleOptions und currencies müssen Arrays sein.' });
  }
  for (const opt of quelleOptions) {
    if (!opt.label || !opt.value) return res.status(400).json({ msg: 'Jede quelleOption braucht label und value.' });
    if (!/^[a-z0-9_]+$/.test(opt.value)) return res.status(400).json({ msg: `Ungültiger value: "${opt.value}". Nur Kleinbuchstaben, Zahlen und _ erlaubt.` });
  }
  for (const c of currencies) {
    if (!/^[A-Z]{3}$/.test(c.toUpperCase())) return res.status(400).json({ msg: `Ungültige Währung: "${c}".` });
  }

  const config = await LeadConfig.findOneAndUpdate(
    {},
    { quelleOptions, currencies: currencies.map(c => c.toUpperCase()) },
    { new: true, upsert: true, runValidators: false }
  );
  res.json(config);
}));

// ──────────────────────────────────────────────────────────────────────────────
// LeadLabel routes  →  /api/leads/labels/...
// ──────────────────────────────────────────────────────────────────────────────

// @route   GET /api/leads/labels
// @desc    Alle aktiven Custom-Field-Definitionen abrufen
// @access  Private
router.get('/labels', auth, asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const filter = includeInactive === 'true' ? {} : { isActive: true };
  const labels = await LeadLabel.find(filter)
    .populate('createdBy', 'name email')
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  res.json(labels);
}));

// @route   POST /api/leads/labels
// @desc    Neues Custom Field definieren
// @access  Private
router.post('/labels', auth, asyncHandler(async (req, res) => {
  const { name, fieldType = 'text', options = [], required = false, sortOrder = 0 } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: '"name" ist erforderlich.' });
  }
  if (!['text', 'number', 'currency', 'date', 'checkbox', 'dropdown', 'multiselect', 'phone', 'email', 'url', 'address'].includes(fieldType)) {
    return res.status(400).json({ message: 'Ungültiger fieldType.' });
  }

  // Generate unique key — append suffix if collision
  let key = nameToKey(name.trim());
  if (!key) return res.status(400).json({ message: 'Name ergibt keinen gültigen Schlüssel.' });

  const existing = await LeadLabel.findOne({ key }).lean();
  if (existing) key = `${key}_${Date.now().toString(36)}`;

  const label = new LeadLabel({
    name: name.trim(),
    key,
    fieldType,
    options,
    required,
    sortOrder,
    createdBy: req.user.id,
  });

  await label.save();
  res.status(201).json(label);
}));

// @route   PATCH /api/leads/labels/:id
// @desc    Custom Field aktualisieren (Name, Optionen, Reihenfolge, aktiv/inaktiv)
// @access  Private
router.patch('/labels/:id', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const allowed = ['name', 'fieldType', 'options', 'required', 'isActive', 'sortOrder'];
  const update = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }

  if (update.fieldType && !['text', 'number', 'currency', 'date', 'checkbox', 'dropdown', 'multiselect', 'phone', 'email', 'url', 'address'].includes(update.fieldType)) {
    return res.status(400).json({ message: 'Ungültiger fieldType.' });
  }

  const label = await LeadLabel.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  if (!label) return res.status(404).json({ message: 'Custom Field nicht gefunden.' });
  res.json(label);
}));

// @route   DELETE /api/leads/labels/:id
// @desc    Custom Field deaktivieren (Soft-Delete)
// @access  Private
router.delete('/labels/:id', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const label = await LeadLabel.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true }
  ).lean();

  if (!label) return res.status(404).json({ message: 'Custom Field nicht gefunden.' });
  res.json({ message: 'Custom Field deaktiviert.', label });
}));

// ──────────────────────────────────────────────────────────────────────────────
// Lead routes  →  /api/leads/...
// ──────────────────────────────────────────────────────────────────────────────

// @route   GET /api/leads
// @desc    Leads abrufen (mit Filtern: status, stufe, eigentuemer, quelle)
// @access  Private
router.get('/', auth, asyncHandler(async (req, res) => {
  const { status, stufe, eigentuemer, quelle, search } = req.query;
  const filter = {};

  if (status)      filter.status = status;
  if (stufe)       filter.stufe = stufe;
  if (quelle)      filter.quelle = quelle;
  if (eigentuemer && mongoose.Types.ObjectId.isValid(eigentuemer)) {
    filter.eigentuemer = eigentuemer;
  }
  if (search?.trim()) {
    const re = new RegExp(search.trim(), 'i');
    filter.$or = [
      { title: re },
      { 'kontakt.nachname': re },
      { 'kontakt.vorname': re },
      { 'kontakt.firma': re },
      { 'kontakt.email': re },
    ];
  }

  const leads = await Lead.find(filter)
    .populate('eigentuemer', 'name email')
    .populate('angelegtVon', 'name email')
    .populate('kunde', 'kundName kundenNr')
    .sort({ createdAt: -1 })
    .lean();

  res.json(leads);
}));

// @route   GET /api/leads/:id
// @desc    Lead-Detail
// @access  Private
router.get('/:id', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const lead = await Lead.findById(req.params.id)
    .populate('eigentuemer', 'name email')
    .populate('angelegtVon', 'name email')
    .populate('kunde', 'kundName kundenNr kuerzel')
    .populate('notizen.verfasser', 'name email')
    .lean();

  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });
  res.json(lead);
}));

// @route   POST /api/leads
// @desc    Neuen Lead anlegen
// @access  Private
router.post('/', auth, asyncHandler(async (req, res) => {
  const {
    title, wert, waehrung, stufe, quelle,
    eigentuemer, kunde, kontakt, labels,
    erwartetesAbschlussDatum, customFields, msContact, msContacts,
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: '"title" ist erforderlich.' });
  }

  const ownerId = eigentuemer && mongoose.Types.ObjectId.isValid(eigentuemer)
    ? eigentuemer
    : req.user.id;

  const lead = new Lead({
    title: title.trim(),
    wert:  wert  ?? null,
    waehrung: waehrung || 'EUR',
    stufe:  stufe  || 'neu',
    quelle: quelle || null,
    eigentuemer:  ownerId,
    angelegtVon:  req.user.id,
    kunde: kunde && mongoose.Types.ObjectId.isValid(kunde) ? kunde : null,
    kontakt: kontakt || {},
    labels: Array.isArray(labels) ? labels : [],
    erwartetesAbschlussDatum: erwartetesAbschlussDatum || null,
    customFields: customFields || {},
    msContact: msContact || null,
    msContacts: Array.isArray(msContacts) ? msContacts : [],
  });

  await lead.save();

  const [populated, creatorUser] = await Promise.all([
    Lead.findById(lead._id)
      .populate('eigentuemer', 'name email')
      .populate('angelegtVon', 'name email')
      .populate('kunde', 'kundName kundenNr')
      .lean(),
    User.findById(req.user.id).select('name email').lean(),
  ]);

  const uName = creatorUser?.name || creatorUser?.email || 'Unbekannt';
  createChronikEvent(lead._id, req.user.id, uName, `${uName} – Lead erstellt.`);

  res.status(201).json(populated);
}));

// @route   PATCH /api/leads/:id
// @desc    Lead aktualisieren
// @access  Private
router.patch('/:id', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const allowed = [
    'title', 'wert', 'waehrung', 'status', 'stufe', 'quelle',
    'eigentuemer', 'kunde', 'kontakt', 'labels', 'msContact', 'msContacts',
    'erwartetesAbschlussDatum', 'verlorenGrund', 'customFields', 'isFavorite',
  ];

  const update = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }

  // Sync stufe with status when status goes to won/lost
  if (update.status === 'won')  update.stufe = 'gewonnen';
  if (update.status === 'lost') update.stufe = 'verloren';

  // Fetch old state for chronik diff (before update)
  const [oldLead, patchUser] = await Promise.all([
    Lead.findById(req.params.id)
      .populate('eigentuemer', 'name email')
      .populate('kunde', 'kundName')
      .lean(),
    User.findById(req.user.id).select('name email').lean(),
  ]);

  if (!oldLead) return res.status(404).json({ message: 'Lead nicht gefunden.' });

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true, runValidators: true }
  )
    .populate('eigentuemer', 'name email')
    .populate('angelegtVon', 'name email')
    .populate('kunde', 'kundName kundenNr')
    .lean();

  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });

  // ─── Generate chronik system events ─────────────────────────────
  const uName = patchUser?.name || patchUser?.email || 'Unbekannt';
  const events = [];

  if (update.status !== undefined && String(update.status) !== String(oldLead.status)) {
    events.push(`${uName} – Status geändert: ${STATUS_LABELS[oldLead.status] || oldLead.status} → ${STATUS_LABELS[update.status] || update.status}`);
  }
  if (update.stufe !== undefined && String(update.stufe) !== String(oldLead.stufe)) {
    events.push(`${uName} – Stufe geändert: ${STUFE_LABELS[oldLead.stufe] || oldLead.stufe} → ${STUFE_LABELS[update.stufe] || update.stufe}`);
  }
  if (update.title !== undefined && update.title.trim() !== (oldLead.title || '').trim()) {
    events.push(`${uName} – Titel geändert: „${oldLead.title}" → „${update.title}"`);
  }
  if (update.wert !== undefined && Number(update.wert) !== Number(oldLead.wert)) {
    const from = oldLead.wert != null ? `${oldLead.wert} ${oldLead.waehrung || 'EUR'}` : '—';
    const to   = update.wert != null  ? `${update.wert} ${update.waehrung || oldLead.waehrung || 'EUR'}` : '—';
    events.push(`${uName} – Wert geändert: ${from} → ${to}`);
  }
  if (update.quelle !== undefined && String(update.quelle || '') !== String(oldLead.quelle || '')) {
    const from = QUELLE_LABELS[oldLead.quelle] || oldLead.quelle || '—';
    const to   = QUELLE_LABELS[update.quelle]  || update.quelle  || '—';
    events.push(`${uName} – Quelle geändert: ${from} → ${to}`);
  }
  if (update.erwartetesAbschlussDatum !== undefined) {
    const oldDate = oldLead.erwartetesAbschlussDatum
      ? new Date(oldLead.erwartetesAbschlussDatum).toLocaleDateString('de-DE') : '—';
    const newDate = update.erwartetesAbschlussDatum
      ? new Date(update.erwartetesAbschlussDatum).toLocaleDateString('de-DE') : '—';
    if (oldDate !== newDate) events.push(`${uName} – Erw. Abschluss geändert: ${oldDate} → ${newDate}`);
  }
  if (update.verlorenGrund !== undefined && update.verlorenGrund && update.verlorenGrund !== oldLead.verlorenGrund) {
    events.push(`${uName} – Verloren-Grund: ${update.verlorenGrund}`);
  }
  if (update.kunde !== undefined) {
    const oldKundeId = String(oldLead.kunde?._id || oldLead.kunde || '');
    const newKundeId = String(lead.kunde?._id || lead.kunde || '');
    if (oldKundeId !== newKundeId) {
      if (lead.kunde) events.push(`${uName} – Kunde verknüpft: ${lead.kunde.kundName || newKundeId}`);
      else            events.push(`${uName} – Kunde entfernt: ${oldLead.kunde?.kundName || '—'}`);
    }
  }
  if (update.msContacts !== undefined) {
    const oldIds = new Set((oldLead.msContacts || []).map(c => c.id).filter(Boolean));
    const newIds = new Set((update.msContacts   || []).map(c => c.id).filter(Boolean));
    for (const c of (update.msContacts || []).filter(c => !oldIds.has(c.id)))
      events.push(`${uName} – Kontakt verknüpft: ${c.displayName || c.email || c.id}`);
    for (const c of (oldLead.msContacts || []).filter(c => !newIds.has(c.id)))
      events.push(`${uName} – Kontakt entfernt: ${c.displayName || c.email || c.id}`);
  }

  if (events.length > 0) {
    Comment.insertMany(events.map(text => ({
      scope: 'lead_chronik',
      text,
      author: uName,
      authorId: req.user.id,
      readBy: [req.user.id],
      isSystem: true,
      context: { resourceId: lead._id, resourceType: 'Lead' },
    }))).catch(() => {});
  }

  res.json(lead);
}));

// @route   POST /api/leads/:id/notizen
// @desc    Notiz zu einem Lead hinzufügen
// @access  Private
router.post('/:id/notizen', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const { text } = req.body;
  if (!text?.trim()) {
    return res.status(400).json({ message: '"text" ist erforderlich.' });
  }

  const user = await User.findById(req.user.id).select('name email').lean();
  if (!user) return res.status(404).json({ message: 'User nicht gefunden.' });

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        notizen: {
          text: text.trim(),
          verfasser: req.user.id,
          verfasserName: user.name || user.email,
        },
      },
    },
    { new: true }
  )
    .populate('notizen.verfasser', 'name email')
    .lean();

  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });

  const latestNote = lead.notizen[lead.notizen.length - 1];
  res.status(201).json(latestNote);
}));

// @route   DELETE /api/leads/:id
// @desc    Lead archivieren (Soft-Delete)
// @access  Private
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'archived' } },
    { new: true }
  ).lean();

  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });
  res.json({ message: 'Lead archiviert.' });
}));

// Hard delete
router.delete('/:id/permanent', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }
  const lead = await Lead.findByIdAndDelete(req.params.id).lean();
  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });
  res.json({ message: 'Lead gelöscht.' });
}));

// ─── Aktivitäten ──────────────────────────────────────────────────────────────

// @route   POST /api/leads/:id/aktivitaeten
// @desc    Neue Aktivität hinzufügen
router.post('/:id/aktivitaeten', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }
  const { type, titel, datum, kontakt } = req.body;
  if (!datum) return res.status(400).json({ message: 'Datum ist erforderlich.' });

  const entry = {
    type: type || 'aufgabe',
    titel: (titel || '').trim().slice(0, 200),
    datum: new Date(datum),
    erledigt: false,
    kontakt: kontakt || {},
    angelegtVon: req.user._id || req.user.id,
    angelegtVonName: req.user.name || req.user.email || '',
  };

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { $push: { aktivitaeten: entry } },
    { new: true }
  ).lean();

  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });
  const created = lead.aktivitaeten[lead.aktivitaeten.length - 1];
  res.status(201).json(created);
}));

// @route   PATCH /api/leads/:id/aktivitaeten/:aktId
// @desc    Aktivität aktualisieren (erledigt, titel, datum, ...)
router.patch('/:id/aktivitaeten/:aktId', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.aktId)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const allowed = ['type', 'titel', 'datum', 'erledigt', 'kontakt', 'asanaTaskGid', 'asanaTaskUrl'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[`aktivitaeten.$.${key}`] = key === 'datum' ? new Date(req.body[key]) : req.body[key];
    }
  }

  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, 'aktivitaeten._id': req.params.aktId },
    { $set: updates },
    { new: true }
  ).lean();

  if (!lead) return res.status(404).json({ message: 'Nicht gefunden.' });
  const updated = lead.aktivitaeten.find((a) => String(a._id) === req.params.aktId);
  res.json(updated);

  // Fire-and-forget: complete linked Asana task when activity is marked erledigt
  if (req.body.erledigt === true && updated?.asanaTaskGid) {
    updateTask(updated.asanaTaskGid, { completed: true })
      .catch(e => console.warn(`⚠️ aktivitaeten PATCH: could not complete Asana task ${updated.asanaTaskGid}:`, e.message));
  }
}));

// @route   DELETE /api/leads/:id/aktivitaeten/:aktId
// @desc    Aktivität löschen
router.delete('/:id/aktivitaeten/:aktId', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.aktId)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { $pull: { aktivitaeten: { _id: req.params.aktId } } },
    { new: true }
  ).lean();

  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });
  res.json({ message: 'Aktivität gelöscht.' });
}));

// @route   POST /api/leads/:id/asana-sales-task
// @desc    Aktivität als Asana-Task im Sales-Projekt der zuständigen Location anlegen
// @access  Private
router.post('/:id/asana-sales-task', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const { titel, datum, type, kontakt, aktId } = req.body;
  if (!datum) return res.status(400).json({ message: 'Datum ist erforderlich.' });

  const lead = await Lead.findById(req.params.id)
    .populate('eigentuemer', 'name email asana_id')
    .lean();
  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });

  const salesProjectId = registry.getAsanaSalesProjectId(lead.standort);
  if (!salesProjectId) {
    return res.status(400).json({ message: `Kein Sales-Projekt für Standort "${lead.standort}" konfiguriert.` });
  }
  const salesSectionId = registry.getAsanaSalesAufgabenSectionId(lead.standort);

  const AKT_TYPE_LABELS = {
    anruf: 'Anruf', meeting: 'Meeting', aufgabe: 'Aufgabe',
    frist: 'Frist', email: 'E-Mail', mittagessen: 'Mittagessen', event: 'Event',
  };

  const appBaseUrl = process.env.MONITOR_APP_URL || 'https://straightmonitor.com';
  const leadUrl = `${appBaseUrl}/kunden?tab=leads&lead=${lead._id}`;

  const lines = [];
  lines.push(`Aktivitätstyp: ${AKT_TYPE_LABELS[type] || type || 'Aufgabe'}`);
  lines.push(`Lead: ${lead.title}`);
  if (kontakt?.displayName) {
    lines.push(`Kontakt: ${kontakt.displayName}${kontakt.email ? ` (${kontakt.email})` : ''}`);
  }
  lines.push('');
  lines.push(`Im Monitor öffnen: ${leadUrl}`);

  const parsedDate = new Date(datum);
  const hasTime = parsedDate.getUTCHours() !== 0 || parsedDate.getUTCMinutes() !== 0;
  const due_on  = hasTime ? null : parsedDate.toISOString().slice(0, 10);
  const due_at  = hasTime ? parsedDate.toISOString() : null;
  const assignee = lead.eigentuemer?.asana_id || null;
  const taskName = (titel || AKT_TYPE_LABELS[type] || 'Aufgabe').trim();

  let created;
  try {
    created = await createSalesTask({
      projectId: salesProjectId,
      name:      taskName,
      due_on,
      due_at,
      notes:     lines.join('\n'),
      assignee,
      sectionId: salesSectionId || null,
    });
  } catch (e) {
    const msg = e.response?.body?.errors?.[0]?.message || e.message;
    return res.status(502).json({ message: `Asana Fehler: ${msg}` });
  }

  res.status(201).json({ gid: created.gid, name: created.name, url: created.permalink_url });

  // Fire-and-forget: write the Asana task link back to the activity
  if (aktId && mongoose.Types.ObjectId.isValid(aktId) && created?.gid) {
    Lead.findOneAndUpdate(
      { _id: req.params.id, 'aktivitaeten._id': aktId },
      { $set: { 'aktivitaeten.$.asanaTaskGid': created.gid, 'aktivitaeten.$.asanaTaskUrl': created.permalink_url || null } }
    ).catch(e => console.warn('⚠️ asana-sales-task: could not write GID back to activity:', e.message));
  }
}));

// ─── Attachments ─────────────────────────────────────────────────────────────

// @route   POST /api/leads/:id/attachments
// @desc    Dateien hochladen (batch: bis zu 20 Dateien auf einmal)
// @access  Private
router.post('/:id/attachments', auth, upload.array('files', 20), asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Keine Dateien hochgeladen.' });
  }

  const lead = await Lead.findById(req.params.id).lean();
  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });

  const newAttachments = [];
  for (const file of req.files) {
    const id = crypto.randomUUID();
    // Sanitize original filename — strip path separators
    const safeName = file.originalname.replace(/[/\\]/g, '_').replace(/[^\w.\-\u00C0-\u024F]/g, '_');
    const key = `leads/${req.params.id}/${id}_${safeName}`;

    await R2Service.uploadFile(key, file.buffer, file.mimetype);

    newAttachments.push({
      id,
      filename: file.originalname,
      key,
      contentType: file.mimetype,
      size: file.size,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
    });
  }

  const updated = await Lead.findByIdAndUpdate(
    req.params.id,
    { $push: { attachments: { $each: newAttachments } } },
    { new: true }
  ).lean();

  res.status(201).json(updated.attachments);
}));

// @route   GET /api/leads/:id/attachments/:attachmentId/url
// @desc    Pre-signed Download-URL (1 Stunde gültig) generieren
// @access  Private
router.get('/:id/attachments/:attachmentId/url', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const lead = await Lead.findById(req.params.id).lean();
  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });

  const attachment = (lead.attachments || []).find(a => a.id === req.params.attachmentId);
  if (!attachment) return res.status(404).json({ message: 'Anhang nicht gefunden.' });

  const inline = req.query.inline === 'true';
  const url = await R2Service.getSignedDownloadUrl(attachment.key, 3600, {
    inline,
    filename: attachment.filename,
  });
  res.json({ url });
}));

// @route   DELETE /api/leads/:id/attachments/:attachmentId
// @desc    Anhang löschen (R2 + DB)
// @access  Private
router.delete('/:id/attachments/:attachmentId', auth, asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Ungültige ID.' });
  }

  const lead = await Lead.findById(req.params.id).lean();
  if (!lead) return res.status(404).json({ message: 'Lead nicht gefunden.' });

  const attachment = (lead.attachments || []).find(a => a.id === req.params.attachmentId);
  if (!attachment) return res.status(404).json({ message: 'Anhang nicht gefunden.' });

  await R2Service.deleteFile(attachment.key);

  await Lead.findByIdAndUpdate(
    req.params.id,
    { $pull: { attachments: { id: req.params.attachmentId } } }
  );

  res.json({ message: 'Anhang gelöscht.' });
}));

module.exports = router;
