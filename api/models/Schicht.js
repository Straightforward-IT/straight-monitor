const mongoose = require('mongoose');

const SchichtSchema = new mongoose.Schema({
  auftragNr: {
    type: Number, // AUFTRAGNR - Foreign Key zu Auftrag
    required: true
  },
  idAuftragArbeitsschichten: {
    type: Number, // ID_AUFTRAG_ARBEITSSCHICHTEN - Zvoove Shift ID
    required: true
  },

  // --- Schicht Infos (aus AUFTRAG_ARBEITSSCHICHTEN) ---
  bezeichnung: { type: String }, // BEZEICHNUNG
  treffpunkt: { type: String }, // TREFFPUNKTUHRZEIT
  ansprechpartnerName: { type: String }, // ANSP_NAME
  ansprechpartnerTelefon: { type: String }, // ANSP_TELEFON
  ansprechpartnerEmail: { type: String }, // ANSP_EMAIL
  letzteAusschreibung: { type: Date }, // LETZTEAUSSCHREIBUNG

  // --- Detail Infos (aus AUFTRAG_ARBEITSSCHICHTENDETAIL) ---
  datumVon: { type: Date }, // DETAIL_DATUMVON
  datumBis: { type: Date }, // DETAIL_DATUMBIS
  uhrzeitVon: { type: String }, // UHRZEITVON (HH:MM)
  uhrzeitBis: { type: String }, // UHRZEITBIS (HH:MM)
  typ: { type: String }, // TYP
  bedarf: { type: Number }, // BEDARF (geplanter Personalbedarf)
  garantiestundenLohn: { type: Number }, // GARANTIESTD_LOHN
  endeOffen: { type: Number }, // ENDEOFFEN (0/1)

  // --- Aggregierte Besetzung (aus SQL-Abfrage) ---
  besetzt: { type: Number, default: 0 }, // COUNT(e.PERSONALNR)
  offen: { type: Number, default: 0 } // BEDARF - COUNT(e.PERSONALNR)
}, { timestamps: true });

SchichtSchema.index({ auftragNr: 1, idAuftragArbeitsschichten: 1, datumVon: 1 });
SchichtSchema.index({ datumVon: 1, datumBis: 1 });

module.exports = mongoose.model('Schicht', SchichtSchema);
