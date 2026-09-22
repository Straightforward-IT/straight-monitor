const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const sharp = require('sharp');
const { PKPass } = require('passkit-generator');

const API_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_STRIP_LOGO_PATH = path.join(API_ROOT, 'assets/straightforward-logo-white.png');
const PASS_MIME_TYPE = 'application/vnd.apple.pkpass';
const BARCODE_FORMATS = new Set([
  'PKBarcodeFormatQR',
  'PKBarcodeFormatPDF417',
  'PKBarcodeFormatAztec',
  'PKBarcodeFormatCode128',
]);
const COLOR_PATTERN = /^(?:#[a-f\d]{3}(?:[a-f\d]{3})?|rgb\(\s*(?:[01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d?\d|2[0-4]\d|25[0-5])\s*\))$/i;

let signingCredentialsCache;
let passAssetsCache;

class WalletPassError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'WalletPassError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validationError(message) {
  return new WalletPassError(message, 400, 'WALLET_PASS_INVALID_INPUT');
}

function configurationError(message) {
  return new WalletPassError(message, 503, 'WALLET_PASS_NOT_CONFIGURED');
}

async function buildHeaderLogo(logoSource, width, height) {
  const logo = await sharp(logoSource)
    .resize(Math.round(width * 0.7), Math.round(height * 0.84), { fit: 'contain' })
    .png()
    .toBuffer();
  const metadata = await sharp(logo).metadata();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: logo,
      left: Math.round((width - metadata.width) / 2),
      top: Math.round((height - metadata.height) / 2),
    }])
    .png()
    .toBuffer();
}

function requiredText(value, label, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) throw validationError(`${label} ist erforderlich.`);
  if (normalized.length > maxLength) {
    throw validationError(`${label} darf höchstens ${maxLength} Zeichen lang sein.`);
  }
  return normalized;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) {
    throw validationError(`${label} darf höchstens ${maxLength} Zeichen lang sein.`);
  }
  return normalized;
}

function optionalIsoDate(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw validationError(`${label} ist kein gültiges Datum.`);
  return parsed.toISOString();
}

function optionalColor(value, label, fallback) {
  const normalized = optionalText(value, label, 64);
  if (!normalized) return fallback;
  if (!COLOR_PATTERN.test(normalized)) {
    throw validationError(`${label} muss als #RRGGBB oder rgb(r, g, b) angegeben werden.`);
  }
  return normalized;
}

function normalizeBarcode(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const input = typeof value === 'string' ? { message: value } : value;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('barcode muss eine Zeichenkette oder ein Objekt sein.');
  }

  const message = requiredText(input.message, 'barcode.message', 512);
  const format = input.format || 'PKBarcodeFormatQR';
  const altText = optionalText(input.altText, 'barcode.altText', 128);
  if (!BARCODE_FORMATS.has(format)) throw validationError('Unbekanntes Barcode-Format.');

  return {
    format,
    message,
    messageEncoding: 'utf-8',
    ...(altText && { altText }),
  };
}

function normalizePayload(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Der Request-Body muss ein JSON-Objekt sein.');
  }

  const serialNumber = requiredText(input.serialNumber, 'serialNumber', 128);
  const title = requiredText(input.title, 'title', 120);
  const startDate = optionalIsoDate(input.startDate, 'startDate');
  const expirationDate = optionalIsoDate(input.expirationDate, 'expirationDate');

  return {
    serialNumber,
    title,
    subtitle: optionalText(input.subtitle, 'subtitle', 160),
    location: optionalText(input.location, 'location', 240),
    notes: optionalText(input.notes, 'notes', 2000),
    reference: optionalText(input.reference, 'reference', 80),
    description: optionalText(input.description, 'description', 160) || 'Straight Monitor Auftrag',
    logoText: optionalText(input.logoText, 'logoText', 80),
    startDate,
    expirationDate,
    barcode: normalizeBarcode(input.barcode),
    backgroundColor: optionalColor(input.backgroundColor, 'backgroundColor', 'rgb(24, 24, 24)'),
    foregroundColor: optionalColor(input.foregroundColor, 'foregroundColor', 'rgb(255, 255, 255)'),
    labelColor: optionalColor(input.labelColor, 'labelColor', 'rgb(210, 210, 210)'),
    filename: optionalText(input.filename, 'filename', 120),
  };
}

