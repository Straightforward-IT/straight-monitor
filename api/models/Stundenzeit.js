const mongoose = require('mongoose');

// Operational capture/review, before payroll valuation. One document per Einsatz:
// using the Einsatz ID as _id makes even simultaneous first submissions unique.
const values = new mongoose.Schema({
  date: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  actualStart: { type: Date, required: true },
  actualEnd: { type: Date, required: true },
  breakMinutes: { type: Number, required: true, min: 0 },
  paidBreakMinutes: { type: Number, required: true, min: 0 },
  netMinutes: { type: Number, required: true, min: 0 },
  breaks: [{ _id: false, start: String, end: String, paid: Boolean }],
}, { _id: false });
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Einsatz' },
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', required: true, immutable: true },
  personalNr: { type: Number, required: true, immutable: true },
  auftragNr: { type: Number, required: true, immutable: true },
  schicht: { type: mongoose.Schema.Types.ObjectId, ref: 'Schicht', default: null, immutable: true },
  revision: { type: Number, required: true, default: 1 },
  status: { type: String, enum: ['SUBMITTED', 'DRAFT', 'RELEASED'], required: true },
  employeeSubmission: { type: values, immutable: true, default: null },
  employeeSubmittedAt: { type: Date, immutable: true, default: null },
  current: { type: values, required: true },
  // A saved office draft does not change the already released monthly balance.
  released: { type: values, default: null },
  releasedAt: Date,
  releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  history: [{
    _id: false,
    revision: Number,
    action: { type: String, enum: ['SUBMITTED', 'DRAFT', 'RELEASED', 'WITHDRAWN'] },
    at: Date,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: String,
    values,
  }],
}, { timestamps: true });
schema.index({ auftragNr: 1 });
schema.index({ mitarbeiter: 1, 'released.date': 1 });
module.exports = mongoose.model('Stundenzeit', schema);
