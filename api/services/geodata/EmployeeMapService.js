const Mitarbeiter = require('../../models/Employee/Mitarbeiter');
const Einsatzort = require('../../models/Event/Einsatzort');
const Kunde = require('../../models/Customer/Kunde');
const Location = require('../../models/System/Location');
const User = require('../../models/System/User');
require('../../models/System/Adresse');
const { hasAddress, coordinateKey } = require('./address');
const { readAddresses, readRoutes } = require('./GeodataService');
const { getProviders } = require('./providers');

const id = value => String(value?._id || value || '');
const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

function fail(statusCode, code, message) {
  const error = new Error(message);
  Object.assign(error, { statusCode, code });
  throw error;
}

async function mapScope(userId, requestedLocation) {
  const user = objectId(id(userId)) ? await User.findById(userId).select('isConfirmed role roles location locationV2 locationAccess').lean() : null;
  if (!user || !user.isConfirmed) fail(403, 'MAP_ACCESS_DENIED', 'Kein Zugriff auf die Karte. Bitte Benutzerfreigabe prüfen.');
  const locations = await Location.find({ isActive: true }).select('nameFull shortName color address').sort({ nameFull: 1 }).lean();
  const admin = [user.role, ...(user.roles || [])].some(role => String(role).toUpperCase() === 'ADMIN');
  // A present locationV2 is authoritative, even if that location is inactive.
  // Only users without locationV2 use the legacy-name compatibility fallback.
  const ownId = id(user.locationV2) || id(locations.find(location => [location.nameFull, location.shortName]
    .some(name => Location.normalize(name) === Location.normalize(user.location) && user.location)));
  const allowed = new Set([ownId, ...(user.locationAccess || []).map(id)].filter(Boolean));
  const available = locations.filter(location => admin || allowed.has(id(location)));
  const selected = requestedLocation === 'all' ? null : requestedLocation || (available.some(location => id(location) === ownId) ? ownId : null);
  if (selected && !available.some(location => id(location) === selected)) {
    fail(403, 'MAP_LOCATION_DENIED', 'Für diesen Standort besteht kein Zugriff.');
  }
  if (!available.length) fail(403, 'MAP_LOCATION_MISSING', 'Deinem Benutzer ist kein aktiver Standort für die Karte freigegeben.');
  return { available, selected, locationIds: selected ? [selected] : available.map(id) };
}

function locationData(locationId, locations) {
  const location = locations.find(entry => id(entry) === id(locationId));
  return location ? { _id: id(location), nameFull: location.nameFull, shortName: location.shortName, color: location.color } : null;
}

function employeeEntries(employees, locations) {
  return employees.flatMap(employee => {
    const kinds = ['adresse', ...(hasAddress(employee.adresse2) ? ['adresse2'] : [])];
    return kinds.map(kind => ({
      id: `${id(employee)}:${kind}`,
      entityType: 'mitarbeiter', mitarbeiterId: id(employee),
      name: [employee.vorname, employee.nachname].filter(Boolean).join(' '),
      addressKind: kind === 'adresse' ? 'main' : 'secondary',
      locationV2: id(employee.locationV2), location: locationData(employee.locationV2, locations),
      rawAddress: employee[kind] || {},
    }));
  });
}

function siteEntry(site, locations) {
  return {
    id: `einsatzort:${id(site)}`, entityType: 'einsatzort', einsatzortId: id(site),
    name: site.bezeichnung || site.adresse?.name || 'Einsatzort',
    customerLabel: site.kunde?.kundName || site.kunde?.kundBez || '',
    locationV2: id(site.kunde?.locationV2), location: locationData(site.kunde?.locationV2, locations),
    rawAddress: site.adresse?.isActive === false ? {} : site.adresse || {},
  };
}

async function withGeodata(entries, options) {
  const geodata = await readAddresses(entries.map(entry => entry.rawAddress), options);
  return entries.map(({ rawAddress, ...entry }, index) => ({ ...entry, ...geodata[index] }));
}

async function getSites(locationIds, siteId) {
  const customers = await Kunde.find({ locationV2: { $in: locationIds } }).select('_id').lean();
  const sites = await Einsatzort.find({
    isActive: true, kunde: { $in: customers.map(customer => customer._id) },
    ...(siteId ? { _id: siteId } : {}),
  }).select('bezeichnung adresse kunde')
    .populate('adresse', 'name strasse plz ort land nat isActive')
    .populate('kunde', 'kundName kundBez locationV2')
    .sort({ bezeichnung: 1, _id: 1 }).lean();
  // Also enforce scope after population in case a customer moved or was
  // removed between the two reads.
  return sites.filter(site => locationIds.includes(id(site.kunde?.locationV2)));
}

