/**
 * AES-256-GCM field-level encryption for sensitive database fields.
 *
 * Key is read from process.env.RECHNUNG_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Each call to encrypt() produces a fresh random 12-byte IV, so the same
 * plaintext never produces the same ciphertext.
 *
 * Encrypted value format (stored as a JSON string):
 *   { "iv": "<base64>", "encryptedData": "<base64>", "authTag": "<base64>" }
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const hexKey = process.env.RECHNUNG_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('[encryption] RECHNUNG_ENCRYPTION_KEY is not set in environment variables.');
  }
  const keyBuf = Buffer.from(hexKey, 'hex');
  if (keyBuf.length !== 32) {
    throw new Error(
      `[encryption] RECHNUNG_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${keyBuf.length} bytes.`
    );
  }
  return keyBuf;
}

/**
 * Encrypts a string value.
 * @param {string} plaintext
 * @returns {string} JSON string containing iv, encryptedData, authTag (all base64)
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final()
  ]);

  return JSON.stringify({
    iv: iv.toString('base64'),
    encryptedData: encrypted.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  });
}

/**
 * Decrypts a value previously produced by encrypt().
 * @param {string} ciphertext JSON string with iv, encryptedData, authTag
 * @returns {string} original plaintext
 */
function decrypt(ciphertext) {
  const key = getKey();
  const { iv, encryptedData, authTag } = JSON.parse(ciphertext);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypts a field value, returning null if the input is null/undefined/empty.
 * @param {*} val
 * @returns {string|null}
 */
function encryptField(val) {
  if (val === null || val === undefined || val === '') return null;
  return encrypt(String(val));
}

/**
 * Decrypts a field value, returning null if the input is null/undefined/empty.
 * @param {string|null} val
 * @returns {string|null}
 */
function decryptField(val) {
  if (val === null || val === undefined || val === '') return null;
  try {
    return decrypt(val);
  } catch {
    return null; // Gracefully handle malformed or unencrypted legacy values
  }
}

module.exports = { encrypt, decrypt, encryptField, decryptField };
