const XLSX = require('xlsx');
const { getSettingDefinition } = require('./wageTypeSettings');

// The SQL adapter keeps the existing targets. In particular CSTEUERSPE,
// BGSPALTE and IBRANCHEN* must not be reinterpreted as the wide export fields.
const SQL_COLUMNS = Object.freeze([
  ['LOHNARTNR', 'lohnartNummer'], ['LOHNARTKUR', 'lohnartKurzzeichen'],
  ['LOHNARTTXT', 'lohnartBezeichnung'], ['RECHNUNGST', 'rechnungstext'],
  ['KOSTENART', 'kostenart'], ['FREMDLOHNA', 'fremdLohnartNummer'],
  ['CBERECHNUN', 'berechnungsartCode'], ['CDURCHSPEI', 'durchschnittsspeicherCode'],
  ['CZUSCHLAG', 'zuschlagsProzent'], ['ZUSCHAUEGR', 'zuschlagsgruppeWert'],
  ['CSTEUERKRA', 'steuerartCode'], ['CSTEUERSPE', 'steuerSpezialCode'],
  ['CSOZIAL', 'sozialversicherungCode'], ['CPFAENDUNG', 'pfaendungCode'],
  ['AUSWERT', 'auswerten'], ['AUSWERTSTD', 'inStundenauswertung'],
  ['CGLEITZEIT', 'gleitzeitCode'], ['RECHSPALTE', 'rechnungsspalte'],
  ['BGSPALTE', 'berechnungsgrundlageSpalte'], ['ILOHNFAKTUR', 'fakturierungCode'],
  ['IBRANCHENZUSCHLAG', 'branchenzuschlagCode'],
  ['ILOHNARTBRANCHENZ', 'branchenzuschlagLohnartNummer'],
  ['PRIORITAETBZ', 'branchenzuschlagPrioritaet'], ['EQUALPAY', 'equalPayRelevanz'],
]);

