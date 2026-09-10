const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const requireAdmin = require('../../middleware/requireAuftragChronikAdmin');
const asyncHandler = require('../../middleware/AsyncHandler');
const Auftrag = require('../../models/Event/Auftrag');
const Entry = require('../../models/Event/AuftragChronikEntry');

const orderContext = asyncHandler(async (req, res, next) => {
  if (!/^\d+$/.test(req.params.auftragNr) || !Number.isSafeInteger(Number(req.params.auftragNr)) || Number(req.params.auftragNr) <= 0) {
    return res.status(400).json({ message: 'Ungültige Auftragsnummer.' });
  }
  const order = await Auftrag.findOne({ auftragNr: Number(req.params.auftragNr) }).select('_id auftragNr eventTitel locationV2').lean();
  if (!order) return res.status(404).json({ message: 'Auftrag nicht gefunden.' });
  // Match the order routes: a location is required, Admins can access every location.
  if (!order.locationV2) return res.status(400).json({ message: 'Dem Auftrag ist kein Standort zugeordnet.' });
  req.chronikOrder = order;
  next();
});

function encodeCursor(entry) {
  return Buffer.from(JSON.stringify({ at: new Date(entry.createdAt).toISOString(), id: String(entry._id) })).toString('base64url');
}
function decodeCursor(cursor) {
  if (typeof cursor !== 'string' || cursor.length > 300 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('cursor');
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  if (!mongoose.isValidObjectId(parsed.id) || typeof parsed.at !== 'string' || !Number.isFinite(Date.parse(parsed.at))) throw new Error('cursor');
  return { createdAt: new Date(parsed.at), _id: new mongoose.Types.ObjectId(parsed.id) };
}

router.get('/:auftragNr/chronik', auth, requireAdmin, orderContext, asyncHandler(async (req, res) => {
  const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: 'Limit muss zwischen 1 und 100 liegen.' });
  const filter = { auftragId: req.chronikOrder._id };
  if (req.query.cursor !== undefined) {
    let cursor;
    try { cursor = decodeCursor(req.query.cursor); }
    catch { return res.status(400).json({ message: 'Ungültiger Chronik-Cursor.' }); }
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
    ];
  }
  const rows = await Entry.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const entries = rows.slice(0, limit);
  res.json({ entries, nextCursor: rows.length > limit ? encodeCursor(entries.at(-1)) : null });
}));

router.post('/:auftragNr/chronik/notes', auth, requireAdmin, orderContext, asyncHandler(async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 5000) return res.status(400).json({ message: 'Eine Notiz mit 1 bis 5000 Zeichen ist erforderlich.' });
  const order = req.chronikOrder;
  const user = req.chronikUser;
  const entry = await Entry.create({ auftragId: order._id, auftragNr: order.auftragNr,
    orderTitle: order.eventTitel || '', locationV2: order.locationV2,
    kind: 'note', action: 'note.created', summary: 'Notiz hinzugefügt', text,
    actor: { id: user._id, name: user.name || user.email }, changes: [] });
  res.status(201).json(entry);
}));

router.delete('/:auftragNr/chronik/:entryId', auth, requireAdmin, orderContext, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.entryId)) return res.status(400).json({ message: 'Ungültige Chronik-ID.' });
  const entry = await Entry.findOne({ _id: req.params.entryId, auftragId: req.chronikOrder._id }).lean();
  if (!entry) return res.status(404).json({ message: 'Eintrag nicht gefunden.' });
  if (entry.kind !== 'note' || String(entry.actor.id) !== String(req.chronikUser._id)) {
    return res.status(403).json({ message: 'Nur eigene Notizen können gelöscht werden.' });
  }
  await Entry.deleteOne({ _id: entry._id, auftragId: req.chronikOrder._id, kind: 'note', 'actor.id': req.chronikUser._id });
  res.json({ ok: true });
}));

module.exports = router;
