const XLSX = require('xlsx');
const { Decimal128 } = require('mongodb');

const CONTRACT_ID = '17055';
const TABLES = [
  ['contract', 'Tarifvertrag', 'Tarifvertrag.xlsx', ['ID', 'CBEZEICHNUNG']],
  ['employeeGroups', 'Tarif-Mitarbeitergruppen / Varianten', 'Tarifmitarbeitergruppe.xlsx', ['ID', 'ID_LCS_TARIF', 'CGRUPPE']],
  ['payGroups', 'Tarifgruppen / Entgeltgruppen (INR → IY)', 'Tarifgruppe.xlsx', ['ID', 'ID_LCS_TARIFMAGRUPPE', 'INR', 'CBEZEICHNUNG']],
  ['stages', 'Tarifstufen (INR → IX)', 'Tarifstufe.xlsx', ['ID', 'ID_LCS_TARIFMAGRUPPE', 'INR', 'CBEZEICHNUNG']],
  ['periods', 'Tarifzeiten / historische Perioden', 'Tarifzeit.xlsx', ['ID', 'ID_LCS_TARIFMAGRUPPE', 'DTVON', 'DTBIS']],
  ['rates', 'Tarif Entgelt / Entgeltmatrix', 'Tarif Entgelt.xlsx', ['ID_LCS_TARIFZEIT', 'IX', 'IY', 'DWERT']],
  ['wageRules', 'Tarif Lohnarten / Regeln', 'Tarif Lohnarten.xlsx', ['ID_LCS_TARIFZEIT', 'ILOHNARTNR']],
  ['specialPayments', 'Tarif Urlaubsgeld / Weihnachtsgeld', 'Tarif Urlaubsgeld Weihnachtsgeld.xlsx', ['ID_LCS_TARIFZEIT', 'CBEZEICHNUNG', 'CSTICHTAG1', 'IAUSZAHLMONAT', 'ILOHNARTNR']],
  ['assignmentAllowances', 'Tarif-Einsatzzulagen', 'Tarifeinsatzzulage.xlsx', ['ID_LCS_TARIFZEIT', 'IGRUPPEAB', 'IGRUPPEBIS', 'IABMONATEEINSATZ', 'IABMONATEEINTRITT', 'DZULAGE']],
  ['employeeAssignments', 'Tarif Personal / Mitarbeiterzuordnungen', 'Tarif Personal.xlsx', ['IPERSONALNR', 'ID_LCS_TARIF', 'ID_LCS_TARIFMAGRUPPE', 'ID_LCS_TARIFGRUPPEN', 'ID_LCS_TARIFSTUFEN', 'DTVON', 'DTBIS']],
  ['aboveTariff', 'Tarif ÜTZ / individuelle Historie', 'Tarif ÜTZ.xlsx', ['IPERSONALNR', 'DTVON', 'DTBIS', 'DPREIS', 'DPREISPROD', 'DEINSATZZULAGE', 'DPREISGEHALT']],
  ['referenceWages', 'Tarif-Ecklohn / Konfiguration', 'Tarifecklohn.xlsx', ['ID_LCS_TARIFMAGRUPPE', 'IGRUPPE', 'ISTUFE']],
  ['noticePeriods', 'Tarif-Kündigungsfristen', 'Tarifkündigungsfrist.xlsx', ['ID_LCS_TARIF', 'IANZAHLANG', 'ITYPANG', 'IANZAHLKUEND', 'ITYPKUEND']],
  ['vacationRules', 'Tarifurlaub / historische Staffeln', 'Tarifurlaub.xlsx', ['ID_LCS_TARIF', 'IJAHR', 'ITAGE', 'GUELTIGBISJAHR']],
].map(([key, label, filename, requiredColumns]) => Object.freeze({ key, label, filename, requiredColumns: Object.freeze(requiredColumns) }));

const normalizeHeader = value => String(value ?? '').trim().toUpperCase();
const empty = value => value === undefined || value === null || String(value).trim() === '';
const dangerousHeader = value => ['__PROTO__', 'PROTOTYPE', 'CONSTRUCTOR'].includes(normalizeHeader(value));
const rawOf = row => row?.source?.raw || row || {};
const get = (row, name) => {
  const entry = Object.entries(rawOf(row)).find(([key]) => normalizeHeader(key) === name);
  return entry ? entry[1] : undefined;
};
const personalNumber = row => get(row, 'IPERSONALNR') ?? get(row, 'PERSONALNR');

function issue(issues, severity, code, message, table, row) {
  issues.push({ severity, code, message, ...(table ? { table } : {}), ...(row?.source ? { filename: row.source.filename, row: row.source.row } : {}) });
}

