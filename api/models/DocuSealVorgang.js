const mongoose = require('mongoose');

// One signer on a DocuSeal submission (customer or employee).
const SubmitterSchema = new mongoose.Schema({
  role:        { type: String, default: '' },          // DocuSeal role name, e.g. "Kunde" / "Mitarbeiter"
  name:        { type: String, default: '' },
  email:       { type: String, default: '' },
  slug:        { type: String, default: '' },          // signer slug → /s/{slug} signing URL
  embedSrc:    { type: String, default: '' },          // full embed URL returned by DocuSeal
  embedded:    { type: Boolean, default: false },       // true = signed embedded in our app (no email)
  status:      { type: String, default: 'awaiting' },   // awaiting | sent | opened | completed | declined
  completedAt: { type: Date, default: null },
}, { _id: false });

const DocuSealVorgangSchema = new mongoose.Schema({
  name: { type: String, required: true },

  // Reference to the DocuSeal dashboard template used for this request.
  // Optional: one-off submissions created directly from a PDF have no template.
  docusealTemplateId:   { type: Number, default: null },
  docusealTemplateName: { type: String, default: '' },

  // DocuSeal submission identifiers (set after createSubmission).
  submissionId: { type: Number, index: true },

  // Optional link to an internal record this signing request belongs to.
  linkedEntity: {
    type: {
      type: String,
      enum: ['Mitarbeiter', 'Kunde', 'Bewerber', 'Auftrag', null],
      default: null,
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },

  // Auftrag (Event) this signing request was generated for, if any.
  auftragNr: { type: Number, default: null, index: true },

  submitters: { type: [SubmitterSchema], default: [] },

  // Overall lifecycle status, driven by DocuSeal webhooks.
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired', 'archived'],
    default: 'pending',
  },

  // Signed document, stored in R2 once the submission is completed.
  signedPdfKey: { type: String, default: '' },
  auditLogUrl:  { type: String, default: '' },

  completedAt: { type: Date, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DocuSealVorgangSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('DocuSealVorgang', DocuSealVorgangSchema);
