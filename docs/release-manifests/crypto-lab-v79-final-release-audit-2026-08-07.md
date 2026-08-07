# CRYPTO LAB v79 — Final release-candidate audit

Date: 2026-08-07
Stable public version: v78
Commercial candidate: v79 build 7930

## Safety boundary

No mainnet payment, real transfer, public registration, paid entitlement, recurring billing, refund execution, real-user invitation, or promotion of v79 over stable v78 was activated during this audit.

## Stable v78 preservation

- Repository root `index.html` was independently re-read from `main` after the audit hardening commit.
- Git blob SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
- This exactly matches the protected v78 baseline stored in the release manifest.
- The release manifest boundary remains `v79_published_over_v78=false`.

## Candidate v79 identity

- `v79/index.html`: `b92335b3a3d76e349f1845fd653e1c1021d6d7f6`.
- `v79/app.html`: `432fe33542bf58b41bab590caf0fcf5d635f8da4`.
- `v79/commercial-extension.js`: `9d300dd2276e55ffc4ad1b8fcb60766046bba8f6`.
- Candidate remains marked as v79 preview/build 7930 and was not promoted to the repository root.

## Runtime gates verified closed

Supabase commercial flags remain false for:

- paid checkout;
- paid entitlement;
- public registration;
- recurring billing;
- refund execution;
- production launch authorization.

Account portal gates also remain closed: registration, login, recovery and portal are false. Closed beta remains `prepared_inactive`; invitations, Auth-account creation, real payments and mainnet are false. Legal publication authorization remains false.

Current live commercial data counts at audit time: Auth users 0, billing orders 0, billing events 0, on-chain claims 0, subscriptions 0, plan requests 0, support tickets 0.

## Security audit finding and repair

The final Supabase Security Advisor pass detected one `security_definer_view` ERROR, four callable SECURITY DEFINER WARN surfaces across two functions/roles, and five INFO notices for service-only RLS tables with no explicit policies.

Safe hardening applied as migration `20260807030623_final_release_candidate_security_audit_hardening`:

- `crypto_x_account_growth_deltas` set to `security_invoker=true`;
- `crypto_x_editorial_diversity_penalty` revoked from `public`, `anon`, `authenticated`, retained for `service_role`;
- `crypto_x_log_account_growth_anomaly` revoked from `public`, `anon`, `authenticated`, retained for `service_role`;
- explicit deny-all client policies added for closed-beta control tables and prelaunch monitoring snapshots;
- covering index added for `crypto_closed_beta_checklist(scenario_code)`.

Post-repair Supabase Security Advisor result: **0 lints**.

Performance Advisor has INFO-only unused-index notices. The missing covering-index notice for the closed-beta scenario foreign key was resolved. Existing unused indexes were intentionally not removed during a prelaunch release audit because the project has zero commercial traffic and there is insufficient production usage evidence to classify them as redundant.

GitHub migration commit: `6d7475a65dad242dda7a43ca62bcd3cd7e004d3f`.

## Beta release-contract result

`BETA-REL-01` is now `passed` for all 20 synthetic personas. The closed-beta matrix is now:

- passed: 60;
- blocked_external: 180;
- pending: 0.

The remaining 180 rows are intentionally blocked on owner approval and/or external execution prerequisites; none were falsely promoted to passed.

## Supabase evidence

A new `crypto_release_drift_observations` row was recorded with the v78 root SHA, current repository head, candidate application identity and non-promotion note. `BETA-REL-01` scenario/checklist evidence stores the v78 and v79 asset SHAs, closed production gate, zero security-advisor lint result and GitHub migration commit.

## Release decision

Technical release-preservation contract: PASS.
Commercial production launch: NOT AUTHORIZED.

Remaining owner/external blockers are intentionally carried forward to the final consolidation/decision package. No production activation was performed.
