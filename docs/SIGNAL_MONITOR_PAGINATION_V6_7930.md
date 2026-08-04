# CRYPTO LAB v79 — Signal monitor v6 pagination verification

Build: `7930`

Verification date: 2026-08-04

## Objective

Remove the former `limit(100)` coverage ceiling from `crypto-signal-monitor` without changing the working v78 application or weakening durable notification semantics.

## Deployed function

- Edge Function: `crypto-signal-monitor`
- Version: `6`
- Deployment source hash: `e32286dbced3ab9b3feaa432bc2c2a3e7e72524034ecca62761ee23e586d4583`
- Source path: `supabase/functions/crypto-signal-monitor/index.ts`
- Authentication: platform JWT remains disabled because the existing `x-monitor-secret` server boundary is retained.

No secret values are stored in Git.

## Coverage design

Version 6 replaces a single 100-row query with bounded server pagination:

- page size: 250 live signals;
- maximum pages: 40;
- explicit capacity: 10,000 live signals per invocation;
- deterministic ordering by signal UUID;
- exact first-page count;
- fail-closed pagination mismatch check;
- no silent truncation when the bounded capacity is exceeded.

All live rows are fetched before transition RPC processing begins. This prevents the monitor's own status changes from shifting later page offsets.

## Binance batching

Unique Binance symbols are split into chunks of 40 before calling `/api/v3/ticker/price`.

Controls:

- 15-second timeout per Binance request;
- every expected symbol must have a finite positive price;
- a missing price fails the invocation instead of reporting incomplete coverage as healthy;
- response metadata records unique-symbol and Binance-chunk counts.

## Database batching

Price updates are split into chunks of 100 before calling `service_apply_crypto_signal_monitor_batch`, preserving the existing RPC input limit.

The response aggregates:

- checked rows;
- missing rows;
- state transitions;
- newly queued outbox records;
- RPC chunk count.

The invocation fails if `checked + missing` does not equal the fetched live-signal count. Durable outbox uniqueness, claim locking, retry delays and dead-letter rules were not changed.

## Pre-change operational audit

At the time of deployment:

- WAITING: 4;
- ACTIVE: 60;
- live total: 64;
- unique live symbols: 24;
- outbox: 15 sent;
- maximum outbox attempts: 1;
- retry, pending, processing and dead: 0;
- duplicate `signal_id + event_type` pairs: 0.

The latest scanner runs were successful, checked 20 markets, recorded zero errors and completed in approximately 9.8–12.7 seconds.

## Natural-cycle verification

Five consecutive scheduled v6 monitor responses were reviewed from 10:20 through 10:24 UTC.

Every response returned HTTP 200 with:

- `monitor_version = 6`;
- `source_count = 64`;
- `fetched = 64`;
- `checked = 64`;
- `missing = 0`;
- `signal_pages = 1`;
- `unique_symbols = 24`;
- `binance_chunks = 1`;
- `rpc_chunks = 1`;
- `notification_failures = 0`;
- empty errors.

The 10:23 UTC natural cycle also proved the full event path:

- transitioned: 1;
- queued: 1;
- claimed: 1;
- Telegram sent: 1;
- Telegram message ID: `651`;
- attempts: 1;
- final status: `sent`.

After that event:

- outbox sent: 16;
- pending: 0;
- processing: 0;
- retry: 0;
- dead: 0;
- duplicate event pairs: 0.

No manual trading signal or test Telegram notification was created.

## Security and boundaries

- Supabase Security Advisor: 0 lints after deployment.
- Existing RLS and direct-browser access restrictions remain unchanged.
- The browser still cannot call service monitor RPCs or read the outbox directly.
- Registration, recovery, pricing, payment providers, checkout, webhooks, recurring billing and refunds remain disabled.
- No test email or external test user was created.
- Working root v78 was not modified.

## Result

The former 100-row silent coverage limit is removed. Version 6 either processes the complete bounded live-signal set or fails explicitly; it does not report partial processing as success.