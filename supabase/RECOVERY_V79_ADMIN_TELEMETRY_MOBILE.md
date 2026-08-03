# CRYPTO LAB v79 — Admin telemetry and mobile/PWA build 7913

Applied to Supabase project `txhzxbizjpinowepfjkm` and GitHub Pages build `7913` on 2026-08-03. The working v78 application was not modified.

## Commercial backtest telemetry

Migration: `crypto_lab_v79_admin_backtest_telemetry`.

The new authenticated RPC `get_crypto_admin_backtest_telemetry(days)` is restricted to the existing server-verified administrator role. It accepts a period from 1 to 90 days and returns:

- total, completed, rejected, failed and still-started runs;
- unique users and successful-run percentage;
- quota rejection count;
- average and P95 server duration;
- average trade count and average return for completed runs;
- usage grouped by tariff;
- normalized error distribution;
- repeated parameter profiles grouped by SHA-256 parameter hash;
- daily completed/rejected/failed trend;
- the latest failed or rejected runs with account email and normalized error details.

`anon` cannot execute the function. `authenticated` can invoke the RPC, but the function rejects every account whose profile role is not `admin`. `service_role` retains operational access.

## Administrator diagnostics interface

Build `7913` adds `v79/admin-telemetry.js`.

The script is injected only when the existing protected `admin.html` page is opened. It adds:

- 24-hour, 7-day, 30-day and 90-day periods;
- operational cards for success rate, active users, quota rejections and latency;
- error and rejection distribution;
- repeated configuration profiles;
- recent failed/rejected executions with safe escaped output;
- responsive layouts for desktop, tablet and mobile.

No administrator role was assigned during this block. The panel remains inaccessible until an existing account is explicitly promoted through the protected server-side role process.

## Mobile adaptation

A shared stylesheet `v79/module-mobile.css` is injected into all same-origin HTML modules opened inside the v79 terminal.

It adds:

- safe-area support for iPhone and installed PWA mode;
- 42-pixel touch targets;
- single/two-column adaptive grids;
- mobile-safe account, admin, scanner, journal, AI and backtest layouts;
- momentum table scrolling and contained horizontal overscroll;
- 16-pixel mobile form fields to prevent unwanted iOS input zoom;
- responsive account actions, tariff cards and diagnostics tables.

## PWA build

The service-worker cache was advanced to `crypto-lab-v79-7913` and now includes:

- `module-mobile.css`;
- `admin.html`;
- `admin-telemetry.js`;
- all prior server backtest, history, scanner, AI, journal, account and legal assets.

The entry point and terminal extension now load build `7913`.

## Reliability cleanup

The obsolete duplicate Edge Function `crypto-lab-v79-backtest` was retired behind mandatory JWT protection and now returns `410 ENDPOINT_RETIRED` to authenticated legacy clients. The official implementation remains `crypto-lab-v79-backtest-data`, which performs the full server calculation, quota consumption and run ledger writes.

## Verification

A temporary public validator checked 13 current v79 assets on GitHub Pages:

- every file returned HTTP 200;
- every JavaScript file parsed successfully;
- all embedded HTML scripts parsed successfully;
- the build 7913 marker was present in the entry point, app shell and extension;
- telemetry and mobile-style injection markers were present;
- the service worker contained the new cache entries.

The validator was restored to mandatory JWT protection immediately after verification.

The telemetry table currently contains no retained production runs in the selected seven-day window, so the admin dashboard correctly starts with zero metrics until users perform protected server backtests.

## Next recommended block

Instrument the protected AI advisor with the same commercial telemetry pattern: request ledger, success/failure latency, token/cost accounting, structured response quality checks, quota rejections and an administrator-only diagnostics panel. Then harden the AI prompt and response schema before commercial launch.
