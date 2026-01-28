const mongoose = require('mongoose');

const AuftragSchema = new mongoose.Schema({
  geschSt: {
    type: String, // GESCHST
    required: false
  },
  auftragNr: {
    type: Number, // AUFTRAGNR
    required: true,
    unique: true
  },
  kundenNr: {
    type: Number, // KUNDENNR
    required: false
  },
  eventTitel: {
    type: String, // EVENTTITEL
    required: false
  },
  bediener: {
    type: String, // BEDIENER
    required: false
  },
  dtAngelegtAm: {
    type: Date, // DTANGELEGTAM
    required: false
  },
  bestDatum: {
    type: Date, // BESTDATUM
    required: false
  },
  vonDatum: {
    type: Date, // VONDATUM
    required: false
  },
  bisDatum: {
    type: Date, // BISDATUM
    required: false
  },
  eventStrasse: {
    type: String, // EVENT_STRASSE
    required: false
  },
  eventPlz: {
    type: String, // EVENT_PLZ
    required: false
  },
  eventOrt: {
    type: String, // EVENT_ORT
    required: false
  },
  eventLocation: {
    type: String, // EVENT_LOCATION
    required: false
  },
  aktiv: {
    type: Number, // AKTIV - Assuming Boolean based on name, could be Number
    required: false
  },
  auftStatus: {
    type: Number, // AUFTSTATUS
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Auftrag', AuftragSchema);
