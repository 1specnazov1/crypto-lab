# CRYPTO LAB v79 — Operational HTTP reconciliation verification

Build: `7930`

Verification date: 2026-08-04

## Scope

This block hardens the existing operational HTTP request ledger and incident reconciler without changing the working v78 application and without publishing v79 over v78.

Database migration:

- `supabase/migrations/202608041324_harden_operational_http_reconciliation.sql`
- migration commit: `19378f9d439b4081e557eabda7a3d2290d5ccf94`

The application/PWA commit remains `2ff16864e73740a1618b386cdaef6b8f9ec122e7`.

## Defects corrected

### Error classification priority

The prior reconciler checked `status_code is null` before the pg_net timeout and transport flags. A timeout or transport failure with no status code could therefore be recorded as generic `no_response`.

The corrected priority is:

1. `timeout`;
2. `transport`;
3. `no_response`;
4. `http_status`;
5. `application_failure`;
6. `none`.

Only the bounded class and bounded incident message are stored. Transport details, headers, request bodies, secrets and raw response payloads are not copied into the operational ledger.

### Application failure detection

The previous check recognized only an exact compact substring equivalent to `"success":false`.

The new private parser:

- parses valid JSON when possible;
- recognizes boolean `false` and string `"false"` at the top-level `success` field;
- accepts JSON whitespace;
- uses a bounded regular-expression fallback for non-JSON text;
- does not persist the inspected content.

Verified parser cases:

- `{"success":false}` -> failure;
- `{"success": false}` -> failure;
- `{"success":"false"}` -> failure;
- `{"success":true}` -> success;
- non-JSON text containing a spaced `success: false` marker -> failure.

## Stale pending recovery

A missing terminal pg_net response is classified only after a source-specific grace period:

- signal monitor: 2 minutes;
- market scanner: 3 minutes, exceeding its 120-second HTTP timeout.

For a truly missing response, duration is bounded to the configured grace period instead of depending on the later five-minute reconciliation schedule.

Rows initially classified as `no_response` are rechecked for 24 hours. If a terminal response appears later:

- the existing request row is corrected in place;
- `corrected_at` and `correction_count` are updated;
- the unique SLO observation is updated by the existing trigger;
- an incident is resolved only when the corrected request is still the incident's latest observation;
- an older late success cannot hide a newer failure.

## Race and idempotency controls

The reconciler now takes a transaction-scoped advisory lock. This prevents overlapping manual and cron reconciliation cycles from processing the same batch concurrently.

Eligible request rows additionally use `FOR UPDATE SKIP LOCKED` and conditional updates.

Operational request tracking remains idempotent for the same `(request_id, source_name)` pair. Reusing an existing request ID for a different source now raises SQLSTATE `23514` instead of being silently ignored.

The existing dispatchers retain their source-specific advisory locks and hard capacity guards.

## Rollback-only verification

Synthetic rows used negative request IDs and were rolled back by an expected `P0001` exception. No synthetic row remained.

Verified results:

- timeout with null status -> `timeout`;
- transport error with null status -> `transport`;
- HTTP 200 with spaced `{"success": false}` -> `application_failure`;
- duplicate tracking for the same source -> one row;
- request ID reuse for a different source -> rejected;
- late HTTP 200 correction -> `error_class=none`, `success=true`, `correction_count=1`;
- isolated late correction resolved the matching open incident with the note `Late HTTP response corrected prior no-response classification`;
- a late success did not close a newer failure for the same source.

## Natural operational state after deployment

After a normal reconciliation cycle:

- live `WAITING`/`ACTIVE` signals: 68;
- Telegram outbox: 48 total, 48 sent, 0 unsent;
- unique `(signal_id, event_type)` pairs: 48;
- maximum outbox attempts: 1;
- pending operational HTTP mappings: 0;
- failed operational HTTP mappings: 0;
- open operational incidents: 0;
- persistent test users: 0;
- synthetic request rows: 0.

Current rolling SLO state:

- signal monitor: healthy, 100% success, p95 approximately 32 ms;
- market scanner: healthy, 100% success, p95 approximately 1.3 seconds;
- incident reconciliation: healthy, 95.45% rolling 24-hour success, p95 approximately 43 ms, no failure in the last hour.

The earlier historical reconciliation warning cleared naturally; no historical observation was deleted or hidden to force the state change.

## Log review

Recent Edge Function samples for the signal monitor, market scanner, signal register, Telegram sender and v79 preview returned HTTP 200.

Recent cron entries show successful completion of the monitor dispatcher and incident reconciliation cycles.

Postgres logs contained an expected `Admin access required` denial from a protected-RPC verification. A transient ad-hoc SQL reference to nonexistent `public.crypto_signals` was also observed; a stored-function scan found zero production function references to that table.

Auth logs contained no new registration or recovery activity in this block. Historical test-user mail activity predates this block, and the final persistent test-user count is zero.

## Security and release boundaries

- Supabase Security Advisor lints after the migration: 0.
- No real signal was manually created.
- No test Telegram message was sent.
- No test email was sent.
- Registration and recovery remain disabled.
- Prices, checkout, payment providers, webhooks, recurring billing and refunds remain disabled.
- Root v78 remains unchanged at SHA `4a278c891d37b3760ec1ac988690ea9ad587b24e`.

GitHub Pages run for the migration commit: `30914044658`, success.

Because the application/PWA assets did not change, the existing successful v79 release gate `30910333181` and Chromium browser/PWA smoke `30910332364` remain the applicable application evidence. Physical-device review is still an external release blocker.
