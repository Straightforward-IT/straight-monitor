'use strict';

class PayrollError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'PayrollError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.expose = true;
  }
}

module.exports = PayrollError;