function configuredBuffer({ base64Name, pathName, label }) {
  const base64Value = process.env[base64Name]?.trim();
  if (base64Value) {
    const normalized = base64Value.replace(/\s+/g, '');
    if (!/^[a-z\d+/]+={0,2}$/i.test(normalized)) {
      throw configurationError(`${label} enthält kein gültiges Base64.`);
    }
    const buffer = Buffer.from(normalized, 'base64');
    if (!buffer.length) throw configurationError(`${label} ist leer.`);
    return buffer;
  }

  const configuredPath = process.env[pathName]?.trim();
  if (!configuredPath) {
    throw configurationError(`${label} fehlt. Konfiguriere ${base64Name} oder ${pathName}.`);
  }
  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(API_ROOT, configuredPath);

  try {
    return fs.readFileSync(resolvedPath);
  } catch (_error) {
    throw configurationError(`${label} konnte unter dem konfigurierten Pfad nicht gelesen werden.`);
  }
}

function certificateBufferToPem(buffer, label) {
  const text = buffer.toString('utf8').trim();
  if (text.includes('-----BEGIN CERTIFICATE-----')) return text;

  try {
    const asn1 = forge.asn1.fromDer(buffer.toString('binary'));
    return forge.pki.certificateToPem(forge.pki.certificateFromAsn1(asn1));
  } catch (_error) {
    throw configurationError(`${label} ist weder ein gültiges DER- noch PEM-Zertifikat.`);
  }
}

function extractPkcs12Credentials(p12Buffer, password) {
  try {
    const asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    const keyBagTypes = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag];
    const keyBags = keyBagTypes.flatMap((bagType) => pkcs12.getBags({ bagType })[bagType] || []);
    const keyBag = keyBags.find((bag) => bag.key);
    if (!keyBag) throw new Error('Kein privater Schlüssel in PKCS#12 gefunden.');

    const certBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const localKeyId = keyBag.attributes?.localKeyId?.[0];
    const matchingBags = localKeyId
      ? pkcs12.getBags({ localKeyId, bagType: forge.pki.oids.certBag }).localKeyId || []
      : [];
    const passTypeBag = certBags.find((bag) => {
      const commonName = bag.cert?.subject?.getField('CN')?.value || '';
      return commonName.startsWith('Pass Type ID:');
    });
    const signerBag = matchingBags.find((bag) => bag.cert) || passTypeBag || certBags.find((bag) => bag.cert);
    if (!signerBag?.cert) throw new Error('Kein Signaturzertifikat in PKCS#12 gefunden.');

    return {
      signerCert: forge.pki.certificateToPem(signerBag.cert),
      signerKey: forge.pki.privateKeyToPem(keyBag.key),
    };
  } catch (_error) {
    throw configurationError('Die Apple-Wallet-PKCS#12-Datei konnte nicht geöffnet werden. Prüfe Datei und Passwort.');
  }
}

function loadSigningCredentials() {
  if (signingCredentialsCache) return signingCredentialsCache;

  const password = process.env.APPLE_WALLET_P12_PASSWORD;
  if (password === undefined) {
    throw configurationError('APPLE_WALLET_P12_PASSWORD fehlt.');
  }

  const p12Buffer = configuredBuffer({
    base64Name: 'APPLE_WALLET_P12_BASE64',
    pathName: 'APPLE_WALLET_P12_PATH',
    label: 'Apple-Wallet-PKCS#12-Datei',
  });
  const wwdrBuffer = configuredBuffer({
    base64Name: 'APPLE_WALLET_WWDR_BASE64',
    pathName: 'APPLE_WALLET_WWDR_PATH',
    label: 'Apple-WWDR-G4-Zertifikat',
  });

  signingCredentialsCache = {
    ...extractPkcs12Credentials(p12Buffer, password),
    wwdr: certificateBufferToPem(wwdrBuffer, 'Apple-WWDR-G4-Zertifikat'),
  };
  return signingCredentialsCache;
}

