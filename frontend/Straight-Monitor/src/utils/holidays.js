/**
 * German public holidays utility
 * Data source: feiertage-api.de (free, CORS-enabled, no API key required)
 *
 * loadHolidaysForYear(year) → Map<'YYYY-MM-DD', HolidayEntry>
 *
 * HolidayEntry: { name: string, states: string[], isNational: boolean, hinweis: string }
 *   - states: all Bundesland codes where the holiday applies
 *   - isNational: true if all 16 states observe it
 */

const ALL_STATES = ['BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH'];

// Module-level cache: year → Map<dateStr, HolidayEntry>
const yearCache = new Map();

/**
 * Parse the raw API response into a date-keyed lookup Map.
 * The API returns { BW: { "Holiday Name": { datum, hinweis }, ... }, BY: { ... }, ... }
 */
function buildLookup(data) {
  const lookup = new Map();

  for (const state of ALL_STATES) {
    const stateHolidays = data[state];
    if (!stateHolidays || typeof stateHolidays !== 'object') continue;

    for (const [name, info] of Object.entries(stateHolidays)) {
      const datum = info?.datum;
      if (!datum) continue;

      if (!lookup.has(datum)) {
        lookup.set(datum, {
          name,
          states: [],
          isNational: false,
          hinweis: info.hinweis || '',
        });
      }

      const entry = lookup.get(datum);
      if (!entry.states.includes(state)) {
        entry.states.push(state);
      }
    }
  }

  // Mark as national if all 16 states observe it
  for (const entry of lookup.values()) {
    entry.isNational = entry.states.length === ALL_STATES.length;
  }

  return lookup;
}

/**
 * Load and cache holidays for a given year.
 * Returns a Map<'YYYY-MM-DD', HolidayEntry>.
 * Returns an empty Map on network failure (silently degrades).
 */
export async function loadHolidaysForYear(year) {
  if (yearCache.has(year)) return yearCache.get(year);

  try {
    const res = await fetch(`https://feiertage-api.de/api/?jahr=${year}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lookup = buildLookup(data);
    yearCache.set(year, lookup);
    return lookup;
  } catch (err) {
    console.warn(`[holidays] Could not load holidays for ${year}:`, err);
    // Cache empty Map so we don't retry repeatedly on the same year
    const empty = new Map();
    yearCache.set(year, empty);
    return empty;
  }
}
