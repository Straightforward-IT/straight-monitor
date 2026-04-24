// config/registry.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(process.cwd(), "config", "teams.json");

// Umlaute/Whitespace-handling: "Köln" == "koeln" == "  KÖLN  "
function normalizeKey(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[ß]/g, "ss");
}

function readJson(file) {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function pickDefaultGraphMailboxKey(graph = {}) {
  if (graph?.primaryMailboxKey && graph?.mailboxes?.[graph.primaryMailboxKey]) {
    return graph.primaryMailboxKey;
  }
  if (graph?.mailboxes?.primary) return "primary";

  const keys = Object.keys(graph?.mailboxes || {});
  return keys[0] || null;
}

function getGraphMailboxFromConfig(graph = {}, mailboxKey = null) {
  const resolvedKey = mailboxKey || pickDefaultGraphMailboxKey(graph);
  if (!resolvedKey) return null;

  const mailbox = graph?.mailboxes?.[resolvedKey];
  if (!mailbox?.userPrincipalName) return null;

  return { key: resolvedKey, ...mailbox };
}

function getGraphFolderFromConfig(graph = {}, folderKey = null) {
  const resolvedKey = folderKey || graph?.subscriptionFolderKey || "subscriptionInbox";
  const folder = graph?.folders?.[resolvedKey];
  if (!folder) return null;

  return { key: resolvedKey, ...folder };
}

function getGraphSubscriptionFromConfig(graph = {}) {
  const folder = getGraphFolderFromConfig(graph, graph?.subscriptionFolderKey || "subscriptionInbox");
  if (!folder?.id) return null;

  const mailbox = getGraphMailboxFromConfig(graph, folder.mailboxKey);
  if (!mailbox?.userPrincipalName) return null;

  return {
    folderKey: folder.key,
    mailboxKey: mailbox.key,
    folderId: folder.id,
    userPrincipalName: mailbox.userPrincipalName,
  };
}

function normalizeGraphConfig(graph = {}) {
  const mailboxes = { ...(graph?.mailboxes || {}) };
  const folders = { ...(graph?.folders || {}) };

  if (!mailboxes.primary && (graph?.sharedMailbox || graph?.upn)) {
    mailboxes.primary = {
      userPrincipalName: graph.sharedMailbox || graph.upn,
    };
  }

  if (!mailboxes.subscriptionSource && graph?.sharedMailbox && graph?.upn && graph.upn !== graph.sharedMailbox) {
    mailboxes.subscriptionSource = {
      userPrincipalName: graph.upn,
    };
  }

  if (!folders.subscriptionInbox && graph?.folderId) {
    folders.subscriptionInbox = {
      mailboxKey: mailboxes.subscriptionSource ? "subscriptionSource" : pickDefaultGraphMailboxKey({ ...graph, mailboxes }),
      id: graph.folderId,
    };
  }

  const normalized = {
    ...graph,
    primaryMailboxKey: graph?.primaryMailboxKey || (mailboxes.primary ? "primary" : pickDefaultGraphMailboxKey({ ...graph, mailboxes })),
    subscriptionFolderKey: graph?.subscriptionFolderKey || (folders.subscriptionInbox ? "subscriptionInbox" : null),
    mailboxes,
    folders,
  };

  const primaryMailbox = getGraphMailboxFromConfig(normalized);
  const subscription = getGraphSubscriptionFromConfig(normalized);

  normalized.upn = subscription?.userPrincipalName || null;
  normalized.folderId = subscription?.folderId || null;
  normalized.sharedMailbox =
    primaryMailbox?.userPrincipalName && primaryMailbox.userPrincipalName !== normalized.upn
      ? primaryMailbox.userPrincipalName
      : null;

  return normalized;
}

class Registry {
  constructor(file = FILE) {
    this.file = file;
    this._load();
    // Hot reload on change
    fs.watchFile(this.file, { interval: 1000 }, () => {
      try {
        this._load();
        console.log("🔁 registry hot-reloaded:", this.file);
      } catch (e) {
        console.error("❌ registry reload failed:", e.message);
      }
    });
  }

  _load() {
    const data = readJson(this.file);
    this.shared = data.shared || {};
    this.teams = (data.teams || []).map((team) => ({
      ...team,
      graph: normalizeGraphConfig(team.graph || {}),
    }));
    if (!Array.isArray(this.teams) || this.teams.length === 0) {
      throw new Error("config/teams.json: 'teams' must be a non-empty array");
    }
    // build indexes
    this.byKey = new Map();
    this.aliasToKey = new Map();

    for (const t of this.teams) {
      if (!t.key) throw new Error("team without 'key'");
      const k = normalizeKey(t.key);
      this.byKey.set(k, t);
      const aliases = Array.isArray(t.aliases) ? t.aliases : [];
      for (const a of [t.key, t.displayName, ...aliases]) {
        if (!a) continue;
        this.aliasToKey.set(normalizeKey(a), k);
      }
    }
  }

  // --- Lookups ---
  listTeams() { 
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
    return [...this.byKey.values()].filter(t => {
      // Filtere development-only Teams in Production aus
      if (t.developmentOnly && !isDevelopment) return false;
      return true;
    });
  }

  resolveKey(input) {
    const n = normalizeKey(input);
    return this.aliasToKey.get(n) || n;
  }

  getTeam(input) {
    const key = this.resolveKey(input);
    const t = this.byKey.get(key);
    if (!t) throw new Error(`Unknown team '${input}' (normalized: '${key}')`);
    return t;
  }

  // Email sender (address + shared auth from env)
  getEmailSender(input) {
    const t = this.getTeam(input);
    const address = t?.email?.address;
    if (!address) throw new Error(`Team '${t.key}' has no email.address`);
    const envMap = this.shared?.emailAuthEnv || {};
    return {
      address,
      clientId: requireEnv(envMap.clientId),
      clientSecret: requireEnv(envMap.clientSecret),
      authority: requireEnv(envMap.authority),
    };
  }

  // Graph subscription accounts array
  getSubscriptionAccounts() {
    return this.listTeams()
      .map(t => {
        const subscription = this.getGraphSubscription(t);
        if (!subscription) return null;

        return {
          upn: subscription.userPrincipalName,
          folderId: subscription.folderId,
          key: t.key,
        };
      })
      .filter(Boolean);
  }

  getGraphMailbox(input, mailboxKey = null) {
    const team = typeof input === "string" ? this.getTeam(input) : input;
    if (!team?.graph) return null;
    return getGraphMailboxFromConfig(team.graph, mailboxKey);
  }

  getGraphMailboxUpn(input, mailboxKey = null) {
    return this.getGraphMailbox(input, mailboxKey)?.userPrincipalName || null;
  }

  getGraphFolder(input, folderKey = null) {
    const team = typeof input === "string" ? this.getTeam(input) : input;
    if (!team?.graph) return null;

    const folder = getGraphFolderFromConfig(team.graph, folderKey);
    if (!folder) return null;

    const mailbox = getGraphMailboxFromConfig(team.graph, folder.mailboxKey);
    return {
      ...folder,
      userPrincipalName: mailbox?.userPrincipalName || null,
    };
  }

  getGraphSubscription(input) {
    const team = typeof input === "string" ? this.getTeam(input) : input;
    if (!team?.graph) return null;
    return getGraphSubscriptionFromConfig(team.graph);
  }

  getTeamByUpn(upn) {
    if (!upn) return null;
    const needle = String(upn).toLowerCase();
    for (const t of this.listTeams()) {
      const mailboxKeys = Object.keys(t?.graph?.mailboxes || {});
      for (const mailboxKey of mailboxKeys) {
        const tupn = this.getGraphMailboxUpn(t, mailboxKey);
        if (tupn && String(tupn).toLowerCase() === needle) return t;
      }
    }
    return null;
  }

  getAsanaProjectIdByUpn(upn) {
    const t = this.getTeamByUpn(upn);
    return t?.asana?.projectId || null;
  }

  // For routines
  getRoutineTargetsForToday(date = new Date()) {
    const weekday = date.toLocaleString("en-US", { weekday: "long" }); // "Monday"
    return this.listTeams()
      .filter(t => t.routine?.enabled && (t.routine.weekdays || []).includes(weekday))
      .map(t => ({
        key: t.key,
        recipients: t.routine.recipients || [t.email?.address].filter(Boolean),
        weekday
      }));
  }

    // Alle Routine-Targets, unabhängig vom Wochentag
  getRoutineTargets() {
    return this.listTeams()
      .filter(t => t.routine?.enabled)
      .map(t => ({
        key: t.key,
        recipients: t.routine?.recipients || [t.email?.address].filter(Boolean),
        weekdays: t.routine?.weekdays || [],
      }));
  }

  // EventReport E-Mail-Empfänger basierend auf Standort/Location-String
  getEventReportRecipients(location) {
    try {
      const t = this.getTeam(location);
      return t?.eventReport?.recipients || ['it@straightforward.email'];
    } catch {
      return ['it@straightforward.email'];
    }
  }

  // Items
  getInventoryStandort(input) {
    const t = this.getTeam(input); // input kann "hamburg", "HH", "Köln", "koeln", etc. sein
    // bevorzugt inventory.standort, sonst displayName, sonst key
    return t?.inventory?.standort || t?.displayName || t?.key;
  }

  // Für Endpunkte/Validierung: Liste der gültigen Standort-Namen (DB-Namen)
  listInventoryStandorte() {
    return this.listTeams().map(t => t?.inventory?.standort || t?.displayName || t?.key);
  }

  // Asana
  getAsanaProjectId(input) {
    const t = this.getTeam(input);
    return t?.asana?.projectId || null;
  }

  getAsanaProjectIds(keys = null) {
    // keys: optional Array von Team-Keys/Aliases, sonst alle Teams
    const selected = Array.isArray(keys) && keys.length
      ? keys.map(k => this.getTeam(k))
      : this.listTeams();

    const ids = selected
      .map(t => t?.asana?.projectId)
      .filter(Boolean);

    // Deduplizieren (falls mehrere Aliase auf das gleiche Team zeigen)
    return [...new Set(ids)];
  }

  // Schulungs-Projekte
  getAsanaSchulungProjectId(input) {
    const t = this.getTeam(input);
    return t?.asana?.schulungProjectId || null;
  }

  getAsanaSchulungProjectIds(keys = null) {
    const selected = Array.isArray(keys) && keys.length
      ? keys.map(k => this.getTeam(k))
      : this.listTeams();

    const ids = selected
      .map(t => t?.asana?.schulungProjectId)
      .filter(Boolean);

    return [...new Set(ids)];
  }

  // Disposition-Projekte (separate von Bewerber-Projekten)
  getAsanaDispositionProjectId(input) {
    const t = this.getTeam(input);
    return t?.asana?.dispositionProjectId || null;
  }

  getAsanaDispositionProjectIds(keys = null) {
    const selected = Array.isArray(keys) && keys.length
      ? keys.map(k => this.getTeam(k))
      : this.listTeams();

    const ids = selected
      .map(t => t?.asana?.dispositionProjectId)
      .filter(Boolean);

    return [...new Set(ids)];
  }

  // Alle Asana-Projekte (Bewerber + Disposition + Schulung)
  getAllAsanaProjectIds(keys = null, includeSchulung = true, includeDisposition = true) {
    const bewerberIds = this.getAsanaProjectIds(keys);
    const schulungIds = includeSchulung ? this.getAsanaSchulungProjectIds(keys) : [];
    const dispositionIds = includeDisposition ? this.getAsanaDispositionProjectIds(keys) : [];
    
    return [...new Set([...bewerberIds, ...schulungIds, ...dispositionIds])];
  }

}

module.exports = new Registry();
