// GraphService.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const TENANT = process.env.GRAPH_TENANT_ID;
const CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;

const GRAPH = "https://graph.microsoft.com/v1.0";
const STORE = path.join(process.cwd(), ".graph-subscription.json");

/* ----------------------------- Logging Helper ----------------------------- */
function logGraphError(prefix, err) {
  const st = err?.response?.status;
  const data = err?.response?.data;
  const rid =
    err?.response?.headers?.["request-id"] ||
    err?.response?.headers?.["x-ms-ags-diagnostic"];
  console.error(
    `${prefix}:`,
    st || err.message,
    data ? JSON.stringify(data) : "",
    rid ? `request-id=${rid}` : ""
  );
}

/* --------------------------------- Auth ---------------------------------- */
async function getAppToken() {
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");
  const { data } = await axios.post(url, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data.access_token;
}

/* ------------------------------- Store Utils ----------------------------- */
// Struktur: { subscriptions: { byId: {subId: {...}}, byKey: { "upn|folderId": subId } } }
function loadStore() {
  try {
    const obj = JSON.parse(fs.readFileSync(STORE, "utf8"));
    if (!obj.subscriptions) obj.subscriptions = { byId: {}, byKey: {} };
    if (!obj.subscriptions.byId) obj.subscriptions.byId = {};
    if (!obj.subscriptions.byKey) obj.subscriptions.byKey = {};
    return obj;
  } catch {
    return { subscriptions: { byId: {}, byKey: {} } };
  }
}
function saveStore(obj) {
  fs.writeFileSync(STORE, JSON.stringify(obj, null, 2));
}
function makeKey(upn, folderId) {
  return `${upn}|${folderId}`;
}
function upsertStoreSubscription({ id, upn, folderId, resource, expirationDateTime }) {
  const store = loadStore();
  store.subscriptions.byId[id] = { upn, folderId, resource, expirationDateTime };
  store.subscriptions.byKey[makeKey(upn, folderId)] = id;
  saveStore(store);
}
function removeStoreSubscriptionById(id) {
  const store = loadStore();
  const info = store.subscriptions.byId[id];
  if (info) {
    const key = makeKey(info.upn, info.folderId);
    delete store.subscriptions.byId[id];
    if (store.subscriptions.byKey[key] === id) delete store.subscriptions.byKey[key];
    saveStore(store);
  }
}
function getStoredSubscriptionById(id) {
  const store = loadStore();
  return store.subscriptions.byId[id] || null;
}
function getStoredSubscriptionByKey(upn, folderId) {
  const store = loadStore();
  const id = store.subscriptions.byKey[makeKey(upn, folderId)];
  return id ? { id, ...(store.subscriptions.byId[id] || {}) } : null;
}

/* -------------------------- Subscription Utilities ----------------------- */
function buildMailResourceCandidates({ upn, folderId }) {
  // Wichtig: in der OData-Variante KEIN Encoding innerhalb der Quotes!
  const rawUpn = upn;
  const fid = folderId;
  const upnEnc = encodeURIComponent(upn);
  const fidEnc = encodeURIComponent(fid);

  if (folderId) {
    return [
      `/users('${rawUpn}')/mailFolders('${fid}')/messages`, // OData-Key
      `/users/${upnEnc}/mailFolders/${fidEnc}/messages`,     // Pfadsegmente
    ];
  }
  return [
    `/users('${rawUpn}')/mailFolders('Inbox')/messages`,
    `/users/${upnEnc}/mailFolders/inbox/messages`,
  ];
}
function buildDesiredResource({ upn, folderId }) {
  return buildMailResourceCandidates({ upn, folderId })[0];
}
function expirationIso(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

function filterSubsForResource(allSubs = [], { upn, folderId }) {
  const candidates = buildMailResourceCandidates({ upn, folderId })
    .map((r) => r.toLowerCase());
  return allSubs.filter((s) => candidates.includes((s.resource || "").toLowerCase()));
}

/** Beste Subscription wählen: höchste expirationDateTime */
function pickBest(subs = []) {
  if (!subs.length) return null;
  return subs.slice().sort((a, b) => {
    const ta = new Date(a.expirationDateTime).getTime() || 0;
    const tb = new Date(b.expirationDateTime).getTime() || 0;
    return tb - ta;
  })[0];
}

/** Doppelte für eine Quelle (clientState+notificationUrl) entfernen – nur beste behalten */
async function pruneDuplicatesForSource({ token, subs, keep }) {
  const toDelete = subs.filter((s) => s.id !== keep.id);
  for (const s of toDelete) {
    try {
      await axios.delete(`${GRAPH}/subscriptions/${s.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      removeStoreSubscriptionById(s.id);
      console.log(`🧹 Deleted duplicate subscription ${s.id}`);
    } catch (e) {
      logGraphError(`⚠️ delete dup ${s.id} failed`, e);
    }
  }
}

async function createSubscription({ token, upn, folderId, notificationUrl, clientState }) {
  const candidates = buildMailResourceCandidates({ upn, folderId });
  let lastErr;
  for (const resource of candidates) {
    try {
      const body = {
        changeType: "created", // ggf. "created,updated"
        notificationUrl,
        resource,
        expirationDateTime: expirationIso(4200),
        clientState: clientState || "sf-secret",
      };
      const { data } = await axios.post(`${GRAPH}/subscriptions`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`🎯 Created Graph subscription: ${data.id} → ${resource}`);
      return data;
    } catch (e) {
      logGraphError(`⚠️ createSubscription failed for resource=${resource}`, e);
      lastErr = e;
    }
  }
  throw lastErr || new Error("createSubscription failed for all resource formats");
}
async function renewSubscription({ token, id }) {
  const body = { expirationDateTime: expirationIso(4200) };
  const { data } = await axios.patch(`${GRAPH}/subscriptions/${id}`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
async function getSubscription({ token, id }) {
  const { data } = await axios.get(`${GRAPH}/subscriptions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

/** Ensure genau EINE Sub für {upn, folderId}. */
async function ensureGraphMailSubscription({ userPrincipalName, folderId, notificationUrl, clientState }) {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) throw new Error("GRAPH client env missing");
  if (!userPrincipalName) throw new Error("userPrincipalName required");
  if (!notificationUrl) throw new Error("notificationUrl required");

  const token = await getAppToken();
  const desiredResource = buildDesiredResource({ upn: userPrincipalName, folderId });

  // 1) Alle Subs laden + auf diese Mailbox/Folder einschränken
  const all = await listAllSubscriptions(token);
  const mine = filterSubsForResource(all, { upn: userPrincipalName, folderId });

  // 2) Nach Quelle gruppieren
  const isSameSource = (s) =>
    (s.clientState || "") === (clientState || "") &&
    (s.notificationUrl || "").toLowerCase() === (notificationUrl || "").toLowerCase();

  const sameSource = mine.filter(isSameSource);
  const otherSource = mine.filter((s) => !isSameSource(s)); // z.B. dev vs prod

  // 3) Andere Quelle(n): auf max. 1 reduzieren (ältere löschen, eine beste bleibt)
  if (otherSource.length > 1) {
    const bestOther = pickBest(otherSource);
    await pruneDuplicatesForSource({ token, subs: otherSource, keep: bestOther });
  }

  // 4) Diese Quelle: Fälle behandeln
  if (sameSource.length > 0) {
    // Es existiert schon ≥1 passende Sub → nur beste behalten, Rest löschen
    const best = pickBest(sameSource);
    if (sameSource.length > 1) {
      await pruneDuplicatesForSource({ token, subs: sameSource, keep: best });
    }

    // Falls nahe am Ablauf → erneuern
    try {
      const minLeft = (new Date(best.expirationDateTime).getTime() - Date.now()) / 60000;
      if (minLeft < 360) {
        const renewed = await renewSubscription({ token, id: best.id });
        upsertStoreSubscription({
          id: renewed.id || best.id,
          upn: userPrincipalName,
          folderId,
          resource: renewed.resource || desiredResource,
          expirationDateTime: renewed.expirationDateTime,
        });
        console.log(`✅ Renewed subscription (this source) for ${userPrincipalName}`);
      } else {
        // Store aktualisieren (falls noch nicht da)
        upsertStoreSubscription({
          id: best.id,
          upn: userPrincipalName,
          folderId,
          resource: best.resource || desiredResource,
          expirationDateTime: best.expirationDateTime,
        });
        console.log(`👌 Subscription OK (this source) for ${userPrincipalName} (~${Math.round(minLeft)}min left)`);
      }
      return; // fertig: schon 1 Sub für diese Quelle vorhanden
    } catch (e) {
      logGraphError("⚠️ renew best (this source) failed, will recreate", e);
      try {
        await axios.delete(`${GRAPH}/subscriptions/${best.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        removeStoreSubscriptionById(best.id);
      } catch (e2) {
        logGraphError("⚠️ delete best before recreate failed", e2);
      }
      // weiter unten -> neu erstellen
    }
  }

  // 5) Es gibt noch keine Sub für diese Quelle → neu erstellen
  const created = await createSubscription({
    token,
    upn: userPrincipalName,
    folderId,
    notificationUrl,
    clientState,
  });
  upsertStoreSubscription({
    id: created.id,
    upn: userPrincipalName,
    folderId,
    resource: created.resource,
    expirationDateTime: created.expirationDateTime,
  });

  // 6) Sicherheitsnetz: Falls andere Quelle(n) >1 geworden sind, erneut trimmen (sollte i.d.R. nicht nötig sein)
  const allAfter = await listAllSubscriptions(token);
  const mineAfter = filterSubsForResource(allAfter, { upn: userPrincipalName, folderId });
  const otherAfter = mineAfter.filter((s) => !isSameSource(s));
  if (otherAfter.length > 1) {
    const bestOther = pickBest(otherAfter);
    await pruneDuplicatesForSource({ token, subs: otherAfter, keep: bestOther });
  }
}

/** Ensure für mehrere Accounts: [{ upn, folderId }] */
async function ensureMultipleGraphSubscriptions({ accounts = [], notificationUrl, clientState }) {
  const tokenCheck = await getAppToken();
  if (!tokenCheck) throw new Error("Failed to obtain app token");

  for (const acc of accounts) {
    if (!acc?.upn || !acc?.folderId) {
      console.warn("⚠️ skip account without upn/folderId:", acc);
      continue;
    }
    try {
      await ensureGraphMailSubscription({
        userPrincipalName: acc.upn,
        folderId: acc.folderId,
        notificationUrl,
        clientState,
      });
    } catch (e) {
      logGraphError(`❌ ensureGraphMailSubscription failed for ${acc.upn}`, e);
    }
  }
}

/* --------------------------------- Mail ---------------------------------- */
async function getMessageById(token, upn, messageId) {
  const url =
    `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}` +
    `?$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,hasAttachments,internetMessageId,parentFolderId`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
async function listAttachments(token, upn, messageId) {
  const url =
    `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}/attachments` +
    `?$select=id,name,contentType,size,isInline`;
  const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return data.value || [];
}
async function downloadAttachment(token, upn, messageId, attachment) {
  try {
    const url = `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}/attachments/${attachment.id}`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    if (data["@odata.type"] === "#microsoft.graph.fileAttachment") {
      return {
        name: data.name,
        contentType: data.contentType,
        contentBytes: data.contentBytes,
        size: data.size || attachment.size,
      };
    }
    return null; // ignore non-file
  } catch (e) {
    logGraphError(`Attachment detail GET failed (${attachment?.name})`, e);
    return null;
  }
}

/* ------------------------------ Subs Admin ------------------------------- */
async function listAllSubscriptions(token) {
  const { data } = await axios.get(`${GRAPH}/subscriptions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.value || [];
}
async function deleteSubscription(token, id) {
  await axios.delete(`${GRAPH}/subscriptions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  removeStoreSubscriptionById(id);
  return true;
}
function clearLocalSubscriptionStore() {
  saveStore({ subscriptions: { byId: {}, byKey: {} } });
}
async function deleteAllSubscriptions({ token, userFilter } = {}) {
  const all = await listAllSubscriptions(token);
  const toDelete = all.filter((s) => {
    if (!userFilter) return true;
    const res = (s.resource || "").toLowerCase();
    const uf = userFilter.toLowerCase();
    return (
      res.includes(encodeURIComponent(uf)) ||
      res.includes(`users('${uf}')`) ||
      res.includes(`/users/${uf}/`)
    );
  });

  let ok = 0, fail = 0, errors = [];
  for (const sub of toDelete) {
    try { await deleteSubscription(await getAppToken(), sub.id); ok++; }
    catch (e) { fail++; errors.push({ id: sub.id, err: e.response?.status || e.message }); }
  }
  return { total: all.length, deleted: ok, failed: fail, errors, filteredBy: userFilter || null };
}

module.exports = {
  // ensure (single + multi)
  ensureGraphMailSubscription,
  ensureMultipleGraphSubscriptions,
  // subs admin
  getAppToken,
  listAllSubscriptions,
  deleteSubscription,
  deleteAllSubscriptions,
  clearLocalSubscriptionStore,
  // mail
  getMessageById,
  listAttachments,
  downloadAttachment,
  // store access for webhook
  getStoredSubscriptionById,
  // utils
  logGraphError,
};
