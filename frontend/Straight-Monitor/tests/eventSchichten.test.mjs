import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEventSchichten } from '../src/utils/eventSchichten.js';

test('calendar preserves persisted wall-clock times across host timezones and DST', () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'Europe/Berlin', 'America/Los_Angeles']) {
      process.env.TZ = timezone;
      for (const day of ['2026-09-30', '2026-10-01', '2026-10-26']) {
        for (const source of ['zvoove', 'monitor']) {
          const [shift] = buildEventSchichten({
            schichten: [{ idAuftragArbeitsschichten: 7, datumVon: `${day}T00:00:00Z`, source,
              uhrzeitVon: '10:00', uhrzeitBis: '18:00', treffpunkt: '09:45' }],
            einsaetze: [{ idAuftragArbeitsschichten: 7, uhrzeitVon: '10:00', uhrzeitBis: '18:00' }],
          });
          assert.equal(shift.meta.uhrzeitVon, '10:00');
          assert.equal(shift.meta.uhrzeitBis, '18:00');
          assert.equal(shift.meta.treffpunkt, '09:45');
        }
      }
      const [legacyShift] = buildEventSchichten({
        einsaetze: [{ idAuftragArbeitsschichten: 8, uhrzeitVon: '10:00', uhrzeitBis: '18:00' }],
      });
      assert.equal(legacyShift.meta.uhrzeitVon, '10:00');
      assert.equal(legacyShift.meta.uhrzeitBis, '18:00');
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});
