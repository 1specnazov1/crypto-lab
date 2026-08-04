# CRYPTO LAB v79 — Continuous data integrity enforcement

Build: `7930`

Verification date: 2026-08-04

## Scope

This block converts the one-time pre-launch integrity audit into a protected continuous control used by the v79 administrative dashboard and the operational `TECHNICAL_GO / WATCH / NO-GO` decision.

The stable root v78 application was not modified or replaced.

## Protected integrity snapshot

Migration:

- `supabase/migrations/202608041545_continuous_data_integrity.sql`;
- migration commit: `360143002f5817edaa940a2197a2a88d4373c98a`.

Functions:

- `private.crypto_data_integrity_snapshot()` — service-only bounded aggregate calculation;
- `private.get_crypto_admin_data_integrity()` — mandatory admin-role check;
- `public.get_crypto_admin_data_integrity()` — browser-compatible `SECURITY INVOKER` wrapper.

The response contains counts and invariant names only. It does not return:

- signal price levels;
- outbox payloads;
- user email addresses;
- Edge request or response bodies;
- HTTP authorization headers;
- service-role credentials;
- `MONITOR_SECRET`;
- Telegram identifiers;
- payment, registration or recovery secrets.

## Continuous checks

The snapshot evaluates 45 checks.

### Signal lifecycle and geometry

- entry low cannot exceed entry high;
- LONG stop must remain below the entry zone and targets must increase;
- SHORT stop must remain above the entry zone and targets must decrease;
- stored symbols must match `^[A-Z0-9]{2,20}$`;
- ACTIVE signals require activation time;
- CLOSED signals require close time and close type;
- non-CLOSED signals cannot contain close time;
- WAITING signals cannot already be entry-notified.

### Telegram outbox

- `(signal_id, event_type)` must remain unique;
- sent rows require `sent_at`;
- unsent rows cannot contain `sent_at`;
- processing claims older than ten minutes generate a warning;
- attempts above five are critical;
- every outbox row must reference an existing signal;
- post-cutover sent events and signal notification flags must agree in both directions.

The legacy cutover remains fixed at `2026-08-04T09:00:00Z`. Historical pre-cutover flags are deliberately excluded and must not be backfilled or reset.

### AI and backtest execution

- stale started AI runs above fifteen minutes generate a warning;
- terminal AI runs require completion time;
- stale started backtests above thirty minutes generate a warning;
- terminal backtests require completion time.

### Operational ledger

- every processed tracked HTTP request must have one bounded observation;
- request and observation success, status and duration must agree;
- open incidents cannot contain resolution time;
- resolved incidents require resolution time;
- incident timestamps cannot be inverted;
- durable cron cursors cannot exceed terminal cron history.

### Scanner history

- successful scanner runs require finish time;
- scanner timestamps and duration cannot be negative;
- registered signals cannot exceed class A candidates;
- successful scanner v12 runs with bounded partial errors inside the last 24 hours generate a warning.

### Identity and commercial relations

- profiles and subscriptions cannot outlive their Auth user;
- Auth users require both profile and subscription records;
- billing orders and events cannot reference missing users or orders;
- billing processed flags and timestamps must agree;
- billing order completion time must agree with terminal status;
- subscription periods cannot be inverted;
- an active paid price requires a verified checkout adapter;
- an enabled adapter must be fully verified.

### Database security

- every CRYPTO LAB public table requires RLS;
- browser roles cannot execute public `SECURITY DEFINER` functions;
- all CRYPTO LAB constraints must be validated.

## Operational decision integration

The prior protected operational summary was preserved as `private.get_crypto_admin_operational_summary_base()`.

A new wrapper adds a `data_integrity` indicator:

- healthy integrity preserves the existing decision;
- a warning changes an otherwise healthy decision to `WATCH`;
- a critical integrity violation changes the decision to `NO_GO`.

The summary count and alert arrays are updated atomically in the returned JSON. No external notification is sent.

## Rollback-only verification

Two local Auth rows were inserted inside a transaction without email delivery:

- one ordinary user;
- one admin.

Healthy-state verification:

- integrity state: `healthy`;
- operational decision: `TECHNICAL_GO`;
- embedded integrity state: `healthy`.

A synthetic terminal AI run with a missing completion time was then inserted inside the same transaction.

Critical-state verification:

- integrity state: `critical`;
- `ai_terminal_without_time` violations: `1`;
- operational state: `critical`;
- operational decision: `NO_GO`;
- `data_integrity` appeared in the active alert array.

An ordinary authenticated user was rejected with SQLSTATE `42501` / `Admin access required`.

The transaction was rolled back. Final persistent test state:

- test Auth users: `0`;
- test profiles: `0`;
- test AI runs: `0`.

## Natural state

After deployment:

- integrity state: `healthy`;
- total checks: `45`;
- critical checks with violations: `0`;
- warning checks with violations: `0`;
- critical violations: `0`;
- warning violations: `0`.

This confirms the current data set remains internally consistent after the market scanner v12 correction.

## Administrative interface

File `v79/admin-integrity.js` adds a protected RU / UA / EN panel.

It displays:

- current integrity state;
- number of checks;
- critical and warning counts;
- active violations only;
- an expandable list of all 45 checks;
- audit generation time and outbox cutover time.

The panel refreshes when the admin dashboard becomes visible, through the common admin refresh control and every sixty seconds while visible.

Application commits:

- panel: `037009fae0339fb7ef6f4c8bded223af0afceeaa`;
- admin loader: `1b01d5b7dd1decdfcacd4ea243b293696523b69c`;
- PWA cache: `bfa7875e34f51e47c134b4c570c141298d904ea7`;
- cache name: `crypto-lab-v79-7930-integrity1`.

## Release verification

Successful workflows for application commit `bfa7875e34f51e47c134b4c570c141298d904ea7`:

- release gate: `30926170428`;
- Chromium browser/PWA smoke: `30926174066`;
- GitHub Pages: `30926169393`.

Public assets returned HTTP 200 with the expected markers:

- `v79/admin-integrity.js`;
- `v79/commercial-extension.js`;
- `v79/service-worker.js`.

Supabase Security Advisor findings after the migration: `0`.

The browser smoke is automated Chromium validation, not a physical iPhone or Android review.

## Boundaries retained

This block did not:

- create a manual production signal;
- send a test Telegram message or email;
- retain a test Auth user;
- enable public registration or password recovery;
- activate paid prices or a payment provider;
- enable checkout, webhook, recurring billing or refunds;
- publish v79 over v78.

Root v78 remains unchanged at SHA `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
