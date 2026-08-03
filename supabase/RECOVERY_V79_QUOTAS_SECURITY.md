# CRYPTO LAB v79 — Quota enforcement and security hardening

Applied to Supabase project `txhzxbizjpinowepfjkm` and GitHub Pages build `7910` on 2026-08-03.

## Backtest quota enforcement

- `v79/backtest.html` is now the public quota gate.
- A signed-in account is required before the backtest engine is loaded.
- Every official backtest run calls `consume_crypto_feature('backtest')` before execution.
- FREE allows 3 daily runs, BASIC 20, and PRO is unlimited according to `crypto_plan_limits`.
- The original client backtest implementation was moved to `v79/backtest-engine.html`.
- The main terminal routes the Backtest menu to the quota gate.
- PWA cache build `7910` includes both the gate and engine.
- `crypto-lab-v79-backtest-data` remains protected by JWT and also consumes the server quota when used.

## Database security migration

Migrations:

- `crypto_lab_v79_security_hardening`
- `crypto_lab_v79_public_catalog_invoker`
- `crypto_lab_v79_rls_and_index_optimization`
- `crypto_lab_v79_explicit_private_rls`

Changes:

- Browser roles can no longer execute `register_crypto_signal`, `crypto_effective_plan`, `handle_new_crypto_user`, or `enforce_crypto_item_limit` directly.
- `register_crypto_signal` remains executable by `service_role` for the protected registration Edge Function.
- `set_crypto_updated_at()` now has a fixed `search_path=public`.
- `get_crypto_billing_catalog()` now runs as `SECURITY INVOKER`; its source tables have public read-only RLS policies.
- Private server tables now have explicit deny policies for `anon` and `authenticated`: billing events, feature leases, scanner telemetry, and signal-monitor state.
- RLS policies use `(select auth.uid())` so the user ID is initialized once per query instead of once per row.
- Covering indexes were added for billing-order user/plan foreign keys, plan-request plan keys, and subscription plan keys.

## Advisor status

Security advisor findings now contain only intentional authenticated `SECURITY DEFINER` RPCs. These functions are part of the public application API and validate `auth.uid()`, plan ownership, or the protected admin role internally.

Performance advisor findings now contain only unused-index informational notices. Newly added foreign-key indexes have not accumulated production usage yet and must not be removed based only on this early notice.

## Verification

- `anon` and `authenticated` cannot execute `register_crypto_signal`.
- `service_role` can execute `register_crypto_signal`.
- `anon` cannot execute `crypto_effective_plan`.
- authenticated users cannot call trigger-only `handle_new_crypto_user`.
- `set_crypto_updated_at` reports `search_path=public`.
- Direct unauthenticated invocation of `crypto-lab-v79-backtest-data` returns HTTP 401.
- Public validator checked index, app shell, extension, service worker, backtest gate, backtest engine, scanner, AI, journal and account pages: all returned HTTP 200 and all embedded/external JavaScript parsed without syntax errors.
- The validator was restored to mandatory JWT protection after the test.

## Remaining architectural limitation

The current backtest calculation itself still runs in the browser. The official application flow enforces account quotas, but strong anti-tamper enforcement requires moving the full calculation to a protected server function. This should be completed before a high-value commercial launch.

The working v78 root application was not modified.