async function nearestEmployees(origin, entries) {
  const common = { limit: 20, direction: 'from_einsatzort', profile: 'driving', results: [], pending: 0, excluded: [] };
  if (!origin.coordinates) return {
    ...common, state: origin.state === 'pending' ? 'pending' : 'unavailable',
    pending: origin.state === 'pending' ? 1 : 0,
    error: origin.state === 'pending' ? null : {
      code: 'SITE_ADDRESS_UNRESOLVED',
      message: ['disabled', 'error'].includes(origin.state)
        ? 'Die Adresse des Einsatzorts konnte momentan nicht ermittelt werden. Bitte die Karten-Konfiguration prüfen lassen oder später erneut versuchen.'
        : 'Der Einsatzort hat keine auflösbare Adresse. Bitte Straße, PLZ und Ort beim Kunden prüfen und anschließend aktualisieren.',
    },
  };
  // Keep both address entries on the map, but count identical home coordinates
  // only once per employee in the ranked results.
  const unique = new Map();
  const excluded = [];
  let pending = 0;
  for (const entry of entries) {
    if (!entry.coordinates) {
      excluded.push({ entryId: entry.id, mitarbeiterId: entry.mitarbeiterId, state: entry.state });
      if (entry.state === 'pending') pending += 1;
      continue;
    }
    const key = `${entry.mitarbeiterId}:${coordinateKey(entry.coordinates)}`;
    if (unique.has(key)) unique.get(key).addressEntryIds.push(entry.id);
    else unique.set(key, { entryId: entry.id, mitarbeiterId: entry.mitarbeiterId, coordinates: entry.coordinates, addressEntryIds: [entry.id] });
  }
  const candidates = [...unique.values()];
  const routes = await readRoutes(origin.coordinates, candidates.map(entry => entry.coordinates));
  const results = [];
  routes.forEach((route, index) => {
    const candidate = candidates[index];
    if (route.state === 'resolved') results.push({
      entryId: candidate.entryId, mitarbeiterId: candidate.mitarbeiterId,
      addressEntryIds: candidate.addressEntryIds,
      durationSeconds: route.durationSeconds, distanceMeters: route.distanceMeters,
    });
    else {
      if (route.state === 'pending') pending += 1;
      excluded.push(...candidate.addressEntryIds.map(entryId => ({ entryId, mitarbeiterId: candidate.mitarbeiterId, state: route.state, error: route.error || null })));
    }
  });
  results.sort((a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters || a.entryId.localeCompare(b.entryId));
  return {
    ...common, state: pending ? 'pending' : 'ready', pending, excluded,
    results: results.slice(0, 20), routable: results.length,
    error: !getProviders().router && candidates.length && !results.length
      ? { code: 'ROUTING_UNAVAILABLE', message: 'Fahrzeiten sind momentan nicht verfügbar. Bitte die Karten-Konfiguration prüfen lassen.' } : null,
  };
}

async function getMapData(userId, query) {
  const entityType = query.entityType === undefined ? 'mitarbeiter' : query.entityType;
  if (!['mitarbeiter', 'einsatzort'].includes(entityType)) fail(400, 'MAP_ENTITY_INVALID', 'Ungültiger Kartentyp.');
  if (query.locationV2 !== undefined && query.locationV2 !== 'all' && !objectId(query.locationV2)) fail(400, 'MAP_LOCATION_INVALID', 'Ungültiger Standort.');
  if (query.einsatzortId !== undefined && (!objectId(query.einsatzortId) || entityType !== 'mitarbeiter')) fail(400, 'MAP_SITE_INVALID', 'Ungültiger Einsatzort oder Kartentyp.');
  const scope = await mapScope(userId, query.locationV2);
  let origin = null;
  if (query.einsatzortId) {
    const [site] = await getSites(scope.locationIds, query.einsatzortId);
    if (!site) fail(404, 'MAP_SITE_NOT_FOUND', 'Der Einsatzort ist nicht aktiv oder für diesen Standort nicht zugänglich.');
    [origin] = await withGeodata([siteEntry(site, scope.available)], { priority: true });
  }
  let entries;
  if (entityType === 'mitarbeiter') {
    const employees = await Mitarbeiter.find({ isActive: true, locationV2: { $in: scope.locationIds } })
      .select('vorname nachname adresse.strasse adresse.plz adresse.ort adresse.land adresse2.strasse adresse2.plz adresse2.ort adresse2.land locationV2')
      .sort({ nachname: 1, vorname: 1, _id: 1 }).lean();
    entries = await withGeodata(employeeEntries(employees, scope.available));
  } else entries = await withGeodata((await getSites(scope.locationIds)).map(site => siteEntry(site, scope.available)));
  const selectedLocation = scope.available.find(location => id(location) === scope.selected);
  const [center] = selectedLocation ? await readAddresses([selectedLocation.address], { priority: true }) : [];
  const nearest = origin ? await nearestEmployees(origin, entries) : null;
  const pending = Math.max(entries.filter(entry => entry.state === 'pending').length, nearest?.pending || 0) + (center?.state === 'pending' ? 1 : 0);
  return {
    entityType, locationV2: scope.selected,
    locations: scope.available.map(location => locationData(location._id, scope.available)),
    entries, origin, nearest, center: center?.coordinates || null,
    summary: {
      total: entries.length, mapped: entries.filter(entry => entry.coordinates).length,
      unresolved: entries.filter(entry => !entry.coordinates && entry.state !== 'pending').length,
      pending, retryAfterMs: pending ? 3000 : null,
    },
    configuration: { geocodingAvailable: Boolean(getProviders().geocoder), routingAvailable: Boolean(getProviders().router) },
  };
}

module.exports = { getMapData };
