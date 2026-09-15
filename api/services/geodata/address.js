const { createHash } = require('node:crypto');

const clean = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();

function normalizeAddress(input = {}) {
  const street = clean(input.strasse || [input.street, input.houseNumber].filter(Boolean).join(' '));
  const postalCode = clean(input.plz || input.postalCode);
  const city = clean(input.ort || input.city);
  let country = clean(input.land || input.country || input.nat || 'Deutschland');
  if (/^(d|de|deu|germany|deutschland)$/i.test(country)) country = 'Deutschland';
  const formatted = street || postalCode || city
    ? [street, [postalCode, city].filter(Boolean).join(' '), country].filter(Boolean).join(', ') : '';
  // Never geocode empty/partial employee records to a country or city centroid.
  const valid = Boolean(street && (postalCode || city));
  const normalizedKey = createHash('sha256').update(JSON.stringify(
    [street, postalCode, city, country].map(part => part.toLocaleLowerCase('de-DE'))
  )).digest('hex');
  return { street, postalCode, city, country, formatted, normalizedKey, valid };
}

function hasAddress(input) {
  return Boolean(input && [input.strasse, input.plz, input.ort].some(value => clean(value)));
}

function coordinateKey(coordinates) {
  return `${coordinates.longitude.toFixed(6)},${coordinates.latitude.toFixed(6)}`;
}

module.exports = { normalizeAddress, hasAddress, coordinateKey };
