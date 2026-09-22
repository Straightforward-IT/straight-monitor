const express = require('express');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/AsyncHandler');
const { contentDisposition } = require('../../utils/stundenlisteFilename');
const { generateWalletPass } = require('../../services/integrations/AppleWalletPassService');

const router = express.Router();

/**
 * POST /api/wallet-passes/generate
 *
 * Creates a signed generic Apple Wallet pass from validated request data.
 * Certificate identity, private key and Apple team details are always loaded
 * from server-side configuration and cannot be supplied by the caller.
 */
router.post('/generate', auth, asyncHandler(async (req, res) => {
  const generatedPass = await generateWalletPass(req.body);

  res.status(200)
    .set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': contentDisposition(generatedPass.filename),
      'Content-Length': generatedPass.buffer.length,
      'Content-Type': generatedPass.mimeType,
      'X-Content-Type-Options': 'nosniff',
    })
    .send(generatedPass.buffer);
}));

module.exports = router;
