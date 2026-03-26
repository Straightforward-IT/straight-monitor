/**
 * Rechnung – Invoice model
 *
 * Sensitive financial and operational fields are stored AES-256-GCM encrypted.
 * Only the fields needed for querying/joining (buchDatum, kundenNr, auftragNr,
 * rechnungNr) are stored in plaintext.
 *
 * Use Rechnung.decryptDoc(doc) to get a plain object with all fields decrypted
 * back to their original types (numbers parsed as floats, dates as ISO strings).
 */

const mongoose = require('mongoose');
const { decryptField } = require('../utils/encryption');

const RechnungSchema = new mongoose.Schema(
  {
    // ── Plaintext queryable fields ────────────────────────────────────────────
    buchDatum:   { type: Date,   index: true }, // needed for range queries
    kundenNr:    { type: Number },              // needed for customer joins
    auftragNr:   { type: Number },              // needed for order joins
    rechnungNr:  { type: String, unique: true, sparse: true }, // deduplication key

    // ── Encrypted fields (stored as AES-256-GCM JSON strings) ────────────────
    kostenSt:     { type: String }, // KOSTENST
    rechArt:      { type: String }, // RECHART
    rechStatus:   { type: String }, // RECHSTATUS
    rechnDatum:   { type: String }, // RECHNDATUM  (Date serialised to string before encrypt)
    natCode:      { type: String }, // NATCODE

    // D-currency amounts
    dNetto:       { type: String }, // DNETTO
    dMwst:        { type: String }, // DMWST
    dBrutto:      { type: String }, // DBRUTTO

    // EUR amounts
    eurNetto:     { type: String }, // EURNETTO
    eurMwst:      { type: String }, // EURMWST
    eurBrutto:    { type: String }, // EURBRUTTO

    // Base amounts
    netto:        { type: String }, // NETTO
    mwst:         { type: String }, // MWST
    brutto:       { type: String }, // BRUTTO

    // Other sensitive fields
    debitorKto:   { type: String }, // DEBITORKTO
    rechAltNr:    { type: String }, // RECHALTNR
    rechText:     { type: String }, // RECHTEXT
    lfdLeistNr:   { type: String }, // LFDLEISTNR
  },
  { timestamps: true }
);

/**
 * Returns a plain JS object with all encrypted fields decrypted back to their
 * original types.  Numeric fields are parsed as floats; date-ish strings are
 * returned as-is (display layer decides formatting).
 *
 * @param {mongoose.Document|Object} doc - A Rechnung document (lean or hydrated)
 * @returns {Object} decrypted plain object
 */
RechnungSchema.statics.decryptDoc = function (doc) {
  const raw = doc.toObject ? doc.toObject() : { ...doc };

  const numericFields = [
    'dNetto', 'dMwst', 'dBrutto',
    'eurNetto', 'eurMwst', 'eurBrutto',
    'netto', 'mwst', 'brutto'
  ];
  const stringFields = [
    'kostenSt', 'rechArt', 'rechStatus', 'rechnDatum',
    'natCode', 'debitorKto', 'rechAltNr', 'rechText', 'lfdLeistNr'
  ];

  const result = { ...raw };

  for (const field of stringFields) {
    result[field] = decryptField(raw[field]);
  }
  for (const field of numericFields) {
    const decrypted = decryptField(raw[field]);
    result[field] = decrypted !== null ? parseFloat(decrypted) : null;
  }

  return result;
};

module.exports = mongoose.model('Rechnung', RechnungSchema);
