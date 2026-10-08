const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const domain = require('../services/tariffs/tariffDomain');
const { loadExportFiles } = require('../services/tariffs/tariffExportFiles');
const service = require('../services/tariffs/TariffService');
const models = require('../models/Tariffs/TariffData');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

function fail(message) { const error = new Error(message); error.publicMessage = message; throw error; }
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const actor = { kind: 'CLI', label: 'Tarifimport über Codex im Nutzerauftrag', script: 'importTariffs.js' };
const runState = { write: false, importId: null, activationAttempted: false, reportPath: null };
let lastSummary;
function distribution(rows, field) {
  return rows.reduce((counts, row) => { const value = row[field] || 'UNKNOWN'; counts[value] = (counts[value] || 0) + 1; return counts; }, {});
}
function referenceRates(data) {
  const period = data.periods.find(entry => entry.legacyId === '1108622');
  return [1, 3].map(groupPosition => ({ periodId: '1108622', stagePosition: 1, groupPosition,
    value: period?.rates.find(rate => rate.stagePosition === 1 && rate.groupPosition === groupPosition)?.value ?? null }));
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--write', '--activate'].includes(arg) && !/^--(directory|report|expected-database|expected-active-import)=.+$/.test(arg))) {
    fail('Aufruf: node scripts/importTariffs.js [--write --activate --expected-database=NAME --expected-active-import=none|ID] [--directory=PFAD] [--report=PFAD]');
  }
  const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const write = args.includes('--write'), activate = args.includes('--activate');
  runState.write = write;
  if (option('report')) {
    runState.reportPath = path.resolve(option('report'));
    try {
      fs.accessSync(path.dirname(runState.reportPath), fs.constants.W_OK);
      if (fs.existsSync(runState.reportPath)) fs.accessSync(runState.reportPath, fs.constants.W_OK);
    } catch (_) { fail('Der Bericht kann am angegebenen Ziel nicht gespeichert werden. Es wurde nichts importiert.'); }
  }
  if (activate && !write) fail('--activate benötigt --write.');
  const expectedDatabase = option('expected-database');
  const expectedActiveValue = option('expected-active-import');
  if (write && (!expectedDatabase || !expectedActiveValue)) fail('Für einen echten Import müssen Zieldatenbank und erwarteter aktiver Stand ausdrücklich angegeben sein.');
  const expectedActiveId = expectedActiveValue === 'none' ? null : expectedActiveValue;
  if (expectedActiveId !== undefined && expectedActiveId !== null && !/^[a-f\d]{24}$/i.test(expectedActiveId)) fail('Ungültiger erwarteter Importlauf.');
  const directory = path.resolve(option('directory') || path.join(__dirname, '../../Documentation/Tarif'));
  const files = loadExportFiles(directory);
  const fileHashes = files.map(file => ({ role: file.fieldname, filename: file.originalname, sha256: sha256(file.buffer), bytes: file.buffer.length }));
  const parsed = domain.parseFiles(files);
  if (parsed.issues.some(issue => issue.severity === 'ERROR')) fail('Die Exportdateien enthalten Strukturfehler. Bitte zuerst validateTariffExports.js ausführen.');
  if (!process.env.MONGO_URI) fail('MONGO_URI ist nicht gesetzt.');
  // Only tariff collections are explicitly initialized in write mode. Loading
  // employees never creates or changes their collections or indexes.
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  if (expectedDatabase && mongoose.connection.name !== expectedDatabase) fail('Die konfigurierte Datenbank entspricht nicht der erwarteten Zieldatenbank.');
  const [catalog, employees] = await Promise.all([
    models.Catalog.findById(domain.CONTRACT_ID).lean(),
    Mitarbeiter.find({}).select('_id personalnr personalnrHistory vorname nachname').lean(),
  ]);
  const previousActiveId = catalog?.activeImportId?.toString() || null;
  if (expectedActiveValue && previousActiveId !== expectedActiveId) fail('Der aktive Tarifstand weicht vom ausdrücklich erwarteten Stand ab. Es wurde nichts importiert.');
  const data = domain.buildDataset(parsed, employees);
  const errorCount = data.issues.filter(issue => issue.severity === 'ERROR').length;
  const summary = {
    completedAt: null, mode: write ? activate ? 'IMPORT_AND_ACTIVATE' : 'IMPORT_PREVIEW' : 'READ_ONLY_PREVIEW',
    database: mongoose.connection.name, previousActiveImportId: previousActiveId, actor,
    files: fileHashes, counts: data.counts, errorCount,
    warningsByCode: distribution(data.issues.filter(issue => issue.severity === 'WARNING'), 'code'),
    employeeMapping: { assignmentRows: distribution(data.assignments, 'matchStatus'), allowanceRows: distribution(data.allowances, 'matchStatus') },
    ineffectiveRows: { assignments: data.assignments.filter(row => row.intervalStatus === 'INEFFECTIVE').length, allowances: data.allowances.filter(row => row.intervalStatus === 'INEFFECTIVE').length },
    referenceRates: referenceRates(data), originalFilesUnchanged: true,
  };
  lastSummary = summary;
  if (errorCount) { console.log(JSON.stringify(summary, null, 2)); fail('Der Tarifdatenstand enthält blockierende Fehler; kein Import wurde durchgeführt.'); }
  if (summary.referenceRates[0].value !== '15.33' || summary.referenceRates[1].value !== '16.08') fail('Die zwei erwarteten Referenzwerte stimmen nicht. Kein Import wurde durchgeführt.');
  if (write) {
    for (const model of Object.values(models)) { await model.createCollection(); await model.createIndexes(); }
    const preview = await service.preview(files, null, actor);
    summary.importId = String(preview._id); summary.reusedImport = preview.duplicate;
    runState.importId = summary.importId;
    summary.errorCount = preview.errorCount; summary.warningCount = preview.warningCount;
    if (preview.status === 'INVALID' || preview.errorCount) fail('Die gespeicherte Vorschau ist nicht aktivierbar; der aktive Stand blieb unverändert.');
    if (preview.basedOnImportId !== expectedActiveId) fail('Der aktive Tarifstand wurde zwischenzeitlich verändert. Die Vorschau wurde gespeichert, aber nicht aktiviert.');
    if (activate) {
      const filter = { importId: preview._id };
      const [contract, groups, periods, assignments, allowances] = await Promise.all([
        models.Contract.findOne(filter).lean(), models.Group.find(filter).lean(), models.Period.find(filter).lean(),
        models.Assignment.find(filter).lean(), models.Allowance.find(filter).lean(),
      ]);
      const stored = service.serialize({ contract, groups, periods, assignments, allowances });
      summary.referenceRates = referenceRates(stored);
      summary.employeeMapping = { assignmentRows: distribution(assignments, 'matchStatus'), allowanceRows: distribution(allowances, 'matchStatus') };
      summary.ineffectiveRows = { assignments: assignments.filter(row => row.intervalStatus === 'INEFFECTIVE').length, allowances: allowances.filter(row => row.intervalStatus === 'INEFFECTIVE').length };
      summary.storedCounts = {
        contract: stored.contract ? 1 : 0, employeeGroups: stored.groups.length,
        payGroups: stored.groups.reduce((count, group) => count + group.payGroups.length, 0),
        stages: stored.groups.reduce((count, group) => count + group.stages.length, 0),
        periods: stored.periods.length,
        rates: stored.periods.reduce((count, period) => count + period.rates.length, 0),
        wageRules: stored.periods.reduce((count, period) => count + period.wageRules.length, 0),
        specialPayments: stored.periods.reduce((count, period) => count + period.specialPayments.length, 0),
        assignmentAllowances: stored.periods.reduce((count, period) => count + period.assignmentAllowances.length, 0),
        employeeAssignments: assignments.length, aboveTariff: allowances.length,
        referenceWages: stored.groups.reduce((count, group) => count + group.referenceWages.length, 0),
        noticePeriods: stored.contract?.noticePeriods.length || 0, vacationRules: stored.contract?.vacationRules.length || 0,
      };
      if (Object.keys(data.counts).some(key => summary.storedCounts[key] !== data.counts[key])) fail('Die gespeicherten Anzahlen stimmen nicht. Der Import wurde nicht aktiviert.');
      if (summary.referenceRates[0].value !== '15.33' || summary.referenceRates[1].value !== '16.08') fail('Die gespeicherten Referenzwerte stimmen nicht. Der Import wurde nicht aktiviert.');
      summary.sourceComparison = domain.compareDatasets(data, stored);
      if (Object.values(summary.sourceComparison).some(change => change.added || change.removed || change.changed)) fail('Die gespeicherten Quellwerte sind unvollständig oder verändert. Der Import wurde nicht aktiviert.');
      if (summary.ineffectiveRows.assignments !== data.assignments.filter(row => row.intervalStatus === 'INEFFECTIVE').length ||
        summary.ineffectiveRows.allowances !== data.allowances.filter(row => row.intervalStatus === 'INEFFECTIVE').length) fail('Die unwirksamen Historienzeilen wurden nicht vollständig markiert. Der Import wurde nicht aktiviert.');
      if (!files.every((file, index) => sha256(fs.readFileSync(file.fullPath)) === fileHashes[index].sha256)) fail('Die Quelldateien haben sich während der Vorbereitung geändert. Der Import wurde nicht aktiviert.');
      runState.activationAttempted = true;
      const published = await service.activate(String(preview._id), expectedActiveId, null, actor);
      summary.activeImportId = published.activeImportId;
      summary.status = 'ACTIVE'; summary.activatedAt = published.import.activatedAt;
      if ((await models.Catalog.findById(domain.CONTRACT_ID).lean())?.activeImportId?.toString() !== summary.importId) fail('Die Aktivierung benötigt eine erneute Prüfung des aktiven Tarifstands.');
      const serialAssignments = service.serialize(assignments);
      summary.baseRateChecks = [];
      for (const payGroupId of ['21016', '24932']) {
        const candidate = serialAssignments.find(row => {
          if (!row.employeeId || row.payGroupId !== payGroupId || row.employeeGroupId !== '21015') return false;
          const resolved = domain.resolveBaseRate({ ...stored, assignments: serialAssignments, allowances: [] }, row.employeeId, '2026-09-30');
          return resolved.status === 'RESOLVED' && resolved.payGroup?.legacyId === payGroupId && resolved.period?.legacyId === '1108622';
        });
        if (!candidate) { summary.baseRateChecks.push({ payGroupId, status: 'NO_MATCHED_REFERENCE_EMPLOYEE' }); continue; }
        const result = await service.baseRate(candidate.employeeId, '2026-09-30');
        const expectedValue = payGroupId === '21016' ? '15.33' : '16.08';
        if (result.status !== 'RESOLVED' || result.value !== expectedValue || result.payGroup?.legacyId !== payGroupId) fail('Der Import ist aktiviert, aber eine Mitarbeiter-Grundwertabfrage benötigt Klärung.');
        summary.baseRateChecks.push({ payGroupId, date: '2026-09-30', status: result.status, value: result.value });
      }
    } else summary.status = preview.status;
  } else summary.status = 'READY';
  summary.originalFilesUnchanged = files.every((file, index) => sha256(fs.readFileSync(file.fullPath)) === fileHashes[index].sha256);
  if (!summary.originalFilesUnchanged) fail('Die Quelldateien haben sich während des Imports geändert; Herkunftsprüfung benötigt Klärung.');
  summary.completedAt = new Date().toISOString();
  if (runState.reportPath) fs.writeFileSync(runState.reportPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(async error => {
  // Never print MongoDB URIs, credentials, employees or driver error objects.
  let activeImportId, publicationState = 'NOT_ACTIVATED';
  if (runState.activationAttempted) {
    publicationState = 'ACTIVATION_STATE_UNKNOWN';
    try {
      const current = await models.Catalog.findById(domain.CONTRACT_ID).maxTimeMS(5000).lean();
      activeImportId = current?.activeImportId?.toString() || null;
      publicationState = activeImportId === runState.importId ? 'ACTIVATED_WITH_VERIFICATION_ERROR' : 'NOT_CURRENTLY_ACTIVE';
    } catch (_) { /* Report uncertainty without guessing or retrying activation. */ }
  }
  const failure = { ...lastSummary, publicationState, importId: runState.importId, activeImportId,
    message: error.publicMessage || 'Tarifimport oder Prüfung fehlgeschlagen. Datenbankzugang, Exportdaten und aktiven Stand prüfen.' };
  if (runState.reportPath && lastSummary) {
    try { fs.writeFileSync(runState.reportPath, JSON.stringify(failure, null, 2) + '\n'); } catch (_) { /* Console still reports the publication state. */ }
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