// Header occurrences, not physical positions, identify code and display text.
// Extra source columns are always preserved, even without a field binding.
const WIDE_FIELDS = Object.freeze([
  ['Lohnart', 'lohnartNummer'], ['Lohnart-Kürzel', 'lohnartKurzzeichen'],
  ['Lohnart-Bezeichnung', 'lohnartBezeichnung'], ['Fehlzeitenkürzel', 'kb'],
  ['Code für Berechnung', 'berechnungsartCode', 'calculation'],
  ['Code für durch. Speich. SP1', 'durchschnittsspeicherCode', 'averageStorage'],
  ['Code für durch. Speich. SP2', 'durchschnittsspeicher2Code', 'averageStorage'],
  ['Code für Steuer', 'steuerartCode', 'tax'],
  ['Code für Steuerung/Speicherung', 'steuerungSpeicherungCode', 'storage'],
  ['Code für AZK-Stunden', 'gleitzeitCode', 'azk'],
  ['Code für Pfändung', 'pfaendungCode', 'garnishment'],
  ['Code für Sozialversicherung', 'sozialversicherungCode', 'socialInsurance'],
  ['Spaltenzuordnung', 'bgPflichtCode', 'bg'],
  ['Bereitstellung Konditionstabellen', 'fakturierungCode', 'conditionProvision'],
  ['Verrechnung', 'verrechnungCode', 'offset'],
  ['Fehlzeitenbetrachtung', 'fehlzeitenbetrachtungCode', 'absenceTreatment'],
  ['Tages-, Monatsübergabe', 'tagesMonatsuebergabeCode', 'periodTransfer'],
  ['Autom. Kürzung Ein-/Austritt/Fehlzeit', 'automatischeKuerzungCode', null, 'automatischeKuerzungText'],
  ['Steuerfreie Sammelbeförderung', 'steuerfreieSammelbefoerderungCode', null, 'steuerfreieSammelbefoerderungText'],
  ['Stundenermittlung Buchungsbeleg', 'stundenermittlungBuchungsbelegCode', null, 'stundenermittlungBuchungsbelegText'],
  ['Zuschlag', 'zuschlagsProzent'], ['Steuerpflichtiger Anteil', 'steuerpflichtigerAnteil'],
  ['Rechnungstext', 'rechnungstext'], ['Sachkonto', 'sachkonto'],
  ['Zuschlag für Rechnung', 'rechnungsZuschlagProzent'],
  ['Fremdlohnart-Nummer', 'fremdLohnartNummer'],
  ['Pfändungsprozentsatz (normale Pfändung)', 'pfaendungsProzent'],
  ['Pfändungsfreibetrag (normale Pfändung)', 'pfaendungsFreibetrag'],
  ['Pfändungsprozentsatz (Unterhaltspfändung)', 'unterhaltsPfaendungsProzent'],
  ['Pfändungsfreibetrag (Unterhaltspfändung)', 'unterhaltsPfaendungsFreibetrag'],
  ['Fehlzeitenprozentsatz', 'fehlzeitenProzent'], ['Druckspalte für Preis', 'rechnungsspalte'],
  ['Kennzeichen', 'kennzeichen'], ['Überstundenermittlung', 'ueberstundenermittlung'],
  ['Kalk. Lohnfaktor', 'kalkulatorischerLohnfaktor'],
  ['Lohnart für Urlaub/Krankheit', 'urlaubKrankheitLohnartNummer'],
  ['Positionsnummer', 'positionsnummer'],
  ['Abw. Preisermittlung bei Fehlzeiten', 'abweichendePreisermittlungFehlzeiten'],
  ['Abw. Stundenermittlung bei Fz.', 'abweichendeStundenermittlungFehlzeiten'],
  ['Fremd-Artikelnummer', 'fremdArtikelNummer'],
  ['Verrechnungslohnart', 'verrechnungslohnartNummer'], ['Priorität Verrechnung', 'verrechnungsPrioritaet'],
  ['Sachkonto für geringf. Beschäftigte', 'sachkontoGeringfuegig'],
  ['Sachkonto für E-Bilanz Pauschalsteuer', 'sachkontoEBilanzPauschalsteuer'],
  ['Abzug Buchungsbeleg', 'abzugBuchungsbeleg'],
  ['Ab-/Bezugsart für den Nettobezug', 'nettoAbBezugsart'],
  ['Für das Wochenende', 'fuerWochenende'], ['Keine Lohnübergabe', 'keineLohnuebergabe'],
  ['In Auswertungen berücksichtigen', 'inAuswertungenBeruecksichtigen'],
  ['Inklusive Fehlzeiten', 'inklusiveFehlzeiten'], ['Für Gesamtstunden', 'fuerGesamtstunden'],
  ['Schichttrennung', 'schichttrennung'], ['Bei Monatswechsel aufteilen', 'beiMonatswechselAufteilen'],
  ['Auslöserelevant', 'ausloeserelevant'], ['Kommunalsteuerfrei', 'kommunalsteuerfrei'],
  ['Feiertagslohnart', 'feiertagslohnart'], ['Urlaubslohnart', 'urlaubslohnart'],
  ['Nachberechnung', 'nachberechnung'], ['Nicht für manuelle Eingabe', 'nichtFuerManuelleEingabe'],
  ['Inaktiv für die Auswahl', 'inaktivFuerAuswahl'], ['Lohnart auswerten', 'lohnartAuswerten'],
  ['Rückstellung Urlaub', 'rueckstellungUrlaub'],
  ['Rückstellung Arbeitszeitkonten', 'rueckstellungArbeitszeitkonten'],
  ['Lohnart beim Abrechnungsdruck verdichten', 'abrechnungsdruckVerdichten'],
  ['Sonderzulage', 'sonderzulage'], ['Zuschlag aus Tarifvertrag', 'zuschlagAusTarifvertrag'],
  ['Berücksichtigung für Staffelwert', 'beruecksichtigungStaffelwert'],
  ['Nur Ausweisen wenn Betrag <> 0', 'nurAusweisenBeiBetragUngleichNull'],
  ['Als Gehaltslohnart für Textmarke/Std.-Lohn-Berechnung', 'gehaltslohnart'],
  ['Durch Zuschläge reduzierbar', 'durchZuschlaegeReduzierbar'],
  ['Für Guthabenkarte Retailo', 'guthabenkarteRetailo'],
  ['Lohnart nicht drucken bei Euro-Betrag = 0', 'nichtDruckenBeiBetragNull'],
  ['Gesamtstunden für Staffelwert', 'gesamtstundenStaffelwert'],
  ['Relevant für Auswertung Verdiensterhebung', 'verdiensterhebungRelevant'],
  ['Lohnart nicht im Gesamtbrutto berücksichtigen', 'nichtImGesamtbrutto'],
  ['Durchschnittsspeicher bei abw. Preiseinstellung nicht berücksichtigen', 'durchschnittBeiAbweichendemPreisNichtBeruecksichtigen'],
  ['Lohnart für AZK-Verrechnung Minus', 'azkVerrechnungMinus'],
  ['Lohnart für AZK-Verrechnung Plus', 'azkVerrechnungPlus'],
  ['Lohnart mit Stundenwert übergeben', 'stundenwertUebergeben'],
  ['Automatische Berücksichtigung der Bankarbeitstage', 'bankarbeitstageBeruecksichtigen'],
  ['Nicht berücksichtigen für LANDWEHR Mico', 'nichtFuerMico'],
  ['Vorzeichenumkehr', 'vorzeichenumkehr'], ['Stundenausgabe unterdrücken', 'stundenausgabeUnterdruecken'],
  ['Bestandteil der Grundvergütung', 'bestandteilGrundverguetung'],
  ['Relevant für Equal Pay', 'equalPayRelevanz'],
  ['Sonntags-/Feiertags-/Nachtarbeitszuschlag', 'sonntagFeiertagNachtZuschlag'],
  ['Beteiligung private KFZ-Kosten', 'beteiligungPrivateKfzKosten'],
  ['Doppelbesteuerung', 'doppelbesteuerung'], ['Abzug', 'abzug'],
  ['Nebenbezüge lt. Entgeltbescheinigungsverordnung (Reisekosten)', 'nebenbezuegeReisekosten'],
  ['Lohnart für Insolvenzgeld/Kennzeichen "U"', 'insolvenzgeldKennzeichenU'],
  ['Tage beim Abrechnungsdruck nicht drucken', 'tageNichtDrucken'],
  ['Relevant für AZK-Stunden', 'azkStundenRelevant'], ['KUG-Feiertagslohn', 'kugFeiertagslohn'],
  ['Quarantäne fiktives AE', 'quarantaeneFiktivesArbeitsentgelt'],
]);
const FIELD_NAMES = Object.freeze([...new Set([
  ...SQL_COLUMNS.map(([, target]) => target),
  ...WIDE_FIELDS.flatMap(([, target, , textTarget]) => [target, ...(textTarget ? [textTarget] : [])]),
])]);
const SQL_FAMILIES = {
  berechnungsartCode: 'calculation', durchschnittsspeicherCode: 'averageStorage',
  steuerartCode: 'tax', sozialversicherungCode: 'socialInsurance', pfaendungCode: 'garnishment',
  gleitzeitCode: 'azk', fakturierungCode: 'conditionProvision',
};

