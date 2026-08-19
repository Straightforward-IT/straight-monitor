const mongoose = require('mongoose');

const AuftragSchema = new mongoose.Schema({
  geschSt: {
    type: String, // GESCHST
    required: false
  },
  locationV2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
    index: true,
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
  },
  referenz: {
    type: String, // BEZEICHN from EINSORT (es.BEZEICHN AS Referenz)
    required: false
  },
  excludedTeamleiter: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter' }],
  statusOverrideTeamleiter: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter' }],
  labels: [{
    name: { type: String, required: true, maxlength: 20, trim: true },
    color: { type: String, default: '#4f46e5', trim: true }
  }],
  isPseudo: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Build a single-line event address string from the event fields.
AuftragSchema.statics.formatEventAddress = function formatEventAddress(a = {}) {
  const strasse = a.eventStrasse || '';
  const plzOrt = [a.eventPlz, a.eventOrt].filter(Boolean).join(' ');
  return [a.eventLocation, strasse, plzOrt].filter(Boolean).join(', ');
};

module.exports = mongoose.model('Auftrag', AuftragSchema);
