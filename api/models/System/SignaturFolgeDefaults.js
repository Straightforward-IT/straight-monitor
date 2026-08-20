const mongoose = require('mongoose');

/**
 * SignaturFolgeDefaults — shared default "ausliefernAn" recipients
 * for a specific (Kunde × SignaturTyp) combination.
 *
 * Any user creating a new signature with the same Kunde + Typ will
 * see these contacts pre-checked in Step 4 (Folgeaktionen).
 */
const SignaturFolgeDefaultsSchema = new mongoose.Schema({
  kundeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', required: true },
  typId:   { type: mongoose.Schema.Types.ObjectId, ref: 'SignaturTyp', required: true },
  ausliefernAn: {
    type: [{
      displayName: { type: String, default: '' },
      email:       { type: String, required: true, lowercase: true, trim: true },
    }],
    default: [],
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// One record per Kunde+Typ combination
SignaturFolgeDefaultsSchema.index({ kundeId: 1, typId: 1 }, { unique: true });

module.exports = mongoose.model('SignaturFolgeDefaults', SignaturFolgeDefaultsSchema);
