const mongoose = require('mongoose');

/**
 * LeadLabel — Custom field definition for Leads
 *
 * Sales reps can define their own fields that appear on every Lead form.
 * The key is a URL-safe slug auto-generated from the name and stored as the
 * canonical identifier so that renaming the label doesn't break stored values.
 *
 * fieldType variants:
 *   text | number | currency | date | checkbox | dropdown | multiselect | phone | email | url
 *
 * options is only used for dropdown / multiselect types.
 */
const LeadLabelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
    },

    fieldType: {
      type: String,
      required: true,
      enum: ['text', 'number', 'currency', 'date', 'checkbox', 'dropdown', 'multiselect', 'phone', 'email', 'url', 'address'],
      default: 'text',
    },

    // Only relevant for dropdown / multiselect
    options: [
      {
        label: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
        color: { type: String, default: null }, // optional hex color for colored chips
      },
    ],

    required: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadLabel', LeadLabelSchema);
