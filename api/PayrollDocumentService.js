'use strict';

const PayrollDocument = require('./models/PayrollDocument');
const PayrollRun = require('./models/PayrollRun');
const PayrollEmployeeSnapshot = require('./models/PayrollEmployeeSnapshot');
const PayrollAuditLog = require('./models/PayrollAuditLog');
const PaychexService = require('./PaychexService');
const R2Service = require('./R2Service');
const payrollConfig = require('./config/payroll');
const PayrollError = require('./utils/PayrollError');
const { sha256 } = require('./payroll-core/hash');

const actorId = (actor) => actor?._id || actor?.id || actor || null;
const idString = (value) => (value?._id || value)?.toString?.() || '';

function safeFileName(value) {
  return String(value || 'payroll-document.pdf')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'payroll-document.pdf';
}

function monthDates(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
    throw new PayrollError('PAYROLL_MONTH_INVALID', 'Ungültiger Payroll-Monat.', 400);
  }
  const [year, value] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function rowsFromResponse(response) {
  if (Array.isArray(response)) return response;
  return response?.results || response?.data || response?.documents || [];
}

function remoteDocumentId(metadata) {
  return metadata?.uid || metadata?.id || metadata?.document_uid || metadata?.documentUid || null;
}

function employeeUid(metadata) {
  const employee = metadata?.employee;
  if (typeof employee === 'string') return employee;
  return metadata?.employee_uid
    || metadata?.employeeUid
    || employee?.uid
    || employee?.id
    || metadata?.contract?.employee_uid
    || null;
}

function normalizeDocumentType(value) {
  return String(value || '').trim().normalize('NFKC').toLowerCase();
}

function documentCategory(metadata) {
  return typeof metadata?.category === 'string' && metadata.category.trim()
    ? metadata.category.trim()
    : null;
}

function documentDate(metadata) {
  const value = metadata?.date;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year
      || parsed.getUTCMonth() !== month - 1
      || parsed.getUTCDate() !== day) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

function documentSyncConfigurationStatus(config = payrollConfig) {
  const approvedPayslipTypes = config.paychex?.documents?.payslipTypes || [];
  const normalizedTypes = [...new Set(approvedPayslipTypes.map(normalizeDocumentType).filter(Boolean))].sort();
  const configured = normalizedTypes.length > 0;
  const enabled = Boolean(config.documentSyncEnabled);
  return {
    enabled,
    configured,
    canImport: enabled && configured,
    categoryField: 'category',
    approvedPayslipTypes: [...approvedPayslipTypes],
    documentTypeConfigHash: configured
      ? sha256({ categoryField: 'category', approvedPayslipTypes: normalizedTypes })
      : null,
    missing: configured ? [] : ['PAYCHEX_PAYSLIP_DOCUMENT_TYPES'],
  };
}

function classifyPayslipDocument({ run, listMetadata, detailMetadata, snapshotsByEmployeeUid, configuration }) {
  const listedCategory = documentCategory(listMetadata);
  const detailedCategory = documentCategory(detailMetadata);
  if (listedCategory && detailedCategory
      && normalizeDocumentType(listedCategory) !== normalizeDocumentType(detailedCategory)) {
    return { eligible: false, reason: 'CATEGORY_METADATA_MISMATCH' };
  }
  const category = detailedCategory || listedCategory;
  const approvedType = configuration.approvedPayslipTypes.find((entry) => (
    normalizeDocumentType(entry) === normalizeDocumentType(category)
  ));
  if (!category || !approvedType) return { eligible: false, reason: 'DOCUMENT_TYPE_NOT_APPROVED' };

  const listedDate = documentDate(listMetadata);
  const detailedDate = documentDate(detailMetadata);
  if (listMetadata?.date != null && !listedDate) return { eligible: false, reason: 'DOCUMENT_DATE_INVALID' };
  if (detailMetadata?.date != null && !detailedDate) return { eligible: false, reason: 'DOCUMENT_DATE_INVALID' };
  if (listedDate && detailedDate && listedDate !== detailedDate) {
    return { eligible: false, reason: 'DATE_METADATA_MISMATCH' };
  }
  const providerDocumentDate = detailedDate || listedDate;
  if (!providerDocumentDate) return { eligible: false, reason: 'DOCUMENT_DATE_MISSING' };
  if (providerDocumentDate.slice(0, 7) !== run.month) {
    return { eligible: false, reason: 'DOCUMENT_PERIOD_MISMATCH' };
  }

  const listedEmployeeUid = employeeUid(listMetadata);
  const detailedEmployeeUid = employeeUid(detailMetadata);
  if (listedEmployeeUid && detailedEmployeeUid
      && String(listedEmployeeUid) !== String(detailedEmployeeUid)) {
    return { eligible: false, reason: 'EMPLOYEE_METADATA_MISMATCH' };
  }
  const uid = detailedEmployeeUid || listedEmployeeUid;
  if (!uid) return { eligible: false, reason: 'EMPLOYEE_UID_MISSING' };
  const snapshot = snapshotsByEmployeeUid.get(String(uid)) || null;
  if (!snapshot) return { eligible: false, reason: 'EMPLOYEE_NOT_IN_RUN' };

  return {
    eligible: true,
    category,
    approvedType,
    providerDocumentDate,
    employeeUid: String(uid),
    snapshot,
  };
}

