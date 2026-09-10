const mongoose = require('mongoose');

const FieldChange = new mongoose.Schema({
  field: { type: String, required: true },
  label: { type: String, required: true },
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  beforeLabel: String,
  afterLabel: String,
}, { _id: false });

const AuftragChronikEntrySchema = new mongoose.Schema({
  auftragId: { type: mongoose.Schema.Types.ObjectId, required: true },
  auftragNr: { type: Number, required: true },
  orderTitle: { type: String, default: '' },
  locationV2: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  kind: { type: String, enum: ['change', 'note'], required: true },
  action: { type: String, required: true },
  actor: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
  },
  summary: { type: String, required: true },
  text: { type: String, trim: true, maxlength: 5000 },
  changes: [{
    _id: false,
    entity: { type: String, enum: ['Auftrag', 'Schicht', 'Einsatz'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, required: true },
    action: { type: String, enum: ['created', 'updated', 'deleted'], required: true },
    fields: [FieldChange],
  }],
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });

// Use the stable order identity: a reused order number must not inherit another order's history.
AuftragChronikEntrySchema.index({ auftragId: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('AuftragChronikEntry', AuftragChronikEntrySchema);
