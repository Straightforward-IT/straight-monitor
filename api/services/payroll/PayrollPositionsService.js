const models = require('../../models/Payroll/Abrechnung');
const Lohnart = require('../../models/Payroll/Lohnart');
const Auftrag = require('../../models/Event/Auftrag');
const Einsatz = require('../../models/Event/Einsatz');
const Kunde = require('../../models/Customer/Kunde');
const Kundenpreis = require('../../models/Customer/Kundenpreis');
const KundenKondition = require('../../models/Customer/KundenKondition');
const capture = require('../TimeCaptureService');
const accounting = require('./AbrechnungService');
const hoursService = require('./ZvooveHoursService');
const engine = require('../../domain/payroll/ausweisung');
const d = require('../../domain/payroll/detailImport');
const exact = require('../tariffs/tariffMoney');
const { decimal, sumDecimals } = require('../../domain/payroll/zvooveHours');
const { getSettingDefinition } = require('../../domain/payroll/wageTypeSettings');

const POLICIES = engine.policies({ rounding: 'HALF_UP_PER_POSITION', dayBasis: 'SEGMENT_DATE', supplementBasis: 'RULE_PRICE', overlap: 'STACK', precedence: 'EMPLOYEE_OVER_ORDER' });
const problem = (code, message) => ({ code, message });
function flag(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (['JA', 'YES', 'J', 'Y', 'TRUE', '1'].includes(normalized)) return true;
    if (['NEIN', 'NO', 'N', 'FALSE', '0'].includes(normalized)) return false;
  }
  try { return d.flag(value); } catch { return null; }
}
function value(hours, rate) {
  if (hours == null || rate == null) return null;
  return exact.money(exact.multiply(exact.decimalParts(hours), exact.decimalParts(rate)));
}
function hoursFor(minutes) {
  // Keep the exact minute fraction separately. Decimal text is display only.
  if (minutes == null) return null;
  return decimal((minutes / 60).toFixed(10));
}
function baseRow(booking, side, wage, extra = {}) {
  const offset = getSettingDefinition('offset', wage?.verrechnungCode);
  return { id: `${booking._id}:${side}:${wage?.lohnartNummer || '100'}`, date: booking.date, serviceDate: booking.date,
    side, kind: 'productive', personalNr: booking.personalNr, auftragNr: booking.auftragNr || null, einsortNr: booking.einsortNr || null,
    assignmentId: booking.assignmentId || null, project: null, activity: null,
    wageType: wage?.lohnartNummer || '100', label: wage?.lohnartBezeichnung || 'Normalstunden', days: 1,
    hours: booking.reportedHours ?? hoursFor(booking.productiveMinutes), quantityNumerator: booking.productiveMinutes == null ? null : String(booking.productiveMinutes), quantityDenominator: booking.productiveMinutes == null ? null : '60',
    rate: null, percent: null, amount: null, status: 'PENDING', issues: [],
    countForTotalHours: flag(wage?.fuerGesamtstunden), offset: { code: wage?.verrechnungCode || null, label: offset?.label || null, target: wage?.verrechnungslohnartNummer || null, priority: wage?.verrechnungsPrioritaet || null },
    rateSource: null, ...extra };
}
function describeOffset(row) {
  if (row.side === 'L' && row.offset.code && row.offset.code !== '0') row.issues.push(problem('ALLOWANCE_OFFSET_UNRESOLVED', `Verrechnung ${row.offset.label || row.offset.code}${row.offset.target ? ` → ${row.offset.target}` : ''} ist noch offen.`));
  return row;
}

