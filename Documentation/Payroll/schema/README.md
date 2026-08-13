# Payroll declaration schemas

These schemas define the signed evidence boundary that StraightMonitor needs before a customer/site rule or an employee assignment can become payroll-ready. They supplement the framework agreement; they do not edit or silently reinterpret `../AÜRV_2026.md`.

The included example files are fictional. Their hash values, identities, dates, remuneration figures and empty example holiday-date list are placeholders and must never be imported into production.

## Source-contract coverage

The framework agreement makes several facts external to its four-page body:

- § 3 refers to an activity-profile annex and requires the customer to state workplace requirements.
- § 4 makes the missing “Zuschläge und Branchenzugehörigkeit” annex part of the agreement.
- § 5.2 and § 5.3 require prior customer-employment and prior staffing-provider facts.
- § 6.1 bases commercial payment on actual hours excluding breaks; § 6.4 separately defines a four-/six-hour invoice minimum.
- § 10.1 states that the customer has no premium rules unless reported in the missing annex.
- § 11.4 requires changes and additions to be documented in writing.

`customer-site-payroll-declaration.v1.schema.json` supplies the missing site/payroll annex in a machine-readable form. `employee-assignment-declaration.v1.schema.json` supplies the employee-specific activity, classification and continuity declaration. A rendered and signed document remains the legal evidence; the JSON payload is its traceable payroll representation.

## Operational sector is not a Branchenzuschlag agreement

These values must never be collapsed into one field:

| Declaration fact | Allowed values | Model mapping | Payroll effect |
| --- | --- | --- | --- |
| `site.operationalSector` | `GASTRONOMY`, `HOSPITALITY`, `EVENTS`, `CATERING`, `EVENT_CATERING`, `OTHER_VERIFIED` | `CustomerPayrollRule.industryCode` | Describes the actual customer/site operation. It does not activate a Branchenzuschlag tariff. |
| `industrySurchargeAgreement.decision` | `UNKNOWN`, `NONE`, `APPLICABLE` | `CustomerPayrollRule.industrySurchargeTariffCode` | `UNKNOWN` maps to no approved code and blocks activation/export. `NONE` maps to the literal `NONE`. `APPLICABLE` maps to the evidenced agreement code and needs an approved `TariffVersion`. |

In particular, `GASTRONOMY`, `EVENTS` or `CATERING` must not be copied into `industrySurchargeTariffCode`. `NONE` is permitted only after the site-level assessment and its evidence are complete; it is not inferred from the operational sector.

The same rule applies to customer premiums. A framework-contract statement is not enough to activate `customerPremiumRules.decision = NONE`: the signed declaration also records checks for customer agreements, company rules, employee-specific rules and contradictory historical payroll. Any unresolved source leaves the decision `UNKNOWN`, which is a hard payroll blocker.

## Mapping to the canonical ledgers

The import/application service should map signed business facts as follows. Review identities and timestamps are always server-owned fields, never trusted from an uploaded JSON payload.

### Customer/site declaration

| Schema path | Canonical destination |
| --- | --- |
| `declarationId`, `revision`, `supersedesDeclarationId` | `CustomerPayrollRule.ruleKey`, `version`, `supersedes` |
| `validityPeriod` | `validFrom`, `validTill` |
| `customer.*` | `kunde`, `kundenNrSnapshot` plus the signed identity evidence |
| `site.siteKey` | `siteKey` |
| `site.address`, signer and evidence hashes | `siteDeclaration.*` |
| `site.operationalSector` | `industryCode` |
| `site.holidayJurisdiction` | `holidayFederalState` |
| `industrySurchargeAgreement` | `industrySurchargeTariffCode`, `industrySurchargeRuleVersion` |
| `customerPremiumRules` | `premiumOverrides` (percentages are integer basis points) |
| `equalPayComparator` | `equalPay`, including the explicit hourly-rate scope and any conversion-policy evidence |
| `holidayCalendar` | `holidayCalendar` |
| `evidencePackage.*Hash` | `declarationEvidence.*Hash` after canonicalization and byte-level hash verification; model `contentHash` remains the server hash of the mapped draft |
| `internalReview` | server-authenticated `createdBy`, `approvedBy`, `approvedAt` and `siteDeclaration.reviewed*` |

### Employee-specific assignment declaration

| Schema path | Canonical destination |
| --- | --- |
| `assignmentKey`, `revision`, `supersedesDeclarationId` | `AssignmentLedger.assignmentKey`, `version`, `supersedes` |
| employee/customer/order identifiers | `mitarbeiter`, `kunde`, `auftrag`, `einsatz` and immutable snapshots |
| `siteDeclarationRef` | `customerPayrollRule` after ID, revision, site and payload-hash verification |
| `activityProfile` and `tariffDecision` | activity/work-location fields plus `employeeTariffDecision` |
| `assignmentPeriod`, `plannedWorkingTime` | assignment/planning fields |
| `continuityEvidence.priorAssignments` | `continuityEvidence.priorAssignments`, including other staffing providers |
| `continuityEvidence.exactInterruptionPeriods` | normalized assignment-history facts used to derive `interruption` and the continuity timeline |
| continuity counts | `countsTowardEqualPay`, `countsTowardIndustryTenure` |
| `payrollTreatment.payrollEligible` | `payrollEligible` |
| `internalReview` | server-authenticated `recordedBy`, `confirmedBy`, `confirmedAt` |

