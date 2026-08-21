const mongoose = require('mongoose');

const KundenpreisSchema = new mongoose.Schema({
  kunde: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kunde',
    required: true,
    immutable: true,
  },
  kundenNrSnapshot: { type: Number, required: true, immutable: true },
  qualifikation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Qualifikation',
    required: true,
    immutable: true,
  },
  qualSchluessel: { type: Number, required: true, immutable: true },
  hourlyRateCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
  validFrom: { type: Date, required: true, immutable: true },
  validTill: { type: Date, default: null },
  sourceId: { type: String, required: true, trim: true, unique: true, immutable: true },
  source: { type: String, required: true, default: 'zvoove-import', immutable: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    immutable: true,
  },
}, { timestamps: true });

KundenpreisSchema.index({ kunde: 1, qualifikation: 1, validFrom: 1 }, { unique: true });
KundenpreisSchema.index({ kunde: 1, qualifikation: 1, validFrom: -1 });

KundenpreisSchema.pre('validate', function validateDateRange(next) {
  if (this.validTill && this.validTill < this.validFrom) {
    this.invalidate('validTill', 'DATUMBIS darf nicht vor DATUMVON liegen.');
  }
  next();
});

module.exports = mongoose.model('Kundenpreis', KundenpreisSchema);