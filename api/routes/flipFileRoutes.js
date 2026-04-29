const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/AsyncHandler");
const { flipAxios } = require("../flipAxios");
const {
  createFlipFile,
  uploadToFlipSignedUrl,
  pollFlipFileStatus,
  uploadFileToFlip,
} = require("../FlipService");
const logger = require("../utils/logger");

// Memory storage — no files written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/**
 * POST /api/flip-files/upload
 * Full upload pipeline: create → PUT to signed URL → poll until FINISHED.
 * Body: multipart/form-data
 *   file      (required) — the file to upload
 *   mediaTypeHint (optional) — e.g. "IMAGE", "VIDEO", "DOCUMENT"
 */
router.post(
  "/upload",
  auth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Keine Datei übermittelt." });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { mediaTypeHint } = req.body;

    const file_id = await uploadFileToFlip({
      fileName: originalname,
      fileBuffer: buffer,
      mimeType: mimetype,
      mediaTypeHint: mediaTypeHint || undefined,
    });

    logger.info(`Flip file upload finished: ${file_id} (${originalname})`);
    res.status(201).json({ file_id });
  })
);

/**
 * POST /api/flip-files
 * Step 1 only: register a file slot, get back file_id + signed_url.
 * Useful when the frontend wants to upload directly to the signed URL.
 * Body JSON: { file_name, mediaTypeHint?, media_conversion?, source? }
 */
router.post(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const { file_name, mediaTypeHint, media_conversion, source } = req.body;
    if (!file_name) {
      return res.status(400).json({ message: "file_name ist erforderlich." });
    }

    const data = await createFlipFile({ fileName: file_name, mediaTypeHint, mediaConversion: media_conversion, source });
    res.status(201).json(data);
  })
);

/**
 * GET /api/flip-files/:fileId
 * Poll or inspect the processing status of a Flip file.
 */
router.get(
  "/:fileId",
  auth,
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const response = await flipAxios.get(`/api/files/v4/files/${fileId}`);
    res.json(response.data);
  })
);

/**
 * POST /api/flip-files/:fileId/poll
 * Block until the file reaches FINISHED (or throws on FAILURE / timeout).
 * Body JSON: { intervalMs?, maxAttempts? }
 */
router.post(
  "/:fileId/poll",
  auth,
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const { intervalMs, maxAttempts } = req.body;
    const result = await pollFlipFileStatus(fileId, { intervalMs, maxAttempts });
    res.json(result);
  })
);

module.exports = router;
