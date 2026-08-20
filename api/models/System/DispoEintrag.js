const mongoose = require('mongoose');

const DispoEintragSchema = new mongoose.Schema({
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    index: true,
  },
  datumVon: {
    type: Date,
    required: true,
  },
  datumBis: {
    type: Date,
    default: function () { return this.datumVon; },
  },
  typ: {
    type: String,
    required: true,
    enum: ['verfuegbarkeit', 'abwesenheit', 'notiz', 'hinweis'],
  },
  // Nur relevant bei typ = 'verfuegbarkeit'
  verfuegbarkeit: {
    type: String,
    enum: ['available', 'partially', 'blocked', 'angefragt_tel', 'angefragt_flip', 'eingeplant'],
  },
  // Nur relevant bei verfuegbarkeit = 'eingeplant' (manueller Platzhalter)
  kundeRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kunde',
  },
  kundeKuerzel: {
    type: String,
    trim: true,
  },
  // Nur relevant bei typ = 'abwesenheit'
  abwesenheitsKategorie: {
    type: String,
    enum: ['urlaub', 'krank', 'feiertag', 'ueberstunden', 'sonstiges'],
  },
  // Freitext für notiz / hinweis
  text: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  // Optionaler Uhrzeit-Block
  zeitVon: { type: String, trim: true }, // "HH:MM"
  zeitBis: { type: String, trim: true }, // "HH:MM"
  // Optionaler Farb-Override (hex)
  farbe: { type: String, trim: true },
  erstellt_von: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

// Compound-Indexes für performante Abfragen
DispoEintragSchema.index({ mitarbeiter: 1, datumVon: 1, datumBis: 1 });
DispoEintragSchema.index({ datumVon: 1, datumBis: 1 });

module.exports = mongoose.model('DispoEintrag', DispoEintragSchema);
