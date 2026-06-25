const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const SignaturTyp = require('../models/SignaturTyp');
const User = require('../models/User');

const router = express.Router();

async function requireAdmin(req, res) {
  const adminUser = await User.findById(req.user.id).select('role roles');
  const isAdmin = !!adminUser && (adminUser.roles?.includes('ADMIN') || adminUser.role === 'ADMIN');
  if (!isAdmin) {
    res.status(403).json({ message: 'Zugriff verweigert – nur für Admins' });
    return null;
  }
  return adminUser;
}

// GET /api/signatur-typen — list all active types (all authenticated users)
// Pass ?all=true (admin) to include inactive types.
router.get('/', auth, asyncHandler(async (req, res) => {
  const includeInactive = req.query.all === 'true';
  const filter = includeInactive ? {} : { isActive: true };
  const typen = await SignaturTyp.find(filter).sort({ order: 1, label: 1 });
  res.json(typen);
}));

// POST /api/signatur-typen — create a new document type (admin only)
// Body: { key, label, linkedTo?, order? }
router.post('/', auth, asyncHandler(async (req, res) => {
  if (!await requireAdmin(req, res)) return;

  const { key, label, linkedTo, order } = req.body;
  if (!key || !label) {
    return res.status(400).json({ message: 'key und label sind erforderlich' });
  }

  const normalizedKey = key.trim().toLowerCase();
  const existing = await SignaturTyp.findOne({ key: normalizedKey });
  if (existing) {
    return res.status(409).json({ message: `Typ mit key "${normalizedKey}" existiert bereits` });
  }

  const typ = new SignaturTyp({
    key:      normalizedKey,
    label:    label.trim(),
    linkedTo: linkedTo || 'Both',
    order:    typeof order === 'number' ? order : 0,
    createdBy: req.user.id,
  });
  await typ.save();
  res.status(201).json(typ);
}));

// PATCH /api/signatur-typen/:id — update label, linkedTo, order or isActive (admin only)
// The key is immutable after creation.
router.patch('/:id', auth, asyncHandler(async (req, res) => {
  if (!await requireAdmin(req, res)) return;

  const typ = await SignaturTyp.findById(req.params.id);
  if (!typ) return res.status(404).json({ message: 'Typ nicht gefunden' });

  const { label, linkedTo, order, isActive } = req.body;
  if (label     !== undefined) typ.label    = label.trim();
  if (linkedTo  !== undefined) typ.linkedTo = linkedTo;
  if (typeof order    === 'number')  typ.order    = order;
  if (typeof isActive === 'boolean') typ.isActive = isActive;

  await typ.save();
  res.json(typ);
}));

// DELETE /api/signatur-typen/:id — soft-delete (sets isActive=false) (admin only)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  if (!await requireAdmin(req, res)) return;

  const typ = await SignaturTyp.findById(req.params.id);
  if (!typ) return res.status(404).json({ message: 'Typ nicht gefunden' });

  typ.isActive = false;
  await typ.save();
  res.json({ message: 'Typ deaktiviert', typ });
}));

module.exports = router;
