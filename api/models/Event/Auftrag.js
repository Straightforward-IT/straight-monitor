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
  // Human-readable identity for records created in Straight Monitor. The
  // numeric auftragNr remains the Zvoove-compatible relation and API key.
  monitorId: {
    type: String,
    trim: true,
    immutable: true,
    sparse: true,
    unique: true,
  },
  creationOrigin: {
    type: String,
    enum: ['manual', 'zvoove-import'],
    immutable: true,
    index: true,
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
  source: {
    type: String,
    enum: ['monitor', 'zvoove'],
    default: 'zvoove',
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  einsatzort: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Einsatzort',
    default: null,
    index: true,
  },
  wizardStep: { type: Number, default: 0, min: 0, max: 4 },
  wizardCompletedAt: { type: Date, default: null },
  planningVersion: { type: Number, default: 0, min: 0 },
  day: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  auftragsgruppe: { type: mongoose.Schema.Types.ObjectId, ref: 'Auftragsgruppe', default: null, index: true },
  submission: { type: mongoose.Schema.Types.ObjectId, ref: 'AuftragEditorSubmission', default: null },
  einsatzortOverride: { type: Boolean, default: false },
  bestelltext: { type: String, default: '', maxlength: 100000 },
  bestelltextOverride: { type: Boolean, default: false },
  eventTitelOverride: { type: Boolean, default: false },
  referenzOverride: { type: Boolean, default: false },
  bestDatumOverride: { type: Boolean, default: false },
  suppressedGroupShiftKeys: [{ type: String }],
  stundenlisteChangeLog: [{
    changedAt: { type: Date, required: true },
    entity: { type: String, required: true },
    details: [{
      field: { type: String, required: true },
      before: { type: String, default: '' },
      after: { type: String, default: '' },
    }],
  }],
  excludedTeamleiter: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter' }],
  statusOverrideTeamleiter: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter' }],
  labels: [{
    name: { type: String, required: true, maxlength: 20, trim: true },
    color: { type: String, default: '#4f46e5', trim: true }
  }],
  einsatzdokumente: [{
    key: { type: String, required: true },
    filename: { type: String, required: true },
    title: { type: String, trim: true, maxlength: 200, default: '' },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    scope: {
      type: String,
      enum: ['monitor', 'public'],
      default: 'monitor',
    },
    type: {
      type: String,
      enum: ['bestellung', 'einsatznachweis', 'einsatzinformation', 'ablauf', 'wegbeschreibung', 'sicherheit', 'kunde', 'sonstiges'],
      default: null,
    },
    publicEinsatzIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Einsatz' }],
    publicSchichtIds: [{ type: String, trim: true }],
    publicRecipientFilter: { type: Boolean, default: false },
    publicRecipientRule: {
      type: String,
      enum: ['all', 'teamleiter', 'individual'],
      default: 'all',
    },
    audience: {
      type: String,
      enum: ['job', 'teamleiter', 'office', 'office_roles'],
      default: 'office',
    },
    berufKeys: [{ type: Number }],
    allowedRoles: [{ type: String, uppercase: true, trim: true }],
    deliveryEmails: [{ type: String, lowercase: true, trim: true }],
    deliveryMessage: { type: String, maxlength: 1000, trim: true, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedAt: { type: Date, default: Date.now },
    relationTarget: { type: String, enum: ['order', 'group'], default: 'order' },
    clientUploadId: { type: String, maxlength: 200 },
    uploadHash: { type: String },
    uploadStatus: { type: String, enum: ['pending', 'ready'], default: 'ready' },
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

AuftragSchema.index({ auftragsgruppe: 1, day: 1 }, {
  unique: true, partialFilterExpression: { auftragsgruppe: { $type: 'objectId' }, day: { $type: 'string' } },
});
AuftragSchema.index({ submission: 1, day: 1 });

module.exports = mongoose.model('Auftrag', AuftragSchema);
