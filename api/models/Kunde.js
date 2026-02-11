const mongoose = require('mongoose');

const KundeSchema = new mongoose.Schema({
  kundenNr: {
    type: Number, // KUNDENNR
    required: true,
    unique: true
  },
  kundName: {
    type: String, // KUNDNAME
    required: false
  },
  kundeSeit: {
    type: Date, // KUNDESEIT
    required: false
  },
  kundStatus: {
    type: Number, // KUNDSTATUS: 1=Potentiell, 2=Aktiv, 3=Inaktiv
    required: false,
    enum: [1, 2, 3] 
  },
  geschSt: {
    type: String, // GESCHST
    required: false
  },
  kostenSt: {
    type: String, // KOSTENST
    required: false
  },
  parentKunde: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Kunde',
    default: null
  },
  bemerkung: {
    type: [String], // Array aus BEMERKUNG, BEMERKUNG2, BEMERKUNG3
    required: false
  },
  kontakte: [{
    vorname: { type: String, required: false },
    nachname: { type: String, required: true }, // Name* implies required
    email: { type: String, required: false },
    telefon: { type: String, required: false },
    angelegtVon: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kommentare: [{
      text: String,
      datum: { type: Date, default: Date.now },
      verfasser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('Kunde', KundeSchema);
