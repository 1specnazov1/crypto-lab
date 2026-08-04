# CRYPTO LAB v79 — Natural signal outbox verification

Build: `7930`

Verification date: 2026-08-04

This verification covers naturally occurring signal-monitor events after deployment of `crypto-signal-monitor` version 5. No signal was manually created and no Telegram test message was sent.

## Natural delivery evidence

Six naturally occurring events completed the durable delivery path:

| Event | Count | Outbox result | Attempts | Telegram message IDs |
|---|---:|---|---:|---|
| ENTRY | 4 | sent | 1 each | 629, 630, 635, 636 |
| TP1 | 1 | sent | 1 | 631 |
| STOP | 1 | sent | 1 | 632 |

The associated monitor cycles recorded:

- 09:00 UTC: two state transitions, two queued events, two claimed events and two successful deliveries;
- 09:03 UTC: one state transition, one queued event, one claimed event and one successful delivery;
- 09:06 UTC: one state transition, one queued event, one claimed event and one successful delivery;
- 09:15 UTC: one natural ENTRY event completed successfully;
- 09:24 UTC: one natural ENTRY event completed successfully.

All delivery cycles returned HTTP 200 with zero notification failures and an empty error list.

## Idempotency and state consistency

- No duplicate row exists for the same `signal_id + event_type` pair.
- All six rows are in `sent` state.
- Every delivery has a Telegram message ID.
- Every delivery completed on its first attempt.
- No row is in `pending`, `retry`, `processing` or `dead` state.
- Signal state and notification flags are consistent with the outbox event:
  - ENTRY signals are active with `entry_notified = true`;
  - TP1 signal is active with `tp1_notified = true`;
  - STOP signal is closed with `stop_notified = true` and `close_type = STOP`.

## Protected administrative observability

Outbox health is consolidated into the existing protected operational-health boundary rather than exposed through a separate public data surface.

The protected response includes:

- counts for pending, retry, processing, dead and sent;
- age of the oldest unsent event;
- bounded recent-event metadata;
- event type, asset, timeframe, direction, status, attempts and Telegram message ID;
- sanitized bounded error text.

The response deliberately excludes the notification payload and all service, Telegram and database secrets.

Authorization model:

- private implementation: `SECURITY DEFINER` and guarded by `crypto_is_admin()`;
- public wrapper: `SECURITY INVOKER`;
- anonymous execution: denied;
- authenticated execution still requires the server-verified admin role;
- direct browser access to the outbox table remains denied by RLS.

A publishable-key request without an authenticated administrator session was denied.

## Administrative interface

The existing v79 operational-health panel now includes Telegram outbox observability:

- pending, retry, processing, dead and sent counts;
- oldest unsent age;
- recent delivery status and attempt count;
- Telegram message ID;
- bounded error text.

A redundant standalone panel and its extra RPC were removed so the administrative page has one authoritative operational-health view.

## Deployment and security evidence

- Final application commit for this block is recorded in the protected release checkpoint.
- GitHub Pages deployment completed successfully.
- The operational-health script, loader and refreshed service worker returned HTTP 200 after deployment.
- 34 of 34 CRYPTO LAB public tables use RLS.
- No public `SECURITY DEFINER` function is executable by browser roles.
- Supabase Security Advisor reports zero findings.
- Performance Advisor reports informational unused-index notices only.

## Boundaries retained

This block did not:

- modify or publish the root v78 application;
- create a manual production signal;
- create an external test user;
- send email;
- enable registration, recovery, paid prices, checkout, provider adapters, billing webhooks, recurring billing or refunds;
- publish v79 in place of v78.