function storedDocumentIsEligible(document, { run, snapshotsById, configuration }) {
  const snapshot = snapshotsById.get(idString(document.payrollEmployeeSnapshot));
  const documentTypeApproved = configuration.approvedPayslipTypes.some((entry) => (
    normalizeDocumentType(entry) === normalizeDocumentType(document.documentType)
  ));
  return Boolean(
    document.status === 'IMPORTED'
    && document.isCurrent
    && document.month === run.month
    && document.documentPurpose === 'PAYSLIP'
    && documentTypeApproved
    && document.payslipValidation?.categoryField === 'category'
    && normalizeDocumentType(document.payslipValidation?.approvedDocumentType)
      === normalizeDocumentType(document.documentType)
    && document.payslipValidation?.documentTypeConfigHash === configuration.documentTypeConfigHash
    && document.payslipValidation?.typeMatched
    && document.payslipValidation?.periodMatched
    && document.payslipValidation?.employeeMatched
    && documentDate({ date: document.providerDocumentDate })?.slice(0, 7) === run.month
    && snapshot
    && idString(snapshot.mitarbeiter) === idString(document.mitarbeiter)
    && String(snapshot.employeeIdentity?.paychexEmployeeUid || '') === String(document.employeeUid || '')
  );
}

async function listAllDocuments(run) {
  const { startDate, endDate } = monthDates(run.month);
  const rows = [];
  const limit = 100;
  for (let offset = 0; offset < 10000; offset += limit) {
    const response = await PaychexService.listDocuments({
      companyKey: run.companyKey,
      startDate,
      endDate,
      limit,
      offset,
    });
    const page = rowsFromResponse(response);
    rows.push(...page);
    const count = Number(response?.count);
    if (page.length < limit || (Number.isFinite(count) && rows.length >= count) || response?.next === null) break;
  }
  return rows;
}

async function appendAudit({ actor, run, snapshot = null, employee = null, outcome, error = null, summary, safeMetadata = {} }) {
  await PayrollAuditLog.create({
    actor: { user: actorId(actor), actorType: 'USER', displayId: actor?.email || actor?.name || null },
    payrollRun: run._id,
    payrollEmployeeSnapshot: snapshot?._id || null,
    mitarbeiter: employee || snapshot?.mitarbeiter || null,
    action: 'IMPORT_DOCUMENTS',
    outcome,
    errorCode: error?.code || null,
    errorMessage: error ? String(error.message || error).slice(0, 2000) : null,
    summary,
    safeMetadata,
  });
}

