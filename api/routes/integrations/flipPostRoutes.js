const express = require("express");
const auth = require("../../middleware/auth");
const asyncHandler = require("../../middleware/AsyncHandler");
const { getFlipPosts } = require("../../services/integrations/FlipService");

const router = express.Router();

// GET /api/flip-posts — one filtered page, using the backend Flip API actor.
router.get("/", auth, asyncHandler(async (req, res) => {
  try {
    const result = await getFlipPosts(req.query, { acceptLanguage: req.get("Accept-Language") });
    res.json(result);
  } catch (error) {
    // Avoid forwarding raw upstream payloads or authentication details.
    const status = error.statusCode === 400 ? 400 : 502;
    res.status(status).json({
      success: false,
      message: status === 400 ? error.message : "Fehler beim Abrufen der Posts von Flip.",
    });
  }
}));

module.exports = router;
