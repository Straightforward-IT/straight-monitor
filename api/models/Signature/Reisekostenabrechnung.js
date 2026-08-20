const mongoose = require('mongoose');

/**
 * Reisekostenabrechnung — persisted, editable travel-expense document.
 *
 * Created in-app from an Auftrag/Einsatz for a specific Mitarbeiter, filled out in a
 * modal, then rendered to PDF (stored in R2). Editable while status === 'draft';
 * locked once a signature process starts.
 *
 * All monetary values are stored as INTEGER CENTS.
 */

// Generic itemized expense line (Fahrtkosten, Übernachtung, Nebenkosten).
const BetragRowSchema = new mongoose.Schema({
  bezeichnung:   { type: String, default: '' },
  bemessungCent: { type: Number, default: 0 },
  betragCent:    { type: Number, default: 0 },
  prozent:       { type: Number, default: 0 },  // VAT rate; Vorsteuer is derived from betrag+prozent
}, { _id: false });

// Kilometergeldpauschale line: km × Satz (Cent/km).
const KmRowSchema = new mongoose.Schema({
  bezeichnung: { type: String, default: '' },
  start:       { type: String, default: '' },
  ziel:        { type: String, default: '' },
  kilometer:   { type: Number, default: 0 },
  satzCent:    { type: Number, default: 0 },
}, { _id: false });

// Pauschale line: Anzahl/Tage × Satz (Cent).
const PauschalRowSchema = new mongoose.Schema({
  anzahl:   { type: Number, default: 0 },
  tage:     { type: Number, default: 0 },
  satzCent: { type: Number, default: 0 },
}, { _id: false });

const ReisekostenabrechnungSchema = new mongoose.Schema({
  // Context links
  auftragNr:   { type: Number, default: null, index: true },
  mitarbeiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Mitarbeiter', default: null, index: true },
  personalNr:  { type: Number, default: null },
  locationV2:  { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },

  // Header fields
  kopf: {
    titel:           { type: String, default: '' },
    name:            { type: String, default: '' },
    vorname:         { type: String, default: '' },
    firma:           { type: String, default: 'H. & P. Straightforward GmbH' },
    zweck:           { type: String, default: '' },
    reiseziel:       { type: String, default: '' }, // kept for backward compat
    start:           { type: String, default: '' },
    ziel:            { type: String, default: '' },
    reisebeginn:     { type: Date, default: null },
    reiseende:       { type: Date, default: null },
    transportmittel: { type: String, default: 'privatpkw' }, // dienstwagen|privatpkw|mietwagen|bahn|flugzeug
    tage:            { type: Number, default: 0 },
    stunden:         { type: String, default: '' },
    nummernschild:   { type: String, default: '' },
    kostenstelle:    { type: String, default: '' }, // KST, aus Location abgeleitet
  },

  // Cost sections
  fahrtkosten:        { type: [BetragRowSchema], default: [] },
  kilometerpauschale: { type: [KmRowSchema], default: [] },
  uebernachtung:      { type: [BetragRowSchema], default: [] },
  pauschalen: {
    uebernachtungen: { type: [PauschalRowSchema], default: [] },
    tage24:          { type: PauschalRowSchema, default: () => ({}) },
    tage14:          { type: PauschalRowSchema, default: () => ({}) },
    tage8:           { type: PauschalRowSchema, default: () => ({}) },
  },
  nebenkosten:  { type: [BetragRowSchema], default: [] },

  // Reisedaten — generierte Fahrtstrecken-Tabelle (Datum/Start/Ziel/km), als eigene
  // Seite hinter die Signaturseite gehängt.
  reisedaten: {
    type: [{
      datum:     { type: Date, default: null },
      start:     { type: String, default: '' },
      ziel:      { type: String, default: '' },
      kilometer: { type: Number, default: 0 },
    }],
    default: [],
  },

  vorschussCent: { type: Number, default: 0 },
  ort:           { type: String, default: '' },

  // Angehängte Belege (Screenshots/PDFs) — werden ans Signatur-Dokument gehängt.
  anlagen: {
    type: [{
      key:         { type: String, required: true },
      filename:    { type: String, default: '' },
      contentType: { type: String, default: '' },
      size:        { type: Number, default: 0 },
    }],
    default: [],
  },

  // Server-computed totals (cents) — persisted for listing/export.
  summen: {
    bruttoCent:           { type: Number, default: 0 },
    vorsteuerGesamtCent:  { type: Number, default: 0 },
    nettoCent:            { type: Number, default: 0 },
    auszuzahlenCent:      { type: Number, default: 0 },
  },

  // Storage & lifecycle
  r2Key:  { type: String, default: '' }, // unsigned PDF in R2
  status: { type: String, enum: ['draft', 'signature_pending', 'completed'], default: 'draft' },
  signaturVorgang: { type: mongoose.Schema.Types.ObjectId, ref: 'SignaturVorgang', default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Reisekostenabrechnung', ReisekostenabrechnungSchema);
