# CRYPTO LAB v79 — Launch-readiness scorecard

Build: `7930`

Assessment date: 2026-08-04

This scorecard separates automated technical beta readiness from readiness for a public paid launch. The score does not override mandatory business, legal, merchant, backup-plan or physical-device decisions.

## Current scores

| Contour | Score | Decision |
|---|---:|---|
| Automated technical beta readiness | 100 / 100 | Technical beta candidate |
| Public paid launch readiness | 60 / 100 | Blocked |
| Public registration and recovery | Disabled | Blocked by design |
| Production payments | Disabled | Blocked by design |

## Automated technical score

| Gate | Weight | Result | Evidence |
|---|---:|---|---|
| UI, responsive shell, PWA and accessibility | 20 | Pass | Chromium profiles 390×844, 412×915 and 1440×900; 15/15 tests passed in run `30859406451`. |
| Database row-level security | 20 | Pass | All 33 CRYPTO LAB public tables use RLS. |
| Scheduled operations | 15 | Pass | Six of six CRYPTO LAB cron jobs are active and the latest recorded invocation of every job succeeded. |
| Scanner and monitor freshness | 15 | Pass | Five normal scanner cycles after the v7 server-only registration boundary completed successfully; protected registration and Telegram dispatch returned HTTP 200. |
| Account, privacy and administrative controls | 15 | Pass | Session security, user export, deletion workflow, support workflow and protected administrative audit are present. |
| Billing state integrity | 10 | Pass | No billing orders, pending billing events or unresolved billing anomalies exist before payment activation. |
| Release and rollback controls | 5 | Pass | Dynamic GitHub release gate, Playwright smoke suite, server validator, release checkpoints and rollback checklist exist. |

The 100/100 score means the currently automated non-commercial beta checks pass. It does not mean a public paid launch is authorized.

## Paid-launch blockers

1. `PAID_PRICES_REQUIRED` — approve BASIC and PRO amounts, currency and monthly or yearly billing interval.
2. `PAYMENT_PROVIDER_REQUIRED` — choose LiqPay or Stripe and complete merchant sandbox verification.
3. `TURNSTILE_REQUIRED` — install Cloudflare Turnstile site and secret keys before registration and password recovery can be enabled.
4. `REFUND_POLICY_REQUIRED` — approve refund, chargeback, cancellation and failed-renewal rules.
5. `MANAGED_BACKUP_CONFIRMATION` — confirm Supabase managed backup and point-in-time recovery coverage available under the selected plan.
6. `PHYSICAL_DEVICE_REVIEW` — complete a manual visual and interaction review on physical iOS and Android devices.
7. `MAIL_RELAY_CONFIGURATION` — install `CRYPTO_MAIL_RELAY_URL` and `CRYPTO_MAIL_RELAY_PUBLISHABLE_KEY` before email-enabled registration can be activated.

## Commercial safety state

- BASIC and PRO price records exist but are inactive and have no amount.
- LiqPay, Stripe and manual adapters are `disabled / draft`.
- Checkout, webhook processing, recurring billing and refunds are disabled.
- The normalized billing webhook remains unavailable until a secret of adequate length is installed.
- Registration and password recovery remain disabled.
- The disabled publisher still returns HTTP 410 and cannot replace v78.

## Public Edge safety state

- `crypto-signal-register` version 7 accepts only the service-role or protected monitor-secret server paths; the public publishable-key browser path was removed.
- `crypto-lab-v79-preview` version 5 exposes health-only counters and freshness data. Signal rows, trade levels, class-A payloads, history and error text are not public.
- `crypto-lab-v79-chart` version 2 is retired and requires JWT; the supported chart is the versioned GitHub Pages module.
- Registration and billing webhook functions remain unauthenticated only at the platform level because they implement explicit origin/secret controls and remain disabled until external configuration is complete.

## Scanner operational normalization

- Five scheduled scanner cycles after the `crypto-signal-register` v7 change succeeded.
- Registered signals and Telegram notifications matched: `2/2`, `2/2`, `0/0`, `1/1`, `0/0`.
- No 401 or 403 occurred on the normal scanner path.
- Insufficient 4H history for a newly listed market is now recorded as `skipped_history`, not as a system error.
- The affected recent run logs now report `error_count = 0` while retaining the bounded skip count.

## Security inventory

- 33 of 33 CRYPTO LAB public tables use RLS.
- 108 CRYPTO LAB functions exist across public and private schemas.
- 62 functions use `SECURITY DEFINER` for server-side boundaries.
- No public `SECURITY DEFINER` function is directly executable by `anon` or `authenticated` roles.
- Supabase Security Advisor reports zero security lints.
- Performance Advisor reports only informational unused-index notices on new or low-traffic tables.

## Scheduled operations

| Job | Schedule | Latest recorded state |
|---|---|---|
| Signal monitor | Every minute | Succeeded |
| Market scanner | Every 15 minutes | Succeeded |
| Subscription lifecycle | Every 15 minutes | Succeeded |
| Billing event retry | Every 5 minutes | Succeeded |
| Billing reconciliation | At minute 7 each hour | Succeeded |
| Maintenance | 03:17 daily | Succeeded |

## Retention evidence

- Daily maintenance completed successfully at `2026-08-04 03:17 UTC`.
- No scanner, registration, recovery, rate-event, feature-lease or maintenance row was found beyond its automatic retention limit.
- No test user remains in Supabase Auth.
- No email was sent during the post-hardening validation block.

## Release evidence

- Browser/PWA/accessibility/offline smoke: run `30859406451` — success, 15 tests passed.
- Dynamic release gate: run `30859439388` — success.
- Public build-7930 assets were fetched after deployment and returned HTTP 200 with matching build markers.
- The immutable final GitHub Pages deployment run is recorded in the protected release checkpoint.
- Server validator: version 61, synchronized to build 7930.
- Public health endpoint verification: HTTP 200, `public_surface: health_only`, empty signal/history arrays, bounded `skipped_history` metric.
- Browser publishable-key signal-registration attempt: HTTP 401.
- Protected monitor-secret validation path: authenticated and rejected an invalid symbol with HTTP 400 before insert.
- Retired duplicate chart endpoint: unauthenticated HTTP 401.
- Post-hardening operational evidence: `docs/OPERATIONAL_VALIDATION_7930_2026-08-04.md`.
- Root v78 SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`.

## Decision

Build 7930 is a technical beta candidate only. Do not enable public registration, recovery or payments until every paid-launch blocker has an owner, approved evidence and a completed release checkpoint.
