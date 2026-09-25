const axios = require("axios");

let cachedFlipToken = null;
let tokenExpiry = null;
const MAX_RATE_LIMIT_RETRIES = 10;
const BASE_RETRY_DELAY_MS = 1000;
const JITTER_RATIO = 0.2;
const MIN_REQUEST_INTERVAL_MS = Number(process.env.FLIP_MIN_REQUEST_INTERVAL_MS || 125);
const LOW_REMAINING_RATIO = 0.1;
let nextRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getHeader(headers, name) {
  return headers?.[name.toLowerCase()] ?? headers?.[name] ?? null;
}

function getRateLimitResetMs(headers) {
  const rawValue = Number(getHeader(headers, "ratelimit-reset"));
  if (!Number.isFinite(rawValue) || rawValue < 0) return 0;

  // Flip documents this as seconds to wait. Also accept an epoch timestamp.
  if (rawValue > Date.now() / 1000) {
    return Math.max(0, rawValue * 1000 - Date.now());
  }
  return rawValue * 1000;
}

function deferRequests(delayMs) {
  nextRequestAt = Math.max(nextRequestAt, Date.now() + delayMs);
}

async function paceFlipRequest() {
  while (true) {
    const waitMs = nextRequestAt - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
      continue;
    }

    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    return;
  }
}

function proactivelyPace(headers) {
  const remaining = Number(getHeader(headers, "ratelimit-remaining"));
  const limit = Number(getHeader(headers, "ratelimit-limit"));
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return;
  if (remaining / limit > LOW_REMAINING_RATIO) return;

  const resetMs = getRateLimitResetMs(headers);
  const delayMs = remaining > 0
    ? Math.max(MIN_REQUEST_INTERVAL_MS, Math.ceil(resetMs / remaining))
    : resetMs;
  if (delayMs > 0) {
    deferRequests(delayMs);
    console.warn(`⏳ Flip rate limit low (${remaining}/${limit}); pacing requests for ${delayMs}ms.`);
  }
}

/**
 * Fetch a new Flip API token from the authentication server.
 * @returns {Promise<string>} The new access token.
 */
const fetchNewFlipToken = async () => {
  try {
    console.log("🔄 Fetching new Flip API token...");

    const response = await axios.post(
      `${process.env.FLIP_SYNC_URL}/auth/realms/${process.env.FLIP_ORGANIZATION}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.FLIP_SYNC_CLIENT_ID,
        client_secret: process.env.FLIP_SYNC_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const newToken = response.data.access_token;
    const expiresInMs = response.data.expires_in * 1000;

    // Cache the token with an expiry time
    cachedFlipToken = newToken;
    tokenExpiry = Date.now() + expiresInMs - 60000; // Refresh 1 min before expiry

    console.log("✅ Flip API token refreshed!");
    return newToken;
  } catch (error) {
    console.error("❌ Failed to get Flip API token:", error.response ? error.response.data : error.message);
    throw new Error("Authentication failed for Flip API");
  }
};

/**
 * Get a valid Flip API token, using cache if available.
 * @returns {Promise<string>} The access token.
 */
const getFlipAuthToken = async () => {
  if (cachedFlipToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log("✅ Using cached Flip API token.");
    return cachedFlipToken;
  }
  return fetchNewFlipToken();
};

// 🔥 Create Axios instance with base settings
const flipAxios = axios.create({
  baseURL: process.env.FLIP_SYNC_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// 🔥 Interceptor to attach the Flip API token dynamically
flipAxios.interceptors.request.use(
  async (config) => {
    await paceFlipRequest();
    try {
      const token = await getFlipAuthToken(); // ✅ Get cached or fresh token
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error("❌ Error fetching Flip API token:", error.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

flipAxios.interceptors.response.use(
  (response) => {
    response.config._flipRateLimitRetries = 0;
    proactivelyPace(response.headers);
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config || error.response?.status !== 429) return Promise.reject(error);

    const retries = config._flipRateLimitRetries || 0;
    if (retries >= MAX_RATE_LIMIT_RETRIES) {
      return Promise.reject(error);
    }

    const serverWaitMs = getRateLimitResetMs(error.response.headers);
    const backoffMs = BASE_RETRY_DELAY_MS * (2 ** retries);
    const jitteredBackoffMs = Math.round(
      backoffMs * (1 + ((Math.random() * 2 - 1) * JITTER_RATIO))
    );
    const delayMs = Math.max(serverWaitMs, jitteredBackoffMs);

    config._flipRateLimitRetries = retries + 1;
    deferRequests(delayMs);
    console.warn(
      `⏳ Flip API rate limited. Retry ${retries + 1}/${MAX_RATE_LIMIT_RETRIES} in ${delayMs}ms.`
    );
    await sleep(delayMs);
    return flipAxios(config);
  }
);

// ✅ Fix the exports to avoid conflicts
module.exports = { flipAxios, getFlipAuthToken };