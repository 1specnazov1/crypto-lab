# CRYPTO LAB v79 — Billing and admin foundation

Applied to Supabase project `txhzxbizjpinowepfjkm` on 2026-08-02 through migration `crypto_lab_v79_billing_admin_foundation`.

## Tables

- `crypto_plan_prices` — provider-neutral catalog. FREE is active at 0 USD; BASIC and PRO prices remain intentionally unconfigured until commercial pricing and a payment provider are approved.
- `crypto_plan_requests` — authenticated users can create one pending BASIC/PRO request.
- `crypto_billing_orders` — future checkout/order records. Users can only read their own orders.
- `crypto_billing_events` — private idempotent webhook/admin event log; no browser access.

## RPC functions

- `get_crypto_billing_catalog()` — public catalog with plan limits and prices.
- `request_crypto_plan(plan, note)` — creates or updates the caller's pending plan request.
- `get_crypto_admin_summary()` — protected user/plan/request summary; requires `crypto_user_profiles.role = admin`.
- `admin_set_crypto_subscription(...)` — protected plan/status/period update with event logging and optional request approval/rejection.
- `crypto_is_admin()` — server-side admin predicate; not executable by public roles.

## Frontend

- `v79/account-actions.js` adds BASIC/PRO request buttons to the authenticated account screen.
- `v79/admin.html` is a protected subscription administration panel. Server RPCs reject non-admin users even if they open the URL directly.

## Verification

Temporary admin and user Auth rows were created and deleted. The user successfully requested BASIC. The admin RPC approved BASIC for 30 days. `get_my_crypto_account()` resolved BASIC and its 30 AI/day limit. The admin summary showed the expected plan counts and no remaining pending request. Cascading deletion removed all temporary rows.

No payment price, provider secret or checkout implementation is hard-coded. A provider-specific Edge Function and webhook should only be added after provider and prices are approved.