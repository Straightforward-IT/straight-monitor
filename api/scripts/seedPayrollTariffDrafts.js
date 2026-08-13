/**
 * Seed reviewed-source GVP tariff drafts. This script never activates a rule.
 * A second PAYROLL user must compare the content with the primary tariff and
 * approve it through the payroll API with legal/payroll evidence.
 *
 * Usage: cd api && npm run seed:payroll-tariffs
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const TariffVersion = require('../models/TariffVersion');
const {
  RATE_PERIODS,
  CALCULATION_VERSION,
  buildGvpTariffDefinition,
  validateGvpTariffApproval,
} = require('../payroll-core');
const logger = require('../utils/logger');

function tariffDraft(period, index) {
  const data = {
    ...buildGvpTariffDefinition(period, index, { calculationVersion: CALCULATION_VERSION }),
    status: 'DRAFT',
    createdBy: null,
  };
  const validation = validateGvpTariffApproval(data, { calculationVersion: CALCULATION_VERSION });
  if (validation.status !== 'OK') {
    throw Object.assign(new Error(validation.message), { code: validation.code, details: validation.partial });
  }
  data.contentHash = validation.data.executableHash;
  return data;
}

async function seed() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set.');
  await mongoose.connect(process.env.MONGO_URI);
  for (const [index, period] of RATE_PERIODS.entries()) {
    const data = tariffDraft(period, index);
    const existing = await TariffVersion.findOne({ code: data.code });
    if (existing) {
      logger.info('Payroll tariff draft already exists', { code: data.code, id: existing._id });
      continue;
    }
    const created = await TariffVersion.create(data);
    logger.info('Payroll tariff draft created; approval still required', { code: created.code, id: created._id });
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(async (error) => {
    logger.error('Payroll tariff draft seed failed', { code: error.code, message: error.message });
    if (mongoose.connection.readyState) await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { tariffDraft };
