const express = require('express');
const auth = require('../../middleware/auth');
const User = require('../../models/System/User');
const { contingent } = require('../../services/operations/EmployeeContingentService');
const router = express.Router();
// /personal currently allows authenticated users without a role restriction.
// Validate the current account as well; no tariff administration is exposed here.
router.get('/:id/analytics/contingent', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id || req.user?._id).select('isConfirmed').lean();
    if (!user || user.isConfirmed === false) return res.status(401).json({ message: 'Anmeldung erforderlich.' });
    res.json(await contingent(req.params.id, req.query));
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});
module.exports = router;
