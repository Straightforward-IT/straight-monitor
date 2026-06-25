const mongoose = require('mongoose');

/**
 * SignaturTyp — admin-managed document type definitions for SignaturVorgang.
 *
 * New types can be added at runtime via the /api/signatur-typen API (ADMIN).
 * The `key` field is used as the folder name in the R2 path.
 *
 * Initial types seeded via: node api/scripts/seedSignaturTypen.js
 */
const SignaturTypSchema = new mongoose.Schema({
  // URL/R2-safe slug, e.g. 'stundenliste', 'auerv'. Lowercase, immutable after creation.
  key:      { type: String, required: true, unique: true, trim: true, lowercase: true },
  // Display label, e.g. 'Stundenliste', 'AÜRV'
  label:    { type: String, required: true, trim: true },
  // Which entity type must be linked when using this document type.
  linkedTo: { type: String, enum: ['Kunde', 'Mitarbeiter', 'Both', 'None'], default: 'Both' },
  isActive: { type: Boolean, default: true },
  order:    { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('SignaturTyp', SignaturTypSchema);