async function buildPassAssets() {
  if (passAssetsCache) return passAssetsCache;

  passAssetsCache = (async () => {
    const logoPath = process.env.APPLE_WALLET_LOGO_PATH
      ? path.resolve(API_ROOT, process.env.APPLE_WALLET_LOGO_PATH)
      : DEFAULT_STRIP_LOGO_PATH;
    let logoSource;
    try {
      logoSource = await fs.promises.readFile(logoPath);
    } catch (_error) {
      throw configurationError('Das Apple-Wallet-Logo konnte nicht gelesen werden.');
    }

    const iconSvg = Buffer.from(`
      <svg width="87" height="87" viewBox="0 0 87 87" xmlns="http://www.w3.org/2000/svg">
        <rect width="87" height="87" rx="16" fill="#181818"/>
        <text x="43.5" y="61" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="50" font-weight="700" fill="#ffffff">S</text>
      </svg>
    `);

    const [icon, icon2x, icon3x, logo, logo2x, logo3x] = await Promise.all([
      sharp(iconSvg).resize(29, 29).png().toBuffer(),
      sharp(iconSvg).resize(58, 58).png().toBuffer(),
      sharp(iconSvg).resize(87, 87).png().toBuffer(),
      buildHeaderLogo(logoSource, 312, 50),
      buildHeaderLogo(logoSource, 624, 100),
      buildHeaderLogo(logoSource, 936, 150),
    ]);

    return {
      'icon.png': icon,
      'icon@2x.png': icon2x,
      'icon@3x.png': icon3x,
      'logo.png': logo,
      'logo@2x.png': logo2x,
      'logo@3x.png': logo3x,
    };
  })();

  return passAssetsCache;
}

function buildPassJson(payload, { passTypeIdentifier, teamIdentifier }) {
  const secondaryFields = [];
  const auxiliaryFields = [];
  const backFields = [];

  if (payload.subtitle) secondaryFields.push({ key: 'subtitle', label: 'AUFTRAG', value: payload.subtitle });
  if (payload.startDate) {
    secondaryFields.push({
      key: 'startDate',
      label: 'BEGINN',
      value: payload.startDate,
      dateStyle: 'PKDateStyleMedium',
      timeStyle: 'PKDateStyleShort',
    });
  }
  if (payload.location) auxiliaryFields.push({ key: 'location', label: 'EINSATZORT', value: payload.location });
  if (payload.reference) auxiliaryFields.push({ key: 'reference', label: 'REFERENZ', value: payload.reference });
  if (payload.notes) backFields.push({ key: 'notes', label: 'HINWEISE', value: payload.notes });

  return {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName: process.env.APPLE_WALLET_ORGANIZATION_NAME || 'H. & P. Straightforward GmbH',
    serialNumber: payload.serialNumber,
    description: payload.description,
    ...(payload.logoText && { logoText: payload.logoText }),
    backgroundColor: payload.backgroundColor,
    foregroundColor: payload.foregroundColor,
    labelColor: payload.labelColor,
    ...(payload.startDate && { relevantDate: payload.startDate }),
    ...(payload.expirationDate && { expirationDate: payload.expirationDate }),
    ...(payload.barcode && { barcodes: [payload.barcode] }),
    generic: {
      primaryFields: [{ key: 'title', label: 'AUFTRAG', value: payload.title }],
      secondaryFields,
      auxiliaryFields,
      backFields,
    },
  };
}

function safeFilename(payload) {
  const requested = payload.filename
    || (/^auftrag[-_.]/i.test(payload.serialNumber) ? payload.serialNumber : `auftrag-${payload.serialNumber}`);
  const normalized = requested
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\d._-]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 120) || 'auftrag';
  return `${normalized.replace(/\.pkpass$/i, '')}.pkpass`;
}

async function generateWalletPass(input) {
  const payload = normalizePayload(input);
  const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_ID?.trim();
  const teamIdentifier = process.env.APPLE_WALLET_TEAM_ID?.trim();
  if (!passTypeIdentifier) throw configurationError('APPLE_WALLET_PASS_TYPE_ID fehlt.');
  if (!teamIdentifier) throw configurationError('APPLE_WALLET_TEAM_ID fehlt.');

  const [certificates, assets] = await Promise.all([
    Promise.resolve(loadSigningCredentials()),
    buildPassAssets(),
  ]);
  const passJson = buildPassJson(payload, { passTypeIdentifier, teamIdentifier });
  const pass = new PKPass(
    { ...assets, 'pass.json': Buffer.from(JSON.stringify(passJson)) },
    certificates,
  );

  return {
    buffer: pass.getAsBuffer(),
    filename: safeFilename(payload),
    mimeType: PASS_MIME_TYPE,
  };
}

function resetCachesForTests() {
  signingCredentialsCache = undefined;
  passAssetsCache = undefined;
}

module.exports = {
  PASS_MIME_TYPE,
  WalletPassError,
  generateWalletPass,
  normalizePayload,
  resetCachesForTests,
};
