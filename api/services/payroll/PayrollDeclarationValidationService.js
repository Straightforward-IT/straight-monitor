'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const PayrollError = require('../../utils/PayrollError');

const SCHEMA_DIRECTORY = path.resolve(__dirname, '../Documentation/Payroll/schema');
const SOURCE_CONTRACT_PATH = path.resolve(__dirname, '../Documentation/Payroll/AÜRV_2026.md');
const HASH_PATTERN = /^(?:sha256:)?([a-fA-F0-9]{64})$/;

const schemaFiles = {
  CUSTOMER_SITE_PAYROLL_DECLARATION: 'customer-site-payroll-declaration.v1.schema.json',
  EMPLOYEE_ASSIGNMENT_DECLARATION: 'employee-assignment-declaration.v1.schema.json',
};

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
addFormats(ajv);

const validators = Object.fromEntries(Object.entries(schemaFiles).map(([type, file]) => {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIRECTORY, file), 'utf8'));
  return [type, ajv.compile(schema)];
}));

function assertValidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) {
        throw new PayrollError('DECLARATION_CANONICALIZATION_INVALID', 'Der signierte Payload enthält ein ungültiges Unicode-Zeichen.', 422);
      }
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      throw new PayrollError('DECLARATION_CANONICALIZATION_INVALID', 'Der signierte Payload enthält ein ungültiges Unicode-Zeichen.', 422);
    }
  }
}

// RFC 8785/JCS uses ECMAScript primitive serialization and recursively sorted
// object property names. Declarations are plain JSON, so non-JSON values are
// rejected instead of being coerced into the signed payload.
function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new PayrollError('DECLARATION_CANONICALIZATION_INVALID', 'Der signierte Payload enthält eine nicht-endliche Zahl.', 422);
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new PayrollError('DECLARATION_CANONICALIZATION_INVALID', 'Der signierte Payload enthält eine nicht sicher darstellbare Ganzzahl.', 422);
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    assertValidUnicode(value);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => {
      if (value[key] === undefined) {
        throw new PayrollError('DECLARATION_CANONICALIZATION_INVALID', 'Der signierte Payload enthält undefined.', 422);
      }
      assertValidUnicode(key);
      return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
    }).join(',')}}`;
  }
  throw new PayrollError('DECLARATION_CANONICALIZATION_INVALID', 'Der signierte Payload enthält einen nicht unterstützten JSON-Wert.', 422);
}

function sha256Bytes(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function sha256Canonical(value) {
  return sha256Bytes(Buffer.from(canonicalize(value), 'utf8'));
}

function normalizeHash(value, label = 'Hash') {
  const match = HASH_PATTERN.exec(String(value || ''));
  if (!match) throw new PayrollError('DECLARATION_HASH_FORMAT_INVALID', `${label} muss ein SHA-256-Hash sein.`, 422);
  return `sha256:${match[1].toLowerCase()}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function signedBusinessPayload(declaration) {
  const payload = cloneJson(declaration);
  delete payload.internalReview;
  delete payload.changeHistory;
  if (payload.evidencePackage) delete payload.evidencePackage.signedPayloadHash;
  return payload;
}

