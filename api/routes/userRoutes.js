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

    const payload = { user: { id: user.id } };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
      if (err) throw err;
      res.status(200).json({ token });
    });
  })
);

module.exports = router;
