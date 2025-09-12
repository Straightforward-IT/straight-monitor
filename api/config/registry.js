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
    this.teams = data.teams || [];
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
  listTeams() { return [...this.byKey.values()]; }

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
      .filter(t => t.graph?.upn && t.graph?.folderId)
      .map(t => ({ upn: t.graph.upn, folderId: t.graph.folderId, key: t.key }));
  }
getTeamByUpn(upn) {
    if (!upn) return null;
    const needle = String(upn).toLowerCase();
    for (const t of this.listTeams()) {
      const tupn = t?.graph?.upn;
      if (tupn && String(tupn).toLowerCase() === needle) return t;
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

}

module.exports = new Registry();
