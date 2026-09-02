const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Mitarbeiter = require("../models/Employee/Mitarbeiter");
const { getRankTier } = require("../config/flipRanks");
const { countsForEmployees } = require("../services/operations/EinsatzCountingService");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const shouldWrite = process.argv.includes("--write");
const CHUNK_SIZE = 100;

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI ist nicht gesetzt");
  await mongoose.connect(process.env.MONGO_URI);

  const employees = await Mitarbeiter.find({
    isActive: { $ne: false },
    $or: [
      { personalnr: { $exists: true, $nin: [null, ""] } },
      { "personalnummern.0": { $exists: true } },
      { "personalnrHistory.0": { $exists: true } },
    ],
  })
    .select("_id vorname nachname personalnr personalnummern personalnrHistory einsatzCount rank")
    .lean();

  const snapshotAt = new Date();
  const changes = [];
  const operations = [];

  for (let index = 0; index < employees.length; index += CHUNK_SIZE) {
    const chunk = employees.slice(index, index + CHUNK_SIZE);
    const counts = await countsForEmployees(chunk, { through: snapshotAt });

    for (const employee of chunk) {
      const count = counts.get(String(employee._id)) || 0;
      const rank = getRankTier(count)?.key || null;
      if (employee.einsatzCount === count && employee.rank === rank) continue;

      changes.push({
        id: String(employee._id),
        name: `${employee.vorname || ""} ${employee.nachname || ""}`.trim(),
        count: { from: employee.einsatzCount ?? null, to: count },
        rank: { from: employee.rank || null, to: rank },
      });
      operations.push({
        updateOne: {
          filter: { _id: employee._id },
          update: { $set: { einsatzCount: count, einsatzCountUpdatedAt: snapshotAt, rank } },
        },
      });
    }
  }

  if (shouldWrite && operations.length) {
    await Mitarbeiter.bulkWrite(operations, { ordered: false });
  }

  console.log(JSON.stringify({
    mode: shouldWrite ? "write" : "dry-run",
    snapshotAt: snapshotAt.toISOString(),
    checked: employees.length,
    changed: changes.length,
    countChanged: changes.filter((change) => change.count.from !== change.count.to).length,
    rankChanged: changes.filter((change) => change.rank.from !== change.rank.to).length,
    sample: changes.slice(0, 25),
    note: shouldWrite
      ? "MongoDB snapshots updated; Flip groups reconcile on the next Flip user routine."
      : "No data changed. Run again with --write to persist.",
  }, null, 2));
}

backfill()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });