# CRYPTO LAB v79 — Signal outbox natural delivery and admin observability

Build: `7930`

Verification date: 2026-08-04

## Natural production-path verification

The durable signal notification outbox introduced with `crypto-signal-monitor` version 5 was verified using only naturally occurring market events. No signal or price transition was created manually.

Six independent events completed the full path:

| Symbol | Timeframe | Direction | Event | Attempts | Telegram message ID | Result |
|---|---|---|---|---:|---:|---|
| HOME | 1H | LONG | ENTRY | 1 | 630 | sent |
| MIRA | 1H | SHORT | ENTRY | 1 | 629 | sent |
| TRX | 1H | LONG | TP1 | 1 | 631 | sent |
| XAUT | 5M | LONG | STOP | 1 | 632 | sent |
| MIRA | 5M | SHORT | ENTRY | 1 | 635 | sent |
| XRP | 5M | SHORT | ENTRY | 1 | 636 | sent |

Current outbox state after verification:

- total rows: 6;
- sent: 6;
- pending: 0;
- processing: 0;
- retry: 0;
- dead: 0;
- unique `(signal_id, event_type)` pairs: 6;
- duplicate pairs: 0;
- all successful rows completed in one attempt;
- every successful row contains a Telegram message ID;
- no error text remains on successful rows.

This confirms the natural `signal transition → durable outbox → claim → Telegram → sent acknowledgement` path.

## Protected administrative observability

Migration: `crypto_lab_v79_signal_outbox_admin_health`.

The existing private operational-health function now returns a bounded `signal_outbox` object containing:

- counts for `pending`, `retry`, `processing`, `dead` and `sent`;
- age of the oldest unsent event;
- the latest 20 events with only operational fields:
  - event type;
  - status;
  - attempt count;
  - timestamps;
  - Telegram message ID;
  - symbol, timeframe and direction;
  - last error truncated to 160 characters.

The response does not expose:

- price payloads;
- entry, stop or take-profit levels;
- Telegram bot token or chat ID;
- monitor secret;
- Supabase service-role credentials;
- raw Edge Function payloads.

The browser continues to call the public `SECURITY INVOKER` wrapper. The privileged implementation remains in the `private` schema and performs the admin-role check internally.

## Permission defect found and fixed

The first transactional wrapper test revealed that the private health function had been granted only to `service_role`. This prevented the authenticated public wrapper from invoking it.

Migration: `crypto_lab_v79_signal_outbox_health_wrapper_grant`.

Final permission model:

- `anon`: no private-function execution;
- `authenticated`: may execute the private function only through the admin-checked code path;
- non-admin authenticated users fail the internal `crypto_is_admin()` check;
- direct table SELECT remains denied to `authenticated`;
- `service_role`: permitted for server operations.

A rollback-only temporary admin test confirmed:

- outbox counts and recent rows are returned;
- direct browser table SELECT remains unavailable;
- no payload or trading-level field is exposed;
- no test Auth user remains after rollback.

## Admin interface

`v79/admin-health.js` now displays:

- overall Telegram outbox health;
- pending, retry, processing, dead and sent counts;
- oldest unsent age;
- recent operational events;
- attempts and Telegram message IDs;
- bounded last errors.

The interface supports RU, UA and EN. It does not receive the outbox payload column.

The service-worker cache was refreshed as `crypto-lab-v79-7930-outbox1`, preserving build 7930 while forcing installed PWA clients to receive the updated admin diagnostics.

## Release verification

Git commit: `0f0cc2df3bb7a54db14e705551d3f108ce3bbf85`.

Successful workflows:

- dynamic release gate: `30895962077`;
- Chromium browser/PWA smoke: `30895961330`;
- GitHub Pages deployment: `30895959664`.

Public verification after deployment:

- `admin-health.js`: HTTP 200 and expected outbox markers;
- `service-worker.js`: HTTP 200 and expected cache marker.

Protected release checkpoint ID 5 records this evidence. Technical readiness remains 100/100 and public paid-launch readiness remains 60/100.

Supabase Security Advisor reports zero security lints after the migrations.

## Boundaries retained

This block did not:

- modify or publish root v78;
- create a manual production signal;
- create an external test user;
- send test email;
- enable registration or recovery;
- configure prices or payment providers;
- enable checkout, webhook processing, recurring billing or refunds.
