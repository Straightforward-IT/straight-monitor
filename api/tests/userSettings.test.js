const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/System/User');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

describe('User settings', function () {
  this.timeout(120000);
  let mongo;
  let server;
  let baseUrl;
  let user;
  let previousSecret;

  async function request(path, { method = 'GET', body } = {}) {
    const token = jwt.sign({ user: { id: String(user._id) } }, process.env.JWT_SECRET);
    const response = await fetch(`${baseUrl}/api/users${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri('user_settings_test'));
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'user-settings-isolated-test';

    const app = express();
    app.use(express.json());
    app.use('/api/users', require('../routes/auth/userRoutes'));
    app.use((error, req, res, next) => {
      if (res.headersSent) return next(error);
      return res.status(error.statusCode || 500).json({ msg: error.message });
    });
    server = await new Promise((resolve) => {
      const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    await User.deleteMany({});
    user = await User.create({
      name: 'Settings User',
      email: 'settings@straightforward.email',
      password: 'current-password',
      role: 'USER',
      roles: ['USER'],
      isConfirmed: true,
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('defaults to first-last and formats employee names in both supported orders', () => {
    assert.equal(user.preferences.display.employeeNameFormat, 'first-last');
    const employee = new Mitarbeiter({ vorname: ' Anna ', nachname: ' Beispiel ' });
    assert.equal(employee.formatName(), 'Anna Beispiel');
    assert.equal(employee.formatName('last-first'), 'Beispiel, Anna');
  });

  it('normalizes the removed lime accent to orange', async () => {
    user.preferences.appearance.accentColor = 'lime';
    await user.validate();
    assert.equal(user.preferences.appearance.accentColor, 'orange');
  });

  it('merges allowlisted preference sections without deleting siblings', async () => {
    const theme = await request('/me/preferences', {
      method: 'PATCH',
      body: { preferences: { appearance: { theme: 'dark' } } },
    });
    assert.equal(theme.status, 200);
    assert.equal(theme.body.preferences.appearance.theme, 'dark');
    assert.equal(theme.body.preferences.appearance.accentColor, 'orange');
    assert.equal(theme.body.preferences.display.employeeNameFormat, 'first-last');

    const accent = await request('/me/preferences', {
      method: 'PATCH',
      body: { preferences: { appearance: { accentColor: 'baby-blue' } } },
    });
    assert.equal(accent.status, 200);
    assert.equal(accent.body.preferences.appearance.theme, 'dark');
    assert.equal(accent.body.preferences.appearance.accentColor, 'baby-blue');

    const blackAccent = await request('/me/preferences', {
      method: 'PATCH',
      body: { preferences: { appearance: { accentColor: 'ac-dc' } } },
    });
    assert.equal(blackAccent.status, 200);
    assert.equal(blackAccent.body.preferences.appearance.accentColor, 'ac-dc');

    const display = await request('/me/preferences', {
      method: 'PATCH',
      body: { preferences: { display: { employeeNameFormat: 'last-first' } } },
    });
    assert.equal(display.status, 200);
    assert.equal(display.body.preferences.appearance.theme, 'dark');
    assert.equal(display.body.preferences.display.employeeNameFormat, 'last-first');

    const invalid = await request('/me/preferences', {
      method: 'PATCH',
      body: { preferences: { display: { employeeNameFormat: 'surname-only' } } },
    });
    assert.equal(invalid.status, 400);

    const invalidAccent = await request('/me/preferences', {
      method: 'PATCH',
      body: { preferences: { appearance: { accentColor: 'lime' } } },
    });
    assert.equal(invalidAccent.status, 400);
  });

  it('updates only the self-service display name and never returns a password', async () => {
    const response = await request('/me/profile', {
      method: 'PATCH',
      body: { name: '  Neuer Name  ', roles: ['ADMIN'], email: 'other@example.test' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.name, 'Neuer Name');
    assert.equal(response.body.user.password, undefined);

    const saved = await User.findById(user._id);
    assert.equal(saved.name, 'Neuer Name');
    assert.deepEqual(saved.roles, ['USER']);
    assert.equal(saved.email, 'settings@straightforward.email');
  });

  it('requires the current password and hashes the replacement exactly once', async () => {
    const rejected = await request('/me/password', {
      method: 'PUT',
      body: { currentPassword: 'wrong-password', newPassword: 'replacement-password' },
    });
    assert.equal(rejected.status, 400);

    const accepted = await request('/me/password', {
      method: 'PUT',
      body: { currentPassword: 'current-password', newPassword: 'replacement-password' },
    });
    assert.equal(accepted.status, 200);

    const saved = await User.findById(user._id);
    assert.equal(await saved.comparePassword('current-password'), false);
    assert.equal(await saved.comparePassword('replacement-password'), true);
    assert.notEqual(saved.password, 'replacement-password');
  });

  it('rejects malformed dashboard and disposition preference payloads', async () => {
    const dashboard = await request('/me/dashboard-prefs', {
      method: 'PUT',
      body: { prefs: [{ id: 'jobs', visible: true }, { id: 'jobs', visible: false }] },
    });
    assert.equal(dashboard.status, 400);

    const disposition = await request('/me/dispo-prefs', {
      method: 'PUT',
      body: { prefs: [] },
    });
    assert.equal(disposition.status, 400);
  });
});