const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Location = require('../models/System/Location');
const User = require('../models/System/User');
const router = require('../routes/system/locationRoutes');

const officeId = '17e0c1c5-6b27-4bac-b0df-93711b993e64';
const locationId = '507f1f77bcf86cd799439011';
const request = (method, body, token) => new Promise((resolve, reject) => {
  const req = { body, params: { id: locationId }, header: () => token };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { resolve({ status: this.statusCode, data }); },
  };
  const handlers = router.stack.find(layer => layer.route?.methods[method]).route.stack;
  let index = 0;
  const next = error => error ? reject(error) : handlers[index++].handle(req, res, next);
  next();
});

describe('Location Flip office account', () => {
  let originals, secret, token, location, created, admin;
  beforeEach(() => {
    originals = { findById: Location.findById, findOne: Location.findOne, create: Location.create, userFindById: User.findById };
    secret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'location-flip-office-test';
    token = jwt.sign({ user: { id: locationId } }, process.env.JWT_SECRET);
    admin = true;
    User.findById = () => ({ select: () => ({ lean: async () => ({ roles: admin ? ['ADMIN'] : ['USER'] }) }) });
    Location.findOne = async () => null;
    location = new Location({ _id: locationId, nameFull: 'Hamburg', shortName: 'HH', flipOfficeUserId: officeId });
    location.save = async () => { await location.validate(); return location; };
    location.populate = async () => location;
    Location.findById = async () => location;
    Location.create = async payload => {
      created = new Location(payload);
      await created.validate();
      created.populate = async () => created;
      return created;
    };
  });
  afterEach(() => {
    Location.findById = originals.findById;
    Location.findOne = originals.findOne;
    Location.create = originals.create;
    User.findById = originals.userFindById;
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  });

  it('defaults to unconfigured, trims UUIDs and rejects malformed IDs', async () => {
    const doc = new Location({ nameFull: 'Test', shortName: 'T' });
    await doc.validate();
    assert.equal(doc.flipOfficeUserId, '');
    doc.flipOfficeUserId = ` ${officeId} `;
    await doc.validate();
    assert.equal(doc.flipOfficeUserId, officeId);
    doc.flipOfficeUserId = 'not-a-uuid';
    await assert.rejects(doc.validate(), /UUID/);
  });

  it('persists the office account on create', async () => {
    const result = await request('post', { nameFull: 'Hamburg', shortName: 'HH', flipOfficeUserId: officeId }, token);
    assert.equal(result.status, 201);
    assert.equal(created.flipOfficeUserId, officeId);
  });

  it('updates, preserves on unrelated edits, and explicitly clears the office account', async () => {
    const replacement = '4c10c6b2-4c08-4334-abf3-31f55d7529df';
    const names = { nameFull: 'Hamburg', shortName: 'HH' };
    assert.equal((await request('patch', { ...names, flipOfficeUserId: replacement }, token)).status, 200);
    assert.equal(location.flipOfficeUserId, replacement);
    await request('patch', { ...names, color: '#ffffff' }, token);
    assert.equal(location.flipOfficeUserId, replacement);
    await request('patch', { ...names, flipOfficeUserId: '' }, token);
    assert.equal(location.flipOfficeUserId, '');
  });

  it('rejects invalid IDs as HTTP 400 for both create and update', async () => {
    for (const method of ['post', 'patch']) {
      for (const value of ['invalid', null, 123, ['invalid']]) {
        const result = await request(method, { nameFull: 'Hamburg', shortName: 'HH', flipOfficeUserId: value }, token);
        assert.equal(result.status, 400);
        assert.match(result.data.message, /UUID/);
      }
    }
    assert.equal(location.flipOfficeUserId, officeId);
  });

  it('restricts changes to admins and requires authentication', async () => {
    const body = { nameFull: 'Hamburg', shortName: 'HH', flipOfficeUserId: officeId };
    assert.equal((await request('patch', body)).status, 401);
    admin = false;
    assert.equal((await request('patch', body, token)).status, 403);
  });
});
