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
  },
  // --- Schicht Infos (aus AUFTRAG_ARBEITSSCHICHTEN) ---
  schichtBezeichnung: { type: String, required: false }, // BEZEICHNUNG
  treffpunkt: { type: String, required: false }, // TREFFPUNKTUHRZEIT
  ansprechpartnerName: { type: String, required: false }, // ANSP_NAME
  ansprechpartnerTelefon: { type: String, required: false }, // ANSP_TELEFON
  ansprechpartnerEmail: { type: String, required: false }, // ANSP_EMAIL
  letzteAusschreibung: { type: Date, required: false }, // LETZTEAUSSCHREIBUNG

  // --- Detail Infos (aus AUFTRAG_ARBEITSSCHICHTENDETAIL) ---
  detailDatumVon: { type: Date, required: false }, // DETAIL_DATUMVON
  detailDatumBis: { type: Date, required: false }, // DETAIL_DATUMBIS
  uhrzeitVon: { type: String, required: false }, // UHRZEITVON
  uhrzeitBis: { type: String, required: false }, // UHRZEITBIS
  typ: { type: String, required: false }, // TYP
  bedarf: { type: Number, required: false }, // BEDARF
  garantiestundenLohn: { type: Number, required: false }, // GARANTIESTD_LOHN
  endeOffen: { type: Number, required: false } // ENDEOFFEN (0/1?)
}, { timestamps: true });

module.exports = mongoose.model('Einsatz', EinsatzSchema);
