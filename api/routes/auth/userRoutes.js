const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/System/User");
const Location = require("../../models/System/Location");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sollRoutine, sendConfirmationEmail } = require("../../services/integrations/EmailService");
require("dotenv").config(); // Load environment variables from .env
const asyncHandler = require("../../middleware/AsyncHandler");
const {
  assertValidPeriod,
  buildWatchlistReportForUser,
  sendWatchlistReportToUser,
  sendMonthlyWatchlistReports
} = require("../../services/operations/KundenWatchlistReportService");

// GET /api/users/me
router.get(
  "/me",
  auth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("locationV2", "nameFull shortName color externalId")
      .populate("locationAccess", "nameFull shortName color");
    res.status(200).json(user);
  })
);

// PATCH /api/users/me/preferences
router.patch(
  "/me/preferences",
  auth,
  asyncHandler(async (req, res) => {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
      return res.status(400).json({ msg: "preferences must be an object" });
    }

    const allowedSections = new Set(["appearance", "display"]);
    if (Object.keys(preferences).some((key) => !allowedSections.has(key))) {
      return res.status(400).json({ msg: "Unknown preference section" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (preferences.appearance !== undefined) {
      const appearance = preferences.appearance;
      if (!appearance || typeof appearance !== "object" || Array.isArray(appearance)
        || Object.keys(appearance).some((key) => !["theme", "accentColor"].includes(key))
        || (appearance.theme !== undefined && !["light", "dark"].includes(appearance.theme))
        || (appearance.accentColor !== undefined && !["orange", "baby-blue", "pink", "ac-dc"].includes(appearance.accentColor))) {
        return res.status(400).json({ msg: "Invalid appearance preferences" });
      }
      if (appearance.theme !== undefined) user.set("preferences.appearance.theme", appearance.theme);
      if (appearance.accentColor !== undefined) user.set("preferences.appearance.accentColor", appearance.accentColor);
    }

    if (preferences.display !== undefined) {
      const display = preferences.display;
      if (!display || typeof display !== "object" || Array.isArray(display)
        || Object.keys(display).some((key) => key !== "employeeNameFormat")
        || !["first-last", "last-first"].includes(display.employeeNameFormat)) {
        return res.status(400).json({ msg: "Invalid display preferences" });
      }
      user.set("preferences.display.employeeNameFormat", display.employeeNameFormat);
    }

    await user.save();
    res.status(200).json({ preferences: user.preferences });
  })
);

// PATCH /api/users/me/profile
router.patch(
  "/me/profile",
  auth,
  asyncHandler(async (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ msg: "Der Anzeigename muss zwischen 2 und 100 Zeichen lang sein" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { new: true, runValidators: true }
    ).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.status(200).json({ user });
  })
);

// PUT /api/users/me/password
router.put(
  "/me/password",
  auth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return res.status(400).json({ msg: "Aktuelles und neues Passwort sind erforderlich" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ msg: "Das neue Passwort muss mindestens 8 Zeichen lang sein" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (!await user.comparePassword(currentPassword)) {
      return res.status(400).json({ msg: "Das aktuelle Passwort ist nicht korrekt" });
    }

    user.password = newPassword;
    await user.save();
    res.status(200).json({ msg: "Passwort aktualisiert" });
  })
);

// PUT /api/users/me/dashboard-prefs
router.put(
  "/me/dashboard-prefs",
  auth,
  asyncHandler(async (req, res) => {
    const { prefs } = req.body;
    const valid = Array.isArray(prefs)
      && prefs.length <= 100
      && prefs.every((entry) => entry
        && typeof entry === "object"
        && !Array.isArray(entry)
        && typeof entry.id === "string"
        && entry.id.trim().length > 0
        && entry.id.length <= 100
        && typeof entry.visible === "boolean")
      && new Set(prefs.map((entry) => entry.id)).size === prefs.length;
    if (!valid) return res.status(400).json({ msg: "prefs must contain unique id/visible entries" });
    const sanitizedPrefs = prefs.map(({ id, visible }) => ({ id: id.trim(), visible }));
    await User.findByIdAndUpdate(req.user.id, { dashboardPrefs: sanitizedPrefs });
    res.status(200).json({ msg: "Dashboard preferences saved" });
  })
);

// PUT /api/users/me/dispo-prefs
router.put(
  "/me/dispo-prefs",
  auth,
  asyncHandler(async (req, res) => {
    const { prefs } = req.body;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
      return res.status(400).json({ msg: "prefs must be an object" });
    }
    await User.findByIdAndUpdate(req.user.id, { dispoPrefs: prefs });
    res.status(200).json({ msg: "Dispo preferences saved" });
  })
);

