// Read-only validation: no database connection, imports, or employee data logs.
const path = require('node:path');
const { parseFiles, buildDataset, compareDatasets } = require('../services/tariffs/tariffDomain');
const { loadExportFiles } = require('../services/tariffs/tariffExportFiles');

const directory = path.resolve(process.argv[2] || path.join(__dirname, '../../Documentation/Tarif'));
try {
  const files = loadExportFiles(directory);
  const parsed = parseFiles(files);
  const dataset = buildDataset(parsed, []);
  const errors = dataset.issues.filter(issue => issue.severity === 'ERROR');
  const period = dataset.periods.find(entry => entry.legacyId === '1108622');
  const referenceRates = [1, 3].map(groupPosition => ({
    period: '1108622', stagePosition: 1, groupPosition,
    value: period?.rates.find(rate => rate.stagePosition === 1 && rate.groupPosition === groupPosition)?.value || null,
  }));
  const changes = compareDatasets(dataset, dataset);
  console.log(JSON.stringify({
    directory, parserErrors: parsed.issues.filter(issue => issue.severity === 'ERROR').length,
    counts: dataset.counts, referenceRates,
    referenceValuesCorrect: referenceRates[0].value === '15.33' && referenceRates[1].value === '16.08',
    repeatHasNoChanges: Object.values(changes).every(change => change.added === 0 && change.removed === 0 && change.changed === 0),
    errors: errors.map(({ code, table, filename, row, message }) => ({ code, table, filename, row, message })),
    ineffectiveIntervals: dataset.issues.filter(issue => issue.code === 'REVERSED_INTERVAL' && issue.severity === 'WARNING')
      .map(({ code, table, filename, row, message }) => ({ code, table, filename, row, message })),
    employeeMatching: 'Nicht geprüft: keine Live-Mitarbeiterdaten geladen.',
  }, null, 2));
  if (errors.length || referenceRates[0].value !== '15.33' || referenceRates[1].value !== '16.08') process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
