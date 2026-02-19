const mongoose = require("mongoose");

// ── EventReport Schema ──────────────────────────────────────
// NOTE: The `version` field was introduced on 2026-02-19 (v2 model unifying EventReport schema).
// Only documents created from that date onward carry this field. The ~3000 existing reports
// in the DB have no `version` field set, so version-based UI logic (e.g. the v2 badge)
// will only match a small number of recent documents — this is intentional.
const EventReportSchema = new mongoose.Schema(
  {
    version: { type: String, default: "v2" },
    location: { type: String, required: true },
    kunde: { type: String, required: true },
    auftragnummer: { type: String, required: false },
    name_teamleiter: { type: String, required: true },
    mitarbeiter_anzahl: { type: String, required: false },
    datum: {
      type: Date,
      required: true,
      set: (value) => {
        if (typeof value === "string") return new Date(value);
        if (value && typeof value === "object" && value.unix)
          return new Date(value.unix * 1000);
        return value;
      },
    },
    puenktlichkeit: { type: String, required: false },
    erscheinungsbild: { type: String, required: false },
    team: { type: String, required: false },
    mitarbeiter_job: { type: String, required: false },
    feedback_auftraggeber: { type: String, required: false },
    sonstiges: { type: String, required: false },
    mitarbeiter_feedback: [
      {
        mitarbeiter: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Mitarbeiter",
          required: false,
        },
        text: { type: String, required: false },
      },
    ],
    teamleiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mitarbeiter",
      required: false,
    },
    assigned: { type: Boolean, required: true, default: false },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ── Auto-populate ───────────────────────────────────────────
EventReportSchema.pre("find", function () {
  this.populate({ path: "teamleiter", select: "vorname nachname email" });
  this.populate({ path: "mitarbeiter_feedback.mitarbeiter", select: "_id vorname nachname email personalnr" });
});
EventReportSchema.pre("findOne", function () {
  this.populate({ path: "teamleiter", select: "vorname nachname email" });
  this.populate({ path: "mitarbeiter_feedback.mitarbeiter", select: "_id vorname nachname email personalnr" });
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

EventReportSchema.methods.toHtml = function () {
  return `
<strong>Location</strong>\n${this.location}\n
<strong>Datum</strong>\n${formatDateHTML(this.datum)}\n
<strong>Kunde</strong>\n${this.kunde}\n
<strong>Auftragnummer</strong>\n${this.auftragnummer || "-"}\n
<strong>Name Teamleiter</strong>\n${this.name_teamleiter}\n
<strong>Mitarbeiter Anzahl</strong>\n${this.mitarbeiter_anzahl || "-"}\n
<strong>Pünktlichkeit</strong>\n${this.puenktlichkeit || "-"}\n
<strong>Erscheinungsbild</strong>\n${this.erscheinungsbild || "-"}\n
<strong>Team</strong>\n${this.team || "-"}\n
<strong>Mitarbeiter Job</strong>\n${this.mitarbeiter_job || "-"}\n
<strong>Feedback Auftraggeber</strong>\n${this.feedback_auftraggeber || "-"}\n
<strong>Sonstiges</strong>\n${this.sonstiges || "-"}\n
<strong>Zugewiesen</strong>\n${this.assigned ? "Ja" : "Nein"}\n
  `;
};

// ── Indexes für query-basiertes Referenzieren ──────────────
EventReportSchema.index({ teamleiter: 1, version: 1 });
EventReportSchema.index({ datum: -1 });

const EventReport = mongoose.model("EventReport", EventReportSchema);

module.exports = { EventReport };
