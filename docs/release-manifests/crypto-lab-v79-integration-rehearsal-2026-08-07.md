# CRYPTO LAB v79 — Integration rehearsal evidence

Date: 2026-08-07
Stable public version: v78
Commercial candidate: v79 build 7930

## Safety boundary

No public registration, real payment, mainnet transaction, paid entitlement, recurring billing, refund execution, real-user invitation, or v79 production promotion was activated.

## Executed offline integration checks

1. Registration/account preflight
   - `crypto_account_portal_config`: `registration_enabled=false`, `login_enabled=false`, `recovery_enabled=false`, `portal_enabled=false`.
   - commercial runtime flags remain false, including `public_registration_enabled=false` and `production_launch_authorized=false`.
   - unauthenticated account/support/subscription RPC guards rejected access.

2. Billing duplicate protection
   - a synthetic `crypto_billing_events` provider event was inserted inside an explicit transaction;
   - a second event with the same `(provider, provider_event_id)` was rejected by the unique guard;
   - the transaction was rolled back;
   - `crypto_billing_events` remained at 0 rows after the rehearsal.
   - BASIC price verified as USD 20/month inactive; PRO verified as USD 49/month inactive.

3. Signal + notification outbox
   - a synthetic signal and ENTRY notification were inserted inside an explicit transaction;
   - duplicate `(signal_id,event_type)` notification insertion was rejected;
   - the transaction was rolled back;
   - no synthetic signal/outbox rows remained after the rehearsal.

4. Support
   - unauthenticated support-ticket creation was rejected;
   - no support ticket or message was created;
   - full ownership/cross-user support testing remains blocked until owner-authorized isolated beta auth identities exist.

## Critical issue found and fixed

The public registration and recovery Edge Functions had environment-variable gates, but their database reservation RPCs did not independently enforce the owner-controlled database gates. An accidental environment toggle could therefore have reached the Auth link-generation path without a database-level fail-closed owner gate.

Fix applied in Supabase migration `harden_auth_reservations_owner_gate` and mirrored in GitHub migration `supabase/migrations/20260807020000_harden_auth_reservations_owner_gate.sql`:

- `reserve_crypto_registration_attempt` now returns `allowed=false` unless all of these are true:
  - `crypto_commercial_runtime_flags.public_registration_enabled`;
  - `crypto_commercial_runtime_flags.production_launch_authorized`;
  - `crypto_account_portal_config.registration_enabled`.
- `reserve_crypto_recovery_attempt` now returns `allowed=false` unless `crypto_account_portal_config.recovery_enabled=true`.
- both RPCs remain service-role only.
- disabled calls do not create registration/recovery attempt rows.

Post-fix verification returned:
- registration: `allowed=false`, `reason=registration_disabled`, `owner_gate=true`;
- recovery: `allowed=false`, `reason=recovery_disabled`, `owner_gate=true`;
- registration/recovery attempt row counts unchanged.

## Closed-beta matrix state

- `BETA-AUTH-01`: passed (20/20 matrix rows, offline contract).
- `BETA-SEC-01`: passed (20/20 matrix rows, offline contract).
- auth/account/billing/signal/notification/support/cancellation executable scenarios: marked `blocked_external`, not falsely marked passed.
- blockers: explicit owner approval, isolated beta Auth identities, and wallet signature/testnet settlement where applicable.
- `BETA-REL-01` remains pending for the final release audit block.

## GitHub evidence

Migration commit: `116d8bea2cd1d4ffa19517cbaed28696b990a7c4`.
