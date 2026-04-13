const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/AsyncHandler');
const Comment = require('../models/Comment');
const User = require('../models/User');

/**
 * Unified Comments API
 *
 * Scopes: 'dispo_day', 'chronik', 'event_report', ...
 *
 * Query params for GET:
 *   scope        – required
 *   von / bis    – date range (for scope=dispo_day)
 *   mitarbeiterId – filter by MA (optional)
 *   resourceId   – filter by resourceId (optional)
 */

// ─── GET /api/comments ───
router.get('/', auth, asyncHandler(async (req, res) => {
  const { scope, von, bis, mitarbeiterId, resourceId } = req.query;

  if (!scope) {
    return res.status(400).json({ message: '"scope" ist erforderlich.' });
  }

  const filter = { scope };

  if (mitarbeiterId) filter['context.mitarbeiter'] = mitarbeiterId;
  if (resourceId)    filter['context.resourceId']  = resourceId;

  if (von && bis) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) {
      return res.status(400).json({ message: 'Datumsformat muss YYYY-MM-DD sein.' });
    }
    filter['context.datum'] = { $gte: von, $lte: bis };
  }

  const comments = await Comment.find(filter).sort({ createdAt: 1 }).lean();
  res.json(comments);
}));

// ─── POST /api/comments ───
// Body: { scope, text, context: { mitarbeiter?, datum?, resourceId?, resourceType? } }
router.post('/', auth, asyncHandler(async (req, res) => {
  const { scope, text, context = {} } = req.body;

  if (!scope || !text?.trim()) {
    return res.status(400).json({ message: '"scope" und "text" sind erforderlich.' });
  }

  if (context.datum && !/^\d{4}-\d{2}-\d{2}$/.test(context.datum)) {
    return res.status(400).json({ message: 'datum muss im Format YYYY-MM-DD sein.' });
  }

  const user = await User.findById(req.user.id).select('name email').lean();
  if (!user) return res.status(404).json({ message: 'User nicht gefunden.' });

  const comment = new Comment({
    scope,
    text: text.trim(),
    author: user.name || user.email,
    authorId: req.user.id,
    readBy: [req.user.id], // author already read their own
    context: {
      mitarbeiter:  context.mitarbeiter  || undefined,
      datum:        context.datum        || undefined,
      resourceId:   context.resourceId   || undefined,
      resourceType: context.resourceType || undefined,
    },
  });

  await comment.save();
  res.status(201).json(comment);
}));

// ─── DELETE /api/comments/:id ───
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: 'Kommentar nicht gefunden.' });

  if (String(comment.authorId) !== String(req.user.id)) {
    return res.status(403).json({ message: 'Keine Berechtigung.' });
  }

  await Comment.findByIdAndDelete(req.params.id);
  res.json({ message: 'Kommentar gelöscht.' });
}));

// ─── POST /api/comments/mark-read ───
// Body: { ids: [string] }
router.post('/mark-read', auth, asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids array erforderlich.' });
  }

  await Comment.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { readBy: req.user.id } }
  );

  res.json({ ok: true });
}));

module.exports = router;
