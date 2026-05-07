const mongoose = require('mongoose');

/**
 * Lead — Pipedrive-inspired sales lead model
 *
 * A Lead represents an early-stage sales opportunity, typically before it
 * becomes a formal Auftrag. It can optionally be linked to an existing Kunde
 * and/or a single contact person.
 *
 * Custom fields are stored as a flat map keyed by the LeadLabel.key slug.
 * Example: { unternehmensgroesse: "50-100", budget_genehmigt: true }
 *
 * Pipeline stages (stufe):
 *   neu → qualifiziert → angebot → verhandlung → (won | lost)
 */

const NotizenSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    verfasser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    verfasserName: { type: String, default: '' },
  },
  { timestamps: true }
);

const LeadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // Monetary value of the opportunity
    wert: {
      type: Number,
      default: null,
      min: 0,
    },
    waehrung: {
      type: String,
      default: 'EUR',
      uppercase: true,
      maxlength: 3,
    },

    status: {
      type: String,
      enum: ['open', 'won', 'lost', 'archived'],
      default: 'open',
      index: true,
    },

    stufe: {
      type: String,
      enum: ['neu', 'qualifiziert', 'angebot', 'verhandlung', 'gewonnen', 'verloren'],
      default: 'neu',
      index: true,
    },

    // Lead source
    quelle: {
      type: String,
      enum: ['web', 'messe', 'empfehlung', 'kaltakquise', 'social_media', 'sonstiges'],
      default: null,
    },

    eigentuemer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    angelegtVon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Optional link to an existing customer record
    kunde: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Kunde',
      default: null,
      index: true,
    },

    // Microsoft Graph contact link (legacy — single contact, kept for backwards compat)
    msContact: {
      id:          { type: String, default: null },
      upn:         { type: String, default: null },
      displayName: { type: String, default: null },
      email:       { type: String, default: null },
    },

    // Microsoft Graph contacts — multiple contacts per lead
    msContacts: {
      type: [{
        id:          { type: String },
        upn:         { type: String },
        displayName: { type: String },
        email:       { type: String },
      }],
      default: [],
    },

    // Embedded contact — used when no Kunde record exists yet
    kontakt: {
      vorname:  { type: String, default: null, trim: true },
      nachname: { type: String, default: null, trim: true },
      email:    { type: String, default: null, trim: true },
      telefon:  { type: String, default: null, trim: true },
      firma:    { type: String, default: null, trim: true },
    },

    // Simple colored tags (free-text or predefined)
    labels: {
      type: [String],
      default: [],
    },

    erwartetesAbschlussDatum: {
      type: Date,
      default: null,
    },

    // Reason if status = 'lost'
    verlorenGrund: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    // Activity / note log
    notizen: [NotizenSchema],

    /**
     * Custom field values — keyed by LeadLabel.key
     * Example: { unternehmensgroesse: "50-200", budget_genehmigt: true }
     *
     * Using Mixed type so any field type (string, number, boolean, Date) can be stored.
     * Validation is intentionally left to the application layer.
     */
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Compound indexes for common filter patterns
LeadSchema.index({ status: 1, eigentuemer: 1 });
LeadSchema.index({ stufe: 1, status: 1 });
LeadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', LeadSchema);
