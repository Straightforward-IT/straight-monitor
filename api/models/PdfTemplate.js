const mongoose = require('mongoose');

const FieldSchema = new mongoose.Schema({
  id: { type: String, required: true },          // unique field id (uuid)
  type: {
    type: String,
    enum: ['text', 'date', 'checkbox', 'signature'],
    required: true
  },
  label: { type: String, required: true },        // human label, also used as form key
  page: { type: Number, required: true },         // 0-indexed page number
  x: { type: Number, required: true },            // position in % of page width
  y: { type: Number, required: true },            // position in % of page height
  width: { type: Number, default: 20 },           // % of page width
  height: { type: Number, default: 5 },           // % of page height
  fontSize: { type: Number, default: 11 },
  defaultValue: { type: String, default: '' }
}, { _id: false });

const PdfTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  filename: { type: String, required: true },
  pdfData: { type: Buffer, required: true },      // raw PDF bytes
  pageCount: { type: Number, default: 1 },
  fields: [FieldSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PdfTemplateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PdfTemplate', PdfTemplateSchema);
