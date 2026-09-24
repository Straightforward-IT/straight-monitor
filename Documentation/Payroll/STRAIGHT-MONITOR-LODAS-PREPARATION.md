# Straight Monitor: monthly preparation for LODAS

## Delivered phase

`/payroll` is the employee/month workspace. The Stundenerfassung tab combines
released operational hours with saved preparation items. Monatsprüfung shows
server totals, source changes, internal review history, and offline LODAS previews.
An internal review is possible before credentials or DATEV mappings exist.

This implementation performs no DATEV requests and does not replace Zvoove's
payroll calculation. It prepares quantities, not premium, absence-pay, gross,
net, tax, social-insurance, or staffing-specific wage calculations.

## Records and ownership

- `Stundenzeit` remains the source of actual worked dates, instants, breaks, and
  released durations. Payroll preparation does not update it. Planned shifts and
  office drafts without a release do not enter the preparation quantities.
- `PayrollPreparation` is unique per internal employee ID and month. Its revision
  protects against concurrent edits. It stores original-period absence entries,
  explicit daily minutes, signed quantity corrections, AZK movement proposals,
  acknowledged source data, and the edit history.
- Absences belong to the month of their original start date. Later months read
  the same period from that originating record, preserving original dates and
  projecting only the explicitly entered daily quantities into their totals.
  The UI links back to the originating month for editing. Changing that period
  invalidates affected saved preparations/snapshots through their source hash.
- `PayrollSnapshot` contains the reviewed source facts, prepared items and totals,
  reviewer, time, and SHA-256 content hash. Snapshots cannot be updated or deleted
  through the application model or routes. Reopening creates a draft revision;
  prior snapshots remain available.
- `PayrollMapping` stores immutable, numbered configuration versions per internal
  employee. The DATEV client and personnel number are separate from Zvoove IDs.
  Each preview identifies its mapping version. This phase uses explicit
  per-employee configurations; a future shared client catalogue can supply them.
- `PayrollPreparationGuard` serializes payroll preparation writes per employee,
  including overlapping absence edits across different months. It contains only
  an internal revision, no account data.

All durations are whole minutes. Dates are calendar dates; existing shift instants
retain Europe/Berlin interpretation from time capture. Overnight shifts remain
assigned to their original capture date/month; their full instants are retained
for a later agreed splitting/valuation policy.

## Preparation, review and corrections

1. Existing location-authorized staff add/edit entries and a save reason. Saved
   absence code, label, source Lohnart and crediting are preserved even if imported
   category labels subsequently change. New categories come from imported KB data.
2. Sickness/absence start and end dates are distinct from daily credited minutes.
   No standard working day, payment eligibility or automatic salary amount is
   inferred. Empty daily quantities carry no hour amount; explicitly entered 0
   stays 0. Overlapping periods of the same category are rejected.
3. Eimer mode on a released shift opens a proposed transfer from that source into
   AZK; the account tile opens an AZK withdrawal proposal. The form records the
   quantity, source, destination and reason. Actual worked time is unchanged.
   Combined proposed deposits cannot exceed the referenced released duration.
4. PAYROLL/ADMIN with employee-location access can finalize a saved, reconciled
   draft. ADMIN retains cross-location access. Roles are reloaded from MongoDB
   on each request; JWT role claims are not trusted.
5. Changed releases, withdrawn/new releases, or changed inherited absence facts
   make saved preparation stale. An office draft with unchanged released values
   does not. Source refresh shows differences in released facts and inherited
   periods/daily quantities while retaining local inputs. It refuses to adopt a
   concurrently saved preparation revision. An explicit reconciliation and save
   is required before another finalization. Unresolved source references must be
   corrected or removed by the editor.
6. Frozen preparation cannot be edited until PAYROLL/ADMIN reopens it. A preview
   flags historical/superseded snapshots and source staleness independently of
   whether their mappings are complete. There is no transmission operation.

Save failures leave unsaved input intact. Employee/month changes and leaving the
page warn about unsaved changes. Switching between the two payroll tabs preserves
the same draft. Saves/finalization are blocked while an entry form still contains
unapplied changes. Successful server responses establish the saved baseline.

## Zeitkonto: no parallel balance

LODAS is the intended sole source of the calculated Zeitkonto balance. There is
no local opening balance, account ledger or balance reconstruction. Saved AZK
items are **proposed submission movements only** and never prove availability.
They remain separate from the original worked quantity; an export must not both
subtract local worked time and send a mapped subtraction for the same movement.

`timeAccountReader.readTimeAccount({ employeeId, month })` currently returns
`UNAVAILABLE`; it never returns a fabricated zero. A future implementation may
return `{ status: 'AVAILABLE', minutes, period, fetchedAt }` transiently. Its
response must not enter MongoDB, snapshots, logs, browser storage, or a durable
cache. The payroll API sets `Cache-Control: no-store`.

The supplied hr:exchange 1.0.28 contract has no explicit calculated AZK balance
resource. Its `Account` schema describes bank details; `IndividualData` describes
custom fields, not a documented account balance. Confirm supported on-demand
retrieval with DATEV before implementing the reader. No direct LODAS database
connection is assumed.

## API

All paths below begin `/api/payroll/employees/:employeeId` and require confirmed
internal authentication and current employee-location access.

