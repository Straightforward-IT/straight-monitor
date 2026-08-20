const axios = require("axios");

let cachedFlipToken = null;
let tokenExpiry = null;

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

// ✅ Fix the exports to avoid conflicts
module.exports = { flipAxios, getFlipAuthToken };