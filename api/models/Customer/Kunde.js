const mongoose = require('mongoose');

const KundeSchema = new mongoose.Schema({
  kundenNr: {
    type: Number, // KUNDENNR
    required: true,
    unique: true
  },
  kundName: {
    type: String, // KUNDNAME
    required: false
  },kundBez: {
    type: String, // KUNDBEZ
    required: false
  },
  kundeSeit: {
    type: Date, // KUNDESEIT
    required: false
  },
  kundStatus: {
    type: Number, // KUNDSTATUS: 1=Potentiell, 2=Aktiv, 3=Inaktiv
    required: false,
    enum: [1, 2, 3] 
  },
  geschSt: {
    type: String, // GESCHST
    required: false
  },
  locationV2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    default: null,
    index: true,
  },
  kostenSt: {
    type: String, // KOSTENST
    required: false
  },
  zvoove_debitorkonto: {
    type: String, // DEBITORKTO
    required: false,
    default: null
  },
  sammelrechnung: {
    type: Boolean, // SAMMELRECH: A = true
    required: false,
    default: false
  },
  ustId: {
    type: String, // USTID
    required: false,
    default: null
  },
  steuerNummer: {
    type: String, // STEUERNUMMER
    required: false,
    default: null
  },
  handelsregisterNr: {
    type: String, // HANDELSREGISTERNR
    required: false,
    default: null
  },
  l1RechGruppe: {
    type: String, // L1RECHGRUPPE
    required: false,
    default: null
  },
  kuerzel: {
    type: String,
    required: false,
    default: null
  },
  bemerkung: {
    type: [String], // Array aus BEMERKUNG, BEMERKUNG2, BEMERKUNG3
    required: false
  },
  adressen: [{
    nummer: { type: Number, required: false }, // ADRx_NUMMER
    name: { type: String, required: false }, // ADRx_LNAME (LNAME1 + LNAME2)
    branche: { type: String, required: false }, // ADRx_BRANCHE
    lbranche: { type: String, required: false }, // ADRx_LBRANCHE
    strasse: { type: String, required: false }, // ADRx_STRASSE
    plz: { type: String, required: false }, // ADRx_PLZ
    ort: { type: String, required: false }, // ADRx_ORT
    land: { type: String, required: false }, // ADRx_LAND
    telefon1: { type: String, required: false }, // ADRx_TELEFON1
    telefon2: { type: String, required: false }, // ADRx_TELEFON2
    email: { type: String, required: false }, // ADRx_EMAIL
    homepage: { type: String, required: false } // ADRx_HOMEPAGE
  }],
  kontakte: [{
    vorname: { type: String, required: false },
    nachname: { type: String, required: true },
    email: { type: String, required: false },
    telefon: { type: String, required: false },
    angelegtVon: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kommentare: [{
      text: String,
      datum: { type: Date, default: Date.now },
      verfasser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  }],
  // Default contact for signature processes (MS Graph contact)
  signaturKontaktId:    { type: String, default: null },
  signaturKontaktEmail: { type: String, default: null },
  inactiveMicrosoftContactIds: [{ type: String, trim: true }],
  // Stable R2 folder name for customer-related signature documents.
  signaturOrdner:       { type: String, default: null, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Kunde', KundeSchema);
