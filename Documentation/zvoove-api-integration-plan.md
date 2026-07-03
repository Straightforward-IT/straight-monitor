# Plan: Zvoove REST API Integration (phased Excel-import replacement)

_Created: 2026-07-02_

## Context / Decisions

- **Goal**: Replace Excel imports with automated live API sync (end goal), but roll out **hybrid: live proxy first, persistence later**.
- **Domains** (all phases): Employees v3, Assignments v1, Absences v3, Timesheets/Timebookings, Candidates v2, Companies v2.
- **Auth**: Reference Key (bearer) — `ZVOOVE_API_KEY` already in `api/.env`. Tenant embedded in key; `X-MANDANT-ID` optional.
- **Stack**: stay with **axios** (whole codebase uses it). undici NOT needed.
- **Installation**: On-prem.

---

## Current State Findings

- `zvooveRoutes.js` is registered at `/api/zvoove` (`app.js:101`) but **the frontend never calls it** → dead scaffolding.
- `ZvooveService.js`: `BASE_URL` hardcodes `/v3` → blocks v1/v2 endpoints. Only exports `getEmployees`. Bearer auth + optional `X-MANDANT-ID`.
- `ZVOOVE_API_KEY` present in `api/.env` (reference key). `ZVOOVE_MANDANT_ID` not set.
- API spec: `Documentation/zvoove-api.yaml` (131 paths). Auth schemes: `reference_key` (bearer JWT) + OAuth2 clientCredentials (`sso.zvoove.cloud/connect/token`). Rate limit: **300 req/60s per customer**, returns `429` + `Retry-After`.

---

## Excel-list → API → Model Mapping

| Excel list | MongoDB model(s) | Zvoove API endpoints | Incremental sync | Notes |
|---|---|---|---|---|
| 7002 Personal | Mitarbeiter, Beruf, Qualifikation | `v3/employees` (paged) → `v1/employees/{id}` detail + `/wage`; refs `v1/partner/professions`, `/qualifications` | `v1/employees/changelog` | ✅ Full coverage |
| 7001 Einsatz Komplett | Auftrag, Kunde, Schicht, Einsatz | `v1/orders` (Auftrag), `v1/orders/{id}/positions` (Schicht), `v1/assignments` (Einsatz; From/To/OrderId/EmployeeId), `v2/companies` (Kunde) | `v1/companies/changelog` | ✅ Denormalized Excel → 4 endpoints |
| 7003 Verfügbarkeiten | ZvooveVerfuegbarkeit | ⚠️ **No availability endpoint.** Closest: `v3/employees/{id}/hourly-absences`, `/full-day-absences`, `/pending-absences` (inverse semantics) | — | **GAP**: keep Excel, or derive from absences |
| 6001 Rechnungen | Rechnung | `v3/invoices/list` + `v3/invoices/{id}` (or `v4/invoices/*`) | date filters (`FromInvoiceDate`, `ModifiedFrom`) | ⚠️ v1 invoices = SaaS-only; verify OnPrem for v3/v4 |
| 3201 Personalnr-Historien | Mitarbeiter.personalnrHistory | `v1/employees/changelog` (partial) | yes | **GAP**: semantics uncertain → keep Excel |

**Zvoove domain → MongoDB model** mapping:
`Order` = Auftrag · `Position` = Schicht (ID_AUFTRAG_ARBEITSSCHICHTEN) · `Assignment` = Einsatz · `Company` = Kunde · `Employee` = Mitarbeiter · `Candidate` = Bewerber

---

## Reference Patterns to Reuse

- **`logImport()`** helper in `dataImportRoutes.js:33` + `ImportLog` model + `/api/import/last-uploads` aggregation. Live syncs write `ImportLog` (types: `personal`, `einsatz-komplett`, `verfuegbarkeit`, `rechnung`) with `details.source = 'api'`.
- **Mapping logic** in `dataImportRoutes.js`: persgruppe enum `[101, 110, 109, 106]`, berufKey/qualiKey → ObjectId maps, email lowercase, date parsing, `personalnrHistory`, `IST_PSEUDO` unfilled-shift handling, Auftrag/Kunde/Schicht/Einsatz `bulkWrite` upserts.
- **`serverRoutines.js`** pattern: cron + `allow(key)` feature-gate + `guard()` CRON_PAUSED wrapper.
- **Mitarbeiter** primary key = `personalnr` (unique, sparse) + `personalnummern[]`; refs `berufe`/`qualifikationen` as ObjectId arrays.

