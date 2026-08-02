# CRYPTO LAB v79 — Auth, profiles and plans recovery

Applied to Supabase project `txhzxbizjpinowepfjkm` on 2026-08-02 through migration `crypto_lab_v79_auth_profiles_plans`.

## Public tables

- `crypto_plan_limits` — technical limits for FREE / BASIC / PRO.
- `crypto_user_profiles` — display name, language, timezone and protected role.
- `crypto_subscriptions` — plan, status, provider identifiers and billing period.
- `crypto_user_usage_daily` — daily AI, backtest and scanner counters.
- `crypto_user_favorites` — per-user favorite symbols.
- `crypto_user_portfolio` — server-side portfolio assets.

All user tables use RLS. Authenticated users can only read or modify their own profile, favorites and portfolio. A browser cannot change its own subscription or role.

## Functions

- `handle_new_crypto_user()` — creates FREE profile/subscription after insertion into `auth.users`.
- `crypto_effective_plan(uuid)` — resolves the active plan, otherwise FREE.
- `get_my_crypto_account()` — returns profile, subscription, limits, today's usage and item counts for `auth.uid()`.
- `consume_crypto_feature(text)` — atomically consumes `ai`, `backtest` or `scanner` quota.
- `enforce_crypto_item_limit()` — enforces portfolio/favorites plan limits on insert.

## Default technical limits

| Plan | AI/day | Backtests/day | Scanner/day | Portfolio | Favorites |
|---|---:|---:|---:|---:|---:|
| FREE | 3 | 3 | 10 | 5 | 10 |
| BASIC | 30 | 20 | 100 | 50 | 100 |
| PRO | unlimited | unlimited | unlimited | unlimited | unlimited |

`-1` means unlimited. Commercial pricing is deliberately not hard-coded yet.

## Frontend

- Public page: `v79/account.html`
- Supabase URL: `https://txhzxbizjpinowepfjkm.supabase.co`
- Only the public/publishable browser key is included in frontend code.
- Email signup is enabled; email confirmation is required.
- The account screen supports login, signup, password recovery, profile settings, plan/usage display and local ↔ cloud portfolio transfer.

## Verified tests

A temporary Auth user was inserted directly in a database test and then deleted. The trigger created an EN profile and FREE subscription. `get_my_crypto_account()` returned the expected profile, plan and limits. Four consecutive FREE AI quota calls returned `allowed=true` for calls 1–3 and `allowed=false` for call 4. Cascading cleanup removed profile, subscription and usage rows.

Do not store service-role keys, payment secrets or provider webhook secrets in this repository.