function normalizeHeader(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}
function text(value) { return String(value ?? '').trim(); }
function isBlank(row) { return row.every(value => text(value) === ''); }
function validNumber(value) { return /^[1-9]\d*$/.test(value); }
function comparableLabel(value) {
  return normalizeHeader(value).replace(/^\([^)]+\)\s*/, '')
    .replace(/[×*]/g, '×').replace(/paragr\.?/g, '§').replace(/\s+/g, '');
}
function fail(issues) {
  const error = new Error('Der Lohnartenimport enthält ungültige Daten.');
  error.status = 400;
  error.statusCode = 400;
  error.issues = issues;
  throw error;
}
function addIssue(issues, severity, code, message, context = {}) {
  issues.push({ severity, code, message, ...context });
}

function checkSetting(family, code, displayText, context, issues) {
  if (!code) {
    if (displayText) addIssue(issues, 'error', 'CODE_TEXT_CONFLICT', 'Klartext vorhanden, aber der zugehörige Code fehlt.', context);
    return;
  }
  const definition = getSettingDefinition(family, code);
  if (!definition) {
    addIssue(issues, 'warning', 'UNKNOWN_CODE', `Unbekannter Code ${code}; der Quellwert bleibt erhalten.`, { ...context, value: code });
    return;
  }
  const labels = [definition.label, ...(definition.aliases || [])];
  if (displayText && !labels.some(label => comparableLabel(label) === comparableLabel(displayText))) {
    addIssue(issues, 'error', 'CODE_TEXT_CONFLICT', `Code ${code} und Klartext „${displayText}“ widersprechen sich. Erwartet: ${definition.label}.`, { ...context, value: code, displayText });
  }
}

