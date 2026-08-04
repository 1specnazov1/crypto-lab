# CRYPTO LAB v79 — Operational verification after Edge hardening

Build: `7930`

Verification date: 2026-08-04

This verification covers the first normal scheduled scanner cycles after `crypto-signal-register` was hardened to version 7. No manual production signal was created for testing.

## Scanner → signal register → Telegram path

The scheduled market scanner continued operating through the protected server path after browser access was removed from `crypto-signal-register`.

Verified natural scanner runs:

| Run ID | Started UTC | Result | Class A | Registered | Duplicates | Telegram | Errors |
|---:|---|---|---:|---:|---:|---:|---:|
| 156 | 06:30 | success | 5 | 1 | 4 | 1 | 0 |
| 157 | 06:45 | success | 5 | 1 | 4 | 1 | 0 |
| 158 | 07:00 | success | 6 | 2 | 3 | 2 | 0 |
| 159 | 07:15 | success | 6 | 0 | 5 | 0 | 0 |
| 160 | 07:30 | success | 8 | 0 | 5 | 0 | 0 |
| 161 | 07:45 | success | 8 | 0 | 5 | 0 | 0 |
| 162 | 08:00 | success | 6 | 3 | 2 | 3 | 0 |
| 163 | 08:15 | success | 6 | 0 | 5 | 0 | 0 |

Run 162 provides the clearest end-to-end evidence: three new signals were registered and three Telegram deliveries completed. Registered and Telegram counts matched exactly.

Edge logs confirm:

- `crypto-market-scanner` version 11 returned HTTP 200;
- `crypto-signal-register` version 7 returned HTTP 200 for protected scanner calls;
- `crypto-telegram-signal` version 5 returned HTTP 200 when new signals were created;
- `crypto-signal-monitor` version 4 continued returning HTTP 200;
- no HTTP 401 or 403 occurred in the normal scheduled scanner path.

API logs also confirm successful `register_crypto_signal` RPC calls and HTTP 201 insertion of scanner-run telemetry.

## Cron and database health

The sampled operational window showed successful completion for all six scheduled jobs:

- signal monitor every minute;
- market scanner every 15 minutes;
- subscription lifecycle every 15 minutes;
- billing-event retry every 5 minutes;
- billing reconciliation hourly;
- daily maintenance at 03:17 UTC.

Postgres logs contained normal cron and checkpoint messages and no sampled ERROR-level application failure.

## Authentication review

No new application authentication failure occurred during this verification block.

The available 24-hour Auth log still contains older development test entries from 2026-08-03 and two Supabase platform deprecation notices for legacy GoTrue group-name settings. These notices are platform configuration warnings, not CRYPTO LAB login failures.

This verification block:

- created no external test user;
- performed no public signup;
- sent no email;
- created no new bounce.

## Maintenance and retention

The latest scheduled maintenance execution was run ID 5 at `2026-08-04 03:17 UTC`.

Result:

- status: `completed`;
- error: none;
- stale AI runs remaining: 0;
- stale backtest runs remaining: 0;
- expired deletion counters: 0 because no records were older than their configured retention thresholds.

The deployed `run_crypto_maintenance()` function enforces:

- stale AI failure after 15 minutes;
- stale backtest failure after 30 minutes;
- feature leases: one day after expiry;
- feature-rate events: two days;
- registration and recovery attempt metadata: 30 days;
- scanner and maintenance telemetry: 180 days.

Current overdue-row checks returned zero for registration attempts, recovery attempts, long-term audit records, billing events and release checkpoints.

Billing, legal, support, journal and portfolio records remain outside automatic deletion because their retention depends on approved legal, tax, refund and user-deletion rules.

## Release evidence

Protected release checkpoint ID 2 was updated with:

- natural `crypto-signal-register` v7 verification;
- scanner run IDs 156–163;
- run 162 registered/Telegram match `3/3`;
- zero observed scanner authorization failures;
- latest maintenance run ID 5 and completed state;
- zero current stale AI or backtest runs;
- zero emails sent in this block.

The release checkpoint remains:

- build: `7930`;
- status: `candidate`;
- technical readiness: `100/100`;
- public paid-launch readiness: `60/100`.

## Boundaries retained

This block did not:

- modify or publish the root v78 application;
- enable public registration or password recovery;
- configure BASIC or PRO prices;
- activate payment providers, checkout, webhook processing, recurring billing or refunds;
- send test email;
- manually create a real trading signal.

Remaining launch blockers are external or business-controlled: Turnstile keys, mail relay configuration, provider selection, prices and billing period, merchant credentials, webhook secrets, refund and chargeback rules, managed backup/PITR confirmation, and physical iOS/Android review.
