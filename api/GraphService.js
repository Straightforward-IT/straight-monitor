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
  const stored = getStoredSubscriptionByKey(userPrincipalName, folderId);

  const needNew = async () => {
    if (!stored?.id) return true;
    try {
      const current = await getSubscription({ token, id: stored.id });

      if ((current.resource || "").toLowerCase() !== desiredResource.toLowerCase()) {
        console.warn(`⚠️ Resource changed for ${userPrincipalName}. Old=${current.resource} New=${desiredResource} → re-create`);
        try {
          await axios.delete(`${GRAPH}/subscriptions/${stored.id}`, { headers: { Authorization: `Bearer ${token}` } });
        } catch (e) { logGraphError("⚠️ delete old subscription failed", e); }
        removeStoreSubscriptionById(stored.id);
        return true;
      }

      const minLeft = (new Date(current.expirationDateTime).getTime() - Date.now()) / 60000;
      if (minLeft <= 0) return true;
      if (minLeft < 360) {
        try {
          const renewed = await renewSubscription({ token, id: stored.id });
          upsertStoreSubscription({
            id: renewed.id || stored.id,
            upn: userPrincipalName,
            folderId,
            resource: renewed.resource || current.resource,
            expirationDateTime: renewed.expirationDateTime,
          });
          console.log(`✅ Renewed subscription for ${userPrincipalName} (~${Math.round(minLeft)}min left)`);
        } catch (e) {
          logGraphError("⚠️ renew failed, will recreate", e);
          return true;
        }
      } else {
        console.log(`👌 Subscription OK for ${userPrincipalName} (~${Math.round(minLeft)}min left)`);
      }
      return false;
    } catch (e) {
      logGraphError("⚠️ getSubscription failed, will re-create", e);
      removeStoreSubscriptionById(stored.id);
      return true;
    }
  };

  if (await needNew()) {
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
