// Read-only audit of the active import; never updates employees or tariff rows.
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const models = require('../models/Tariffs/TariffData');
const domain = require('../services/tariffs/tariffDomain');
const service = require('../services/tariffs/TariffService');

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !/^--(date|report)=.+$/.test(arg))) throw new Error('Aufruf: node scripts/auditTariffAssignments.js [--date=JJJJ-MM-TT] [--report=PFAD.json]');
  const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const date = option('date') || service.currentTariffDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || domain.dateString(date) !== date) throw new Error('Ungültiger Stichtag.');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  const catalog = await models.Catalog.findById('17055').lean();
  if (!catalog?.activeImportId) throw new Error('Kein aktiver Tarifstand.');
  const filter = { importId: catalog.activeImportId };
  const [employees, groups, periods, assignments, allowances] = await Promise.all([
    Mitarbeiter.find({ isActive: true }).select('_id vorname nachname personalnr personalnrHistory').lean(),
    models.Group.find(filter).lean(), models.Period.find(filter).lean(),
    models.Assignment.find(filter).lean(), models.Allowance.find(filter).lean(),
  ]);
  const data = service.serialize({ groups, periods, assignments, allowances });
  const report = { date, checkedAt: new Date().toISOString(), activeImportId: String(catalog.activeImportId), employeeCount: employees.length,
    before: {}, after: {}, aboveTariffBefore: {}, aboveTariffAfter: {}, unresolved: [], readOnly: true };
  const count = (target, result) => { const key = result.code || result.status; target[key] = (target[key] || 0) + 1; };
  for (const employee of employees) {
    const id = String(employee._id);
    count(report.before, domain.resolveBaseRate(data, id, date));
    count(report.aboveTariffBefore, domain.resolveAboveTariff(data, id, date));
    const rate = domain.resolveBaseRate(data, id, date, employee.personalnr);
    count(report.after, rate);
    count(report.aboveTariffAfter, domain.resolveAboveTariff(data, id, date, employee.personalnr));
    if (rate.status === 'RESOLVED') continue;
    const numbers = new Set([employee.personalnr, ...(employee.personalnrHistory || []).map(row => row.value)]);
    const rows = data.assignments.filter(row => String(row.employeeId) === id || numbers.has(row.personalNr));
    report.unresolved.push({ employeeId: id, employeeName: [employee.vorname, employee.nachname].join(' '), personalNr: employee.personalnr || null,
      code: rate.code, message: rate.message, hasImportedRows: rows.length > 0,
      assignments: rows.map(row => ({ legacyId: row.legacyId, personalNr: row.personalNr, matchStatus: row.matchStatus,
        validFrom: row.validFrom, validUntil: row.validUntil, intervalStatus: row.intervalStatus,
        employeeGroupId: row.employeeGroupId, payGroupId: row.payGroupId, stageId: row.stageId,
        source: { filename: row.source?.filename, row: row.source?.row } })),
    });
  }
  report.unresolved.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'));
  if (option('report')) fs.writeFileSync(path.resolve(option('report')), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, unresolved: report.unresolved.filter(row => row.code !== 'ASSIGNMENT_MISSING'), reportPath: option('report') || null }, null, 2));
}
main().catch(error => { console.error(error.message?.includes('Aufruf:') || error.message === 'Ungültiger Stichtag.' ? error.message : 'Tarifprüfung fehlgeschlagen. Datenbankverbindung und aktiven Stand prüfen.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
