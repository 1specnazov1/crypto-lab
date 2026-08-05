# CRYPTO LAB v79 — Full Launch Control (build 7930)

## Purpose

This control plane converts the remaining public-launch work into one dependency-aware registry. It does not activate registration, recovery, prices, payments, or publication over v78.

## Scope

The registry contains 16 requirements with a total weight of 100 across five phases:

- identity: Turnstile, mail relay, real admin, registration/recovery E2E;
- commercial: BASIC/PRO pricing, provider choice, merchant credentials, refund policy, sandbox E2E;
- reliability: managed backup/PITR and restore rehearsal;
- validation: physical iOS/Android review, controlled beta, beta/UX fixes;
- release: explicit v79 publication decision and final launch smoke.

## Initial state

- full-launch progress: 0/100;
- remaining requirements: 16;
- user decisions: 5;
- external configuration items: 4;
- physical validation items: 3;
- technical beta score: 100/100;
- paid public launch score: 60/100.

The 0/100 value measures only the final external launch program. It does not replace the already achieved technical score.

## Security boundary

- table RLS is enabled;
- an explicit restrictive deny policy blocks direct table access;
- anon and authenticated roles have no table privileges;
- the browser has no write RPC;
- authenticated admins have a read-only wrapper;
- state changes use a service-only function;
- decision and evidence JSON reject sensitive key names;
- Turnstile, mail, merchant and webhook secrets are never stored in this registry;
- updates are recorded by the existing protected admin audit contour.

## Automatic behavior

The snapshot automatically detects and verifies:

- active BASIC and PRO prices;
- a verified payment provider with checkout and webhook enabled;
- existence of a real admin profile.

Dependencies automatically keep downstream work blocked until prerequisites are verified. The existing launch-readiness RPC now returns dynamic blockers, decision queue, external-input queue and physical-action queue from this registry.

## User-intervention rule

Autonomous work continues whenever a task does not need a business choice, external secret, owned mailbox, paid infrastructure confirmation, real physical device, beta participant, or approval to publish v79 over v78.

The owner is asked only when a decision becomes actionable. Sensitive values must be entered only into the appropriate provider or Supabase secret interface, never into the launch registry or public repository.

## Validation evidence

- migration `20260805061231` — registry, dependency snapshot, safe update service, admin read wrapper and audit;
- migration `20260805061540` — dynamic integration with launch readiness;
- migration `20260805061806` — explicit restrictive RLS deny policy;
- secret-key rejection probe: passed, no row changed;
- ordinary-user access probe: denied with SQLSTATE 42501;
- Security Advisor: zero findings after explicit policy;
- launch-control manifest requirements: 16 unique codes, total weight 100;
- GitHub Launch Control gate: run `30981154314`, success;
- GitHub Pages: run `30981153904`, success;
- stable v78 root SHA remains `4a278c891d37b3760ec1ac988690ea9ad587b24e`.
