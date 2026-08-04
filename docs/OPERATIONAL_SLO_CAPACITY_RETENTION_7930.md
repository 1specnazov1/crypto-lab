# CRYPTO LAB v79 — Operational SLO, capacity and retention verification

Build: `7930`

Verification date: 2026-08-04

## Scope

This block adds bounded SLO metrics, explicit warning thresholds, real backpressure guards, capacity visibility and consolidated retention controls for the operational incident ledger and Telegram notification outbox.

The working root v78 application was not modified.

## Bounded operational observations

Table `crypto_operational_observations` stores only operational metadata:

- allow-listed source type and source name;
- unique observation ID;
- observation timestamp;
- success/failure result;
- duration in milliseconds;
- HTTP status code where applicable.

It does not store Edge response bodies, request headers, signal payloads, trade levels, Telegram credentials, monitor secrets or service-role credentials.

Controls:

- unique `(source_type, source_name, observation_id)` prevents double counting;
- RLS is enabled;
- browser roles have no direct table privileges;
- a service-role-only policy is present;
- source/time and failure indexes support rolling diagnostics;
- observations are retained for 90 days.

## Concurrent migration defect removed

Two autonomous migrations initially modified the incident reconciler in parallel. One version wrote SLO observations, while the later capacity-guard version replaced that function and unintentionally stopped new observations from being recorded.

The final design removes that coupling:

- completed tracked Edge requests are captured by `crypto_operational_edge_observation_capture`;
- advanced cron cursors are captured by `crypto_operational_cron_observation_capture`;
- both triggers upsert by the unique observation key;
- existing 90-day Edge and cron history was backfilled;
- the duplicate private SLO snapshot embedded in the incident RPC was removed.

SLO collection therefore no longer depends on which reconciler implementation was deployed last. After consolidation, fresh monitor, scanner and reconciliation observations continued to arrive naturally.

Versioned migration: `supabase/migrations/202608041232_consolidate_operational_slo_capture.sql`.

## SLO thresholds

Protected RPC: `get_crypto_admin_operational_slo()`.

The private implementation verifies that the current Auth user has the `admin` role. The public function is a `SECURITY INVOKER` wrapper.

| Source | Minimum success | Maximum p95 | Maximum observation age | Minimum 24h samples |
|---|---:|---:|---:|---:|
| Signal monitor Edge Function | 99% | 5,000 ms | 3 min | 30 |
| Market scanner Edge Function | 95% | 120,000 ms | 30 min | 3 |
| Incident reconciliation cron | 95% | 30,000 ms | 15 min | 6 |

The response includes rolling one-hour and 24-hour success, 24-hour p95/average/maximum latency, sample count, last-observation age and the active thresholds.

A source is `warning` when it is stale, has a failure in the rolling hour, falls below its success threshold after enough samples, or exceeds its p95 threshold. It is `collecting` until its minimum sample count exists.

Final sampled state:

- signal monitor: 61 observations, 100% success, p95 32 ms;
- market scanner: 4 observations, 100% success, p95 approximately 1,382 ms;
- incident reconciliation: 12 observations, 91.67% rolling success, p95 approximately 41 ms;
- open incidents: 0;
- latest terminal run of every tracked cron job: `succeeded`.

The reconciliation warning is rolling historical evidence from the initial rollout defect. Current reconciliation is successful and has no open incident. The warning clears automatically as the rolling window advances.

## Backpressure and capacity

### Warning thresholds

The admin SLO response warns when:

- outbox unsent rows reach 100 or the oldest unsent row exceeds five minutes;
- operational request mappings pending reconciliation reach 100 or the oldest exceeds ten minutes;
- live monitored signals reach 8,000 of the 10,000 hard monitor capacity;
- a cron cursor is more than two terminal runs or fifteen minutes behind.

### Hard guards

Warnings are supplemented by fail-closed server controls:

- outbox insertion is blocked at 5,000 unsent rows or 500,000 retained rows;
- monitor dispatch is skipped at 300 pending monitor requests;
- scanner dispatch is skipped at 50 pending scanner requests;
- all Edge dispatch is skipped at 500 pending operational requests or 100,000 retained request mappings;
- a skipped dispatch creates or updates a critical deduplicated capacity incident;
- no external HTTP request is made when a guard rejects dispatch.

A rollback-only test inserted 300 synthetic pending monitor mappings. The dispatcher returned:

