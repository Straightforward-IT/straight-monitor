const mongoose = require('mongoose');

const { Schema } = mongoose;
const source = { type: Schema.Types.Mixed, required: true };
const importId = { type: Schema.Types.ObjectId, required: true, index: true };
const legacyId = { type: String, required: true };

function immutableModel(name, fields, indexes = []) {
  const schema = new Schema({ importId, legacyId, ...fields }, { timestamps: false });
  schema.index({ importId: 1, legacyId: 1 }, { unique: true });
  for (const index of indexes) schema.index(index);
  schema.pre('save', function (next) {
    next(this.isNew ? null : new Error('Importierte Tarifdaten sind schreibgeschützt.'));
  });
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne']) {
    schema.pre(operation, function (next) { next(new Error('Importierte Tarifdaten sind schreibgeschützt.')); });
  }
  return mongoose.model(name, schema);
}

const Contract = immutableModel('TariffContractData', {
  name: String, source,
  vacationRules: { type: [Schema.Types.Mixed], default: [] },
  noticePeriods: { type: [Schema.Types.Mixed], default: [] },
});
const Group = immutableModel('TariffEmployeeGroupData', {
  contractId: String, name: String, statusLabel: String, source,
  payGroups: { type: [Schema.Types.Mixed], default: [] },
  stages: { type: [Schema.Types.Mixed], default: [] },
  referenceWages: { type: [Schema.Types.Mixed], default: [] },
});
const Period = immutableModel('TariffPeriodData', {
  employeeGroupId: { type: String, required: true },
  validFrom: { type: String, required: true }, validUntil: { type: String, default: null }, source,
  rates: { type: [new Schema({
    stagePosition: { type: Number, required: true },
    groupPosition: { type: Number, required: true },
    value: { type: Schema.Types.Decimal128, required: true }, source,
  }, { _id: false })], default: [] },
  wageRules: { type: [Schema.Types.Mixed], default: [] },
  specialPayments: { type: [Schema.Types.Mixed], default: [] },
  assignmentAllowances: { type: [Schema.Types.Mixed], default: [] },
}, [{ importId: 1, employeeGroupId: 1, validFrom: 1 }]);
const assignmentFields = {
  personalNr: { type: String, required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Mitarbeiter', default: null },
  employeeName: { type: String, default: '' },
  matchStatus: { type: String, enum: ['MATCHED', 'MISSING', 'AMBIGUOUS'], required: true },
  intervalStatus: { type: String, enum: ['VALID', 'INEFFECTIVE'], required: true, default: 'VALID' },
  validFrom: { type: String, required: true }, validUntil: { type: String, default: null }, source,
};
const Assignment = immutableModel('EmployeeTariffAssignmentData', {
  ...assignmentFields, employeeGroupId: String, payGroupId: String, stageId: String,
}, [{ importId: 1, employeeId: 1 }, { importId: 1, personalNr: 1 }]);
const Allowance = immutableModel('EmployeeAboveTariffData', {
  ...assignmentFields, values: { type: Map, of: Schema.Types.Decimal128, default: {} },
}, [{ importId: 1, employeeId: 1 }, { importId: 1, personalNr: 1 }]);

// A completed dataset is published by changing this one pointer. Reads always
// capture the pointer once, so they never combine different import runs.
const Catalog = mongoose.model('TariffCatalog', new Schema({
  _id: { type: String, default: '17055' },
  activeImportId: { type: Schema.Types.ObjectId, default: null },
  revision: { type: Number, default: 0 },
}, { timestamps: true }));

const actorSchema = new Schema({
  kind: { type: String, enum: ['USER', 'CLI'], required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  label: String,
  script: String,
}, { _id: false });

const Import = mongoose.model('TariffImport', new Schema({
  contractId: { type: String, default: '17055' },
  contentHash: { type: String, required: true, unique: true },
  status: { type: String, enum: ['BUILDING', 'READY', 'INVALID'], required: true },
  files: { type: [Schema.Types.Mixed], default: [] },
  counts: { type: Schema.Types.Mixed, default: {} },
  changes: { type: Schema.Types.Mixed, default: {} },
  basedOnImportId: { type: Schema.Types.ObjectId, default: null },
  issues: { type: [Schema.Types.Mixed], default: [] },
  errorCount: { type: Number, default: 0 }, warningCount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, required: function () { return this.createdActor?.kind !== 'CLI'; } },
  createdActor: { type: actorSchema, default: null },
  activatedAt: { type: Date, default: null },
  activatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  activatedActor: { type: actorSchema, default: null },
}, { timestamps: true }));

module.exports = { Contract, Group, Period, Assignment, Allowance, Catalog, Import };
