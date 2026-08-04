# CRYPTO LAB v79 — Durable signal notification outbox

Build: `7930`

Implemented on 2026-08-04 for Supabase project `txhzxbizjpinowepfjkm`. The working root v78 application was not modified.

## Defect addressed

The previous `crypto-signal-monitor` implementation sent a Telegram message before persisting the signal transition. If Telegram delivery succeeded but the following database update failed or the Edge Function stopped, the same event could be detected and sent again on a later minute.

The old implementation also issued one REST update for every WAITING or ACTIVE signal each minute. With approximately 60 live signals, that produced approximately 60 separate PATCH requests per monitor cycle.

## Durable outbox architecture

Migration: `crypto_lab_signal_notification_outbox`.

Created protected table `public.crypto_signal_notification_outbox` for the events:

- `ENTRY`;
- `TP1`;
- `TP2`;
- `TP3`;
- `STOP`.

Each `(signal_id, event_type)` pair is unique. Signal-state transition and outbox insertion occur in the same PostgreSQL transaction. Repeated monitor cycles therefore cannot create a second outbox row for the same event.

Outbox states:

- `pending`;
- `processing`;
- `retry`;
- `sent`;
- `dead`.

Delivery retry intervals are 1, 5, 15 and 60 minutes. After five failed delivery attempts, the item moves to `dead` for operator review.

A processing claim older than ten minutes can be reclaimed, which prevents a crashed worker from permanently blocking a notification.

## Service-only RPC boundary

Created service-role-only functions:

- `service_apply_crypto_signal_monitor_batch(jsonb)`;
- `service_claim_crypto_signal_notifications(integer)`;
- `service_mark_crypto_signal_notification_sent(uuid,text)`;
- `service_mark_crypto_signal_notification_failed(uuid,text)`.

The batch function:

- accepts at most 100 signal prices;
- locks each affected signal row;
- applies Stop-first event priority;
- updates last price and check time;
- transitions WAITING/ACTIVE state;
- inserts the unique outbox event atomically.

The table and service functions are inaccessible to `anon` and `authenticated`. RLS is enabled and direct browser SELECT is denied.

## Edge Function version 5

`crypto-signal-monitor` was upgraded from version 4 to version 5.

The function still requires `MONITOR_SECRET` and remains `verify_jwt=false` intentionally for the protected cron integration.

The new cycle performs:

1. one query for live signals;
2. one Binance price request;
3. one batch transition RPC;
4. one outbox claim RPC;
5. one acknowledgement RPC per actual notification.

Normal no-event cycles no longer issue one REST PATCH per signal.

Telegram success records the Telegram message ID. Telegram failure records a bounded error and schedules a retry.

Telegram does not offer a general idempotency key for `sendMessage`. A process failure after Telegram accepts a message but before the acknowledgement RPC could still cause a later retry. The durable outbox reduces this window substantially and makes every retry visible, but it must not be described as mathematically exactly-once external delivery.

## Verification

A rollback-only database test verified:

- WAITING → ENTRY transition;
- ACTIVE → TP1 transition;
- two unique outbox rows;
- claim processing;
- sent acknowledgement;
- failed acknowledgement moving to retry;
- complete rollback with zero persistent test signals.

No Telegram message was sent by the transactional test.

The first normal scheduled version-5 monitor response returned HTTP 200:

- checked: 60;
- missing: 0;
- transitioned: 0;
- queued: 0;
- notification failures: 0;
- errors: empty.

The live signals received a current `last_checked_at`, confirming the new batch RPC path was active.

A transient HTTP 502 occurred during the deployment minute while the Edge version was being replaced. Subsequent version-5 cycles returned HTTP 200.

## Security and performance state

Current inventory after the migration:

- CRYPTO LAB public tables with RLS: 34 / 34;
- CRYPTO LAB functions: 112;
- server-side `SECURITY DEFINER` functions: 66;
- browser-executable public definers: 0;
- Supabase Security Advisor lints: 0.

Performance Advisor reports only informational unused-index notices on new or low-traffic tables. The outbox delivery and stale-processing indexes are retained until production query statistics exist.

## Retention

Daily maintenance now deletes `sent` and `dead` outbox records older than 180 days and records the deleted count in `crypto_maintenance_runs.notification_outbox_deleted`.

Pending, retrying or processing notifications are never removed by the retention rule.

## Operational follow-up

The next natural signal transition must confirm the complete version-5 path:

- outbox row created;
- item claimed;
- Telegram accepted;
- status changed to `sent`;
- no duplicate row for the same signal event.

No manual production signal should be created solely for this verification.
