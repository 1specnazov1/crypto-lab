# CRYPTO LAB v79 — Operational SLO, capacity and retention verification

Build: `7930`

Verification date: 2026-08-04

## Scope

This block adds bounded service-level indicators, backpressure warnings, capacity visibility and consolidated retention controls for the existing operational incident and Telegram outbox architecture.

The working root v78 application was not modified.

## Bounded operational observations

Table `crypto_operational_observations` stores only operational metadata:

- source type and allow-listed source name;
- unique observation ID;
- observation timestamp;
- success/failure result;
- bounded duration in milliseconds;
- HTTP status code where applicable.

It does not store Edge response bodies, request headers, trading payloads, signal price levels, Telegram credentials, monitor secrets or service-role credentials.

Controls:

- unique `(source_type, source_name, observation_id)` prevents double counting;
- RLS is enabled;
- `anon` and `authenticated` have no direct table privileges;
- service-role-only policy is present;
- source/time and failure indexes support rolling diagnostics.

Existing tracked HTTP requests and terminal cron runs were backfilled into bounded observations. Future observations are written by the incident reconciler before their request mappings or cursor positions are advanced.

## SLO thresholds

Protected RPC: `get_crypto_admin_operational_slo()`.

The private implementation verifies the current Auth user has the `admin` role. The public function is a `SECURITY INVOKER` wrapper.

Configured warning thresholds:

| Source | Minimum 24h success | Maximum p95 | Maximum age | Minimum samples |
|---|---:|---:|---:|---:|
| Signal monitor Edge Function | 99% | 5,000 ms | 3 min | 30 |
| Market scanner Edge Function | 95% | 120,000 ms | 30 min | 3 |
| Incident reconciliation cron | 95% | 30,000 ms | 15 min | 6 |

A source is `warning` when it is stale, has a failure in the rolling hour, falls below its success threshold after sufficient samples, or exceeds its p95 threshold. It is `collecting` until the minimum sample size exists.

The rolling window intentionally preserves evidence of a recent recovered failure. At verification time:

- signal monitor: 40/40 successful, 100%, p95 32 ms, healthy;
- market scanner: 3/3 successful, 100%, p95 1,398 ms, healthy;
- incident reconciliation: 7/8 successful in the rolling window, p95 41 ms, warning because the initial rollout failure remains inside the one-hour/24-hour window;
- current open operational incidents: 0;
- the latest incident-reconciliation cron run is successful.

The historical warning clears automatically as the rolling window advances; it does not represent a currently open incident.

## Backpressure and capacity guards

The protected SLO response includes:

### Telegram outbox

Warning when:

- unsent rows reach 100; or
- the oldest `pending`, `processing`, `retry` or `dead` row exceeds five minutes.

Verification snapshot:

- total: 38;
- sent: 38;
- unsent: 0;
- duplicate `(signal_id, event_type)` pairs: 0.

### Operational HTTP request ledger

Warning when:

- pending observations reach 100; or
- the oldest pending request exceeds ten minutes.

A rollback-only test inserted one eleven-minute pending request and confirmed `warning = true`. No test request remained afterward.

Normal pending rows may exist briefly because reconciliation runs every five minutes. At the final snapshot there were three recent pending mappings and no open incident.

### Signal monitor capacity

- hard bounded monitor capacity: 10,000 live signals;
- warning threshold: 8,000 live signals, or 80% usage;
- verified live count during the block: approximately 66;
- usage: below 1%.

### Cron cursor lag

For all seven tracked cron jobs, the admin response reports:

- durable cursor run ID;
- latest terminal run ID;
- count of unprocessed terminal runs;
- age of the oldest unprocessed terminal run;
- warning when lag exceeds two runs or fifteen minutes.

This preserves visibility without exposing cron commands or Vault secrets.

## Retention policy

Consolidated maintenance rules:

- processed operational request mappings: 30 days;
- bounded operational observations: 90 days;
- resolved operational incidents: 180 days;
- sent/dead Telegram outbox rows: 180 days;
- open incidents: never deleted by retention;
- active tracked cron cursors: never deleted;
- inactive cursor records: deleted only when older than 30 days and not part of the seven-source allow-list.

A rollback-only maintenance test confirmed:

- old unlinked processed request deleted;
- processed request referenced by an open incident preserved;
- 91-day observation deleted;
- 181-day resolved incident deleted;
- old open incident preserved;
- stale inactive cursor deleted;
- stale active tracked cursor preserved;
- maintenance returned `open_incidents_deleted = 0` and `active_cursors_deleted = 0`.

The test maintenance row and all synthetic data were rolled back.

## Administrative dashboard

File `v79/admin-slo.js` adds a protected RU/UA/EN section to the existing admin dashboard.

It displays:

- rolling 24-hour and one-hour success rates;
- p95 latency;
- sample count and observation age;
- explicit thresholds and source state;
- outbox and request-ledger backpressure;
- live-signal capacity usage;
- cursor lag for all tracked cron jobs;
- retention periods and the rolling-window warning note.

The script is injected only in the admin module through `commercial-extension.js` and is cached by service-worker cache `crypto-lab-v79-7930-slo1`.

## Access verification

Rollback-only Auth test confirmed:

- admin RPC access succeeds;
- ordinary authenticated user receives SQLSTATE `42501` / `Admin access required`;
- direct browser-role SELECT of `crypto_operational_observations` is denied;
- no temporary Auth user remains.

Current database security inventory after the block:

- CRYPTO LAB public tables: 38;
- CRYPTO LAB public tables with RLS: 38;
- browser-executable public `SECURITY DEFINER` functions: 0;
- Supabase Security Advisor lints: 0.

Performance Advisor reports only informational unused-index notices for new or low-traffic tables. No index was removed based solely on an early unused-index notice.

## Release verification

Application asset commit: `87a5502afe40c29f65a7c4ef4dc070a1287f533d`.

Successful workflows:

- dynamic release gate: `30909225617`;
- Chromium browser/PWA smoke: `30909224674`;
- GitHub Pages deployment: `30909223458`.

Public asset verification:

- `v79/admin-slo.js`: HTTP 200 and protected RPC marker present;
- `v79/commercial-extension.js`: HTTP 200 and SLO loader marker present;
- `v79/service-worker.js`: HTTP 200 and cache marker `crypto-lab-v79-7930-slo1` present.

The browser smoke is automated Chromium validation, not a physical iPhone/Android review.

## Boundaries retained

This block did not:

- create a manual production signal;
- send a test Telegram message or email;
- create an external test user;
- enable public registration or password recovery;
- assign BASIC or PRO prices;
- enable payment providers, checkout, billing webhooks, recurring billing or refunds;
- publish v79 over v78.

Root v78 SHA remains `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
