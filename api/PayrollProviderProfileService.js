'use strict';

const mongoose = require('mongoose');
const Mitarbeiter = require('./models/Employee/Mitarbeiter');
const PayrollEmployment = require('./models/PayrollEmployment');
const PayrollProviderProfile = require('./models/PayrollProviderProfile');
const PayrollAuditLog = require('./models/PayrollAuditLog');
const PayrollError = require('./utils/PayrollError');
const { sha256 } = require('./payroll-core/hash');
const { invalidateEmployeeRuns } = require('./PayrollRunInvalidationService');

const actorId = (actor) => actor?._id || actor?.id || actor || null;
const idString = (value) => (value?._id || value)?.toString?.() || '';

function assertId(value, label) {
  if (!mongoose.isValidObjectId(value)) throw new PayrollError('PAYROLL_ID_INVALID', `${label} ist ungültig.`, 400);
}

function plain(value) {
  return value?.toObject ? value.toObject({ depopulate: true }) : JSON.parse(JSON.stringify(value || {}));
}

function profileHashProjection(profile) {
  return {
    mitarbeiter: profile.mitarbeiter,
    employment: profile.employment,
    personalNrSnapshot: profile.personalNrSnapshot,
    paychexEmployeeUid: profile.paychexEmployeeUid,
    validFrom: profile.validFrom,
    validTill: profile.validTill,
    provider: profile.provider,
    apiVersion: profile.apiVersion,
    employeePayload: plain(profile.employeePayload),
    contractPayload: plain(profile.contractPayload),
    providerOwnedStatutoryData: plain(profile.providerOwnedStatutoryData),
    providerReferenceDataHash: profile.providerReferenceDataHash,
    changeReason: profile.changeReason,
    evidenceRefs: [...(profile.evidenceRefs || [])],
    evidenceHash: profile.evidenceHash,
  };
}

