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

const Laufzettel = mongoose.model("Laufzettel", LaufzettelSchema);
const EventReport = mongoose.model("EventReport", EventReportSchema);
const EvaluierungMA = mongoose.model("EvaluierungMA", EvaluierungSchema);

module.exports = { Laufzettel, EventReport, EvaluierungMA };
