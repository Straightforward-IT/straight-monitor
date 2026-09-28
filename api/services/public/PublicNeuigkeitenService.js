const mongoose = require('mongoose');
const Einsatz = require('../../models/Event/Einsatz');
const Auftrag = require('../../models/Event/Auftrag');
const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const { resolvePersonalNumbers } = require('../operations/EinsatzCountingService');

const CONFIRMATION_VERSION = 'einsatz-confirmation-v1';
const CONFIRMATION_STEPS = Object.freeze([
  {
    key: 'einsatzzeitenGelesen',
    field: 'einsatzzeitenGelesenAt',
    text: 'Ich bestätige, dass ich die Einsatzzeiten gelesen und gespeichert habe.',
  },
  {
    key: 'einsatzkleidung',
    field: 'einsatzkleidungAt',
    text: 'Ich bestätige dass Meine Einsatzkleidung Vollständig, Sauber und Gebügelt sein wird.',
  },
  {
    key: 'ankunftspuffer',
    field: 'ankunftspufferAt',
    text: 'Ich bestätige, dass ich einen Puffer einplane, um mind. eine Viertelstunde vor Beginn am Treffpunkt sein werde.',
  },
]);

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function openAssignmentFilter(personalNumbers) {
  const today = startOfToday();
  return {
    personalNr: { $in: personalNumbers },
    source: 'monitor',
    isPseudo: { $ne: true },
    bestaetigungErforderlich: true,
    bestaetigt: { $ne: true },
    $or: [
      { datumBis: { $gte: today } },
      { datumBis: null, datumVon: { $gte: today } },
      { datumBis: { $exists: false }, datumVon: { $gte: today } },
    ],
  };
}

function currentStep(einsatz) {
  const confirmation = einsatz.bestaetigung || {};
  return CONFIRMATION_STEPS.find((step) => !confirmation[step.field]) || null;
}

function serializeNewsItem(einsatz, auftrag) {
  const step = currentStep(einsatz);
  const meetingPoint = [einsatz.treffpunkt, einsatz.treffpunktOrt].filter(Boolean).join(' · ');
  const location = meetingPoint || auftrag?.eventLocation || auftrag?.eventOrt || 'Ort noch nicht angegeben';
  return {
    id: `einsatz-bestaetigung:${einsatz._id}`,
    type: 'einsatz-bestaetigung',
    source: 'monitor-einsatz',
    createdAt: einsatz.createdAt,
    einsatz: {
      id: String(einsatz._id),
      auftragNr: einsatz.auftragNr,
      title: auftrag?.eventTitel || einsatz.bezeichnung || einsatz.schichtBezeichnung || `Auftrag #${einsatz.auftragNr}`,
      dateFrom: einsatz.datumVon,
      dateTo: einsatz.datumBis || einsatz.datumVon,
      timeFrom: einsatz.uhrzeitVon || null,
      timeTo: einsatz.uhrzeitBis || null,
      location,
    },
    confirmation: {
      currentStep: step ? {
        key: step.key,
        text: step.text,
        position: CONFIRMATION_STEPS.indexOf(step) + 1,
      } : null,
      totalSteps: CONFIRMATION_STEPS.length,
    },
  };
}

async function resolveEmployee(mitarbeiterId) {
  return Mitarbeiter.findById(mitarbeiterId)
    .select('_id personalnr personalnrHistory')
    .lean();
}

async function listOpenEinsatzBestaetigungen(mitarbeiter) {
  const personalNumbers = resolvePersonalNumbers(mitarbeiter);
  if (!personalNumbers.length) return [];

  const einsaetze = await Einsatz.find(openAssignmentFilter(personalNumbers))
    .select('auftragNr bezeichnung schichtBezeichnung datumVon datumBis uhrzeitVon uhrzeitBis treffpunkt treffpunktOrt bestaetigung createdAt')
    .sort({ datumVon: 1, uhrzeitVon: 1, createdAt: 1 })
    .lean();
  const auftragNrs = [...new Set(einsaetze.map((einsatz) => einsatz.auftragNr))];
  const auftraege = auftragNrs.length
    ? await Auftrag.find({ auftragNr: { $in: auftragNrs } })
      .select('auftragNr eventTitel eventLocation eventOrt')
      .lean()
    : [];
  const auftragByNr = new Map(auftraege.map((auftrag) => [auftrag.auftragNr, auftrag]));
  return einsaetze.map((einsatz) => serializeNewsItem(einsatz, auftragByNr.get(einsatz.auftragNr)));
}

// Add additional async collectors here as announcements, links, or messages
// become available. Every source receives the same authenticated employee.
const NEWS_SOURCES = Object.freeze([listOpenEinsatzBestaetigungen]);

async function listForMitarbeiter(mitarbeiterId) {
  const mitarbeiter = await resolveEmployee(mitarbeiterId);
  if (!mitarbeiter) return [];
  const collected = await Promise.all(NEWS_SOURCES.map((source) => source(mitarbeiter)));
  return collected
    .flat()
    .sort((left, right) => new Date(left.einsatz?.dateFrom || left.createdAt) - new Date(right.einsatz?.dateFrom || right.createdAt));
}

async function confirmStep({ mitarbeiterId, einsatzId, stepKey }) {
  if (!mongoose.isValidObjectId(einsatzId)) {
    const error = new Error('Ungültiger Einsatz.');
    error.statusCode = 400;
    throw error;
  }
  const mitarbeiter = await resolveEmployee(mitarbeiterId);
  if (!mitarbeiter) return null;
  const personalNumbers = resolvePersonalNumbers(mitarbeiter);
  const stepIndex = CONFIRMATION_STEPS.findIndex((step) => step.key === stepKey);
  if (stepIndex === -1) {
    const error = new Error('Unbekannter Bestätigungsschritt.');
    error.statusCode = 400;
    throw error;
  }

  const einsatz = await Einsatz.findOne({ _id: einsatzId, ...openAssignmentFilter(personalNumbers) });
  if (!einsatz) return null;
  const step = CONFIRMATION_STEPS[stepIndex];
  const previousStep = CONFIRMATION_STEPS[stepIndex - 1];
  if (previousStep && !einsatz.bestaetigung?.[previousStep.field]) {
    const error = new Error('Bitte bestätige zuerst den vorherigen Schritt.');
    error.statusCode = 409;
    throw error;
  }

  if (!einsatz.bestaetigung?.[step.field]) {
    const now = new Date();
    einsatz.bestaetigung ||= {};
    einsatz.bestaetigung.version ||= CONFIRMATION_VERSION;
    einsatz.bestaetigung[step.field] = now;
    if (stepIndex === CONFIRMATION_STEPS.length - 1) {
      einsatz.bestaetigung.completedAt = now;
      einsatz.bestaetigt = true;
    }
    await einsatz.save();
  }
  return { completed: einsatz.bestaetigt, nextStep: currentStep(einsatz)?.key || null };
}

module.exports = {
  CONFIRMATION_STEPS,
  confirmStep,
  listForMitarbeiter,
};
