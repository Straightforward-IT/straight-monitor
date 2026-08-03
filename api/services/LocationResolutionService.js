const mongoose = require('mongoose');
const Location = require('../models/Location');

function normalizeTeamKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

async function resolveActiveLocation(locationId) {
  if (!mongoose.isValidObjectId(locationId)) return null;
  return Location.findOne({ _id: locationId, isActive: true })
    .select('_id nameFull shortName color externalId')
    .lean();
}

async function resolveLocationFromPersonalnr(personalnr) {
  const externalId = String(personalnr || '').trim().match(/^\d/)?.[0];
  if (!externalId) return null;

  return resolveLocationFromExternalId(externalId);
}

async function resolveLocationFromGeschSt(geschSt) {
  const externalId = String(geschSt || '').trim();
  if (!externalId) return null;

  return resolveLocationFromExternalId(externalId);
}

async function resolveLocationFromKundenNr(kundenNr) {
  const externalId = String(kundenNr || '').trim().match(/^\d/)?.[0];
  if (!externalId) return null;

  return resolveLocationFromExternalId(externalId);
}

async function resolveLocationFromExternalId(externalId) {
  return Location.findOne({ externalId: String(externalId), isActive: true })
    .select('_id nameFull shortName color externalId')
    .lean();
}

async function resolveLocationFromTeamKey(teamKey) {
  const normalizedTeamKey = normalizeTeamKey(teamKey);
  if (!normalizedTeamKey) return null;

  const locations = await Location.find({ isActive: true })
    .select('_id nameFull shortName color externalId')
    .lean();
  return locations.find((location) => (
    normalizeTeamKey(location.nameFull) === normalizedTeamKey
    || normalizeTeamKey(location.shortName) === normalizedTeamKey
  )) || null;
}

async function resolveLocationFromStandortName(standortName) {
  const normalizedStandortName = normalizeTeamKey(standortName);
  if (!normalizedStandortName) return null;

  const locations = await Location.find({ isActive: true })
    .select('_id nameFull shortName color externalId')
    .lean();
  return locations.find((location) => (
    normalizeTeamKey(location.nameFull) === normalizedStandortName
    || normalizeTeamKey(location.shortName) === normalizedStandortName
  )) || null;
}

module.exports = {
  resolveActiveLocation,
  resolveLocationFromPersonalnr,
  resolveLocationFromGeschSt,
  resolveLocationFromKundenNr,
  resolveLocationFromTeamKey,
  resolveLocationFromStandortName,
};