/** Read-only presentation of our calculation. No AUSWEISLOHN/expected prices are read. */
async function month(user, employeeId, requestedMonth) {
  if (!accounting.isPayroll(user)) d.fail('Für eigene Lohnpositionen fehlt die Berechtigung.', 'PAYROLL_POSITIONS_FORBIDDEN', 403);
  const employee = await accounting.employeeFor(user, employeeId);
  if (typeof requestedMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) d.fail('Monat im Format YYYY-MM angeben.');
  const sides = accounting.isAdmin(user) ? ['L', 'F'] : ['L'];
  const [monthly, detail, wages] = await Promise.all([
    hoursService.month(user, employeeId, requestedMonth),
    accounting.bookings(user, { employeeId, month: requestedMonth }),
    Lohnart.find().select('lohnartNummer lohnartBezeichnung kb berechnungsartCode fuerGesamtstunden verrechnungCode verrechnungslohnartNummer verrechnungsPrioritaet fakturierungCode').lean(),
  ]);
  const annualSource = detail.sources.find(source => source.key === `INPUT:year:${requestedMonth.slice(0, 4)}`);
  if ((monthly.sourceMode === 'TIME_BOOKINGS') !== !!annualSource || annualSource && annualSource.revision !== monthly.datasetRevision) d.fail('Zeitdaten wurden während der Berechnung geändert. Stand neu laden.', 'PAYROLL_POSITIONS_STALE', 409);
  // This workspace follows the booking day shown in its matrix, including the
  // complete overnight shift. Actual segment dates remain available per row.
  const bookings = detail.bookings.filter(booking => booking.date?.startsWith(requestedMonth));
  const quantities = monthly.entries.filter(entry => entry.kind === 'productive' && !entry.booking && !bookings.some(booking => booking.date === entry.date)).map(entry => ({
    _id: `quantity:${entry.id}`, date: entry.date, personalNr: String(entry.personalNr), employeeId: String(employee._id), reportedHours: entry.hours,
    productiveMinutes: null, auftragNr: null, breaks: [], issues: [], start: null, end: null,
  }));
  if (bookings.length + quantities.length > 2000) d.fail('Zu viele Zeitbuchungen für eine Monatsvorschau.');
  const sourceIds = detail.sources.map(source => source.snapshotId).filter(Boolean);
  const orderNumbers = [...new Set(bookings.map(booking => booking.auftragNr).filter(Boolean))];
  const [rules, rates, orders, assignments] = await Promise.all([
    models.Rule.find({ snapshotId: { $in: sourceIds }, auftragNr: { $in: orderNumbers }, side: { $in: sides } }).lean(),
    accounting.buildRates([...bookings, ...quantities], String(employee._id)),
    Auftrag.find({ auftragNr: { $in: orderNumbers } }).select('auftragNr kundenNr eventTitel einsatzort locationV2').populate('einsatzort', 'bezeichnung').lean(),
    Einsatz.find({ _id: { $in: bookings.map(booking => booking.assignmentId).filter(Boolean) } }).select('qualSchl berufSchl bezeichnung').lean(),
  ]);
  const visibleOrders = orders.filter(order => capture.canAccess(user, order.locationV2));
  const customers = visibleOrders.length ? await Kunde.find({ kundenNr: { $in: visibleOrders.map(order => order.kundenNr).filter(Boolean) } }).select('kundenNr').lean() : [];
  const [prices, conditions] = customers.length ? await Promise.all([
    sides.includes('F') ? Kundenpreis.find({ kunde: { $in: customers.map(customer => customer._id) } }).lean() : [],
    KundenKondition.find({ kunde: { $in: customers.map(customer => customer._id) }, verwendung: { $in: sides } }).lean(),
  ]) : [[], []];
  const wageMap = new Map(wages.map(wage => [wage.lohnartNummer, wage]));
  const issues = [], rows = [];
  if (monthly.sourceMode !== 'TIME_BOOKINGS') for (const day of new Set(bookings.map(booking => booking.date))) {
    const summarized = monthly.entries.filter(entry => entry.date === day && entry.kind === 'productive');
    if (summarized.length && sumDecimals(summarized.map(entry => entry.hours)) !== sumDecimals(bookings.filter(booking => booking.date === day).map(booking => booking.reportedHours))) issues.push({ ...problem('DETAIL_COVERAGE_UNRESOLVED', 'Detailbuchungen und produktive Tagesmenge weichen voneinander ab. Keine doppelte Übernahme.'), date: day });
  }
  // Value base hours at the customer's price for this assignment's actual
  // qualification and booking date. Supplement rules keep their own terms.
  const priceRules = [];
  for (const booking of bookings) {
    if (!sides.includes('F')) continue;
    const order = visibleOrders.find(order => order.auftragNr === booking.auftragNr);
    const assignment = assignments.find(assignment => String(assignment._id) === String(booking.assignmentId));
    const customer = customers.find(customer => customer.kundenNr === order?.kundenNr);
    const qualification = String(assignment?.qualSchl ?? '').trim();
    const qualificationKey = /^\d+$/.test(qualification) && Number.isSafeInteger(Number(qualification)) ? Number(qualification) : null;
    const matching = customer && qualificationKey != null ? prices.filter(price => String(price.kunde) === String(customer._id) && price.qualSchluessel === qualificationKey && price.validFrom.toISOString().slice(0, 10) <= booking.date && (!price.validTill || price.validTill.toISOString().slice(0, 10) >= booking.date)) : [];
    if (matching.length !== 1) continue;
    const price = matching[0], from = booking.start ? new Date(booking.start) : null, until = booking.end ? new Date(booking.end) : null;
    // Bound each price rule to its own booking, including overnight segments.
    priceRules.push({ _id: `price:${price._id}:${booking._id}`, auftragNr: booking.auftragNr, personalNr: booking.personalNr, einsortNr: booking.einsortNr, assignmentNumber: booking.assignmentNumber,
      bookingId: String(booking._id), side: 'F', wageType: '100', windowStart: 0, windowEnd: 1440, weekdays: [0, 1, 2, 3, 4, 5, 6], holiday: false, automatic: true,
      fromDate: from ? booking.date : null, untilDate: until ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(until) : null,
      rate: (price.hourlyRateCents / 100).toFixed(2), percent: '0', issues: [] });
  }
  for (const side of sides) {
    const allowedBookings = bookings;
    // Use the existing engine per booking; explicitly retain overlap findings
    // across the whole month instead of hiding them through isolated calls.
    const overlaps = new Set();
    for (let i = 0; i < allowedBookings.length; i++) for (let j = i + 1; j < allowedBookings.length; j++) if (allowedBookings[i].start && allowedBookings[j].start && new Date(allowedBookings[i].start) < new Date(allowedBookings[j].end) && new Date(allowedBookings[j].start) < new Date(allowedBookings[i].end)) { overlaps.add(String(allowedBookings[i]._id)); overlaps.add(String(allowedBookings[j]._id)); }
    for (const booking of allowedBookings) {
      const bookingPrices = priceRules.filter(rule => rule.bookingId === String(booking._id));
      const selectedRules = [...rules.filter(rule => !(bookingPrices.length && rule.side === 'F' && rule.wageType === '100')), ...bookingPrices];
      const result = engine.calculate({ bookings: overlaps.has(String(booking._id)) ? [{ ...booking, issues: [...booking.issues, problem('BOOKING_OVERLAP', 'Arbeitszeit überschneidet sich mit einer weiteren Buchung.')] }] : [booking], rules: selectedRules, rates, wageTypes: wages, side, policies: POLICIES });
      if (side === 'F' && priceRules.some(rule => rule.bookingId === String(booking._id))) result.issues.push(problem('ORDER_CONDITIONS_PENDING', 'Grundstunden mit gültigem Kundenpreis bewertet. Auftragsspezifische Zuschlagskonditionen sind noch zu prüfen.'));
      issues.push(...result.issues.map(issue => ({ ...issue, date: booking.date, side })));
      for (const position of side === 'L' ? result.lohnpositionen : result.fakturpositionen) {
        const wage = wageMap.get(position.wageType);
        const row = describeOffset(baseRow(booking, side, wage, { id: `${booking._id}:${side}:${position.wageType}:${position.date}:${position.ruleIds.join(',')}`, serviceDate: position.date,
          wageType: position.wageType, label: wage?.lohnartBezeichnung || `Lohnart ${position.wageType}`, hours: hoursFor(position.minutes), quantityNumerator: position.quantityNumerator, quantityDenominator: position.quantityDenominator,
          rate: position.rate, percent: position.percent, amount: position.amount, rateSource: position.rateSource, issues: result.issues.filter(issue => issue.code !== 'NO_BOOKINGS'), status: 'CALCULATED' }));
        if (row.issues.length) row.status = 'PARTIAL';
        rows.push(row);
      }
      if (result.issues.some(issue => issue.code === 'BREAK_LOCATION_REQUIRED')) for (const rule of engine.rulesNeedingBreakLocation(booking, selectedRules, side, POLICIES)) rows.push(baseRow(booking, side, wageMap.get(rule.wageType), {
        id: `${booking._id}:${side}:pending:${rule._id}`, wageType: rule.wageType, label: wageMap.get(rule.wageType)?.lohnartBezeichnung || `Lohnart ${rule.wageType}`,
        hours: null, quantityNumerator: null, quantityDenominator: null, rate: rule.rate, percent: rule.percent,
        issues: [problem('BREAK_LOCATION_REQUIRED', 'Die Zuschlagsmenge benötigt die genaue Pausenlage.')] }));
      if (!rows.some(row => row.date === booking.date && row.side === side && row.id.startsWith(`${booking._id}:`) && row.wageType === '100')) rows.push(baseRow(booking, side, wageMap.get('100'), { issues: result.issues.length ? result.issues : [problem('RATE_MISSING', 'Grundstunden sind bekannt; der gültige Satz fehlt.')] }));
      if (side === 'L' && !rows.some(row => row.id.startsWith(`${booking._id}:L:110`))) {
        const tariff = rates.find(rate => rate.date === booking.date);
        if (tariff?.allowance == null || Number(tariff.allowance) !== 0) rows.push(describeOffset(baseRow(booking, side, wageMap.get('110'), { wageType: '110', label: wageMap.get('110')?.lohnartBezeichnung || 'Übertarifliche Zulage', rate: tariff?.allowance ?? null, issues: [problem('ALLOWANCE_UNRESOLVED', 'ÜTZ ist nicht vollständig berechenbar.')] })));
      }
      if (side === 'F' && priceRules.some(rule => rule.bookingId === String(booking._id))) issues.push({ ...problem('ORDER_CONDITIONS_PENDING', 'Grundstunden mit gültigem Kundenpreis bewertet. Auftragsspezifische Zuschlagskonditionen sind noch zu prüfen.'), date: booking.date, side });
    }
  }
  for (const booking of quantities) for (const side of sides) {
    const tariff = rates.find(rate => rate.date === booking.date);
    for (const number of side === 'L' ? ['100', '110'] : ['100']) {
      const rate = side === 'L' ? number === '100' ? tariff?.baseRate : tariff?.allowance : null;
      if (number === '110' && rate === '0') continue;
      const wage = wageMap.get(number), supported = wage?.berechnungsartCode === '2';
      const row = describeOffset(baseRow(booking, side, wage, { wageType: number, label: wage?.lohnartBezeichnung || (number === '110' ? 'Übertarifliche Zulage' : 'Normalstunden'), rate: rate ?? null, amount: supported ? value(booking.reportedHours, rate) : null,
        rateSource: tariff?.importId ? `tariff:${tariff.importId}` : null,
        issues: [...(!supported ? [problem('CALCULATION_TYPE_UNSUPPORTED', 'Lohnart oder Berechnungsart ist nicht vollständig hinterlegt.')] : []), ...(rate == null ? [problem('RATE_MISSING', side === 'F' ? 'Monatssumme enthält keine eindeutige Auftrags-/Preiszuordnung.' : 'Gültiger Lohnsatz fehlt.')] : [])] }));
      row.status = row.amount == null ? 'PENDING' : row.issues.length ? 'PARTIAL' : 'CALCULATED'; rows.push(row);
    }
  }
  for (const entry of monthly.entries.filter(entry => entry.kind !== 'productive')) {
    const wage = wageMap.get(String(entry.lohnartNummer));
    const marker = entry.kind === 'marker' || entry.kb === 'FS';
    const reason = marker ? problem('DAY_MARKER', 'Freischicht ist eine Tageskennzeichnung ohne Geldbewertung.') : ['5', '17'].includes(wage?.berechnungsartCode) ? problem('AVERAGE_NOT_IMPLEMENTED', 'Durchschnittsverfahren (SP1) noch nicht implementiert.') : problem('ABSENCE_VALUATION_PENDING', 'Fehlzeitenbewertung noch nicht implementiert.');
    rows.push(baseRow({ _id: entry.id, date: entry.date, personalNr: String(entry.personalNr), reportedHours: entry.hours }, 'L', wage,
      { id: `absence:${entry.id}`, kind: marker ? 'marker' : 'absence', wageType: wage?.lohnartNummer || null, label: wage?.lohnartBezeichnung || entry.label || entry.kb,
        kb: entry.kb, status: 'PENDING', issues: [reason], days: 1 }));
  }
  for (const row of rows) {
    const coverage = issues.filter(issue => issue.code === 'DETAIL_COVERAGE_UNRESOLVED' && issue.date === row.date);
    if (row.kind === 'productive' && coverage.length) { row.issues.push(...coverage); row.status = row.amount == null ? 'PENDING' : 'PARTIAL'; }
    const order = visibleOrders.find(order => order.auftragNr === row.auftragNr);
    const assignment = assignments.find(assignment => String(assignment._id) === String(row.assignmentId));
    row.project = order?.eventTitel || null; row.activity = assignment?.bezeichnung || null; row.site = order?.einsatzort?.bezeichnung || null;
  }
  return { employeeId, month: requestedMonth, calculationVersion: engine.VERSION, mode: 'OWN_PREVIEW', policies: POLICIES, allowedSides: sides,
    rows, issues: [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()], sourceRevision: monthly.datasetRevision,
    conditions: conditions.map(condition => ({ id: String(condition._id), customerNumber: condition.kundenNrSnapshot, wageType: condition.lohnartNummer, label: wageMap.get(condition.lohnartNummer)?.lohnartBezeichnung || '', side: condition.verwendung, type: condition.regelArt, from: condition.abWert, until: condition.bisWert, percent: condition.zuschlagsProzent, rate: condition.preisBetrag, automatic: !condition.nichtAutomatisch })) };
}
module.exports = { month, POLICIES };