/** Parse the explicitly assigned workbooks; filenames never determine their role. */
function parseFiles(input = []) {
  const tables = Object.fromEntries(TABLES.map(table => [table.key, []]));
  const files = [], issues = [];
  const uploads = Array.isArray(input) ? input : Object.values(input).flat();
  for (const file of uploads) {
    if (!TABLES.some(table => table.key === file.fieldname)) {
      issue(issues, 'ERROR', 'UNKNOWN_FILE_ROLE', `Unbekanntes Dateifeld: ${file.fieldname || 'ohne Zuordnung'}.`);
    }
  }
  for (const table of TABLES) {
    const matching = uploads.filter(file => file.fieldname === table.key);
    if (matching.length !== 1) {
      issue(issues, 'ERROR', matching.length ? 'DUPLICATE_FILE' : 'MISSING_FILE', matching.length ? `Für „${table.label}“ muss genau eine Datei zugeordnet werden.` : `Die Pflichtdatei „${table.label}“ fehlt.`, table.key);
      continue;
    }
    const file = matching[0];
    const filename = file.originalname || table.filename;
    if (!/\.(xlsx|xls)$/i.test(filename) || !Buffer.isBuffer(file.buffer)) {
      issue(issues, 'ERROR', 'INVALID_FILE', `„${filename}“ muss eine Excel-Datei (.xlsx oder .xls) sein.`, table.key, { source: { filename } });
      continue;
    }
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false, cellFormula: false });
      const metadata = { key: table.key, filename, size: file.size ?? file.buffer.length, sheets: [], rows: 0 };
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet['!ref']) continue;
        const range = XLSX.utils.decode_range(sheet['!ref']);
        if ((range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1) > 2000000) {
          issue(issues, 'ERROR', 'SHEET_TOO_LARGE', `Das Tabellenblatt „${sheetName}“ überschreitet die Importgrenze von 2.000.000 Zellen.`, table.key, { source: { filename } });
          continue;
        }
        const headerRow = range.s.r;
        const headers = [], seenHeaders = new Set();
        let invalidHeaders = false;
        for (let column = range.s.c; column <= range.e.c; column++) {
          const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c: column })];
          const header = empty(cell?.v) ? '' : String(cell.v).trim();
          if (!header) {
            // A formatted but entirely empty column is not an exported field.
            const hasData = Array.from({ length: range.e.r - headerRow }, (_, index) => sheet[XLSX.utils.encode_cell({ r: headerRow + index + 1, c: column })]).some(cell => !empty(cell?.v));
            if (hasData) {
              issue(issues, 'ERROR', 'EMPTY_HEADER', `Spalte ${column + 1} in „${sheetName}“ enthält Werte, aber keinen Spaltennamen.`, table.key, { source: { filename, row: headerRow + 1 } });
              invalidHeaders = true;
            }
            headers.push(null);
            continue;
          }
          const normalized = normalizeHeader(header);
          if (dangerousHeader(header) || seenHeaders.has(normalized)) {
            issue(issues, 'ERROR', dangerousHeader(header) ? 'UNSAFE_HEADER' : 'DUPLICATE_HEADER', `Ungültiger oder doppelter Spaltenname „${header}“ in „${sheetName}“.`, table.key, { source: { filename, row: headerRow + 1 } });
            invalidHeaders = true;
          }
          seenHeaders.add(normalized);
          headers.push(header);
        }
        if (seenHeaders.has('IPERSONALNR') && seenHeaders.has('PERSONALNR')) {
          issue(issues, 'ERROR', 'AMBIGUOUS_PERSONAL_NUMBER_HEADER', `„${sheetName}“ enthält beide Personalnummer-Spalten; die Zuordnung ist nicht eindeutig.`, table.key, { source: { filename, row: headerRow + 1 } });
          invalidHeaders = true;
        }
        const missing = table.requiredColumns.filter(header => !seenHeaders.has(header) && !(header === 'IPERSONALNR' && seenHeaders.has('PERSONALNR')));
        if (missing.length) {
          issue(issues, 'ERROR', 'MISSING_COLUMNS', `In „${sheetName}“ fehlen Pflichtspalten: ${missing.join(', ')}.`, table.key, { source: { filename, row: headerRow + 1 } });
          invalidHeaders = true;
        }
        metadata.sheets.push(sheetName);
        if (invalidHeaders) continue;
        for (let line = headerRow + 1; line <= range.e.r; line++) {
          const entries = headers.flatMap((header, index) => {
            if (!header) return [];
            const cell = sheet[XLSX.utils.encode_cell({ r: line, c: range.s.c + index })];
            return [[header, cell?.v ?? null]];
          });
          if (entries.every(([, value]) => empty(value))) continue;
          const raw = Object.fromEntries(entries);
          const source = { filename, sheet: sheetName, row: line + 1, raw };
          // The workbook epoch is parser metadata, never a source column.
          const row = { ...raw, source };
          Object.defineProperty(row, 'date1904', { value: Boolean(workbook.Workbook?.WBProps?.date1904), enumerable: false });
          tables[table.key].push(row);
          metadata.rows++;
        }
      }
      if (!metadata.sheets.length) issue(issues, 'ERROR', 'EMPTY_WORKBOOK', `„${filename}“ enthält kein lesbares Tabellenblatt.`, table.key, { source: { filename } });
      files.push(metadata);
    } catch (error) {
      issue(issues, 'ERROR', 'WORKBOOK_UNREADABLE', `„${filename}“ konnte nicht als Excel-Datei gelesen werden.`, table.key, { source: { filename } });
    }
  }
  return { tables, files, issues };
}

