'use strict';

module.exports = function sensitiveRoute(req, _res, next) {
  req.sensitiveRequest = true;
  // Kept for compatibility with the previous error-handler contract.
  req.sensitiveBody = true;
  next();
};
