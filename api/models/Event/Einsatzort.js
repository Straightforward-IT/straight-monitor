const mongoose = require('mongoose');

const EinsatzortSchema = new mongoose.Schema({
  // The Zvoove export is distinct by ADRESSE; this is the stable import key.
  addressKey: { type: String, unique: true, sparse: true, trim: true, index: true },
  bezeichnung: { type: String, default: '', trim: true },
  adresse: { type: mongoose.Schema.Types.ObjectId, ref: 'Adresse', default: null, index: true },
  kunde: { type: mongoose.Schema.Types.ObjectId, ref: 'Kunde', default: null, index: true },
  kundenAdresseNr: { type: String, default: '', trim: true, index: true },
  bundesland: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

EinsatzortSchema.plugin(require('../plugins/geodataInvalidation'), {
  fields: ['adresse'],
  addresses: async (row, session) => {
    if (!row.adresse) return [];
    const address = await require('../System/Adresse').findById(row.adresse)
      .select('strasse plz ort land nat').session(session || null).lean();
    return address ? [address] : [];
  },
});

module.exports = mongoose.model('Einsatzort', EinsatzortSchema);
