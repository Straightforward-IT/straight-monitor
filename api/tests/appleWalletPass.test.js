const assert = require('node:assert/strict');
const forge = require('node-forge');
const JSZip = require('jszip');
const {
  generateWalletPass,
  normalizePayload,
  resetCachesForTests,
} = require('../services/integrations/AppleWalletPassService');

const ENV_NAMES = [
  'APPLE_WALLET_LOGO_PATH',
  'APPLE_WALLET_ORGANIZATION_NAME',
  'APPLE_WALLET_P12_BASE64',
  'APPLE_WALLET_P12_PASSWORD',
  'APPLE_WALLET_P12_PATH',
  'APPLE_WALLET_PASS_TYPE_ID',
  'APPLE_WALLET_TEAM_ID',
  'APPLE_WALLET_WWDR_BASE64',
  'APPLE_WALLET_WWDR_PATH',
];

function certificate({ publicKey, signingKey, issuer, commonName, serialNumber, isCa = false }) {
  const result = forge.pki.createCertificate();
  result.publicKey = publicKey;
  result.serialNumber = serialNumber;
  result.validity.notBefore = new Date(Date.now() - 60_000);
  result.validity.notAfter = new Date(Date.now() + 86_400_000);
  result.setSubject([{ name: 'commonName', value: commonName }]);
  result.setIssuer(issuer ? issuer.subject.attributes : result.subject.attributes);
  result.setExtensions([
    { name: 'basicConstraints', cA: isCa },
    { name: 'keyUsage', digitalSignature: true, keyCertSign: isCa },
  ]);
  result.sign(signingKey, forge.md.sha256.create());
  return result;
}

function configureTestCertificates() {
  const wwdrKeys = forge.pki.rsa.generateKeyPair(1024);
  const wwdr = certificate({
    publicKey: wwdrKeys.publicKey,
    signingKey: wwdrKeys.privateKey,
    commonName: 'Apple Worldwide Developer Relations Certification Authority - G4 Test',
    serialNumber: '01',
    isCa: true,
  });
  const signerKeys = forge.pki.rsa.generateKeyPair(1024);
  const signer = certificate({
    publicKey: signerKeys.publicKey,
    signingKey: wwdrKeys.privateKey,
    issuer: wwdr,
    commonName: 'Pass Type ID: pass.de.straightforward.auftraege',
    serialNumber: '02',
  });
  const password = 'test-password';
  const p12 = forge.pkcs12.toPkcs12Asn1(signerKeys.privateKey, signer, password, {
    algorithm: '3des',
    friendlyName: 'Wallet pass test',
  });

  process.env.APPLE_WALLET_P12_BASE64 = Buffer.from(
    forge.asn1.toDer(p12).getBytes(),
    'binary',
  ).toString('base64');
  process.env.APPLE_WALLET_P12_PASSWORD = password;
  process.env.APPLE_WALLET_WWDR_BASE64 = Buffer.from(
    forge.pki.certificateToPem(wwdr),
  ).toString('base64');
  process.env.APPLE_WALLET_PASS_TYPE_ID = 'pass.de.straightforward.auftraege';
  process.env.APPLE_WALLET_TEAM_ID = 'P675J3K7M9';
}

describe('AppleWalletPassService', function () {
  this.timeout(10_000);
  let originalEnvironment;

  beforeEach(() => {
    originalEnvironment = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));
    ENV_NAMES.forEach((name) => delete process.env[name]);
    resetCachesForTests();
  });

  afterEach(() => {
    ENV_NAMES.forEach((name) => {
      const original = originalEnvironment[name];
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    });
    resetCachesForTests();
  });

  it('validates required pass data before loading certificates', () => {
    assert.throws(
      () => normalizePayload({ serialNumber: 'auftrag-1' }),
      /title ist erforderlich/,
    );
    assert.throws(
      () => normalizePayload({ serialNumber: 'auftrag-1', title: 'Test', backgroundColor: 'red' }),
      /backgroundColor muss/,
    );
  });

  it('creates a signed pkpass archive from PKCS#12 configuration', async () => {
    configureTestCertificates();

    const generated = await generateWalletPass({
      serialNumber: 'auftrag-4711',
      title: 'Messe Hamburg',
      subtitle: 'Auftrag 4711',
      startDate: '2026-09-21T12:00:00+02:00',
      location: 'Hamburg',
      barcode: 'auftrag:4711',
    });
    const archive = await JSZip.loadAsync(generated.buffer);
    const passJson = JSON.parse(await archive.file('pass.json').async('string'));

    assert.equal(generated.filename, 'auftrag-4711.pkpass');
    assert.equal(generated.mimeType, 'application/vnd.apple.pkpass');
    assert.equal(passJson.passTypeIdentifier, 'pass.de.straightforward.auftraege');
    assert.equal(passJson.teamIdentifier, 'P675J3K7M9');
    assert.equal(passJson.serialNumber, 'auftrag-4711');
    assert.equal(passJson.logoText, undefined);
    assert.equal(passJson.generic.primaryFields[0].value, 'Messe Hamburg');
    assert.ok(archive.file('manifest.json'));
    assert.ok(archive.file('signature'));
    assert.ok(archive.file('icon@3x.png'));
    assert.ok(archive.file('logo@3x.png'));
    assert.equal(archive.file('strip.png'), null);
  });
});