async function importOne({ run, metadata, snapshotsByEmployeeUid, actor, configuration }) {
  const remoteId = remoteDocumentId(metadata);
  if (!remoteId) {
    throw new PayrollError('PAYCHEX_DOCUMENT_ID_MISSING', 'Paychex-Dokument ohne stabile ID erhalten.', 502);
  }
  const downloaded = await PaychexService.downloadDocument(remoteId, { companyKey: run.companyKey });
  const classification = classifyPayslipDocument({
    run,
    listMetadata: metadata,
    detailMetadata: downloaded.metadata,
    snapshotsByEmployeeUid,
    configuration,
  });
  if (!classification.eligible) {
    return {
      document: null,
      skipped: false,
      eligible: false,
      reason: classification.reason,
      remoteDocumentId: String(remoteId),
    };
  }
  if (downloaded.contentType !== 'application/pdf' || !Buffer.isBuffer(downloaded.buffer) || downloaded.buffer.byteLength === 0) {
    return {
      document: null,
      skipped: false,
      eligible: false,
      reason: 'PAYSLIP_FILE_INVALID',
      remoteDocumentId: String(remoteId),
    };
  }
  const contentHash = sha256(downloaded.buffer);
  const providerMetadataHash = sha256(downloaded.metadata);
  const uid = classification.employeeUid;
  const snapshot = classification.snapshot;
  const previous = await PayrollDocument.findOne({
    provider: 'paychex',
    companyKey: run.companyKey,
    remoteDocumentId: String(remoteId),
    isCurrent: true,
  });

  const snapshotsById = new Map([[idString(snapshot), snapshot]]);
  if (previous?.contentHash === contentHash
      && storedDocumentIsEligible(previous, { run, snapshotsById, configuration })) {
    return { document: previous, skipped: true, eligible: true };
  }

  const revision = (previous?.revision || 0) + 1;
  const fileName = safeFileName(downloaded.metadata?.name || metadata?.name || `${remoteId}.pdf`);
  const r2Key = [
    'payroll-private',
    'paychex',
    run.companyKey,
    run.month,
    uid || 'unlinked',
    `${remoteId}-r${revision}-${contentHash.slice(0, 12)}-${fileName}`,
  ].map((segment) => safeFileName(segment)).join('/');
  await R2Service.uploadFile(r2Key, downloaded.buffer, downloaded.contentType);

  if (previous) {
    previous.isCurrent = false;
    previous.status = 'SUPERSEDED';
    await previous.save();
  }
  let document;
  try {
    document = await PayrollDocument.create({
      provider: 'paychex',
      companyKey: run.companyKey,
      payrollRun: run._id,
      payrollEmployeeSnapshot: snapshot?._id || null,
      mitarbeiter: snapshot?.mitarbeiter || null,
      month: run.month,
      employeeUid: uid,
      remoteDocumentId: String(remoteId),
      revision,
      isCurrent: true,
      supersedes: previous?._id || null,
      documentType: classification.category,
      documentPurpose: 'PAYSLIP',
      providerDocumentDate: classification.providerDocumentDate,
      payslipValidation: {
        categoryField: 'category',
        approvedDocumentType: classification.approvedType,
        documentTypeConfigHash: configuration.documentTypeConfigHash,
        typeMatched: true,
        periodMatched: true,
        employeeMatched: true,
        validatedAt: new Date(),
      },
      fileName,
      contentType: downloaded.contentType,
      byteLength: downloaded.buffer.byteLength,
      contentHash,
      providerMetadataHash,
      r2Key,
      importedBy: actorId(actor),
      status: 'IMPORTED',
    });
  } catch (error) {
    if (previous) {
      previous.isCurrent = true;
      previous.status = previous.mitarbeiter ? 'IMPORTED' : 'UNLINKED';
      await previous.save();
    }
    throw error;
  }
  await appendAudit({
    actor, run, snapshot,
    outcome: 'SUCCEEDED',
    summary: 'Typ-, perioden- und mitarbeitergeprüfter Paychex-Payslip privat importiert',
    safeMetadata: {
      remoteDocumentId: String(remoteId), documentId: document._id,
      byteLength: document.byteLength, contentHash, linked: true,
      documentTypeConfigHash: configuration.documentTypeConfigHash,
    },
  });
  return { document, skipped: false, eligible: true };
}

