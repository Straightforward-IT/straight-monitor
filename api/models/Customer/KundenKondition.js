const mongoose = require('mongoose');

const KundenKonditionSchema = new mongoose.Schema({
  kunde: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', required: true, immutable: true },
  kundenNrSnapshot: { type: Number, required: true, immutable: true },
  lohnart: { type: mongoose.Schema.Types.ObjectId, ref: 'Lohnart', required: true, immutable: true },
  lohnartNummer: { type: String, required: true, trim: true, immutable: true },
  tabellenNr: { type: String, required: true, trim: true },
  tabellenBezeichnung: { type: String, default: '' },
  laufendeNummer: { type: String, required: true, trim: true },
  regelArt: { type: String, enum: ['stunden', 'uhrzeit', null], default: null },
  jeEinheit: { type: String, enum: ['tag', 'woche', null], default: null },
  abWert: { type: String, default: null },
  bisWert: { type: String, default: null },
  tage: {
    montag: { type: Boolean, default: false },
    dienstag: { type: Boolean, default: false },
    mittwoch: { type: Boolean, default: false },
    donnerstag: { type: Boolean, default: false },
    freitag: { type: Boolean, default: false },
    samstag: { type: Boolean, default: false },
    sonntag: { type: Boolean, default: false },
    feiertag: { type: Boolean, default: false },
  },
  preisNr: { type: String, default: null },
  zuschlagsProzent: { type: Number, default: 0 },
  verwendung: { type: String, default: null, trim: true },
  preisBetrag: { type: Number, default: null },
  abStundenGrenze: { type: Number, default: null },
  nichtAutomatisch: { type: Boolean, default: false },
  branchenzuschlagAddieren: { type: Boolean, default: false },
  berufsSchluessel: { type: String, default: null, trim: true },
  zvooveKonditionsId: { type: String, default: null, trim: true },
  sourceKey: { type: String, required: true, unique: true, immutable: true },
}, { timestamps: true });

KundenKonditionSchema.index({ kunde: 1, tabellenNr: 1, laufendeNummer: 1 });
KundenKonditionSchema.index({ kunde: 1, lohnart: 1 });

module.exports = mongoose.model('KundenKondition', KundenKonditionSchema);