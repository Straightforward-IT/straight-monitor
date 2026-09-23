const mongoose = require('mongoose');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Stundenzeit = require('../../models/Stundenzeit');
const { Preparation, Snapshot, Mapping, Guard } = require('../../models/Payroll/Preparation');
const capture = require('../TimeCaptureService');
const d = require('./preparationDomain');
const mapper = require('./lodasMapper');
const { readTimeAccount } = require('./timeAccountReader');

const canReview = user => [user.role, ...(user.roles || [])].some(r => ['ADMIN', 'PAYROLL'].includes(String(r).toUpperCase()));
function requireReviewer(user) { if (!canReview(user)) d.fail('PAYROLL oder ADMIN erforderlich.', 'PAYROLL_ROLE_REQUIRED', 403); }
async function employeeFor(user, id) {
  capture.objectId(id);
  const employee = await Mitarbeiter.findById(id).select('locationV2 vorname nachname personalnr').lean();
  if (!employee) d.fail('Mitarbeiter nicht gefunden.', 'PAYROLL_NOT_FOUND', 404);
  if (!capture.canAccess(user, employee.locationV2)) d.fail('Kein Zugriff auf diesen Mitarbeiterstandort.', 'PAYROLL_FORBIDDEN', 403);
  return employee;
}
async function sourcesFor(employee, month, session) {
  const { from, till } = d.range(month);
  const rows = await Stundenzeit.find({ mitarbeiter: employee, 'released.date': { $gte: from, $lt: till } }).sort({ _id: 1 }).session(session || null).lean();
  return rows.map(row => ({ id: String(row._id), auftragNr: row.auftragNr, schichtId: row.schicht ? String(row.schicht) : null,
    // Office drafts increment revision too; pin the last release, not current.
    releaseRevision: [...row.history].reverse().find(h => h.action === 'RELEASED')?.revision || 0,
    releasedAt: row.releasedAt, releasedBy: row.releasedBy ? String(row.releasedBy) : null, values: row.released }));
}
async function inheritedFor(employee, month, session) {
  const { from } = d.range(month);
  const rows = await Preparation.find({ employee, month: { $lt: month }, items: { $elemMatch: { kind: 'ABSENCE', endDate: { $gte: from } } } }).sort({ month: 1 }).session(session || null).lean();
  return rows.flatMap(row => row.items.filter(i => i.kind === 'ABSENCE' && i.endDate >= from).map(i => ({ ...i, id: `${row.month}:${i.id}`, originMonth: row.month })));
}
async function sourceState(employee, month, session) {
  const sources = await sourcesFor(employee, month, session);
  const inherited = d.projectItems(await inheritedFor(employee, month, session), month);
  return { sources, inherited, hash: d.sha256({ sources, inherited }) };
}
function checkOverlaps(items) {
  const absences = items.filter(i => i.kind === 'ABSENCE');
  for (let i = 0; i < absences.length; i++) for (let j = i + 1; j < absences.length; j++) {
    if (absences[i].code === absences[j].code && absences[i].startDate <= absences[j].endDate && absences[j].startDate <= absences[i].endDate) d.fail('Überlappende Fehlzeit derselben Art. Bestehenden Zeitraum bearbeiten.');
  }
}
function conflict() { d.fail('Vorbereitung wurde geändert. Bitte den aktuellen Stand laden.', 'PAYROLL_REVISION_CONFLICT', 409); }
async function read(user, employeeId, month) {
  await employeeFor(user, employeeId); d.range(month);
  const [record, state, snapshots] = await Promise.all([
    Preparation.findOne({ employee: employeeId, month }).lean(), sourceState(employeeId, month),
    Snapshot.find({ employee: employeeId, month }).select('_id revision contentHash reviewedAt reviewedBy').sort({ revision: -1 }).lean(),
  ]);
  const items = d.projectItems([...(record?.items || []), ...state.inherited], month);
  const sourceChanges = [...new Set([...(record?.sources || []).map(s => s.id), ...state.sources.map(s => s.id)])].flatMap(id => {
    if (!record) return [];
    const before = record.sources.find(s => s.id === id), after = state.sources.find(s => s.id === id);
    return d.sha256(before || null) === d.sha256(after || null) ? [] : [{ id, before: before?.values || null, after: after?.values || null }];
  });
  return { revision: record?.revision || 0, state: record?.state || 'DRAFT', items: record?.items || [], inherited: state.inherited,
    sources: state.sources, sourceHash: state.hash, stale: !!record && record.sourceHash !== state.hash,
    totals: d.totals(state.sources, items), sourceChanges, history: record?.history || [], snapshots, canReview: canReview(user),
    timeAccount: await readTimeAccount({ employeeId, month }) };
}
async function mutate(user, employeeId, month, input, action) {
  await employeeFor(user, employeeId); d.range(month);
  if (action !== 'save') requireReviewer(user);
  d.exactKeys(input, action === 'save' ? ['revision', 'sourceHash', 'items', 'reason', 'reconcile'] : ['revision', 'sourceHash', 'reason']);
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) conflict();
  const reason = d.text(input.reason, 'Bearbeitungsvermerk');
  const types = action === 'save' ? await capture.dayEntryTypes() : [];
  try {
    await mongoose.connection.transaction(async session => {
      // Serialize overlapping absence edits across different month records.
      await Guard.updateOne({ _id: employeeId }, { $inc: { revision: 1 } }, { upsert: true, session });
      const record = await Preparation.findOne({ employee: employeeId, month }).session(session).lean();
      if (input.revision !== (record?.revision || 0)) conflict();
      const state = await sourceState(employeeId, month, session);
      if (input.sourceHash !== state.hash) d.fail('Freigegebene Zeiten oder fortlaufende Fehlzeiten wurden geändert. Bitte neu laden.', 'PAYROLL_SOURCE_CHANGED', 409);
      if (action === 'save' && record?.state === 'REVIEWED') d.fail('Monat zuerst wieder öffnen.', 'PAYROLL_FROZEN', 409);
      if (action === 'finalize' && (!record || record.state !== 'DRAFT')) d.fail('Zuerst einen Entwurf speichern.', 'PAYROLL_STATE', 409);
      if (action === 'reopen' && record?.state !== 'REVIEWED') d.fail('Monat ist nicht abgeschlossen.', 'PAYROLL_STATE', 409);
      if (record && record.sourceHash !== state.hash && action !== 'reopen' && !(action === 'save' && input.reconcile === true)) d.fail('Quelländerungen ausdrücklich abgleichen.', 'PAYROLL_RECONCILIATION_REQUIRED', 409);
      const items = action === 'save' ? d.normalizeItems(input.items, month, types, state.sources, record?.items) : record.items;
      checkOverlaps([...items, ...state.inherited]);
      // Check future-originating periods too, so overlap detection is symmetric.
      const others = await Preparation.find({ employee: employeeId, month: { $ne: month } }).select('items').session(session).lean();
      checkOverlaps([...items.filter(i => i.kind === 'ABSENCE'), ...others.flatMap(r => r.items.filter(i => i.kind === 'ABSENCE'))]);
      const revision = input.revision + 1, at = new Date();
      const history = [...(record?.history || []), { revision, action, by: String(user._id), at, reason, items }];
      const patch = { employee: employeeId, month, revision, state: action === 'finalize' ? 'REVIEWED' : 'DRAFT', items, history,
        // Reopen does not silently acknowledge changed sources.
        sourceHash: action === 'reopen' ? record.sourceHash : state.hash,
        sources: action === 'reopen' ? record.sources : state.sources };
      if (!record) await Preparation.create([patch], { session });
      else {
        const result = await Preparation.updateOne({ _id: record._id, revision: input.revision }, { $set: patch }, { session, runValidators: true });
        if (result.modifiedCount !== 1) conflict();
      }
      if (action === 'finalize') {
        const projected = d.projectItems([...items, ...state.inherited], month);
        const payload = { employeeId, month, sources: state.sources, sourceHash: state.hash, items: projected, totals: d.totals(state.sources, projected) };
        await Snapshot.create([{ employee: employeeId, month, revision, payload, contentHash: d.sha256(payload), reviewedBy: user._id, reviewedAt: at }], { session });
      }
    });
  } catch (error) { if (error.code === 11000) conflict(); throw error; }
  return read(user, employeeId, month);
}
async function snapshot(user, employeeId, id) {
  await employeeFor(user, employeeId); capture.objectId(id);
  const row = await Snapshot.findOne({ _id: id, employee: employeeId }).lean();
  if (!row) d.fail('Snapshot nicht gefunden.', 'PAYROLL_NOT_FOUND', 404);
  const state = await sourceState(employeeId, row.month);
  const current = await Preparation.findOne({ employee: employeeId, month: row.month }).lean();
  return { ...row, stale: state.hash !== row.payload.sourceHash, current: current?.state === 'REVIEWED' && current.revision === row.revision };
}
async function getMapping(user, employeeId) {
  await employeeFor(user, employeeId); requireReviewer(user);
  return await Mapping.findOne({ employee: employeeId }).sort({ version: -1 }).lean() || { version: 0, config: { clientId: '', personnelNumber: null, rules: [] } };
}
async function saveMapping(user, employeeId, input) {
  const current = await getMapping(user, employeeId);
  d.exactKeys(input, ['version', 'config']);
  if (input.version !== current.version) conflict();
  const config = mapper.normalizeConfig(input.config);
  try { await Mapping.create({ employee: employeeId, version: current.version + 1, config, createdBy: user._id }); }
  catch (error) { if (error.code === 11000) conflict(); throw error; }
  return getMapping(user, employeeId);
}
async function preview(user, employeeId, id) {
  const row = await snapshot(user, employeeId, id);
  requireReviewer(user);
  const mapping = await getMapping(user, employeeId);
  return { ...mapper.preview(row, mapping), snapshotId: String(row._id), contentHash: row.contentHash, internallyReviewed: true, stale: row.stale, current: row.current, transmissionEnabled: false };
}
module.exports = { read, mutate, snapshot, getMapping, saveMapping, preview, employeeFor, canReview, sourceState };
