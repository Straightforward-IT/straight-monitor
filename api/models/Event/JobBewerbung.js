const mongoose = require('mongoose');

const JobBewerbungSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  auftragNr: {
    type: Number,
    default: null,
    index: true,
  },
  schicht: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schicht',
    default: null,
    index: true,
  },
  idAuftragArbeitsschichten: {
    type: Number,
    default: null,
  },
  schichtBezeichnung: {
    type: String,
    default: null,
    trim: true,
  },
  jobTitle: {
    type: String,
    default: null,
    trim: true,
  },
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mitarbeiter',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['submitted', 'scheduled', 'confirmed', 'rejected'],
    default: 'submitted',
    required: true,
    index: true,
  },
  isReserve: {
    type: Boolean,
    default: false,
  },
  confirmationStep: {
    type: Number,
    default: 0,
    min: 0,
  },
  einsatz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Einsatz',
    default: null,
  },
  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  decidedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

JobBewerbungSchema.index({ jobId: 1, mitarbeiter: 1 }, { unique: true });
JobBewerbungSchema.index({ auftragNr: 1, status: 1 });

module.exports = mongoose.model('JobBewerbung', JobBewerbungSchema);
