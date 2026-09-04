const Auftrag = require('../../models/Event/Auftrag');
const Beruf = require('../../models/Event/Beruf');
const DispoEintrag = require('../../models/System/DispoEintrag');
const Einsatz = require('../../models/Event/Einsatz');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Qualifikation = require('../../models/Event/Qualifikation');
const ZvooveVerfuegbarkeit = require('../../models/System/ZvooveVerfuegbarkeit');

function id(value) {
  return String(value?._id || value || '');
}

function personalNumbers(employee) {
  return [...new Set([
    employee?.personalnr,
    ...(employee?.personalnummern || []),
    ...(employee?.personalnrHistory || []).map(entry => entry?.value),
  ]
    .map(value => Number.parseInt(value, 10))
    .filter(Number.isInteger))];
}

function dateWithTime(value, time, end = false) {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) return null;
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})/);
  if (match) result.setHours(Number(match[1]), Number(match[2]), 0, 0);
  else result.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return result;
}

function shiftWindow(schicht) {
  const start = dateWithTime(schicht.datumVon, schicht.uhrzeitVon, false);
  const end = dateWithTime(schicht.datumBis || schicht.datumVon, schicht.uhrzeitBis, true);
  if (start && end && end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

function overlaps(leftStart, leftEnd, rightStart, rightEnd) {
  return Boolean(leftStart && leftEnd && rightStart && rightEnd && leftStart < rightEnd && leftEnd > rightStart);
}

function entryLabel(entry) {
  if (entry.typ === 'abwesenheit') {
    return ({ urlaub: 'Urlaub', krank: 'Krank', feiertag: 'Feiertag', ueberstunden: 'Überstundenabbau' })[entry.abwesenheitsKategorie] || 'Abwesend';
  }
  return ({ blocked: 'Gesperrt', partially: 'Teilweise verfügbar', available: 'Verfügbar', eingeplant: 'Bereits eingeplant' })[entry.verfuegbarkeit] || entry.text || 'Dispo-Konflikt';

}

function partialCoversShift(entry, window) {
  if (!entry.zeitVon && !entry.zeitBis) return false;
  const from = dateWithTime(entry.datumVon || window.start, entry.zeitVon || '00:00');
  const to = dateWithTime(entry.datumBis || entry.datumVon || window.start, entry.zeitBis || '23:59', true);
  if (from && to && to <= from) to.setDate(to.getDate() + 1);
  return from <= window.start && to >= window.end;
}

function entryOverlapsShift(entry, window) {
  if (!entry.zeitVon && !entry.zeitBis) return true;
  const from = dateWithTime(entry.datumVon || window.start, entry.zeitVon || '00:00');
  const to = dateWithTime(entry.datumBis || entry.datumVon || window.start, entry.zeitBis || '23:59', true);
  if (from && to && to <= from) to.setDate(to.getDate() + 1);
  return overlaps(window.start, window.end, from, to);
}

function calendarDayKeys(from, to = from) {
  const start = new Date(from);
  const end = new Date(to || from);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  const keys = [];
  for (let day = new Date(start), guard = 0; day <= end && guard < 366; day.setDate(day.getDate() + 1), guard += 1) {
    keys.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`);
  }
  return keys;
}

async function accessibleLocationIds(user, requestedLocation, includeOtherLocations) {
  const roles = [user?.role, ...(user?.roles || [])].map(value => String(value || '').toUpperCase());
  if (roles.includes('ADMIN') && includeOtherLocations) return null;
  const allowed = new Set([user?.locationV2, ...(user?.locationAccess || [])].map(id).filter(Boolean));
  if (requestedLocation && !allowed.has(id(requestedLocation)) && !roles.includes('ADMIN')) return [];
  if (!includeOtherLocations) return requestedLocation ? [requestedLocation] : [...allowed];
  return [...allowed];
}

async function getStaffingCandidates({ auftrag, schicht, user, includeOtherLocations = false, employeeIds = null }) {
  const window = shiftWindow(schicht);
  if (!window.start || !window.end) return [];
  const locationIds = await accessibleLocationIds(user, auftrag.locationV2, includeOtherLocations);
  const filter = { isActive: true, isBewerberstatus: { $ne: true } };
  if (Array.isArray(locationIds)) filter.locationV2 = { $in: locationIds };
  if (Array.isArray(employeeIds)) filter._id = { $in: employeeIds };

  const employees = await Mitarbeiter.find(filter)
    .select('_id vorname nachname personalnr personalnummern personalnrHistory telefon profilbild flip_id persgruppe locationV2 berufe qualifikationen kundenwuensche austrittsdatum')
    .populate('berufe', 'jobKey designation')
    .populate('qualifikationen', 'qualificationKey designation')
    .populate('kundenwuensche.kunde', 'kundenNr kundName kuerzel')
    .lean();
  if (!employees.length) return [];

  const employeeIdsFound = employees.map(employee => employee._id);
  const personalNrs = [...new Set(employees.flatMap(personalNumbers))];
  const [dispoEntries, deployments, zvooveEntries, customerOrderNrs, siteOrderNrs, requiredJob, requiredQualification] = await Promise.all([
    DispoEintrag.find({ mitarbeiter: { $in: employeeIdsFound }, datumVon: { $lte: window.end }, datumBis: { $gte: window.start } }).lean(),
    Einsatz.find({
      personalNr: { $in: personalNrs },
      datumVon: { $lte: window.end },
      datumBis: { $gte: window.start },
      $or: [{ schicht: { $ne: schicht._id } }, { schicht: null }],
    }).select('_id personalNr auftragNr schichtBezeichnung datumVon datumBis uhrzeitVon uhrzeitBis').lean(),
    ZvooveVerfuegbarkeit.find({ personalnr: { $in: personalNrs }, datum: { $gte: dateWithTime(window.start, null), $lte: dateWithTime(window.end, null, true) } }).lean(),
    Number.isInteger(auftrag.kundenNr) ? Auftrag.find({ kundenNr: auftrag.kundenNr }).distinct('auftragNr') : [],
    auftrag.einsatzort ? Auftrag.find({ einsatzort: auftrag.einsatzort }).distinct('auftragNr') : [],
    schicht.berufSchl ? Beruf.findOne({ jobKey: Number.parseInt(schicht.berufSchl, 10) }).lean() : null,
    schicht.qualSchl ? Qualifikation.findOne({ qualificationKey: Number.parseInt(schicht.qualSchl, 10) }).lean() : null,
  ]);

  const history = customerOrderNrs.length
    ? await Einsatz.aggregate([
      { $match: { auftragNr: { $in: customerOrderNrs }, personalNr: { $in: personalNrs } } },
      { $group: { _id: '$personalNr', count: { $sum: 1 } } },
    ])
    : [];
  const historyByPersonalNr = new Map(history.map(item => [Number(item._id), item.count]));
  const siteHistory = siteOrderNrs.length
    ? await Einsatz.aggregate([
      { $match: { auftragNr: { $in: siteOrderNrs }, personalNr: { $in: personalNrs } } },
      { $group: { _id: '$personalNr', count: { $sum: 1 } } },
    ])
    : [];
  const siteHistoryByPersonalNr = new Map(siteHistory.map(item => [Number(item._id), item.count]));
  const employeeIdByPersonalNr = new Map();
  employees.forEach(employee => personalNumbers(employee).forEach(number => employeeIdByPersonalNr.set(number, id(employee))));
  const entriesByEmployee = new Map(employees.map(employee => [id(employee), []]));
  for (const entry of dispoEntries) entriesByEmployee.get(id(entry.mitarbeiter))?.push(entry);
  for (const entry of zvooveEntries) {
    const employeeId = employeeIdByPersonalNr.get(Number(entry.personalnr));
    if (!employeeId) continue;
    entriesByEmployee.get(employeeId)?.push(ZvooveVerfuegbarkeit.toDispoDisplay(entry, employeeId).eintrag);
  }

  const deploymentsByPersonalNr = new Map();
  for (const deployment of deployments) {
    if (!deploymentsByPersonalNr.has(Number(deployment.personalNr))) deploymentsByPersonalNr.set(Number(deployment.personalNr), []);
    deploymentsByPersonalNr.get(Number(deployment.personalNr)).push(deployment);
  }

  const results = employees.map(employee => {
    const reasons = [];
    const warnings = [];
    const conflicts = [];
    const employeeEntries = entriesByEmployee.get(id(employee)) || [];
    const personalNr = Number.parseInt(employee.personalnr, 10);
    const employeePersonalNumbers = personalNumbers(employee);
    const jobs = new Set((employee.berufe || []).map(item => Number(item.jobKey)));
    const qualifications = new Set((employee.qualifikationen || []).map(item => Number(item.qualificationKey)));
    const jobMatches = !requiredJob || jobs.has(Number(requiredJob.jobKey));
    const qualificationMatches = !requiredQualification || qualifications.has(Number(requiredQualification.qualificationKey));

    if (jobMatches && requiredJob) reasons.push(`Beruf passt: ${requiredJob.designation}`);
    else if (requiredJob) warnings.push(`Beruf fehlt: ${requiredJob.designation}`);
    if (qualificationMatches && requiredQualification) reasons.push(`Qualifikation passt: ${requiredQualification.designation}`);
    else if (requiredQualification) warnings.push(`Qualifikation fehlt: ${requiredQualification.designation}`);

    const requiredAvailabilityDays = calendarDayKeys(schicht.datumVon, schicht.datumBis || schicht.datumVon);
    const availableDays = new Set();
    let matchingPartialWindow = false;
    let hasAvailabilityStatement = false;
    for (const entry of employeeEntries) {
      if (entry.typ === 'abwesenheit' || entry.verfuegbarkeit === 'blocked' || entry.verfuegbarkeit === 'eingeplant') {
        hasAvailabilityStatement = true;
        if (entryOverlapsShift(entry, window)) {
          conflicts.push({ type: entry.typ === 'abwesenheit' ? 'absence' : 'blocked', label: entryLabel(entry), entryId: entry._id });
        }
      } else if (entry.verfuegbarkeit === 'partially') {
        hasAvailabilityStatement = true;
        if (partialCoversShift(entry, window)) {
          matchingPartialWindow = true;
          reasons.push(`Teilzeitfenster passt: ${entry.zeitVon || '…'}–${entry.zeitBis || '…'}`);
        } else {
          conflicts.push({ type: 'partial', label: `Teilzeitfenster ${entry.zeitVon || '…'}–${entry.zeitBis || '…'} passt nicht`, entryId: entry._id });
        }
      } else if (entry.verfuegbarkeit === 'available') {
        hasAvailabilityStatement = true;
        calendarDayKeys(entry.datumVon, entry.datumBis || entry.datumVon).forEach(day => availableDays.add(day));
      }
    }
    const completeAllDayAvailability = requiredAvailabilityDays.length > 0
      && requiredAvailabilityDays.every(day => availableDays.has(day));
    const availabilityComplete = matchingPartialWindow || completeAllDayAvailability;
    if (completeAllDayAvailability) reasons.push('Im gesamten Zeitraum verfügbar');
    else if (availableDays.size && !matchingPartialWindow) warnings.push('Verfügbarkeit nicht für den gesamten Zeitraum angegeben');
    const availabilityRank = availabilityComplete ? 3 : hasAvailabilityStatement ? 2 : 1;

    const employeeDeployments = employeePersonalNumbers.flatMap(number => deploymentsByPersonalNr.get(number) || []);
    for (const deployment of employeeDeployments) {
      const deploymentWindow = {
        start: dateWithTime(deployment.datumVon, deployment.uhrzeitVon),
        end: dateWithTime(deployment.datumBis || deployment.datumVon, deployment.uhrzeitBis, true),
      };
      if (deploymentWindow.start && deploymentWindow.end && deploymentWindow.end <= deploymentWindow.start) deploymentWindow.end.setDate(deploymentWindow.end.getDate() + 1);
      if (overlaps(window.start, window.end, deploymentWindow.start, deploymentWindow.end)) {
        const overlapStart = new Date(Math.max(window.start.getTime(), deploymentWindow.start.getTime()));
        const overlapEnd = new Date(Math.min(window.end.getTime(), deploymentWindow.end.getTime()));
        const time = `${String(overlapStart.getHours()).padStart(2, '0')}:${String(overlapStart.getMinutes()).padStart(2, '0')}–${String(overlapEnd.getHours()).padStart(2, '0')}:${String(overlapEnd.getMinutes()).padStart(2, '0')}`;
        conflicts.push({ type: 'deployment', label: `Überschneidung ${time} · Auftrag ${deployment.auftragNr}`, einsatzId: deployment._id });
      }
    }

    const customerWish = (employee.kundenwuensche || []).find(item => Number(item.kunde?.kundenNr) === Number(auftrag.kundenNr));
    if (customerWish?.typ === 'positiv') reasons.push('Positiver Kundenwunsch');
    if (customerWish?.typ === 'negativ') conflicts.push({ type: 'customer-wish', label: `Negativer Kundenwunsch${customerWish.kommentar ? `: ${customerWish.kommentar}` : ''}` });
    const previousCount = employeePersonalNumbers.reduce((sum, number) => sum + (historyByPersonalNr.get(number) || 0), 0);
    if (previousCount) reasons.push(`Bereits ${previousCount}× bei diesem Kunden`);
    const previousSiteCount = employeePersonalNumbers.reduce((sum, number) => sum + (siteHistoryByPersonalNr.get(number) || 0), 0);
    if (previousSiteCount) reasons.push(`Bereits ${previousSiteCount}× an diesem Einsatzort`);
    if (id(employee.locationV2) === id(auftrag.locationV2)) reasons.push('Gleicher Standort');
    if (employee.austrittsdatum && new Date(employee.austrittsdatum) < window.start) conflicts.push({ type: 'exit', label: 'Austritt liegt vor der Schicht' });

    const status = conflicts.length
      ? 'conflict'
      : availabilityComplete && jobMatches && qualificationMatches
        ? 'recommended'
        : 'possible';
    const score = (status === 'recommended' ? 300 : status === 'possible' ? 200 : 100)
      + availabilityRank * 20
      + Number(jobMatches) * 8
      + Number(qualificationMatches) * 8
      + Number(customerWish?.typ === 'positiv') * 10
      + Math.min(previousCount, 9)
      + Math.min(previousSiteCount, 6)
      + Number(id(employee.locationV2) === id(auftrag.locationV2)) * 3;
    const candidateDispoEntries = [
      ...employeeEntries,
      ...employeeDeployments.map(deployment => ({
        _id: deployment._id,
        _source: 'einsatz',
        mitarbeiter: employee._id,
        datumVon: deployment.datumVon,
        datumBis: deployment.datumBis,
        typ: 'planned',
        verfuegbarkeit: 'eingeplant',
        auftragNr: deployment.auftragNr,
      })),
    ];
    return {
      _id: employee._id,
      vorname: employee.vorname,
      nachname: employee.nachname,
      personalnr: employee.personalnr,
      personalNumbers: employeePersonalNumbers,
      profilbild: employee.profilbild,
      locationV2: employee.locationV2,
      status,
      score,
      reasons,
      warnings,
      conflicts,
      dispoEntries: candidateDispoEntries,
    };
  });

  return results.sort((left, right) => right.score - left.score
    || String(left.nachname || '').localeCompare(String(right.nachname || ''), 'de')
    || String(left.vorname || '').localeCompare(String(right.vorname || ''), 'de'));
}

module.exports = { getStaffingCandidates, overlaps, shiftWindow };
