# CRYPTO LAB v79 — Cron incident cursor hardening

Build: `7930`

Verification date: 2026-08-04

## Defect removed

The first operational incident reconciler inspected only the latest terminal run for each cron job every five minutes. A one-minute job could therefore fail and recover before reconciliation, causing the failed run to be skipped.

## Durable cursor design

`crypto_operational_cursors` now stores one monotonic `runid` cursor for every tracked cron source.

The reconciler now:

- reads every unprocessed terminal `succeeded` or `failed` cron run;
- processes observations in ascending `runid` order;
- handles up to 2,000 new cron observations per reconciliation;
- advances each cursor monotonically with `greatest()`;
- tracks the incident reconciliation job's own previous terminal runs;
- preserves one stable incident fingerprint per source;
- increments `occurrences` for each distinct failure;
- resolves an open incident only after a later successful observation;
- ignores repeated processing of the same observation.

The cursor table uses RLS, has no browser privileges, and has a service-role-only policy.

## Transactional rollback verification

A synthetic sequence was executed inside a rollback-only PL/pgSQL subtransaction:

1. failed run `900000000001` opened an incident;
2. failed run `900000000002` reused the same fingerprint and increased `occurrences` to 2;
3. successful run `900000000003` resolved the incident;
4. the cursor advanced through all three run IDs.

Verification result:

- `captured_first_failure = true`;
- `deduplicated_second_failure = true`;
- `resolved_after_success = true`;
- `occurrences = 2`;
- recovery note: `Recovered on successful cron execution`;
- cursor restored after rollback: `true`;
- synthetic cron runs remaining: `0`;
- synthetic incidents remaining: `0`.

## Administrative surface consolidation

The existing protected RPC `get_crypto_admin_operational_incidents()` remains the single browser-facing incident diagnostic surface used by `v79/admin-incidents.js`.

A temporary duplicate diagnostic RPC introduced during hardening was removed. The retained RPC:

- requires `crypto_is_admin()`;
- uses the private `SECURITY DEFINER` plus public `SECURITY INVOKER` model;
- returns bounded incident metadata only;
- never returns Edge response bodies, headers, secrets, credentials or notification payloads.

## Natural verification

After hardening:

- all seven CRYPTO LAB cron jobs reported successful latest terminal runs;
- the reconciliation function processed new HTTP and cron observations successfully;
- open incidents remained `0`;
- monitor v6 continued returning HTTP 200;
- recent monitor cycles reported `source_count = fetched = checked` and `missing = 0`;
- a natural event at 11:49 UTC was queued, claimed and sent successfully;
- outbox reached 31 `sent` records;
- maximum attempts remained 1;
- pending, processing, retry and dead remained 0;
- duplicate signal-event pairs remained 0.

No manual trading signal, test Telegram message, email or external test user was created. Working v78 was not modified.
