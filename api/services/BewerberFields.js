const EDITABLE_FIELDS = new Set([
  "anrede",
  "vorname",
  "nachname",
  "email",
  "telefon",
  "strasse",
  "plz",
  "ort",
  "wohnsitz",
  "staatsangehoerigkeit",
  "familienstand",
  "geburtsdatum",
  "bevorzugterBereich",
  "erfahrungGastronomieLogistik",
  "aktuellesAnstellungsverhaeltnis",
  "verfuegbarAb",
  "verfuegbarBis",
  "verfuegbarkeit",
  "bemerkungen",
  "fuehrerscheine",
  "eigenesAuto",
  "nutzungsberechtigung",
  "reisebereitschaft",
  "deutschlandticket",
  "hat70TageGearbeitet",
  "tage70Regelung",
  "studiumStatus",
  "locationV2",
]);

function pickEditableFields(source = {}, options = {}) {
  const excludedFields = new Set(options.exclude || []);
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => EDITABLE_FIELDS.has(key) && !excludedFields.has(key))
  );
}

module.exports = {
  EDITABLE_FIELDS,
  pickEditableFields,
};
