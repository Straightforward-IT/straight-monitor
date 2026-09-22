const express = require('express');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../../middleware/AsyncHandler');
const publicAuth = require('../../middleware/publicAuth');
const { contentDisposition } = require('../../utils/stundenlisteFilename');
const { generateWalletPass } = require('../../services/integrations/AppleWalletPassService');

const router = express.Router();
const HANDOFF_TOKEN_TTL_SECONDS = 60;

function handoffSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET fehlt für den Apple-Wallet-Pass-Download.');
  return process.env.JWT_SECRET;
}

function sendPass(res, generatedPass) {
  return res.status(200)
    .set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': contentDisposition(generatedPass.filename),
      'Content-Length': generatedPass.buffer.length,
      'Content-Type': generatedPass.mimeType,
      'X-Content-Type-Options': 'nosniff',
    })
    .send(generatedPass.buffer);
}

/**
 * POST /api/wallet-passes/generate
 *
 * Creates a signed generic Apple Wallet pass for an authenticated portal user.
 * Certificate identity, private key and Apple team details are always loaded
 * from server-side configuration and cannot be supplied by the caller.
 */
router.post('/generate', publicAuth.headerOnly, asyncHandler(async (req, res) => {
  // A top-level browser navigation cannot send x-public-token. Hand off the
  // validated payload in a short-lived signed token so iOS can open Wallet.
  const token = jwt.sign({ type: 'apple-wallet-pass', payload: req.body }, handoffSecret(), {
    expiresIn: HANDOFF_TOKEN_TTL_SECONDS,
    issuer: 'straight-monitor',
  });

  res.status(201).json({
    url: `/api/wallet-passes/download/${token}`,
    expiresIn: HANDOFF_TOKEN_TTL_SECONDS,
  });
}));

router.get('/download/:token', asyncHandler(async (req, res) => {
  let handoff;
  try {
    handoff = jwt.verify(req.params.token, handoffSecret(), { issuer: 'straight-monitor' });
  } catch (_error) {
    return res.status(401).json({ msg: 'Der Apple-Wallet-Link ist ungültig oder abgelaufen.' });
  }
  if (handoff.type !== 'apple-wallet-pass' || !handoff.payload || typeof handoff.payload !== 'object') {
    return res.status(401).json({ msg: 'Der Apple-Wallet-Link ist ungültig.' });
  }

  return sendPass(res, await generateWalletPass(handoff.payload));
}));

module.exports = router;
