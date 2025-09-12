// graphRoutes.js
const express = require("express");
const axios = require("axios");
const he = require("he");
const router = express.Router();

const {
  ensureGraphMailSubscription,
  ensureMultipleGraphSubscriptions,
  getAppToken,
  getMessageById,
  listAttachments,
  downloadAttachment,
  listAllSubscriptions,
  deleteSubscription,
  deleteAllSubscriptions,
  clearLocalSubscriptionStore,
  getStoredSubscriptionById,
  logGraphError,
} = require("../GraphService");
const { parseApplicantEmail } = require("../applicantParser");

const registry = require("../config/registry");
const { createTaskFromEmail } = require("../AsanaService");

const GRAPH = "https://graph.microsoft.com/v1.0";

/* ----------------------------- Helpers ----------------------------- */
function htmlToText(html = "") {
  if (!html) return "";
  try {
    html = he.decode(html);
  } catch {}
  return String(html)
    .replace(/<\/(p|div|br|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
// /messages('AAMk...') ODER /messages/AAMk...
function parseMessageIdFromResource(resource = "") {
  let m = resource.match(/\/messages\('([^']+)'\)/i);
  if (m) return m[1];
  m = resource.match(/\/messages\/([^\/\?\s]+)/i);
  return m ? m[1] : null;
}
// UPN/GUID aus /users(...)
function extractUserFromResource(resource = "") {
  const mQuoted = resource.match(/\/users\('([^']+)'\)\//i);
  if (mQuoted) return mQuoted[1];
  const mPlain = resource.match(/\/users\/([^\/]+)\//i);
  if (mPlain) return mPlain[1];
  return null;
}
// simples pLimit
function makePLimit(limit = 5) {
  const queue = [];
  let active = 0;
  return async (fn) => {
    if (active >= limit) await new Promise((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  };
}
// Retry für 404/503
async function withRetry(fn, { tries = 5, delayMs = 200 } = {}) {
  let delay = delayMs;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 || status === 503) {
        console.warn(
          `↻ Retry ${i}/${tries} after ${delay}ms (status=${status})`
        );
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`withRetry: failed after ${tries} attempts`);
}
// $expand Fallback
async function getMessageWithExpandedAttachments(token, upn, messageId) {
  const url =
    `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}` +
    `?$select=id,subject,hasAttachments,from,receivedDateTime,internetMessageId` +
    `&$expand=attachments($select=id,name,contentType,size,isInline)`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

/* --------------------------------- Routes -------------------------------- */

// Health
router.get("/health", (req, res) => res.json({ ok: true }));

// Validation (GET ?validationToken=...)
router.get("/webhook", (req, res) => {
  const token = req.query?.validationToken;
  if (token) return res.status(200).type("text/plain").send(token);
  res.status(200).send("OK");
});

// Notifications
router.post("/webhook", (req, res) => {
  const tokenParam = req.query?.validationToken;
  if (tokenParam) return res.status(200).type("text/plain").send(tokenParam);
  res.sendStatus(202);

  (async () => {
    const expectedState = process.env.GRAPH_CLIENT_STATE || "sf-secret";

    try {
      const notifications = req.body?.value || [];
      if (!notifications.length) return;

      const needsReauth = notifications.some(
        (n) => n.lifecycleEvent === "reauthorizationRequired"
      );
      if (needsReauth) {
        try {
          const accounts = registry.getSubscriptionAccounts(); // [{upn, folderId}]
          await ensureMultipleGraphSubscriptions({
            accounts,
            notificationUrl: process.env.GRAPH_NOTIFICATION_URL,
            clientState: expectedState,
          });
          console.warn(
            "🔁 lifecycleEvent reauthorizationRequired → ensured all subscriptions"
          );
        } catch (e) {
          logGraphError("❌ reauthorization ensure failed", e);
        }
      }

      const appToken = await getAppToken();

      const workSet = new Set();
      const tasks = [];

      for (const n of notifications) {
        try {
          if (n.clientState && n.clientState !== expectedState) {
            console.warn(
              `⚠️ clientState mismatch (got=${n.clientState}, expected=${expectedState})`
            );
          }

          // 1) Favorisiert: aus unserem Store über subscriptionId
          const subInfo = n.subscriptionId
            ? getStoredSubscriptionById(n.subscriptionId)
            : null;
          let upn = subInfo?.upn || null;

          // 2) Notfalls aus resource extrahieren
          if (!upn) {
            const resource = n.resource || "";
            const derivedUser = extractUserFromResource(resource);
            upn = derivedUser || null;
          }

          // 3) Allerletzter Fallback: erstes Team aus Registry
          if (!upn) {
            const acc = registry.getSubscriptionAccounts()[0];
            upn = acc?.upn;
          }

          if (!upn) {
            console.error("❌ No mailbox UPN resolvable for notification:", n);
            continue;
          }

          const resource = n.resource || "";
          const parsedId = parseMessageIdFromResource(resource);
          const messageId = n.resourceData?.id || parsedId;
          if (!messageId) {
            console.warn("⚠️ Notification ohne message id – skipped.", {
              resource,
            });
            continue;
          }

          const key = `${upn}:${messageId}`;
          if (workSet.has(key)) continue;
          workSet.add(key);

          console.log(
            "[notif] subId=%s upn=%s state=%s resId=%s parsedId=%s res=%s",
            n.subscriptionId || "-",
            upn,
            n.clientState,
            n.resourceData?.id || null,
            parsedId || null,
            resource
          );

          tasks.push({ upn, messageId });
        } catch (e) {
          logGraphError("Notification pre-processing error", e);
        }
      }

      const run = makePLimit(5);

      await Promise.all(
        tasks.map(({ upn, messageId }) =>
          run(async () => {
            try {
              const teamForUpn =
                registry
                  .listTeams()
                  .find(
                    (t) =>
                      (t.graph?.upn || "").toLowerCase() ===
                      (upn || "").toLowerCase()
                  ) || null;
              const teamKey = teamForUpn?.key;
              const msg = await withRetry(
                () => getMessageById(appToken, upn, messageId),
                { tries: 5, delayMs: 200 }
              );

              console.log(
                `[msg] id=${messageId} hasAttachments=${
                  msg.hasAttachments
                } subject="${msg.subject}" parentFolderId=${
                  msg.parentFolderId || "-"
                }`
              );

              let atts = await withRetry(
                () => listAttachments(appToken, upn, messageId),
                { tries: 4, delayMs: 250 }
              ).catch(() => []);

              if (
                (msg.hasAttachments === true ||
                  msg.hasAttachments === "true") &&
                (!atts || atts.length === 0)
              ) {
                console.warn(
                  "⚠️ hasAttachments=true aber attachments[] leer → versuche $expand=attachments"
                );
                const msgExpanded = await withRetry(
                  () =>
                    getMessageWithExpandedAttachments(appToken, upn, messageId),
                  { tries: 4, delayMs: 400 }
                );
                atts = (msgExpanded.attachments || []).map((a) => ({
                  id: a.id,
                  name: a.name,
                  contentType: a.contentType,
                  size: a.size,
                  isInline: a.isInline,
                }));
              }

              const listedForDownload = (atts || []).filter((a) => !a.isInline);
              console.log(
                `[atts] count=${listedForDownload?.length || 0} ` +
                  (listedForDownload?.length
                    ? listedForDownload
                        .map((a) => `${a.name} (${a.contentType})`)
                        .join("; ")
                    : "(none)")
              );

              const files = [];
              for (const a of listedForDownload) {
                try {
                  const file = await downloadAttachment(
                    appToken,
                    upn,
                    messageId,
                    a
                  );
                  if (file) files.push(file);
                } catch (e) {
                  logGraphError(`Attachment download failed: ${a?.name}`, e);
                }
              }

              // Email → Asana
              try {
                const bodyHtml = msg?.body?.content || "";
                const bodyText = htmlToText(bodyHtml);
                const senderAddr = msg?.from?.emailAddress?.address || "";
                const subject = msg?.subject || "";
                const fromAddr =
                  msg?.from?.emailAddress?.address || "(unbekannt)";
                const fromName = msg?.from?.emailAddress?.name || fromAddr;
                const parsed = parseApplicantEmail({
                  subject,
                  from: senderAddr,
                  bodyHtml,
                });
                await createTaskFromEmail(
                  {
                    subject: parsed.asana_title, 
                    fromName,
                    fromAddr: senderAddr,
                    receivedDateTime: msg.receivedDateTime,
                    bodyPreview: parsed.asana_body,
                    bodyText: parsed.asana_comment, 
                    bodyHtml,
                    meta: { ...parsed, full_name: parsed.full_name },
                  },
                  files,
                  { upn, teamKey, provider: parsed.quelle }
                );

                console.log(
                  `🧩 Asana task created for "${msg.subject}" with ${files.length} files`
                );
              } catch (e) {
                console.error(
                  "❌ Asana create failed:",
                  e?.response?.data || e.message
                );
              }

              console.log(
                `📥 Mail (${upn}): ${msg.subject} | Files: ${files.length}`
              );
            } catch (e) {
              logGraphError("Notification processing error", e);
            }
          })
        )
      );
    } catch (e) {
      logGraphError("Webhook error (post-response)", e);
    }
  })();
});

// Single ensure (per team ODER direkte upn/folderId)
router.get("/ensure-subscription", async (req, res) => {
  try {
    const team = req.query.team ? registry.getTeam(req.query.team) : null;
    const upn = req.query.upn || team?.graph?.upn;
    const folderId = req.query.folderId || team?.graph?.folderId;

    await ensureGraphMailSubscription({
      userPrincipalName: upn,
      folderId,
      notificationUrl: process.env.GRAPH_NOTIFICATION_URL,
      clientState: process.env.GRAPH_CLIENT_STATE || "sf-secret",
    });
    res.json({
      ok: true,
      message: "Subscription ensured (single)",
      upn,
      folderId,
    });
  } catch (err) {
    console.error(
      "❌ Error ensuring subscription:",
      err?.response?.status || err.message,
      err?.response?.data || ""
    );
    res
      .status(500)
      .json({ ok: false, error: err?.response?.data || err.message });
  }
});

// Multi ensure aus Registry (oder body.accounts)
router.post("/ensure-subscriptions", async (req, res) => {
  try {
    const bodyAccounts = Array.isArray(req.body?.accounts)
      ? req.body.accounts
      : null;
    const accounts = bodyAccounts || registry.getSubscriptionAccounts(); // [{upn, folderId}]
    await ensureMultipleGraphSubscriptions({
      accounts,
      notificationUrl: process.env.GRAPH_NOTIFICATION_URL,
      clientState: process.env.GRAPH_CLIENT_STATE || "sf-secret",
    });
    res.json({
      ok: true,
      count: accounts.length,
      message: "Subscriptions ensured (multi)",
    });
  } catch (err) {
    console.error(
      "❌ Error ensuring subscriptions (multi):",
      err?.response?.status || err.message,
      err?.response?.data || ""
    );
    res
      .status(500)
      .json({ ok: false, error: err?.response?.data || err.message });
  }
});

// Subscriptions anzeigen (optional ?user=<UPN|ObjektId>)
router.get("/subscriptions", async (req, res) => {
  try {
    const token = await getAppToken();
    const all = await listAllSubscriptions(token);
    const user = (req.query.user || "").toLowerCase();
    const filtered = user
      ? all.filter(
          (s) =>
            (s.resource || "").toLowerCase().includes(user) ||
            (s.resource || "")
              .toLowerCase()
              .includes(encodeURIComponent(user)) ||
            (s.resource || "").toLowerCase().includes(`users('${user}')`)
        )
      : all;

    res.json({ count: filtered.length, subscriptions: filtered });
  } catch (e) {
    logGraphError("List subscriptions failed", e);
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

// Alle Subscriptions löschen (optional ?user=<UPN|ObjektId>)
router.delete("/subscriptions", async (req, res) => {
  try {
    const token = await getAppToken();
    const userFilter = req.query.user || null;
    const result = await deleteAllSubscriptions({ token, userFilter });

    clearLocalSubscriptionStore();

    res.json({ ok: true, ...result });
  } catch (e) {
    logGraphError("Delete subscriptions failed", e);
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

module.exports = router;