async function syncRunDocuments(runId, actor) {
  const configuration = documentSyncConfigurationStatus();
  if (!configuration.enabled) {
    throw new PayrollError(
      'PAYROLL_DOCUMENT_SYNC_DISABLED',
      'Payroll-Dokumentimport ist durch PAYROLL_DOCUMENT_SYNC_ENABLED gesperrt.',
      409,
    );
  }
  if (!configuration.configured) {
    throw new PayrollError(
      'PAYROLL_PAYSLIP_DOCUMENT_TYPES_REQUIRED',
      'Der Dokumentimport bleibt gesperrt, bis die von Paychex und Payroll freigegebenen Payslip-Kategorien explizit konfiguriert sind.',
      409,
      { missing: configuration.missing },
    );
  }
  const run = await PayrollRun.findById(runId);
  if (!run) throw new PayrollError('PAYROLL_RUN_NOT_FOUND', 'Payroll-Lauf nicht gefunden.', 404);
  if (!['PAYROLL_COMPLETED', 'DOCUMENTS_IMPORTED'].includes(run.status)) {
    throw new PayrollError('PAYROLL_RUN_STATE_INVALID', 'Dokumente dürfen erst nach bestätigtem Paychex-Abschluss importiert werden.', 409);
  }
  const snapshots = await PayrollEmployeeSnapshot.find({ payrollRun: run._id, isCurrent: true }).lean();
  const snapshotsByEmployeeUid = new Map();
  const missingEmployeeUids = [];
  const duplicateEmployeeUids = [];
  for (const snapshot of snapshots) {
    const uid = String(snapshot.employeeIdentity?.paychexEmployeeUid || '').trim();
    if (!uid) {
      missingEmployeeUids.push(idString(snapshot.mitarbeiter));
      continue;
    }
    if (snapshotsByEmployeeUid.has(uid)) duplicateEmployeeUids.push(uid);
    else snapshotsByEmployeeUid.set(uid, snapshot);
  }
  if (snapshots.length !== run.employeeCount || missingEmployeeUids.length || duplicateEmployeeUids.length) {
    throw new PayrollError(
      'PAYROLL_DOCUMENT_EMPLOYEE_IDENTITY_INVALID',
      'Payslip-Import benötigt genau einen aktuellen Snapshot und eine eindeutige Paychex-Mitarbeiter-ID je Cohort-Mitarbeiter.',
      409,
      {
        employeeCount: run.employeeCount,
        snapshotCount: snapshots.length,
        missingEmployeeUidCount: missingEmployeeUids.length,
        duplicateEmployeeUidCount: duplicateEmployeeUids.length,
      },
    );
  }
  const metadataRows = await listAllDocuments(run);
  let imported = 0;
  let skipped = 0;
  let ignored = 0;
  const ignoredByReason = {};
  for (const metadata of metadataRows) {
    const result = await importOne({ run, metadata, snapshotsByEmployeeUid, actor, configuration });
    if (!result.eligible) {
      ignored += 1;
      ignoredByReason[result.reason] = (ignoredByReason[result.reason] || 0) + 1;
      continue;
    }
    if (result.skipped) skipped += 1;
    else imported += 1;
  }
  const snapshotIds = snapshots.map((entry) => entry._id);
  const snapshotsById = new Map(snapshots.map((entry) => [idString(entry), entry]));
  const documents = await PayrollDocument.find({
    payrollRun: run._id,
    month: run.month,
    payrollEmployeeSnapshot: { $in: snapshotIds },
    isCurrent: true,
    status: 'IMPORTED',
    documentPurpose: 'PAYSLIP',
    'payslipValidation.categoryField': 'category',
    'payslipValidation.documentTypeConfigHash': configuration.documentTypeConfigHash,
    'payslipValidation.typeMatched': true,
    'payslipValidation.periodMatched': true,
    'payslipValidation.employeeMatched': true,
  }).lean();
  const eligibleDocuments = documents.filter((document) => storedDocumentIsEligible(
    document,
    { run, snapshotsById, configuration },
  ));
  const coveredEmployeeIds = new Set(eligibleDocuments.map((entry) => idString(entry.mitarbeiter)));
  const expectedEmployeeIds = new Set(snapshots.map((entry) => idString(entry.mitarbeiter)));
  const coveredEmployees = coveredEmployeeIds.size;
  const exactCoverage = coveredEmployees === run.employeeCount
    && expectedEmployeeIds.size === run.employeeCount
    && [...expectedEmployeeIds].every((employeeId) => coveredEmployeeIds.has(employeeId));
  run.counters.documentsImported = coveredEmployees;
  if (exactCoverage) {
    if (run.status !== 'DOCUMENTS_IMPORTED') {
      const previousStatus = run.status;
      run.status = 'DOCUMENTS_IMPORTED';
      run.statusHistory.push({ from: previousStatus, to: 'DOCUMENTS_IMPORTED', at: new Date(), by: actorId(actor), reason: 'Geprüfte Paychex-Payslips vollständig importiert' });
    }
    await run.save();
    return {
      run, imported, skipped, ignored, ignoredByReason, coveredEmployees,
      documentTypeConfigHash: configuration.documentTypeConfigHash,
    };
  }
  await run.save();
  const error = new PayrollError(
    'PAYROLL_DOCUMENT_COVERAGE_INCOMPLETE',
    'Paychex-Dokumente decken noch nicht alle Mitarbeiter des Payroll-Laufs ab.',
    409,
    {
      employeeCount: run.employeeCount,
      coveredEmployees,
      imported,
      skipped,
      ignored,
      ignoredByReason,
      documentTypeConfigHash: configuration.documentTypeConfigHash,
    },
  );
  await appendAudit({ actor, run, outcome: 'FAILED', error, summary: error.message, safeMetadata: error.details });
  throw error;
}

async function listRunDocuments(runId) {
  return PayrollDocument.find({ payrollRun: runId, isCurrent: true })
    .select('-r2Key')
    .sort({ mitarbeiter: 1, fileName: 1 })
    .lean();
}

async function createPrivateDownload(documentId) {
  const document = await PayrollDocument.findById(documentId).lean();
  if (!document || !document.isCurrent) {
    throw new PayrollError('PAYROLL_DOCUMENT_NOT_FOUND', 'Payroll-Dokument nicht gefunden.', 404);
  }
  return {
    url: await R2Service.getSignedDownloadUrl(document.r2Key, 300, { filename: document.fileName }),
    expiresInSeconds: 300,
    fileName: document.fileName,
  };
}

module.exports = {
  syncRunDocuments,
  listRunDocuments,
  createPrivateDownload,
  configurationStatus: documentSyncConfigurationStatus,
  _private: {
    safeFileName,
    monthDates,
    rowsFromResponse,
    remoteDocumentId,
    employeeUid,
    normalizeDocumentType,
    documentCategory,
    documentDate,
    documentSyncConfigurationStatus,
    classifyPayslipDocument,
    storedDocumentIsEligible,
    importOne,
  },
};
