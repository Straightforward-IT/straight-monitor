const mongoose = require('mongoose');
const models = require('../../models/Payroll/Abrechnung');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Einsatz = require('../../models/Event/Einsatz');
const Lohnart = require('../../models/Payroll/Lohnart');
const tariffs = require('../tariffs/TariffService');
const capture = require('../TimeCaptureService');
const d = require('../../domain/payroll/detailImport');
const engine = require('../../domain/payroll/ausweisung');
const serialize = value => JSON.parse(JSON.stringify(value));
const stateKey = (kind, scope) => `${kind}:${scope}`;
const id = value => { if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) d.fail('Ungültige ID.'); return value; };
const isAdmin = user => [user.role, ...(user.roles || [])].some(role => String(role).toUpperCase() === 'ADMIN');
const isPayroll = user => isAdmin(user) || [user.role, ...(user.roles || [])].some(role => String(role).toUpperCase() === 'PAYROLL');
async function transaction(work) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session)); }
  finally { await session.endSession(); }
}
function keys(input, allowed) { if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) d.fail('Unbekannte Eingabefelder.'); }
async function authorize(user, side, selection = {}) {
  if (side === 'F' && !isAdmin(user) || side === 'L' && !isPayroll(user)) d.fail('Für diese Ausweisung fehlt die Berechtigung.', 'ABRECHNUNG_FORBIDDEN', 403);
  if (side === 'L' && !isAdmin(user) && !selection.employeeId) d.fail('Lohnauswertung benötigt eine Mitarbeiterauswahl.', 'ABRECHNUNG_FORBIDDEN', 403);
  if (selection.employeeId) return employeeFor(user, selection.employeeId);
}
async function employeeFor(user, employeeId) {
  const employee = await Mitarbeiter.findById(id(employeeId)).lean();
  if (!employee) d.fail('Mitarbeiter nicht gefunden.', 'ABRECHNUNG_NOT_FOUND', 404);
  if (!capture.canAccess(user, employee.locationV2)) d.fail('Kein Zugriff auf diesen Mitarbeiterstandort.', 'ABRECHNUNG_FORBIDDEN', 403);
  return employee;
}
function employeeSelection(employee) {
  if (!employee) return {};
  const numbers = [employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry.value)].filter(value => value != null).map(String);
  // Include unresolved matching aliases, so ambiguity cannot silently disappear
  // from an otherwise apparently complete employee-month calculation.
  return { $or: [{ employeeId: employee._id }, { personalNr: { $in: numbers } }] };
}
async function getState(kind, scope) {
  return await models.State.findById(stateKey(kind, scope)).lean() || { _id: stateKey(kind, scope), revision: 0, snapshotId: null };
}
async function enrich(bookings) {
  const numbers = [...new Set(bookings.map(booking => booking.personalNr))];
  const [employees, assignments] = await Promise.all([
    Mitarbeiter.find({ $or: [{ personalnr: { $in: numbers } }, { 'personalnrHistory.value': { $in: numbers } }] }).select('personalnr personalnrHistory').lean(),
    Einsatz.find({ auftragNr: { $in: bookings.map(booking => booking.auftragNr) }, personalNr: { $in: numbers.map(Number) }, isPseudo: { $ne: true } }).lean(),
  ]);
  for (const booking of bookings) {
    const matches = employees.filter(employee => [employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry.value)].some(number => String(number) === booking.personalNr));
    if (matches.length === 1) booking.employeeId = String(matches[0]._id);
    else booking.issues.push(d.problem('EMPLOYEE_UNRESOLVED', 'Personalnummer ist keinem eindeutigen Mitarbeiter zugeordnet.'));
    const candidates = assignments.filter(assignment => assignment.auftragNr === booking.auftragNr && String(assignment.personalNr) === booking.personalNr && booking.shiftId != null && String(assignment.idAuftragArbeitsschichten) === booking.shiftId && (assignment.detailDatumVon || assignment.datumVon)?.toISOString().slice(0, 10) === booking.date);
    if (candidates.length === 1) {
      const assignment = candidates[0];
      booking.assignmentId = String(assignment._id);
      if (!booking.assignmentNumber && assignment.zvooveEinspersNr) booking.assignmentNumber = assignment.zvooveEinspersNr;
      if (assignment.garantiestundenLohn != null) booking.guaranteedMinutes = Number(assignment.garantiestundenLohn) * 60;
    } else if (candidates.length > 1) booking.issues.push(d.problem('ASSIGNMENT_AMBIGUOUS', 'Mehrere Einsätze passen zur Zeitbuchung.'));
  }
  return bookings;
}
function importMetadata(run, state) {
  return { id: String(run._id), kind: run.kind, scope: run.scope, snapshotId: run.snapshotId ? String(run.snapshotId) : null,
    baseRevision: run.baseRevision, status: run.status === 'ACTIVE' && String(state?.importId) !== String(run._id) ? 'SUPERSEDED' : run.status,
    issues: run.issues, counts: run.counts, createdAt: run.createdAt, activatedAt: run.activatedAt || null };
}
async function preview(files, input, user) {
  if (!isAdmin(user)) d.fail('Detailimports sind Admin-Aufgabe.', 'ABRECHNUNG_FORBIDDEN', 403);
  keys(input, ['kind', 'auftragNr', 'scope', 'pauseUnit', 'ruleTimeUnit']);
  const kind = input.kind;
  if (!['INPUT', 'REFERENCE'].includes(kind)) d.fail('INPUT oder REFERENCE als Importart angeben.');
  const order = kind === 'INPUT' ? Number(input.auftragNr) : null;
  if (kind === 'INPUT' && (!Number.isSafeInteger(order) || order <= 0)) d.fail('Für Eingangsdaten ist eine gültige Auftragsnummer erforderlich.');
  const scope = kind === 'INPUT' ? `order:${order}` : input.scope;
  if (typeof scope !== 'string' || !/^(order:[1-9]\d*|month:\d{4}-(0[1-9]|1[0-2]))$/.test(scope)) d.fail('Referenzumfang als order:NUMMER oder month:YYYY-MM angeben.');
  const parsed = d.readFiles(files, kind), previousState = await getState(kind, scope);
  const previous = previousState.snapshotId ? await models.Snapshot.findById(previousState.snapshotId).lean() : null;
  const pauseUnit = input.pauseUnit || previous?.pauseUnit || null;
  if (pauseUnit != null && !['HOURS', 'MINUTES'].includes(pauseUnit)) d.fail('pauseUnit muss HOURS oder MINUTES sein.');
  const ruleTimeUnit = input.ruleTimeUnit || previous?.ruleTimeUnit || 'CLOCK';
  if (!['CLOCK', 'DECIMAL_HOURS'].includes(ruleTimeUnit)) d.fail('ruleTimeUnit muss CLOCK oder DECIMAL_HOURS sein.');
  const rows = [...(previous?.rows || []).filter(row => !parsed.roles.includes(row.role)).map(row => serialize(row)), ...parsed.rows];
  rows.sort((a, b) => a.role.localeCompare(b.role) || a.source.sheet.localeCompare(b.source.sheet) || a.source.row - b.source.row);
  const issues = [], snapshotId = new mongoose.Types.ObjectId();
  let bookings = [], rules = [], references = [], valid = true;
  try {
    if (kind === 'INPUT') {
      if (rows.some(row => row.role === 'STUNDUHR' && Number(row.raw.AUFTRAGSNR) !== order || row.role === 'AUFTRLOA' && Number(row.raw.AUFTRAGNR) !== order)) d.fail('Gelieferte Tabellen enthalten einen anderen Auftrag als den Importumfang.');
      bookings = await enrich(d.normalizeBookings(rows, order, pauseUnit));
      rules = d.normalizeRules(rows, order, ruleTimeUnit);
      if (!bookings.length) issues.push(d.problem('NO_BOOKINGS', 'Es liegen noch keine Zeitbuchungen für den Auftrag vor.'));
      issues.push(...bookings.flatMap(booking => booking.issues), ...rules.flatMap(rule => rule.issues));
    } else {
      references = d.normalizeReferences(rows);
      if (references.some(reference => scope.startsWith('order:') ? reference.auftragNr !== Number(scope.slice(6)) : reference.month !== scope.slice(6))) d.fail('Referenzzeilen passen nicht zum angegebenen Auftrags- oder Monatsumfang.');
    }
  } catch (error) { valid = false; issues.push(d.problem('INVALID_DATASET', error.message)); }
  const payload = { kind, scope, auftragNr: order, pauseUnit, ruleTimeUnit, rows, references, issues };
  if (Buffer.byteLength(JSON.stringify(payload)) > 8 * 1024 * 1024) d.fail('Normalisierter Import überschreitet 8 MB. Aufträge bzw. Referenzmonate getrennt importieren.');
  // Include normalized identity resolution: reimport can repair historical personnel matching.
  const contentHash = d.hash({ ...payload, bookings, rules });
  let stored = null;
  if (valid) {
    await models.Snapshot.init();
    try {
      await transaction(async session => {
        stored = await models.Snapshot.findOne({ kind, scope, contentHash }).session(session).lean();
        if (stored) return;
        await models.Snapshot.create([{ _id: snapshotId, ...payload, contentHash }], { session });
        if (bookings.length) await models.Booking.create(bookings.map(booking => ({ ...booking, snapshotId })), { session, ordered: true });
        if (rules.length) await models.Rule.create(rules.map(rule => ({ ...rule, snapshotId })), { session, ordered: true });
        stored = { _id: snapshotId };
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      stored = await models.Snapshot.findOne({ kind, scope, contentHash }).lean();
      if (!stored) throw error;
    }
  }
  const run = await models.Import.create({ kind, scope, snapshotId: stored?._id || null, baseRevision: previousState.revision,
    status: valid ? 'PREVIEW' : 'INVALID', issues, rows: parsed.rows, counts: { bookings: bookings.length, rules: rules.length, references: references.length }, createdBy: user._id });
  return serialize(importMetadata(run, previousState));
}
async function listImports(user) {
  if (!isAdmin(user)) d.fail('Admin erforderlich.', 'ABRECHNUNG_FORBIDDEN', 403);
  const [imports, states] = await Promise.all([models.Import.find().select('-rows').sort({ createdAt: -1 }).limit(100).lean(), models.State.find().lean()]);
  return { imports: imports.map(run => importMetadata(run, states.find(state => state._id === stateKey(run.kind, run.scope)))) };
}
async function getImport(importId, user) {
  if (!isAdmin(user)) d.fail('Admin erforderlich.', 'ABRECHNUNG_FORBIDDEN', 403);
  const run = await models.Import.findById(id(importId)).lean();
  if (!run) d.fail('Import nicht gefunden.', 'ABRECHNUNG_NOT_FOUND', 404);
  const snapshot = run.snapshotId ? await models.Snapshot.findById(run.snapshotId).lean() : null;
  return serialize({ ...importMetadata(run, await getState(run.kind, run.scope)), rows: run.rows, snapshot });
}
async function activate(importId, expectedRevision, user) {
  if (!isAdmin(user)) d.fail('Admin erforderlich.', 'ABRECHNUNG_FORBIDDEN', 403);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) d.fail('expectedRevision fehlt.');
  try {
    await transaction(async session => {
      const run = await models.Import.findById(id(importId)).session(session).lean();
      if (!run) d.fail('Import nicht gefunden.', 'ABRECHNUNG_NOT_FOUND', 404);
      const key = stateKey(run.kind, run.scope);
      let state = await models.State.findById(key).session(session).lean();
      if (run.status === 'ACTIVE' && String(state?.importId) === String(run._id)) return;
      if (run.status !== 'PREVIEW' || !run.snapshotId) d.fail('Import ist nicht aktivierbar.');
      if (run.baseRevision !== expectedRevision || (state?.revision || 0) !== expectedRevision) d.fail('Datenstand wurde seit der Vorschau geändert.', 'DETAIL_IMPORT_STALE', 409);
      if (!state) { await models.State.create([{ _id: key, revision: 0 }], { session }); state = { revision: 0 }; }
      const changed = String(state.snapshotId) !== String(run.snapshotId);
      const result = await models.State.updateOne({ _id: key, revision: expectedRevision }, { $set: { snapshotId: run.snapshotId, importId: run._id, revision: expectedRevision + Number(changed) } }, { session });
      if (result.matchedCount !== 1) d.fail('Datenstand wurde gleichzeitig geändert.', 'DETAIL_IMPORT_STALE', 409);
      await models.Import.updateOne({ _id: run._id }, { $set: { status: 'ACTIVE', activatedBy: user._id, activatedAt: new Date() } }, { session });
    });
  } catch (error) { if (error.code === 11000) d.fail('Datenstand wurde gleichzeitig geändert.', 'DETAIL_IMPORT_STALE', 409); throw error; }
  return getImport(importId, user);
}
async function activeInputs(auftragNr) {
  const filter = auftragNr ? { _id: stateKey('INPUT', `order:${auftragNr}`) } : { _id: /^INPUT:order:/ };
  return models.State.find(filter).sort({ _id: 1 }).lean();
}
async function bookings(user, query) {
  keys(query, ['auftragNr', 'employeeId', 'month']);
  if (!query.auftragNr && !(query.employeeId && query.month)) d.fail('Auftrag oder Mitarbeiter mit Monat auswählen.');
  if (query.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) d.fail('Monat im Format YYYY-MM angeben.');
  const employee = query.employeeId ? await employeeFor(user, query.employeeId) : null;
  if (query.auftragNr) await capture.orderForUser(user, query.auftragNr);
  const states = await activeInputs(query.auftragNr);
  const rows = await models.Booking.find({ snapshotId: { $in: states.map(state => state.snapshotId).filter(Boolean) }, ...employeeSelection(employee) }).sort({ date: 1, ordinal: 1 }).lean();
  return serialize({ bookings: rows.filter(booking => !query.month || !booking.date || booking.date.startsWith(query.month) || engine.workSegments(booking, query.month).length), sources: states.map(state => ({ snapshotId: state.snapshotId, revision: state.revision })), aggregateHoursIncluded: false });
}
async function buildRates(selected, employeeId) {
  const result = [], employees = await Mitarbeiter.find({ _id: { $in: employeeId ? [employeeId] : [...new Set(selected.map(booking => booking.employeeId).filter(Boolean))] } }).lean();
  for (const employee of employees) {
    const context = await tariffs.createEmployeeContext(employee);
    const dates = [...new Set(selected.filter(booking => String(booking.employeeId) === String(employee._id) && !booking.issues.length).flatMap(booking => engine.workSegments(booking).map(segment => segment.date)))].sort();
    for (const day of dates) {
      const [base, allowance] = await Promise.all([tariffs.baseRate(String(employee._id), day, context), tariffs.aboveTariffValues(String(employee._id), day, context)]);
      const relevantPeriods = context.data.periods.filter(period => (!base.assignment || period.employeeGroupId === base.assignment.employeeGroupId) && period.validFrom <= day && (!period.validUntil || period.validUntil >= day));
      result.push({ employeeId: String(employee._id), date: day, importId: context.importId ? String(context.importId) : null,
        baseRate: base.status === 'RESOLVED' ? base.value : null,
        allowance: allowance.status === 'RESOLVED' ? allowance.values?.DPREIS ?? '0' : allowance.code === 'ABOVE_TARIFF_MISSING' ? '0' : null,
        baseEvidence: { code: base.code || null, assignmentId: base.assignment?.legacyId || null, groupId: base.group?.legacyId || null, payGroupId: base.payGroup?.legacyId || null, stageId: base.stage?.legacyId || null, periodId: base.period?.legacyId || null, source: base.period?.source || null },
        allowanceEvidence: { code: allowance.code || null, recordId: allowance.record?.legacyId || null, source: allowance.record?.source || null },
        pendingTariffRules: relevantPeriods.some(period => (period.wageRules || []).some(rule => !['100', '110'].includes(String(rule.values?.ILOHNARTNR)))) });
    }
  }
  return result;
}
async function calculate(user, input) {
  keys(input, ['side', 'auftragNr', 'employeeId', 'month', 'policies']);
  if (!['L', 'F'].includes(input.side)) d.fail('L oder F als Ausweisungsseite angeben.');
  if (!input.auftragNr && !(input.employeeId && input.month)) d.fail('Auftrag oder Mitarbeiter mit Monat auswählen.');
  if (input.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) d.fail('Monat im Format YYYY-MM angeben.');
  const employee = await authorize(user, input.side, input);
  if (input.auftragNr) await capture.orderForUser(user, input.auftragNr);
  const states = await activeInputs(input.auftragNr), inputSnapshotIds = states.map(state => state.snapshotId).filter(Boolean);
  const all = await models.Booking.find({ snapshotId: { $in: inputSnapshotIds }, ...employeeSelection(employee) }).sort({ snapshotId: 1, ordinal: 1 }).lean();
  if (all.length > 2000) d.fail('Höchstens 2000 Zeitbuchungen je Ausweisung. Auswahl einschränken.');
  const selected = all.filter(booking => !input.month || !booking.date || engine.workSegments(booking, input.month).length || booking.date.startsWith(input.month));
  const [rules, wageTypes, rates] = await Promise.all([
    models.Rule.find({ snapshotId: { $in: inputSnapshotIds }, side: input.side }).sort({ snapshotId: 1, ordinal: 1 }).lean(),
    Lohnart.find().select('lohnartNummer berechnungsartCode verrechnungCode verrechnungslohnartNummer verrechnungsPrioritaet').sort({ lohnartNummer: 1 }).lean(),
    input.side === 'L' ? buildRates(selected, input.employeeId) : [],
  ]);
  const p = engine.policies(input.policies);
  const selection = { ...(input.month ? { month: input.month } : {}), ...(input.employeeId ? { employeeId: input.employeeId } : {}), ...(input.auftragNr ? { auftragNr: Number(input.auftragNr) } : {}) };
  const pinned = serialize({ bookings: selected, rules, wageTypes, rates });
  const contentHash = d.hash({ inputSnapshotIds: inputSnapshotIds.map(String), side: input.side, selection, policies: p, inputs: pinned, version: engine.VERSION });
  const existing = await models.Run.findOne({ contentHash }).lean();
  if (existing) return getRun(user, String(existing._id));
  const output = engine.calculate({ ...pinned, side: input.side, month: input.month, policies: p });
  if (Buffer.byteLength(JSON.stringify({ pinned, output })) > 12 * 1024 * 1024) d.fail('Ausweisung ist zu groß. Auswahl einschränken.');
  try {
    const run = await models.Run.create({ inputSnapshotIds, side: input.side, selection, contentHash, inputs: pinned, ...output, createdBy: user._id });
    return getRun(user, String(run._id));
  } catch (error) {
    if (error.code !== 11000) throw error;
    return getRun(user, String((await models.Run.findOne({ contentHash }).lean())._id));
  }
}
async function getRun(user, runId) {
  const run = await models.Run.findById(id(runId)).lean();
  if (!run) d.fail('Ausweisung nicht gefunden.', 'ABRECHNUNG_NOT_FOUND', 404);
  const employee = await authorize(user, run.side, run.selection);
  const states = await models.State.find({ _id: /^INPUT:order:/ }).lean();
  const active = new Set(states.map(state => String(state.snapshotId)));
  let stale = run.inputSnapshotIds.some(snapshot => !active.has(String(snapshot)));
  const currentWages = serialize(await Lohnart.find().select('lohnartNummer berechnungsartCode verrechnungCode verrechnungslohnartNummer verrechnungsPrioritaet').sort({ lohnartNummer: 1 }).lean());
  stale ||= d.hash(currentWages) !== d.hash(run.inputs.wageTypes);
  if (run.side === 'L' && run.inputs.rates.length) {
    const catalog = await require('../../models/Tariffs/TariffData').Catalog.findById('17055').lean();
    stale ||= run.inputs.rates.some(rate => String(rate.importId) !== String(catalog?.activeImportId || null));
  }
  // A new order in a complete employee-month selection also changes its coverage.
  if (!stale && run.selection.employeeId) {
    const coveredStates = run.selection.auftragNr ? states.filter(state => state._id === stateKey('INPUT', `order:${run.selection.auftragNr}`)) : states;
    const current = await models.Booking.find({ snapshotId: { $in: coveredStates.map(state => state.snapshotId) }, ...employeeSelection(employee) }).lean();
    const relevant = current.filter(booking => !run.selection.month || !booking.date || booking.date.startsWith(run.selection.month) || engine.workSegments(booking, run.selection.month).length).map(booking => String(booking._id)).sort();
    const before = run.inputs.bookings.map(booking => String(booking._id)).sort();
    stale = JSON.stringify(relevant) !== JSON.stringify(before);
  }
  return serialize({ ...run, stale, transmissionEnabled: false });
}
async function compare(user, runId, input) {
  keys(input, ['referenceSnapshotId', 'referenceKind']);
  const run = await getRun(user, runId);
  // References can contain complete employee months and invoices: keep first-stage access admin-only.
  if (!isAdmin(user)) d.fail('Referenzabgleich ist zunächst Admin-Aufgabe.', 'ABRECHNUNG_FORBIDDEN', 403);
  const reference = await models.Snapshot.findOne({ _id: id(input.referenceSnapshotId), kind: 'REFERENCE' }).lean();
  if (!reference) d.fail('Referenzdatenstand nicht gefunden.', 'ABRECHNUNG_NOT_FOUND', 404);
  const contentHash = d.hash({ runId, referenceSnapshotId: input.referenceSnapshotId, referenceKind: input.referenceKind });
  const existing = await models.Comparison.findOne({ contentHash }).lean();
  if (existing) return serialize({ ...existing, calculationStale: run.stale });
  const result = engine.compare(run, reference.references, input.referenceKind);
  try { return serialize({ ...(await models.Comparison.create({ runId, referenceSnapshotId: reference._id, referenceKind: input.referenceKind, contentHash, ...result, createdBy: user._id })).toObject(), calculationStale: run.stale }); }
  catch (error) { if (error.code !== 11000) throw error; return serialize({ ...(await models.Comparison.findOne({ contentHash }).lean()), calculationStale: run.stale }); }
}
module.exports = { preview, listImports, getImport, activate, bookings, calculate, getRun, compare, isAdmin, isPayroll };
