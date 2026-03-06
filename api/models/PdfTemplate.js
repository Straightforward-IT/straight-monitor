const mongoose = require('mongoose');

// A single PDF file that is part of a template
const PdfFileSchema = new mongoose.Schema({
  id:        { type: String, required: true },   // uuid, used as stable reference
  filename:  { type: String, required: true },
  pdfData:   { type: Buffer, required: true },
  pageCount: { type: Number, default: 1 },
  order:     { type: Number, default: 0 },        // display / merge order
}, { _id: false });

// A named bookmark (Textmarke) – can be placed multiple times on any page
const BookmarkSchema = new mongoose.Schema({
  id:           { type: String, required: true },
  label:        { type: String, required: true },
  // Who fills this bookmark:
  //   'bediener'    = the logged-in operator fills it on the website
  //   'mitarbeiter' = the employee fills it via the email-link form
  fillRole:     { type: String, enum: ['bediener', 'mitarbeiter'], default: 'bediener' },
  dataType:     { type: String, enum: ['text', 'date', 'checkbox'], default: 'text' },
  defaultValue: { type: String, default: '' },
}, { _id: false });

// A concrete placement of a bookmark on a specific page of a specific PDF
const PlacementSchema = new mongoose.Schema({
  id:         { type: String, required: true },   // uuid for this placement instance
  bookmarkId: { type: String, required: true },
  pdfIndex:   { type: Number, required: true },   // index into pdfs[] sorted by order
  page:       { type: Number, required: true },   // 0-indexed page within that PDF
  x:          { type: Number, required: true },   // % of page width
  y:          { type: Number, required: true },   // % of page height
  width:      { type: Number, default: 20 },      // % of page width
  height:     { type: Number, default: 5 },       // % of page height (used for checkboxes)
  fontSize:   { type: Number, default: 11 },
}, { _id: false });

const PdfTemplateSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  pdfs:        [PdfFileSchema],
  bookmarks:   [BookmarkSchema],
  placements:  [PlacementSchema],
  // Incremented every time bookmarks, placements or PDFs change.
  // Vorgänge store the version they were created with so stale ones can be flagged.
  version:     { type: Number, default: 1 },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

PdfTemplateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Virtual: total page count (sum across all PDFs)
PdfTemplateSchema.virtual('totalPageCount').get(function () {
  return this.pdfs.reduce((s, p) => s + (p.pageCount || 0), 0);
});

module.exports = mongoose.model('PdfTemplate', PdfTemplateSchema);
