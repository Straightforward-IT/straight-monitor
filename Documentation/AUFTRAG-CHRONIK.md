# Auftrag-Chronik

The Chronik records successful changes made through the order routes by all authenticated app users. Reading the timeline and managing manual notes is restricted to Admins during rollout. Recording starts when deployed; existing records have no invented history.

## Capture boundary

`api/services/operations/AuftragChronikService.js` wraps the mutation handlers in `api/routes/events/auftraegeRoutes.js`. It snapshots meaningful fields from `Auftrag`, `Schicht`, and `Einsatz` before and after the handler, then persists one `AuftragChronikEntry` containing the actual differences. A propagated shift edit or cascading deletion produces one event with all affected records.

| Route, relative to `/api/auftraege` | Event |
| --- | --- |
| `POST /`, `PATCH /:auftragNr`, `DELETE /:auftragNr` | Order creation, editing, and pseudo-order deletion |
| `POST /:auftragNr/release` | Release |
| `POST /:auftragNr/labels`, `DELETE /:auftragNr/labels/:labelId` | Labels |
| `POST /:auftragNr/schichten`, `PATCH /:auftragNr/schichten/:schichtId`, `DELETE /:auftragNr/schichten/:schichtId` | Shifts and propagated assignment changes |
| `PUT /:auftragNr/planning` | Batch staffing, removals, and conflict overrides |
| `POST /:auftragNr/einsaetze`, `PATCH /:auftragNr/einsaetze/:einsatzId`, `DELETE /:auftragNr/einsaetze/:einsatzId` | Assignments, employee replacement, times, and Stundenliste inclusion |
| `POST /:auftragNr/pseudo-einsatz`, `DELETE /:auftragNr/pseudo-einsatz/:einsatzId` | Pseudo assignments |

Imported orders edited through these routes are included. Imports, background synchronization, employee master-data changes, file storage operations, and one-time maintenance repairs are outside this capture boundary. No model-wide hooks are installed. Technical-only updates and unchanged saves produce no event. Existing `stundenlisteChangeLog` writes and the Stundenliste status reader remain in place.

Actor names, employee names (including historical personal-number matches), order titles, record labels, and displayed field values are saved as snapshots. Structured before/after values retain their original meaning; dates use ISO values, and booleans remain booleans. Subdocument IDs and confirmation/render timestamps are excluded from equality comparisons.

## Consistency and deployment

Business changes and the automatic event commit in the same MongoDB transaction. Rejected requests, failed audit writes, and partial cascades roll back; the HTTP response is sent after commit. Concurrent conflicting edits are retried by the transaction driver, so each committed event describes its own actor's changes.

This requires a replica set or a transaction-capable sharded cluster. A standalone MongoDB server is insufficient. Mongoose transaction AsyncLocalStorage propagates the session to nested queries; `resolveQueries` serializes grouped queries inside a transaction and retains parallel reads outside it. Keep email, uploads, and other non-transactional external effects outside wrapped handlers.

Entries store the stable `auftragId` and the order number. Deleting a pseudo-order preserves its audit records. The endpoints require a currently existing order; retained records for deleted orders are available for administrative database review. Reusing an order number does not expose the deleted order's history.

## Admin endpoints

Every endpoint runs authentication and reloads the current database user through `requireAuftragChronikAdmin`. A case-normalized `role` or member of `roles` must equal `ADMIN`. Missing authentication returns 401, other roles return 403, and role revocation applies on the next request. The order must have a location; as in the existing order routes, Admins may access all locations. This isolated authorization middleware can be widened later without changing capture.

| Endpoint | Contract |
| --- | --- |
| `GET /api/auftraege/:auftragNr/chronik?cursor=&limit=` | `{ entries, nextCursor }`, newest first by `createdAt` and `_id`. Omit `cursor` for the first page. Default limit 30, allowed range 1–100. |
| `POST /api/auftraege/:auftragNr/chronik/notes` | `{ text }`, trimmed, 1–5000 characters. Actor and kind come from the server. Returns the created note. |
| `DELETE /api/auftraege/:auftragNr/chronik/:entryId` | Only the requesting Admin's own note, scoped to this order. Automatic events and other authors' notes return 403. |

Chronik data is stored in a separate collection and is not populated into ordinary order responses. Notes render as plain text. The frontend gates both the toggle and timeline; non-Admins send no Chronik requests.

## Frontend and verification

`OrderChronikDrawer` reuses `CompanionDrawerFrame`; its size and collapse state use `orders_chronik_drawer`. On mobile and at widths up to 1100px, `OrderChronikTimeline` renders inside the order-detail panel. Each automatic event expands into entity changes and before/after fields. The timeline supports notes, own-note deletion, refresh, and older-page loading.

Successful order mutations notify the selected order through `utils/auftragChanges.js`, including editor saves and shift/assignment removals. Chronik note requests do not recursively trigger that notification. Order switches, later refreshes, role changes, and unmounts invalidate previous reads.

Run from `api`:

```sh
npx mocha tests/auftragChronik.test.js --exit
```

The integration suite uses its own local `mongodb-memory-server` replica set and synthetic users/orders. It never uses `MONGO_URI`; the first run downloads a MongoDB test binary. Coverage includes route mutations, cascades, snapshots, no-ops, rejection/audit-failure rollback, concurrent attribution, pagination, live Admin authorization, and legacy Stundenliste logs.

Run from `frontend/Straight-Monitor`:

```sh
npm run test:chronik
npm run build
```

Frontend tests cover mutation notifications, Admin gating and revocation, snapshots, pagination, stale responses, plain-text notes, own-note controls, deletion races, and cancellation on unmount.
