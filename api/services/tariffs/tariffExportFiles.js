const fs = require('node:fs');
const path = require('node:path');
const { TABLES } = require('./tariffDomain');

// Explicit roles for the supplied Zvoove export package, including the two
// different group tables. Additional workbooks and Office lock files are ignored.
const filenames = {
  contract: 'Main/Tarifvertrag.xlsx', employeeGroups: 'Main/Tarif Mitarbeiter Gruppe.xlsx',
  payGroups: 'Main/Tarifgruppe.xlsx', stages: 'Main/Tarifstufe.xlsx', periods: 'Main/Tarifzeit.xlsx',
  rates: 'Main/Tarif Entgelt.xlsx', employeeAssignments: 'Main/Tarif Personal.xlsx',
  aboveTariff: 'Main/Tarif ÜTZ.xlsx', referenceWages: 'Main/Tarifecklohn.xlsx',
  wageRules: 'Tarif Lohnarten.xlsx', specialPayments: 'Tarif Urlaubsgeld Weihnachtsgeld.xlsx',
  assignmentAllowances: 'Tarifeinsatzzulage.xlsx', noticePeriods: 'Tarifkündigungsfrist.xlsx', vacationRules: 'Tarifurlaub.xlsx',
};
function loadExportFiles(directory) {
  return TABLES.map(table => {
    let fullPath = path.resolve(directory);
    for (const part of filenames[table.key].split('/')) {
      const entry = fs.readdirSync(fullPath).find(name => name.normalize('NFC') === part.normalize('NFC'));
      if (!entry) throw new Error(`Datei fehlt: ${filenames[table.key]}`);
      fullPath = path.join(fullPath, entry);
    }
    const buffer = fs.readFileSync(fullPath);
    return { fieldname: table.key, originalname: path.basename(fullPath), buffer, size: buffer.length, fullPath };
  });
}
module.exports = { loadExportFiles };
