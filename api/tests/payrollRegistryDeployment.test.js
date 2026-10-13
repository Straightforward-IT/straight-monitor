const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { cpSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

describe('Payroll registry deployment', () => {
  it('loads the shared registries with only API files present', () => {
    const deployment = mkdtempSync(path.join(tmpdir(), 'payroll-api-deployment-'));
    try {
      cpSync(path.join(__dirname, '../domain/payroll'), path.join(deployment, 'domain/payroll'), { recursive: true });
      cpSync(path.join(__dirname, '../shared/payroll'), path.join(deployment, 'shared/payroll'), { recursive: true });
      const output = execFileSync(process.execPath, ['-e', `
        const wage = require('./domain/payroll/wageCalculationTypes');
        const average = require('./domain/payroll/averageStorageTypes');
        const settings = require('./domain/payroll/wageTypeSettings');
        process.stdout.write(JSON.stringify({
          wageCodes: Object.values(wage.WageCalculationType),
          averageCodes: Object.values(average.AverageStorageType),
          wageZero: wage.getWageCalculationType(0).key,
          averageZero: average.getAverageStorageType(0).key,
          offset: settings.getSettingDefinition('offset', 3).key,
          missing: settings.getCodeMetadaten({}).verrechnungCode.status
        }));
      `], { cwd: deployment, encoding: 'utf8' });
      assert.deepEqual(JSON.parse(output), {
        wageCodes: ['0', '1', '2', '3', '4', '5', '6', '7', '17'],
        averageCodes: ['0', '1', '2', '3', '4', '5', '6', '7'],
        wageZero: 'AMOUNT',
        averageZero: 'NO_AMOUNT_ADDITION',
        offset: 'ABOVE_TARIFF_ALLOWANCE',
        missing: 'missing',
      });
    } finally {
      rmSync(deployment, { recursive: true, force: true });
    }
  });
});
