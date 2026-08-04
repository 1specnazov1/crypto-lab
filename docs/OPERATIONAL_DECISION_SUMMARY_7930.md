# CRYPTO LAB v79 — Operational GO / WATCH / NO-GO summary

Build: `7930`

Verification date: 2026-08-04

## Scope

This block adds a protected operational decision layer above the existing SLO, incident, cron, outbox, maintenance and release-readiness controls.

It does not change or publish the working root v78 application.

## Protected RPC

Functions:

- `private.get_crypto_admin_operational_summary()` — `SECURITY DEFINER`, fixed search path, mandatory `crypto_is_admin()` role check;
- `public.get_crypto_admin_operational_summary()` — browser-compatible `SECURITY INVOKER` wrapper.

`anon` has no execute permission. An authenticated non-admin user receives SQLSTATE `42501` / `Admin access required`.

The response is bounded operational metadata only. It does not expose:

- Edge request or response payloads;
- HTTP authorization headers;
- service-role credentials;
- `MONITOR_SECRET`;
- Telegram bot token or chat ID;
- signal price levels;
- registration, recovery or payment secrets.

External notifications are explicitly disabled. The summary is read-only and does not send email, Telegram, push or webhook alerts.

## Decision states

The computed decision is:

- `TECHNICAL_GO` when every technical control is healthy;
- `WATCH` when a warning or data-collection state exists but no critical condition exists;
- `NO_GO` when at least one critical technical control exists.

The summary returns:

- overall state and decision;
- healthy, warning, collecting and critical counts;
- all technical indicators;
- active technical alerts only;
- responsible contour and runbook code;
- latest protected release checkpoint;
- external commercial/release blockers;
- five-minute review interval.

## Indicators

The summary evaluates ten independent controls:

1. signal-monitor rolling SLO;
2. market-scanner rolling SLO;
3. incident-reconciliation rolling SLO;
4. open operational incidents;
5. Telegram notification outbox;
6. tracked HTTP request backlog;
7. durable cron cursor lag;
8. latest terminal status of all seven tracked cron jobs;
9. maintenance freshness;
10. database security boundary.

### Source SLO rules

Signal monitor:

- minimum 24-hour success: 99%;
- p95 warning threshold: 5,000 ms;
- freshness warning: 3 minutes;
- critical freshness: 10 minutes;
- minimum sample size: 30.

Market scanner:

- minimum success: 95%;
- p95 warning threshold: 120,000 ms;
- freshness warning: 30 minutes;
- critical freshness: 60 minutes;
- minimum sample size: 3.

Incident reconciliation:

- minimum success: 95%;
- p95 warning threshold: 30,000 ms;
- freshness warning: 15 minutes;
- critical freshness: 30 minutes;
- minimum sample size: 6.

Edge freshness uses the latest tracked dispatch timestamp rather than only the most recently reconciled observation. This avoids false warnings during the normal five-minute reconciliation interval.

### Backpressure rules

Telegram outbox:

- warning when unsent records exist, reach 100, or exceed five minutes;
- critical for dead records, 500 unsent records, or age above fifteen minutes.

Operational HTTP backlog:

- warning at 100 pending or ten minutes;
- critical at 500 pending or thirty minutes.

Cron cursor lag:

- warning above ten terminal runs or fifteen minutes;
- critical above thirty terminal runs or thirty minutes.

The cursor thresholds intentionally allow the normal five-minute reconciliation cycle to accumulate several one-minute monitor runs without a false alert.

## Defects found during verification

### Invalid table-name escape

The first function version used an invalid multi-character SQL `ESCAPE` sequence while counting CRYPTO LAB tables without RLS. The call failed before returning data.

The condition was replaced with the stable regular expression `^crypto_`.

### False monitor freshness warning

The initial decision logic used only the most recently reconciled SLO observation. Immediately before the five-minute reconciliation cycle, the observation could appear older than three minutes even while new monitor requests were being dispatched every minute.

The final logic uses the latest tracked Edge dispatch timestamp for freshness while retaining completed observations for success and latency calculations.

### False cursor-lag warning

A five-minute reconciler naturally sees several unprocessed one-minute monitor cron runs. The first threshold warned above two pending runs.

The final threshold warns above ten runs or fifteen minutes and becomes critical above thirty runs or thirty minutes.

## Transactional access verification

Rollback-only Auth tests confirmed:

- an admin receives the complete bounded summary;
- an ordinary authenticated user is rejected with SQLSTATE `42501`;
- direct browser-role SELECT of `crypto_operational_observations` is denied;
- sensitive credential markers are absent from the JSON response;
- temporary Auth users and profiles are fully rolled back.

## Natural operational result

After correcting the false-positive rules, the protected summary returned:

- decision: `TECHNICAL_GO`;
- overall state: `healthy`;
- healthy controls: 10;
- warnings: 0;
- critical controls: 0;
- collecting controls: 0;
- open incidents: 0;
- seven of seven tracked cron jobs successful;
- Telegram outbox: 71 sent, 0 unsent, 0 dead;
- HTTP backlog: two recent mappings, oldest approximately one minute;
- maximum cron cursor lag: one run, approximately one minute;
- signal monitor: approximately 99.5% rolling success, p95 approximately 43 ms;
- market scanner: 100%, p95 approximately 1.85 seconds;
- incident reconciliation: approximately 97.5%, p95 below 100 ms;
- maintenance age: approximately 11.7 hours, completed without error;
- CRYPTO LAB tables without RLS: 0;
- browser-executable public `SECURITY DEFINER` functions: 0.

A single platform-level monitor HTTP 502 at 13:59 UTC was captured and automatically resolved by the next successful response. The incident remains in the bounded rolling evidence but no current open incident remains.

## Administrative interface

File `v79/admin-ops-summary.js` adds a protected RU / UA / EN panel at the top of the admin dashboard.

It displays:

- `TECHNICAL_GO`, `WATCH` or `NO-GO`;
- counts by state;
- active technical warnings;
- all ten operational controls;
- bounded current metrics;
- responsible contour;
- external launch blockers from the latest release checkpoint;
- explicit statement that external notifications are disabled.

The panel refreshes when the admin dashboard opens, through the common admin refresh control, and after sixty seconds while visible.

PWA cache: `crypto-lab-v79-7930-ops1`.

## Boundaries retained

This block did not:

- create a manual production signal;
- send a test Telegram message or email;
- create a persistent external test user;
- enable registration or password recovery;
- configure BASIC or PRO prices;
- enable payment providers, checkout, billing webhooks, recurring billing or refunds;
- publish v79 over v78.

Root v78 remains unchanged at SHA `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
