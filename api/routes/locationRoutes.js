const express = require('express');
const asyncHandler = require('../middleware/AsyncHandler');
const auth = require('../middleware/auth');
const Location = require('../models/Location');
const User = require('../models/User');

const router = express.Router();

async function isAdmin(userId) {
  const user = await User.findById(userId).select('role roles').lean();
  return !!user && (user.role === 'ADMIN' || user.roles?.includes('ADMIN'));
}

async function validateLocationManager(userId) {
  if (!userId) return true;
  return !!await User.exists({ _id: userId });
}

router.get('/', auth, asyncHandler(async (req, res) => {
  const includeInactive = req.query.all === 'true' && await isAdmin(req.user.id);
  const locations = await Location.find(includeInactive ? {} : { isActive: true })
    .populate('locationManager', 'name email')
    .sort({ nameFull: 1 })
    .lean();
  res.json(locations);
}));

router.post('/', auth, asyncHandler(async (req, res) => {
  if (!await isAdmin(req.user.id)) {
    return res.status(403).json({ message: 'Zugriff verweigert - nur fuer Admins' });
  }

  const {
    nameFull, shortName, address, locationManager, contact, openingHours,
    timeZone, legal, externalId, deliveryNotes, settings,
  } = req.body;
  if (!nameFull?.trim() || !shortName?.trim()) {
    return res.status(400).json({ message: 'nameFull und shortName sind erforderlich' });
  }
  if (!await validateLocationManager(locationManager)) {
    return res.status(400).json({ message: 'Die Standortleitung wurde nicht gefunden' });
  }

  const nameKey = Location.normalize(nameFull);
  const shortNameKey = Location.normalize(shortName);
  const existing = await Location.findOne({
    $or: [{ nameKey }, { shortNameKey }],
  });
  if (existing) {
    return res.status(409).json({ message: 'Standortname oder Kurzbezeichnung existiert bereits' });
  }

  const location = await Location.create({
    nameFull, shortName, address, locationManager: locationManager || null, contact,
    openingHours, timeZone, legal, externalId, deliveryNotes, settings, createdBy: req.user.id,
  });
  await location.populate('locationManager', 'name email');
  res.status(201).json(location);
}));

router.patch('/:id', auth, asyncHandler(async (req, res) => {
  if (!await isAdmin(req.user.id)) {
    return res.status(403).json({ message: 'Zugriff verweigert - nur fuer Admins' });
  }

  const location = await Location.findById(req.params.id);
  if (!location) return res.status(404).json({ message: 'Standort nicht gefunden' });

  if (!req.body.nameFull?.trim() || !req.body.shortName?.trim()) {
    return res.status(400).json({ message: 'nameFull und shortName sind erforderlich' });
  }
  if (req.body.locationManager !== undefined && !await validateLocationManager(req.body.locationManager)) {
    return res.status(400).json({ message: 'Die Standortleitung wurde nicht gefunden' });
  }

  const nameKey = Location.normalize(req.body.nameFull);
  const shortNameKey = Location.normalize(req.body.shortName);
  const duplicate = await Location.findOne({
    _id: { $ne: location._id },
    $or: [{ nameKey }, { shortNameKey }],
  });
  if (duplicate) return res.status(409).json({ message: 'Standortname oder Kurzbezeichnung existiert bereits' });

  location.nameFull = req.body.nameFull;
  location.shortName = req.body.shortName;

  const editableFields = [
    'address', 'locationManager', 'contact', 'openingHours', 'timeZone',
    'legal', 'externalId', 'deliveryNotes', 'settings',
  ];
  editableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      location[field] = field === 'locationManager' ? req.body[field] || null : req.body[field];
    }
  });
  if (typeof req.body.isActive === 'boolean') location.isActive = req.body.isActive;
  await location.save();
  await location.populate('locationManager', 'name email');
  res.json(location);
}));

module.exports = router;