# CRYPTO LAB v79 — Dead-letter review and operational incident ledger

Build: `7930`

Verification date: 2026-08-04

This block strengthens operational recovery without changing or publishing the working root v78 application.

## Current signal-monitor baseline

`crypto-signal-monitor` is deployed as version 6 with bounded pagination:

- 250 live signals per page;
- maximum 40 pages / 10,000 live signals per invocation;
- Binance ticker requests batched by 40 symbols;
- database transition calls batched by 100 updates;
- fail-closed count and missing-price checks;
- durable notification outbox with uniqueness on `signal_id + event_type`.

At the final check in this block, the outbox contained:

- total events: 30;
- sent: 30;
- pending, processing, retry and dead: 0;
- unique signal/event pairs: 30;
- maximum attempts: 1;
- rows due for 180-day retention cleanup: 0.

No manual production signal or test Telegram message was created.

## Audited dead-letter requeue

The protected RPC `admin_requeue_crypto_signal_notification(uuid,text)` allows an administrator to return an event to `retry` only when its current state is `dead` or `retry`.

Controls:

- server-side administrator-role check;
- mandatory reason from 5 to 500 characters;
- row lock before transition;
- `sent`, `pending` and `processing` states are rejected;
- attempts reset to zero;
- the event becomes immediately eligible for the monitor;
- the button itself does not send Telegram;
- a high-severity administrative audit row records before/after state, reason and correlation ID;
- payloads and secrets are not exposed.

A rollback-only database test proved:

- a synthetic `dead` TP1 event changed to `retry`;
- attempts changed from 5 to 0;
- claim, sent, Telegram ID and prior error fields were cleared;
- the audit action was `signal_notification_requeue` with `delivery_triggered=false`;
- a `sent` event was rejected with SQLSTATE `22023`;
- a reason shorter than five characters was rejected with SQLSTATE `22023`.

The transaction was rolled back. No event was delivered and no test user or signal remained.

The v79 administration health panel exposes the requeue button only for `dead` and `retry` rows and requires the reason before calling the RPC.

## Operational incident ledger

Two protected RLS tables were added:

- `crypto_operational_http_requests` — tracks pg_net request IDs for monitored Edge calls;
- `crypto_operational_incidents` — stores deduplicated Edge and cron incidents.

Direct browser grants are revoked. The service role owns collection and reconciliation.

### Edge observations

The scheduled monitor and scanner jobs now record the actual pg_net request ID. Reconciliation treats an observation as failed when:

- no response exists after two minutes;
- the request timed out;
- a transport error occurred;
- the HTTP response was outside 2xx;
- the bounded response contains `success=false`.

The fingerprint is stable per source, so repeated failures update one incident and increase `occurrences` instead of creating unlimited duplicate rows. A later successful response resolves the incident automatically.

### Cron observations

The reconciler checks only the latest terminal cron state, `succeeded` or `failed`. Transient running states are ignored. A failed terminal execution opens or updates one incident for the job, and a later successful execution resolves it.

Tracked jobs:

- signal monitor every minute;
- market scanner every 15 minutes;
- daily maintenance;
- subscription lifecycle;
- billing-event retry;
- billing reconciliation.

A seventh cron job runs incident reconciliation every five minutes.

### Retention

- processed HTTP request tracking: 30 days;
- resolved incidents: 180 days;
- open incidents are not automatically deleted.

## Incident state-machine verification

A rollback-only synthetic pg_net test used three local response rows:

1. HTTP 503 opened an Edge incident;
2. HTTP 500 updated the same fingerprint and raised occurrences to 2;
3. HTTP 200 resolved the incident.

Final in-transaction state:

- status: `resolved`;
- occurrences: 2;
- last HTTP status: 200;
- error cleared;
- resolution note: `Recovered on successful Edge response`.

The transaction was rolled back, so no artificial incident remains.

## Protected administrative observability

A private-wrapper RPC returns only bounded incident metadata to an authenticated administrator:

- open and resolved counts;
- open Edge and cron counts;
- oldest-open age;
- source, severity and occurrence count;
- first and last seen timestamps;
- HTTP status;
- error and resolution text bounded to 240 characters.

It does not expose Edge payloads, tokens, secrets, request headers or raw response bodies.

Transactional authorization verification proved:

- an administrator received the bounded incident record;
- a normal user was denied with SQLSTATE `42501`;
- even an administrator could not directly select the RLS table from the browser role;
- the returned error text was limited to 240 characters;
- the transaction rolled back and test users did not remain.

The v79 admin panel now contains a read-only RU/UA/EN incident ledger. It is cached by the PWA shell and refreshes through the protected RPC.

## Current operational state

At the final production-state check:

- open incidents: 0;
- resolved incidents: 0;
- pending tracked HTTP observations: 0;
- all seven scheduled jobs were active;
- the latest execution of every scheduled job was successful;
- Security Advisor reported zero lints;
- no temporary Auth users remained.

Recent tracked request observations:

- `crypto-signal-monitor`: 7 healthy samples, 0 failures, average response-record latency 13.3 ms, p95 26.3 ms, maximum 32.0 ms;
- `crypto-market-scanner`: 1 healthy sample, 0 failures, observed response-record latency 1108.7 ms.

These measurements use pg_net request/response timestamps and are operational evidence, not a full external load test.

## Release evidence

Application asset commit: `c9ceb710bfa7ef6374c9c221f8a23c9d7eaa89fa`.

- dynamic release gate run `30906327415`: success;
- public `admin-incidents.js`: HTTP 200 and expected RPC marker present;
- public `commercial-extension.js`: HTTP 200 and incident-loader marker present;
- public `service-worker.js`: HTTP 200 with `admin-incidents.js` and cache `crypto-lab-v79-7930-incident1`;
- migration head Pages run `30906419476`: success.

The browser-smoke run for the application asset commit was still installing the pinned Chromium dependencies when this evidence was consolidated; its final conclusion must be recorded separately rather than assumed.

## Boundaries retained

This block did not:

- change the working root v78 application;
- open public registration or password recovery;
- send email;
- configure prices or merchant credentials;
- enable checkout, payment webhooks, recurring billing or refunds;
- resend a real dead-letter event, because no real `dead` or `retry` record existed.
