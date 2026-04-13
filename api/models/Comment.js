const mongoose = require('mongoose');

/**
 * Unified Comment model — scopes: 'dispo_day', 'chronik', 'event_report', ...
 *
 * context fields are optional and scope-dependent:
 *   dispo_day  → context.mitarbeiter + context.datum
 *   chronik    → context.mitarbeiter
 *   event_report → context.resourceId ('EventReport') + optional context.mitarbeiter
 */
const CommentSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      required: true,
      index: true,
      // Open enum — new scopes can be added without schema changes
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    author: { type: String, default: '' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    context: {
      mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', index: true },
      datum:        { type: String },                // 'YYYY-MM-DD'
      resourceId:   { type: mongoose.Schema.Types.ObjectId },
      resourceType: { type: String },               // e.g. 'EventReport'
      legacyId:     { type: mongoose.Schema.Types.ObjectId }, // migration: original _id
    },
  },
  { timestamps: true }
);

// Compound indexes for the most common lookup patterns
CommentSchema.index({ scope: 1, 'context.mitarbeiter': 1 });
CommentSchema.index({ scope: 1, 'context.datum': 1 });
CommentSchema.index({ scope: 1, 'context.resourceId': 1 });

module.exports = mongoose.model('Comment', CommentSchema);
