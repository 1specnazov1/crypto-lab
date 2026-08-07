# CRYPTO LAB v79 — Closed Beta Runbook (prepared, inactive)

Prepared: 2026-08-07
Stable public version: v78
Commercial candidate: v79 build 7930

## Safety state

This runbook prepares a closed commercial beta only. It does **not** authorize or activate public registration, real payments, mainnet transaction execution, paid entitlements, recurring billing, refunds, or promotion of v79 over v78.

Required before any executable beta step:
- explicit owner approval for the closed beta activation;
- test-only auth accounts created after approval;
- wallet signature only for testnet payment scenarios;
- no seed phrases/private keys/passwords shared with automation;
- real users are invited only after owner approval.

## Prepared synthetic participant slots

20 non-deliverable persona reservations are stored in Supabase as `beta-01` … `beta-20` using the reserved `.invalid` domain. They are not `auth.users` accounts and are not real people.

Plan distribution for rehearsal coverage:
- slots 01–06: FREE;
- slots 07–13: BASIC target ($20/month candidate, inactive);
- slots 14–20: PRO target ($49/month candidate, inactive).

## Scenario matrix

1. `BETA-AUTH-01` — registration gate remains closed before owner approval.
2. `BETA-AUTH-02` — signup/login/recovery closed-mode contract after owner approval.
3. `BETA-ACCT-01` — authenticated account snapshot, plan and access-end display.
4. `BETA-BILL-01` — BASIC $20 sandbox invoice + one testnet settlement + one entitlement transition.
5. `BETA-BILL-02` — PRO $49 sandbox invoice + one testnet settlement + one entitlement transition.
6. `BETA-BILL-03` — duplicate testnet transaction replay must not double-credit.
7. `BETA-SIG-01` — signal registration and monitor lifecycle idempotency.
8. `BETA-NOTIFY-01` — notification outbox deduplication without contacting real recipients.
9. `BETA-SUPPORT-01` — support ticket ownership and cross-user denial.
10. `BETA-CANCEL-01` — period-end cancellation without recurring debit.
11. `BETA-SEC-01` — anonymous/authenticated denial for service-only beta controls.
12. `BETA-REL-01` — v78 root preservation and v79 non-publication.

The Supabase execution matrix contains 20 × 12 = 240 pending checklist items. `pending` means prepared only; it is not evidence that a test has been executed.

## Entry criteria for executable closed beta

- owner approval recorded;
- testnet payment prerequisites available where required;
- test auth can be enabled for the closed cohort without public registration;
- Turnstile/mail relay prerequisites resolved if the selected auth flow needs them;
- no critical open security incident;
- production commercial flags remain false unless a separately authorized beta flag is introduced.

## Exit criteria

- all mandatory scenarios executed for the selected 10–20-user cohort;
- no critical defects open;
- duplicate-credit protection verified;
- account isolation and support isolation verified;
- signal and notification flows verified;
- cancellation lifecycle verified;
- commercial activation remains off until a separate launch decision.
