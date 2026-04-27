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
function rememberSubscription({ id, upn, folderId, resource, expirationDateTime }) {
  if (!id || !upn || !folderId) return false;
  upsertStoreSubscription({ id, upn, folderId, resource, expirationDateTime });
  return true;
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
async function listMailFolders(token, upn, parentFolderId = null, { includeHiddenFolders = true } = {}) {
  const results = [];
  const baseUrl = parentFolderId
    ? `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(parentFolderId)}/childFolders`
    : `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders`;

  const params = new URLSearchParams({
    $select: "id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount,isHidden",
    $top: "250",
  });
  if (includeHiddenFolders) params.set("includeHiddenFolders", "true");

  let url = `${baseUrl}?${params.toString()}`;
  while (url) {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    results.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }

  return results;
}

function normalizeFolderPath(folderPath) {
  if (Array.isArray(folderPath)) {
    return folderPath
      .map((segment) => String(segment || "").trim())
      .filter(Boolean);
  }

  return String(folderPath || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

async function resolveMailFolderId(token, upn, { folderId = null, folderPath = null, includeHiddenFolders = true } = {}) {
  if (folderId) return folderId;

  const pathParts = normalizeFolderPath(folderPath);
  if (!pathParts.length) {
    throw new Error("Either folderId or folderPath is required");
  }

  let currentParentId = null;
  for (let index = 0; index < pathParts.length; index += 1) {
    const part = pathParts[index];
    const folders = await listMailFolders(token, upn, currentParentId, { includeHiddenFolders });
    const nextFolder = folders.find(
      (folder) => String(folder.displayName || "").toLowerCase() === part.toLowerCase()
    );

    if (!nextFolder) {
      const currentPath = pathParts.slice(0, index + 1).join("/");
      throw new Error(`Mail folder not found for ${upn}: ${currentPath}`);
    }

    currentParentId = nextFolder.id;
  }

  return currentParentId;
}

async function listMessagesInFolder(token, upn, folderId, { filter = null, top = 250, select = null } = {}) {
  const results = [];
  const params = new URLSearchParams({
    $select:
      select ||
      "id,subject,receivedDateTime,parentFolderId,from,internetMessageId",
    $top: String(top),
  });
  if (filter) params.set("$filter", filter);

  let url =
    `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}/messages?` +
    params.toString();

  while (url) {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    results.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }

  return results;
}

async function deleteMessage(token, upn, messageId, folderId = null) {
  const url = folderId
    ? `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}/messages/${messageId}`
    : `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}`;

  await axios.delete(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function chunkArray(items = [], size = 20) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildMessageDeleteUrl(upn, messageId, folderId = null) {
  if (folderId) {
    return `/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}`;
  }

  return `/users/${encodeURIComponent(upn)}/messages/${encodeURIComponent(messageId)}`;
}

async function deleteMessagesBatch(token, upn, messages = [], folderId = null, { batchSize = 20 } = {}) {
  let deleted = 0;
  const failures = [];
  const batches = chunkArray(messages, batchSize);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const requests = batch.map((message, index) => ({
      id: String(index + 1),
      method: "DELETE",
      url: buildMessageDeleteUrl(upn, message.id, folderId),
    }));

    const { data } = await axios.post(
      `${GRAPH}/$batch`,
      { requests },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseById = new Map(
      (data.responses || []).map((response) => [String(response.id), response])
    );

    for (let index = 0; index < batch.length; index += 1) {
      const message = batch[index];
      const response = responseById.get(String(index + 1));
      const status = Number(response?.status);

      if ([200, 202, 204].includes(status)) {
        deleted += 1;
        continue;
      }

      failures.push({
        messageId: message.id,
        status: response?.status || "missing",
        error: response?.body?.error?.message || response?.body || null,
      });
    }

    if (batches.length > 1) {
      console.log(
        `🗑️ Graph batch delete ${batchIndex + 1}/${batches.length} for ${upn}: ` +
        `processed=${Math.min((batchIndex + 1) * batchSize, messages.length)}/${messages.length}`
      );
    }

    if (failures.length) {
      break;
    }
  }

  return { deleted, failures };
}

async function moveMessage(token, upn, messageId, destinationFolderId, sourceFolderId = null) {
  const url = sourceFolderId
    ? `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(sourceFolderId)}/messages/${messageId}/move`
    : `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}/move`;

  const { data } = await axios.post(
    url,
    { destinationId: destinationFolderId },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return data;
}

async function deleteMessagesInFolder({
  userPrincipalName,
  folderId = null,
  folderPath = null,
  filter = null,
  match = null,
  dryRun = false,
  includeHiddenFolders = true,
  maxDelete = Infinity,
} = {}) {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) throw new Error("GRAPH client env missing");
  if (!userPrincipalName) throw new Error("userPrincipalName required");

  const token = await getAppToken();
  const resolvedFolderId = await resolveMailFolderId(token, userPrincipalName, {
    folderId,
    folderPath,
    includeHiddenFolders,
  });
  const allMessages = await listMessagesInFolder(token, userPrincipalName, resolvedFolderId, {
    filter,
  });
  const matchedMessages = typeof match === "function"
    ? allMessages.filter((message) => match(message))
    : allMessages;

  const limitedMessages = Number.isFinite(maxDelete)
    ? matchedMessages.slice(0, Math.max(0, maxDelete))
    : matchedMessages;

  let deleted = 0;
  if (!dryRun) {
    if (limitedMessages.length <= 1) {
      for (const message of limitedMessages) {
        await deleteMessage(token, userPrincipalName, message.id, resolvedFolderId);
        deleted += 1;
      }
    } else {
      const batchResult = await deleteMessagesBatch(token, userPrincipalName, limitedMessages, resolvedFolderId);
      deleted = batchResult.deleted;

      if (batchResult.failures.length) {
        const sample = batchResult.failures
          .slice(0, 3)
          .map((failure) => `${failure.messageId}:${failure.status}`)
          .join(", ");
        throw new Error(
          `Batch delete failed for ${batchResult.failures.length} message(s) in ${userPrincipalName}/${resolvedFolderId}. ` +
          `Deleted before failure: ${deleted}. Sample: ${sample}`
        );
      }
    }
  }

  return {
    upn: userPrincipalName,
    folderId: resolvedFolderId,
    folderPath: normalizeFolderPath(folderPath),
    scanned: allMessages.length,
    matched: matchedMessages.length,
    deleted: dryRun ? 0 : deleted,
    dryRun,
  };
}

async function getMailFolderById(token, upn, folderId) {
  const url =
    `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}` +
    `?$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount,isHidden`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

function sortFoldersForDisplay(folders = []) {
  return folders.slice().sort((a, b) => {
    return String(a.displayName || "").localeCompare(String(b.displayName || ""), "de", {
      sensitivity: "base",
    });
  });
}

async function buildMailFolderTree(token, upn, parentFolderId = null, parentPath = [], options = {}) {
  const folders = sortFoldersForDisplay(
    await listMailFolders(token, upn, parentFolderId, options)
  );
  const nodes = [];

  for (const folder of folders) {
    const pathSegments = [...parentPath, folder.displayName];
    const children = folder.childFolderCount > 0
      ? await buildMailFolderTree(token, upn, folder.id, pathSegments, options)
      : [];

    nodes.push({
      id: folder.id,
      displayName: folder.displayName,
      parentFolderId: folder.parentFolderId || null,
      childFolderCount: folder.childFolderCount || 0,
      totalItemCount: folder.totalItemCount || 0,
      unreadItemCount: folder.unreadItemCount || 0,
      isHidden: Boolean(folder.isHidden),
      wellKnownName: folder.wellKnownName || null,
      path: pathSegments.join(" / "),
      pathSegments,
      children,
    });
  }

  return nodes;
}

async function getMailboxFolderTree({ userPrincipalName, includeHiddenFolders = true } = {}) {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) throw new Error("GRAPH client env missing");
  if (!userPrincipalName) throw new Error("userPrincipalName required");

  const token = await getAppToken();
  const folders = await buildMailFolderTree(token, userPrincipalName, null, [], {
    includeHiddenFolders,
  });

  return {
    upn: userPrincipalName,
    includeHiddenFolders,
    folders,
  };
}

function formatSenderAddress(message) {
  return (
    message?.from?.emailAddress?.address ||
    message?.sender?.emailAddress?.address ||
    null
  );
}

async function getMailFolderInsights({
  userPrincipalName,
  folderId = null,
  folderPath = null,
  includeHiddenFolders = true,
} = {}) {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) throw new Error("GRAPH client env missing");
  if (!userPrincipalName) throw new Error("userPrincipalName required");

  const token = await getAppToken();
  const resolvedFolderId = await resolveMailFolderId(token, userPrincipalName, {
    folderId,
    folderPath,
    includeHiddenFolders,
  });
  const folder = await getMailFolderById(token, userPrincipalName, resolvedFolderId);
  let messages = [];
  let storageMethod = "sum(message.size)";
  try {
    messages = await listMessagesInFolder(token, userPrincipalName, resolvedFolderId, {
      select: "id,subject,receivedDateTime,from,sender,hasAttachments,size,internetMessageId,parentFolderId",
    });
  } catch (error) {
    messages = await listMessagesInFolder(token, userPrincipalName, resolvedFolderId, {
      select: "id,subject,receivedDateTime,from,sender,hasAttachments,internetMessageId,parentFolderId",
    });
    storageMethod = "unavailable";
  }

  const sizedMessages = messages.filter((message) => Number.isFinite(Number(message.size)));
  const totalMessageSizeBytes = sizedMessages.reduce(
    (sum, message) => sum + Number(message.size || 0),
    0
  );
  const largestMessages = sizedMessages
    .slice()
    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0))
    .slice(0, 15)
    .map((message) => ({
      id: message.id,
      subject: message.subject || "(ohne Betreff)",
      receivedDateTime: message.receivedDateTime || null,
      from: formatSenderAddress(message),
      size: Number(message.size || 0),
      hasAttachments: Boolean(message.hasAttachments),
    }));

  const recentMessages = messages
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.receivedDateTime || 0).getTime() || 0;
      const bTime = new Date(b.receivedDateTime || 0).getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, 15)
    .map((message) => ({
      id: message.id,
      subject: message.subject || "(ohne Betreff)",
      receivedDateTime: message.receivedDateTime || null,
      from: formatSenderAddress(message),
      size: Number.isFinite(Number(message.size)) ? Number(message.size) : null,
      hasAttachments: Boolean(message.hasAttachments),
    }));

  return {
    upn: userPrincipalName,
    folder: {
      id: folder.id,
      displayName: folder.displayName,
      parentFolderId: folder.parentFolderId || null,
      childFolderCount: folder.childFolderCount || 0,
      totalItemCount: folder.totalItemCount || 0,
      unreadItemCount: folder.unreadItemCount || 0,
      isHidden: Boolean(folder.isHidden),
      wellKnownName: folder.wellKnownName || null,
      pathSegments: normalizeFolderPath(folderPath),
    },
    storage: {
      method: storageMethod,
      totalMessageSizeBytes,
      sizedMessageCount: sizedMessages.length,
      unsizedMessageCount: messages.length - sizedMessages.length,
      averageMessageSizeBytes: sizedMessages.length
        ? Math.round(totalMessageSizeBytes / sizedMessages.length)
        : null,
      attachmentMessageCount: messages.filter((message) => message.hasAttachments).length,
    },
    largestMessages,
    recentMessages,
  };
}

