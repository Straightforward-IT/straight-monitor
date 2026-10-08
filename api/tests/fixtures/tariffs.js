const XLSX = require('xlsx');
const { TABLES } = require('../../services/tariffs/tariffDomain');

// Synthetic employee records; the reference tariff IDs/rates come from the
// supplied model documentation, never from private employee export rows.
const employees = [
  { _id: 'employee-1', personalnr: '2000001', personalnrHistory: [{ value: '1000001' }], vorname: 'Anna', nachname: 'Beispiel' },
  { _id: 'employee-2', personalnr: '1000002', personalnrHistory: [], vorname: 'Ben', nachname: 'Beispiel' },
];

function validRows() {
  return {
    contract: [{ ID: 17055, CBEZEICHNUNG: 'IGZ ./. DGB', DARBWOCHE: 35 }],
    employeeGroups: [{ ID: 21015, ID_LCS_TARIF: 17055, CGRUPPE: 'Lohn Ost KZF', CBEZEICHNUNG: null }],
    payGroups: [
      { ID: 21016, ID_LCS_TARIFMAGRUPPE: 21015, INR: 1, CBEZEICHNUNG: '1. Entgeltgruppe' },
      { ID: 24932, ID_LCS_TARIFMAGRUPPE: 21015, INR: 3, CBEZEICHNUNG: '2. Entgeltgruppe b', INSERT_BY_DUPLICATE: 1 },
    ],
    stages: [{ ID: 21025, ID_LCS_TARIFMAGRUPPE: 21015, INR: 1, CBEZEICHNUNG: 'Eingangsstufe' }],
    periods: [
      { ID: 1107092, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '01.01.2026', DTBIS: '31.08.2026' },
      { ID: 1108622, ID_LCS_TARIFMAGRUPPE: 21015, DTVON: '01.09.2026', DTBIS: null },
    ],
    rates: [
      { ID_LCS_TARIFZEIT: 1107092, IX: 1, IY: 1, DWERT: '13,10' },
      { ID_LCS_TARIFZEIT: 1107092, IX: 1, IY: 3, DWERT: '14,50' },
      { ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 1, DWERT: '15,33', IY_OLD: null },
      { ID_LCS_TARIFZEIT: 1108622, IX: 1, IY: 3, DWERT: '16,08', INSERT_BY_DUPLICATE: 1 },
    ],
    wageRules: [
      { ID: 61001, ID_LCS_TARIFZEIT: 1108622, ILOHNARTNR: 100, DPROZENT: 0, ID_LCS_TARIFGRUPPEN: -1, ID_LCS_TARIFSTUFEN: -1 },
      { ID: 61002, ID_LCS_TARIFZEIT: 1108622, ILOHNARTNR: 166, DPROZENT: '25,00', DAB: 23, DBIS: 24, ID_LCS_TARIFGRUPPEN: -1, ID_LCS_TARIFSTUFEN: -1 },
      { ID: 61003, ID_LCS_TARIFZEIT: 1108622, ILOHNARTNR: 166, DPROZENT: 25, DAB: 0, DBIS: 6, ID_LCS_TARIFGRUPPEN: -1, ID_LCS_TARIFSTUFEN: -1 },
    ],
    specialPayments: [{ ID_LCS_TARIFZEIT: 1108622, CBEZEICHNUNG: 'Urlaubsgeld', CSTICHTAG1: '30.06.', IAUSZAHLMONAT: 6, ILOHNARTNR: 318, KUENBER: 7 }],
    assignmentAllowances: [{ ID_LCS_TARIFZEIT: 1108622, IGRUPPEAB: 1, IGRUPPEBIS: 5, IABMONATEEINSATZ: 9, IABMONATEEINTRITT: 14, DZULAGE: '0,20' }],
    employeeAssignments: [
      { ID: 901, IPERSONALNR: 1000001, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 21016, ID_LCS_TARIFSTUFEN: 21025, DTVON: '12.11.2017', DTBIS: null, IUETZNICHTANPASSEN: 1 },
      { ID: 902, IPERSONALNR: 1000002, ID_LCS_TARIF: 17055, ID_LCS_TARIFMAGRUPPE: 21015, ID_LCS_TARIFGRUPPEN: 24932, ID_LCS_TARIFSTUFEN: 21025, DTVON: '01.01.2026', DTBIS: null },
    ],
    aboveTariff: [
      { IPERSONALNR: 1000001, DTVON: '01.04.2022', DTBIS: null, DPREIS: '2,40', DPREISPROD: 0, DEINSATZZULAGE: 0, DPREISGEHALT: 0 },
      { IPERSONALNR: 8999000, DTVON: '01.04.2022', DTBIS: null, DPREIS: '9,99', DPREISPROD: 0, DEINSATZZULAGE: 0, DPREISGEHALT: 0 },
    ],
    referenceWages: [{ ID: 21026, ID_LCS_TARIFMAGRUPPE: 21015, IGRUPPE: 6, ISTUFE: 2, IOPTHOECHERWERT: 1 }],
    noticePeriods: [{ ID_LCS_TARIF: 17055, IANZAHLANG: 20, ITYPANG: 3, IANZAHLKUEND: 7, ITYPKUEND: 2 }],
    vacationRules: [
      { ID_LCS_TARIF: 17055, IJAHR: 0, ITAGE: 24, GUELTIGBISJAHR: 2020 },
      { ID_LCS_TARIF: 17055, IJAHR: 0, ITAGE: 25, GUELTIGBISJAHR: null },
      { ID_LCS_TARIF: 17055, IJAHR: 3, ITAGE: 30, GUELTIGBISJAHR: null },
    ],
  };
}

function workbookFile(key, rows, { headers, filename, date1904 = false } = {}) {
  const table = TABLES.find(entry => entry.key === key);
  const columns = headers || [...new Set([...table.requiredColumns, ...rows.flatMap(row => Object.keys(row))])];
  const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows.map(row => columns.map(column => row[column] ?? null))]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Export');
  workbook.Workbook = { WBProps: { date1904 } };
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return { fieldname: key, originalname: filename || table.filename, buffer, size: buffer.length };
}

function fixtureFiles(rows = validRows()) {
  return TABLES.map(table => workbookFile(table.key, rows[table.key] || []));
}

module.exports = { employees, validRows, workbookFile, fixtureFiles };
