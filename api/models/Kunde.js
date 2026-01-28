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
  bemerkung: {
    type: [String], // Array aus BEMERKUNG, BEMERKUNG2, BEMERKUNG3
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Kunde', KundeSchema);