function decodeBase64(value, label) {
  const encoded = String(value || '');
  if (!encoded || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new PayrollError('DECLARATION_ARTIFACT_INVALID', `${label} benötigt gültige, nicht-leere Base64-Daten.`, 422);
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded) {
    throw new PayrollError('DECLARATION_ARTIFACT_INVALID', `${label} benötigt kanonische, nicht-leere Base64-Daten.`, 422);
  }
  return bytes;
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function walk(value, visitor, pointer = '', ignored = false) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${escapePointer(key)}`;
    const childIgnored = ignored || (pointer === '' && ['internalReview', 'changeHistory'].includes(key));
    visitor({ parent: value, key, value: child, pointer: childPointer, ignored: childIgnored });
    walk(child, visitor, childPointer, childIgnored);
  }
}

function evidenceReferences(declaration) {
  const refs = new Set();
  walk(declaration, ({ key, value, ignored }) => {
    if (!ignored && ['evidenceRefs', 'assessmentEvidenceRefs', 'activityAnnexEvidenceRefs'].includes(key) && Array.isArray(value)) {
      value.forEach((entry) => refs.add(String(entry)));
    }
  });
  return [...refs].sort();
}

function artifactMap(declaration, artifacts) {
  const requiredRefs = evidenceReferences(declaration);
  const supplied = Array.isArray(artifacts?.evidence) ? artifacts.evidence : [];
  const byRef = new Map();
  for (const item of supplied) {
    const ref = String(item?.ref || '');
    if (!ref || byRef.has(ref)) {
      throw new PayrollError('DECLARATION_EVIDENCE_INVALID', 'Evidenzverweise müssen vorhanden und eindeutig sein.', 422);
    }
    const mediaType = String(item.mediaType || '');
    const capturedAt = String(item.capturedAt || '');
    const captured = new Date(capturedAt);
    if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(mediaType)
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(capturedAt)
        || Number.isNaN(captured.getTime())) {
      throw new PayrollError('DECLARATION_EVIDENCE_INVALID', `Evidenz ${ref} benötigt Medientyp und Erfassungszeitpunkt.`, 422);
    }
    const bytes = decodeBase64(item.contentBase64, `Evidenz ${ref}`);
    const contentHash = sha256Bytes(bytes);
    if (item.contentHash && normalizeHash(item.contentHash, `Evidenz-Hash ${ref}`) !== contentHash) {
      throw new PayrollError('DECLARATION_EVIDENCE_HASH_MISMATCH', `Der Inhalt von Evidenz ${ref} stimmt nicht mit ihrem Hash überein.`, 422);
    }
    byRef.set(ref, {
      ref,
      bytes,
      manifest: {
        reference: ref,
        contentHash,
        mediaType,
        capturedAt: captured.toISOString(),
      },
    });
  }

  const missing = requiredRefs.filter((ref) => !byRef.has(ref));
  const extra = [...byRef.keys()].filter((ref) => !requiredRefs.includes(ref));
  if (missing.length || extra.length) {
    throw new PayrollError('DECLARATION_EVIDENCE_COVERAGE_INVALID', 'Das Evidenzmanifest muss exakt alle signierten Evidenzverweise enthalten.', 422, { missing, extra });
  }
  return { byRef, requiredRefs };
}

function manifestFor(byRef, refs) {
  return {
    evidence: [...new Set(refs.map(String))].sort().map((ref) => {
      const artifact = byRef.get(ref);
      if (!artifact) throw new PayrollError('DECLARATION_EVIDENCE_UNRESOLVED', `Evidenz ${ref} konnte nicht aufgelöst werden.`, 422);
      return artifact.manifest;
    }),
  };
}

function validateSchema(declaration) {
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    throw new PayrollError('DECLARATION_REQUIRED', 'Eine Payroll-Erklärung als JSON-Objekt ist erforderlich.', 400);
  }
  const validator = validators[declaration.declarationType];
  if (!validator) throw new PayrollError('DECLARATION_TYPE_UNSUPPORTED', 'Der Erklärungstyp wird nicht unterstützt.', 422);
  if (!validator(declaration)) {
    const details = (validator.errors || []).map(({ instancePath, keyword, message, params }) => ({
      path: instancePath || '/', keyword, message, params,
    }));
    throw new PayrollError('DECLARATION_SCHEMA_INVALID', 'Die Payroll-Erklärung entspricht nicht dem versionierten Schema.', 422, { errors: details });
  }
}

function collectSignatureNodes(declaration) {
  const signatures = [];
  walk(declaration, ({ parent, key, value, pointer, ignored }) => {
    if (!ignored && key === 'signatureHash' && typeof value === 'string' && parent.signatureEnvelopeId) {
      signatures.push({ pointer, envelopeId: String(parent.signatureEnvelopeId), declared: value });
    }
  });
  return signatures;
}

function collectHashPaths(declaration) {
  const paths = [];
  walk(declaration, ({ key, value, pointer, ignored }) => {
    if (!ignored && /Hash$/.test(key) && typeof value === 'string') paths.push({ pointer, declared: value });
  });
  return paths;
}

function aggregateHashNodes(declaration) {
  const nodes = [];
  walk(declaration, ({ parent, key, value, pointer, ignored }) => {
    if (ignored || typeof value !== 'string') return;
    if (key === 'evidenceHash' && Array.isArray(parent.evidenceRefs)) {
      nodes.push({ path: pointer, declared: value, refs: parent.evidenceRefs, mode: 'MANIFEST' });
    } else if (key === 'assessmentHash' && Array.isArray(parent.assessmentEvidenceRefs)) {
      nodes.push({ path: pointer, declared: value, refs: parent.assessmentEvidenceRefs, mode: 'MANIFEST' });
    } else if (key === 'documentHash' && Array.isArray(parent.evidenceRefs)) {
      nodes.push({ path: pointer, declared: value, refs: parent.evidenceRefs, mode: parent.evidenceRefs.length === 1 ? 'DIRECT' : 'MANIFEST' });
    }
  });
  return nodes;
}

function compareHash(comparisons, verifiedPaths, { path: pointer, declared, computed, kind }) {
  const normalizedDeclared = normalizeHash(declared, pointer);
  const matches = normalizedDeclared === computed;
  comparisons.push({ path: pointer, kind, declared: normalizedDeclared, computed, matches });
  verifiedPaths.add(pointer);
}

function validateDeclarationEnvelope({ declaration, artifacts = {} }) {
  validateSchema(declaration);
  const comparisons = [];
  const verifiedPaths = new Set();
  const { byRef, requiredRefs } = artifactMap(declaration, artifacts);

  const fullManifest = manifestFor(byRef, requiredRefs);
  compareHash(comparisons, verifiedPaths, {
    path: '/evidencePackage/evidenceManifestHash',
    declared: declaration.evidencePackage.evidenceManifestHash,
    computed: sha256Canonical(fullManifest),
    kind: 'EVIDENCE_MANIFEST_JCS',
  });

  const sourceContractBytes = fs.readFileSync(SOURCE_CONTRACT_PATH);
  compareHash(comparisons, verifiedPaths, {
    path: '/evidencePackage/sourceContractHash',
    declared: declaration.evidencePackage.sourceContractHash,
    computed: sha256Bytes(sourceContractBytes),
    kind: 'SOURCE_CONTRACT_BYTES',
  });

  const signedDocumentBytes = decodeBase64(artifacts?.signedDocument?.contentBase64, 'Signiertes Dokument');
  compareHash(comparisons, verifiedPaths, {
    path: '/evidencePackage/signedDocumentHash',
    declared: declaration.evidencePackage.signedDocumentHash,
    computed: sha256Bytes(signedDocumentBytes),
    kind: 'SIGNED_DOCUMENT_BYTES',
  });

  compareHash(comparisons, verifiedPaths, {
    path: '/evidencePackage/signedPayloadHash',
    declared: declaration.evidencePackage.signedPayloadHash,
    computed: sha256Canonical(signedBusinessPayload(declaration)),
    kind: 'SIGNED_BUSINESS_PAYLOAD_JCS',
  });

  for (const node of aggregateHashNodes(declaration)) {
    let computed;
    if (node.mode === 'DIRECT') computed = sha256Bytes(byRef.get(String(node.refs[0])).bytes);
    else computed = sha256Canonical(manifestFor(byRef, node.refs));
    compareHash(comparisons, verifiedPaths, { ...node, computed, kind: `EVIDENCE_${node.mode}` });
  }

  const signatureProofs = new Map();
  for (const proof of Array.isArray(artifacts.signatureProofs) ? artifacts.signatureProofs : []) {
    const envelopeId = String(proof?.signatureEnvelopeId || '');
    if (!envelopeId || signatureProofs.has(envelopeId)) {
      throw new PayrollError('DECLARATION_SIGNATURE_PROOF_INVALID', 'Signaturnachweise benötigen eindeutige Envelope-IDs.', 422);
    }
    signatureProofs.set(envelopeId, decodeBase64(proof.contentBase64, `Signaturnachweis ${envelopeId}`));
  }
  const signatureNodes = collectSignatureNodes(declaration);
  const expectedEnvelopeIds = new Set(signatureNodes.map((entry) => entry.envelopeId));
  const extraProofs = [...signatureProofs.keys()].filter((entry) => !expectedEnvelopeIds.has(entry));
  if (extraProofs.length) {
    throw new PayrollError('DECLARATION_SIGNATURE_PROOF_INVALID', 'Nicht referenzierte Signaturnachweise sind nicht zulässig.', 422, { extraEnvelopeIds: extraProofs });
  }
  for (const signature of signatureNodes) {
    const bytes = signatureProofs.get(signature.envelopeId);
    if (!bytes) {
      throw new PayrollError('DECLARATION_SIGNATURE_PROOF_REQUIRED', `Signaturnachweis ${signature.envelopeId} fehlt.`, 422);
    }
    compareHash(comparisons, verifiedPaths, {
      path: signature.pointer,
      declared: signature.declared,
      computed: sha256Bytes(bytes),
      kind: 'SIGNATURE_ENVELOPE_BYTES',
    });
  }

  const bindings = new Map();
  for (const binding of Array.isArray(artifacts.hashBindings) ? artifacts.hashBindings : []) {
    const pointer = String(binding?.path || '');
    if (!pointer.startsWith('/') || bindings.has(pointer)) {
      throw new PayrollError('DECLARATION_HASH_BINDING_INVALID', 'Hash-Bindings benötigen eindeutige JSON-Pointer.', 422);
    }
    bindings.set(pointer, decodeBase64(binding.contentBase64, `Hash-Binding ${pointer}`));
  }

  const remaining = collectHashPaths(declaration).filter((entry) => !verifiedPaths.has(entry.pointer));
  for (const item of remaining) {
    const bytes = bindings.get(item.pointer);
    if (!bytes) {
      throw new PayrollError('DECLARATION_HASH_EVIDENCE_REQUIRED', `Für ${item.pointer} fehlt der auflösbare Hash-Inhalt.`, 422, { path: item.pointer });
    }
    compareHash(comparisons, verifiedPaths, {
      path: item.pointer,
      declared: item.declared,
      computed: sha256Bytes(bytes),
      kind: 'EXPLICIT_HASH_BINDING_BYTES',
    });
  }
  const unusedBindings = [...bindings.keys()].filter((pointer) => !verifiedPaths.has(pointer));
  if (unusedBindings.length) {
    throw new PayrollError('DECLARATION_HASH_BINDING_INVALID', 'Hash-Bindings dürfen nur nicht anderweitig auflösbare signierte Hash-Felder referenzieren.', 422, { unusedPaths: unusedBindings });
  }

  const mismatches = comparisons.filter((entry) => !entry.matches);
  if (mismatches.length) {
    throw new PayrollError('DECLARATION_HASH_MISMATCH', 'Mindestens ein Inhalt stimmt nicht mit dem signierten Hash überein.', 422, {
      mismatches: mismatches.map(({ path: pointer, kind }) => ({ path: pointer, kind })),
    });
  }

  return {
    valid: true,
    declarationType: declaration.declarationType,
    schemaVersion: declaration.schemaVersion,
    declarationId: declaration.declarationId,
    revision: declaration.revision,
    signedPayloadHash: normalizeHash(declaration.evidencePackage.signedPayloadHash),
    signedDocumentHash: normalizeHash(declaration.evidencePackage.signedDocumentHash),
    evidenceManifestHash: normalizeHash(declaration.evidencePackage.evidenceManifestHash),
    comparisonCount: comparisons.length,
    comparisons,
    signatureVerification: {
      mode: 'HASH_EQUALITY_ONLY',
      envelopeProofCount: signatureNodes.length,
      cryptographicAuthenticityVerified: false,
      limitation: 'Envelope bytes and declared hashes match, but no trusted-provider certificate/signature verification is configured.',
    },
  };
}

module.exports = {
  validateDeclarationEnvelope,
  _private: {
    canonicalize,
    sha256Bytes,
    sha256Canonical,
    normalizeHash,
    signedBusinessPayload,
    evidenceReferences,
    manifestFor,
    validateSchema,
    SOURCE_CONTRACT_PATH,
  },
};
