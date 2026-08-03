# CRYPTO LAB v79 — AI reliability and journal input bounds

Applied on 2026-08-03 to Supabase project `txhzxbizjpinowepfjkm` and GitHub Pages build `7918`.

## Release boundaries

- The working v78 application was not modified.
- Public registration remains disabled.
- No email was sent.
- No external test account was created.
- No paid OpenAI request was made during verification.

## Persistent AI rate limiting

Migration: `crypto_lab_v79_persistent_feature_rate_limits`.

Private table `crypto_feature_rate_events` stores short-lived per-user feature events. It has RLS enabled, explicit deny policies for `anon` and `authenticated`, and no direct client access.

Server-only RPC:

- `reserve_crypto_feature_rate(user_id, feature, limit, window_seconds)`

The AI Edge Function now uses an atomic database rate window of eight requests per authenticated user per 60 seconds. The previous in-memory limiter was removed because separate Edge Function instances cannot share process memory reliably.

The rate-limiter RPC is executable only by `service_role`. Verification confirmed:

- `anon`: no execute permission;
- `authenticated`: no execute permission;
- `service_role`: execute permission;
- no rate event was created by an unauthenticated verification request.

Rate events older than two days are removed by daily maintenance.

## Fair quota refund

Server-only RPC:

- `refund_crypto_feature_for_user(user_id, feature, usage_date)`

If the daily AI quota has been consumed but the OpenAI request subsequently fails with a server-side or upstream error, the Edge Function attempts to return one request to that user's daily quota. Input validation, authentication failures, daily quota exhaustion and rate-limit rejections are not refunded because they do not consume AI quota.

The refund RPC is executable only by `service_role`.

## AI Edge Function version 9

Function: `crypto-ai-advisor`, JWT verification enabled.

Changes:

- persistent database-backed per-user rate limit;
- explicit rejection of unapproved browser origins;
- request-size check before reading the request body;
- invalid JSON returns HTTP 400 rather than a generic server error;
- 45-second OpenAI timeout;
- quota refund on upstream/server failure;
- `store: false` sent to the OpenAI Responses API;
- market-data blocks are explicitly treated as untrusted data and isolated from instructions;
- no question text or full market context is written to the AI ledger;
- telemetry records only character counts, token counts, quality checks, status, model and technical errors;
- public errors do not expose upstream response bodies or credentials.

An unauthenticated request returned HTTP 401 at the JWT gateway. It created no rate event and did not reach OpenAI.

## AI client build 7918

`v79/ai.html` now includes:

- Content Security Policy and `no-referrer`;
- strict asset and question validation;
- 4,000-character input bound and live character count;
- 12-second Binance timeout;
- 55-second total AI request timeout;
- direct parsing of structured Edge Function error codes;
- localized quota, rate-limit, offline and timeout messages in RU / UA / EN;
- closed-candle validation;
- SMA20, SMA50, RSI14 and ATR14 added to the market context;
- explicit symbol and timeframe fields sent to the server;
- duplicate-submit protection and network-state handling;
- all AI output rendered with `textContent`, not raw HTML.

PWA cache `crypto-lab-v79-7918` forces the new AI client into the installed application shell.

## Trade journal API bounds

Migration: `crypto_lab_v79_trade_journal_input_bounds`.

Database checks now enforce limits even when the browser interface is bypassed:

- strategy: 120 characters;
- setup: 250 characters;
- notes: 4,000 characters;
- tags: up to 20 and 1,000 combined characters;
- quote asset: uppercase alphanumeric, 2–12 characters;
- external trade ID: 160 characters;
- bounded price, quantity, fee, funding and realized-PnL numeric values.

Existing RLS ownership policies and unique import/exchange/signal fingerprints remain in force.

## Verification

A temporary public validator checked the deployed build after GitHub Pages propagation:

- `index.html`, `app.html`, `app-extension.js`, `service-worker.js`, `ai.html`, admin modules and journal modules returned HTTP 200;
- build `7918` and cache `crypto-lab-v79-7918` were confirmed;
- external JavaScript and all inline scripts passed syntax validation;
- AI client timeout and input-bound controls were present;
- the validator was immediately restored to mandatory JWT.
