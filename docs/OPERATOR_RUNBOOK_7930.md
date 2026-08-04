# CRYPTO LAB v79 — Operator runbook

Build: `7930`

Updated: 2026-08-04

## Purpose

This runbook defines the safe operating procedure for CRYPTO LAB v79. It is deliberately free of credentials, raw request payloads, authorization headers, payment secrets, Telegram identifiers and trading price levels.

The working root v78 must not be changed or replaced until a separate release decision is recorded.

## Primary decision source

Open the protected admin dashboard and begin with **Operational decision**.

- `TECHNICAL_GO`: all technical controls are healthy. Continue routine observation. This is not approval for public paid launch.
- `WATCH`: no critical failure exists, but at least one warning or collecting state requires review.
- `NO-GO`: at least one critical technical control exists. Do not publish, enable registration, activate payments or change the working root.

Refresh the summary before acting. Do not infer current state from an old screenshot.

## Mandatory boundaries

Never paste or store in tickets, screenshots or documentation:

- service-role keys;
- `MONITOR_SECRET`;
- Telegram bot token or chat ID;
- HTTP authorization headers;
- Edge request or response bodies;
- payment credentials or webhook signatures;
- recovery or registration secrets.

Never repair an incident by directly editing:

- signal notification flags;
- durable cron cursors;
- operational observations;
- incident status or observation IDs;
- outbox payloads or delivery timestamps.

Use only the existing protected administrative actions and audited RPCs.

## Routine check

Review in this order:

1. Operational decision and active alerts.
2. Open operational incidents.
3. Signal-monitor, market-scanner and reconciliation SLO.
4. Telegram outbox state.
5. Operational HTTP backlog.
6. Cron cursor lag and latest terminal state of all seven jobs.
7. Maintenance freshness and completion status.
8. Security boundary and release checkpoint.

Healthy baseline:

- no open incidents;
- no dead or unsent outbox records;
- no HTTP request older than ten minutes;
- no cursor lag older than fifteen minutes;
- latest terminal state of all seven cron jobs is successful;
- latest maintenance completed without error;
- zero CRYPTO LAB tables without RLS;
- zero browser-executable public `SECURITY DEFINER` functions.

## Incident procedure

### Signal monitor or market scanner warning

1. Confirm whether the alert is freshness, success-rate or latency related.
2. Check the latest Edge Function and PostgreSQL cron logs for status only; do not copy raw payloads.
3. Allow the normal reconciliation interval before classifying a recent pending request as stuck.
4. If a later successful response automatically resolves the incident, retain the rolling evidence and take no manual data action.
5. Escalate to `NO-GO` when the protected summary reports critical state.

### HTTP backlog

- Normal: recent pending mappings inside the reconciliation window.
- Warning: 100 pending or the oldest pending mapping exceeds ten minutes.
- Critical: 500 pending or the oldest pending mapping exceeds thirty minutes.

Do not delete pending mappings. Review dispatcher and reconciler terminal states first.

### Cron cursor lag

- Normal: several one-minute monitor runs can accumulate before the five-minute reconciler.
- Warning: more than ten terminal runs or more than fifteen minutes.
- Critical: more than thirty terminal runs or more than thirty minutes.

Do not advance a cursor manually. Verify that reconciliation is running and allow it to process the durable sequence.

### Telegram outbox

- Warning: any unsent row, 100 unsent rows, or an unsent age above five minutes.
- Critical: any dead row, 500 unsent rows, or an unsent age above fifteen minutes.

Use only the audited dead-letter requeue control. Never create a duplicate `(signal_id, event_type)` pair and never reset notification flags manually.

### Maintenance

- Warning when the latest completed maintenance run is older than 26 hours.
- Critical when missing, failed or older than 48 hours.

Review the maintenance run record and its bounded counters. Do not run destructive retention SQL outside the versioned maintenance function.

### Security boundary

Any table without RLS or any browser-executable public `SECURITY DEFINER` function is an immediate `NO-GO`.

Do not remove indexes solely because the performance advisor marks them unused during low traffic.

## Data-integrity rules

Signal geometry must remain valid:

- entry low must not exceed entry high;
- LONG stop must be below the entry zone and targets must increase;
- SHORT stop must be above the entry zone and targets must decrease;
- ACTIVE signals require activation time;
- CLOSED signals require closure time and close type.

Outbox invariants:

- `(signal_id, event_type)` is unique;
- sent rows require `sent_at`;
- unsent rows must not contain `sent_at`;
- stale processing claims and excessive retries require review.

Operational ledger invariants:

- every processed tracked HTTP request has one bounded observation;
- request and observation success, status and duration agree;
- open incidents have no resolution time;
- resolved incidents have a resolution time;
- cursors never exceed the latest terminal cron run.

## Legacy notification cutover

The durable outbox began on 2026-08-04 at approximately 09:00 UTC. Older signal notification flags may not have matching outbox rows because those notifications predate the ledger.

Do not backfill historical sent events into the live outbox and do not reset legacy flags. Either action could cause duplicate Telegram delivery.

For signals created after the cutover, notification flags and sent outbox events must remain consistent.

## Scanner partial errors

A scanner run may complete successfully while recording bounded per-market errors. Treat isolated invalid or unavailable markets as partial errors, not total scanner failure.

Review recurring patterns. A repeated malformed market symbol is a code defect and must be filtered before candle retrieval or signal registration.

## Release checklist

Before any v79 publication decision, confirm:

- operational decision is `TECHNICAL_GO`;
- latest release gate, browser smoke and Pages deployment are successful;
- data-integrity audit has no current invariant violations;
- next real daily maintenance has completed successfully;
- physical iPhone and Android review is complete;
- a real admin account is assigned;
- managed backup/PITR status is confirmed;
- Turnstile and mail relay are configured;
- plan prices, currency and billing period are approved;
- payment provider, merchant credentials and webhook secrets are configured;
- refund and chargeback policy is approved.

Until all external blockers are resolved, registration, recovery, paid prices, checkout, webhooks, recurring billing and refunds remain disabled.

## Rollback boundary

The stable root v78 SHA is `4a278c891d37b3760ec1ac988690ea9ad587b24e`.

A v79 problem must not be corrected by modifying v78. Preserve v78 and repair v79 independently, then create new evidence and a new protected release checkpoint.