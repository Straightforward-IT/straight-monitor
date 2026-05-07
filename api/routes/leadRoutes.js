const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const Lead = require('../models/Lead');
const LeadLabel = require('../models/LeadLabel');
const User = require('../models/User');

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
  if (!['text', 'number', 'currency', 'date', 'checkbox', 'dropdown', 'multiselect', 'phone', 'email', 'url'].includes(fieldType)) {
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

  if (update.fieldType && !['text', 'number', 'currency', 'date', 'checkbox', 'dropdown', 'multiselect', 'phone', 'email', 'url'].includes(update.fieldType)) {
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

  const populated = await Lead.findById(lead._id)
    .populate('eigentuemer', 'name email')
    .populate('angelegtVon', 'name email')
    .populate('kunde', 'kundName kundenNr')
    .lean();

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
    'erwartetesAbschlussDatum', 'verlorenGrund', 'customFields',
  ];

  const update = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }

  // Sync stufe with status when status goes to won/lost
  if (update.status === 'won')  update.stufe = 'gewonnen';
  if (update.status === 'lost') update.stufe = 'verloren';

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

module.exports = router;
