const express = require('express');
const asyncHandler = require('../../middleware/AsyncHandler');
const auth = require('../../middleware/auth');
const PaketVorlage = require('../../models/System/PaketVorlage');
const User = require('../../models/System/User');

const router = express.Router();

async function canManageTemplate(userId, template) {
  if (String(template.createdBy) === String(userId)) return true;
  const user = await User.findById(userId).select('role roles').lean();
  return !!user && (user.role === 'ADMIN' || user.roles?.includes('ADMIN'));
}

function pickTemplatePayload(body) {
  const payload = {};
  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (Array.isArray(body.allowedLocations)) payload.allowedLocations = body.allowedLocations;
  if (Array.isArray(body.sections)) payload.sections = body.sections;
  if (typeof body.isActive === 'boolean') payload.isActive = body.isActive;
  return payload;
}

router.get('/', auth, asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  const templates = await PaketVorlage.find(filter)
    .populate('allowedLocations', 'nameFull shortName isActive')
    .populate('sections.entries.item', 'bezeichnung variationen groessen bestaende isActive')
    .sort({ name: 1 })
    .lean();
  res.json(templates);
}));

router.post('/', auth, asyncHandler(async (req, res) => {
  const payload = pickTemplatePayload(req.body);
  if (!payload.name) {
    return res.status(400).json({ message: 'name ist erforderlich' });
  }

  const template = await PaketVorlage.create({ ...payload, createdBy: req.user.id });
  await template.populate([
    { path: 'allowedLocations', select: 'nameFull shortName isActive' },
    { path: 'sections.entries.item', select: 'bezeichnung variationen groessen bestaende isActive' },
  ]);
  res.status(201).json(template);
}));

router.patch('/:id', auth, asyncHandler(async (req, res) => {
  const template = await PaketVorlage.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Paketvorlage nicht gefunden' });
  if (!await canManageTemplate(req.user.id, template)) {
    return res.status(403).json({ message: 'Keine Berechtigung fuer diese Paketvorlage' });
  }

  Object.assign(template, pickTemplatePayload(req.body));
  await template.save();
  await template.populate([
    { path: 'allowedLocations', select: 'nameFull shortName isActive' },
    { path: 'sections.entries.item', select: 'bezeichnung variationen groessen bestaende isActive' },
  ]);
  res.json(template);
}));

router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const template = await PaketVorlage.findById(req.params.id);
  if (!template) return res.status(404).json({ message: 'Paketvorlage nicht gefunden' });
  if (!await canManageTemplate(req.user.id, template)) {
    return res.status(403).json({ message: 'Keine Berechtigung fuer diese Paketvorlage' });
  }

  template.isActive = false;
  await template.save();
  res.json({ message: 'Paketvorlage deaktiviert', template });
}));

module.exports = router;