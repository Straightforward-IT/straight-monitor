const mongoose = require('mongoose');

const DocuSealTemplateConfigSchema = new mongoose.Schema({
  docusealTemplateId: { type: Number, required: true, unique: true, index: true },
  defaultTyp: { type: mongoose.Schema.Types.ObjectId, ref: 'SignaturTyp', default: null },
}, { timestamps: true });

module.exports = mongoose.model('DocuSealTemplateConfig', DocuSealTemplateConfigSchema);