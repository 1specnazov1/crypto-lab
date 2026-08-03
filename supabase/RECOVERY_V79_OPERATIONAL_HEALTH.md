# CRYPTO LAB v79 — Operational health and maintenance

Applied on 2026-08-03 to Supabase project `txhzxbizjpinowepfjkm` and GitHub Pages build `7917`.

## Production boundaries

- The working v78 application was not modified.
- Public registration remains disabled.
- No test email was sent and no external test account was created.
- Registration still requires Cloudflare Turnstile site key, secret key and `CRYPTO_PUBLIC_REGISTRATION_ENABLED=true` before activation.

## Database maintenance

Migrations:

- `crypto_lab_v79_operational_maintenance`
- `crypto_lab_v79_maintenance_failure_audit`
- `crypto_lab_v79_maintenance_explicit_deny_policies`

Private table `crypto_maintenance_runs` records operational maintenance results. It has RLS enabled, explicit deny policies for `anon` and `authenticated`, and no direct client access.

Function `run_crypto_maintenance()` is executable only by `service_role` and the database scheduler. It:

- closes AI runs that remain `started` for more than 15 minutes;
- closes backtest runs that remain `started` for more than 30 minutes;
- removes expired scanner feature leases older than one day;
- removes registration-attempt audit rows older than 30 days;
- removes maintenance audit rows older than 180 days;
- persists both successful and failed maintenance outcomes.

Scheduled job:

- name: `crypto-lab-daily-maintenance`;
- schedule: `17 3 * * *`;
- active: yes.

Two deliberate manual executions completed successfully with no stale runs or expired data found.

## RLS performance

The three account-deletion policies now use `(select auth.uid())`, preventing PostgreSQL from re-evaluating `auth.uid()` for every row. The Supabase performance advisor no longer reports `auth_rls_initplan` warnings. Remaining messages are informational unused-index notices on new or empty tables; indexes were retained for expected production query patterns.

## Operational admin dashboard

New client module: `v79/admin-health.js`.

The dashboard reports:

- scanner freshness and latest success;
- signal-monitor freshness;
- WAITING, ACTIVE and CLOSED signal counts;
- stale AI and backtest run counts;
- last maintenance result;
- registration outcomes for the previous 24 hours;
- background cron job state;
- pending account-deletion requests.

The RPC `get_crypto_admin_operational_health()` requires an authenticated user and verifies the `admin` role internally before returning private operational data.

## Admin security

`v79/admin.html` was hardened:

- Content Security Policy and `no-referrer` added;
- email, profile name, plan notes, statuses and diagnostic messages are escaped before HTML rendering;
- plan and status values are allow-listed;
- downgrade to FREE requires confirmation;
- sign-in, subscription changes and summary refresh use independent concurrency guards;
- a successful plan change is followed by a real data reload.

The admin telemetry modules were corrected so MutationObserver activity no longer causes repeated RPC polling. Data loads only when the dashboard becomes visible, when the user changes the period, or when an explicit refresh is requested.

## PWA update reliability

Build `7917` adds:

- cache version `crypto-lab-v79-7917`;
- `admin-health.js` to the offline shell;
- service-worker `SKIP_WAITING` support;
- explicit update detection and an update button;
- `updateViaCache: none` and a one-time reload after controller change;
- Cloudflare challenge requests excluded from service-worker caching;
- CSP and `no-referrer` on the main app shell.

## Verification

A temporary public validator checked the deployed GitHub Pages build after propagation:

- `index.html`, `app.html`, `app-extension.js`, `service-worker.js`, `admin.html`, `admin-health.js`, `admin-telemetry.js` and `admin-ai-telemetry.js` all returned HTTP 200;
- all external JavaScript files passed syntax validation;
- the inline admin script passed syntax validation;
- build `7917`, CSP, health-module injection and cache version were confirmed;
- the validator was immediately restored to mandatory JWT.

## Supabase advisor status

The private maintenance-table warning was cleared with explicit deny policies. Remaining security advisor warnings concern intentionally callable `SECURITY DEFINER` RPCs. These functions have fixed search paths and perform internal authentication, ownership or admin-role checks. They must be reviewed again before commercial launch, but no unrestricted admin operation was identified in this review.
