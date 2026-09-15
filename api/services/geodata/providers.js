const mapbox = require('./MapboxProvider');

// Provider selection lives here; map routes and UI never receive API tokens.
function getProviders() {
  const enabled = process.env.MAP_EXTERNAL_PROCESSING_ENABLED === 'true';
  const token = Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());
  const geocoderName = process.env.MAP_GEOCODING_PROVIDER || 'mapbox';
  const routingName = process.env.MAP_ROUTING_PROVIDER || 'mapbox';
  const geocoder = enabled && token && geocoderName === 'mapbox' ? mapbox : null;
  const router = enabled && token && routingName === 'mapbox' ? mapbox : null;
  return {
    geocoder, router,
    geocodingId: geocoderName === 'mapbox' ? mapbox.geocodingId : geocoderName,
    routingId: routingName === 'mapbox' ? mapbox.routingId : routingName,
  };
}

module.exports = { getProviders };
