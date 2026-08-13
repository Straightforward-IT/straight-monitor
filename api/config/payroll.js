const PAYCHEX_AUTH_MODES = Object.freeze({
  API_KEY: "API_KEY",
  JWT: "JWT",
});

const DEFAULT_PAYCHEX_BASE_URL = "https://app.paychexplus.de/publicapi/v1.3";

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parsePositiveInteger(value, defaultValue, { minimum = 0 } = {}) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) return defaultValue;
  return parsed;
}

function parseStringList(value) {
  if (value === undefined || value === null || value === "") return [];
  const entries = Array.isArray(value)
    ? value
    : String(value).split(/[,;\n]/);
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const normalized = String(entry || "").trim();
    const key = normalized.normalize("NFKC").toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeAuthMode(value, env) {
  const fallback = env.PAYCHEX_JWT ? PAYCHEX_AUTH_MODES.JWT : PAYCHEX_AUTH_MODES.API_KEY;
  const normalized = String(value || fallback)
    .trim()
    .replace(/[-\s]/g, "_")
    .toUpperCase();

  if (normalized === "API" || normalized === "APIKEY") return PAYCHEX_AUTH_MODES.API_KEY;
  return normalized;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_PAYCHEX_BASE_URL).trim().replace(/\/+$/, "");
}

/**
 * Build payroll/provider configuration from an environment-like object.
 *
 * A single legal employer is deliberately configured here. StraightMonitor
 * team/location keys must never be treated as Paychex company identifiers.
 */
function createPayrollConfig(env = process.env) {
  const companyKey = String(env.PAYCHEX_COMPANY_KEY || "straightforward").trim();

  return {
    documentSyncEnabled: parseBoolean(env.PAYROLL_DOCUMENT_SYNC_ENABLED, false),
    paychex: {
      provider: "paychex",
      apiVersion: "v1.3",
      baseURL: normalizeBaseUrl(env.PAYCHEX_API_BASE_URL),
      enabled: parseBoolean(env.PAYCHEX_ENABLED, false),
      writeEnabled: parseBoolean(env.PAYCHEX_WRITE_ENABLED, false),
      timeoutMs: parsePositiveInteger(env.PAYCHEX_TIMEOUT_MS, 15_000, { minimum: 1 }),
      auth: {
        mode: normalizeAuthMode(env.PAYCHEX_AUTH_MODE, env),
        apiKey: env.PAYCHEX_API_KEY || null,
        jwt: env.PAYCHEX_JWT || null,
        scheme: String(env.PAYCHEX_AUTH_SCHEME || "Bearer").trim(),
        tokenTtlMs: parsePositiveInteger(env.PAYCHEX_TOKEN_TTL_MS, 5 * 60_000, {
          minimum: 1,
        }),
        tokenExpirySkewMs: parsePositiveInteger(
          env.PAYCHEX_TOKEN_EXPIRY_SKEW_MS,
          30_000,
          { minimum: 0 }
        ),
      },
      company: {
        key: companyKey,
        uid: env.PAYCHEX_COMPANY_UID || null,
      },
      documents: {
        // Exact values from the documented Paychex `category` field which
        // Paychex/payroll reviewers have approved as employee payslips.
        payslipTypes: parseStringList(env.PAYCHEX_PAYSLIP_DOCUMENT_TYPES),
      },
      retry: {
        maxRetries: parsePositiveInteger(env.PAYCHEX_MAX_RETRIES, 2, { minimum: 0 }),
        baseDelayMs: parsePositiveInteger(env.PAYCHEX_RETRY_BASE_DELAY_MS, 250, {
          minimum: 0,
        }),
        maxDelayMs: parsePositiveInteger(env.PAYCHEX_RETRY_MAX_DELAY_MS, 60_000, {
          minimum: 0,
        }),
      },
    },
  };
}

const payrollConfig = createPayrollConfig();

module.exports = payrollConfig;
module.exports.createPayrollConfig = createPayrollConfig;
module.exports.PAYCHEX_AUTH_MODES = PAYCHEX_AUTH_MODES;
module.exports.DEFAULT_PAYCHEX_BASE_URL = DEFAULT_PAYCHEX_BASE_URL;
module.exports.parseStringList = parseStringList;
