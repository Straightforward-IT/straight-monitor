const express = require("express");
const router = express.Router();
const multer = require("multer");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/AsyncHandler");
const { sendMail } = require("../EmailService");
const Mitarbeiter = require("../models/Mitarbeiter");
const Qualifikation = require("../models/Qualifikation");
const { Laufzettel } = require("../models/Classes/FlipDocs");
const { flipAxios } = require("../flipAxios");
const logger = require("../utils/logger");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.log')) {
      cb(null, true);
    } else {
      cb(new Error('Dateityp nicht erlaubt'), false);
    }
  }
});

// POST /api/support/request - Submit support request
router.post(
  "/request",
  auth,
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    const { type, subject, description } = req.body;
    const files = req.files || [];

    if (!type || !subject || !description) {
      return res.status(400).json({ 
        success: false, 
        error: "Typ, Betreff und Beschreibung sind erforderlich" 
      });
    }

    // Load full user data from database
    const User = require('../models/User');
    let userData = null;
    try {
      userData = await User.findById(req.user.id).select('-password');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
    
    // Get user info (prioritize frontend data, fallback to database)
    const userEmail = req.body.userEmail || userData?.email || "unbekannt";
    const userName = userData?.name || userEmail.split('@')[0] || "Unbekannter Benutzer";

    // Type mapping for better readability
    const typeMapping = {
      'bug': '🐛 Bug/Fehler',
      'feature': '💡 Feature-Request',
      'question': '❓ Frage/Hilfe',
      'other': '📋 Sonstiges'
    };

    const typeLabel = typeMapping[type] || type;

    // Prepare email content
    const emailSubject = `[Monitor Support] ${typeLabel}: ${subject}`;
    
    let emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #007acc; border-bottom: 2px solid #007acc; padding-bottom: 10px;">
          Monitor Support Request
        </h2>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Request Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 120px;">Typ:</td>
              <td style="padding: 8px;">${typeLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Benutzer:</td>
              <td style="padding: 8px;">${userName} (${userEmail})</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Betreff:</td>
              <td style="padding: 8px;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Datum:</td>
              <td style="padding: 8px;">${new Date().toLocaleString('de-DE')}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #333;">Beschreibung:</h3>
          <div style="background: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; white-space: pre-wrap;">${description}</div>
        </div>

        ${files.length > 0 ? `
          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Angehängte Dateien:</h3>
            <ul style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
              ${files.map(file => `
                <li style="margin: 5px 0;">
                  📎 ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>Diese E-Mail wurde automatisch vom Monitor Support-System generiert.</p>
        </div>
      </div>
    `;

    try {
      // Prepare attachments for email
      const attachments = files.map(file => ({
        filename: file.originalname,
        content: file.buffer
      }));

      // Send email only to IT (no confirmation email to user)
      await sendMail(
        "it@straightforward.email",
        emailSubject,
        emailContent,
        "support",
        attachments
      );

      res.json({
        success: true,
        message: "Support-Request wurde erfolgreich gesendet",
        requestId: Date.now()
      });

    } catch (error) {
      console.error("Support request error:", error);
      res.status(500).json({
        success: false,
        error: "Fehler beim Senden des Support-Requests"
      });
    }
  })
);

// GET /api/support/status - Get support system status
router.get(
  "/status",
  auth,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      status: "operational",
      supportEmail: "it@straightforward.email",
      maxFileSize: "10MB",
      allowedFileTypes: [
        "Images (JPEG, PNG, GIF, WebP)",
        "Documents (PDF, DOC, DOCX)",
        "Text files (TXT, CSV, JSON, LOG)"
      ]
    });
  })
);

// POST /api/support/debug/flip-badges
// Dry-run + live update of Flip menu badges for all Teamleiter. Returns full detail per user.
router.post(
  "/debug/flip-badges",
  auth,
  asyncHandler(async (req, res) => {
    const FLIP_JOBS_MENU_ITEM_ID = process.env.FLIP_JOBS_MENU_ITEM_ID || "c672be9c-d742-4034-8aa3-5ff5afaf8e3c";
    const dryRun = req.query.dry === "1";

    // 1. Teamleiter-Qualifikation
    const teamleiterQual = await Qualifikation.findOne({ qualificationKey: 50055 }).lean();
    if (!teamleiterQual) {
      return res.status(404).json({ msg: "Teamleiter-Qualifikation (50055) nicht gefunden" });
    }

    // 2. Alle Teamleiter mit flip_id
    const allTL = await Mitarbeiter.find({
      qualifikationen: teamleiterQual._id,
      flip_id: { $exists: true, $ne: null },
    }).select("_id flip_id vorname nachname email").lean();

    // 3. Offene Laufzettel pro TL zählen
    const tlIds = allTL.map(t => t._id);
    const counts = await Laufzettel.aggregate([
      { $match: { status: "OFFEN", teamleiter: { $in: tlIds } } },
      { $group: { _id: "$teamleiter", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map(c => [String(c._id), c.count]));

    const entries = allTL.map(t => ({
      name: `${t.vorname} ${t.nachname}`,
      email: t.email,
      flip_id: t.flip_id,
      badge_count: countMap.get(String(t._id)) || 0,
    }));

    const TEST_OVERRIDE_ID = "f8611901-b889-4c13-944c-fb9063815021";
    const badges = entries.map(e => ({
      user_id: e.flip_id,
      badge_count: e.flip_id === TEST_OVERRIDE_ID ? 5 : e.badge_count,
    }));

    let apiResult = null;
    let apiError = null;

    if (!dryRun) {
      try {
        const response = await flipAxios.post(
          `/api/navigation/v4/menu-items/${FLIP_JOBS_MENU_ITEM_ID}/badge`,
          { badges }
        );
        apiResult = response.data;
        logger.info(`🔔 [debug] Flip badges updated for ${badges.length} TL`);
      } catch (err) {
        apiError = {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        };
        logger.warn(`⚠️ [debug] Flip badge POST failed: ${JSON.stringify(apiError)}`);
      }
    }

    res.json({
      menuItemId: FLIP_JOBS_MENU_ITEM_ID,
      dryRun,
      teamleiterCount: entries.length,
      nonZero: entries.filter(e => e.badge_count > 0).length,
      entries,
      apiResult,
      apiError,
    });
  })
);

module.exports = router;