// PUT /api/users/me/dispo-prefs/hide-for-all
router.put(
  "/me/dispo-prefs/hide-for-all",
  auth,
  asyncHandler(async (req, res) => {
    const { mitarbeiterId } = req.body;
    if (!mongoose.isValidObjectId(mitarbeiterId)) {
      return res.status(400).json({ msg: "mitarbeiterId must be a valid ObjectId" });
    }

    const result = await User.updateMany({}, [
      {
        $set: {
          dispoPrefs: {
            $mergeObjects: [
              { $ifNull: ["$dispoPrefs", {}] },
              {
                hiddenMitarbeiter: {
                  $setUnion: [
                    { $ifNull: ["$dispoPrefs.hiddenMitarbeiter", []] },
                    [mitarbeiterId]
                  ]
                }
              }
            ]
          }
        }
      }
    ]);

    res.status(200).json({ msg: "Employee hidden for all users", modifiedCount: result.modifiedCount });
  })
);

// PUT /api/users/me/kunden-watchlist/toggle
router.put(
  "/me/kunden-watchlist/toggle",
  auth,
  asyncHandler(async (req, res) => {
    const { kundeId } = req.body;
    if (!kundeId) return res.status(400).json({ msg: "kundeId is required" });
    const user = await User.findById(req.user.id).select("kundenWatchlist");
    if (!user) return res.status(404).json({ msg: "User not found" });
    const idx = user.kundenWatchlist.findIndex(id => id.toString() === kundeId);
    if (idx === -1) {
      user.kundenWatchlist.push(kundeId);
    } else {
      user.kundenWatchlist.splice(idx, 1);
    }
    await user.save();
    res.status(200).json({ kundenWatchlist: user.kundenWatchlist });
  })
);

// PUT /api/users/me/highlighted-kunden/toggle
router.put(
  "/me/highlighted-kunden/toggle",
  auth,
  asyncHandler(async (req, res) => {
    const { kundeId } = req.body;
    if (!kundeId) return res.status(400).json({ msg: "kundeId is required" });
    const user = await User.findById(req.user.id).select("highlightedKunden");
    if (!user) return res.status(404).json({ msg: "User not found" });
    const index = user.highlightedKunden.findIndex((id) => id.toString() === kundeId);
    if (index === -1) user.highlightedKunden.push(kundeId);
    else user.highlightedKunden.splice(index, 1);
    await user.save();
    res.status(200).json({ highlightedKunden: user.highlightedKunden });
  })
);

// PUT /api/users/me/highlighted-inventory-items/toggle
router.put(
  "/me/highlighted-inventory-items/toggle",
  auth,
  asyncHandler(async (req, res) => {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ msg: "itemId is required" });
    const user = await User.findById(req.user.id).select("highlightedInventoryItems");
    if (!user) return res.status(404).json({ msg: "User not found" });
    const index = user.highlightedInventoryItems.findIndex((id) => id.toString() === itemId);
    if (index === -1) user.highlightedInventoryItems.push(itemId);
    else user.highlightedInventoryItems.splice(index, 1);
    await user.save();
    res.status(200).json({ highlightedInventoryItems: user.highlightedInventoryItems });
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

async function resolveLocationV2(locationId) {
  if (!locationId) return null;
  if (!mongoose.isValidObjectId(locationId)) return null;
  return Location.findOne({ _id: locationId, isActive: true }).select('_id nameFull');
}

async function resolveLocationAccess(locationIds) {
  if (!Array.isArray(locationIds)) return null;
  const validIds = [...new Set(locationIds.filter((id) => mongoose.isValidObjectId(id)).map(String))];
  const locations = await Location.find({ _id: { $in: validIds }, isActive: true }).select('_id');
  if (locations.length !== validIds.length) return null;
  return locations.map((location) => location._id);
}

// GET /api/users/admin/all
router.get(
  '/admin/all',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const users = await User.find().select('-password').populate('mitarbeiter', 'vorname nachname personalnr').populate('locationV2', 'nameFull shortName').sort({ date: -1 });
    res.status(200).json(users);
  })
);

