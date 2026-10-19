// Pure operational calculation: reference results are intentionally not an input.
const exact = require('../../services/tariffs/tariffMoney');
const { decimal, sumDecimals } = require('./zvooveHours');
const { problem, fail, date } = require('./detailImport');
const VERSION = 'operational-time-1';
const berlin = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const POLICY_VALUES = { rounding: ['HALF_UP_PER_POSITION'], dayBasis: ['SEGMENT_DATE', 'SHIFT_DATE'], supplementBasis: ['RULE_PRICE', 'BASE_RATE'], overlap: ['STACK', 'HIGHEST_ONLY'], precedence: ['EMPLOYEE_OVER_ORDER'] };
function policies(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Berechnungsparameter müssen ein Objekt sein.');
  if (Object.keys(input).some(key => ![...Object.keys(POLICY_VALUES), 'holidayDates'].includes(key))) fail('Unbekannter Berechnungsparameter.');
  const result = {};
  for (const [key, values] of Object.entries(POLICY_VALUES)) {
    if (input[key] != null && !values.includes(input[key])) fail(`Ungültiger Berechnungsparameter ${key}.`);
    result[key] = input[key] ?? null;
  }
  if (input.holidayDates != null) {
    try {
      if (!Array.isArray(input.holidayDates) || input.holidayDates.length > 400 || input.holidayDates.some(value => typeof value !== 'string' || date(value) !== value)) throw new Error('Invalid calendar');
    } catch { fail('Feiertage als Liste konkreter YYYY-MM-DD-Daten angeben.'); }
  }
  result.holidayDates = input.holidayDates == null ? null : [...new Set(input.holidayDates)].sort();
  return result;
}
function appendSegment(list, value) {
  const last = list[list.length - 1];
  if (last && last.end === value.start && last.date === value.date && last.kind === value.kind) { last.end = value.end; last.minutes += value.minutes; }
  else list.push({ ...value });
}
function workSegments(booking, month) {
  const result = [];
  if (!booking.start || !booking.end || new Date(booking.end) <= new Date(booking.start) || new Date(booking.end) - new Date(booking.start) > 1500 * 60000) return result;
  for (let t = +new Date(booking.start); t < +new Date(booking.end); t += 60000) {
    const day = berlin.format(new Date(t)).slice(0, 10);
    if (month && !day.startsWith(month)) continue;
    const pause = booking.breaks.find(block => t >= +new Date(block.start) && t < +new Date(block.end));
    appendSegment(result, { start: new Date(t).toISOString(), end: new Date(t + 60000).toISOString(), date: day, minutes: 1, kind: pause ? pause.paid ? 'PAID_BREAK' : 'BREAK' : 'WORK' });
  }
  return result;
}
function matches(rule, instant, booking, p) {
  const local = berlin.format(new Date(instant)), segmentDay = local.slice(0, 10);
  const day = p.dayBasis === 'SHIFT_DATE' ? booking.date : segmentDay;
  if (rule.fromDate && segmentDay < rule.fromDate || rule.untilDate && segmentDay > rule.untilDate) return false;
  const minute = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const window = rule.windowStart === 0 && rule.windowEnd === 1440 || rule.windowStart < rule.windowEnd && minute >= rule.windowStart && minute < rule.windowEnd || rule.windowStart > rule.windowEnd && (minute >= rule.windowStart || minute < rule.windowEnd);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return window && (rule.weekdays.includes(weekday) || rule.holiday && p.holidayDates?.includes(day));
}
function candidates(rules, booking, side, p, issues) {
  let found = rules.filter(rule => rule.side === side && rule.auftragNr === booking.auftragNr && (rule.personalNr == null || rule.personalNr === booking.personalNr) && (rule.einsortNr == null || rule.einsortNr === '0' || rule.einsortNr === booking.einsortNr));
  for (const rule of found) {
    issues.push(...rule.issues.map(item => ({ ...item, source: String(rule._id) })));
    if (rule.automatic === false) issues.push(problem('MANUAL_RULE_PENDING', `Manuelle Lohnart ${rule.wageType} benötigt eine eigene Position.`, String(rule._id)));
    if (rule.assignmentNumber && rule.assignmentNumber !== '0') {
      // EINSPERSNR is not a Mongo assignment ID or a shift ID.
      // PERSONALNR alone does not establish which assignment this row belongs to.
      if (!booking.assignmentNumber || booking.assignmentNumber !== rule.assignmentNumber) issues.push(problem('ASSIGNMENT_RULE_UNRESOLVED', 'EINSPERSNR ist nicht eindeutig einer Zeitbuchung zugeordnet.', String(rule._id)));
    }
    if (rule.holiday && p.holidayDates == null) issues.push(problem('HOLIDAY_CALENDAR_MISSING', 'Konkreter Feiertagskalender für den Berechnungsumfang fehlt.', String(rule._id)));
    if (p.dayBasis == null && (rule.weekdays.length !== 7 || rule.holiday)) issues.push(problem('DAY_BASIS_MISSING', 'Tagesbezug der Regel muss ausdrücklich angegeben werden.', String(rule._id)));
  }
  return found.filter(rule => rule.automatic === true && !rule.issues.length && (!rule.assignmentNumber || rule.assignmentNumber === '0' || booking.assignmentNumber === rule.assignmentNumber) && (!rule.holiday || p.holidayDates != null) && (p.dayBasis != null || rule.weekdays.length === 7 && !rule.holiday));
}
function calculate({ bookings, rules, wageTypes, rates, side, month, policies: p }) {
  const positions = [], issueMap = new Map(), observed = new Set();
  // Minute evaluation may encounter the same unresolved condition repeatedly.
  const issues = { push: (...values) => values.forEach(value => issueMap.set(JSON.stringify(value), value)) };
  if (!bookings.length) issues.push(problem('NO_BOOKINGS', 'Für die Auswahl liegen keine Detailbuchungen vor.'));
  if (p.rounding == null) issues.push(problem('ROUNDING_POLICY_MISSING', 'Rundung für die Modellrechnung muss ausdrücklich angegeben werden.'));
  let productiveMinutes = 0;
  const overlaps = new Set();
  for (let i = 0; i < bookings.length; i++) for (let j = i + 1; j < bookings.length; j++) {
    const a = bookings[i], b = bookings[j];
    if (String(a.employeeId || a.personalNr) === String(b.employeeId || b.personalNr) && a.start && b.start && a.end && b.end && new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end)) {
      overlaps.add(String(a._id)); overlaps.add(String(b._id));
    }
  }
  const wageMap = new Map(wageTypes.map(wage => [wage.lohnartNummer, wage]));
  function addPosition(booking, day, wageType, segments, rate, rateSource, rule, percent = null) {
    const wage = wageMap.get(wageType);
    if (!wage) { issues.push(problem('WAGE_TYPE_MISSING', `Lohnart ${wageType} fehlt im Stamm.`)); return; }
    const calculation = String(wage.berechnungsartCode || '');
    if (!(percent != null ? calculation === '4' : calculation === '2')) { issues.push(problem('CALCULATION_TYPE_UNSUPPORTED', `Lohnart ${wageType}: Berechnungsart ${calculation || 'fehlend'} wird für diese Position nicht interpretiert.`)); return; }
    if (rate == null) { issues.push(problem('RATE_MISSING', `Satz für Lohnart ${wageType} fehlt.`)); return; }
    const minutes = segments.reduce((sum, segment) => sum + segment.minutes, 0);
    let amount = exact.multiply({ numerator: BigInt(minutes), denominator: 60n }, exact.decimalParts(rate));
    if (percent != null) amount = exact.multiply(amount, exact.multiply(exact.decimalParts(percent), { numerator: 1n, denominator: 100n }));
    positions.push({ personalNr: booking.personalNr, employeeId: booking.employeeId, auftragNr: booking.auftragNr, date: day, month: day.slice(0, 7), wageType, unit: 'HOUR', minutes,
      quantityNumerator: String(minutes), quantityDenominator: '60', rate, percent, amount: p.rounding ? exact.money(amount) : null,
      exactNumerator: String(amount.numerator), exactDenominator: String(amount.denominator), bookingIds: [String(booking._id)], ruleIds: rule ? [String(rule._id)] : [], segments, rateSource });
  }
  for (const booking of bookings) {
    issues.push(...booking.issues.map(issue => ({ ...issue, source: String(booking._id) })));
    if (overlaps.has(String(booking._id))) { issues.push(problem('BOOKING_OVERLAP', 'Weitere ausgewählte Buchung überschneidet sich mit dieser Arbeitszeit.', String(booking._id))); continue; }
    if (booking.issues.length || !booking.start || !booking.end || booking.productiveMinutes == null) continue;
    const segments = workSegments(booking, month);
    if (segments.some(segment => segment.kind === 'PAID_BREAK')) issues.push(problem('PAID_BREAK_POLICY_UNRESOLVED', 'Produktive Zeit bleibt erhalten; Bewertung bezahlter Pausen ist ungeklärt.', String(booking._id)));
    productiveMinutes += segments.filter(segment => segment.kind === 'WORK').reduce((sum, segment) => sum + segment.minutes, 0);
    const days = [...new Set(segments.map(segment => segment.date))];
    const activeRules = candidates(rules, booking, side, p, issues);
    if (booking.guaranteedMinutes > 0) issues.push(problem('GUARANTEE_UNRESOLVED', 'Garantieleistung ist noch nicht bewertet.', String(booking._id)));
    for (const day of days) {
      const work = segments.filter(segment => segment.date === day && segment.kind === 'WORK');
      if (!work.length) continue;
      const tariff = rates.find(rate => rate.employeeId === String(booking.employeeId) && rate.date === day);
      if (side === 'L') {
        if (!booking.employeeId || !tariff || tariff.baseRate == null) issues.push(problem('TARIFF_UNRESOLVED', 'Tarifgrundlohn ist nicht eindeutig aufgelöst.', String(booking._id)));
        else {
          addPosition(booking, day, '100', work, tariff.baseRate, `tariff:${tariff.importId}`, null);
          if (tariff.allowance == null) issues.push(problem('ALLOWANCE_UNRESOLVED', 'ÜTZ ist nicht eindeutig aufgelöst.', String(booking._id)));
          else if (Number(tariff.allowance) !== 0) {
            addPosition(booking, day, '110', work, tariff.allowance, `allowance:${tariff.importId}`, null);
            const allowance = wageMap.get('110');
            if (allowance?.verrechnungCode && allowance.verrechnungCode !== '0') issues.push(problem('ALLOWANCE_OFFSET_UNRESOLVED', 'ÜTZ ist separat bewertet; die konfigurierte Verrechnung ist noch ungeklärt.', String(booking._id)));
          }
          if (tariff.pendingTariffRules) issues.push(problem('TARIFF_RULES_PENDING', 'Weitere Tarifregeln, etwa AZK, sind noch nicht ausgewiesen.', String(booking._id)));
        }
      }
      const chosen = new Map();
      for (const segment of work) for (let t = +new Date(segment.start); t < +new Date(segment.end); t += 60000) {
        const applicable = activeRules.filter(rule => matches(rule, t, booking, p)), matching = [];
        for (const wageType of new Set(applicable.map(rule => rule.wageType))) {
          const group = applicable.filter(rule => rule.wageType === wageType), individual = group.filter(rule => rule.personalNr != null), defaults = group.filter(rule => rule.personalNr == null);
          if (individual.length && defaults.length && p.precedence == null) { issues.push(problem('RULE_PRECEDENCE_MISSING', 'Vorrang zwischen Mitarbeiterregel und Auftragsvorgabe fehlt.')); continue; }
          matching.push(...(individual.length ? individual : defaults));
        }
        let base = matching.filter(rule => rule.wageType === '100');
        let supplements = matching.filter(rule => rule.wageType !== '100');
        if (side === 'F' && base.length !== 1) {
          const key = `${booking._id}:${day}:base`;
          if (!observed.has(key)) { observed.add(key); issues.push(problem('BASE_RULE_UNRESOLVED', 'Faktur benötigt genau eine zutreffende Grundstundenregel.', String(booking._id))); }
          base = [];
        }
        if (side === 'L') base = [];
        if (supplements.length && !p.supplementBasis) { issues.push(problem('SUPPLEMENT_BASIS_MISSING', 'Zuschlagsbasis muss ausdrücklich angegeben werden.')); supplements = []; }
        if (supplements.length > 1 && !p.overlap) { issues.push(problem('SUPPLEMENT_OVERLAP_UNRESOLVED', 'Überschneidung mehrerer Zuschläge ist ungeklärt.')); supplements = []; }
        if (supplements.length > 1 && p.overlap === 'HIGHEST_ONLY') {
          // Compare monetary rates, rather than percentages on different bases.
          const effective = rule => {
            const rate = p.supplementBasis === 'RULE_PRICE' ? rule.rate : side === 'L' ? tariff?.baseRate : base[0]?.rate;
            return rate == null || rule.percent == null ? null : exact.multiply(exact.decimalParts(rate), exact.decimalParts(rule.percent));
          };
          if (supplements.some(rule => !effective(rule))) { issues.push(problem('RATE_MISSING', 'Zuschlagsvorrang kann ohne vollständige Sätze nicht bestimmt werden.')); supplements = []; }
          else supplements = [supplements.reduce((a, b) => {
            const x = effective(a), y = effective(b); return x.numerator * y.denominator >= y.numerator * x.denominator ? a : b;
          })];
        }
        const repeated = supplements.some((rule, i) => supplements.some((other, j) => i !== j && other.wageType === rule.wageType));
        if (repeated) { issues.push(problem('DUPLICATE_WAGE_RULE', 'Mehrere Zuschlagsregeln derselben Lohnart treffen zu.')); supplements = []; }
        for (const rule of [...base, ...supplements]) {
          const isBase = rule.wageType === '100';
          const rate = isBase || p.supplementBasis === 'RULE_PRICE' ? rule.rate : side === 'L' ? tariff?.baseRate : base[0]?.rate;
          if (!isBase && (rule.percent == null || Number(rule.percent) <= 0)) { issues.push(problem('SUPPLEMENT_UNRESOLVED', `Lohnart ${rule.wageType}: positiver Zuschlagsprozentsatz fehlt.`)); continue; }
          const key = String(rule._id);
          if (!chosen.has(key)) chosen.set(key, { rule, rate, segments: [] });
          appendSegment(chosen.get(key).segments, { start: new Date(t).toISOString(), end: new Date(t + 60000).toISOString(), date: day, minutes: 1, kind: 'WORK' });
        }
      }
      for (const value of chosen.values()) addPosition(booking, day, value.rule.wageType, value.segments, value.rate, `rule:${value.rule._id}`, value.rule, value.rule.wageType === '100' ? null : value.rule.percent);
    }
  }
  const uniqueIssues = [...issueMap.values()];
  const groups = new Map(), invoices = new Map();
  for (const position of positions) {
    const key = JSON.stringify([position.personalNr, position.month, position.wageType, position.unit]);
    if (!groups.has(key)) groups.set(key, { personalNr: position.personalNr, month: position.month, wageType: position.wageType, unit: position.unit, minutes: 0, amounts: [] });
    const group = groups.get(key); group.minutes += position.minutes; group.amounts.push(position.amount);
    const invoiceKey = JSON.stringify([position.auftragNr, position.month]);
    if (!invoices.has(invoiceKey)) invoices.set(invoiceKey, { auftragNr: position.auftragNr, month: position.month, amounts: [] });
    invoices.get(invoiceKey).amounts.push(position.amount);
  }
  const sum = values => values.some(value => value == null) ? null : exact.money(exact.decimalParts(sumDecimals(values)));
  return { calculationVersion: VERSION, status: uniqueIssues.length ? 'INCOMPLETE' : 'PREVIEW', policies: p,
    lohnpositionen: side === 'L' ? positions : [], fakturpositionen: side === 'F' ? positions : [], issues: uniqueIssues,
    totals: { productiveMinutes, amount: uniqueIssues.length ? null : sum(positions.map(position => position.amount)) },
    monthlySummaries: [...groups.values()].map(({ amounts, ...group }) => ({ ...group, amount: sum(amounts) })),
    invoiceDrafts: side === 'F' ? [...invoices.values()].map(({ amounts, ...invoice }) => ({ ...invoice, netAmount: uniqueIssues.length ? null : sum(amounts) })) : [] };
}
function compare(run, references, kind) {
  const differences = [], expected = new Map(), actual = new Map();
  if (!['LOHNPOSITIONEN', 'LOHNARTENSUMMEN', 'FAKTURPOSITIONEN', 'RECHNUNGEN'].includes(kind)) fail('Referenzart fehlt oder ist ungültig.');
  const side = ['FAKTURPOSITIONEN', 'RECHNUNGEN'].includes(kind) ? 'F' : 'L';
  if (side !== run.side) fail('Referenzart passt nicht zur Ausweisungsseite.');
  const positions = side === 'L' ? run.lohnpositionen : run.fakturpositionen;
  const selectedReferences = references.filter(row => row.kind === kind);
  const includeOrder = kind === 'FAKTURPOSITIONEN' || selectedReferences.some(row => row.auftragNr != null);
  const rateGroups = ['LOHNPOSITIONEN', 'FAKTURPOSITIONEN'].includes(kind) && selectedReferences.length > 0 && selectedReferences.every(row => row.rate != null);
  const percentGroups = rateGroups && selectedReferences.every(row => row.percent != null);
  const granularity = kind === 'RECHNUNGEN' ? 'ORDER_NET_TOTAL' : kind === 'LOHNARTENSUMMEN' ? 'MONTH_WAGE_TOTAL' : percentGroups ? 'DAY_WAGE_RATE_PERCENT_TOTAL' : rateGroups ? 'DAY_WAGE_RATE_TOTAL' : 'DAY_WAGE_TOTAL';
  const mixedOrderScope = kind === 'LOHNPOSITIONEN' && includeOrder && selectedReferences.some(row => row.auftragNr == null);
  if (mixedOrderScope) differences.push({ key: kind, code: 'REFERENCE_SCOPE_UNRESOLVED', actual: null, expected: null, delta: null });
  const key = row => JSON.stringify(kind === 'RECHNUNGEN' ? [row.auftragNr]
    : kind === 'LOHNARTENSUMMEN' ? [row.personalNr, row.month, row.wageType, row.unit]
      : [row.personalNr, ...(includeOrder ? [row.auftragNr ?? null] : []), row.date, row.wageType, row.unit, ...(rateGroups ? [row.rate == null ? null : decimal(row.rate)] : []), ...(percentGroups ? [decimal(row.percent ?? '0')] : [])]);
  function group(map, row, reference) {
    const k = key(row), value = map.get(k) || { quantity: exact.zero(), amount: exact.zero(), rates: new Set(), incomplete: false };
    if (kind !== 'RECHNUNGEN') value.quantity = exact.add(value.quantity, reference ? exact.decimalParts(row.quantity) : { numerator: BigInt(row.quantityNumerator), denominator: BigInt(row.quantityDenominator) });
    if (row.amount == null) value.incomplete = true; else value.amount = exact.add(value.amount, exact.decimalParts(row.amount));
    if (row.rate != null) value.rates.add(decimal(row.rate));
    map.set(k, value);
  }
  selectedReferences.forEach(row => group(expected, row, true)); positions.forEach(row => group(actual, row, false));
  if (!selectedReferences.length) differences.push({ key: kind, code: 'REFERENCE_MISSING', actual: null, expected: null, delta: null });
  for (const k of new Set([...actual.keys(), ...expected.keys()])) {
    const a = actual.get(k), e = expected.get(k);
    if (!a || !e) { differences.push({ key: k, code: a ? 'UNEXPECTED_POSITION' : 'MISSING_POSITION', actual: a ? exact.money(a.amount) : null, expected: e ? exact.money(e.amount) : null, delta: null }); continue; }
    if (a.incomplete) { differences.push({ key: k, code: 'AMOUNT_UNRESOLVED', actual: null, expected: exact.money(e.amount), delta: null }); continue; }
    const quantityDelta = exact.add(a.quantity, { ...e.quantity, numerator: -e.quantity.numerator });
    if (kind !== 'RECHNUNGEN' && quantityDelta.numerator !== 0n) differences.push({ key: k, code: 'QUANTITY_DIFFERENCE', actual: `${a.quantity.numerator}/${a.quantity.denominator}`, expected: `${e.quantity.numerator}/${e.quantity.denominator}`, delta: `${quantityDelta.numerator}/${quantityDelta.denominator}` });
    const amountDelta = exact.add(a.amount, { ...e.amount, numerator: -e.amount.numerator });
    if (amountDelta.numerator !== 0n) differences.push({ key: k, code: 'AMOUNT_DIFFERENCE', actual: exact.money(a.amount), expected: exact.money(e.amount), delta: exact.money(amountDelta) });
    if (!['LOHNARTENSUMMEN', 'RECHNUNGEN'].includes(kind) && e.rates.size && (a.rates.size !== e.rates.size || [...a.rates].some(rate => !e.rates.has(rate)))) differences.push({ key: k, code: 'RATE_DIFFERENCE', actual: [...a.rates].sort().join(','), expected: [...e.rates].sort().join(','), delta: null });
  }
  return { granularity, status: run.status === 'INCOMPLETE' || !selectedReferences.length || mixedOrderScope || differences.some(difference => difference.code === 'AMOUNT_UNRESOLVED') ? 'INCOMPLETE' : differences.length ? 'DIFFERENT' : 'MATCH', differences };
}
module.exports = { VERSION, policies, workSegments, calculate, compare };
