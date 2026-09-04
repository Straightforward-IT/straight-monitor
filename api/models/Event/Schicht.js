const mongoose = require('mongoose');

const SchichtSchema = new mongoose.Schema({
  auftragNr: {
    type: Number, // AUFTRAGNR - Foreign Key zu Auftrag
    required: true
  },
  locationV2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
    index: true,
  },
  source: {
    type: String,
    enum: ['monitor', 'zvoove'],
    default: 'zvoove',
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  idAuftragArbeitsschichten: {
    type: Number, // ID_AUFTRAG_ARBEITSSCHICHTEN - Zvoove Shift ID
    required: false,
    default: null,
  },

  // --- Schicht Infos (aus AUFTRAG_ARBEITSSCHICHTEN) ---
  bezeichnung: { type: String }, // BEZEICHNUNG
  treffpunkt: { type: String }, // TREFFPUNKTUHRZEIT
  treffpunktOrt: { type: String }, // TREFFPUNKTORT
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
  berufSchl: { type: String },
  qualSchl: { type: String },
  bedarf: { type: Number }, // BEDARF (geplanter Personalbedarf)
  garantiestundenLohn: { type: Number }, // GARANTIESTD_LOHN
  endeOffen: { type: Number }, // ENDEOFFEN (0/1)

  // --- Aggregierte Besetzung (aus SQL-Abfrage) ---
  besetzt: { type: Number, default: 0 }, // COUNT(e.PERSONALNR)
  offen: { type: Number, default: 0 }, // BEDARF - COUNT(e.PERSONALNR)
  einsatzinformation: {
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'EinsatzinformationTemplate', default: null },
    templateVersion: { type: Number, default: null },
    resolution: { type: String, default: 'manual' },
    sourceHtml: { type: String, default: '', maxlength: 100000 },
    renderedHtml: { type: String, default: '', maxlength: 200000 },
    unresolvedPlaceholders: [{ type: String }],
    customized: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
}, { timestamps: true });

SchichtSchema.index({ auftragNr: 1, idAuftragArbeitsschichten: 1, datumVon: 1 });
SchichtSchema.index({ datumVon: 1, datumBis: 1 });

module.exports = mongoose.model('Schicht', SchichtSchema);
