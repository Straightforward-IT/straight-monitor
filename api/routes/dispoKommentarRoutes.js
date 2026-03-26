const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const DispoKommentar = require('../models/DispoKommentar');
const User = require('../models/User');

// ─── GET /api/dispo-kommentare?von=YYYY-MM-DD&bis=YYYY-MM-DD ───
router.get('/', auth, asyncHandler(async (req, res) => {
  const { von, bis, mitarbeiterId } = req.query;

  if (!von || !bis) {
    return res.status(400).json({ message: '"von" und "bis" sind erforderlich.' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) {
    return res.status(400).json({ message: 'Datumsformat muss YYYY-MM-DD sein.' });
  }

  const filter = { datum: { $gte: von, $lte: bis } };
  if (mitarbeiterId) filter.mitarbeiter = mitarbeiterId;

  const kommentare = await DispoKommentar.find(filter).sort({ timestamp: 1 }).lean();
  res.json(kommentare);
}));

// ─── POST /api/dispo-kommentare ───
router.post('/', auth, asyncHandler(async (req, res) => {
  const { mitarbeiterId, datum, text } = req.body;

  if (!mitarbeiterId || !datum || !text?.trim()) {
    return res.status(400).json({ message: 'mitarbeiterId, datum und text sind erforderlich.' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return res.status(400).json({ message: 'datum muss im Format YYYY-MM-DD sein.' });
  }

  const user = await User.findById(req.user.id).select('name email').lean();
  if (!user) return res.status(404).json({ message: 'User nicht gefunden.' });

  const kommentar = new DispoKommentar({
    mitarbeiter: mitarbeiterId,
    datum,
    text: text.trim(),
    author: user.name || user.email,
    authorId: req.user.id,
    readBy: [req.user.id], // author has already read their own comment
  });

  await kommentar.save();
  res.status(201).json(kommentar);
}));

// ─── DELETE /api/dispo-kommentare/:id ───
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const kommentar = await DispoKommentar.findById(req.params.id);
  if (!kommentar) return res.status(404).json({ message: 'Kommentar nicht gefunden.' });

  if (String(kommentar.authorId) !== String(req.user.id)) {
    return res.status(403).json({ message: 'Keine Berechtigung.' });
  }

  await DispoKommentar.findByIdAndDelete(req.params.id);
  res.json({ message: 'Kommentar gelöscht.' });
}));

// ─── POST /api/dispo-kommentare/mark-read ───
// Body: { ids: [string] }
router.post('/mark-read', auth, asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids array erforderlich.' });
  }

  await DispoKommentar.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { readBy: req.user.id } }
  );
  res.json({ message: 'Gelesen markiert.' });
}));

module.exports = router;
