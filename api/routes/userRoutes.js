const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sollRoutine, sendConfirmationEmail, sendMail } = require("../EmailService");
require("dotenv").config(); // Load environment variables from .env
const asyncHandler = require("../middleware/AsyncHandler");
const Kunde = require("../models/Kunde");
const Auftrag = require("../models/Auftrag");
const Einsatz = require("../models/Einsatz");
const Rechnung = require("../models/Rechnung");

const MONTH_NAMES_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function monthRange(year, month) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end:   new Date(Date.UTC(year, month, 1))
  };
}

async function buildKundeMetrics(kundenNr, range) {
  const auftraege = await Auftrag.find({ kundenNr, vonDatum: { $gte: range.start, $lt: range.end } }).select('auftragNr').lean();
  const auftragNrs = auftraege.map(a => a.auftragNr);

  const einsaetzeQuery = auftragNrs.length > 0
    ? await Einsatz.find({ auftragNr: { $in: auftragNrs }, isPseudo: { $ne: true } }).select('bedarf').lean()
    : [];

  const positionen = einsaetzeQuery.reduce((s, e) => s + (e.bedarf || 0), 0);

  const rechnungen = await Rechnung.find({ kundenNr, buchDatum: { $gte: range.start, $lt: range.end } }).lean();
  const umsatz = rechnungen.reduce((s, r) => {
    const dec = Rechnung.decryptDoc(r);
    return s + (dec.netto || 0);
  }, 0);

  return { auftraegeCount: auftraege.length, einsaetzeCount: einsaetzeQuery.length, positionen, umsatz };
}

