const axios = require('axios');
const { coordinateKey } = require('./address');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let requestTail = Promise.resolve();
let nextRequestAt = 0;

function safeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// One provider request at a time per process, including retries. Never propagate
// Axios errors: they contain residential addresses, coordinates and the token.
function request(path, params) {
  const run = requestTail.then(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await sleep(Math.max(0, nextRequestAt - Date.now()));
      const interval = Number(process.env.MAP_REQUEST_INTERVAL_MS);
      nextRequestAt = Date.now() + (Number.isFinite(interval) && interval >= 100 ? Math.min(interval, 10000) : 1100);
      try {
        const { data } = await axios.get(`https://api.mapbox.com/${path}`, {
          params: { ...params, access_token: process.env.MAPBOX_ACCESS_TOKEN },
          timeout: 10000,
          maxRedirects: 0,
        });
        return data;
      } catch (error) {
        const status = error.response?.status;
        const transient = !status || status === 429 || status >= 500;
        if (!transient || attempt === 2) {
          throw safeError(status === 401 || status === 403 ? 'provider_credentials' : transient ? 'provider_unavailable' : 'provider_request');
        }
        const retryAfter = Math.min(30, Math.max(0, Number(error.response?.headers?.['retry-after']) || 0));
        nextRequestAt = Math.max(nextRequestAt, Date.now() + Math.max(retryAfter * 1000, 1000 * (2 ** attempt)));
      }
    }
  });
  requestTail = run.catch(() => {});
  return run;
}

module.exports = {
  geocodingId: 'mapbox-permanent-v6',
  routingId: 'mapbox-driving-v1',
  batchSize: 24,
  async geocode(address) {
    const data = await request('search/geocode/v6/forward', {
      address_line1: address.street,
      postcode: address.postalCode || undefined,
      place: address.city || undefined,
      country: address.country === 'Deutschland' ? 'de' : address.country,
      permanent: true,
      autocomplete: false,
      types: 'address',
      language: 'de',
      limit: 1,
    });
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])
      || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90
      || feature?.properties?.match_code?.confidence === 'low') return null;
    return {
      coordinates: { longitude: coordinates[0], latitude: coordinates[1] },
      providerId: feature.properties?.mapbox_id || feature.id || '',
      accuracy: feature.properties?.coordinates?.accuracy || 'address',
      attribution: data.attribution || '© Mapbox',
    };
  },
  // A matrix supplies independent fastest driving routes from the selected site
  // to every home. A multi-waypoint Directions call would route via other homes.
  async routesFrom(origin, destinations) {
    const coordinates = [origin, ...destinations].map(coordinateKey).join(';');
    const data = await request(`directions-matrix/v1/mapbox/driving/${coordinates}`, {
      sources: '0',
      destinations: destinations.map((_, index) => index + 1).join(';'),
      annotations: 'duration,distance',
    });
    if (data.code !== 'Ok' || !Array.isArray(data.durations?.[0]) || !Array.isArray(data.distances?.[0])) {
      throw safeError('provider_request');
    }
    return destinations.map((_, index) => {
      const durationSeconds = data.durations[0][index];
      const distanceMeters = data.distances[0][index];
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || !Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
      return { durationSeconds, distanceMeters };
    });
  },
};
