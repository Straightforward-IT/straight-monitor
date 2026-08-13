'use strict';

const crypto = require('crypto');

function normalize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;

  if (value._bsontype === 'ObjectId') return value.toString();
  if (value._bsontype === 'Decimal128') return value.toString();
  if (typeof value.toObject === 'function') return normalize(value.toObject({ depopulate: true }));

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (value[key] !== undefined) result[key] = normalize(value[key]);
      return result;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(normalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

module.exports = { normalize, stableStringify, sha256 };
