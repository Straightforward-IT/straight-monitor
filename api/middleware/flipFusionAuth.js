const crypto = require('crypto');

function flipFusionAuth(req, res, next) {
  const providedKey = req.headers['x-api-key'];
  const configuredKey = process.env.FLIP_FUSION_API_KEY;

  if (!configuredKey) {
    return res.status(500).json({ msg: 'FLIP_FUSION_API_KEY not configured on server' });
  }

  if (!providedKey || typeof providedKey !== 'string') {
    return res.status(401).json({ msg: 'API key required' });
  }

  const providedBuffer = Buffer.from(providedKey);
  const configuredBuffer = Buffer.from(configuredKey);
  const isValid = providedBuffer.length === configuredBuffer.length
    && crypto.timingSafeEqual(providedBuffer, configuredBuffer);

  if (!isValid) {
    return res.status(403).json({ msg: 'Invalid API key' });
  }

  next();
}

module.exports = flipFusionAuth;