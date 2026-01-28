const mongoose = require('mongoose');

const EinsatzSchema = new mongoose.Schema({
  auftragNr: {
    type: Number, // AUFTRAGNR - Foreign Key zu Auftrag
    required: true
  },
  personalNr: {
    type: Number, // PERSONALNR
    required: false
  },
  berufSchl: {
    type: String, // BERUFSCHL
    required: false
  },
  qualSchl: {
    type: String, // QUALSCHL
    required: false
  },
  bezeichnung: {
    type: String, // BEZEICHN
    required: false
  },
  datumVon: {
    type: Date, // DATUMVON
    required: false
  },
  datumBis: {
    type: Date, // DATUMBIS
    required: false
  },
  cProtBediener: {
    type: String, // CPROTBEDIENER
    required: false
  },
  dtProtDatum: {
    type: Date, // DTPROTDATUM
    required: false
  },
  idAuftragArbeitsschichten: {
    type: Number, // ID_AUFTRAG_ARBEITSSCHICHTEN - Gruppierung innerhalb eines Auftrags
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Einsatz', EinsatzSchema);
