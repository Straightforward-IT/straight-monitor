const mongoose = require('mongoose');
const Auftrag = require('./Auftrag');

const schema = new mongoose.Schema({
  kundenNr: { type: Number, required: true },
  locationV2: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  einsatzort: { type: mongoose.Schema.Types.ObjectId, ref: 'Einsatzort', required: true },
  bestelltext: { type: String, default: '', maxlength: 100000 },
  eventTitel: { type: String },
  referenz: { type: String },
  bestDatum: { type: Date },
  legacyOrderFields: { type: [String], enum: ['eventTitel', 'referenz', 'bestDatum'], default: undefined },
  shiftDefaults: [{ _id: false, key: { type: String, required: true }, fields: mongoose.Schema.Types.Mixed }],
  revision: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'processing', 'incomplete', 'completed'], default: 'pending' },
  activeSubmission: { type: mongoose.Schema.Types.ObjectId, ref: 'AuftragEditorSubmission', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  einsatzdokumente: Auftrag.schema.path('einsatzdokumente'),
}, { timestamps: true });

module.exports = mongoose.model('Auftragsgruppe', schema);
