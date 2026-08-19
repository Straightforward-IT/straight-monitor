const mongoose = require('mongoose');

function normalize(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const openingHourSlotSchema = new mongoose.Schema({
  start: { type: String, required: true, trim: true },
  end: { type: String, required: true, trim: true },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  nameFull: { type: String, required: true, trim: true },
  shortName: { type: String, required: true, trim: true },
  color: { type: String, default: '#6b7280', trim: true },
  address: {
    street: { type: String, default: '', trim: true },
    houseNumber: { type: String, default: '', trim: true },
    postalCode: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    country: { type: String, default: 'Deutschland', trim: true },
  },
  locationManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  contact: {
    mainEmail: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
  },
  openingHours: {
    monday: { type: [openingHourSlotSchema], default: [] },
    tuesday: { type: [openingHourSlotSchema], default: [] },
    wednesday: { type: [openingHourSlotSchema], default: [] },
    thursday: { type: [openingHourSlotSchema], default: [] },
    friday: { type: [openingHourSlotSchema], default: [] },
    saturday: { type: [openingHourSlotSchema], default: [] },
    sunday: { type: [openingHourSlotSchema], default: [] },
  },
  timeZone: { type: String, default: 'Europe/Berlin', trim: true },
  legal: {
    legalName: { type: String, default: '', trim: true },
    vatId: { type: String, default: '', trim: true },
    registrationNumber: { type: String, default: '', trim: true },
  },
  externalId: { type: String, default: '', trim: true },
  // Kostenstelle (KST) für Reisekostenabrechnungen o. ä.; Default aus externalId.
  kostenstelle: { type: String, default: '', trim: true },
  deliveryNotes: { type: String, default: '', trim: true },
  emailTemplateSource: {
    mailboxUpn: { type: String, default: '', trim: true, lowercase: true },
    folderId: { type: String, default: '', trim: true },
  },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  nameKey: { type: String, required: true, unique: true },
  shortNameKey: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

locationSchema.pre('validate', function normalizeLocation(next) {
  this.nameKey = normalize(this.nameFull);
  this.shortNameKey = normalize(this.shortName);
  next();
});

locationSchema.statics.normalize = normalize;

module.exports = mongoose.model('Location', locationSchema);