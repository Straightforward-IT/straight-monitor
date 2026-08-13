'use strict';

const { ROUNDING_RULE } = require('./rounding');
const {
  PRIMARY_GVP_SOURCE,
  PRIMARY_GVP_SOURCE_CHECKSUM,
  RATE_PERIODS,
  buildGvpTariffDefinition,
  executableTariffProjection,
  validateGvpTariffApproval,
  selectTariffRate,
  calculateMonthlyTarget,
  calculateBaseWage,
  calculateTargetBaseWage,
} = require('./tariff');
const { calculateExperienceSupplement } = require('./experience');
const {
  DEFAULT_TIE_BREAK_ORDER,
  selectHighestPremium,
  segmentPremiumTime,
} = require('./premiums');
const { allocateOvertimePremiumIntervals, calculateOvertimePremium } = require('./overtime');
const { evaluateEqualPayContinuity } = require('./equal-pay');
const { calculateAzk } = require('./azk');
const { calculateGvpAbsenceAverage } = require('./absence-average');
const { calculatePayrollContext } = require('./context');
const {
  allocateWorkingTimeToPayrollMonth,
  allocateApprovedAbsenceToPayrollMonth,
} = require('./period-allocation');

const CALCULATION_VERSION = 'payroll-core-1.2.0';

module.exports = {
  CALCULATION_VERSION,
  ROUNDING_RULE,
  PRIMARY_GVP_SOURCE,
  PRIMARY_GVP_SOURCE_CHECKSUM,
  RATE_PERIODS,
  buildGvpTariffDefinition,
  executableTariffProjection,
  validateGvpTariffApproval,
  DEFAULT_TIE_BREAK_ORDER,
  selectTariffRate,
  calculateMonthlyTarget,
  calculateBaseWage,
  calculateTargetBaseWage,
  calculateExperienceSupplement,
  selectHighestPremium,
  segmentPremiumTime,
  allocateOvertimePremiumIntervals,
  calculateOvertimePremium,
  evaluateEqualPayContinuity,
  calculateAzk,
  calculateGvpAbsenceAverage,
  calculatePayrollContext,
  allocateWorkingTimeToPayrollMonth,
  allocateApprovedAbsenceToPayrollMonth,
};
