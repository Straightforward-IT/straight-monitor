const mongoose = require('mongoose');

const LohnartSchema = new mongoose.Schema({
  lohnartNummer: { type: String, required: true, unique: true, trim: true },
  lohnartKurzzeichen: { type: String, default: '' },
  lohnartBezeichnung: { type: String, default: '' },
  rechnungstext: { type: String, default: '' },
  kostenart: { type: String, default: '' },
  fremdLohnartNummer: { type: String, default: '' },
  berechnungsartCode: { type: String, default: '' },
  durchschnittsspeicherCode: { type: String, default: '' },
  zuschlagsProzent: { type: String, default: '' },
  zuschlagsgruppeWert: { type: String, default: '' },
  steuerartCode: { type: String, default: '' },
  steuerSpezialCode: { type: String, default: '' },
  sozialversicherungCode: { type: String, default: '' },
  pfaendungCode: { type: String, default: '' },
  auswerten: { type: String, default: '' },
  inStundenauswertung: { type: String, default: '' },
  gleitzeitCode: { type: String, default: '' },
  rechnungsspalte: { type: String, default: '' },
  berechnungsgrundlageSpalte: { type: String, default: '' },
  fakturierungCode: { type: String, default: '' },
  branchenzuschlagCode: { type: String, default: '' },
  branchenzuschlagLohnartNummer: { type: String, default: '' },
  branchenzuschlagPrioritaet: { type: String, default: '' },
  equalPayRelevanz: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Lohnart', LohnartSchema);