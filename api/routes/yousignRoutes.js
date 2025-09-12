const express = require('express');
const crypto = require('crypto');
const asyncHandler = require('../middleware/AsyncHandler');
const { sendMail } = require('../EmailService');
const YousignEvent = require('../models/YousignEvent');

const router = express.Router();
const secret = process.env.YOUSIGN_WEBHOOK_SECRET;
const MAX_AGE_S = 5 * 60;

function verifyYousign(req, res, next) {
  const sig = Buffer.from(req.header('X-Yousign-Signature-256') || '', 'utf8');
  const ts = parseInt(req.header('X-Yousign-Issued-At') || '0', 10);
  const raw = req.rawBody || '';

  const digestHex = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const expected = Buffer.from(`sha256=${digestHex}`, 'utf8');

  const now = Math.floor(Date.now() / 1000);
  const replay = !ts || Math.abs(now - ts) > MAX_AGE_S;

  const ok = sig.length === expected.length && crypto.timingSafeEqual(sig, expected);

  if (!ok || replay) {
    res.status(400).send('Invalid signature');
    console.warn('🔐 YousignWebhook rejected:', { ok, replay, ts, now });
    return;
  }

  next();
}

router.post('/webhook',
  verifyYousign,
  asyncHandler(async (req, res) => {
    res.sendStatus(200);

    const event = new YousignEvent(req.body);
    await event.save();

    sendMail(
      'it@straightforward.email',
      `🎯 Yousign Event gespeichert: ${event.event_name}`,
      `<pre>${JSON.stringify(event, null, 2)}</pre>`
    );
  })
);

module.exports = router;
