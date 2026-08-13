'use strict';

function ok(data, {
  explanations = [],
  sourceRefs = [],
  warnings = [],
} = {}) {
  return {
    status: 'OK',
    blocking: false,
    data,
    explanations,
    sourceRefs,
    warnings,
  };
}

function unknown(code, message, {
  partial = null,
  explanations = [],
  sourceRefs = [],
  warnings = [],
} = {}) {
  return {
    status: 'UNKNOWN',
    blocking: true,
    code,
    message,
    partial,
    explanations,
    sourceRefs,
    warnings,
  };
}

module.exports = { ok, unknown };
