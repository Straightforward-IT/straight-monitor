const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Mitarbeiter = require('../models/Employee/Mitarbeiter');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const shouldWrite = process.argv.includes('--write');

async function backfill() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ist nicht gesetzt');
  await mongoose.connect(process.env.MONGO_URI);

  const employees = await Mitarbeiter.find({
    $or: [
      { r2Prefix: { $exists: false } },
      { r2Prefix: null },
      { r2Prefix: '' },
    ],
  }).select('_id vorname nachname').lean();

  const operations = employees.map((employee) => ({
    updateOne: {
      filter: {
        _id: employee._id,
        $or: [
          { r2Prefix: { $exists: false } },
          { r2Prefix: null },
          { r2Prefix: '' },
        ],
      },
      update: { $set: { r2Prefix: `employees/${employee._id}` } },
    },
  }));

  const result = shouldWrite && operations.length
    ? await Mitarbeiter.bulkWrite(operations, { ordered: false })
    : null;

  console.log(JSON.stringify({
    mode: shouldWrite ? 'write' : 'dry-run',
    matched: employees.length,
    updated: result?.modifiedCount || 0,
    sample: employees.slice(0, 25).map((employee) => ({
      id: String(employee._id),
      name: `${employee.vorname || ''} ${employee.nachname || ''}`.trim(),
      r2Prefix: `employees/${employee._id}`,
    })),
    note: shouldWrite
      ? 'Employee R2 prefixes persisted. No R2 objects were created.'
      : 'No data changed. Run again with --write to persist.',
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