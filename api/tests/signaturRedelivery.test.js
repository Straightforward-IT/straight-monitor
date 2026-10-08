const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { PDFDocument } = require('pdf-lib');
const User = require('../models/System/User');
const SignaturVorgang = require('../models/Signature/SignaturVorgang');
const R2Service = require('../services/integrations/R2Service');
const EmailService = require('../services/integrations/EmailService');
const AsanaService = require('../services/integrations/AsanaService');
const DocuSealService = require('../services/integrations/DocuSealService');

describe('Signature email redelivery', function () {
  let server;
  let baseUrl;
  let originalSecret;
  let originalWebhookSecret;
  let originalRouteModule;
  let originals;
  let user;
  let vorgang;
  let archivedPdf;
  let mailCalls;
  let mailError;
  let saveCalls;
  let asanaCalls;
  let onMailSent;
  const id = '6ac64fcf7f3338ba92efe16e';
  const routePath = require.resolve('../routes/signature/signaturRoutes');

  before(async () => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'signature-redelivery-test-secret';
    originalWebhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;
    process.env.DOCUSEAL_WEBHOOK_SECRET = 'signature-webhook-test-secret';
    originals = {
      userFind: User.findById,
      vorgangFind: SignaturVorgang.findById,
      vorgangFindOne: SignaturVorgang.findOne,
      download: R2Service.downloadFile,
      sendMail: EmailService.sendMail,
      completeTask: AsanaService.completeTaskById,
      storeSigned: DocuSealService.storeSignedPdf,
      storeAudit: DocuSealService.storeAuditPdf,
    };
    User.findById = () => ({ select: async () => user });
    SignaturVorgang.findById = async () => vorgang;
    SignaturVorgang.findOne = async () => vorgang;
    DocuSealService.storeSignedPdf = async () => ({ key: 'test/signed.pdf' });
    DocuSealService.storeAuditPdf = async () => null;
    R2Service.downloadFile = async (key) => {
      assert.equal(key, 'test/signed.pdf');
      return archivedPdf;
    };
    EmailService.sendMail = async (...args) => {
      if (mailError) throw mailError;
      mailCalls.push(args);
      onMailSent();
    };
    AsanaService.completeTaskById = async () => { asanaCalls += 1; };
    originalRouteModule = require.cache[routePath];
    delete require.cache[routePath];
    const app = express();
    app.use(express.json());
    app.use('/api/signaturen', require(routePath));
    app.use(require('../middleware/ErrorHandler'));
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    user = { role: 'ADMIN' };
    mailCalls = [];
    mailError = null;
    saveCalls = [];
    asanaCalls = 0;
    onMailSent = () => {};
    const doc = await PDFDocument.create();
    for (let index = 0; index < 3; index += 1) doc.addPage([300 + index, 500]);
    archivedPdf = Buffer.from(await doc.save());
    vorgang = new SignaturVorgang({
      _id: id,
      name: 'Test-Stundenliste',
      fileName: 'Stundenliste.pdf',
      typKey: 'stundenliste',
      status: 'completed',
      stundenlisteDoppelausfertigung: true,
      r2KeySigned: 'test/signed.pdf',
      r2Prefix: 'Signatures/hh/kunden/test/stundenliste',
      submitters: [{ email: 'signer@example.test', name: 'Signer' }],
      folgeaktionen: {
        ausliefernAn: [
          { email: ' DELIVERY@example.test ' },
          { email: 'delivery@example.test' },
        ],
        ausliefernAnSignierer: true,
        asanaActions: [{ type: 'complete', taskGid: 'test-task' }],
      },
    });
    vorgang.save = async () => {
      saveCalls.push([...vorgang.stundenlisteCopyPageCounts]);
      return vorgang;
    };
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    User.findById = originals.userFind;
    SignaturVorgang.findById = originals.vorgangFind;
    SignaturVorgang.findOne = originals.vorgangFindOne;
    R2Service.downloadFile = originals.download;
    EmailService.sendMail = originals.sendMail;
    AsanaService.completeTaskById = originals.completeTask;
    DocuSealService.storeSignedPdf = originals.storeSigned;
    DocuSealService.storeAuditPdf = originals.storeAudit;
    delete require.cache[routePath];
    if (originalRouteModule) require.cache[routePath] = originalRouteModule;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalWebhookSecret === undefined) delete process.env.DOCUSEAL_WEBHOOK_SECRET;
    else process.env.DOCUSEAL_WEBHOOK_SECRET = originalWebhookSecret;
  });

  async function request(body, { recordId = id, authenticated = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authenticated) {
      headers['x-auth-token'] = jwt.sign({ user: { id: 'test-admin' } }, process.env.JWT_SECRET);
    }
    const response = await fetch(`${baseUrl}/api/signaturen/${recordId}/redeliver`, {
      method: 'POST',
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }

  it('persists a verified legacy boundary and sends two exact attachments without repeating Asana', async () => {
    const result = await request({ copyPageCounts: [2, 1] });
    assert.equal(result.status, 200);
    assert.deepEqual(saveCalls, [[2, 1]]);
    assert.equal(mailCalls.length, 1);
    assert.deepEqual(mailCalls[0][0], ['delivery@example.test', 'signer@example.test']);
    const attachments = mailCalls[0][4];
    assert.deepEqual(attachments.map(({ name }) => name), ['Stundenliste-Signiert.pdf', 'Stundenliste-Unsigniert.pdf']);
    const documents = await Promise.all(attachments.map(({ content }) =>
      PDFDocument.load(Buffer.from(content, 'base64'))
    ));
    assert.deepEqual(documents.map((doc) => doc.getPages().map((page) => page.getWidth())), [[300, 301], [302]]);
    assert.equal(asanaCalls, 0);
  });

  it('uses persisted counts without requiring a request body', async () => {
    vorgang.stundenlisteCopyPageCounts = [2, 1];
    user = { roles: ['ADMIN'] };
    assert.equal((await request()).status, 200);
    assert.equal(mailCalls.length, 1);
    assert.deepEqual(saveCalls, []);
  });

  it('automatically delivers a three-page double copy after submission.completed', async () => {
    vorgang.status = 'open';
    vorgang.submissionId = 1797530;
    vorgang.stundenlisteCopyPageCounts = [2, 1];
    const sent = new Promise((resolve) => { onMailSent = resolve; });
    const response = await fetch(`${baseUrl}/api/signaturen/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Docuseal-Secret': process.env.DOCUSEAL_WEBHOOK_SECRET,
      },
      body: JSON.stringify({ event_type: 'submission.completed', data: { id: 1797530 } }),
    });
    assert.equal(response.status, 200);
    await sent;
    assert.equal(vorgang.status, 'completed');
    assert.deepEqual(saveCalls, [[2, 1]]);
    const documents = await Promise.all(mailCalls[0][4].map(({ content }) =>
      PDFDocument.load(Buffer.from(content, 'base64'))
    ));
    assert.deepEqual(documents.map((doc) => doc.getPageCount()), [2, 1]);
    assert.equal(asanaCalls, 1);
  });

  it('rejects ambiguous or incorrect counts before persistence and delivery', async () => {
    for (const body of [undefined, { copyPageCounts: [1, 1] }]) {
      assert.equal((await request(body)).status, 409);
    }
    for (const counts of [[0, 3], [1.5, 1.5], ['2', 1], [3], null]) {
      assert.equal((await request({ copyPageCounts: counts })).status, 400);
    }
    assert.deepEqual(saveCalls, []);
    assert.deepEqual(mailCalls, []);
    assert.equal(asanaCalls, 0);
  });

  it('requires authentication and ADMIN access', async () => {
    assert.equal((await request({ copyPageCounts: [2, 1] }, { authenticated: false })).status, 401);
    user = { role: 'USER' };
    assert.equal((await request({ copyPageCounts: [2, 1] })).status, 403);
    assert.deepEqual(mailCalls, []);
  });

  it('rejects invalid IDs, absent records and unfinished or unavailable documents', async () => {
    assert.equal((await request({}, { recordId: 'invalid' })).status, 400);
    vorgang.status = 'open';
    assert.equal((await request({ copyPageCounts: [2, 1] })).status, 409);
    vorgang.status = 'completed';
    vorgang.r2KeySigned = '';
    assert.equal((await request({ copyPageCounts: [2, 1] })).status, 409);
    vorgang = null;
    assert.equal((await request({ copyPageCounts: [2, 1] })).status, 404);
    assert.deepEqual(mailCalls, []);
  });

  it('rejects delivery without recipients', async () => {
    vorgang.folgeaktionen.ausliefernAn = [];
    vorgang.folgeaktionen.ausliefernAnSignierer = false;
    assert.equal((await request({ copyPageCounts: [2, 1] })).status, 409);
    assert.deepEqual(saveCalls, []);
    assert.deepEqual(mailCalls, []);
  });

  it('honors signer opt-out and returns mail failures instead of reporting success', async () => {
    vorgang.folgeaktionen.ausliefernAnSignierer = false;
    vorgang.stundenlisteCopyPageCounts = [2, 1];
    assert.equal((await request()).status, 200);
    assert.deepEqual(mailCalls[0][0], ['delivery@example.test']);
    mailError = new Error('Test mail failure');
    const failed = await request({ copyPageCounts: [2, 1] });
    assert.equal(failed.status, 500);
    assert.equal(failed.body.message, 'Test mail failure');
    assert.deepEqual(saveCalls, [[2, 1]]);
    assert.equal(asanaCalls, 0);
  });
});