// POST /api/users/admin/create
router.post(
  '/admin/create',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const { name, email, password, location, locationV2, locationAccess, roles, isConfirmed } = req.body;
    if (!email || !password) return res.status(400).json({ msg: 'E-Mail und Passwort sind erforderlich' });
    if (!email.includes('@straightforward.email')) return res.status(400).json({ msg: 'Bitte benutze eine E-Mail der Firma Straightforward' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'Benutzer mit dieser E-Mail existiert bereits' });
    const resolvedLocationV2 = await resolveLocationV2(locationV2);
    if (locationV2 && !resolvedLocationV2) return res.status(400).json({ msg: 'Der gewählte Standort ist nicht aktiv oder existiert nicht' });
    const resolvedLocationAccess = await resolveLocationAccess(locationAccess || []);
    if (!resolvedLocationAccess) return res.status(400).json({ msg: 'Ein gewählter Space-Standort ist nicht aktiv oder existiert nicht' });
    const resolvedRoles = Array.isArray(roles) && roles.length > 0 ? roles : ['USER'];
    const user = new User({
      name: name || '',
      email,
      password,
      location: resolvedLocationV2?.nameFull || location || '',
      locationV2: resolvedLocationV2?._id || null,
      locationAccess: resolvedLocationAccess,
      role: resolvedRoles.includes('ADMIN') ? 'ADMIN' : 'USER', // keep legacy field in sync
      roles: resolvedRoles,
      isConfirmed: isConfirmed !== undefined ? isConfirmed : true,
    });
    await user.save();
    await user.populate([{ path: 'locationV2', select: 'nameFull shortName' }, { path: 'locationAccess', select: 'nameFull shortName color' }]);
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
    const { name, email, password, location, locationV2, locationAccess, roles, isConfirmed } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'Benutzer nicht gefunden' });
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (location !== undefined) user.location = location;
    if (locationV2 !== undefined) {
      const resolvedLocationV2 = await resolveLocationV2(locationV2);
      if (locationV2 && !resolvedLocationV2) return res.status(400).json({ msg: 'Der gewählte Standort ist nicht aktiv oder existiert nicht' });
      user.locationV2 = resolvedLocationV2?._id || null;
      if (resolvedLocationV2) user.location = resolvedLocationV2.nameFull;
    }
    if (locationAccess !== undefined) {
      const resolvedLocationAccess = await resolveLocationAccess(locationAccess);
      if (!resolvedLocationAccess) return res.status(400).json({ msg: 'Ein gewählter Space-Standort ist nicht aktiv oder existiert nicht' });
      user.locationAccess = resolvedLocationAccess;
    }
    if (isConfirmed !== undefined) user.isConfirmed = isConfirmed;
    if (Array.isArray(roles)) {
      user.roles = roles;
      user.role = roles.includes('ADMIN') ? 'ADMIN' : 'USER'; // keep legacy field in sync
    }
    if (password) user.password = password; // pre-save hook handles hashing
    await user.save();
    await user.populate([{ path: 'locationV2', select: 'nameFull shortName' }, { path: 'locationAccess', select: 'nameFull shortName color' }]);
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

// PUT /api/users/admin/:id/asana — Link or unlink an Asana user
router.put(
  '/admin/:id/asana',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const { asana_id } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'Benutzer nicht gefunden' });
    user.asana_id = asana_id || null;
    await user.save();
    const result = await User.findById(user._id).select('-password').populate('mitarbeiter', 'vorname nachname personalnr');
    res.status(200).json(result);
  })
);

// ─── WATCHLIST REPORT ────────────────────────────────────────────────────────

// GET /api/users/me/kunden-watchlist/report?month=&year=
router.get(
  '/me/kunden-watchlist/report',
  auth,
  asyncHandler(async (req, res) => {
    const period = assertValidPeriod(req.query.month, req.query.year);
    const report = await buildWatchlistReportForUser(req.user.id, period);
    res.json(report);
  })
);

// POST /api/users/me/kunden-watchlist/report/send
router.post(
  '/me/kunden-watchlist/report/send',
  auth,
  asyncHandler(async (req, res) => {
    const period = assertValidPeriod(req.body.month, req.body.year);
    const result = await sendWatchlistReportToUser(req.user.id, period, { throwOnEmpty: true });
    res.json({ msg: `Bericht an ${result.email} gesendet`, report: result.report });
  })
);

// POST /api/users/watchlist-reports/send-all
router.post(
  '/watchlist-reports/send-all',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;

    const summary = await sendMonthlyWatchlistReports({ month: req.body.month, year: req.body.year });
    res.json({ ...summary, msg: `${summary.sent} Watchlist-Report(s) für ${summary.monthLabel} versendet` });
  })
);

module.exports = router;
