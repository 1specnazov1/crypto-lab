# CRYPTO LAB v79 — Edge public-surface hardening

Build: `7930`

Verification date: 2026-08-04

This block reduced the unauthenticated Edge Function attack surface without changing the working v78 root application, enabling registration, enabling recovery, configuring prices, or sending email.

## Defect corrected: browser signal registration

`crypto-signal-register` version 6 accepted a request when a caller supplied:

- the public GitHub Pages origin;
- the public Supabase publishable key in both `apikey` and Bearer headers.

Because both values are public and an `Origin` header is not a server authentication mechanism, that branch could not be treated as authorization for signal creation.

Version 7 removes the browser branch completely.

Signal registration now accepts only:

- a matching Supabase `service_role` credential in both server headers; or
- the protected `MONITOR_SECRET` used by the scanner/cron server path.

The existing input validation remains in force for symbol, timeframe, direction, strength, entry, stop and take-profit levels.

Verification:

- publishable-key request with the approved browser origin: HTTP `401 Unauthorized`;
- protected monitor-secret request with an intentionally invalid symbol: HTTP `400 Invalid symbol`.

The second result proves that protected authentication completed and validation rejected the payload before any insert. No signal was created by this test.

## Public dashboard reduced to health-only data

`crypto-lab-v79-preview` version 4 called the privileged dashboard RPC and exposed signal rows, run history, trade levels and scanner error text through an unauthenticated public endpoint.

Version 5 now calls the dedicated protected RPC:

- `private.get_crypto_v79_public_health()`;
- public service-role-only wrapper `get_crypto_v79_public_health()`.

The public payload is limited to:

- server time;
- sanitized latest scanner-run counters;
- scanner and monitor freshness;
- aggregate signal counts;
- active cron schedule flags.

The payload deliberately returns empty `signals` and `runs` arrays. It does not return signal IDs, entry levels, stops, targets, scanner class-A payloads, run history or error messages. Only `error_count` is exposed.

The duplicate HTML application previously embedded in the Edge Function was retired. The supported application remains the versioned GitHub Pages v79 build.

Verification returned HTTP `200` with `public_surface: health_only`, empty signal/history arrays and no trading levels.

## Obsolete chart Edge endpoint retired

`crypto-lab-v79-chart` was an unused duplicate HTML chart endpoint. Repository search found no application reference to it.

Version 2 now:

- requires JWT at the platform boundary;
- returns a deprecated-endpoint response for authorized callers;
- directs development to the versioned GitHub Pages `v79/chart.html` module.

An unauthenticated request now returns HTTP `401` before function execution.

## Scheduled operations after hardening

All six CRYPTO LAB jobs remain active and their latest recorded cron invocation succeeded:

- signal monitor — every minute;
- market scanner — every 15 minutes;
- subscription lifecycle — every 15 minutes;
- billing retry — every 5 minutes;
- billing reconciliation — minute 7 each hour;
- maintenance — daily at 03:17 UTC.

The latest monitor and scanner cron rows were successful after deployment of the surrounding release-candidate infrastructure. The next normal scanner cycle is the production-path confirmation for signal-register version 7; no manual signal was inserted for testing.

## Current security inventory

- CRYPTO LAB public tables with RLS: `33 / 33`;
- CRYPTO LAB functions across `public` and `private`: `107`;
- `SECURITY DEFINER` server-boundary functions: `61`;
- browser-executable public `SECURITY DEFINER` functions: `0`;
- active BASIC/PRO prices: `0`;
- active payment-provider adapters: `0`;
- open billing anomalies: `0`;
- pending/review billing events: `0`;
- Supabase Security Advisor findings: `0`.

## Commercial boundary retained

This block did not:

- enable registration or password recovery;
- configure Turnstile;
- activate BASIC or PRO prices;
- choose LiqPay or Stripe;
- install merchant or webhook secrets;
- enable checkout, recurring payments or refunds;
- send email or Telegram messages;
- publish v79 over v78.

The root v78 `index.html` remains unchanged.
