const Einsatz = require("../../models/Event/Einsatz");

function toPersonalNumber(value) {
  const number = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function resolvePersonalNumbers(mitarbeiter) {
  const numbers = new Set();
  const add = (value) => {
    const number = toPersonalNumber(value);
    if (number !== null) numbers.add(number);
  };

  add(mitarbeiter?.personalnr);
  for (const value of mitarbeiter?.personalnummern || []) add(value);
  for (const entry of mitarbeiter?.personalnrHistory || []) add(entry?.value);

  return [...numbers];
}

function effectiveStart(einsatz) {
  if (!einsatz?.datumVon) return null;
  const start = new Date(einsatz.datumVon);
  if (Number.isNaN(start.getTime())) return null;

  const match = String(einsatz.uhrzeitVon || "").match(/^(\d{1,2}):(\d{2})/);
  if (match) start.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return start;
}

function compareEinsaetze(left, right) {
  const leftStart = effectiveStart(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightStart = effectiveStart(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftStart !== rightStart) return leftStart - rightStart;

  for (const field of ["auftragNr", "idAuftragArbeitsschichten", "personalNr"]) {
    const difference = Number(left?.[field] ?? Number.MAX_SAFE_INTEGER)
      - Number(right?.[field] ?? Number.MAX_SAFE_INTEGER);
    if (difference) return difference;
  }

  return String(left?._id || "").localeCompare(String(right?._id || ""));
}

function isInRange(einsatz, { from, through } = {}) {
  if (einsatz?.isPseudo === true) return false;
  const start = effectiveStart(einsatz);
  if (!start) return false;
  if (from && start < new Date(from)) return false;
  if (through && start > new Date(through)) return false;
  return true;
}

function buildOrdinalMap(records) {
  const sorted = records.filter((record) => isInRange(record)).sort(compareEinsaetze);
  return new Map(sorted.map((record, index) => [String(record._id), index + 1]));
}

function employeeKey(mitarbeiter) {
  return String(mitarbeiter?._id || mitarbeiter?.personalnr || "");
}

function buildOrdinalMapsForEmployees(records, mitarbeiterList) {
  const recordsByPersonalNumber = new Map();
  for (const record of records) {
    const personalNumber = toPersonalNumber(record.personalNr);
    if (personalNumber === null) continue;
    if (!recordsByPersonalNumber.has(personalNumber)) recordsByPersonalNumber.set(personalNumber, []);
    recordsByPersonalNumber.get(personalNumber).push(record);
  }

  return new Map(mitarbeiterList.map((mitarbeiter) => {
    const employeeRecords = resolvePersonalNumbers(mitarbeiter)
      .flatMap((personalNumber) => recordsByPersonalNumber.get(personalNumber) || []);
    return [employeeKey(mitarbeiter), buildOrdinalMap(employeeRecords)];
  }));
}

function buildCountMapForEmployees(records, mitarbeiterList, options = {}) {
  const ordinalMaps = buildOrdinalMapsForEmployees(
    records.filter((record) => isInRange(record, options)),
    mitarbeiterList
  );
  return new Map([...ordinalMaps].map(([key, ordinalMap]) => [key, ordinalMap.size]));
}

async function findForEmployee(mitarbeiter, { from, through, select, model = Einsatz } = {}) {
  const personalNumbers = resolvePersonalNumbers(mitarbeiter);
  if (!personalNumbers.length) return [];

  const datumVon = {};
  if (from) datumVon.$gte = new Date(from);
  if (through) datumVon.$lte = new Date(through);

  const query = model.find({
    personalNr: { $in: personalNumbers },
    isPseudo: { $ne: true },
    ...(Object.keys(datumVon).length ? { datumVon } : {}),
  });
  if (select) query.select(select);
  return query.lean();
}

async function countForEmployee(mitarbeiter, options = {}) {
  const records = await findForEmployee(mitarbeiter, options);
  return records.filter((record) => isInRange(record, options)).length;
}

async function ordinalsForEmployee(mitarbeiter, options = {}) {
  const records = await findForEmployee(mitarbeiter, {
    ...options,
    select: "_id personalNr auftragNr datumVon uhrzeitVon idAuftragArbeitsschichten isPseudo",
  });
  return buildOrdinalMap(records);
}

async function ordinalsForEmployees(mitarbeiterList, { model = Einsatz } = {}) {
  const personalNumbers = [...new Set(mitarbeiterList.flatMap(resolvePersonalNumbers))];
  if (!personalNumbers.length) return new Map();

  const records = await model.find({
    personalNr: { $in: personalNumbers },
    isPseudo: { $ne: true },
  })
    .select("_id personalNr auftragNr datumVon uhrzeitVon idAuftragArbeitsschichten isPseudo")
    .lean();

  return buildOrdinalMapsForEmployees(records, mitarbeiterList);
}

async function countsForEmployees(mitarbeiterList, { from, through, model = Einsatz } = {}) {
  const personalNumbers = [...new Set(mitarbeiterList.flatMap(resolvePersonalNumbers))];
  if (!personalNumbers.length) return new Map();

  const datumVon = {};
  if (from) datumVon.$gte = new Date(from);
  if (through) {
    const endOfBoundaryDay = new Date(through);
    endOfBoundaryDay.setHours(23, 59, 59, 999);
    datumVon.$lte = endOfBoundaryDay;
  }

  const records = await model.find({
    personalNr: { $in: personalNumbers },
    isPseudo: { $ne: true },
    ...(Object.keys(datumVon).length ? { datumVon } : {}),
  })
    .select("_id personalNr auftragNr datumVon uhrzeitVon idAuftragArbeitsschichten isPseudo")
    .lean();

  return buildCountMapForEmployees(records, mitarbeiterList, { from, through });
}

module.exports = {
  buildCountMapForEmployees,
  buildOrdinalMap,
  buildOrdinalMapsForEmployees,
  compareEinsaetze,
  countForEmployee,
  countsForEmployees,
  effectiveStart,
  findForEmployee,
  isInRange,
  ordinalsForEmployee,
  ordinalsForEmployees,
  resolvePersonalNumbers,
};