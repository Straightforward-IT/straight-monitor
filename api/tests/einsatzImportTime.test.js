const assert = require('node:assert/strict');
const path = require('node:path');
const XLSX = require('xlsx');
const Auftrag = require('../models/Event/Auftrag');
const Kunde = require('../models/Customer/Kunde');
const Schicht = require('../models/Event/Schicht');
const Einsatz = require('../models/Event/Einsatz');
const Location = require('../models/System/Location');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');
const ImportLog = require('../models/System/ImportLog');
const EmailService = require('../services/integrations/EmailService');

function importHandler() {
  const routerPath = require.resolve('../routes/system/dataImportRoutes');
  const originalRouter = require.cache[routerPath];
  const originalSendMail = EmailService.sendMail;
  try {
    delete require.cache[routerPath];
    EmailService.sendMail = async () => {};
    const router = require(routerPath);
    return router.stack.find(layer => layer.route?.path === '/einsatz').route.stack.at(-1).handle;
  } finally {
    EmailService.sendMail = originalSendMail;
    delete require.cache[routerPath];
    if (originalRouter) require.cache[routerPath] = originalRouter;
  }
}

describe('Einsatz import wall-clock persistence', () => {
  const handler = importHandler();
  const originals = [];
  let captured;
  let timezone;

  function stub(model, method, implementation) {
    originals.push([model, method, model[method]]);
    model[method] = implementation;
  }

  beforeEach(() => {
    timezone = process.env.TZ;
    captured = {};
    stub(Auftrag, 'distinct', async () => [999]);
    stub(Auftrag, 'updateMany', async () => ({ modifiedCount: 0 }));
    stub(Auftrag, 'bulkWrite', async () => ({ matchedCount: 1, upsertedCount: 0 }));
    stub(Kunde, 'bulkWrite', async () => ({ matchedCount: 1, upsertedCount: 0 }));
    stub(Location, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
    stub(Mitarbeiter, 'find', () => ({ lean: async () => [] }));
    stub(ImportLog, 'create', async () => {});
    for (const [model, key] of [[Schicht, 'schicht'], [Einsatz, 'einsatz']]) {
      stub(model, 'deleteMany', async filter => {
        if (filter.auftragNr.$in) captured[`${key}Filter`] = filter;
        return { deletedCount: 1 };
      });
      stub(model, 'insertMany', async rows => {
        captured[key] = rows;
        return rows;
      });
    }
  });

  afterEach(() => {
    for (const [model, method, original] of originals.splice(0)) model[method] = original;
    if (timezone === undefined) delete process.env.TZ;
    else process.env.TZ = timezone;
  });

  it('stores 10–18 unchanged and replaces legacy dates on both boundaries of the imported period', async () => {
    const fixture = XLSX.readFile(path.join(__dirname, '../assets/Einsatz.xlsx'));
    const headers = XLSX.utils.sheet_to_json(fixture.Sheets[fixture.SheetNames[0]], { header: 1 })[0];
    if (!headers.includes('REFERENZ')) headers.splice(headers.indexOf('ID_AUFTRAG_ARBEITSSCHICHTEN'), 0, 'REFERENZ');
    const daySerial = day => (Date.parse(`${day}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
    const rows = ['2026-09-01', '2026-10-26'].map(day => {
      const value = {
        CODE: 7001, IST_PSEUDO: 0, AUFTRAGNR: 123, PERSONALNR: 456,
        ID_AUFTRAG_ARBEITSSCHICHTEN: 7, DATUMVON: daySerial(day), DATUMBIS: daySerial(day),
        DETAIL_DATUMVON: daySerial(day), DETAIL_DATUMBIS: daySerial(day),
        VONDATUM: daySerial(day), BISDATUM: daySerial(day),
        UHRZEITVON: 10 / 24, UHRZEITBIS: 18 / 24, TREFFPUNKTUHRZEIT: 9.75 / 24,
      };
      return headers.map(header => value[header] ?? null);
    });
    // A manually managed order present in the export must not be overwritten.
    rows.push(headers.map(header => ({ CODE: 7001, AUFTRAGNR: 999 })[header] ?? null));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Einsatz');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    for (const timezone of ['UTC', 'Europe/Berlin', 'America/Los_Angeles']) {
      process.env.TZ = timezone;
      let response;
      await handler({
        file: { buffer, originalname: 'test.xlsx' },
        body: { excelColumnCount: headers.length },
      }, {
        status(code) { this.code = code; return this; },
        json(body) { response = body; },
      });
      assert.equal(response.success, true, JSON.stringify(response));
      for (const key of ['schicht', 'einsatz']) {
        assert.equal(captured[key].length, 2);
        for (const row of captured[key]) {
          assert.equal(row.uhrzeitVon, '10:00');
          assert.equal(row.uhrzeitBis, '18:00');
          assert.equal(row.treffpunkt, '09:45');
        }
        const filter = captured[`${key}Filter`];
        assert.deepEqual(filter.auftragNr.$in, [123]);
        assert.deepEqual(filter.source, { $ne: 'monitor' });
        assert.equal(filter.datumVon.$gte.toISOString(), '2026-08-31T22:00:00.000Z');
        assert.equal(filter.datumVon.$lte.toISOString(), '2026-10-26T22:59:59.999Z');
        for (const existingDate of ['2026-08-31T22:00:00Z', '2026-09-01T00:00:00Z', '2026-10-25T23:00:00Z', '2026-10-26T00:00:00Z']) {
          assert.ok(new Date(existingDate) >= filter.datumVon.$gte);
          assert.ok(new Date(existingDate) <= filter.datumVon.$lte);
        }
      }
    }
  });
});