| Method/path | Purpose |
| --- | --- |
| `GET /months/:month` | Draft, sources, totals, staleness, snapshot list and external-account availability |
| `PUT /months/:month` | Save `{ revision, sourceHash, items, reason, reconcile? }` |
| `POST /months/:month/finalize` | Freeze `{ revision, sourceHash, reason }`; PAYROLL/ADMIN |
| `POST /months/:month/reopen` | Open a new draft revision with the same request fields; PAYROLL/ADMIN |
| `GET /snapshots/:id` | Immutable reviewed content plus current/stale flags |
| `GET /snapshots/:id/preview` | Offline projection using latest mapping, identified by version; PAYROLL/ADMIN |
| `GET /lodas-mapping` | Latest employee/client/rule mapping; PAYROLL/ADMIN |
| `PUT /lodas-mapping` | Save a new version from `{ version, config }`; PAYROLL/ADMIN |

Item shapes (additional fields are rejected):

```js
// ABSENCE belongs to the month containing startDate. A period may cross months.
{ id, kind: 'ABSENCE', code, startDate, endDate,
  daily: [{ date, minutes }], reason }
{ id, kind: 'ADJUSTMENT', date, minutes, source: '<released source ID or empty>', reason }
{ id, kind: 'TRANSFER', date, minutes, source: '<released source ID>', target: 'AZK', reason }
{ id, kind: 'TRANSFER', date, minutes, source: 'AZK', target: 'PAYMENT', reason }
```

IDs are stable client-created UUIDs; server validation resolves all referenced
sources against this employee/month. Corrections may be signed. Transfer minutes
are positive; source/destination express direction. Unknown client fields such
as `balance` or `bankMinutes` are rejected, not copied into persisted JSON.

HTTP 409 distinguishes revision conflicts, frozen state, changed sources, and a
required explicit reconciliation. Sensitive payroll bodies are not passed to
the legacy global error logger.

## Offline LODAS mapping

The pure mapper uses `hr_exchange-1.0.28.json` for wire constraints. An identical
copy ships in `api/services/payroll` so API-only deployments work; a fixture test
checks it against the supplied documentation contract. It validates
scalar types, bounds, enums, dates, unknown fields and the custom
`x-allowed-values-*` extensions used by MonthRecord and AbsenceLodas.

Configuration has `clientId`, `personnelNumber` and `rules`. A rule selects a
source code (`P`, `M`, imported absence code, `AZK_DEPOSIT`, `AZK_WITHDRAWAL`):

- `QUANTITY`: explicit LODAS salary type, processing code, `HOURS`/`MINUTES`, sign
  (`1`/`-1`) and optional cost centre.
- `ABSENCE`: explicit LODAS absence reason.
- `BOTH`: both mappings.
- `EXCLUDE`: explicit exclusion reason retained in the preview.

No DATEV identifiers or AZK signs are seeded. Source Zvoove Lohnarten remain
independent. A missing mapping is a visible issue; incomplete previews produce
no request package. Units requiring other explicit inputs (for example days or
money) are not inferred from minutes and are outside this phase.

Quantities sharing the same destination, unit and sign aggregate as integer
minutes before conversion. Hours round half away from zero to two decimal places.
The preview retains the original aggregate, converted value and source IDs.
It prepares `/clients/{client-id}/month-records` with a `reference-date` query
and `Target-System: lodas`, plus separate employee `absences/lodas` requests.

Continuous absences retain their full original interval in every relevant
preview. Continuations are marked and share a stable external identity based on
start date/reason within the employee/client context. Before enabling live writes,
the transport must reconcile existing DATEV periods and avoid blindly creating
the same absence again in each month. These offline request previews are not a
ready-made unattended sender.

## DATEV concept meeting and later integration

Confirm:

1. Supported AZK balance retrieval, freshness/period semantics and required
   API/data service; the generic custom-field resource is not assumed sufficient.
2. Manual versus automatic LODAS AZK configuration, applicable tenant Lohnarten,
   processing codes, signs, unvalued versus valued movements, and account limits.
   DATEV support describes manual movements using a Lohnart based on Stammlohnart
   460, but this is not a tenant configuration or an hr:exchange acceptance test:
   https://www.datev-community.de/t5/Personalwirtschaft/Arbeitszeitkonto-AZK-Stunden-ja-Geldwert-nein/td-p/183425
3. Which absence categories require dates, quantities, both, or deliberate
   exclusion; continuous-period correction/deletion and payment valuation.
4. Agreed rounding, overnight/month-boundary treatment, correction periods,
   duplicate prevention, and assignment of payroll personnel numbers.
5. Actual credentials, OAuth/session requirements, initial reads, asynchronous
   jobs, post-write reconciliation, production acceptance, and retention policy.

Rollout is additive. It creates new preparation/snapshot/mapping collections on
use and requires the existing MongoDB replica-set transaction support. Ensure
the declared unique indexes exist before enabling writes. Existing captures and
Zvoove data are not migrated or marked as submitted. Historical balance migration,
gross/net calculation, automatic premiums and live API calls remain later work.

## Verification

`api/tests/payrollPreparation.test.js` covers isolated database persistence,
permissions, concurrent writes, immutability/reopening, source reconciliation,
cross-month absences, mappings, input boundaries and offline wire conversion.
`frontend/Straight-Monitor/tests/payrollPreparation.spec.js` covers save failure
retention, navigation guards, stale reads, balance-free payloads, and review/editor
behavior. Run these alongside the existing time-capture/time-management tests and
the frontend production build. They prove local/offline behavior, not DATEV tenant
integration, authentication or acceptance.

Local verification on 2026-09-23: 26 backend tests passed (payroll preparation and
existing time capture), 10 frontend preparation tests passed, 12 existing
time-management tests passed, and the Vite production build passed. Existing
bundle-size, mixed-import and eruda-eval warnings remain. No authenticated browser
session or live DATEV tenant was tested.
