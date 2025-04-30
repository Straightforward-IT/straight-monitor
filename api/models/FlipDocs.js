const mongoose = require("mongoose");

const LaufzettelSchema = new mongoose.Schema({
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
});

LaufzettelSchema.pre("find", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" }, // Prevent full object recursion
    { path: "teamleiter", select: "vorname nachname email" }
  ]);
});

LaufzettelSchema.pre("findOne", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" },
    { path: "teamleiter", select: "vorname nachname email" }
  ]);
});

LaufzettelSchema.methods.toHtml = function () {
  return `
<strong>Location</strong>\n${this.location || "-"}\n
<strong>Datum</strong>\n${formatDateHTML(this.datum)}\n
<strong>Name Mitarbeiter</strong>\n${this.name_mitarbeiter || "-"}\n
<strong>Name Teamleiter</strong>\n${this.name_teamleiter || "-"}\n
<strong>Zugewiesen</strong>\n${this.assigned ? "Ja" : "Nein"}\n
  `;
};



// EventReport Schema
const EventReportSchema = new mongoose.Schema({
  location: { type: String, required: true },
  name_teamleiter: { type: String, required: true },
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
  kunde: { type: String, required: true },
  puenktlichkeit: { type: String, required: false },
  erscheinungsbild: { type: String, required: false },
  team: { type: String, required: false },
  mitarbeiter_job: { type: String, required: false },
  feedback_auftraggeber: { type: String, required: false },
  sonstiges: { type: String, required: false },
  teamleiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mitarbeiter",
    required: false,
  },
  assigned: { type: Boolean, required: true, default: false },
  date: { type: Date, default: Date.now },
});

// ✅ Auto-populate teamleiter in EventReport
EventReportSchema.pre("find", function () {
  this.populate({ path: "teamleiter", select: "vorname nachname email" });
});
EventReportSchema.pre("findOne", function () {
  this.populate({ path: "teamleiter", select: "vorname nachname email" });
});

EventReportSchema.methods.toHtml = function () {
  return `
<strong>Location</strong>\n${this.location}\n
<strong>Datum</strong>\n${formatDateHTML(this.datum)}\n
<strong>Kunde</strong>\n${this.kunde}\n
<strong>Name Teamleiter</strong>\n${this.name_teamleiter}\n
<strong>Pünktlichkeit</strong>\n${this.puenktlichkeit || "-"}\n
<strong>Erscheinungsbild</strong>\n${this.erscheinungsbild || "-"}\n
<strong>Team</strong>\n${this.team || "-"}\n
<strong>Mitarbeiter Job</strong>\n${this.mitarbeiter_job || "-"}\n
<strong>Feedback Auftraggeber</strong>\n${this.feedback_auftraggeber || "-"}\n
<strong>Sonstiges</strong>\n${this.sonstiges || "-"}\n
<strong>Zugewiesen</strong>\n${this.assigned ? "Ja" : "Nein"}\n
  `;
};



// EvaluierungMA Schema
const EvaluierungSchema = new mongoose.Schema({
  location: { type: String, required: true },
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
  kunde: { type: String, required: true },
  name_teamleiter: { type: String, required: true },
  name_mitarbeiter: { type: String, required: true },
  puenktlichkeit: { type: String, required: false },
  grooming: { type: String, required: false },
  motivation: { type: String, required: false },
  technische_fertigkeiten: { type: String, required: false },
  lernbereitschaft: { type: String, required: false },
  sonstiges: { type: String, required: false },
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
  date: { type: Date, default: Date.now },
});

// ✅ Auto-populate mitarbeiter and teamleiter in EvaluierungMA
EvaluierungSchema.pre("find", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" },
    { path: "teamleiter", select: "vorname nachname email" }
  ]);
});
EvaluierungSchema.pre("findOne", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" },
    { path: "teamleiter", select: "vorname nachname email" }
  ]);
});


EvaluierungSchema.methods.toText = function () {
  return `
<strong>Location</strong>\n${this.location}\n
<strong>Datum</strong>\n${formatDateHTML(this.datum)}\n
<strong>Kunde</strong>\n${this.kunde}\n
<strong>Name Teamleiter</strong>\n${this.name_teamleiter}\n
<strong>Name Mitarbeiter</strong>\n${this.name_mitarbeiter}\n
<strong>Pünktlichkeit</strong>\n${this.puenktlichkeit || "-"}\n
<strong>Grooming</strong>\n${this.grooming || "-"}\n
<strong>Motivation</strong>\n${this.motivation || "-"}\n
<strong>Technische Fertigkeiten</strong>\n${this.technische_fertigkeiten || "-"}\n
<strong>Lernbereitschaft</strong>\n${this.lernbereitschaft || "-"}\n
<strong>Sonstiges</strong>\n${this.sonstiges || "-"}\n
<strong>Zugewiesen</strong>\n${this.assigned ? "Ja" : "Nein"}\n
  `;
};


//Helper Methoden

const formatDateHTML = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};


const Laufzettel = mongoose.model("Laufzettel", LaufzettelSchema);
const EventReport = mongoose.model("EventReport", EventReportSchema);
const EvaluierungMA = mongoose.model("EvaluierungMA", EvaluierungSchema);

module.exports = { Laufzettel, EventReport, EvaluierungMA };
