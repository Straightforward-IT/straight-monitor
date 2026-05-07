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
  moveMessage,
  listAllSubscriptions,
  deleteSubscription,
  deleteAllSubscriptions,
  clearLocalSubscriptionStore,
  getSubscription,
  getStoredSubscriptionById,
  rememberSubscription,
  logGraphError,
  convertAttachmentToPdf,
  getContacts,
  getContactById,
  searchContacts,
  createContact,
  updateContact,
  deleteContact,
  getMailboxFolderTree,
  getMailFolderInsights,
} = require("../GraphService");
const { parseApplicantEmail } = require("../applicantParser");
const { runApplicantMailRetentionCleanup } = require("../ApplicantMailRetentionService");

const registry = require("../config/registry");
const { createTaskFromEmail } = require("../AsanaService");
const User = require("../models/User");
const asyncHandler = require("../middleware/AsyncHandler");

const GRAPH = "https://graph.microsoft.com/v1.0";

/* ----------------------------- Helpers ----------------------------- */
function normalizePersonName(name = "") {
  if (!name || typeof name !== "string") return "";
  // Normalisiert Namen: Erster Buchstabe jedes Wortes groß, Rest klein
  return name
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

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
  // Format 1: /users('email@domain.com')/mailFolders/...
  const mQuoted = resource.match(/\/users\('([^']+)'\)\//i);
  if (mQuoted) return mQuoted[1];
  
  // Format 2: /users/email@domain.com/mailFolders/...
  const mPlain = resource.match(/\/users\/([^\/]+@[^\/]+)\//i);
  if (mPlain) return mPlain[1];
  
  // Format 3: Users/email@domain.com/Messages/... (no leading slash, capitalized)
  const mCapital = resource.match(/Users\/([^\/]+@[^\/]+)\//i);
  if (mCapital) return mCapital[1];
  
  return null;
}

function extractUserGuidFromResource(resource = "") {
  // Extract GUID from: Users/3326a1b7-a0c9-4f45-9d26-c0f8895d71f5/Messages/...
  const guidPattern = /Users\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//i;
  const match = resource.match(guidPattern);
  return match ? match[1] : null;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return null;
}

function parseFolderIdFromResource(resource = "") {
  let m = resource.match(/\/mailFolders\('([^']+)'\)\//i);
  if (m) return m[1];
  m = resource.match(/\/mailFolders\/([^\/\?\s]+)\//i);
  return m ? m[1] : null;
}
/**
 * Konvertiert eine DOCX-Datei (base64) zu PDF via Microsoft Graph (OneDrive + ?$format=pdf).
 * Erfordert Files.ReadWrite.All (Application) in der Azure App Registration.
 * Gibt ein neues file-Objekt zurück oder das Original bei Fehler.
 */
async function convertDocxToPdf(file, token, upn) {
  try {
    const inputBuf = Buffer.from(file.contentBytes, "base64");
    const pdfBuf = await convertAttachmentToPdf(token, upn, inputBuf, file.name);
    const pdfName = file.name.replace(/\.docx?$/i, ".pdf");
    console.log(`📄 Converted ${file.name} → ${pdfName} (${pdfBuf.length} bytes)`);
    return {
      name: pdfName,
      contentType: "application/pdf",
      contentBytes: pdfBuf.toString("base64"),
      size: pdfBuf.length,
    };
  } catch (e) {
    console.error(`⚠️ DOCX→PDF conversion failed for ${file.name}:`, e.message);
    return file; // Fallback: Original-DOCX hochladen
  }
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
async function getMessageWithExpandedAttachments(token, upn, messageId, folderId = null) {
  // Use folder-specific endpoint if folderId provided
  let url;
  if (folderId) {
    url =
      `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}/messages/${messageId}` +
      `?$select=id,subject,hasAttachments,from,receivedDateTime,internetMessageId` +
      `&$expand=attachments($select=id,name,contentType,size,isInline)`;
  } else {
    url =
      `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}` +
      `?$select=id,subject,hasAttachments,from,receivedDateTime,internetMessageId` +
      `&$expand=attachments($select=id,name,contentType,size,isInline)`;
  }
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
              `⚠️ clientState mismatch (got=${n.clientState}, expected=${expectedState})`);
            continue;
          }

          const resource = n.resource || "";
          let upn = null;

          // Strategy 1: Get UPN from stored subscription by ID (most reliable after proper setup)
          if (n.subscriptionId) {
            const subInfo = getStoredSubscriptionById(n.subscriptionId);
            if (subInfo?.upn) {
              upn = subInfo.upn;
              console.log(`[upn-source] subscription-store (subId=${n.subscriptionId})`);
            } else {
              try {
                const liveSubscription = await getSubscription({ token: appToken, id: n.subscriptionId });
                const liveResource = liveSubscription?.resource || "";
                const liveUpn = extractUserFromResource(liveResource);
                const liveFolderId = parseFolderIdFromResource(liveResource);

                if (liveUpn) {
                  upn = liveUpn;
                  console.log(`[upn-source] subscription-live (subId=${n.subscriptionId})`);
                } else if (liveFolderId) {
                  const matchedAccount = registry
                    .getSubscriptionAccounts()
                    .find((account) => account.folderId === liveFolderId);
                  if (matchedAccount?.upn) {
                    upn = matchedAccount.upn;
                    console.log(`[upn-source] subscription-folder-match (subId=${n.subscriptionId})`);
                  }
                }

                if (upn && liveFolderId) {
                  rememberSubscription({
                    id: n.subscriptionId,
                    upn,
                    folderId: liveFolderId,
                    resource: liveResource,
                    expirationDateTime: liveSubscription?.expirationDateTime,
                  });
                }
              } catch (lookupError) {
                logGraphError(`[upn-source] subscription lookup failed (${n.subscriptionId})`, lookupError);
              }
            }
          }

          // Strategy 2: Try to extract UPN/email from resource field
          if (!upn) {
            const derivedUser = extractUserFromResource(resource);
            if (derivedUser) {
              upn = derivedUser;
              console.log(`[upn-source] resource-extraction (${resource})`);
            }
          }

          // Strategy 3: Match GUID from resource to team configs
          if (!upn) {
            const guid = extractUserGuidFromResource(resource);
            if (guid) {
              console.log(`[upn-source] attempting GUID match (${guid})`);
              // We can't reliably map GUID to UPN without Microsoft Graph lookup
              // This is a limitation - GUID changes and isn't stable
            }
          }

          if (!upn) {
            console.error("❌ No mailbox UPN resolvable for notification; skipped:", {
              subscriptionId: n.subscriptionId,
              resource,
            });
            continue;
          }

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
                registry.getTeamByUpn(upn) || null;
              const teamKey = teamForUpn?.key;
              const folderId = registry.getGraphSubscription(teamForUpn)?.folderId || null;
              
              const msg = await withRetry(
                () => getMessageById(appToken, upn, messageId, folderId),
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
                () => listAttachments(appToken, upn, messageId, folderId),
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
                    getMessageWithExpandedAttachments(appToken, upn, messageId, folderId),
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
                    a,
                    folderId
                  );
                  if (file) files.push(file);
                } catch (e) {
                  logGraphError(`Attachment download failed: ${a?.name}`, e);
                }
              }

              // DOCX → PDF konvertieren (Asana kann kein DOCX preview)
              // Bei Erfolg: nur PDF hochladen, Original-DOCX verwerfen
              // Bei Fehler: Original-DOCX als Fallback
              const uploadFiles = [];
              for (const file of files) {
                if (/\.docx?$/i.test(file.name)) {
                  const pdf = await convertDocxToPdf(file, appToken, upn);
                  uploadFiles.push(pdf); // pdf = konvertiert ODER original (Fallback)
                } else {
                  uploadFiles.push(file);
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
                
                // Normalisiere Bewerbername (Erster Buchstabe groß, Rest klein)
                if (parsed.full_name) {
                  parsed.full_name = normalizePersonName(parsed.full_name);
                }
                if (parsed.asana_title) {
                  parsed.asana_title = normalizePersonName(parsed.asana_title);
                }
                
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
                  uploadFiles,
                  { upn, teamKey, provider: parsed.quelle }
                );

                const destinationFolder = registry.getGraphFolder(teamForUpn, "asanaTask");
                if (!destinationFolder?.id) {
                  console.warn(`⚠️ No asanaTask folder configured for team ${teamKey || "unknown"}; mail not moved.`);
                } else if (
                  destinationFolder.userPrincipalName &&
                  String(destinationFolder.userPrincipalName).toLowerCase() !== String(upn).toLowerCase()
                ) {
                  console.warn(
                    `⚠️ asanaTask folder mailbox mismatch for team ${teamKey || "unknown"}: ` +
                    `source=${upn}, target=${destinationFolder.userPrincipalName}`
                  );
                } else if (destinationFolder.id === folderId) {
                  console.log(`↪️ Mail already in asanaTask folder for team ${teamKey || "unknown"}; skipping move.`);
                } else {
                  try {
                    await moveMessage(appToken, upn, messageId, destinationFolder.id, folderId);
                    console.log(
                      `📦 Mail moved to asanaTask for team ${teamKey || "unknown"}: ` +
                      `${msg.subject}`
                    );
                  } catch (moveError) {
                    logGraphError("Mail move to asanaTask failed", moveError);
                  }
                }

                console.log(
                  `🧩 Asana task created for "${msg.subject}" with ${uploadFiles.length} files`
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
    const subscription = team ? registry.getGraphSubscription(team) : null;
    const upn = req.query.upn || subscription?.userPrincipalName;
    const folderId = req.query.folderId || subscription?.folderId;

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

/* ----------------------------- Contacts ---------------------------------- */

const auth = require("../middleware/auth");

async function requireAdmin(req, res) {
  const admin = await User.findById(req.user.id).select("role roles");
  if (!admin || !admin.roles?.includes("ADMIN")) {
    res.status(403).json({ ok: false, error: "Zugriff verweigert – nur für Admins" });
    return null;
  }
  return admin;
}

function getMailboxUpnForTeam(team) {
  return registry.getGraphMailboxUpn(team) || null;
}

/* ------------------------- Mailbox Dashboard ------------------------------ */

router.get("/mailboxes/accounts", auth, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const accounts = registry.listTeams({ includeDevelopmentOnly: true })
      .filter((team) => getMailboxUpnForTeam(team))
      .sort((left, right) => {
        if (left.developmentOnly === right.developmentOnly) return 0;
        return left.developmentOnly ? 1 : -1;
      })
      .map((team) => {
        const mailboxUpn = getMailboxUpnForTeam(team);
        const subscriptionUpn = registry.getGraphSubscription(team)?.userPrincipalName || null;

        return {
          key: team.key,
          displayName: team.displayName || team.key,
          upn: mailboxUpn,
          sharedMailbox: subscriptionUpn && subscriptionUpn !== mailboxUpn ? mailboxUpn : null,
          aliases: team.aliases || [],
        };
      });

    res.json({ ok: true, accounts });
  } catch (e) {
    logGraphError("GET /mailboxes/accounts failed", e);
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

router.get("/mailboxes/tree", auth, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const team = registry.getTeam(req.query.team || "");
    const userPrincipalName = getMailboxUpnForTeam(team);
    if (!userPrincipalName) {
      return res.status(400).json({ ok: false, error: `Team '${team.key}' has no mailbox configured` });
    }

    const includeHiddenFolders = String(req.query.includeHidden || "true").toLowerCase() !== "false";
    const result = await getMailboxFolderTree({ userPrincipalName, includeHiddenFolders });

    res.json({
      ok: true,
      team: team.key,
      displayName: team.displayName || team.key,
      mailbox: userPrincipalName,
      ...result,
    });
  } catch (e) {
    logGraphError("GET /mailboxes/tree failed", e);
    const status = /Unknown team/i.test(e.message) ? 400 : 500;
    res.status(status).json({ ok: false, error: e?.response?.data || e.message });
  }
});

router.post("/mail-retention/run", auth, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const teamKeys = normalizeStringList(body.teamKeys);
    const folderKeys = normalizeStringList(body.folderKeys);
    const dryRun = typeof body.dryRun === "boolean"
      ? body.dryRun
      : typeof body.dryRun === "string"
        ? body.dryRun.toLowerCase() === "true"
        : undefined;
    const triggerId = `mail-retention-${Date.now()}`;

    res.status(202).json({
      ok: true,
      started: true,
      triggerId,
      dryRun: typeof dryRun === "boolean" ? dryRun : null,
      teamKeys: teamKeys || [],
      folderKeys: folderKeys || [],
      message: "Mail retention cleanup started.",
    });

    (async () => {
      try {
        console.log(
          `🚀 [${triggerId}] Starting mail retention cleanup ` +
          `(dryRun=${typeof dryRun === "boolean" ? dryRun : "env"}, ` +
          `teamKeys=${teamKeys?.join(",") || "all"}, folderKeys=${folderKeys?.join(",") || "all"})`
        );
        const result = await runApplicantMailRetentionCleanup({ dryRun, teamKeys, folderKeys });
        console.log(`✅ [${triggerId}] Mail retention cleanup finished:`);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(`❌ [${triggerId}] Mail retention cleanup failed:`, error.message);
        if (error.summary || error.errors) {
          console.error(JSON.stringify({ summary: error.summary || [], errors: error.errors || [] }, null, 2));
        }
      }
    })();
  } catch (e) {
    const status = /Unknown team/i.test(e.message) ? 400 : 500;
    res.status(status).json({ ok: false, error: e?.response?.data || e.message });
  }
});

