const mongoose = require('mongoose');

/**
 * LeadConfig — Singleton configuration document for the Leads module.
 *
 * Stores user-configurable default field options:
 *   - quelleOptions: available "Quelle" (source) values for leads
 *   - currencies:    available currencies for the Wert (value) field
 *
 * Only one document exists in this collection. Use findOne() / findOneAndUpdate({}, ..., { upsert: true }).
 */
const LeadConfigSchema = new mongoose.Schema(
  {
    quelleOptions: [
      {
        label: { type: String, required: true, trim: true, maxlength: 80 },
        value: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9_]+$/ },
      },
    ],
    currencies: [{ type: String, uppercase: true, trim: true, maxlength: 3 }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadConfig', LeadConfigSchema);