- `skipped = true`;
- `reason = capacity_guard`;
- `source_pending = 301`;
- critical capacity incident created inside the transaction;
- external request dispatched: false.

All synthetic rows and the incident were rolled back.

## Retention policy

Consolidated maintenance rules:

- processed operational request mappings: 30 days;
- request mappings referenced by open Edge incidents: preserved;
- bounded operational observations: 90 days;
- resolved operational incidents: 180 days;
- open operational incidents: never deleted by retention;
- sent/dead Telegram outbox rows: 180 days;
- all seven active cron cursors: never deleted;
- inactive cursor rows: deleted only after 30 days.

A rollback-only maintenance test confirmed:

- an old unreferenced processed request was deleted;
- an old processed request referenced by an open incident was preserved;
- a 91-day observation was deleted;
- a 181-day resolved incident was deleted;
- an old open incident was preserved;
- an inactive stale cursor was deleted;
- the active signal-monitor cursor was preserved;
- maintenance completed successfully.

The test maintenance row and all synthetic records were rolled back.

## Access verification

Rollback-only Auth verification confirmed:

- an administrator can read the protected SLO response;
- an ordinary authenticated user receives SQLSTATE `42501` / `Admin access required`;
- `authenticated` has no direct SELECT privilege on `crypto_operational_observations`;
- temporary Auth users remaining after rollback: 0.

## Administrative dashboard

`v79/admin-slo.js` adds an RU/UA/EN read-only SLO section to the existing administration dashboard.

It shows:

- rolling success and p95 latency;
- sample count and data age;
- thresholds and healthy/warning/collecting state;
- outbox and request-ledger pressure;
- monitor capacity usage;
- lag for all seven cron cursors;
- retention periods and the rolling-window explanation.

Final UI corrections:

- fixed the HTML quote escape entity;
- localized `Status` and `Total` for RU, UA and EN;
- removed an unused formatter;
- refreshed the PWA cache to `crypto-lab-v79-7930-slo2`.

The script is injected only in the admin module through `commercial-extension.js`.

## Operational log review

Edge Function logs show current monitor v6 and scanner v11 executions returning HTTP 200. Postgres logs show the current seven cron jobs completing successfully. No current production defect was found in Auth logs.

Auth logs contain platform deprecation warnings for legacy GoTrue group environment variables. These are managed platform configuration notices, not an application-code defect, so no unsafe application change was made.

Performance Advisor reports informational unused-index notices, including recently created or low-traffic indexes. No index was removed solely because an early usage counter remained zero.

Supabase Security Advisor after the final DDL changes: 0 lints.

## Final natural state

At the final database snapshot:

- live WAITING/ACTIVE signals: 66;
- Telegram outbox: 40 total, 40 sent, 0 unsent;
- unique `(signal_id, event_type)` pairs: 40;
- maximum delivery attempts: 1;
- operational request mappings: 69 total;
- open incidents: 0;
- bounded SLO observations: 424;
- after reconciliation, cursor backlog was reduced to one newly completed signal-monitor run of age approximately zero minutes;
- persistent rollback/test users: 0;
- duplicate private SLO snapshot function: absent.

No manual production signal, test Telegram delivery, external test email or public registration was created during this block.

## Release verification

Final application/PWA commit: `2ff16864e73740a1618b386cdaef6b8f9ec122e7`.

Successful workflows:

- v79 validation/release gate: `30910333181`;
- Chromium browser/PWA smoke: `30910332364`;
- GitHub Pages deployment: `30910331223`.

Published assets:

- `v79/admin-slo.js`: HTTP 200, protected RPC and localized marker checks passed;
- `v79/service-worker.js`: HTTP 200, cache marker `crypto-lab-v79-7930-slo2` present;
- `v79/commercial-extension.js`: HTTP 200, SLO loader marker present.

Root v78 SHA remains `4a278c891d37b3760ec1ac988690ea9ad587b24e`.

Automated Chromium validation does not replace the remaining physical iPhone/Android release review.

## Boundaries retained

This block did not:

- publish v79 over v78;
- enable public registration or recovery;
- assign paid prices;
- enable LiqPay, Stripe, checkout, billing webhooks, recurring billing or refunds;
- configure mail delivery or Turnstile;
- assign the permanent production administrator;
- claim managed backup/PITR or physical-device approval without external confirmation.