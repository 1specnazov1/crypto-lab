# CRYPTO LAB v79 — Protected server backtest

Applied to Supabase project `txhzxbizjpinowepfjkm` and GitHub Pages build `7912` on 2026-08-03.

## Architecture

The official v79 backtest no longer calculates strategy results in the browser.

- `crypto-lab-v79-backtest-data` validates parameters, checks the authenticated account quota, obtains closed Binance candles, consumes one backtest allowance, executes the EMA/RSI/ATR strategy, and returns only the result.
- Raw candles and the calculation implementation are not returned to the browser.
- The Edge Function requires a valid JWT.
- `v79/backtest.html` is a standalone server-backed user interface.
- The legacy `v79/backtest-engine.html` client calculator was replaced with a redirect to the protected page.
- The service worker no longer caches the legacy engine.

## Server validation

Accepted ranges:

- intervals: 5m, 15m, 1h, 4h, 1d;
- candles: 300–1000;
- starting capital: 100–1,000,000,000;
- risk: 0.1–10%;
- leverage: 1–100;
- fee per side: 0–1%;
- EMA Fast: 2–100;
- EMA Slow: 3–250;
- EMA Trend: 20–400;
- RSI period: 2–50;
- ATR multiplier: 0.2–10;
- reward/risk: 0.2–20.

EMA Fast must be below EMA Slow. The RSI SHORT threshold must be below the RSI LONG threshold. Invalid strategy requests are rejected before quota consumption.

## Execution assumptions

- closed candles only;
- signal confirmed at candle close;
- entry at the next candle open;
- one position at a time;
- Stop-first when Stop and TP are touched in the same candle;
- position size is constrained by account risk and maximum leverage;
- fees are deducted on entry and exit;
- funding, slippage and execution latency remain excluded.

## Persistent run ledger

Migration `crypto_lab_v79_backtest_run_ledger` created `public.crypto_backtest_runs`.

For each authenticated request the server records:

- user and creation/completion timestamps;
- completed, failed or rejected status;
- symbol, interval, direction and requested candle count;
- SHA-256 hash of the validated strategy parameters;
- server strategy version and duration;
- candles used and number of simulated trades;
- net P&L, return, maximum drawdown, win rate and Profit Factor;
- normalized error code and short error message;
- plan, plan limit and remaining allowance.

Raw candle data is not stored. Authenticated users may read only their own rows through RLS. Browser roles cannot insert, update or delete ledger rows. Service-role writes are performed only by the protected backtest Edge Function.

Indexes cover user history, operational status/time and repeated parameter hashes.

## User history interface

Build `7912` adds `v79/backtest-history.js` to the official terminal.

- The last 20 server runs are shown below the backtest results.
- The list includes date, completed/rejected/failed status, market, trade count, P&L, return, server duration and normalized error code.
- RU, UA and EN labels are supported.
- The query uses the signed-in Supabase session and RLS, so the user sees only their own records.
- The history script is injected only into the backtest module by `app-extension.js`.
- The PWA service worker includes the history interface in cache build `7912`.

## Verification

Temporary confirmed Auth users were created and deleted automatically after validation.

Results:

- authenticated server backtest returned HTTP 200;
- response identified `engine: server`, returned a server run ID and contained result trades/equity curve;
- raw candles were not present in the response;
- FREE usage changed from 0/3 to 1/3 after one valid run;
- an invalid EMA configuration returned HTTP 400 with `INVALID_STRATEGY` and did not consume another run;
- unauthenticated invocation returned HTTP 401;
- a valid test created one completed ledger row with a 64-character parameter hash, duration, 299 candles and six simulated trades;
- the invalid test created one rejected row with `INVALID_STRATEGY`;
- deleting the temporary Auth user cascaded to zero ledger rows;
- GitHub Pages returned HTTP 200 for index, app shell, extension, service worker, server backtest, history script and legacy redirect;
- build `7912` markers, history injection, history database query and PWA cache entry were verified;
- the temporary validator was restored to mandatory JWT protection.

## Advisor status

The new table introduced no new security advisor finding. Existing security warnings are limited to intentional authenticated application RPCs. Performance findings are informational unused-index notices, expected before production traffic accumulates.

## Isolation

The working v78 root application was not modified.

## Next recommended block

Add commercial telemetry summaries for support and operations: success rate, average duration, quota rejections, failure distribution and repeated parameter profiles. Then expose a compact diagnostics panel only to the existing protected administrator role.
