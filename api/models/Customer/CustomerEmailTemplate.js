const mongoose = require('mongoose');

const CustomerEmailTemplateSchema = new mongoose.Schema({
  kunde: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', required: true, index: true },
  type: {
    type: String,
    enum: ['stundenliste-signature'],
    required: true,
  },
  subjectTemplate: { type: String, required: true, trim: true, maxlength: 300 },
  htmlTemplate: { type: String, required: true, maxlength: 100000 },
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1, min: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

CustomerEmailTemplateSchema.index(
  { kunde: 1, type: 1 },
  { unique: true, name: 'unique_customer_email_template_type' },
);

module.exports = mongoose.model('CustomerEmailTemplate', CustomerEmailTemplateSchema);