The current `AssignmentLedger` stores one normalized interruption on each assignment. The signed schema deliberately retains the complete interruption array so no historical interval is lost. Import must recompute chronological order, interval length, continuity groups and threshold dates; it must reject, not trust, inconsistent submitted calculations.

## Signature, hash and evidence rules

- `signedDocumentHash` is SHA-256 over the exact immutable signed document bytes.
- `signatureHash` is SHA-256 over the retained signature/envelope proof identified by `signatureEnvelopeId`.
- `signedPayloadHash` is SHA-256 over the RFC 8785/JCS canonical form of the signed business payload. The exact input is the complete declaration after removing the top-level `internalReview` and `changeHistory` properties and `evidencePackage.signedPayloadHash` itself. No other business fact is removed.
- `evidenceManifestHash` is SHA-256 over the JCS form of `{ "evidence": [...] }`. Entries are sorted by `reference` and contain exactly `reference`, `contentHash`, `mediaType` and the normalized UTC `capturedAt`. The manifest must cover every signed evidence reference exactly once. Evidence references without supplied immutable bytes are invalid.
- A hash comparison is performed before model mapping. The uploaded value is never accepted as proof by itself.
- A signed or reviewed declaration is immutable. Corrections create a new revision with `supersedesDeclarationId`, a reason, fresh hashes and fresh signatures where a signed business fact changed. The earlier revision is retained.

JSON Schema cannot assert that two IDs differ. StraightMonitor must therefore enforce these four-eyes conditions in application code and the database workflow:

- `internalReview.preparedBy != internalReview.reviewedBy` for the customer/site declaration;
- `internalReview.recordedBy != internalReview.confirmedBy` for the assignment declaration;
- reviewer IDs and timestamps come from the authenticated session;
- no actor may approve a revision that they created;
- a declaration whose decision, comparator, continuity history, site link, signature or evidence is unresolved remains a draft and blocks payroll export.

The customer signer and employee signer are evidence parties, not substitutes for StraightMonitor's internal reviewer.

## Validation and import order

The API uses Ajv 8 plus `ajv-formats` for JSON Schema draft 2020-12 validation. The safe import sequence is:

1. Validate against the relevant versioned JSON Schema, including date/date-time formats.
2. Resolve every internal ID and immutable evidence reference.
3. Verify document, signature, payload and manifest hashes.
4. Recompute date ranges, exact interruption days, continuity groups, Equal-Pay threshold dates and all model mappings.
5. Write a `draft`/`DRAFT` ledger revision without client-supplied review fields.
6. Perform authenticated four-eyes review and activate/confirm through the payroll data service.
7. Lock the source revision into the immutable payroll snapshot before export.

## Runtime endpoints

The authenticated `PAYROLL`/`ADMIN` API exposes:

- `POST /api/payroll/declarations/validate` to validate the schema and all supplied hash-bound artifacts without writing a ledger record;
- `POST /api/payroll/declarations/import` to perform the same validation, resolve internal IDs and create only a `draft` customer/site rule or `DRAFT` employee assignment through `PayrollDataService`.

Both accept `{ declaration, artifacts }`; import additionally requires `resolution`. `artifacts` contains the exact signed-document bytes, one immutable item for every evidence reference, signature-envelope proof bytes, and explicit byte bindings for signed hash fields that have no evidence-reference or envelope relationship. Binary values are canonical Base64. Client-supplied internal-review identities and timestamps are never mapped. A second authenticated user must still use the normal approval route.

Assignment import recomputes calendar order, exact interruption periods, inclusive interruption days, the three-calendar-month Equal-Pay reset and the nine-month threshold. An `APPLICABLE` Branchenzuschlag assignment remains blocked until its tariff-specific continuity policy is implemented.

Equal-Pay comparator packages are retained without flattening. `comparisonHourlyRateScope` defaults to `BASE_ONLY`; an `ALL_IN_REGULAR_PACKAGE` claim additionally requires a conversion-policy ID and evidence hash. Monthly or regular comparison components continue to block the current hourly-only calculation engine even when they were imported successfully.

Hash equality is not cryptographic signature authentication. The current service proves that supplied immutable bytes match the signed hashes and records `HASH_EQUALITY_ONLY`; it does not verify a DocuSeal/provider certificate chain, signer identity, signature timestamp, revocation status or qualified-signature trust. Such imports remain drafts and are also blocked by runtime payroll validation. They cannot become active/confirmed until a trusted verification workflow creates evidence with `CRYPTOGRAPHICALLY_VERIFIED`.

Basic repository checks can confirm that every schema and example is valid JSON:

```sh
node -e "for (const f of require('fs').readdirSync('Documentation/Payroll/schema').filter(f => f.endsWith('.json'))) JSON.parse(require('fs').readFileSync('Documentation/Payroll/schema/' + f, 'utf8'))"
```

Successful JSON parsing is not schema validation and must not be represented as such. The runtime validator additionally performs the hash and artifact checks described above.
