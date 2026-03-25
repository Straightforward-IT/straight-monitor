const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sollRoutine, sendConfirmationEmail} = require("../EmailService");
require("dotenv").config(); // Load environment variables from .env
const asyncHandler = require("../middleware/AsyncHandler");

// GET /api/users/me
router.get(
  "/me",
  auth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("-password");
    res.status(200).json(user);
  })
);

// PUT /api/users/me/dashboard-prefs
router.put(
  "/me/dashboard-prefs",
  auth,
  asyncHandler(async (req, res) => {
    const { prefs } = req.body;
    if (!Array.isArray(prefs)) return res.status(400).json({ msg: "prefs must be an array" });
    await User.findByIdAndUpdate(req.user.id, { dashboardPrefs: prefs });
    res.status(200).json({ msg: "Dashboard preferences saved" });
  })
);

// PUT /api/users/me/dispo-prefs
router.put(
  "/me/dispo-prefs",
  auth,
  asyncHandler(async (req, res) => {
    const { prefs } = req.body;
    if (!prefs || typeof prefs !== 'object') return res.status(400).json({ msg: "prefs must be an object" });
    await User.findByIdAndUpdate(req.user.id, { dispoPrefs: prefs });
    res.status(200).json({ msg: "Dispo preferences saved" });
  })
);

// GET /api/users/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.status(200).json(user);
  })
);

// PUT /api/users/:id
router.put(
  "/update/:id",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.name = name || user.name;
    user.email = email || user.email;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }
    await user.save();
    res.status(200).json(user);
  })
);

// POST /api/users/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password, location } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "Benutzer mit dieser E-Mail existiert bereits" });
    }

    if (!email.includes("@straightforward.email")) {
      return res.status(401).json({ msg: "Bitte benutze eine E-Mail der Firma Straightforward" });
    }

    user = new User({ name, email, password, location, isConfirmed: false });
    await user.save();

    await sendConfirmationEmail(user); // 🔹 Use centralized function

    res.status(200).json({ msg: "Registrierung erfolgreich. Bitte bestätige deine E-Mail." });
  })
);

//POST /api/users/test-email
router.post(
  "/email-test",
  asyncHandler(async (req, res) => {
    await sollRoutine();
    res.status(200).json({ msg: "Mails gesendet" });
  })
);

// POST /api/users/confirm-email
router.post(
  "/confirm-email",
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Benutzer nicht gefunden" });
    }
    if (user.isConfirmed) {
      return res.status(400).json({ msg: "E-Mail bereits bestätigt" });
    }
    user.isConfirmed = true;
    await user.save();

    res
      .status(200)
      .json({
        msg: "E-Mail erfolgreich bestätigt. Du kannst dich nun anmelden.",
      });
  })
);

// POST /api/users/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "Ungültige Anmeldedaten" });
    }

    if (!user.isConfirmed) {
      await sendConfirmationEmail(user); // 🔹 Use centralized function

      return res.status(403).json({
        msg: "Bitte bestätige zuerst deine E-Mail Adresse. Eine neue Bestätigungsmail wurde gesendet.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Ungültige Anmeldedaten" });
    }

    // Lazy Migration: ensure roles array is populated
    if (!user.roles || user.roles.length === 0) {
      user.roles = [user.role === 'ADMIN' ? 'ADMIN' : 'USER'];
      await user.save();
    }

    const payload = { user: { id: user.id } };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
      if (err) throw err;
      res.status(200).json({ token });
    });
  })
);

// ─── ADMIN ENDPOINTS ────────────────────────────────────────────────────────

async function requireAdmin(req, res) {
  const admin = await User.findById(req.user.id).select('role roles');
  if (!admin || !admin.roles?.includes('ADMIN')) {
    res.status(403).json({ msg: 'Zugriff verweigert – nur für Admins' });
    return null;
  }
  return admin;
}

// GET /api/users/admin/all
router.get(
  '/admin/all',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const users = await User.find().select('-password').populate('mitarbeiter', 'vorname nachname personalnr').sort({ date: -1 });
    res.status(200).json(users);
  })
);

// POST /api/users/admin/create
router.post(
  '/admin/create',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const { name, email, password, location, roles, isConfirmed } = req.body;
    if (!email || !password) return res.status(400).json({ msg: 'E-Mail und Passwort sind erforderlich' });
    if (!email.includes('@straightforward.email')) return res.status(400).json({ msg: 'Bitte benutze eine E-Mail der Firma Straightforward' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'Benutzer mit dieser E-Mail existiert bereits' });
    const resolvedRoles = Array.isArray(roles) && roles.length > 0 ? roles : ['USER'];
    const user = new User({
      name: name || '',
      email,
      password,
      location: location || '',
      role: resolvedRoles.includes('ADMIN') ? 'ADMIN' : 'USER', // keep legacy field in sync
      roles: resolvedRoles,
      isConfirmed: isConfirmed !== undefined ? isConfirmed : true,
    });
    await user.save();
    const result = user.toObject();
    delete result.password;
    res.status(201).json(result);
  })
);

// PUT /api/users/admin/:id
router.put(
  '/admin/:id',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const { name, email, password, location, roles, isConfirmed } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'Benutzer nicht gefunden' });
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (location !== undefined) user.location = location;
    if (isConfirmed !== undefined) user.isConfirmed = isConfirmed;
    if (Array.isArray(roles)) {
      user.roles = roles;
      user.role = roles.includes('ADMIN') ? 'ADMIN' : 'USER'; // keep legacy field in sync
    }
    if (password) user.password = password; // pre-save hook handles hashing
    await user.save();
    const result = user.toObject();
    delete result.password;
    res.status(200).json(result);
  })
);

// DELETE /api/users/admin/:id
router.delete(
  '/admin/:id',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    if (req.user.id === req.params.id) return res.status(400).json({ msg: 'Du kannst deinen eigenen Account nicht löschen' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'Benutzer nicht gefunden' });
    await user.deleteOne();
    res.status(200).json({ msg: 'Benutzer gelöscht' });
  })
);

// PUT /api/users/admin/:id/mitarbeiter — Link or unlink a Mitarbeiter
router.put(
  '/admin/:id/mitarbeiter',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const { mitarbeiterId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'Benutzer nicht gefunden' });
    user.mitarbeiter = mitarbeiterId || null;
    await user.save();
    const result = await User.findById(user._id).select('-password').populate('mitarbeiter', 'vorname nachname personalnr');
    res.status(200).json(result);
  })
);

module.exports = router;
