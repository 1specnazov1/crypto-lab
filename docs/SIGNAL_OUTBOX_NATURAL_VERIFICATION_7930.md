# CRYPTO LAB v79 — Natural signal outbox verification

Build: `7930`

Verification date: 2026-08-04

This verification covers naturally occurring signal-monitor events after deployment of `crypto-signal-monitor` version 5. No signal was manually created and no Telegram test message was sent.

## Natural delivery evidence

Four naturally occurring events completed the durable delivery path:

| Event | Count | Outbox result | Attempts | Telegram message IDs |
|---|---:|---|---:|---|
| ENTRY | 2 | sent | 1 each | 629, 630 |
| TP1 | 1 | sent | 1 | 631 |
| STOP | 1 | sent | 1 | 632 |

The associated monitor cycles recorded:

- 09:00 UTC: two state transitions, two queued events, two claimed events and two successful deliveries;
- 09:03 UTC: one state transition, one queued event, one claimed event and one successful delivery;
- 09:06 UTC: one state transition, one queued event, one claimed event and one successful delivery.

All three cycles returned HTTP 200 with zero notification failures and an empty error list.

## Idempotency and state consistency

- No duplicate row exists for the same `signal_id + event_type` pair.
- All four rows are in `sent` state.
- Every delivery has a Telegram message ID.
- Every delivery completed on its first attempt.
- No row is in `pending`, `retry`, `processing` or `dead` state.
- Signal state and notification flags are consistent with the outbox event:
  - ENTRY signals are active with `entry_notified = true`;
  - TP1 signal is active with `tp1_notified = true`;
  - STOP signal is closed with `stop_notified = true` and `close_type = STOP`.

## Protected administrative observability

A dedicated private-wrapper RPC now exposes administrative outbox health without exposing payloads or secrets.

The protected response includes:

- counts for pending, retry, processing, dead and sent;
- age and timestamp of the oldest unsent event;
- due retries and processing rows stuck beyond ten minutes;
- sent and failed counts for the preceding 24 hours;
- up to 20 recent deliveries;
- up to 20 recent failures with sanitized error text limited to 300 characters.

The response deliberately excludes the notification payload and all service, Telegram and database secrets.

Authorization model:

- private implementation: `SECURITY DEFINER`, executable only through the protected server/admin boundary;
- public wrapper: `SECURITY INVOKER`;
- anonymous execution: denied;
- authenticated execution still requires `crypto_is_admin()`;
- direct browser access to the outbox table remains denied by RLS.

An unauthenticated publishable-key RPC request returned HTTP 401.

## Administrative interface

The v79 administrative interface now includes an outbox panel showing:

- pending, retry, processing, dead and sent counts;
- total unsent events;
- oldest unsent age;
- due retries and stuck processing rows;
- deliveries and failures in the preceding 24 hours;
- recent delivery metadata and bounded errors.

The panel escapes rendered values and does not request or display outbox payloads.

## Deployment and security evidence

- Final application commit for this block is recorded in the protected release checkpoint.
- GitHub Pages deployment completed successfully.
- Both the new administrative script and its loader returned HTTP 200 after deployment.
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
