const { runApplicantMailRetentionCleanup } = require('../ApplicantMailRetentionService');

function normalizeStringList(value) {
  if (!value) return null;
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function main() {
  const dryRun = String(process.env.DRY_RUN || 'false').toLowerCase() === 'true';
  const teamKeys = normalizeStringList(process.env.TEAM_KEYS);
  const folderKeys = normalizeStringList(process.env.FOLDER_KEYS);

  try {
    const result = await runApplicantMailRetentionCleanup({ dryRun, teamKeys, folderKeys });
    console.log('RETENTION_RUN_SUMMARY_START');
    console.log(JSON.stringify(result, null, 2));
    console.log('RETENTION_RUN_SUMMARY_END');
  } catch (error) {
    console.log('RETENTION_RUN_SUMMARY_START');
    console.log(JSON.stringify({
      dryRun,
      summary: error.summary || [],
      errors: error.errors || [{ message: error.message }],
    }, null, 2));
    console.log('RETENTION_RUN_SUMMARY_END');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('RETENTION_RUN_FATAL');
  console.error(error?.response?.data || error?.stack || error?.message || error);
  process.exit(1);
});
