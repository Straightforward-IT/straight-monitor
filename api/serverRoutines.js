// routines.js
const cron = require("node-cron");
const { getFlipAuthToken } = require("./flipAxios");
const { flipUserRoutine } = require("./FlipService");
const { sollRoutine, sendMail } = require("./EmailService");
const { bewerberRoutine } = require("./AsanaService");
const { ensureMultipleGraphSubscriptions } = require("./GraphService");
const registry = require("./config/registry");
const logger = require("./utils/logger");

/* ---------------------- Feature-Flag / Env-Gates ---------------------- */

const IS_PROD =
  String(process.env.APP_ENV).toLowerCase() === "production" ||
  String(process.env.NODE_ENV).toLowerCase() === "production";

const ENABLE_LIST = new Set(
  String(process.env.ENABLE_ROUTINES || "")
    .split(",").map(s => s.trim()).filter(Boolean)
);
const DISABLE_LIST = new Set(
  String(process.env.DISABLE_ROUTINES || "")
    .split(",").map(s => s.trim()).filter(Boolean)
);

function allow(key) {
  if (DISABLE_LIST.has(key)) return false;
  if (ENABLE_LIST.has(key)) return true;
  return IS_PROD; 
}

const CRON_PAUSED = String(process.env.CRON_PAUSED || "").toLowerCase() === "true";
function guard(fn) {
  return async (...args) => {
    if (CRON_PAUSED) {
      logger.warn("⏸ CRON_PAUSED=true → Routine übersprungen.");
      return;
    }
    return fn(...args);
  };
}

/* ------------------------------ Routines ------------------------------ */
(async () => {
  try {
    // 🔄 Flip API token refresh (daily 00:00)
    if (allow("flip_token")) {
      cron.schedule("0 0 * * *", guard(async () => {
        try {
          logger.routineStart("daily Flip API token refresh");
          await getFlipAuthToken();
        } catch (error) {
          logger.routineError("Flip API Token Refresh", error);
          await sendMail("it@straightforward.email", "❌ Flip API Token Refresh Failed", `
            <h3>Error in Flip API Token Refresh</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre>${error.stack}</pre>
          `);
        }
      }));
    }

    // 🔄 Flip user sync (daily 00:00)
    if (allow("flip_users")) {
      cron.schedule("0 0 * * *", guard(async () => {
        try {
          console.log("🔄 Running daily Flip API user refresh...");
          await flipUserRoutine();
        } catch (error) {
          console.error("❌ Flip User Routine:", error.message);
          await sendMail("it@straightforward.email", "❌ Flip User Routine Failed", `
            <h3>Error in Flip User Routine</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre>${error.stack}</pre>
          `);
        }
      }));
    }

    // 🔄 Asana Bewerber-Routine (hourly)
    if (allow("asana")) {
      cron.schedule("0 * * * *", guard(async () => {
        try {
          console.log("🔄 Running Asana API Task Routine...");
          await bewerberRoutine();
        } catch (error) {
          console.error("❌ Asana API Task Routine:", error.message);
          await sendMail("it@straightforward.email", "❌ Asana API Task Routine Failed", `
            <h3>Error in Asana API Task Routine</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre>${error.stack}</pre>
          `);
        }
      }));
    }

    // 📧 Soll-Routine (08:00 daily)
    if (allow("soll_mail")) {
      cron.schedule("0 8 * * *", guard(async () => {
        try {
          console.log("📧 Running scheduled email routine...");
          await sollRoutine();
        } catch (error) {
          console.error("❌ Scheduled Email Routine:", error.message);
          await sendMail("it@straightforward.email", "❌ Scheduled Email Routine Failed", `
            <h3>Error in Scheduled Email Routine</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre>${error.stack}</pre>
          `);
        }
      }));
    }

    // 📬 Graph-Ensure (every 30 min)
    if (allow("mail_subs")) {
      cron.schedule("*/30 * * * *", guard(async () => {
        try {
          console.log("📬 Ensuring Microsoft Graph mail subscriptions (registry)...");
          const accounts = registry.getSubscriptionAccounts();
          await ensureMultipleGraphSubscriptions({
            accounts,
            notificationUrl: process.env.GRAPH_NOTIFICATION_URL,
            clientState: process.env.GRAPH_CLIENT_STATE || "sf-secret",
          });
        } catch (error) {
          console.error("❌ Graph subscription ensure:", error.message);
          await sendMail("it@straightforward.email", "❌ Graph Subscription Ensure Failed", `
            <h3>Error in Graph Subscription Ensure (multi)</h3>
            <p><strong>Error:</strong> ${error.message}</p>
            <pre>${error.stack}</pre>
          `);
        }
      }));
    }

    console.log(
      `🗓  Routines loaded. ENV: ${IS_PROD ? "PROD" : "DEV"} | ` +
      `ENABLED: ${[...ENABLE_LIST].join(",") || "-"} | ` +
      `DISABLED: ${[...DISABLE_LIST].join(",") || "-"} | ` +
      `PAUSED: ${CRON_PAUSED}`
    );
  } catch (error) {
    console.error("❌ Critical error in routine initialization:", error.message);
    await sendMail("it@straightforward.email", "❌ Critical Server Error", `
      <h3>Critical Server Error</h3>
      <p><strong>Error:</strong> ${error.message}</p>
      <pre>${error.stack}</pre>
    `);
  }
})();
