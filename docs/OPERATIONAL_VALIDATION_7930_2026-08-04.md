# CRYPTO LAB v79 — Post-hardening operational validation

Build: `7930`

Validation date: 2026-08-04

## Scanner path after `crypto-signal-register` v7

Five normal scheduled scanner cycles were inspected after the server-only registration boundary was activated.

| Started UTC | Success | Registered | Duplicates | Telegram | Raw benign history skips |
|---|---:|---:|---:|---:|---:|
| 04:15 | yes | 2 | 3 | 2 | 1 |
| 04:30 | yes | 2 | 3 | 2 | 1 |
| 04:45 | yes | 0 | 5 | 0 | 1 |
| 05:00 | yes | 1 | 4 | 1 | 1 |
| 05:15 | yes | 0 | 4 | 0 | 1 |

Edge execution evidence showed:

- `crypto-market-scanner` HTTP 200;
- `crypto-signal-register` version 7 HTTP 200 for protected scanner calls;
- `crypto-telegram-signal` HTTP 200 when a new signal was registered;
- no 401 or 403 response on the normal scanner path.

No scanner was manually invoked and no manual signal-registration test was performed.

## Benign insufficient-history normalization

A newly listed market, `SOXLB`, did not yet have the minimum 4H candle history. The scanner correctly continued, but the run log previously counted this normal market skip as a system error.

Migration `crypto_lab_scanner_benign_history_warning_normalization` added:

- `crypto_scanner_runs.skipped_history`;
- a protected pre-insert/update normalization trigger;
- separation of insufficient-history skips from actionable scanner errors;
- backfill of existing affected run logs.

After normalization, the inspected runs contain:

- `skipped_history = 1`;
- `error_count = 0`;
- `errors = []`.

The public health RPC now exposes the bounded `skipped_history` count without exposing symbols, levels, payloads, history or error text.

## Runtime logs

Recent operational Edge logs contained HTTP 200 for:

- market scanner;
- signal monitor;
- protected signal registration;
- Telegram dispatch;
- public health endpoint.

The only 401 and 400 entries in the sampled Edge log were the intentional hardening verification requests performed before this validation.

Auth logs contained no current authentication failure connected to the production path. Platform deprecation notices for legacy GoTrue group-name environment variables are Supabase-managed runtime notices and do not expose or weaken the application authorization model.

Postgres logs showed normal checkpoints and successful cron completions. No database error, panic or failed CRYPTO LAB cron entry was found in the sampled current window.

## Retention and maintenance

The daily maintenance run at `2026-08-04 03:17 UTC` completed successfully with no error.

No rows were found beyond the active automatic retention limits for:

- scanner runs: 180 days;
- registration attempts: 30 days;
- recovery attempts: 30 days;
- rate-limit events: 2 days;
- expired feature leases: 1 day;
- maintenance summaries: 180 days.

Longer-lived billing, legal, audit, AI/backtest and account-owned records remain intentionally governed by legal hold, account deletion or manual policy until the commercial and legal retention decisions are approved.

No test account remains in Supabase Auth. No email was sent during this validation block.

## Security state

- CRYPTO LAB public tables with RLS: `33 / 33`;
- CRYPTO LAB functions: `108`;
- `SECURITY DEFINER` functions: `62`;
- browser-executable public definers: `0`;
- active CRYPTO LAB cron jobs: `6 / 6`;
- Supabase Security Advisor findings: `0`.

Performance Advisor reports only informational unused-index notices on new or low-traffic tables. No missing foreign-key index warning was introduced.

## Release boundary

The working root v78 application was not changed. Registration, recovery, paid prices, checkout, provider adapters, billing webhook processing, recurring billing and refunds remain disabled.