function dateOnly(value) {
  if (value == null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new PayrollError('PAYCHEX_PROFILE_DATE_INVALID', 'Provider-Profil enthält ein ungültiges Datum.', 409);
  return date.toISOString().slice(0, 10);
}

function paychexEmployeePayload(profile) {
  const source = profile?.employeePayload || {};
  const payload = {
    form_of_address: source.formOfAddress ?? null,
    first_name: source.firstName,
    surname: source.surname,
    title: source.title ?? null,
    surname_prefix: source.surnamePrefix ?? null,
    surname_suffix: source.surnameSuffix ?? null,
    birth_surname: source.birthSurname ?? null,
    birth_surname_prefix: source.birthSurnamePrefix ?? null,
    birth_surname_suffix: source.birthSurnameSuffix ?? null,
    birth_date: dateOnly(source.birthDate),
    birth_country: source.birthCountry,
    birth_city: source.birthCity ?? null,
    gender: source.gender,
    nationality: source.nationality,
    graduation: source.graduation,
    professional_qualification: source.professionalQualification,
  };
  return payload;
}

function paychexContractPayload(profile) {
  const source = profile?.contractPayload || {};
  return {
    job_description: source.jobDescription ?? null,
    personal_number: source.personalNumber,
    start_date: dateOnly(source.startDate),
    end_date: dateOnly(source.endDate),
    reason_for_leaving: source.reasonForLeaving ?? null,
    termination_date: dateOnly(source.terminationDate),
    employing_company: source.employingCompany,
    employed_east_or_west: source.employedEastOrWest,
    performed_occupation: source.performedOccupation ?? null,
    employment_type: source.employmentType,
    limited_employment: source.limitedEmployment,
    payment_reduction_type: source.paymentReductionType,
  };
}

function canonicalProfilePayload(input, { employee, employment }) {
  const employeePayload = { ...(input.employeePayload || {}) };
  const contractPayload = { ...(input.contractPayload || {}) };
  if (employeePayload.firstName !== employee.vorname || employeePayload.surname !== employee.nachname) {
    throw new PayrollError(
      'PAYCHEX_PROFILE_IDENTITY_MISMATCH',
      'Vor- und Nachname des Provider-Profils müssen dem kanonischen Personalstamm entsprechen.',
      409,
    );
  }
  if (String(contractPayload.personalNumber || '') !== String(employee.personalnr || '')) {
    throw new PayrollError('PAYCHEX_PROFILE_PERSONAL_NUMBER_MISMATCH', 'Die Paychex-Personalnummer weicht vom Personalstamm ab.', 409);
  }
  const contractStart = new Date(contractPayload.startDate);
  const employmentStart = new Date(employment.validFrom);
  const contractEnd = contractPayload.endDate ? new Date(contractPayload.endDate) : null;
  const employmentEnd = employment.validTill ? new Date(employment.validTill) : null;
  if (!Number.isFinite(contractStart.getTime()) || contractStart.getTime() !== employmentStart.getTime()
      || Boolean(contractEnd) !== Boolean(employmentEnd)
      || (contractEnd && contractEnd.getTime() !== employmentEnd.getTime())) {
    throw new PayrollError(
      'PAYCHEX_PROFILE_CONTRACT_PERIOD_MISMATCH',
      'Der Paychex-Vertragszeitraum muss exakt der freigegebenen Beschäftigung entsprechen.',
      409,
    );
  }
  const paychexEmployeeUid = employee.paychex_id || employee.integrations?.paychex?.employeeUid;
  if (!paychexEmployeeUid) {
    throw new PayrollError(
      'PAYCHEX_EMPLOYEE_PREPROVISION_REQUIRED',
      'Vor dem Profilentwurf muss der vollständig angelegte Paychex-Mitarbeiter eindeutig verknüpft sein.',
      409,
    );
  }
  const providerOwnedStatutoryData = { ...(input.providerOwnedStatutoryData || {}) };
  const payload = {
    mitarbeiter: employee._id,
    employment: employment._id,
    personalNrSnapshot: employee.personalnr,
    paychexEmployeeUid,
    validFrom: employment.validFrom,
    validTill: employment.validTill || null,
    provider: 'paychex',
    apiVersion: 'v1.3',
    employeePayload,
    contractPayload,
    providerOwnedStatutoryData,
    providerReferenceDataHash: String(input.providerReferenceDataHash || '').trim().toLowerCase(),
    changeReason: String(input.changeReason || '').trim(),
    evidenceRefs: Array.isArray(input.evidenceRefs) ? [...new Set(input.evidenceRefs.map(String).map((value) => value.trim()).filter(Boolean))] : [],
    evidenceHash: String(input.evidenceHash || '').trim().toLowerCase(),
  };
  return payload;
}

async function employeeAndEmployment(input) {
  assertId(input.mitarbeiter, 'Mitarbeiter-ID');
  assertId(input.employment, 'Beschäftigungs-ID');
  const [employee, employment] = await Promise.all([
    Mitarbeiter.findById(input.mitarbeiter)
      .select('_id personalnr vorname nachname paychex_id integrations.paychex')
      .lean(),
    PayrollEmployment.findOne({ _id: input.employment, mitarbeiter: input.mitarbeiter, isCurrent: true, status: 'active' }).lean(),
  ]);
  if (!employee) throw new PayrollError('PAYROLL_EMPLOYEE_NOT_FOUND', 'Mitarbeiter nicht gefunden.', 404);
  if (!employment) throw new PayrollError('PAYROLL_EMPLOYMENT_REQUIRED', 'Aktuelle freigegebene Beschäftigung nicht gefunden.', 404);
  return { employee, employment };
}

async function appendAudit({ actor, profile, action, previousStatus = null, newStatus = null, reason }) {
  await PayrollAuditLog.create({
    actor: { user: actorId(actor), actorType: 'USER', displayId: actor?.email || actor?.name || null },
    mitarbeiter: profile.mitarbeiter,
    action,
    outcome: 'SUCCEEDED',
    previousStatus,
    newStatus,
    inputHash: profile.contentHash,
    reasonCode: 'PAYCHEX_PROVIDER_PROFILE',
    summary: reason,
    safeMetadata: { providerProfileId: profile._id, version: profile.version },
  });
}

async function createDraft(input, actor, internal = {}) {
  const context = await employeeAndEmployment(input);
  if (!internal.supersedes) {
    const existing = await PayrollProviderProfile.findOne({
      employment: context.employment._id,
      isCurrent: true,
    }).select('_id status').lean();
    if (existing) {
      throw new PayrollError(
        'PAYCHEX_PROFILE_REVISION_REQUIRED',
        'Für diese Beschäftigung existiert bereits ein aktuelles Paychex-Profil; Änderungen müssen als Revision angelegt werden.',
        409,
        { providerProfileId: existing._id, status: existing.status },
      );
    }
  }
  const data = canonicalProfilePayload(input, context);
  if (!data.changeReason || !data.evidenceRefs.length || !/^[a-f0-9]{64}$/.test(data.evidenceHash)
      || !/^[a-f0-9]{64}$/.test(data.providerReferenceDataHash)) {
    throw new PayrollError(
      'PAYCHEX_PROFILE_EVIDENCE_REQUIRED',
      'Provider-Profile benötigen Änderungsgrund, Evidenzverweise sowie Evidenz- und Referenzdaten-Hash.',
      400,
    );
  }
  const profile = new PayrollProviderProfile({
    ...data,
    ...internal,
    status: 'DRAFT',
    createdBy: actorId(actor),
    approvedBy: null,
    approvedAt: null,
  });
  profile.contentHash = sha256(profileHashProjection(profile));
  await profile.save();
  await appendAudit({ actor, profile, action: internal.supersedes ? 'CREATE_REVISION' : 'MANUAL_OVERRIDE', newStatus: 'DRAFT', reason: data.changeReason });
  return profile;
}

async function approve(profileId, actor) {
  assertId(profileId, 'Provider-Profil-ID');
  const profile = await PayrollProviderProfile.findOne({ _id: profileId, isCurrent: true, status: 'DRAFT' });
  if (!profile) throw new PayrollError('PAYCHEX_PROFILE_DRAFT_NOT_FOUND', 'Aktueller Provider-Profilentwurf nicht gefunden.', 404);
  if (idString(profile.createdBy) === idString(actorId(actor))) {
    throw new PayrollError('FOUR_EYES_REQUIRED', 'Provider-Profil-Erfasser und -Freigeber müssen unterschiedlich sein.', 409);
  }
  const recalculatedHash = sha256(profileHashProjection(profile));
  if (recalculatedHash !== profile.contentHash) {
    throw new PayrollError('PAYCHEX_PROFILE_CONTENT_HASH_MISMATCH', 'Der Provider-Profilinhalt stimmt nicht mehr mit seinem Hash überein.', 409);
  }
  const previousStatus = profile.status;
  profile.status = 'APPROVED';
  profile.approvedBy = actorId(actor);
  profile.approvedAt = new Date();
  await profile.save();
  await appendAudit({ actor, profile, action: 'APPROVE_INPUT', previousStatus, newStatus: 'APPROVED', reason: 'Paychex-Profil und provider-eigene gesetzliche Stammdaten geprüft.' });
  return profile;
}

async function revise(profileId, input, actor) {
  assertId(profileId, 'Provider-Profil-ID');
  const current = await PayrollProviderProfile.findOne({ _id: profileId, isCurrent: true });
  if (!current) throw new PayrollError('PAYCHEX_PROFILE_CURRENT_NOT_FOUND', 'Aktuelles Provider-Profil nicht gefunden.', 404);
  if (!String(input.changeReason || '').trim()) {
    throw new PayrollError('REVISION_EVIDENCE_REQUIRED', 'Die Provider-Profilrevision benötigt einen Änderungsgrund.', 400);
  }
  await invalidateEmployeeRuns({
    employeeId: current.mitarbeiter,
    validFrom: current.validFrom,
    validTill: current.validTill,
    actor,
    reason: `Paychex-Provider-Profilrevision ${current._id}`,
  });
  const base = plain(current);
  const merged = {
    ...base,
    ...input,
    employeePayload: { ...base.employeePayload, ...(input.employeePayload || {}) },
    contractPayload: { ...base.contractPayload, ...(input.contractPayload || {}) },
    providerOwnedStatutoryData: { ...base.providerOwnedStatutoryData, ...(input.providerOwnedStatutoryData || {}) },
    mitarbeiter: current.mitarbeiter,
    employment: current.employment,
  };
  current.isCurrent = false;
  current.status = 'RETIRED';
  await current.save();
  try {
    return await createDraft(merged, actor, {
      profileKey: current.profileKey,
      version: current.version + 1,
      isCurrent: true,
      supersedes: current._id,
    });
  } catch (error) {
    current.isCurrent = true;
    current.status = base.status;
    await current.save();
    throw error;
  }
}

async function list({ mitarbeiter, status, current = 'true', limit = 100 } = {}) {
  const query = {};
  if (mitarbeiter) { assertId(mitarbeiter, 'Mitarbeiter-ID'); query.mitarbeiter = mitarbeiter; }
  if (status) query.status = status;
  if (current !== 'false') query.isCurrent = true;
  return PayrollProviderProfile.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .lean();
}

module.exports = {
  createDraft,
  approve,
  revise,
  list,
  paychexEmployeePayload,
  paychexContractPayload,
  _private: { canonicalProfilePayload, profileHashProjection, dateOnly },
};
