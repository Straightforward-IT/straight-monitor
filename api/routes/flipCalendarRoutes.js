const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/AsyncHandler");
const {
  getFlipCalendarEvents,
  createFlipCalendarEvent,
  getFlipCalendarOverview,
  getFlipCalendarEvent,
  updateFlipCalendarEvent,
} = require("../FlipService");
const Einsatz = require("../models/Einsatz");
const Auftrag = require("../models/Auftrag");
const Mitarbeiter = require("../models/Mitarbeiter");
const logger = require("../utils/logger");

/**
 * Creates a deterministic UUID (v4-formatted) from a MongoDB ObjectId string.
 * Used as the Flip API idempotency key so that re-running the sync never
 * creates duplicate calendar events for the same Einsatz.
 */
function einsatzToFlipEventId(einsatzId) {
  const hash = crypto.createHash("sha256").update(`einsatz:${einsatzId}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

/**
 * Combine a date and a "HH:MM" local-time string into an ISO UTC string.
 * The uhrzeit values in Einsatz are Europe/Berlin local time.
 * Returns an ISO 8601 string with an explicit Berlin offset (DST-aware),
 * e.g. "2026-05-12T10:00:00+02:00". Flip requires an offset on time_slot.
 */
function buildDateTime(date, timeStr) {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(d.getUTCDate()).padStart(2, "0");
  let hh = "00", min = "00";
  if (timeStr) {
    const parts = String(timeStr).split(":");
    hh  = String(parseInt(parts[0], 10)).padStart(2, "0");
    min = String(parseInt(parts[1] || "0", 10)).padStart(2, "0");
  }
  const naive = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
  // DST-aware Berlin offset via Intl
  const probe = new Date(`${naive}Z`);
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const tzName = tzParts.find(p => p.type === "timeZoneName")?.value || "GMT+1";
  const m = tzName.match(/GMT([+-]\d+)/);
  const hours = m ? parseInt(m[1], 10) : 1;
  const offset = `${hours >= 0 ? "+" : "-"}${String(Math.abs(hours)).padStart(2, "0")}:00`;
  return `${naive}${offset}`;
}

/**
 * GET /api/flip-calendar/events
 * List events for the authenticated Flip user.
 * Query: start_after, start_before, end_after, end_before, rsvp_status, order_by, page_cursor, page_limit
 */
router.get(
  "/events",
  auth,
  asyncHandler(async (req, res) => {
    const { start_after, start_before, end_after, end_before, rsvp_status, order_by, page_cursor, page_limit } = req.query;
    const params = {};
    if (start_after) params.start_after = start_after;
    if (start_before) params.start_before = start_before;
    if (end_after) params.end_after = end_after;
    if (end_before) params.end_before = end_before;
    if (rsvp_status) params.rsvp_status = rsvp_status;
    if (order_by) params.order_by = order_by;
    if (page_cursor) params.page_cursor = page_cursor;
    if (page_limit) params.page_limit = page_limit;

    const data = await getFlipCalendarEvents(params);
    res.json(data);
  })
);

/**
 * POST /api/flip-calendar/events
 * Create a new calendar event.
 * Body JSON: { title, time_slot, location?, body?, participants?, attachments?, show_participant_list?, id? }
 */
router.post(
  "/events",
  auth,
  asyncHandler(async (req, res) => {
    const { title, time_slot } = req.body;
    if (!title || !time_slot) {
      return res.status(400).json({ message: "title und time_slot sind erforderlich." });
    }
    const data = await createFlipCalendarEvent(req.body);
    res.status(201).json(data);
  })
);

/**
 * GET /api/flip-calendar/events/overview
 * Returns counts of upcoming events grouped by period.
 * Query: time_zone (required, IANA, e.g. "Europe/Berlin")
 */
router.get(
  "/events/overview",
  auth,
  asyncHandler(async (req, res) => {
    const { time_zone } = req.query;
    if (!time_zone) {
      return res.status(400).json({ message: "time_zone ist erforderlich." });
    }
    const data = await getFlipCalendarOverview(time_zone);
    res.json(data);
  })
);

/**
 * GET /api/flip-calendar/events/:eventId
 * Get full details for a single event.
 * Query: body_format (comma-separated: PLAIN,HTML,DELTA)
 */
router.get(
  "/events/:eventId",
  auth,
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const bodyFormat = req.query.body_format
      ? String(req.query.body_format).split(",").map((s) => s.trim().toUpperCase())
      : undefined;
    const data = await getFlipCalendarEvent(eventId, bodyFormat);
    res.json(data);
  })
);

/**
 * PATCH /api/flip-calendar/events/:eventId
 * Partially update a calendar event (organizer only).
 * Body JSON: { title?, time_slot?, location?, status?, body?, attachments?, show_participant_list?, participants_notification? }
 */
router.patch(
  "/events/:eventId",
  auth,
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    if (!Object.keys(req.body).length) {
      return res.status(400).json({ message: "Mindestens ein Feld muss angegeben werden." });
    }
    const data = await updateFlipCalendarEvent(eventId, req.body);
    res.json(data);
  })
);

/**
 * POST /api/flip-calendar/sync-einsaetze-test
 * Test: Creates Flip calendar events for all Einsätze of a Mitarbeiter.
 * Body JSON: { personalnr? }  — defaults to "2000637"
 * Returns a summary: { mitarbeiter, einsaetze_total, created[], skipped[], errors[] }
 */
router.post(
  "/sync-einsaetze-test",
  auth,
  asyncHandler(async (req, res) => {
    const personalnr = String(req.body.personalnr || "2000637");

    const mitarbeiter = await Mitarbeiter.findOne({ personalnr });
    if (!mitarbeiter) {
      return res.status(404).json({ message: `Mitarbeiter mit Personalnr ${personalnr} nicht gefunden.` });
    }

    const now = new Date();
    const einsaetze = await Einsatz.find({
      personalNr: Number(personalnr),
      $or: [
        { detailDatumVon: { $gte: now } },
        { datumVon: { $gte: now } },
      ],
    });
    logger.info(`sync-einsaetze-test: ${einsaetze.length} Einsätze für Personalnr ${personalnr}`);

    const results = { created: [], skipped: [], errors: [] };

    for (const einsatz of einsaetze) {
      try {
        const auftrag = await Auftrag.findOne({ auftragNr: einsatz.auftragNr });

        // ── Zeitraum ──────────────────────────────────────────────────────────
        const startDate = einsatz.detailDatumVon || einsatz.datumVon;
        const endDate   = einsatz.detailDatumBis || einsatz.datumBis;

        if (!startDate) {
          results.skipped.push({ einsatz: einsatz._id, auftragNr: einsatz.auftragNr, reason: "Kein Startdatum" });
          continue;
        }

        const start = buildDateTime(startDate, einsatz.uhrzeitVon);

        // If no end time is available, fall back to +1 hour to avoid INVALID_TIME_RANGE.
        let end = buildDateTime(endDate || startDate, einsatz.uhrzeitBis);
        if (!end || end === start) {
          // start has explicit offset, parse and add 1h
          const fb = new Date(start);
          fb.setUTCHours(fb.getUTCHours() + 1);
          // Reuse buildDateTime by passing the new date and HH:MM derived in Berlin TZ
          const berlinHHMM = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Berlin",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(fb);
          end = buildDateTime(fb, berlinHHMM);
        }

        // ── Titel ─────────────────────────────────────────────────────────────
        const rawTitle =
          auftrag?.eventTitel ||
          einsatz.schichtBezeichnung ||
          einsatz.bezeichnung ||
          `Einsatz ${einsatz.auftragNr}`;
        // Flip enforces max 200 chars on title
        const title = rawTitle.substring(0, 200);

        // ── Location ──────────────────────────────────────────────────────────
        const locationParts = [
          auftrag?.eventLocation || auftrag?.eventStrasse,
          [auftrag?.eventPlz, auftrag?.eventOrt].filter(Boolean).join(" "),
        ].filter(Boolean);
        // Strip only HTML entities left by Zvoove data (> is part of the company name)
        const location = locationParts
          .join(", ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();

        // ── Body ──────────────────────────────────────────────────────────────
        const bodyLines = [];
        if (einsatz.schichtBezeichnung) bodyLines.push(`Schicht: ${einsatz.schichtBezeichnung}`);
        if (einsatz.treffpunkt)         bodyLines.push(`Treffpunkt: ${einsatz.treffpunkt}`);
        if (auftrag?.auftragNr)         bodyLines.push(`Auftrag-Nr: ${auftrag.auftragNr}`);
        if (einsatz.ansprechpartnerName)    bodyLines.push(`Ansprechpartner: ${einsatz.ansprechpartnerName}`);
        if (einsatz.ansprechpartnerTelefon) bodyLines.push(`Tel: ${einsatz.ansprechpartnerTelefon}`);
        if (einsatz.ansprechpartnerEmail)   bodyLines.push(`E-Mail: ${einsatz.ansprechpartnerEmail}`);

        // ── Event aufbauen ────────────────────────────────────────────────────
        const eventData = {
          id: einsatzToFlipEventId(einsatz._id), // idempotency key — prevents duplicates on re-sync
          title,
          time_slot: {
            start,
            end,
            time_zone: "Europe/Berlin",
          },
        };
        if (location.length)  eventData.location = location.substring(0, 1000);
        // Invite the Mitarbeiter via their Flip user ID
        if (mitarbeiter.flip_id) {
          eventData.participants = [{ type: "USER", id: mitarbeiter.flip_id }];
        }

        logger.info(`sync-einsaetze-test: Sende Event-Payload:`, JSON.stringify(eventData));

        const created = await createFlipCalendarEvent(eventData);
        logger.info(`sync-einsaetze-test: Flip Antwort:`, JSON.stringify(created));

        // If the event already existed and a participant declined,
        // reset RSVP statuses + re-invite via PATCH.
        const declined = created?.participant_counts?.declined || 0;
        if (declined > 0) {
          await updateFlipCalendarEvent(created.id, {
            title: eventData.title, // no-op patch — Flip requires at least one field
            participants_notification: "RESET_NOTIFICATION",
          });
          logger.info(`sync-einsaetze-test: Re-invite gesendet für Event ${created.id} (declined=${declined})`);
        }

        results.created.push({
          einsatz:  einsatz._id,
          auftragNr: einsatz.auftragNr,
          event_id: created.id,
          title,
          re_invited: declined > 0,
        });
      } catch (err) {
        const flipError = err.response?.data || err.message;
        logger.error(`sync-einsaetze-test: Fehler bei Einsatz ${einsatz._id}:`, JSON.stringify(flipError));
        results.errors.push({
          einsatz:  einsatz._id,
          auftragNr: einsatz.auftragNr,
          error:    flipError,
        });
      }
    }

    res.json({
      mitarbeiter: {
        id:      mitarbeiter._id,
        name:    `${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
        flip_id: mitarbeiter.flip_id || null,
      },
      einsaetze_total: einsaetze.length,
      ...results,
    });
  })
);

module.exports = router;
