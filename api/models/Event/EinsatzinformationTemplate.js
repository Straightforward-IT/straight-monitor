const mongoose = require('mongoose');

const EinsatzinformationTemplateSchema = new mongoose.Schema({
  kunde: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', required: true, index: true },
  einsatzort: { type: mongoose.Schema.Types.ObjectId, ref: 'Einsatzort', default: null, index: true },
  beruf: { type: mongoose.Schema.Types.ObjectId, ref: 'Beruf', default: null },
  qualifikation: { type: mongoose.Schema.Types.ObjectId, ref: 'Qualifikation', default: null },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  htmlTemplate: { type: String, required: true, maxlength: 100000 },
  isActive: { type: Boolean, default: true, index: true },
  version: { type: Number, default: 1, min: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

EinsatzinformationTemplateSchema.index(
  { kunde: 1, einsatzort: 1, beruf: 1, qualifikation: 1 },
  { unique: true, name: 'unique_einsatzinformation_scope' },
);

module.exports = mongoose.model('EinsatzinformationTemplate', EinsatzinformationTemplateSchema);
