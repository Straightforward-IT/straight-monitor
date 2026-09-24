const express = require('express');
const asyncHandler = require('../../middleware/AsyncHandler');
const flipFusionAuth = require('../../middleware/flipFusionAuth');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const { flipAxios } = require('../../services/integrations/flipAxios');

const router = express.Router();

// All Flip Fusion connector requests must provide x-api-key.
router.use(flipFusionAuth);

// GET /api/flip-fusion/test
// Use this endpoint to verify the connector configuration in Flip Fusion.
router.get('/test', asyncHandler(async (_req, res) => {
  res.json({
    data: {
      message: 'Straight Monitor Flip Fusion connector is connected.',
      connectedAt: new Date().toISOString(),
      connector: 'straight-monitor',
    },
  });
}));

// GET /api/flip-fusion/mitarbeiter/:flipUserId
// Verifies the Flip user before returning the linked Straight Monitor employee.
router.get('/mitarbeiter/:flipUserId', asyncHandler(async (req, res) => {
  const flipUserId = req.params.flipUserId.trim();

  try {
    await flipAxios.get(`/api/admin/users/v4/users/${flipUserId}`);
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(401).json({ msg: 'Invalid Flip user ID' });
    }
    throw error;
  }

  const mitarbeiter = await Mitarbeiter.findOne({ flip_id: flipUserId })
    .select([
      '_id',
      'flip_id',
      'personalnr',
      'vorname',
      'nachname',
      'email',
      'telefon',
      'profilbild',
      'isActive',
      'geburtsdatum',
      'eintrittsdatum',
      'austrittsdatum',
      'arbeitsverhaeltnis',
      'arbeitszeit',
      'persgruppe',
      'isBewerberstatus',
      'isStudent',
      'isSchueler',
      'berufe',
      'qualifikationen',
      'rank',
      'einsatzCount',
    ].join(' '))
    .lean();

  if (!mitarbeiter) {
    return res.status(404).json({ msg: 'No employee linked to this Flip user' });
  }

  res.json({ data: mitarbeiter });
}));

module.exports = router;