/** Parse and validate a complete workbook without writing any records. */
function parseWageTypeWorkbook(buffer, { filename = '' } = {}) {
  const issues = [];
  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false }); }
  catch (error) {
    addIssue(issues, 'error', 'INVALID_WORKBOOK', 'Die Datei ist keine lesbare Arbeitsmappe.');
    fail(issues);
  }
  const nonEmptySheets = workbook.SheetNames.filter(name => workbook.Sheets[name]?.['!ref']);
  if (nonEmptySheets.length !== 1) {
    addIssue(issues, 'error', 'SHEET_SELECTION', 'Es wird genau ein gefülltes Tabellenblatt erwartet.');
    fail(issues);
  }
  const sheetName = nonEmptySheets[0];
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  // Start at A1 so provenance and leading blank columns do not shift.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true, range: { s: { r: 0, c: 0 }, e: range.e } });
  const firstIndex = rows.findIndex(row => !isBlank(row));
  if (firstIndex === -1) {
    addIssue(issues, 'error', 'EMPTY_WORKBOOK', 'Die Datei enthält keine Lohnarten.');
    fail(issues);
  }
  const first = rows[firstIndex];
  const normalized = first.map(normalizeHeader);
  let format;
  let hasHeader = true;
  if (normalized.includes('lohnartnr')) format = 'sql';
  else if (normalized.includes('lohnart')) format = 'zvoove';
  else if (range.e.c + 1 === SQL_COLUMNS.length && validNumber(text(first[0]))) {
    format = 'sql-headerless';
    hasHeader = false;
  } else {
    addIssue(issues, 'error', 'UNRECOGNIZED_HEADERS', 'Erwartet werden LOHNARTNR, Lohnart oder ein SQL-Export ohne Kopfzeile mit genau 24 Spalten.');
    fail(issues);
  }

  const headers = hasHeader ? first.map(value => String(value ?? '')) : SQL_COLUMNS.map(([source]) => source);
  const width = Math.max(headers.length, range.e.c + 1);
  const occurrences = new Map();
  const byHeader = new Map();
  const columns = Array.from({ length: width }, (_, index) => {
    const header = headers[index] || '';
    const key = normalizeHeader(header);
    const occurrence = (occurrences.get(key) || 0) + 1;
    occurrences.set(key, occurrence);
    byHeader.set(key, [...(byHeader.get(key) || []), index]);
    return { index: index + 1, header, occurrence };
  });
  const bindings = [];
  if (format.startsWith('sql')) {
    for (const [header, target] of SQL_COLUMNS) {
      const positions = byHeader.get(normalizeHeader(header)) || [];
      if (positions.length > 1) addIssue(issues, 'error', 'AMBIGUOUS_HEADERS', `Die Spalte ${header} ist mehrfach vorhanden.`, { sheet: sheetName, row: firstIndex + 1, field: target });
      if (positions.length) bindings.push({ index: positions[0], target, family: SQL_FAMILIES[target] });
    }
  } else {
    for (const [header, target, family, textTarget] of WIDE_FIELDS) {
      const positions = byHeader.get(normalizeHeader(header)) || [];
      const paired = !!family || !!textTarget;
      if (positions.length > (paired ? 2 : 1)) addIssue(issues, 'error', 'AMBIGUOUS_HEADERS', `Die Spalte ${header} ist nicht eindeutig zugeordnet.`, { sheet: sheetName, row: firstIndex + 1, field: target });
      if (positions.length) bindings.push({ index: positions[0], target, family, textIndex: paired ? positions[1] : undefined });
      if (textTarget && positions.length > 1) bindings.push({ index: positions[1], target: textTarget });
    }
  }
  if (issues.some(issue => issue.severity === 'error')) fail(issues);

  const records = [];
  const seen = new Map();
  const numberIndex = bindings.find(binding => binding.target === 'lohnartNummer')?.index;
  for (let index = firstIndex + (hasHeader ? 1 : 0); index < rows.length; index += 1) {
    const row = rows[index];
    if (isBlank(row)) continue;
    const context = { sheet: sheetName, row: index + 1 };
    const lohnartNummer = text(row[numberIndex]);
    if (!validNumber(lohnartNummer)) {
      addIssue(issues, 'error', 'INVALID_NUMBER', 'Die Lohnartnummer muss eine positive ganze Zahl sein.', { ...context, field: 'lohnartNummer', value: lohnartNummer });
      continue;
    }
    if (seen.has(lohnartNummer)) {
      addIssue(issues, 'error', 'DUPLICATE_NUMBER', `Lohnart ${lohnartNummer} ist mehrfach enthalten (erste Zeile ${seen.get(lohnartNummer)}).`, { ...context, lohnartNummer });
    }
    seen.set(lohnartNummer, index + 1);
    const fields = {};
    for (const binding of bindings) {
      fields[binding.target] = text(row[binding.index]);
      if (binding.family) checkSetting(binding.family, fields[binding.target], binding.textIndex == null ? '' : text(row[binding.textIndex]), { ...context, lohnartNummer, field: binding.target }, issues);
    }
    if (fields.verrechnungslohnartNummer && !validNumber(fields.verrechnungslohnartNummer)) {
      addIssue(issues, 'error', 'INVALID_REFERENCE', 'Die Verrechnungslohnartnummer muss eine positive ganze Zahl sein.', { ...context, lohnartNummer, field: 'verrechnungslohnartNummer', value: fields.verrechnungslohnartNummer });
    }
    records.push({ lohnartNummer, fields, source: {
      filename, sheet: sheetName, row: index + 1,
      columns: columns.map(column => ({ ...column, value: row[column.index - 1] ?? '' })),
    } });
  }
  if (!records.length && !issues.some(issue => issue.severity === 'error')) {
    addIssue(issues, 'error', 'EMPTY_WORKBOOK', 'Die Datei enthält keine Lohnarten.');
  }
  if (issues.some(issue => issue.severity === 'error')) fail(issues);
  return { format, records, issues };
}

module.exports = { parseWageTypeWorkbook, FIELD_NAMES, SQL_COLUMNS, WIDE_FIELDS };
