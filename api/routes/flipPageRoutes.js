const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/AsyncHandler");
const FlipPage = require("../models/Classes/FlipPage");

// GET / — list pages
// Query params: page_id, tree_mode, publication_statuses, page_limit, page_cursor, search_term
router.get("/", auth, asyncHandler(async (req, res) => {
  const result = await FlipPage.list(req.query);
  res.json(result);
}));

// POST / — create page
router.post("/", auth, asyncHandler(async (req, res) => {
  const page = await new FlipPage(req.body).create();
  res.status(201).json(page);
}));

// GET /external-id/:externalId — get page by external ID
// Must be declared before /:pageId to avoid path conflict
router.get("/external-id/:externalId", auth, asyncHandler(async (req, res) => {
  const page = await FlipPage.getByExternalId(req.params.externalId, req.query);
  res.json(page);
}));

// GET /:pageId — get single page by Flip ID
router.get("/:pageId", auth, asyncHandler(async (req, res) => {
  const page = await FlipPage.getById(req.params.pageId, req.query);
  res.json(page);
}));

// PATCH /:pageId — partial update (JSON Merge Patch)
router.patch("/:pageId", auth, asyncHandler(async (req, res) => {
  const page = await new FlipPage({ id: req.params.pageId }).update(req.params.pageId, req.body);
  res.json(page);
}));

// POST /:pageId/archive — archive page
router.post("/:pageId/archive", auth, asyncHandler(async (req, res) => {
  const result = await FlipPage.archive(req.params.pageId);
  res.json(result);
}));

// POST /:pageId/move — move page relative to a reference page
// Body: { reference_page_id, direction: "BEFORE" | "AFTER" | "INTO" }
router.post("/:pageId/move", auth, asyncHandler(async (req, res) => {
  const { reference_page_id, direction } = req.body;
  const result = await FlipPage.move(req.params.pageId, reference_page_id, direction);
  res.json(result);
}));

module.exports = router;
