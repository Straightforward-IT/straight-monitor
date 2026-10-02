/**
 * Corrects the initial Zvoove import of prior-employer days.
 *
 * Zvoove's imported total may contain assignments performed under an employee's
 * former personnel number at Straightforward. This script subtracts those
 * current-calendar-year assignment records so the stored value remains external
 * prior-employer days only.
 *
 * Usage:
 *   cd api
 *   node scripts/correctVorarbeitgebertage.js
 *   node scripts/correctVorarbeitgebertage.js --write --email=it@straightforward.email
 *
 * The default is a dry run. A CSV report is printed as a table and emailed via
 * EmailService. Use --no-email only when Graph credentials are unavailable.
 */
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Einsatz = require('../models/Event/Einsatz');
const { sendMail } = require('../services/integrations/EmailService');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');
const shouldEmail = !process.argv.includes('--no-email');
const emailArgument = process.argv.find(argument => argument.startsWith('--email='));
const recipients = (emailArgument?.slice('--email='.length) || 'it@straightforward.email')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

function personalNumber(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function employeeName(employee) {
  return [employee.vorname, employee.nachname].filter(Boolean).join(' ').trim() || String(employee._id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(rows) {
  const columns = [
    'Status', 'Mitarbeiter', 'Mitarbeiter-ID', 'Aktuelle Personalnr.', 'Fruehere Personalnr.',
    'Importierte Tage', 'Abgezogene eigene Einsaetze', 'Korrigierte externe Tage', 'Hinweis',
  ];
  return [
    columns.join(';'),
    ...rows.map(row => [
      row.status,
      row.name,
      row.employeeId,
      row.currentPersonalNumber,
      row.previousPersonalNumbers.join(', '),
      row.importedDays,
      row.deductedOwnAssignments,
      row.correctedDays,
      row.note,
    ].map(csvCell).join(';')),
  ].join('\n');
}

function buildEmailHtml(report) {
  const rows = report.rows.map(row => `
    <tr>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.currentPersonalNumber)}</td>
      <td>${escapeHtml(row.previousPersonalNumbers.join(', '))}</td>
      <td style="text-align:right">${row.importedDays}</td>
      <td style="text-align:right">${row.deductedOwnAssignments}</td>
      <td style="text-align:right">${row.correctedDays}</td>
      <td>${escapeHtml(row.note)}</td>
    </tr>`).join('');
  return `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:1100px">
      <h2>Vorarbeitgeber-Tage: ${report.mode === 'write' ? 'Korrektur durchgeführt' : 'Dry-Run'}</h2>
      <p>Kalenderjahr: <strong>${report.year}</strong></p>
      <ul>
        <li>Geprüft: ${report.summary.checked}</li>
        <li>Korrigiert: ${report.summary.corrected}</li>
        <li>Unverändert: ${report.summary.unchanged}</li>
        <li>Übersprungen: ${report.summary.skipped}</li>
        <li>Abgezogene eigene Einsätze: ${report.summary.deductedOwnAssignments}</li>
      </ul>
      <p>${report.mode === 'write'
        ? 'Die Datenbank wurde aktualisiert. Der CSV-Anhang enthält die vollständige Audit-Liste.'
        : 'Es wurden keine Daten geändert. Mit <code>--write</code> wird die aufgeführte Korrektur gespeichert.'}</p>
      <table style="border-collapse:collapse;width:100%;font-size:12px">
        <thead><tr>${['Status', 'Mitarbeiter', 'Aktuelle PNr.', 'Frühere PNr.', 'Import', 'Abzug', 'Korrigiert', 'Hinweis']
          .map(label => `<th style="border:1px solid #ccc;padding:6px;text-align:left">${label}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function dateRange(year) {
  return {
    from: new Date(year, 0, 1),
    through: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

async function buildReport() {
  const year = new Date().getFullYear();
  const { from, through } = dateRange(year);
  const employees = await Mitarbeiter.find({
    'vorarbeitgebertage.year': year,
    'vorarbeitgebertage.days': { $gt: 0 },
    'personalnrHistory.0': { $exists: true },
  })
    .select('_id vorname nachname personalnr personalnrHistory vorarbeitgebertage')
    .lean();

  const candidateByOldNumber = new Map();
  const candidates = employees.map(employee => {
    const currentPersonalNumber = personalNumber(employee.personalnr);
    const previousPersonalNumbers = [...new Set((employee.personalnrHistory || [])
      .map(entry => personalNumber(entry.value))
      .filter(number => number !== null && number !== currentPersonalNumber))];
    for (const number of previousPersonalNumbers) {
      const employeeIds = candidateByOldNumber.get(number) || new Set();
      employeeIds.add(String(employee._id));
      candidateByOldNumber.set(number, employeeIds);
    }
    return { employee, currentPersonalNumber, previousPersonalNumbers };
  });

  const oldNumbers = [...candidateByOldNumber.keys()];
  const currentNumberOwners = oldNumbers.length
    ? await Mitarbeiter.find({ personalnr: { $in: oldNumbers.map(String) } }).select('_id personalnr').lean()
    : [];
  const conflictingCurrentNumbers = new Set(currentNumberOwners
    .filter(employee => !candidateByOldNumber.get(personalNumber(employee.personalnr))?.has(String(employee._id)))
    .map(employee => personalNumber(employee.personalnr)));
  const ambiguousNumbers = new Set([...candidateByOldNumber]
    .filter(([, employeeIds]) => employeeIds.size > 1)
    .map(([number]) => number));
  const usableOldNumbers = oldNumbers.filter(number => !ambiguousNumbers.has(number) && !conflictingCurrentNumbers.has(number));
  const assignments = usableOldNumbers.length
    ? await Einsatz.find({
      personalNr: { $in: usableOldNumbers },
      isPseudo: { $ne: true },
      datumVon: { $gte: from, $lte: through },
    }).select('personalNr').lean()
    : [];
  const assignmentCounts = new Map();
  for (const assignment of assignments) {
    const number = personalNumber(assignment.personalNr);
    assignmentCounts.set(number, (assignmentCounts.get(number) || 0) + 1);
  }

  const rows = [];
  const operations = [];
  for (const candidate of candidates) {
    const { employee, currentPersonalNumber, previousPersonalNumbers } = candidate;
    const importedDays = Number(employee.vorarbeitgebertage?.days) || 0;
    const invalidNumbers = previousPersonalNumbers.filter(number => ambiguousNumbers.has(number) || conflictingCurrentNumbers.has(number));
    const alreadyCorrected = employee.vorarbeitgebertage?.correction?.year === year;
    const baseRow = {
      name: employeeName(employee),
      employeeId: String(employee._id),
      currentPersonalNumber: currentPersonalNumber ?? '',
      previousPersonalNumbers,
      importedDays,
      deductedOwnAssignments: 0,
      correctedDays: importedDays,
      status: 'unverändert',
      note: '',
    };

    if (!currentPersonalNumber || !previousPersonalNumbers.length) {
      rows.push({ ...baseRow, status: 'übersprungen', note: 'Keine verwertbare frühere Personalnummer vorhanden.' });
      continue;
    }
    if (invalidNumbers.length) {
      rows.push({
        ...baseRow,
        status: 'übersprungen',
        note: `Mehrdeutige Personalnummer: ${invalidNumbers.join(', ')}.`,
      });
      continue;
    }
    if (alreadyCorrected) {
      rows.push({ ...baseRow, status: 'übersprungen', note: `Bereits für ${year} korrigiert.` });
      continue;
    }

    const deductedOwnAssignments = previousPersonalNumbers
      .reduce((sum, number) => sum + (assignmentCounts.get(number) || 0), 0);
    const correctedDays = Math.max(0, importedDays - deductedOwnAssignments);
    const note = deductedOwnAssignments > importedDays
      ? 'Abzug übersteigt Importwert; Ergebnis auf 0 begrenzt.'
      : deductedOwnAssignments ? 'Eigene Einsätze unter früherer Personalnummer abgezogen.' : 'Keine eigenen Einsätze unter früherer Personalnummer gefunden.';
    const row = {
      ...baseRow,
      deductedOwnAssignments,
      correctedDays,
      status: deductedOwnAssignments ? 'korrigiert' : 'unverändert',
      note,
    };
    rows.push(row);

    if (deductedOwnAssignments) {
      operations.push({
        updateOne: {
          filter: {
            _id: employee._id,
            'vorarbeitgebertage.year': year,
            'vorarbeitgebertage.days': importedDays,
            'vorarbeitgebertage.correction.year': { $ne: year },
          },
          update: {
            $set: {
              'vorarbeitgebertage.days': correctedDays,
              'vorarbeitgebertage.correction': {
                year,
                originalDays: importedDays,
                deductedOwnAssignments,
                correctedAt: new Date(),
              },
            },
          },
        },
      });
    }
  }

  return {
    year,
    rows,
    operations,
    summary: {
      checked: rows.length,
      corrected: rows.filter(row => row.status === 'korrigiert').length,
      unchanged: rows.filter(row => row.status === 'unverändert').length,
      skipped: rows.filter(row => row.status === 'übersprungen').length,
      deductedOwnAssignments: rows.reduce((sum, row) => sum + row.deductedOwnAssignments, 0),
    },
  };
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt.');
  if (shouldEmail && !recipients.length) throw new Error('Mindestens ein E-Mail-Empfänger ist erforderlich.');
  await mongoose.connect(process.env.MONGO_URI);

  const report = await buildReport();
  report.mode = shouldWrite ? 'write' : 'dry-run';
  if (shouldWrite && report.operations.length) {
    const result = await Mitarbeiter.bulkWrite(report.operations, { ordered: false });
    report.summary.written = result.modifiedCount;
  } else {
    report.summary.written = 0;
  }

  console.table(report.rows);
  console.log(JSON.stringify({
    mode: report.mode,
    year: report.year,
    summary: report.summary,
    note: shouldWrite
      ? 'Korrektur gespeichert; jeder Datensatz ist für dieses Jahr markiert und wird nicht erneut abgezogen.'
      : 'Dry-Run: keine Daten geändert. Mit --write wird die Korrektur gespeichert.',
  }, null, 2));

  if (shouldEmail) {
    const csv = buildCsv(report.rows);
    const subject = `Vorarbeitgeber-Tage ${report.year}: ${shouldWrite ? 'Korrektur durchgeführt' : 'Dry-Run'}`;
    await sendMail(recipients, subject, buildEmailHtml(report), 'it', [{
      name: `vorarbeitgebertage-korrektur-${report.year}-${report.mode}.csv`,
      content: Buffer.from(csv, 'utf8').toString('base64'),
      contentType: 'text/csv; charset=utf-8',
    }]);
  }
}

main()
  .catch(error => {
    console.error('Vorarbeitgeber-Tage-Korrektur fehlgeschlagen:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });