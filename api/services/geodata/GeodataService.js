const { createHash, randomUUID } = require('node:crypto');
const Geodata = require('../../models/System/Geodata');
const MapRouteCache = require('../../models/System/MapRouteCache');
const { normalizeAddress, coordinateKey } = require('./address');
const { getProviders } = require('./providers');

const DAY = 86400000;
const LEASE_MS = 180000;
const pendingJobs = new Map();
let working = false;
let activeJobKey = null;

// Bounded, deduplicated local queue. The database lease also coalesces misses
// across API workers. Expired leases recover interrupted work on the next read.
function enqueue(key, run, priority = false) {
  if (key === activeJobKey || (pendingJobs.has(key) && !priority)) return;
  if (!pendingJobs.has(key) && pendingJobs.size >= 500) {
    if (!priority) return;
    // A newly selected site must not sit behind the initial address backfill.
    const lastQueued = [...pendingJobs.keys()].reverse().find(queued => queued !== activeJobKey);
    if (lastQueued) pendingJobs.delete(lastQueued);
  }
  pendingJobs.delete(key);
  if (priority) {
    const rest = [...pendingJobs];
    pendingJobs.clear();
    pendingJobs.set(key, run);
    for (const entry of rest) pendingJobs.set(...entry);
  } else pendingJobs.set(key, run);
  if (!working) void drain();
}

async function drain() {
  working = true;
  while (pendingJobs.size) {
    const [key, run] = pendingJobs.entries().next().value;
    activeJobKey = key;
    try { await run(); } catch { console.warn('[map] Background cache update failed; a later request can retry.'); }
    pendingJobs.delete(key);
    activeJobKey = null;
  }
  working = false;
}

function fresh(record) {
  return record && record.state !== 'pending' && record.state !== 'stale' && new Date(record.expiresAt).getTime() > Date.now();
}

async function claim(Model, identity, defaults) {
  const now = new Date();
  try {
    return await Model.findOneAndUpdate({
      ...identity,
      expiresAt: { $lte: now },
      leaseUntil: { $lte: now },
    }, {
      $set: { state: 'pending', leaseUntil: new Date(Date.now() + LEASE_MS), leaseToken: randomUUID() },
      $setOnInsert: { ...defaults, expiresAt: new Date(0), purgeAt: new Date(Date.now() + 180 * DAY) },
    }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  } catch (error) {
    if (error.code === 11000) return null; // Another worker has a fresh value or lease.
    throw error;
  }
}

async function complete(Model, record, values, ttl) {
  await Model.updateOne({ _id: record._id, leaseToken: record.leaseToken }, { $set: {
    ...values,
    resolvedAt: new Date(),
    expiresAt: new Date(Date.now() + ttl),
    purgeAt: new Date(Date.now() + (Model === Geodata ? 180 * DAY : 7 * DAY)),
    leaseUntil: new Date(0),
    leaseToken: null,
  } });
}

function providerError(error) {
  return ['provider_credentials', 'provider_request', 'provider_unavailable'].includes(error.code)
    ? error.code : 'provider_unavailable';
}

async function resolveAddress(address, provider = getProviders().geocoder) {
  if (!provider || !address.valid) return;
  const identity = { normalizedKey: address.normalizedKey, provider: provider.geocodingId };
  const record = await claim(Geodata, identity, { address: address.formatted });
  if (!record) return;
  try {
    const result = await provider.geocode(address);
    await complete(Geodata, record, result
      ? { ...result, state: 'resolved', error: null }
      : { coordinates: null, state: 'unresolved', error: 'address_not_found' }, result ? 90 * DAY : 7 * DAY);
  } catch (error) {
    await complete(Geodata, record, { coordinates: null, state: 'error', error: providerError(error) }, 5 * 60000);
  }
}

async function readAddresses(inputs, { priority = false } = {}) {
  const providers = getProviders();
  const addresses = inputs.map(input => normalizeAddress(input || {}));
  const keys = [...new Set(addresses.filter(address => address.valid).map(address => address.normalizedKey))];
  const records = keys.length ? await Geodata.find({ normalizedKey: { $in: keys }, provider: providers.geocodingId }).lean() : [];
  const byKey = new Map(records.map(record => [record.normalizedKey, record]));
  return addresses.map(address => {
    const record = byKey.get(address.normalizedKey);
    if (!address.valid) return { address: address.formatted || 'Keine Adresse hinterlegt', coordinates: null, state: 'invalid', error: 'address_incomplete' };
    if (fresh(record)) return {
      address: address.formatted, coordinates: record.coordinates || null, state: record.state,
      error: record.error || null, accuracy: record.accuracy || null,
      attribution: record.coordinates ? record.attribution : null,
    };
    if (providers.geocoder) {
      enqueue(`geo:${providers.geocodingId}:${address.normalizedKey}`, () => resolveAddress(address, providers.geocoder), priority);
    }
    return { address: address.formatted, coordinates: null, state: providers.geocoder ? 'pending' : 'disabled', error: providers.geocoder ? null : 'provider_not_configured' };
  });
}

function routeKey(origin, destination, providerId) {
  return createHash('sha256').update(`${providerId}|${coordinateKey(origin)}|${coordinateKey(destination)}`).digest('hex');
}

async function resolveRoutes(origin, destinations, provider) {
  const claimed = [];
  for (const destination of destinations) {
    const key = routeKey(origin, destination, provider.routingId);
    const record = await claim(MapRouteCache, { key }, { provider: provider.routingId });
    if (record) claimed.push({ destination, record });
  }
  if (!claimed.length) return;
  try {
    const results = await provider.routesFrom(origin, claimed.map(entry => entry.destination));
    for (let index = 0; index < claimed.length; index += 1) {
      const result = results[index];
      await complete(MapRouteCache, claimed[index].record, result
        ? { ...result, state: 'resolved', error: null }
        : { state: 'unroutable', durationSeconds: null, distanceMeters: null, error: 'no_driving_route' }, 6 * 60 * 60000);
    }
  } catch (error) {
    for (const { record } of claimed) {
      await complete(MapRouteCache, record, { state: 'error', durationSeconds: null, distanceMeters: null, error: providerError(error) }, 5 * 60000);
    }
  }
}

async function readRoutes(origin, destinations) {
  const providers = getProviders();
  const keys = destinations.map(destination => routeKey(origin, destination, providers.routingId));
  const records = keys.length ? await MapRouteCache.find({ key: { $in: keys } }).lean() : [];
  const byKey = new Map(records.map(record => [record.key, record]));
  const missing = new Map();
  const results = keys.map((key, index) => {
    const record = byKey.get(key);
    if (fresh(record)) return {
      state: record.state, durationSeconds: record.durationSeconds, distanceMeters: record.distanceMeters, error: record.error,
    };
    missing.set(key, destinations[index]);
    return { state: providers.router ? 'pending' : 'disabled', durationSeconds: null, distanceMeters: null, error: providers.router ? null : 'provider_not_configured' };
  });
  if (providers.router) {
    const entries = [...missing.entries()];
    for (let index = 0; index < entries.length; index += providers.router.batchSize) {
      const batch = entries.slice(index, index + providers.router.batchSize);
      enqueue(`route:${batch.map(([key]) => key).join(':')}`, () => resolveRoutes(origin, batch.map(([, destination]) => destination), providers.router), true);
    }
  }
  return results;
}

async function invalidateAddresses(inputs, { session } = {}) {
  const keys = [...new Set(inputs.map(input => normalizeAddress(input || {})).filter(address => address.valid).map(address => address.normalizedKey))];
  if (!keys.length) return;
  await Geodata.updateMany({ normalizedKey: { $in: keys } }, { $set: {
    state: 'stale', coordinates: null, expiresAt: new Date(0), leaseUntil: new Date(0), leaseToken: null,
  } }, { session });
}

module.exports = { readAddresses, readRoutes, resolveAddress, invalidateAddresses };
