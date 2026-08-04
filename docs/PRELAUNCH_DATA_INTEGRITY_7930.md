# CRYPTO LAB v79 — Pre-launch data integrity audit

Build: `7930`

Audit date: 2026-08-04

## Scope

This audit validates the current CRYPTO LAB data model, signal lifecycle, notification outbox, scanner history, operational ledger, identity boundary, commercial boundary, maintenance state and database security controls.

The working root v78 was not modified or replaced.

## Signal lifecycle

Snapshot at 2026-08-04 15:20 UTC:

- signal rows: 232;
- inverted entry zones: 0;
- invalid LONG stop/target geometry: 0;
- invalid SHORT stop/target geometry: 0;
- ACTIVE signals without activation time: 0;
- CLOSED signals without closure time or close type: 0;
- non-CLOSED signals with closure time: 0;
- WAITING signals already marked entry-notified: 0.

The current signal lifecycle and trading geometry are internally consistent.

## Telegram outbox

Snapshot:

- outbox rows: 73;
- sent: 73;
- unsent: 0;
- dead: 0;
- duplicate `(signal_id, event_type)` pairs: 0;
- stale processing claims: 0;
- attempts above five: 0;
- sent rows without `sent_at`: 0;
- unsent rows containing `sent_at`: 0.

### Legacy cutover

The durable outbox began at approximately 2026-08-04 09:00 UTC.

- signals created before cutover: 200;
- signals created after cutover: 32;
- post-cutover notification-flag/outbox mismatches: 0;
- sent outbox events paired with false notification flags: 0.

Historical true flags without outbox rows occur only before the cutover:

- ENTRY: 195;
- TP1: 59;
- TP2: 35;
- TP3: 22;
- STOP: 116.

These are legacy records, not current delivery inconsistencies. They must not be backfilled into the live outbox and their flags must not be reset, because either action could cause duplicate Telegram delivery.

## AI and backtest runs

- AI runs stuck in `started` beyond fifteen minutes: 0;
- completed AI runs missing completion time: 0;
- backtests stuck in `started` beyond thirty minutes: 0;
- completed backtests missing completion time: 0.

## Operational ledger

- durable cron cursors: 7;
- open incidents: 0;
- pending HTTP mappings older than ten minutes: 0;
- processed HTTP mappings missing bounded observations: 0;
- HTTP request/observation result mismatches: 0;
- open incidents with resolution time: 0;
- resolved incidents missing resolution time: 0;
- inverted incident timestamps: 0;
- cursors ahead of latest terminal cron runs: 0.

## Scanner history and confirmed defect

The audit reviewed 191 scanner runs before the fix:

- successful runs missing completion time: 0;
- negative run durations or timestamps: 0;
- registered count exceeding discovered signal count: 0;
- three successful runs contained bounded partial errors.

Two recent partial errors were caused by a one-character Binance base symbol `U`, which passed the market-volume ranking but violated the CRYPTO LAB symbol constraint `^[A-Z0-9]{2,20}$`.

### Correction

`crypto-market-scanner` version 12 now filters candidate market symbols with the same bounded format before candle retrieval and registration:

```text
^[A-Z0-9]{2,20}$
```

Deployment verification:

- Edge Function version: 12, ACTIVE;
- source commit: `6d168de517c90ccac5ccf6122d702f3624a156dc`;
- first natural scheduled v12 run: 2026-08-04 15:30 UTC;
- run ID: 192;
- success: true;
- dry run: false;
- symbols checked: 20;
- bounded errors: 0;
- no manual signal or test notification was generated for verification.

The natural run found only existing duplicate candidates and sent no Telegram message.

## Identity boundary

- Auth users: 0;
- user profiles: 0;
- subscriptions: 0;
- obvious persistent test users: 0;
- admin profiles: 0.

There is no orphaned identity data. The absence of a real admin remains an explicit external launch blocker.

## Commercial boundary

- active paid prices: 0;
- active price rows: FREE / USD / monthly / amount 0 / internal provider only;
- enabled payment-provider adapters: 0;
- billing orders: 0;
- billing events: 0;
- paid subscriptions: 0;
- open billing anomalies: 0.

Registration, recovery, checkout, payment webhooks, recurring billing and refunds remain disabled.

## Maintenance

Latest real daily maintenance:

- run ID: 5;
- started and completed: 2026-08-04 03:17 UTC;
- status: completed;
- error: none;
- stale AI/backtest rows marked: 0;
- expired leases deleted: 0;
- registration/recovery/rate-limit rows deleted: 0;
- scanner/outbox/operational rows deleted: 0;
- inactive cursors deleted: 0.

This run occurred before the final audit. The next real daily run must be reviewed after 2026-08-05 03:17 UTC to confirm the consolidated retention counters under normal operation.

## Security boundary

- CRYPTO LAB public tables without RLS: 0;
- browser-executable public `SECURITY DEFINER` functions: 0;
- unvalidated CRYPTO LAB constraints: 0;
- Supabase Security Advisor findings: 0.

## Result

The current data set has no active integrity violation in signal geometry, lifecycle timestamps, notification delivery, operational observations, incident state, durable cursors, AI/backtest completion, identity relations or security boundaries.

Technical status remains suitable for continued v79 beta validation. Public paid launch remains blocked by external configuration and business decisions, including real admin assignment, managed backup confirmation, physical-device review, Turnstile, mail relay, plan prices, provider selection, merchant credentials, webhook secrets and refund/chargeback policy.

Stable root v78 remains at SHA `4a278c891d37b3760ec1ac988690ea9ad587b24e`.