/** Canonical decimal strings are expanded and normalized without floating-point arithmetic. */
function decimalString(input) {
  if (empty(input)) return null;
  if (typeof input === 'number' && !Number.isFinite(input)) throw new Error('Keine endliche Dezimalzahl.');
  if (!['number', 'string'].includes(typeof input)) throw new Error('Keine Dezimalzahl.');
  let text = String(input).trim();
  if (text.includes(',')) {
    // The export uses German decimals; grouped thousands must be unambiguous.
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(text)) throw new Error('Ungültige Dezimalzahl.');
    text = text.replace(/\./g, '').replace(',', '.');
  }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new Error('Ungültige Dezimalzahl.');
  const exponent = match[4] ? Number(match[4]) : 0;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000 || text.length > 2000) throw new Error('Dezimalzahl zu groß.');
  const digits = match[2] + (match[3] || '');
  const point = match[2].length + exponent;
  let whole, fraction;
  if (point <= 0) { whole = '0'; fraction = '0'.repeat(-point) + digits; }
  else if (point >= digits.length) { whole = digits + '0'.repeat(point - digits.length); fraction = ''; }
  else { whole = digits.slice(0, point); fraction = digits.slice(point); }
  whole = whole.replace(/^0+(?=\d)/, '');
  fraction = fraction.replace(/0+$/, '');
  const sign = match[1] === '-' && (whole !== '0' || fraction) ? '-' : '';
  const canonical = `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
  // Stored money uses Decimal128; reject precision loss before persistence.
  Decimal128.fromString(canonical);
  return canonical;
}

function idString(input) {
  if (empty(input) || !['string', 'number'].includes(typeof input)) return null;
  if (typeof input === 'number' && !Number.isSafeInteger(input)) return null;
  const text = String(input).trim();
  if (!/^\d+$/.test(text) || /^0+$/.test(text)) return null;
  return text.replace(/^0+/, '');
}

function dateString(input, date1904 = false) {
  if (empty(input)) return null;
  let year, month, day;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new Error('Ungültiges Datum.');
    year = input.getUTCFullYear(); month = input.getUTCMonth() + 1; day = input.getUTCDate();
  } else if (typeof input === 'number') {
    const decoded = XLSX.SSF.parse_date_code(input, { date1904 });
    if (!decoded) throw new Error('Ungültiges Excel-Datum.');
    ({ y: year, m: month, d: day } = decoded);
  } else if (typeof input === 'string') {
    const text = input.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]00:00(?::00(?:\.0+)?)?Z?)?$/.exec(text);
    const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?: 00:00(?::00)?)?$/.exec(text);
    if (iso) [, year, month, day] = iso.map(Number);
    else if (german) { [, day, month, year] = german.map(Number); }
    else throw new Error('Datum muss TT.MM.JJJJ oder JJJJ-MM-TT entsprechen.');
  } else throw new Error('Ungültiges Datum.');
  if (year < 1000 || year > 9999 || !Number.isInteger(year)) throw new Error('Ungültiges Jahr.');
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) throw new Error('Ungültiges Kalenderdatum.');
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function collectPersonalNumbers(parsed) {
  const values = (parsed.tables?.employeeAssignments || []).filter(row => idString(get(row, 'ID_LCS_TARIF')) === CONTRACT_ID).map(personalNumber).filter(value => !empty(value));
  return [...new Set(values.flatMap(value => [String(value).trim(), idString(value)]).filter(Boolean))];
}

const decimalFields = {
  wageRules: ['DAB', 'DBIS', 'DPROZENT', 'DFESTBETRAG', 'DMINSTD', 'DMAXSTD'],
  assignmentAllowances: ['DZULAGE'],
  aboveTariff: ['DPREIS', 'DPREISPROD', 'DEINSATZZULAGE', 'DPREISGEHALT'],
};
const optionalColumns = {
  contract: ['SAENDERUNG', 'DARBWOCHE', 'ILOHNUNTERGRENZE', 'BRANCHE_VERRECHART', 'TARIFVERBAND', 'URLAUBBERECHNUNGNACHBURLG'],
  employeeGroups: ['CBEZEICHNUNG'],
  payGroups: ['ILEISTGRUPPE', 'INR_OLD', 'INSERT_BY_DUPLICATE'],
  stages: [], periods: [],
  rates: ['IY_OLD', 'INSERT_BY_DUPLICATE'],
  wageRules: ['IGRUPPE', 'DAB', 'DBIS', 'IKZSTDUHR', 'IKZBEZUG', 'CMO', 'CDI', 'CMI', 'CDO', 'CFR', 'CSA', 'CSO', 'CFE', 'IPREISNR', 'DPROZENT', 'DFESTBETRAG', 'ID_LCS_TARIFGRUPPEN', 'ID_LCS_TARIFSTUFEN', 'IYGRUPPE', 'IXSTUFE', 'IKZFEIERTAG', 'IKZFEHLZEIT', 'DMINSTD', 'DMAXSTD', 'BERECHNUNGSART', 'IARBEITSZULAGE', 'ADDAUSGLEICHSZUL', 'ADDBRANCHENZUSCHL', 'ADDSONDERZUL'],
  specialPayments: ['MINMITGLIEDSCHAFTMONATE', 'BANKARBEITSTAGEPRUEFEN', 'IAUSTRITTNOTRELEVANT', 'KURZDURCHFEHLZ', 'KUENBER'],
  assignmentAllowances: ['ISTUFEAB', 'ISTUFEBIS', 'IGRUPPEAB_OLD', 'IGRUPPEBIS_OLD'],
  employeeAssignments: ['IUETZNICHTANPASSEN', 'PERSONALNR'],
  aboveTariff: ['PERSONALNR'],
  referenceWages: ['IOPTHOECHERWERT'], noticePeriods: [], vacationRules: [],
};

function buildDataset(parsed, employees = []) {
  const issues = [...(parsed.issues || [])];
  const all = Object.fromEntries(TABLES.map(table => [table.key, parsed.tables?.[table.key] || []]));
  const scoped = Object.fromEntries(TABLES.map(table => [table.key, []]));
  const id = (row, field, table, required = true) => {
    const value = get(row, field);
    if (!required && empty(value)) return null;
    const normalized = idString(value);
    if (!normalized) issue(issues, 'ERROR', 'INVALID_ID', `„${field}“ muss eine positive, exakt darstellbare Ganzzahl sein.`, table, row);
    return normalized;
  };
  const interval = (row, table) => {
    let validFrom = null, validUntil = null;
    const employeeHistory = ['employeeAssignments', 'aboveTariff'].includes(table);
    let intervalStatus = 'VALID';
    try { validFrom = dateString(get(row, 'DTVON'), row.date1904); if (!validFrom) throw new Error('Das Anfangsdatum fehlt.'); }
    catch (error) { issue(issues, 'ERROR', 'INVALID_DATE', `Ungültiges DTVON: ${error.message}`, table, row); }
    try { validUntil = dateString(get(row, 'DTBIS'), row.date1904); }
    catch (error) { issue(issues, 'ERROR', 'INVALID_DATE', `Ungültiges DTBIS: ${error.message}`, table, row); }
    if (validFrom && validUntil && validUntil < validFrom) {
      if (employeeHistory) intervalStatus = 'INEFFECTIVE';
      issue(issues, employeeHistory ? 'WARNING' : 'ERROR', 'REVERSED_INTERVAL', employeeHistory
        ? 'Das Enddatum liegt vor dem Anfangsdatum. Der Datensatz bleibt als unwirksame Historie erhalten und gilt an keinem Stichtag.'
        : 'Das Enddatum liegt vor dem Anfangsdatum.', table, row);
    }
    return { validFrom, validUntil, ...(employeeHistory ? { intervalStatus } : {}) };
  };
  const position = (row, field, table) => {
    const value = id(row, field, table);
    if (!value) return null;
    if (BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) {
      issue(issues, 'ERROR', 'INVALID_MATRIX_POSITION', `Matrixposition „${field}“ ist nicht als sichere Ganzzahl darstellbar.`, table, row);
      return null;
    }
    return Number(value);
  };
  const decimal = (row, field, table, required = false) => {
    try { const value = decimalString(get(row, field)); if (required && value === null) throw new Error('Der Wert fehlt.'); return value; }
    catch (error) { issue(issues, 'ERROR', 'INVALID_DECIMAL', `Ungültiger Dezimalwert in „${field}“.`, table, row); return null; }
  };
  const unique = (rows, table) => {
    const seen = new Set();
    const allIds = new Map();
    for (const row of all[table]) {
      const legacyId = idString(get(row, 'ID'));
      if (legacyId) allIds.set(legacyId, (allIds.get(legacyId) || 0) + 1);
    }
    for (const row of rows) {
      const legacyId = id(row, 'ID', table, false);
      if (legacyId && allIds.get(legacyId) > 1 && !seen.has(legacyId)) issue(issues, 'ERROR', 'DUPLICATE_ID', `Die Quell-ID ${legacyId} ist mehrfach vorhanden; ihre Tarifzugehörigkeit ist dadurch nicht eindeutig.`, table, row);
      seen.add(legacyId);
    }
  };
  const rule = (row, table) => {
    const values = { ...rawOf(row) };
    for (const field of decimalFields[table] || []) {
      const rawKey = Object.keys(values).find(key => normalizeHeader(key) === field);
      if (rawKey) values[rawKey] = decimal(row, field, table, table === 'assignmentAllowances');
    }
    return { legacyId: id(row, 'ID', table, false), values, source: row.source };
  };

  scoped.contract = all.contract.filter(row => idString(get(row, 'ID')) === CONTRACT_ID);
  if (scoped.contract.length !== 1) issue(issues, 'ERROR', 'CONTRACT_MISSING_OR_DUPLICATE', `Der Import muss Tarifvertrag ${CONTRACT_ID} genau einmal enthalten.`, 'contract');
  const contractRow = scoped.contract[0];
  const contract = contractRow ? { legacyId: CONTRACT_ID, name: String(get(contractRow, 'CBEZEICHNUNG') || ''), source: contractRow.source, vacationRules: [], noticePeriods: [] } : null;
  scoped.employeeGroups = all.employeeGroups.filter(row => idString(get(row, 'ID_LCS_TARIF')) === CONTRACT_ID);
  const groups = scoped.employeeGroups.map(row => ({ legacyId: id(row, 'ID', 'employeeGroups'), contractId: CONTRACT_ID, name: String(get(row, 'CGRUPPE') || ''), statusLabel: String(get(row, 'CBEZEICHNUNG') || ''), source: row.source, payGroups: [], stages: [], referenceWages: [] }));
  const groupsById = new Map(groups.filter(group => group.legacyId).map(group => [group.legacyId, group]));
  const allGroupIds = new Set(all.employeeGroups.map(row => idString(get(row, 'ID'))).filter(Boolean));
  const groupChildren = (table, create) => {
    for (const row of all[table]) {
      const parent = idString(get(row, 'ID_LCS_TARIFMAGRUPPE'));
      if (!parent || !allGroupIds.has(parent)) {
        issue(issues, 'ERROR', 'GROUP_REFERENCE_MISSING', 'Die referenzierte Tarif-Mitarbeitergruppe fehlt oder hat einen ungültigen Schlüssel.', table, row);
        continue;
      }
      const group = groupsById.get(parent);
      if (!group) continue;
      scoped[table].push(row);
      create(row, group);
    }
  };
  for (const table of ['payGroups', 'stages']) {
    groupChildren(table, (row, group) => {
      const matrixPosition = position(row, 'INR', table);
      if (group[table].some(entry => entry.position === matrixPosition)) issue(issues, 'ERROR', 'DUPLICATE_POSITION', `Matrixposition ${matrixPosition} ist in der Variante ${group.legacyId} mehrfach vorhanden.`, table, row);
      group[table].push({ legacyId: id(row, 'ID', table), position: matrixPosition, name: String(get(row, 'CBEZEICHNUNG') || ''), source: row.source });
    });
  }
  groupChildren('referenceWages', (row, group) => {
    id(row, 'IGRUPPE', 'referenceWages'); id(row, 'ISTUFE', 'referenceWages');
    group.referenceWages.push(rule(row, 'referenceWages'));
  });
  const periods = [];
  groupChildren('periods', (row, group) => periods.push({ legacyId: id(row, 'ID', 'periods'), employeeGroupId: group.legacyId, ...interval(row, 'periods'), rates: [], wageRules: [], specialPayments: [], assignmentAllowances: [], source: row.source }));
  const periodsById = new Map(periods.filter(period => period.legacyId).map(period => [period.legacyId, period]));
  const allPeriodIds = new Set(all.periods.map(row => idString(get(row, 'ID'))).filter(Boolean));
  for (const table of ['rates', 'wageRules', 'specialPayments', 'assignmentAllowances']) {
    for (const row of all[table]) {
      const parent = idString(get(row, 'ID_LCS_TARIFZEIT'));
      if (!parent || !allPeriodIds.has(parent)) {
        issue(issues, 'ERROR', 'PERIOD_REFERENCE_MISSING', 'Die referenzierte Tarifzeit fehlt oder hat einen ungültigen Schlüssel.', table, row);
        continue;
      }
      const period = periodsById.get(parent);
      if (!period) continue;
      scoped[table].push(row);
      if (table === 'rates') {
        const stagePosition = position(row, 'IX', table), groupPosition = position(row, 'IY', table);
        const group = groupsById.get(period.employeeGroupId);
        if (!group.stages.some(stage => stage.position === stagePosition) || !group.payGroups.some(entry => entry.position === groupPosition)) issue(issues, 'ERROR', 'MATRIX_POSITION_MISSING', `IX ${stagePosition} / IY ${groupPosition} ist in der Variante ${group.legacyId} nicht definiert.`, table, row);
        if (period.rates.some(rate => rate.stagePosition === stagePosition && rate.groupPosition === groupPosition)) issue(issues, 'ERROR', 'DUPLICATE_RATE', `Die Matrixzelle IX ${stagePosition} / IY ${groupPosition} ist für Tarifzeit ${parent} mehrfach vorhanden.`, table, row);
        period.rates.push({ stagePosition, groupPosition, value: decimal(row, 'DWERT', table, true), source: row.source });
      } else {
        if (table === 'wageRules' || table === 'specialPayments') id(row, 'ILOHNARTNR', table);
        if (table === 'specialPayments') {
          const month = id(row, 'IAUSZAHLMONAT', table);
          if (month && Number(month) > 12) issue(issues, 'ERROR', 'INVALID_PAYMENT_MONTH', 'Der Auszahlungsmonat muss zwischen 1 und 12 liegen.', table, row);
        }
        if (table === 'wageRules') {
          for (const [field, entries] of [['ID_LCS_TARIFGRUPPEN', groupsById.get(period.employeeGroupId).payGroups], ['ID_LCS_TARIFSTUFEN', groupsById.get(period.employeeGroupId).stages]]) {
            const restriction = get(row, field);
            // The real export uses -1 in these optional fields. Preserve this
            // legacy marker without inferring its calculation semantics.
            if (empty(restriction) || ['0', '-1'].includes(String(restriction).trim())) continue;
            const restrictionId = id(row, field, table);
            if (!entries.some(entry => entry.legacyId === restrictionId)) issue(issues, 'ERROR', 'RULE_GROUP_MISMATCH', `Die Einschränkung „${field}“ gehört nicht zur Tarifvariante dieser Regel.`, table, row);
          }
        }
        if (table === 'assignmentAllowances') {
          const from = id(row, 'IGRUPPEAB', table), until = id(row, 'IGRUPPEBIS', table);
          if (from && until && BigInt(from) > BigInt(until)) issue(issues, 'ERROR', 'REVERSED_GROUP_RANGE', 'Der Entgeltgruppenbereich der Einsatzzulage ist umgekehrt.', table, row);
          for (const field of ['IABMONATEEINSATZ', 'IABMONATEEINTRITT']) {
            const value = get(row, field);
            if (!/^\d+$/.test(String(value ?? '')) || (typeof value === 'number' && !Number.isSafeInteger(value))) issue(issues, 'ERROR', 'INVALID_THRESHOLD', `„${field}“ muss eine nichtnegative Ganzzahl sein.`, table, row);
          }
        }
        period[table].push(rule(row, table));
      }
    }
  }
  for (const table of ['vacationRules', 'noticePeriods']) {
    scoped[table] = all[table].filter(row => idString(get(row, 'ID_LCS_TARIF')) === CONTRACT_ID);
    if (contract) contract[table] = scoped[table].map(row => rule(row, table));
  }
  const employeeIndex = new Map();
  for (const employee of employees) {
    if (!employee._id) continue;
    const numbers = new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(history => history?.value)].map(idString).filter(Boolean));
    for (const number of numbers) {
      if (!employeeIndex.has(number)) employeeIndex.set(number, new Map());
      employeeIndex.get(number).set(String(employee._id), employee);
    }
  }
  const matchEmployee = (row, table) => {
    const value = personalNumber(row);
    const number = idString(value);
    if (!number) issue(issues, 'ERROR', 'INVALID_PERSONAL_NUMBER', 'Die Personalnummer muss eine positive, exakt darstellbare Ganzzahl sein.', table, row);
    const matches = [...(employeeIndex.get(number)?.values() || [])];
    const matchStatus = matches.length === 1 ? 'MATCHED' : matches.length ? 'AMBIGUOUS' : 'MISSING';
    if (matchStatus !== 'MATCHED') issue(issues, 'WARNING', `EMPLOYEE_${matchStatus}`, `Personalnummer ${value ?? 'ohne Wert'} ${matches.length ? 'ist mehreren Mitarbeiterdatensätzen zugeordnet' : 'wurde keinem Mitarbeiterdatensatz zugeordnet'}.`, table, row);
    return { personalNr: empty(value) ? '' : String(value).trim(), employeeId: matchStatus === 'MATCHED' ? String(matches[0]._id) : null, employeeName: matchStatus === 'MATCHED' ? [matches[0].vorname, matches[0].nachname].filter(Boolean).join(' ') : '', matchStatus };
  };
  scoped.employeeAssignments = all.employeeAssignments.filter(row => idString(get(row, 'ID_LCS_TARIF')) === CONTRACT_ID);
  const assignments = scoped.employeeAssignments.map(row => {
    const employeeGroupId = id(row, 'ID_LCS_TARIFMAGRUPPE', 'employeeAssignments');
    const payGroupId = id(row, 'ID_LCS_TARIFGRUPPEN', 'employeeAssignments');
    const stageId = id(row, 'ID_LCS_TARIFSTUFEN', 'employeeAssignments');
    const group = groupsById.get(employeeGroupId);
    if (!group || !group.payGroups.some(entry => entry.legacyId === payGroupId) || !group.stages.some(entry => entry.legacyId === stageId)) issue(issues, 'ERROR', 'ASSIGNMENT_GROUP_MISMATCH', 'Tarifvariante, Entgeltgruppe und Stufe der Mitarbeiterzuordnung passen nicht zusammen oder fehlen.', 'employeeAssignments', row);
    return { legacyId: id(row, 'ID', 'employeeAssignments', false), ...matchEmployee(row, 'employeeAssignments'), employeeGroupId, payGroupId, stageId, ...interval(row, 'employeeAssignments'), source: row.source };
  });
  const scopedNumbers = new Set(scoped.employeeAssignments.map(row => idString(personalNumber(row))).filter(Boolean));
  scoped.aboveTariff = all.aboveTariff.filter(row => scopedNumbers.has(idString(personalNumber(row))));
  const allowances = scoped.aboveTariff.map(row => ({ legacyId: id(row, 'ID', 'aboveTariff', false), ...matchEmployee(row, 'aboveTariff'), ...interval(row, 'aboveTariff'), values: Object.fromEntries(decimalFields.aboveTariff.map(field => [field, decimal(row, field, 'aboveTariff')])), source: row.source }));
  for (const table of TABLES) {
    unique(scoped[table.key], table.key);
    const known = new Set([...table.requiredColumns, 'ID', ...(optionalColumns[table.key] || [])]);
    const unknown = new Set(scoped[table.key].flatMap(row => Object.keys(rawOf(row))).filter(header => !known.has(normalizeHeader(header))));
    if (unknown.size) issue(issues, 'WARNING', 'UNINTERPRETED_FIELDS', `Zusätzliche Quellspalten werden unverändert aufbewahrt und nicht ausgewertet: ${[...unknown].join(', ')}.`, table.key);
    if (scoped[table.key].length && ['wageRules', 'specialPayments', 'assignmentAllowances', 'aboveTariff', 'referenceWages', 'noticePeriods', 'vacationRules'].includes(table.key)) issue(issues, 'WARNING', 'RULES_NOT_EVALUATED', `„${table.label}“ wird mit seinen Quellwerten aufbewahrt; Berechnung und undokumentierte Codes werden nicht interpretiert.`, table.key);
  }
  warnOverlaps(periods, period => period.employeeGroupId, 'periods', issues);
  warnOverlaps(assignments, assignment => assignment.employeeId || `nr:${idString(assignment.personalNr)}`, 'employeeAssignments', issues);
  warnOverlaps(allowances, allowance => allowance.employeeId || `nr:${idString(allowance.personalNr)}`, 'aboveTariff', issues);
  for (const period of periods) if (!period.rates.length) issue(issues, 'WARNING', 'EMPTY_RATE_MATRIX', `Tarifzeit ${period.legacyId} enthält keine Entgeltwerte.`, 'periods', period);
  return { contract, groups, periods, assignments, allowances, issues, counts: Object.fromEntries(TABLES.map(table => [table.key, scoped[table.key].length])) };
}

function warnOverlaps(entries, identity, table, issues) {
  const partitions = new Map();
  for (const entry of entries) {
    if (!entry.validFrom || entry.intervalStatus === 'INEFFECTIVE' || (entry.validUntil && entry.validUntil < entry.validFrom)) continue;
    const key = identity(entry);
    if (!partitions.has(key)) partitions.set(key, []);
    partitions.get(key).push(entry);
  }
  for (const partition of partitions.values()) {
    partition.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    let maximumEnd = '', hasPrevious = false;
    for (const entry of partition) {
      if (hasPrevious && (maximumEnd === null || entry.validFrom <= maximumEnd)) issue(issues, 'WARNING', 'OVERLAPPING_INTERVALS', 'Zeiträume überschneiden sich einschließlich ihrer Grenztage; betroffene Grundwerte können nicht eindeutig aufgelöst werden.', table, entry);
      const end = entry.validUntil;
      maximumEnd = maximumEnd === null || end === null ? null : maximumEnd > end ? maximumEnd : end;
      hasPrevious = true;
    }
  }
}

const validOn = (entry, date) => Boolean(entry.intervalStatus !== 'INEFFECTIVE' && entry.validFrom && entry.validFrom <= date && (!entry.validUntil || entry.validUntil >= date));

// History aliases establish identity, not concurrent employment relationships.
// A dated row for the current number takes precedence; only if none exists do
// we fall back to history. Never rank aliases by import timestamps or row IDs.
function selectEmployeeRows(rows, employeeId, date, currentPersonalNr) {
  const candidates = (rows || []).filter(entry => entry.matchStatus === 'MATCHED' && String(entry.employeeId) === String(employeeId) && validOn(entry, date));
  const number = idString(currentPersonalNr);
  const current = number ? candidates.filter(entry => idString(entry.personalNr) === number) : [];
  const selected = current.length ? current : candidates;
  return { rows: selected, selection: {
    basis: current.length ? 'CURRENT_PERSONAL_NUMBER' : 'HISTORICAL_PERSONAL_NUMBER',
    currentPersonalNr: currentPersonalNr ? String(currentPersonalNr) : null,
    personalNr: current.length ? String(currentPersonalNr) : selected.length === 1 ? selected[0].personalNr : null,
    excludedPersonalNumbers: current.length ? [...new Set(candidates.filter(entry => idString(entry.personalNr) !== number).map(entry => entry.personalNr))] : [],
  } };
}

function resolveBaseRate(dataset, employeeId, inputDate, currentPersonalNr = null) {
  let date;
  try { date = dateString(inputDate); if (!date) throw new Error('Stichtag fehlt.'); }
  catch (error) { return { status: 'UNRESOLVED', code: 'INVALID_DATE', message: 'Der Stichtag muss ein gültiges Datum im Format JJJJ-MM-TT sein.', currency: 'EUR', date: inputDate, allowances: [] }; }
  const above = selectEmployeeRows(dataset.allowances, employeeId, date, currentPersonalNr);
  const assigned = selectEmployeeRows(dataset.assignments, employeeId, date, currentPersonalNr);
  const result = { currency: 'EUR', date, allowances: above.rows, allowanceSelection: above.selection, assignmentSelection: assigned.selection };
  const fail = (code, message) => ({ ...result, status: 'UNRESOLVED', code, message });
  const assignments = assigned.rows;
  if (!assignments.length) return fail('ASSIGNMENT_MISSING', 'Für diesen Mitarbeiter und Stichtag liegt keine eindeutig zugeordnete, gültige Tarifzuordnung vor.');
  if (assignments.length > 1) return fail('ASSIGNMENT_AMBIGUOUS', `${assignments.length} Tarifzuordnungen gelten gleichzeitig. Die überlappenden Zeiträume müssen geklärt werden.`);
  result.assignment = assignments[0];
  const groups = (dataset.groups || []).filter(group => group.legacyId === result.assignment.employeeGroupId);
  if (groups.length !== 1) return fail('GROUP_MISSING_OR_AMBIGUOUS', 'Die Tarifvariante fehlt oder ist mehrfach vorhanden.');
  result.group = groups[0];
  const payGroups = result.group.payGroups.filter(group => group.legacyId === result.assignment.payGroupId);
  const stages = result.group.stages.filter(stage => stage.legacyId === result.assignment.stageId);
  if (payGroups.length !== 1 || stages.length !== 1) return fail('POSITION_MISSING_OR_AMBIGUOUS', 'Entgeltgruppe oder Tarifstufe ist in dieser Variante nicht eindeutig zugeordnet.');
  result.payGroup = payGroups[0]; result.stage = stages[0];
  const periods = (dataset.periods || []).filter(period => period.employeeGroupId === result.group.legacyId && validOn(period, date));
  if (!periods.length) return fail('PERIOD_MISSING', 'Für diese Tarifvariante und diesen Stichtag fehlt eine gültige Tarifperiode.');
  if (periods.length > 1) return fail('PERIOD_AMBIGUOUS', `${periods.length} Tarifperioden gelten gleichzeitig. Die überlappenden Zeiträume müssen geklärt werden.`);
  result.period = periods[0];
  const rates = result.period.rates.filter(rate => rate.stagePosition === result.stage.position && rate.groupPosition === result.payGroup.position);
  if (!rates.length) return fail('RATE_MISSING', `Für IX ${result.stage.position} / IY ${result.payGroup.position} fehlt ein Entgeltwert.`);
  if (rates.length > 1) return fail('RATE_AMBIGUOUS', 'Die Entgeltmatrix enthält mehrere Werte für dieselbe Gruppe und Stufe.');
  if (rates[0].value === null) return fail('RATE_INVALID', 'Der Entgeltwert ist ungültig.');
  return { ...result, status: 'RESOLVED', value: rates[0].value };
}

// ÜTZ is an independent employee history. Never pick one of overlapping rows
// or add its separate source fields into a guessed allowance amount.
function resolveAboveTariff(dataset, employeeId, inputDate, currentPersonalNr = null) {
  let date;
  try { date = dateString(inputDate); if (!date) throw new Error('Stichtag fehlt.'); }
  catch (_) { return { status: 'UNRESOLVED', code: 'INVALID_DATE', message: 'Der Stichtag muss ein gültiges Datum im Format JJJJ-MM-TT sein.', date: inputDate, candidateCount: 0 }; }
  const selected = selectEmployeeRows(dataset.allowances, employeeId, date, currentPersonalNr);
  const matches = selected.rows;
  const result = { date, currency: 'EUR', candidateCount: matches.length, selection: selected.selection };
  if (!matches.length) return { ...result, status: 'UNRESOLVED', code: 'ABOVE_TARIFF_MISSING', message: 'Für diesen Mitarbeiter ist am Stichtag keine gültige ÜTZ hinterlegt.' };
  if (matches.length > 1) return { ...result, status: 'UNRESOLVED', code: 'ABOVE_TARIFF_AMBIGUOUS', message: `${matches.length} ÜTZ-Einträge gelten gleichzeitig. Die überlappenden Zeiträume müssen geklärt werden.` };
  return { ...result, status: 'RESOLVED', values: matches[0].values, record: matches[0] };
}

function rowsByRole(dataset) {
  const groups = dataset?.groups || [], periods = dataset?.periods || [];
  return {
    contract: dataset?.contract ? [dataset.contract] : [], employeeGroups: groups,
    payGroups: groups.flatMap(group => group.payGroups), stages: groups.flatMap(group => group.stages), periods,
    rates: periods.flatMap(period => period.rates), wageRules: periods.flatMap(period => period.wageRules), specialPayments: periods.flatMap(period => period.specialPayments), assignmentAllowances: periods.flatMap(period => period.assignmentAllowances),
    employeeAssignments: dataset?.assignments || [], aboveTariff: dataset?.allowances || [], referenceWages: groups.flatMap(group => group.referenceWages), noticePeriods: dataset?.contract?.noticePeriods || [], vacationRules: dataset?.contract?.vacationRules || [],
  };
}
const compareKeyFields = {
  rates: ['ID_LCS_TARIFZEIT', 'IX', 'IY'], wageRules: ['ID_LCS_TARIFZEIT', 'ILOHNARTNR', 'IGRUPPE', 'DAB', 'DBIS', 'ID_LCS_TARIFGRUPPEN', 'ID_LCS_TARIFSTUFEN'],
  specialPayments: ['ID_LCS_TARIFZEIT', 'CBEZEICHNUNG'], assignmentAllowances: ['ID_LCS_TARIFZEIT', 'IGRUPPEAB', 'IGRUPPEBIS', 'ISTUFEAB', 'ISTUFEBIS', 'IABMONATEEINSATZ', 'IABMONATEEINTRITT'],
  employeeAssignments: ['IPERSONALNR', 'DTVON'], aboveTariff: ['IPERSONALNR', 'DTVON'], referenceWages: ['ID_LCS_TARIFMAGRUPPE'], noticePeriods: ['ID_LCS_TARIF', 'IANZAHLANG', 'ITYPANG'], vacationRules: ['ID_LCS_TARIF', 'IJAHR', 'GUELTIGBISJAHR'],
};
const stableRaw = row => JSON.stringify(Object.fromEntries(Object.entries(rawOf(row)).map(([key, value]) => [normalizeHeader(key), value instanceof Date ? value.toISOString() : value]).sort(([a], [b]) => a.localeCompare(b))));

function compareDatasets(previous, next) {
  const before = rowsByRole(previous), after = rowsByRole(next);
  const changes = {};
  for (const { key } of TABLES) {
    const buckets = rows => {
      const map = new Map();
      for (const row of rows) {
        const legacyId = idString(get(row, 'ID'));
        const identity = legacyId || JSON.stringify((compareKeyFields[key] || []).map(field => field === 'IPERSONALNR' ? personalNumber(row) : get(row, field)));
        if (!map.has(identity)) map.set(identity, []);
        map.get(identity).push(stableRaw(row));
      }
      return map;
    };
    const oldRows = buckets(before[key]), newRows = buckets(after[key]);
    const counts = { added: 0, removed: 0, changed: 0, unchanged: 0 };
    for (const identity of new Set([...oldRows.keys(), ...newRows.keys()])) {
      const oldValues = [...(oldRows.get(identity) || [])], newValues = [...(newRows.get(identity) || [])];
      for (let index = oldValues.length - 1; index >= 0; index--) {
        const match = newValues.indexOf(oldValues[index]);
        if (match !== -1) { counts.unchanged++; oldValues.splice(index, 1); newValues.splice(match, 1); }
      }
      const changed = Math.min(oldValues.length, newValues.length);
      counts.changed += changed; counts.removed += oldValues.length - changed; counts.added += newValues.length - changed;
    }
    changes[key] = counts;
  }
  return changes;
}

module.exports = { CONTRACT_ID, TABLES, parseFiles, buildDataset, resolveBaseRate, resolveAboveTariff, compareDatasets, collectPersonalNumbers, decimalString, dateString };
