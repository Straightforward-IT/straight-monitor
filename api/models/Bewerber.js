const mongoose = require("mongoose");

const FUHRERSCHEIN_KLASSEN = [
  "B",
  "BE",
  "A",
  "A1",
  "C1",
  "C1E",
  "C",
  "CE",
  "D1",
  "D1E",
  "D",
  "DE",
  "L",
  "T",
  "M",
];

const BewerberDokumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    contentType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ["studienbescheinigung", "sonstiges"],
      default: "sonstiges",
    },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const BewerberEinladungSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["vertrag", "vertrag_service", "vertrag_logistik"],
      required: true,
    },
    recipient: { type: String, required: true, lowercase: true, trim: true },
    appointmentAt: { type: Date, required: true },
    senderName: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    accessTokenHash: { type: String, required: true, select: false },
    accessCodeHash: { type: String, required: true, select: false },
    revokedAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    failedAttempts: { type: Number, default: 0, min: 0 },
    attachmentDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BewerberEmailDocument" }],
  },
  { _id: true }
);

const BewerberSchema = new mongoose.Schema(
  {
    asana_id: { type: String, trim: true, sparse: true, unique: true },
    asana_permalink: { type: String, trim: true, default: "" },
    teamKey: { type: String, required: true, trim: true, lowercase: true },

    anrede: { type: String, enum: ["Herr", "Frau", ""], default: "" },
    vorname: { type: String, required: true, trim: true },
    nachname: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    telefon: { type: String, trim: true, default: "" },
    strasse: { type: String, trim: true, default: "" },
    plz: { type: String, trim: true, default: "" },
    ort: { type: String, trim: true, default: "" },
    wohnsitz: { type: String, trim: true, default: "" },
    staatsangehoerigkeit: { type: String, trim: true, default: "" },
    familienstand: { type: String, trim: true, default: "" },

    fuehrerscheine: [{ type: String, enum: FUHRERSCHEIN_KLASSEN }],
    eigenesAuto: { type: Boolean, default: null },
    nutzungsberechtigung: { type: Boolean, default: null },
    reisebereitschaft: { type: Boolean, default: null },
    deutschlandticket: { type: Boolean, default: null },
    hat70TageGearbeitet: { type: Boolean, default: null },
    tage70Regelung: { type: Number, min: 0, max: 366, default: null },
    studiumStatus: {
      type: String,
      enum: ["eingeschrieben", "studienabsicht", "nein", ""],
      default: "",
    },

    documents: { type: [BewerberDokumentSchema], default: [] },
    invitations: { type: [BewerberEinladungSchema], default: [] },
    status: {
      type: String,
      enum: ["neu", "eingeladen", "formular_geoeffnet", "eingereicht", "abgelaufen"],
      default: "neu",
    },
    submittedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

BewerberSchema.pre("validate", function setExpiryAndValidateDependencies(next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(this.createdAt ? this.createdAt.getTime() + 28 * 24 * 60 * 60 * 1000 : Date.now() + 28 * 24 * 60 * 60 * 1000);
  }

  if (this.hat70TageGearbeitet !== true) this.tage70Regelung = null;
  if (this.eigenesAuto !== true) this.nutzungsberechtigung = null;

  next();
});

BewerberSchema.index({ teamKey: 1, status: 1, createdAt: -1 });
BewerberSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("Bewerber", BewerberSchema);
module.exports.FUHRERSCHEIN_KLASSEN = FUHRERSCHEIN_KLASSEN;
