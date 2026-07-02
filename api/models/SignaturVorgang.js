const mongoose = require('mongoose');

// One signer on a DocuSeal submission (customer, employee, or Graph contact).
const SubmitterSchema = new mongoose.Schema({
  role:        { type: String, default: '' },    // DocuSeal role name, e.g. 'Verleiher', 'Entleiher'
  name:        { type: String, default: '' },
  email:       { type: String, default: '' },
  slug:        { type: String, default: '' },    // signer slug → /s/{slug} signing URL
  embedSrc:    { type: String, default: '' },    // full embed URL returned by DocuSeal
  embedded:    { type: Boolean, default: false }, // true = signed embedded in our app (no email)
  status:      { type: String, default: 'awaiting' }, // awaiting | sent | opened | completed | declined
  completedAt: { type: Date, default: null },
}, { _id: false });

/**
 * SignaturVorgang — replaces DocuSealVorgang for all new signature requests.
 *
 * Key differences from DocuSealVorgang:
 *   - Explicit standort (Niederlassung) field
 *   - Structured R2 path: Signatures/{kunden|mitarbeiter}/{id}/{typKey}/{date}/
 *   - Richer status: draft → open → completed | cancelled
 *   - Linked to SignaturTyp collection (extensible document types)
 *   - Both R2 signed PDF and audit PDF are stored
 *   - Microsoft Graph contacts embedded without DB reference
 *
 * Migration: DocuSealVorgang is kept intact for historical records.
 * New submissions created via /api/signaturen use this model.
 */
const SignaturVorgangSchema = new mongoose.Schema({
  name:    { type: String, required: true },

  // Document type — references SignaturTyp collection
  typ:     { type: mongoose.Schema.Types.ObjectId, ref: 'SignaturTyp', required: true },
  // Denormalized from SignaturTyp.key at creation — used for R2 path building.
  // Not updated if the type is renamed later, ensuring stable file paths.
  typKey:  { type: String, required: true },

  // Location (team key from teams.json): 'hamburg', 'berlin', 'koeln', 'it', 'hr', 'rs'
  standort: { type: String, default: null },

  // Lifecycle status
  status: {
    type: String,
    enum: ['draft', 'open', 'completed', 'cancelled'],
    default: 'draft',
  },

  // ── Entity links (all optional, at most one primary entity per document) ──

  // Internal employee
  mitarbeiter:     { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', default: null },
  // Denormalized "{Vorname}-{Nachname}" slug — used for R2 path, set at creation.
  mitarbeiterName: { type: String, default: null },

  // Internal customer
  kunde:         { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', default: null },
  kundenNr:      { type: Number, default: null },
  // Denormalized from Kunde.kuerzel — required if kunde is set (validated at route layer).
  // Used as the R2 folder name under Signatures/kunden/{kuerzel}/
  kundenKuerzel: { type: String, default: null },

  // Linked Auftrag — set for Stundenliste and similar event-based signatures
  auftragNr:   { type: Number, default: null },

  // Microsoft Graph contact (not a DB record — embedded for historical reference)
  graphContact: {
    id:          { type: String, default: null },
    displayName: { type: String, default: null },
    email:       { type: String, default: null },
  },

  // ── DocuSeal integration ──────────────────────────────────────────────────

  docusealTemplateId:   { type: Number, default: null },
  docusealTemplateName: { type: String, default: '' },
  submissionId:         { type: Number, default: null },

  submitters: { type: [SubmitterSchema], default: [] },

  // ── R2 storage ────────────────────────────────────────────────────────────

  // Prefix stored at creation time (immutable) so webhooks can place files correctly.
  // e.g. 'Signatures/kunden/sfhh/stundenliste/2026-06-25'
  r2Prefix:    { type: String, default: '' },
  // Full R2 key of the signed document (set when DocuSeal webhook fires)
  r2KeySigned: { type: String, default: '' },
  // Full R2 key of the DocuSeal audit trail PDF
  r2KeyAudit:  { type: String, default: '' },

  // ── Folgeaktionen (optional, executed after submission.completed) ──────────

  folgeaktionen: {
    // E-mail addresses to receive the signed PDF once the submission is done
    ausliefernAn: {
      type: [{ displayName: { type: String, default: '' }, email: { type: String, default: '' } }],
      default: [],
    },
    // If false → send_email:false is passed to DocuSeal (no signing-request emails)
    emailBenachrichtigung: { type: Boolean, default: true },
    // Asana tasks to act on after completion
    asanaActions: {
      type: [{
        type:     { type: String, enum: ['complete', 'comment', 'delete'], required: true },
        taskGid:  { type: String, required: true },
        taskName: { type: String, default: '' },
        comment:  { type: String, default: '' }, // only used when type === 'comment'
      }],
      default: [],
    },
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

SignaturVorgangSchema.index({ submissionId: 1 }, { sparse: true });
SignaturVorgangSchema.index({ status: 1 });
SignaturVorgangSchema.index({ standort: 1 });
SignaturVorgangSchema.index({ kunde: 1 });
SignaturVorgangSchema.index({ mitarbeiter: 1 });
SignaturVorgangSchema.index({ auftragNr: 1 }, { sparse: true });
SignaturVorgangSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SignaturVorgang', SignaturVorgangSchema);