async function getMessageById(token, upn, messageId, folderId = null) {
  // Use folder-specific endpoint if folderId provided (more reliable for folder subscriptions)
  let url;
  if (folderId) {
    url =
      `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}/messages/${messageId}` +
      `?$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,hasAttachments,internetMessageId,parentFolderId`;
  } else {
    url =
      `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}` +
      `?$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,hasAttachments,internetMessageId,parentFolderId`;
  }
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
async function listAttachments(token, upn, messageId, folderId = null) {
  // Use folder-specific endpoint if folderId provided
  let url;
  if (folderId) {
    url =
      `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}/messages/${messageId}/attachments` +
      `?$select=id,name,contentType,size,isInline`;
  } else {
    url =
      `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}/attachments` +
      `?$select=id,name,contentType,size,isInline`;
  }
  const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return data.value || [];
}
async function downloadAttachment(token, upn, messageId, attachment, folderId = null) {
  try {
    // Use folder-specific endpoint if folderId provided
    let url;
    if (folderId) {
      url = `${GRAPH}/users/${encodeURIComponent(upn)}/mailFolders/${encodeURIComponent(folderId)}/messages/${messageId}/attachments/${attachment.id}`;
    } else {
      url = `${GRAPH}/users/${encodeURIComponent(upn)}/messages/${messageId}/attachments/${attachment.id}`;
    }
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

/* ----------------------- DOCX → PDF via OneDrive ----------------------- */
/**
 * Lädt eine DOCX-Datei temporär in den OneDrive des Postfach-Users hoch,
 * lässt Graph sie server-seitig in PDF konvertieren, gibt den PDF-Buffer zurück
 * und löscht die Temp-Datei. Erfordert Files.ReadWrite.All (Application).
 */
async function convertAttachmentToPdf(token, upn, fileBuffer, fileName) {
  const tempName = `_straight_tmp_${Date.now()}_${path.basename(fileName)}`;

  // 1. DOCX als Temp-Datei in OneDrive hochladen
  const uploadUrl =
    `${GRAPH}/users/${encodeURIComponent(upn)}/drive/root:/_straight_tmp/${tempName}:/content`;
  const uploadRes = await axios.put(uploadUrl, fileBuffer, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    maxBodyLength: Infinity,
  });
  const itemId = uploadRes.data.id;

  try {
    // 2. PDF-Inhalt downloaden – Graph konvertiert DOCX→PDF server-seitig
    const pdfRes = await axios.get(
      `${GRAPH}/users/${encodeURIComponent(upn)}/drive/items/${itemId}/content?$format=pdf`,
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "arraybuffer",
        maxRedirects: 5,
      }
    );
    return Buffer.from(pdfRes.data);
  } finally {
    // 3. Temp-Datei löschen (fire & forget)
    axios
      .delete(`${GRAPH}/users/${encodeURIComponent(upn)}/drive/items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch((e) =>
        console.warn(`⚠️ OneDrive temp file cleanup failed (${itemId}):`, e.message)
      );
  }
}

/* ----------------------------- Contacts ---------------------------------- */

/**
 * Kontakte eines Postfachs nach displayName / E-Mail suchen (max. 25).
 * Verwendet $filter mit startsWith damit keine volle Liste geladen werden muss.
 */
async function searchContacts(token, upn, q) {
  const esc = encodeURIComponent(q.replace(/'/g, "''"));
  const select = 'id,givenName,surname,displayName,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle';
  // Graph supports startsWith filter on displayName and emailAddresses/address
  const filter = `startsWith(displayName,'${esc}') or emailAddresses/any(e:startsWith(e/address,'${esc}'))`;
  const url =
    `${GRAPH}/users/${encodeURIComponent(upn)}/contacts` +
    `?$select=${select}&$filter=${encodeURIComponent(filter)}&$top=25&$orderby=displayName`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (data.value || []).filter(
    (c) => !(c.companyName || '').toLowerCase().includes('straightforward')
  );
}

/**
 * Neuen Kontakt in einem Postfach anlegen.
 * fields: { givenName, surname, displayName?, companyName?, jobTitle?,
 *           emailAddresses?: [{address,name}], mobilePhone?, businessPhones? }
 */
async function createContact(token, upn, fields) {
  const url = `${GRAPH}/users/${encodeURIComponent(upn)}/contacts`;
  const { data } = await axios.post(url, fields, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return data;
}

/**
 * Alle Kontakte eines Postfachs abrufen (paginiert).
 * Filtert Kontakte heraus, deren companyName "Straightforward" enthält.
 */
async function getContacts(token, upn) {
  const results = [];
  let url =
    `${GRAPH}/users/${encodeURIComponent(upn)}/contacts` +
    `?$select=id,givenName,surname,displayName,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle` +
    `&$top=250&$orderby=displayName`;

  while (url) {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = data.value || [];
    results.push(...items);
    url = data["@odata.nextLink"] || null;
  }

  // Filter: kein "Straightforward" im companyName
  return results.filter(
    (c) => !(c.companyName || "").toLowerCase().includes("straightforward")
  );
}

/**
 * Kontakt-Felder aktualisieren.
 */
async function updateContact(token, upn, contactId, fields) {
  const url = `${GRAPH}/users/${encodeURIComponent(upn)}/contacts/${contactId}`;
  const { data } = await axios.patch(
    url,
    fields,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return data;
}

/**
 * Kontakt löschen.
 */
async function deleteContact(token, upn, contactId) {
  const url = `${GRAPH}/users/${encodeURIComponent(upn)}/contacts/${contactId}`;
  await axios.delete(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  getSubscription,
  // mail
  getMessageById,
  listAttachments,
  downloadAttachment,
  moveMessage,
  deleteMessagesInFolder,
  getMailboxFolderTree,
  getMailFolderInsights,
  // store access for webhook
  getStoredSubscriptionById,
  rememberSubscription,
  // utils
  logGraphError,
  // conversion
  convertAttachmentToPdf,
  // contacts
  getContacts,
  searchContacts,
  createContact,
  updateContact,
  deleteContact,
};
