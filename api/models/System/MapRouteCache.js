const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  state: { type: String, enum: ['pending', 'resolved', 'unroutable', 'error'], default: 'pending' },
  durationSeconds: { type: Number, default: null },
  distanceMeters: { type: Number, default: null },
  error: String,
  resolvedAt: Date,
  expiresAt: { type: Date, default: () => new Date(0) },
  leaseUntil: { type: Date, default: () => new Date(0) },
  leaseToken: String,
  purgeAt: Date,
}, { timestamps: true });
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MapRouteCache', schema);
