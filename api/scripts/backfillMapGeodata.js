const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const Einsatzort = require('../models/Event/Einsatzort');
const Kunde = require('../models/Customer/Kunde');
const Location = require('../models/System/Location');
const Geodata = require('../models/System/Geodata');
require('../models/System/Adresse');
const { normalizeAddress, hasAddress } = require('../services/geodata/address');
const { resolveAddress } = require('../services/geodata/GeodataService');
const { getProviders } = require('../services/geodata/providers');

function configurationError(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--write' && !/^--(limit|location)=/.test(arg))) {
    throw configurationError('Aufruf: node scripts/backfillMapGeodata.js [--write] [--limit=500] [--location=OBJECT_ID]');
  }
  const write = args.includes('--write');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity;
  const locationId = args.find(arg => arg.startsWith('--location='))?.slice('--location='.length);
  if (limitArg && (!Number.isSafeInteger(limit) || limit < 1)) throw configurationError('--limit muss eine positive ganze Zahl sein.');
  if (locationId && !/^[a-f\d]{24}$/i.test(locationId)) throw configurationError('--location muss eine gültige Standort-ID sein.');
  const providers = getProviders();
  if (write && !providers.geocoder) throw configurationError('Adressauflösung ist nicht eingerichtet. MAP_EXTERNAL_PROCESSING_ENABLED und MAPBOX_ACCESS_TOKEN prüfen.');
  if (!process.env.MONGO_URI) throw configurationError('MONGO_URI ist nicht gesetzt.');
  // A dry run neither creates indexes nor writes cache records.
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: write, autoCreate: write });
  if (write) await Geodata.init();
  const locations = await Location.find({ isActive: true, ...(locationId ? { _id: locationId } : {}) }).select('_id address').lean();
  if (locationId && !locations.length) throw configurationError('Der gewählte Standort ist nicht aktiv.');
  const locationIds = locations.map(location => location._id);
  const seen = new Set();
  const counts = { mode: write ? 'write' : 'dry-run', unique: 0, incomplete: 0, cached: 0, due: 0, resolved: 0, unresolved: 0, error: 0, pending: 0 };

  async function visit(input) {
    const address = normalizeAddress(input || {});
    if (!address.valid) { counts.incomplete += 1; return; }
    if (seen.has(address.normalizedKey)) return;
    seen.add(address.normalizedKey);
    counts.unique += 1;
    const identity = { normalizedKey: address.normalizedKey, provider: providers.geocodingId };
    const existing = await Geodata.findOne(identity).select('state expiresAt').lean();
    if (existing && !['pending', 'stale'].includes(existing.state) && new Date(existing.expiresAt).getTime() > Date.now()) {
      counts.cached += 1;
      return;
    }
    counts.due += 1;
    if (write) {
      await resolveAddress(address, providers.geocoder);
      const result = await Geodata.findOne(identity).select('state').lean();
      const state = ['resolved', 'unresolved', 'error'].includes(result?.state) ? result.state : 'pending';
      counts[state] += 1;
    }
    if (counts.unique % 100 === 0) console.log(JSON.stringify(counts));
  }

  for (const location of locations) {
    if (seen.size >= limit) break;
    await visit(location.address);
  }
  if (seen.size < limit) {
    const employees = Mitarbeiter.find({ isActive: true, locationV2: { $in: locationIds } })
      .select('adresse.strasse adresse.plz adresse.ort adresse.land adresse2.strasse adresse2.plz adresse2.ort adresse2.land').lean().cursor();
    for await (const employee of employees) {
      await visit(employee.adresse);
      if (seen.size >= limit) break;
      if (hasAddress(employee.adresse2)) await visit(employee.adresse2);
      if (seen.size >= limit) break;
    }
  }
  if (seen.size < limit) {
    const customers = await Kunde.find({ locationV2: { $in: locationIds } }).select('_id').lean();
    const sites = Einsatzort.find({ isActive: true, kunde: { $in: customers.map(customer => customer._id) } })
      .select('adresse').populate('adresse', 'strasse plz ort land nat isActive').lean().cursor();
    for await (const site of sites) {
      await visit(site.adresse?.isActive === false ? null : site.adresse);
      if (seen.size >= limit) break;
    }
  }
  console.log(JSON.stringify(counts, null, 2));
}

main().catch(error => {
  // Do not print database connection strings, provider requests or addresses.
  console.error(error.publicMessage || 'Geodaten-Backfill fehlgeschlagen. Parameter, MongoDB-Verbindung und Karten-Konfiguration prüfen.');
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
