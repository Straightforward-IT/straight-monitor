const assert = require('node:assert/strict');
const Auftrag = require('../models/Event/Auftrag');
const router = require('../routes/customer/kundenRoutes');
const route = router.stack.find(layer => layer.route?.path === '/:kundenNr/auftragskalender').route;
const handler = route.stack[route.stack.length - 1].handle;

function request(params = {}, query = {}) {
  return new Promise((resolve, reject) => {
    let status = 200;
    handler({ params: { kundenNr: '2100009', ...params }, query: {
      von: '2026-08-31T22:00:00.000Z', bis: '2026-10-31T22:59:59.999Z', ...query,
    } }, { status(code) { status = code; return this; }, json(body) { resolve({ status, body }); } }, reject);
  });
}

describe('Customer order calendar', () => {
  it('scopes by customer and includes overlapping and single-day orders without requiring staff or active status', async () => {
    const original = Auftrag.find;
    let filter;
    const orders = [{ auftragNr: 123, eventTitel: 'Unstaffed order' }];
    Auftrag.find = value => { filter = value; return { select: () => ({ sort: () => ({ lean: async () => orders }) }) }; };
    try {
      const result = await request();
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, orders);
      assert.equal(filter.kundenNr, 2100009);
      assert.equal(filter.vonDatum.$lte.toISOString(), '2026-10-31T22:59:59.999Z');
      assert.equal(filter.$or[0].bisDatum.$gte.toISOString(), '2026-08-31T22:00:00.000Z');
      assert.equal(filter.$or[1].bisDatum, null);
      assert.equal(filter.$or[1].vonDatum.$gte.toISOString(), '2026-08-31T22:00:00.000Z');
      assert.equal(filter.aktiv, undefined);
      assert.equal(filter.mitarbeiter, undefined);
    } finally { Auftrag.find = original; }
  });

  it('rejects invalid customer numbers and missing, reversed or oversized date ranges before querying', async () => {
    const original = Auftrag.find;
    Auftrag.find = () => { throw new Error('Invalid input reached database'); };
    try {
      for (const kundenNr of ['abc', '1.5', '0']) assert.equal((await request({ kundenNr })).status, 400);
      for (const query of [{ von: undefined }, { bis: 'invalid' }, { bis: '2026-08-01' }, { bis: '2027-01-01' }]) {
        assert.equal((await request({}, query)).status, 400);
      }
    } finally { Auftrag.find = original; }
  });
});
