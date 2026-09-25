const Auftrag = require('../../models/Event/Auftrag');
const Einsatz = require('../../models/Event/Einsatz');
const Schicht = require('../../models/Event/Schicht');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');

const EMPLOYEE_FIELDS = [
  '_id',
  'personalnr',
  'personalnrHistory',
  'email',
  'telefon',
  'vorname',
  'nachname',
  'geburtsdatum',
  'einsatzCount',
  'konfektionsgroesse',
  'schuhgroesse',
].join(' ');

function shiftKey(einsatz, schichtenById, schichtenByLegacyId) {
  if (einsatz.schicht && schichtenById.has(String(einsatz.schicht))) {
    return `schicht:${einsatz.schicht}`;
  }
  if (einsatz.idAuftragArbeitsschichten !== null && einsatz.idAuftragArbeitsschichten !== undefined
    && schichtenByLegacyId.has(String(einsatz.idAuftragArbeitsschichten))) {
    return `legacy:${einsatz.idAuftragArbeitsschichten}`;
  }
  return 'ohne-schicht';
}

function shiftLabel(einsatz, schichtenById, schichtenByLegacyId) {
  const schicht = (einsatz.schicht && schichtenById.get(String(einsatz.schicht)))
    || schichtenByLegacyId.get(String(einsatz.idAuftragArbeitsschichten));
  return schicht?.bezeichnung || einsatz.schichtBezeichnung || 'Ohne Schicht';
}

function buildAuftragMitarbeiterExport({ auftrag, einsaetze, schichten, mitarbeiter }) {
  const schichtenById = new Map(schichten.map(schicht => [String(schicht._id), schicht]));
  const schichtenByLegacyId = new Map(
    schichten
      .filter(schicht => schicht.idAuftragArbeitsschichten !== null && schicht.idAuftragArbeitsschichten !== undefined)
      .map(schicht => [String(schicht.idAuftragArbeitsschichten), schicht])
  );
  const employeeByPersonalNr = new Map();
  mitarbeiter.forEach(employee => {
    [employee.personalnr, ...(employee.personalnrHistory || []).map(entry => entry.value)]
      .filter(Boolean)
      .forEach(personalnr => employeeByPersonalNr.set(String(personalnr), employee));
  });

  const shifts = new Map();
  const employees = new Map();
  einsaetze.forEach(einsatz => {
    const employee = employeeByPersonalNr.get(String(einsatz.personalNr));
    if (!employee) return;

    const key = shiftKey(einsatz, schichtenById, schichtenByLegacyId);
    if (!shifts.has(key)) {
      shifts.set(key, { id: key, label: shiftLabel(einsatz, schichtenById, schichtenByLegacyId) });
    }

    const employeeId = String(employee._id);
    if (!employees.has(employeeId)) {
      employees.set(employeeId, {
        _id: employee._id,
        personalnr: employee.personalnr || '',
        email: employee.email || '',
        telefon: employee.telefon || '',
        vorname: employee.vorname || '',
        nachname: employee.nachname || '',
        geburtsdatum: employee.geburtsdatum || null,
        einsatzCount: employee.einsatzCount ?? null,
        konfektionsgroesse: employee.konfektionsgroesse || '',
        schuhgroesse: employee.schuhgroesse || '',
        shiftIds: [],
      });
    }
    const exportEmployee = employees.get(employeeId);
    if (!exportEmployee.shiftIds.includes(key)) exportEmployee.shiftIds.push(key);
  });

  return {
    auftrag: {
      auftragNr: auftrag.auftragNr,
      eventTitel: auftrag.eventTitel || '',
    },
    schichten: [...shifts.values()],
    mitarbeiter: [...employees.values()].sort((left, right) => (
      left.nachname.localeCompare(right.nachname, 'de') || left.vorname.localeCompare(right.vorname, 'de')
    )),
  };
}

async function loadAuftragMitarbeiterExport(auftragNr) {
  const parsedAuftragNr = Number.parseInt(auftragNr, 10);
  if (!Number.isFinite(parsedAuftragNr)) {
    const error = new Error('Ungültige Auftragsnummer');
    error.statusCode = 400;
    throw error;
  }

  const auftrag = await Auftrag.findOne({ auftragNr: parsedAuftragNr }).lean();
  if (!auftrag) {
    const error = new Error('Auftrag nicht gefunden');
    error.statusCode = 404;
    throw error;
  }

  const [einsaetze, schichten] = await Promise.all([
    Einsatz.find({ auftragNr: parsedAuftragNr }).sort({ datumVon: 1, uhrzeitVon: 1, personalNr: 1 }).lean(),
    Schicht.find({ auftragNr: parsedAuftragNr }).select('_id idAuftragArbeitsschichten bezeichnung').lean(),
  ]);
  const personalNrs = [...new Set(einsaetze.map(einsatz => String(einsatz.personalNr || '')).filter(Boolean))];
  const mitarbeiter = personalNrs.length
    ? await Mitarbeiter.find({
      $or: [
        { personalnr: { $in: personalNrs } },
        { 'personalnrHistory.value': { $in: personalNrs } },
      ],
    }).select(EMPLOYEE_FIELDS).lean()
    : [];

  return { auftrag, data: buildAuftragMitarbeiterExport({ auftrag, einsaetze, schichten, mitarbeiter }) };
}

module.exports = { buildAuftragMitarbeiterExport, loadAuftragMitarbeiterExport };