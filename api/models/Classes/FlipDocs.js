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
  task_id: { type: String, required: false, trim: true},
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
}, { timestamps: true });

LaufzettelSchema.pre("find", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" }, 
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
  teamleiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mitarbeiter",
    required: false,
  },
  assigned: { type: Boolean, required: true, default: false },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

// ✅ Verlosung Enums
const GUTSCHEIN_TYPES = {
  ATENTO: "ATENTO",
  BONBON: "BONBON",
  WUNSCHGUTSCHEIN: "WUNSCHGUTSCHEIN",
  GRAVUR: "GRAVUR",
};

const GRAVUR_TYPES = {
  CUTTERMESSER: "cuttermesser",
  KELLNERMESSER: "kellnermesser",
};

VerlosungEintragSchema = new mongoose.Schema({
  location: { type: String, required: false },
  name_mitarbeiter: { type: String, required: true },
  email: { type: String, required: true },
  gutschein_type: {
    type: String,
    required: true,
    enum: Object.values(GUTSCHEIN_TYPES),
  },
  gravur_type: {
    type: String,
    enum: Object.values(GRAVUR_TYPES),
    required: false, // Only required if gutschein_type === GRAVUR
  },
  mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mitarbeiter",
    required: false,
  },
  assigned: { type: Boolean, required: true, default: false },
  date: { type: Date, default: Date.now },
});

// ✅ Auto-populate mitarbeiter in Verlosung
VerlosungEintragSchema.pre("find", function () {
  this.populate({ path: "mitarbeiter", select: "vorname nachname email" });
});
VerlosungEintragSchema.pre("findOne", function () {
  this.populate({ path: "mitarbeiter", select: "vorname nachname email" });
});

VerlosungEintragSchema.methods.toHtml = function () {
  return `
<strong>Location</strong>\n${this.location || "-"}\n
<strong>Name Mitarbeiter</strong>\n${this.name_mitarbeiter || "-"}\n
<strong>Email</strong>\n${this.email || "-"}\n
<strong>Gutschein-Typ</strong>\n${this.gutschein_type || "-"}\n
${this.gravur_type ? `<strong>Gravur-Typ</strong>\n${this.gravur_type}\n` : ""}
<strong>Zugewiesen</strong>\n${this.assigned ? "Ja" : "Nein"}\n
  `;
};

// ✅ Verlosung Schema (die Verlosung selbst mit Status, Teilnehmern, Gewinner)
const VERLOSUNG_STATUS = {
  OFFEN: "OFFEN",
  GESCHLOSSEN: "GESCHLOSSEN",
  ABGESCHLOSSEN: "ABGESCHLOSSEN",
};

const VerlosungSchema = new mongoose.Schema({
  gutschein_type: {
    type: String,
    required: true,
    enum: Object.values(GUTSCHEIN_TYPES),
  },
  gravur_type: {
    type: String,
    enum: Object.values(GRAVUR_TYPES),
    required: false,
  },
  status: {
    type: String,
    enum: Object.values(VERLOSUNG_STATUS),
    default: VERLOSUNG_STATUS.OFFEN,
  },
  titel: { type: String, required: true },
  beschreibung: { type: String, required: false },
  start_date: { type: Date, required: false },
  end_date: { type: Date, required: false },
  anzahl_gewinner: { type: Number, default: 1, min: 1 },
  eintraege: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VerlosungEintrag",
    },
  ],
  gewinner_liste: [
    {
      eintrag: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VerlosungEintrag",
      },
      mitarbeiter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Mitarbeiter",
      },
      bestaetigt_am: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  gewinner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VerlosungEintrag",
    required: false,
  },
  gewinner_mitarbeiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mitarbeiter",
    required: false,
  },
  erstellt_am: { type: Date, default: Date.now },
  geschlossen_am: { type: Date, required: false },
  abgeschlossen_am: { type: Date, required: false },
});

// ✅ Auto-populate eintraege und gewinner in Verlosung
VerlosungSchema.pre("find", function () {
  this.populate([
    { path: "eintraege", select: "-__v" },
    { path: "gewinner", select: "-__v" },
    { path: "gewinner_mitarbeiter", select: "vorname nachname email flip_id" },
    { path: "gewinner_liste.eintrag", select: "-__v" },
    { path: "gewinner_liste.mitarbeiter", select: "vorname nachname email flip_id" },
  ]);
});

VerlosungSchema.pre("findOne", function () {
  this.populate([
    { path: "eintraege", select: "-__v" },
    { path: "gewinner", select: "-__v" },
    { path: "gewinner_mitarbeiter", select: "vorname nachname email flip_id" },
    { path: "gewinner_liste.eintrag", select: "-__v" },
    { path: "gewinner_liste.mitarbeiter", select: "vorname nachname email flip_id" },
  ]);
});

VerlosungSchema.methods.toHtml = function () {
  return `
<strong>Gutschein-Typ</strong>\n${this.gutschein_type || "-"}\n
${this.gravur_type ? `<strong>Gravur-Typ</strong>\n${this.gravur_type}\n` : ""}
<strong>Titel</strong>\n${this.titel || "-"}\n
<strong>Status</strong>\n${this.status}\n
<strong>Teilnehmer</strong>\n${this.eintraege?.length || 0}\n
<strong>Gewinner</strong>\n${this.gewinner_mitarbeiter ? `${this.gewinner_mitarbeiter.vorname} ${this.gewinner_mitarbeiter.nachname}` : "Noch nicht gezogen"}\n
  `;
};

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
  laufzettel: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Laufzettel",
  required: false,
},
  assigned: { type: Boolean, required: true, default: false },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

// ✅ Auto-populate mitarbeiter and teamleiter in EvaluierungMA
EvaluierungSchema.pre("find", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" },
    { path: "teamleiter", select: "vorname nachname email" },
    { path: "laufzettel", select: "task_id"}
  ]);
});
EvaluierungSchema.pre("findOne", function () {
  this.populate([
    { path: "mitarbeiter", select: "vorname nachname email" },
    { path: "teamleiter", select: "vorname nachname email" },
    { path: "laufzettel", select: "task_id"}
  ]);
});


EvaluierungSchema.methods.toHtml = function () {
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
const VerlosungEintrag = mongoose.model("VerlosungEintrag", VerlosungEintragSchema);
const Verlosung = mongoose.model("Verlosung", VerlosungSchema);

module.exports = {
  Laufzettel,
  EventReport,
  EvaluierungMA,
  VerlosungEintrag,
  Verlosung,
  GUTSCHEIN_TYPES,
  GRAVUR_TYPES,
  VERLOSUNG_STATUS,
};
