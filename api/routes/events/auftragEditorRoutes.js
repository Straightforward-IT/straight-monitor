const express = require('express');
const asyncHandler = require('../../middleware/AsyncHandler');

module.exports = function editorRoutes(helpers) {
  const router = express.Router();
  const service = require('../../services/operations/AuftragEditorService')(helpers);
  const respond = handler => asyncHandler(async (req, res) => {
    try { res.json(await handler(req)); }
    catch (error) {
      if (!error.statusCode) throw error;
      res.status(error.statusCode).json({ code: error.code || 'EDITOR_INVALID',
        message: error.message, ...(error.details ? { details: error.details } : {}) });
    }
  });
  router.get('/context/:auftragNr', respond(req => service.getContext(req, req.params.auftragNr, req.query.cursor)));
  router.post('/candidates', respond(req => service.candidates(req, req.body || {})));
  router.post('/review', respond(req => service.review(req, req.body || {}, req.query.cursor || req.body?.cursor)));
  router.post('/submissions', respond(req => service.submit(req, req.body || {})));
  router.post('/submissions/:id/process', respond(req => service.process(req, req.params.id)));
  router.post('/submissions/:id/complete', respond(req => service.complete(req, req.params.id)));
  router.get('/submissions/:id', respond(req => service.progress(req, req.params.id)));
  return router;
};
