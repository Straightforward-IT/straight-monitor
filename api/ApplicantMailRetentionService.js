const { deleteMessagesInFolder } = require("./GraphService");
const registry = require("./config/registry");

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return null;
}

function getRetentionCutoffDate(months) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth() - months;
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const seconds = now.getUTCSeconds();
  const milliseconds = now.getUTCMilliseconds();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDayOfTargetMonth);

  return new Date(Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds));
}

function getApplicantRetentionTargets({ teamKeys = null, folderKeys = null } = {}) {
  const allowedTeamKeys = (() => {
    const normalized = normalizeStringList(teamKeys);
    if (!normalized?.length) return null;
    return new Set(normalized.map((teamKey) => registry.getTeam(teamKey).key));
  })();

  const allowedFolderKeys = (() => {
    const normalized = normalizeStringList(folderKeys);
    if (!normalized?.length) return null;
    return new Set(normalized);
  })();

  return registry.listTeams()
    .filter((team) => !allowedTeamKeys || allowedTeamKeys.has(team.key))
    .flatMap((team) => {
      return Object.keys(team?.graph?.folders || {}).flatMap((folderKey) => {
        if (allowedFolderKeys && !allowedFolderKeys.has(folderKey)) {
          return [];
        }

        const folder = registry.getGraphFolder(team, folderKey);
        const retentionMonths = Number.parseInt(folder?.retentionMonths, 10);

        if (!Number.isInteger(retentionMonths) || retentionMonths <= 0) {
          return [];
        }

        if (!folder?.id || !folder?.userPrincipalName) {
          return [{
            teamKey: team.key,
            folderKey,
            retentionMonths,
            status: "invalid-config",
          }];
        }

        return [{
          teamKey: team.key,
          displayName: team.displayName || team.key,
          folderKey,
          folderId: folder.id,
          userPrincipalName: folder.userPrincipalName,
          retentionMonths,
          description: folder.description || null,
          status: "ready",
        }];
      });
    });
}

async function runApplicantMailRetentionCleanup({ dryRun, teamKeys = null, folderKeys = null } = {}) {
  const effectiveDryRun = typeof dryRun === "boolean"
    ? dryRun
    : String(process.env.GDPR_MAIL_RETENTION_DRY_RUN || process.env.GDPR_BEWERBER_DRY_RUN || "false").toLowerCase() === "true";

  const targets = getApplicantRetentionTargets({ teamKeys, folderKeys });
  const summary = [];
  const errors = [];

  for (const target of targets) {
    if (target.status !== "ready") {
      console.warn(
        `⚠️ GDPR mail retention skipped for ${target.teamKey}/${target.folderKey}: invalid folder configuration.`
      );
      summary.push(target);
      continue;
    }

    const cutoffDate = getRetentionCutoffDate(target.retentionMonths);
    const cutoffIso = cutoffDate.toISOString();

    try {
      const result = await deleteMessagesInFolder({
        userPrincipalName: target.userPrincipalName,
        folderId: target.folderId,
        filter: `receivedDateTime lt ${cutoffIso}`,
        match: (message) => {
          const receivedDate = new Date(message?.receivedDateTime || "");
          return !Number.isNaN(receivedDate.getTime()) && receivedDate.getTime() < cutoffDate.getTime();
        },
        dryRun: effectiveDryRun,
        includeHiddenFolders: true,
      });

      console.log(
        `🧹 GDPR mail retention ${effectiveDryRun ? "analysed" : "completed"} for ${target.teamKey}/${target.folderKey}: ` +
        `olderThan=${cutoffIso}, scanned=${result.scanned}, matched=${result.matched}, deleted=${result.deleted}, folder=${result.folderId}`
      );
      summary.push({
        ...target,
        status: effectiveDryRun ? "dry-run" : "completed",
        cutoffIso,
        ...result,
      });
    } catch (error) {
      console.error(
        `❌ GDPR mail retention failed for ${target.teamKey}/${target.folderKey}:`,
        error.message
      );
      errors.push({ team: target.teamKey, folderKey: target.folderKey, message: error.message });
    }
  }

  if (errors.length) {
    const error = new Error(
      `GDPR mail retention had ${errors.length} error(s): ` +
      errors.map((entry) => `${entry.team}/${entry.folderKey}=${entry.message}`).join("; ")
    );
    error.summary = summary;
    error.errors = errors;
    throw error;
  }

  return {
    dryRun: effectiveDryRun,
    summary,
  };
}

module.exports = {
  getRetentionCutoffDate,
  getApplicantRetentionTargets,
  runApplicantMailRetentionCleanup,
};