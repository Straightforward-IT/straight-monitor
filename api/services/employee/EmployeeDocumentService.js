const EmployeeDocumentRequest = require('../../models/Employee/EmployeeDocumentRequest');
const Beruf = require('../../models/Event/Beruf');

const OPEN_STATUSES = ['REQUESTED', 'UPLOADED', 'REJECTED', 'EXPIRED'];

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function semesterForDate(value) {
  const date = startOfDay(value);
  const year = date.getFullYear();
  return date.getMonth() >= 3 && date.getMonth() <= 8
    ? { kind: 'SUMMER', year, startsAt: new Date(year, 3, 1), endsAt: new Date(year, 8, 30, 23, 59, 59, 999) }
    : date.getMonth() >= 9
      ? { kind: 'WINTER', year, startsAt: new Date(year, 9, 1), endsAt: new Date(year + 1, 2, 31, 23, 59, 59, 999) }
      : { kind: 'WINTER', year: year - 1, startsAt: new Date(year - 1, 9, 1), endsAt: new Date(year, 2, 31, 23, 59, 59, 999) };
}

function semesterNumber(startDate, at = new Date()) {
  if (!startDate) return null;
  const start = semesterForDate(startDate);
  const current = semesterForDate(at);
  const academicIndex = (semester) => semester.kind === 'WINTER'
    ? semester.year * 2
    : semester.year * 2 - 1;
  const difference = academicIndex(current) - academicIndex(start);
  return difference >= 0 ? difference + 1 : null;
}

function approvedByType(requests, types) {
  return requests.some((request) => request.status === 'APPROVED' && types.includes(request.type));
}

function openByType(requests, types) {
  return requests.some((request) => OPEN_STATUSES.includes(request.status) && types.includes(request.type));
}

async function evaluateDefaultRequirements(employee, approvedRequests = [], at = new Date()) {
  if (!employee || employee.isActive === false || employee.isBewerberstatus === true) return [];
  const professionIds = (employee.berufe || []).map((beruf) => beruf?._id || beruf).filter(Boolean);
  const professions = professionIds.length ? await Beruf.find({ _id: { $in: professionIds } }).select('jobKey').lean() : [];
  const isService = professions.some((beruf) => beruf.jobKey === 10001);
  const semesterEnd = semesterForDate(at).endsAt;
  const studentSemester = semesterNumber(employee.studieninformationen?.startDate, at);

  const rules = [
    { ruleKey: 'IDENTITY_PROOF', type: 'IDENTITY_CARD', applicable: true, satisfied: approvedByType(approvedRequests, ['IDENTITY_CARD', 'RESIDENCE_PERMIT']), dueAt: null, validUntil: null },
    { ruleKey: 'HEALTH_INSURANCE_PROOF', type: 'HEALTH_INSURANCE_CARD', applicable: true, satisfied: Boolean(employee.versicherungsnachweisTyp) || approvedByType(approvedRequests, ['HEALTH_INSURANCE_CARD']), dueAt: null, validUntil: null },
    { ruleKey: 'TAX_ID', type: 'TAX_ID_DOCUMENT', applicable: true, satisfied: Boolean(employee.steuerId) || approvedByType(approvedRequests, ['TAX_ID_DOCUMENT']), dueAt: null, validUntil: null },
    { ruleKey: 'SOCIAL_INSURANCE_NUMBER', type: 'SOCIAL_INSURANCE_NUMBER', applicable: true, satisfied: Boolean(employee.sozialversicherungsnummer) || approvedByType(approvedRequests, ['SOCIAL_INSURANCE_NUMBER']), dueAt: null, validUntil: null },
    { ruleKey: 'STUDY_CERTIFICATE', type: 'IMMATRICULATION_CERTIFICATE', applicable: employee.isStudent === true, satisfied: approvedByType(approvedRequests, ['IMMATRICULATION_CERTIFICATE']), dueAt: semesterEnd, validUntil: semesterEnd },
    { ruleKey: 'SCHOOL_CERTIFICATE', type: 'SCHOOL_CERTIFICATE', applicable: employee.isSchueler === true, satisfied: approvedByType(approvedRequests, ['SCHOOL_CERTIFICATE']), dueAt: semesterEnd, validUntil: semesterEnd },
    { ruleKey: 'PROOF_OF_ACHIEVEMENT', type: 'PROOF_OF_ACHIEVEMENT', applicable: employee.isStudent === true && studentSemester >= 4, satisfied: approvedByType(approvedRequests, ['PROOF_OF_ACHIEVEMENT']), dueAt: semesterEnd, validUntil: null },
    { ruleKey: 'HEALTH_INSTRUCTION', type: 'HEALTH_INSTRUCTION_CERTIFICATE', applicable: isService, satisfied: approvedByType(approvedRequests, ['HEALTH_INSTRUCTION_CERTIFICATE']), dueAt: null, validUntil: null },
  ];

  return rules.map((rule) => ({ ...rule, open: openByType(approvedRequests, rule.ruleKey === 'IDENTITY_PROOF' ? ['IDENTITY_CARD', 'RESIDENCE_PERMIT'] : [rule.type]), semester: studentSemester }));
}

async function reconcileDefaultRequirements(employee, requestedBy, { apply = false, at = new Date() } = {}) {
  const requests = await EmployeeDocumentRequest.find({ mitarbeiter: employee._id }).select('type status ruleKey dueAt validUntil').lean();
  const rules = await evaluateDefaultRequirements(employee, requests, at);
  const missing = rules.filter((rule) => rule.applicable && !rule.satisfied && !rule.open);
  if (apply && missing.length) {
    await EmployeeDocumentRequest.insertMany(missing.map((rule) => ({
      mitarbeiter: employee._id,
      type: rule.type,
      status: 'REQUESTED',
      requestedBy,
      dueAt: rule.dueAt,
      validUntil: rule.validUntil,
      source: 'DEFAULT_RULE',
      ruleKey: rule.ruleKey,
    })));
  }
  return { rules, missing, created: apply ? missing.length : 0 };
}

async function expireEmployeeDocumentRequests(now = new Date()) {
  const [overdueRequests, expiredDocuments] = await Promise.all([
    EmployeeDocumentRequest.updateMany(
      {
        status: { $in: ['REQUESTED', 'REJECTED'] },
        dueAt: { $ne: null, $lte: now },
      },
      { $set: { status: 'EXPIRED' } },
    ),
    EmployeeDocumentRequest.updateMany(
      {
        status: 'APPROVED',
        validUntil: { $ne: null, $lte: now },
      },
      { $set: { status: 'EXPIRED' } },
    ),
  ]);

  return {
    overdueRequests: overdueRequests.modifiedCount,
    expiredDocuments: expiredDocuments.modifiedCount,
  };
}

module.exports = { expireEmployeeDocumentRequests, semesterForDate, semesterNumber, evaluateDefaultRequirements, reconcileDefaultRequirements };