function buildReportHtml(kunden_report, m, y) {
  const monthLabel = MONTH_NAMES_DE[m - 1];
  const fmt = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const delta = (curr, prev) => {
    if (prev == null || prev === 0) return '';
    const pct = ((curr - prev) / prev * 100).toFixed(1);
    const color = curr >= prev ? '#16a34a' : '#dc2626';
    const arrow = curr >= prev ? '▲' : '▼';
    return ` <span style="color:${color};font-size:11px">${arrow} ${pct}%</span>`;
  };
  const rows = kunden_report.map(k => {
    const p = k.prevYear;
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:500">${k.kundName}${k.kuerzel ? ` <span style="color:#9ca3af;font-size:11px">(${k.kuerzel})</span>` : ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center">${k.current.auftraegeCount}${p ? delta(k.current.auftraegeCount, p.auftraegeCount) + `<br><span style="color:#9ca3af;font-size:11px">VJ: ${p.auftraegeCount}</span>` : ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center">${k.current.positionen}${p ? delta(k.current.positionen, p.positionen) + `<br><span style="color:#9ca3af;font-size:11px">VJ: ${p.positionen}</span>` : ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center">${k.current.einsaetzeCount}${p ? delta(k.current.einsaetzeCount, p.einsaetzeCount) + `<br><span style="color:#9ca3af;font-size:11px">VJ: ${p.einsaetzeCount}</span>` : ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(k.current.umsatz)}${p ? delta(k.current.umsatz, p.umsatz) + `<br><span style="color:#9ca3af;font-size:11px">VJ: ${fmt(p.umsatz)}</span>` : ''}</td>
      </tr>`;
  }).join('');
  return `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:900px;margin:0 auto;color:#222">
      <h2 style="margin-bottom:4px">Watchlist-Bericht</h2>
      <p style="color:#666;margin-top:0">${monthLabel} ${y} – Vergleich mit ${monthLabel} ${y - 1}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f4f5f6">
            <th style="padding:10px 14px;text-align:left;font-size:13px;color:#444">Kunde</th>
            <th style="padding:10px 14px;text-align:center;font-size:13px;color:#444">Aufträge</th>
            <th style="padding:10px 14px;text-align:center;font-size:13px;color:#444">Positionen</th>
            <th style="padding:10px 14px;text-align:center;font-size:13px;color:#444">Einsätze</th>
            <th style="padding:10px 14px;text-align:right;font-size:13px;color:#444">Umsatz</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px">Erstellt am ${new Date().toLocaleDateString('de-DE')} · Straight Monitor</p>
    </div>`;
}

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

// ─── WATCHLIST REPORT ────────────────────────────────────────────────────────

// GET /api/users/me/kunden-watchlist/report/check-rechnungen?month=&year=
router.get(
  '/me/kunden-watchlist/report/check-rechnungen',
  auth,
  asyncHandler(async (req, res) => {
    const month = parseInt(req.query.month, 10);
    const year  = parseInt(req.query.year,  10);
    if (!month || month < 1 || month > 12 || !year || year < 2000 || year > 2100) {
      return res.status(400).json({ msg: 'Gültiger Monat und Jahr erforderlich' });
    }
    const range = monthRange(year, month);
    const count = await Rechnung.countDocuments({ buchDatum: { $gte: range.start, $lt: range.end } });
    res.json({ count, available: count > 0 });
  })
);

// GET /api/users/me/kunden-watchlist/report?month=&year=
router.get(
  '/me/kunden-watchlist/report',
  auth,
  asyncHandler(async (req, res) => {
    const month = parseInt(req.query.month, 10);
    const year  = parseInt(req.query.year,  10);
    if (!month || month < 1 || month > 12 || !year || year < 2000 || year > 2100) {
      return res.status(400).json({ msg: 'Gültiger Monat (1–12) und Jahr erforderlich' });
    }

    const user = await User.findById(req.user.id).select('kundenWatchlist');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!user.kundenWatchlist.length) return res.json({ month, year, kunden: [] });

    const kunden = await Kunde.find({ _id: { $in: user.kundenWatchlist } })
      .select('kundenNr kundName kuerzel').lean();

    const currRange = monthRange(year, month);
    const prevRange = monthRange(year - 1, month);

    const kunden_report = await Promise.all(kunden.map(async (k) => {
      const [current, prevYear] = await Promise.all([
        buildKundeMetrics(k.kundenNr, currRange),
        buildKundeMetrics(k.kundenNr, prevRange)
      ]);
      const hasPrevData = prevYear.auftraegeCount > 0 || prevYear.umsatz > 0 || prevYear.einsaetzeCount > 0;
      return { _id: k._id, kundenNr: k.kundenNr, kundName: k.kundName, kuerzel: k.kuerzel, current, prevYear: hasPrevData ? prevYear : null };
    }));

    res.json({ month, year, kunden: kunden_report });
  })
);

// POST /api/users/me/kunden-watchlist/report/send
router.post(
  '/me/kunden-watchlist/report/send',
  auth,
  asyncHandler(async (req, res) => {
    const { month, year } = req.body;
    const m = parseInt(month, 10);
    const y = parseInt(year,  10);
    if (!m || m < 1 || m > 12 || !y || y < 2000 || y > 2100) {
      return res.status(400).json({ msg: 'Gültiger Monat und Jahr erforderlich' });
    }

    const user = await User.findById(req.user.id).select('email name kundenWatchlist');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (!user.kundenWatchlist.length) {
      return res.status(400).json({ msg: 'Watchlist ist leer' });
    }

    const kunden = await Kunde.find({ _id: { $in: user.kundenWatchlist } })
      .select('kundenNr kundName kuerzel').lean();

    const currRange = monthRange(y, m);
    const prevRange = monthRange(y - 1, m);

    const kunden_report = await Promise.all(kunden.map(async (k) => {
      const [current, prevYear] = await Promise.all([
        buildKundeMetrics(k.kundenNr, currRange),
        buildKundeMetrics(k.kundenNr, prevRange)
      ]);
      const hasPrevData = prevYear.auftraegeCount > 0 || prevYear.umsatz > 0 || prevYear.einsaetzeCount > 0;
      return { kundenNr: k.kundenNr, kundName: k.kundName, kuerzel: k.kuerzel, current, prevYear: hasPrevData ? prevYear : null };
    }));

    const monthLabel = MONTH_NAMES_DE[m - 1];
    const html = buildReportHtml(kunden_report, m, y);
    await sendMail(user.email, `Watchlist-Bericht: ${monthLabel} ${y}`, html, 'it');
    res.json({ msg: `Bericht an ${user.email} gesendet` });
  })
);

// POST /api/users/watchlist-reports/send-all
// Called automatically after a Rechnungen import — sends reports to every user with watchlist entries.
router.post(
  '/watchlist-reports/send-all',
  auth,
  asyncHandler(async (req, res) => {
    if (!await requireAdmin(req, res)) return;

    const { month, year } = req.body;
    const now = new Date();
    // Default to previous month
    const m = month ? parseInt(month, 10) : (now.getMonth() === 0 ? 12 : now.getMonth());
    const y = year  ? parseInt(year,  10) : (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

    const usersWithWatchlist = await User.find({ roles: 'Vertrieb' })
      .select('email name kundenWatchlist');

    if (!usersWithWatchlist.length) {
      return res.json({ sent: 0, month: m, year: y, msg: 'Keine Nutzer mit Watchlist-Einträgen gefunden' });
    }

    const monthLabel = MONTH_NAMES_DE[m - 1];
    const currRange = monthRange(y, m);
    const prevRange = monthRange(y - 1, m);
    let sent = 0;

    for (const user of usersWithWatchlist) {
      try {
        const kunden = await Kunde.find({ _id: { $in: user.kundenWatchlist } })
          .select('kundenNr kundName kuerzel').lean();

        if (!kunden.length) {
          // User has no watchlist entries – send onboarding hint
          const hintHtml = `
            <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">
              <h2 style="margin-bottom:4px">Watchlist-Bericht: ${monthLabel} ${y}</h2>
              <p style="color:#666;margin-top:0">Deine Watchlist ist noch leer.</p>
              <div style="margin-top:24px;padding:20px 24px;background:#f4f5f6;border-radius:10px;border:1px solid #e5e7eb">
                <p style="margin:0 0 12px;font-size:15px;font-weight:600">📋 So richtest du deinen monatlichen Bericht ein</p>
                <p style="margin:0 0 16px;font-size:14px;color:#444">Füge Kunden zu deiner persönlichen Watchlist hinzu, um jeden Monat automatisch einen Bericht mit Auftrags-, Einsatz- und Umsatzzahlen im Vergleich zum Vorjahr zu erhalten.</p>
                <a href="${process.env.APP_URL || 'https://straightmonitor.com'}/kunden"
                   style="display:inline-block;padding:10px 20px;background:#eeaf67;color:#fff;text-decoration:none;border-radius:7px;font-weight:600;font-size:14px">
                  Jetzt Kunden zur Watchlist hinzufügen →
                </a>
              </div>
              <p style="color:#9ca3af;font-size:12px;margin-top:20px">Straight Monitor · Watchlist-Bericht</p>
            </div>`;
          await sendMail(user.email, `Watchlist-Bericht: ${monthLabel} ${y} – Watchlist leer`, hintHtml, 'it');
          sent++;
          continue;
        }

        const kunden_report = await Promise.all(kunden.map(async (k) => {
          const [current, prevYear] = await Promise.all([
            buildKundeMetrics(k.kundenNr, currRange),
            buildKundeMetrics(k.kundenNr, prevRange)
          ]);
          const hasPrevData = prevYear.auftraegeCount > 0 || prevYear.umsatz > 0 || prevYear.einsaetzeCount > 0;
          return { kundenNr: k.kundenNr, kundName: k.kundName, kuerzel: k.kuerzel, current, prevYear: hasPrevData ? prevYear : null };
        }));

        // Skip if no data at all for this period
        const hasData = kunden_report.some(k => k.current.auftraegeCount > 0 || k.current.umsatz > 0 || k.current.einsaetzeCount > 0);
        if (!hasData) continue;

        const html = buildReportHtml(kunden_report, m, y);
        await sendMail(user.email, `Watchlist-Bericht: ${monthLabel} ${y}`, html, 'it');
        sent++;
      } catch (e) {
        console.error(`[WatchlistReport] Failed for ${user.email}:`, e.message);
      }
    }

    res.json({ sent, month: m, year: y, msg: `${sent} Watchlist-Bericht(e) versendet` });
  })
);

module.exports = router;