---

## Phases

### Phase 0 — Foundation & Live Proxy *(start here)*

- Refactor `ZvooveService.js`: change `BASE_URL` to `.../temp-staffing-de` (no version suffix); pass version per call path. Add axios interceptors: log via `utils/logger`, handle `429` by reading `Retry-After` + exponential backoff, global timeout. Add generic `fetchAllPages(path, params)` paginator (`PageNumber` / `PageSize`).
- `.env`: `ZVOOVE_BASE_URL` (default `https://api.zvoove.cloud`), `ZVOOVE_API_KEY`, optional `ZVOOVE_MANDANT_ID`.
- `zvooveRoutes.js`: add `GET /health` (auth test — calls any cheap endpoint), fix `GET /employees` (v3), `GET /employees/:id`. Wrap all in `asyncHandler` + `auth` middleware.
- **Security**: confirm `api/.env` and `api/.env.save` are in `.gitignore`. Key is currently visible in these files — rotate if the repo has been shared.

### Phase 1 — Reference Data Sync

- `syncProfessions()` → `Beruf` (`v1/partner/professions`)
- `syncQualifications()` → `Qualifikation` (`v1/partner/qualifications`)

These are a prerequisite for Phase 2 (employee `berufe`/`qualifikationen` ObjectId refs).

### Phase 2 — Employees Sync *(replaces 7002 Personal)*

- `syncEmployees()`: paginate `v3/employees`; optionally enrich via `v1/employees/{id}` for detail fields; `bulkWrite` upsert keyed by `personalnr`. Reuse all Excel mapping logic. Write `ImportLog` type `'personal'`. Incremental mode via `v1/employees/changelog` (last seen ID/timestamp stored in `ImportLog.details`).

### Phase 3 — Orders / Companies / Assignments *(replaces 7001 Einsatz Komplett)*

- `syncCompanies()` → `Kunde` (`v2/companies`)
- `syncOrders()` → `Auftrag` + `Schicht` (`v1/orders` + `v1/orders/{id}/positions`)
- `syncAssignments()` → `Einsatz` (`v1/assignments` with `From`/`To` window). Reuse `IST_PSEUDO` unfilled-shift logic.
- Write `ImportLog` type `'einsatz-komplett'`.

### Phase 4 — Invoices *(replaces 6001)* — verify OnPrem support first

- `syncInvoices()` → `Rechnung` (`v3` or `v4` `invoices/list` + detail). Must confirm which version works on-prem before building. Write `ImportLog` type `'rechnung'`.

### Phase 5 — Scheduling & Excel Retirement

- Register cron routines in `serverRoutines.js` behind `allow('zvoove-sync')` + `guard()`. Suggested schedule: employees/reference data nightly, assignments rolling 30-day window daily.
- Keep Excel importer as **manual fallback** (don't remove it — useful for re-import after rollback).
- Add `ZVOOVE_SYNC=true` feature flag to `.env`.

---

## Open Gaps / Decisions Required

| Gap | Options |
|---|---|
| **7003 Verfügbarkeiten** — no API endpoint | A) Keep Excel import permanently · B) Derive from absence endpoints (different semantics) · C) Request dedicated endpoint from Zvoove |
| **3201 Personalnr-Historien** — changelog semantics unclear | Keep Excel or consume `v1/employees/changelog` delta |
| **Invoices on-prem** — v1 is SaaS-only | Test v3/v4 against on-prem install; escalate to Zvoove support if needed |

---

## Files

| File | Action |
|---|---|
| `api/ZvooveService.js` | Refactor + add all `sync*()` functions |
| `api/routes/zvooveRoutes.js` | Add health, employees, manual sync trigger routes |
| `api/serverRoutines.js` | Register cron jobs |
| `api/routes/dataImportRoutes.js` | Source of mapping/upsert logic to extract and reuse |
| `api/models/ImportLog.js` | Reuse as-is |
| `api/models/` Mitarbeiter, Auftrag, Kunde, Einsatz, Schicht, Beruf, Qualifikation, Rechnung | Reuse as-is (no schema changes expected) |
| `api/.env` + `api/.env.example` | Add `ZVOOVE_BASE_URL`, `ZVOOVE_MANDANT_ID`, `ZVOOVE_SYNC` |
| `README.md` | Document sync commands and env vars |
