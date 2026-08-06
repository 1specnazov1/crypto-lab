# CRYPTO LAB — commercial prelaunch security audit

Audit time: 2026-08-07 02:00–03:00 Europe/Kyiv.

## Verified

- Supabase Security Advisor after hardening: 0 lints.
- All public `crypto_*` base tables have RLS enabled.
- Seven service-only configuration/readiness tables now have explicit restrictive deny policies for `anon` and `authenticated`.
- `crypto_x_growth_discoverability_performance` is `security_invoker` and unavailable to `anon`/`authenticated`.
- Nine closed-prelaunch/internal SECURITY DEFINER RPCs are unavailable to `anon`/`authenticated` and remain service-only.
- All 59 admin RPC functions across `public`/`private` are unavailable to `anon` and `authenticated`; `service_role` retains execution.
- `crypto_admin_audit_log` has RLS and explicit deny policies for API roles.
- Auth users: 0. MFA factors: 0. No browser admin principal exists yet.
- Paid checkout, paid entitlement, public registration, recurring billing, refund execution and production launch authorization remain false.
- BASIC and PRO prices remain inactive. The only active price is FREE/USD/month = 0.
- Active paid subscriptions: 0. Production on-chain invoices: 0.

## External blockers

1. Owner/platform 2FA cannot be proven from the database. Before an admin browser surface is enabled, verify 2FA on the owner accounts used for Supabase and GitHub and create the intended authenticated admin identity.
2. Supabase platform backup/PITR status is not exposed by the currently connected management actions. Verify backup retention/PITR in the Supabase project dashboard before commercial launch and perform a restore rehearsal before production authorization.

## Changes

- `20260806230634_harden_commercial_security_surface.sql`
- `20260806230806_lock_commercial_admin_surface_prelaunch.sql`

No mainnet payments, real transfers, public registration, paid tariffs, refunds, or publication of v79 over stable v78 were activated by this audit.
