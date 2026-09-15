const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  normalizedKey: { type: String, required: true },
  provider: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    type: new mongoose.Schema({ latitude: Number, longitude: Number }, { _id: false }),
    default: null,
  },
  providerId: String,
  accuracy: String,
  attribution: String,
  state: { type: String, enum: ['pending', 'resolved', 'unresolved', 'error', 'stale'], default: 'pending' },
  error: String,
  resolvedAt: Date,
  expiresAt: { type: Date, default: () => new Date(0) },
  leaseUntil: { type: Date, default: () => new Date(0) },
  leaseToken: String,
  purgeAt: Date,
}, { timestamps: true });

schema.index({ normalizedKey: 1, provider: 1 }, { unique: true });
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Geodata', schema);
