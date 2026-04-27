// routines.js
const cron = require("node-cron");
const { getFlipAuthToken } = require("./flipAxios");
const { flipUserRoutine } = require("./FlipService");
const { sollRoutine, sendMail } = require("./EmailService");
const { bewerberRoutine } = require("./AsanaService");
const {
  ensureMultipleGraphSubscriptions,
  deleteMessagesInFolder,
} = require("./GraphService");
const { runApplicantMailRetentionCleanup } = require("./ApplicantMailRetentionService");
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

function parseMonthList(raw, fallback = [1, 7]) {
  const months = String(raw || "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 12);

  return new Set(months.length ? months : fallback);
}

function getApplicantFolderConfig(teamKey) {
  const suffix = String(teamKey || "").toUpperCase();
  return {
    folderId:
      process.env[`GDPR_BEWERBER_ARCHIVE_FOLDER_ID_${suffix}`] ||
      process.env[`GDPR_BEWERBER_FOLDER_ID_${suffix}`] ||
      null,
    folderPath:
      process.env[`GDPR_BEWERBER_ARCHIVE_FOLDER_PATH_${suffix}`] ||
      process.env[`GDPR_BEWERBER_FOLDER_PATH_${suffix}`] ||
      null,
  };
}

async function runSemiAnnualApplicantMailCleanup() {
  const dueMonths = parseMonthList(process.env.GDPR_BEWERBER_PURGE_MONTHS, [1, 7]);
  const currentMonth = new Date().getMonth() + 1;
  const dryRun = String(process.env.GDPR_BEWERBER_DRY_RUN || "false").toLowerCase() === "true";

  if (!dueMonths.has(currentMonth)) {
    console.log(
      `🗃️ GDPR Bewerber-Mail-Cleanup skipped for month ${currentMonth}; due months: ${[...dueMonths].join(",")}`
    );
    return { skipped: true, reason: "month-not-due", currentMonth, dueMonths: [...dueMonths] };
  }

  const teamKeys = ["berlin", "hamburg", "koeln"];
  const summary = [];
  const errors = [];

  for (const teamKey of teamKeys) {
    const team = registry.getTeam(teamKey);
    const { folderId, folderPath } = getApplicantFolderConfig(teamKey);

    if (!folderId && !folderPath) {
      console.warn(
        `⚠️ GDPR Bewerber-Mail-Cleanup skipped for ${team.key}: missing folder config ` +
        `(GDPR_BEWERBER_ARCHIVE_FOLDER_ID_${teamKey.toUpperCase()} or GDPR_BEWERBER_ARCHIVE_FOLDER_PATH_${teamKey.toUpperCase()})`
      );
      summary.push({ team: team.key, status: "skipped", reason: "missing-folder-config" });
      continue;
    }

    try {
      const result = await deleteMessagesInFolder({
        userPrincipalName: registry.getGraphMailboxUpn(team),
        folderId,
        folderPath,
        dryRun,
        includeHiddenFolders: true,
      });

      console.log(
        `🧹 GDPR Bewerber-Mail-Cleanup ${dryRun ? "analysed" : "completed"} for ${team.key}: ` +
        `scanned=${result.scanned}, matched=${result.matched}, deleted=${result.deleted}, folder=${result.folderId}`
      );
      summary.push({ team: team.key, status: dryRun ? "dry-run" : "completed", ...result });
    } catch (error) {
      console.error(`❌ GDPR Bewerber-Mail-Cleanup failed for ${team.key}:`, error.message);
      errors.push({ team: team.key, message: error.message });
    }
  }

  if (errors.length) {
    throw new Error(
      `GDPR Bewerber-Mail-Cleanup had ${errors.length} error(s): ` +
      errors.map((entry) => `${entry.team}=${entry.message}`).join("; ")
    );
  }

  return { skipped: false, dryRun, currentMonth, dueMonths: [...dueMonths], summary };
}

async function runApplicantMailGdprCleanup() {
  const retention = await runApplicantMailRetentionCleanup();
  const semiAnnual = await runSemiAnnualApplicantMailCleanup();

  return {
    retention,
    semiAnnual,
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

    // 🗃️ GDPR applicant mailbox cleanup (monthly, deletes only in configured 6-month cadence)
    if (allow("gdpr_cleanup")) {
      cron.schedule("0 3 1 * *", guard(async () => {
        try {
          console.log("🗃️ Running monthly GDPR applicant mailbox cleanup...");
          await runApplicantMailGdprCleanup();
        } catch (error) {
          console.error("❌ GDPR applicant mailbox cleanup:", error.message);
          await sendMail("it@straightforward.email", "❌ GDPR Applicant Mail Cleanup Failed", `
            <h3>Error in GDPR Applicant Mail Cleanup</h3>
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