router.get("/mailboxes/folder-insights", auth, async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const team = registry.getTeam(req.query.team || "");
    const userPrincipalName = getMailboxUpnForTeam(team);
    if (!userPrincipalName) {
      return res.status(400).json({ ok: false, error: `Team '${team.key}' has no mailbox configured` });
    }

    const folderId = req.query.folderId || null;
    const folderPath = req.query.folderPath || null;
    if (!folderId && !folderPath) {
      return res.status(400).json({ ok: false, error: "folderId or folderPath required" });
    }

    const includeHiddenFolders = String(req.query.includeHidden || "true").toLowerCase() !== "false";
    const result = await getMailFolderInsights({
      userPrincipalName,
      folderId,
      folderPath,
      includeHiddenFolders,
    });

    res.json({
      ok: true,
      team: team.key,
      displayName: team.displayName || team.key,
      mailbox: userPrincipalName,
      ...result,
    });
  } catch (e) {
    logGraphError("GET /mailboxes/folder-insights failed", e);
    const status = /Unknown team|folderId or folderPath required|Mail folder not found/i.test(e.message)
      ? 400
      : 500;
    res.status(status).json({ ok: false, error: e?.response?.data || e.message });
  }
});

// GET /api/graph/contacts?team=hamburg|berlin|koeln&q=searchterm
// When q is provided → fast server-side search (max 25 per mailbox)
// Without q          → full paginated list (all contacts)
router.get("/contacts", auth, async (req, res) => {
  try {
    const token = await getAppToken();
    const teamFilter = req.query.team;
    const q = (req.query.q || '').trim();

    let teams;
    if (teamFilter) {
      try {
        teams = [registry.getTeam(teamFilter)];
      } catch {
        return res.status(400).json({ ok: false, error: `Unknown team '${teamFilter}'` });
      }
    } else {
      teams = registry.listTeams().filter(t => !t.developmentOnly && registry.getGraphMailboxUpn(t));
    }

    const allContacts = [];
    for (const t of teams) {
      const upn = registry.getGraphMailboxUpn(t);
      if (!upn) continue;
      try {
        const contacts = q
          ? await searchContacts(token, upn, q)
          : await getContacts(token, upn);
        allContacts.push(
          ...contacts.map(c => ({ ...c, _team: t.key, _upn: upn }))
        );
      } catch (e) {
        logGraphError(`Contacts fetch failed for ${upn}`, e);
      }
    }

    res.json({ ok: true, count: allContacts.length, contacts: allContacts });
  } catch (e) {
    logGraphError("GET /contacts failed", e);
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

// POST /api/graph/contacts — Neuen Microsoft-Kontakt anlegen
// Body: { upn?, team?, givenName, surname, companyName?, jobTitle?, email?, mobilePhone?, businessPhone? }
// Accepts either upn directly or team key (resolved via registry)
router.post("/contacts", auth, asyncHandler(async (req, res) => {
  const { upn: rawUpn, team, givenName, surname, companyName, jobTitle, email, mobilePhone, businessPhone } = req.body;

  let upn = rawUpn;
  if (!upn && team) {
    try {
      const t = registry.getTeam(team);
      upn = registry.getGraphMailboxUpn(t);
    } catch {
      return res.status(400).json({ ok: false, error: `Unbekanntes Team '${team}'` });
    }
  }

  if (!upn) return res.status(400).json({ ok: false, error: '"upn" oder "team" ist erforderlich.' });
  if (!givenName && !surname) return res.status(400).json({ ok: false, error: 'Vor- oder Nachname erforderlich.' });

  const fields = {
    givenName:  givenName  || '',
    surname:    surname    || '',
    displayName: [givenName, surname].filter(Boolean).join(' '),
  };
  if (companyName)   fields.companyName   = companyName;
  if (jobTitle)      fields.jobTitle      = jobTitle;
  if (mobilePhone)   fields.mobilePhone   = mobilePhone;
  if (businessPhone) fields.businessPhones = [businessPhone];
  if (email)         fields.emailAddresses = [{ address: email, name: fields.displayName }];

  const token = await getAppToken();
  const contact = await createContact(token, upn, fields);

  res.status(201).json({ ok: true, contact: { ...contact, _upn: upn } });
}));

// GET /api/graph/contacts/:contactId?upn=...
router.get("/contacts/:contactId", auth, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  const { upn } = req.query;
  if (!upn) return res.status(400).json({ ok: false, error: 'upn required' });
  const token = await getAppToken();
  const contact = await getContactById(token, upn, contactId);
  res.json({ ok: true, contact: { ...contact, _upn: upn } });
}));

// PATCH /api/graph/contacts/:contactId  — Update contact fields
router.patch("/contacts/:contactId", auth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { upn, ...fields } = req.body;

    if (!upn) return res.status(400).json({ ok: false, error: "upn required" });

    // Whitelist erlaubter Felder
    const allowed = ['givenName', 'surname', 'companyName', 'jobTitle', 'mobilePhone', 'businessPhones', 'emailAddresses'];
    const patch = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) patch[key] = fields[key];
    }
    if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: "No valid fields provided" });

    const token = await getAppToken();
    const updated = await updateContact(token, upn, contactId, patch);
    res.json({ ok: true, contact: updated });
  } catch (e) {
    logGraphError(`PATCH /contacts/${req.params.contactId} failed`, e);
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

// DELETE /api/graph/contacts/:contactId
router.delete("/contacts/:contactId", auth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { upn } = req.body;

    if (!upn) return res.status(400).json({ ok: false, error: "upn required" });

    const token = await getAppToken();
    await deleteContact(token, upn, contactId);
    res.json({ ok: true });
  } catch (e) {
    logGraphError(`DELETE /contacts/${req.params.contactId} failed`, e);
    res.status(500).json({ ok: false, error: e?.response?.data || e.message });
  }
});

module.exports = router;
