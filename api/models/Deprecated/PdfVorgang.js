const mongoose = require('mongoose');
const crypto = require('crypto');

const PdfVorgangSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PdfTemplate',
    required: true,
  },
  name: { type: String, required: true },

  // Employee contact – filled out when creating the Vorgang
  mitarbeiterEmail: { type: String, default: '' },
  mitarbeiterName:  { type: String, default: '' },

  // Status:
  //   'offen'  = waiting for employee to fill the mitarbeiter form
  //   'bereit' = employee submitted, PDF can be generated
  status: {
    type: String,
    enum: ['offen', 'bereit'],
    default: 'offen',
  },

  // Values keyed by bookmarkId
  operatorValues:    { type: mongoose.Schema.Types.Mixed, default: {} },
  mitarbeiterValues: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Snapshot of the template at the moment this Vorgang was created.
  // This ensures template edits after creation don't affect existing Vorgänge.
  templateVersion:    { type: Number, default: 1 },
  snapshotBookmarks:  { type: mongoose.Schema.Types.Mixed, default: [] },
  snapshotPlacements: { type: mongoose.Schema.Types.Mixed, default: [] },

  // Secret token for the public employee form link
  token: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(24).toString('hex'),
  },

  // Final rendered PDF data stored in R2 bucket
  pdfKey: { type: String },
  pdfUrl: { type: String },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PdfVorgangSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PdfVorgang', PdfVorgangSchema);
