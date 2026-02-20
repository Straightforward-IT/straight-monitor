const mongoose = require("mongoose");

// ── Status Enums ────────────────────────────────────────────
const LAUFZETTEL_STATUS = {
  OFFEN: "OFFEN",
  ABGESCHLOSSEN: "ABGESCHLOSSEN",
};

// ── Merged Laufzettel + Evaluierung Schema (v2) ────────────
// NOTE: The `version` field was introduced on 2026-02-19 alongside the merged
// Laufzettel + Evaluierung schema. Old Laufzettel documents in the DB have no
// `version` field. The schema default 'v2' only applies when Mongoose wraps
// results as full documents — always use .lean() in API queries so old docs
// correctly fall back to 'v1' via `doc.version || 'v1'`.
const LaufzettelSchema = new mongoose.Schema(
  {
    version: { type: String, default: "v2" },
    status: {
      type: String,
      enum: Object.values(LAUFZETTEL_STATUS),
      default: LAUFZETTEL_STATUS.OFFEN,
    },

    // ── Basis-Felder (ehemals Laufzettel) ───────────────────
    location: { type: String, required: true },
    name_mitarbeiter: { type: String, required: true },
    name_teamleiter: { type: String, required: true },
    mitarbeiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mitarbeiter",
      required: false,
    },
    teamleiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mitarbeiter",
      required: false,
    },
    assigned: { type: Boolean, required: true, default: false },
    auftragnummer: { type: Number, required: false },
    datum: {
      type: Date,
      required: false,
      set: (value) => {
        if (typeof value === "string") return new Date(value);
        if (value && typeof value === "object" && value.unix)
          return new Date(value.unix * 1000);
        return value;
      },
    },
    date: { type: Date, default: Date.now },

    // ── Evaluierung-Felder (ehemals EvaluierungMA) ──────────
    kunde: { type: String, required: false },
    puenktlichkeit: { type: String, required: false },
    grooming: { type: String, required: false },
    motivation: { type: String, required: false },
    technische_fertigkeiten: { type: String, required: false },
    lernbereitschaft: { type: String, required: false },
    sonstiges: { type: String, required: false },
  },
  { timestamps: true }
);

// ── Auto-populate ───────────────────────────────────────────
LaufzettelSchema.pre("find", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" },
    { path: "teamleiter", select: "vorname nachname email" },
  ]);
});

LaufzettelSchema.pre("findOne", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" },
    { path: "teamleiter", select: "vorname nachname email" },
  ]);
});

// ── Helper ──────────────────────────────────────────────────
const formatDateHTML = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

LaufzettelSchema.methods.toHtml = function () {
  let html = `
<strong>Location</strong>\n${this.location || "-"}\n
<strong>Datum</strong>\n${formatDateHTML(this.datum)}\n
<strong>Name Mitarbeiter</strong>\n${this.name_mitarbeiter || "-"}\n
<strong>Name Teamleiter</strong>\n${this.name_teamleiter || "-"}\n
<strong>Status</strong>\n${this.status}\n
<strong>Zugewiesen</strong>\n${this.assigned ? "Ja" : "Nein"}\n`;

  // Evaluierung-Teil nur anzeigen, wenn ausgefüllt
  if (this.status === LAUFZETTEL_STATUS.ABGESCHLOSSEN) {
    html += `
<strong>Kunde</strong>\n${this.kunde || "-"}\n
<strong>Pünktlichkeit</strong>\n${this.puenktlichkeit || "-"}\n
<strong>Grooming</strong>\n${this.grooming || "-"}\n
<strong>Motivation</strong>\n${this.motivation || "-"}\n
<strong>Technische Fertigkeiten</strong>\n${this.technische_fertigkeiten || "-"}\n
<strong>Lernbereitschaft</strong>\n${this.lernbereitschaft || "-"}\n
<strong>Sonstiges</strong>\n${this.sonstiges || "-"}\n`;
  }

  return html;
};

// ── Indexes für query-basiertes Referenzieren ──────────────
// Statt Arrays auf Mitarbeiter nutzen wir Queries:
//   Laufzettel.find({ mitarbeiter: userId })  → MA-Sicht
//   Laufzettel.find({ teamleiter: userId })   → TL-Sicht
LaufzettelSchema.index({ mitarbeiter: 1, version: 1, status: 1 });
LaufzettelSchema.index({ teamleiter: 1, version: 1, status: 1 });
LaufzettelSchema.index({ version: 1 });
LaufzettelSchema.index({ datum: -1 });

const Laufzettel = mongoose.model("Laufzettel", LaufzettelSchema);

module.exports = {
  Laufzettel,
  LAUFZETTEL_STATUS,
};
