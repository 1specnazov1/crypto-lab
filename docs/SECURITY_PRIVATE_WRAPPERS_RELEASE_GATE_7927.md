# CRYPTO LAB v79 — Private RPC wrappers and release gate hardening

Application build: `7927`

Implemented on 2026-08-03 for Supabase project `txhzxbizjpinowepfjkm` and the isolated `v79` GitHub Pages application. The working v78 root application was not modified.

## Public RPC security boundary

Migration: `crypto_lab_v79_support_commercial_private_wrappers`.

The remaining browser-callable `SECURITY DEFINER` functions were moved to the `private` schema. Their public API names remain compatible with the existing v79 frontend, but the public functions are now `SECURITY INVOKER` SQL wrappers.

Converted functions:

- `admin_update_crypto_support_ticket(...)`;
- `cancel_my_crypto_plan_request()`;
- `create_crypto_support_ticket(...)`;
- `get_crypto_admin_support()`;
- `get_my_crypto_commercial_state()`;
- `get_my_crypto_support_tickets()`;
- `reply_crypto_support_ticket(...)`.

The privileged implementations:

- have fixed search paths;
- derive ownership from `auth.uid()`;
- perform admin-role or ownership checks internally;
- deny execution to `anon` and the generic `public` role;
- allow only `authenticated` and `service_role` where required.

After the migration, every listed public wrapper reports `security_definer = false`, while only the private implementation reports `security_definer = true`.

The Supabase Security Advisor reports zero security lints after this conversion.

## Plan-request cancellation defect

The wrapper smoke test exposed an existing status mismatch:

- the cancellation function wrote `cancelled`;
- the database constraint permits `canceled`.

Migration: `crypto_lab_v79_plan_request_cancel_status_fix`.

The function now writes the valid canonical status `canceled`.

## Transactional verification

A rollback-only test used two local Auth rows without email delivery:

- a regular user created a Technical support ticket;
- the user retrieved only their own support history;
- the commercial-state wrapper returned legal documents and the unchanged price catalog;
- the pending BASIC request was canceled successfully;
- the user added a second support message;
- an admin retrieved the support queue;
- the admin set the ticket to `resolved`, priority `high`, and added an admin response.

Final in-transaction state:

- ticket status: `resolved`;
- priority: `high`;
- message count: `3`;
- plan-request status: `canceled`.

The transaction was rolled back. No test support ticket or test Auth user remained, and no email was sent.

## GitHub Actions release gate

The previous workflow contained obsolete hard-coded build `7907` checks and generated repeated failed notifications even though later builds were valid.

The workflow `.github/workflows/v79-preview-validation.yml` now:

- runs on pushes, pull requests and manual dispatch;
- extracts the active build from `v79/index.html`;
- verifies the same build in the app shell, commercial extension and service-worker cache;
- checks syntax for every top-level v79 JavaScript file and every inline script;
- parses the PWA manifest;
- verifies all required application modules;
- checks local HTML references;
- checks every service-worker shell entry;
- scans deployable v79 assets for server-secret identifiers and secret-key formats;
- uses concurrency cancellation and a ten-minute timeout.

The first dynamic-gate run correctly identified two obsolete marker assumptions. Those assumptions were replaced with markers used by the current server-backtest and billing-dashboard modules.

Verified GitHub Actions result:

- workflow: `Validate v79 Preview`;
- run ID: `30851213188`;
- commit: `eb489747bd5fa8f9a92f26e5852ce9d064286b07`;
- event: `push`;
- conclusion: `success`;
- completed at: `2026-08-03T20:39:59Z`.

## Commercial boundaries retained

This block did not:

- configure BASIC or PRO prices;
- enable the billing webhook;
- add merchant credentials;
- activate public registration or password recovery;
- send email;
- publish v79 over v78.

BASIC and PRO remain unconfigured and inactive. Turnstile and payment-provider business decisions are still required before the corresponding production features can be enabled.
