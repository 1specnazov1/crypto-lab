# CRYPTO LAB v79 — Commercial continuation audit

Date: 2026-08-07
Candidate: v79 build 7930
Stable public version: v78
Status: PRELAUNCH / OWNER-GATED

## Executive result

Autonomous preparation has advanced to the safe external-dependency boundary. No production activation was performed.

Verified invariants:
- stable root v78 `index.html` blob SHA remains `4a278c891d37b3760ec1ac988690ea9ad587b24e`;
- v79 remains a separate candidate;
- public registration is disabled;
- paid checkout and paid entitlement are disabled;
- mainnet payment execution is disabled;
- recurring billing is disabled;
- refund execution is disabled;
- Auth users: 0;
- active on-chain prices: 0;
- active receiving addresses: 0;
- production invoices/claims/observations: 0;
- no real beta users or invitations were created.

## 1. Testnet payment contour

Both owner-controlled sandbox sender addresses remain verified and sandbox-only.

Ethereum Sepolia sender:
`0x4eadfbe9665265527e9a5d6bde6fb15a70f05555`

Latest read-only probes:
- native Sepolia ETH balance request `20331`: zero;
- Circle Sepolia USDC balance request `20332`: zero.

Solana Devnet sender:
`4XErSn1UpvFaULFXVK6GY8nLULKLJKi2d6qtSFpJVPJ4`

Latest read-only probes:
- native Devnet SOL request `20334`: zero;
- Circle Devnet USDC token-account request `20335`: no funded token account;
- authorized 0.1 test SOL `requestAirdrop` request `20336`: HTTP 429, daily faucet limit reached or faucet dry.

The approved exact transfer templates remain prepared for two transfers of `0.01 testnet USDC` only. No transaction was signed or broadcast. Circle funding still requires human reCAPTCHA; final outgoing transfers require owner-wallet signatures. No rate-limit bypass or secret-key route is permitted.

## 2. Production RPC/indexer preparation

Public read-only network identity smoke checks succeeded without enabling production profiles:
- Ethereum mainnet PublicNode request `20303`: chain ID 1 matched;
- Solana mainnet request `20304`: genesis hash `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d` matched;
- TRON mainnet request `20305`: HTTP 200/current mainnet block returned.

All production verifier profiles remain `enabled=false` / inactive. Dedicated production-grade Ethereum RPC, Solana RPC and TRON/TronGrid configuration/API credentials remain external deployment inputs and are not inferred from public smoke endpoints.

## 3. Security hardening

A new post-night security drift was found and corrected: two newly introduced X `SECURITY DEFINER` functions had public/anon execution exposure.

Supabase migrations:
- `20260807070238_revoke_public_execute_from_new_x_security_definers`;
- `20260807070257_remove_public_execute_from_x_admin_security_definers`.

Both migrations are synchronized to GitHub. Final Supabase Security Advisor result after all new DDL: zero security lints.

A later legal-evidence policy/index conflict was also detected through the performance advisor and reconciled. Performance advisor now contains only expected `unused_index` informational notices under prelaunch/zero-user load; the legal-table duplicate-index and multiple-permissive-policy warnings were removed.

## 4. Legal source and acceptance evidence

Current Ukrainian-source preflight is recorded at:
`docs/legal/crypto-lab-v79-legal-source-preflight-2026-08-07.md`.

The pre-existing `document_key` + `document_version` legal acceptance model was reconciled and hardened instead of maintaining a second incompatible recorder.

Authoritative migration:
`20260807073902_reconcile_and_harden_legal_acceptance_contract`.

Current recorder:
`public.service_accept_crypto_legal(...)` — service-role only, requires an existing Auth user and an active legal document version, accepts only hashed technical evidence, and preserves first acceptance on duplicate submissions.

Commercial `2026-08-07-draft1` Terms/Privacy/Refund/Risk documents remain inactive. Operator legal identity, registration details if applicable, legal address, support/privacy contacts, governing law, served-market review and final legal review remain external blockers. No operator details were fabricated.

## 5. Closed beta readiness

Reporting bug fixed in:
`20260807072931_fix_closed_beta_readiness_scenario_metrics`.

Current beta readiness:
- mode: `prepared_inactive`;
- target users: 10–20;
- synthetic personas: 20;
- total prepared scenarios: 12;
- passed scenarios: 3;
- blocked-external scenarios: 9;
- failed scenarios: 0;
- checklist items: 240;
- executed/passed checklist items: 60;
- Auth users: 0;
- invitations enabled: false;
- auth accounts enabled: false;
- real payments enabled: false;
- mainnet enabled: false;
- safe_to_prepare: true.

The remaining scenarios require external Auth/Turnstile/mail setup, physical devices, real test identities and/or owner-wallet actions. No real-user beta was started because registration activation remains separately owner-gated.

## 6. Platform security and backup

GitHub/Supabase account-level 2FA cannot be proven from the connected project/database APIs and therefore remains an external UI verification item; it is not marked complete.

The project evidence records the current Supabase deployment as Free with no completed production backup artifact and no restore rehearsal. The encrypted logical-backup and isolated-restore runbooks/scripts already exist, but executing a real off-site restore requires an approved secure target/credentials or an approved paid managed-backup/PITR plan. No paid plan or cost-incurring resource was created autonomously.

## 7. Monitoring and logs

Prelaunch monitor snapshot `id=20`, 60-minute window:
- operational requests: 0;
- operational failures/5xx/429: 0;
- open incidents: 0;
- billing orders/events: 0;
- billing anomalies: 0;
- on-chain claims: 0;
- registration attempts: 0;
- recovery attempts: 0;
- risky admin actions: 0;
- suspicious score: 0;
- status: `clean`.

Auth logs returned no events. Recent API/Edge logs are dominated by the separate Crypto Lab X automation and show successful HTTP 200/201 activity; no commercial auth/payment activation was observed in the prelaunch snapshot.

## 8. CI and repository integrity

Security/legal reconciliation commit:
`3006d70616a36f5554e9803029f3ff0a26ff87ab`.

GitHub Actions for that commit completed successfully for:
- Validate v79 Preview;
- Validate v79 Release Manifest Contract;
- Pages/deployment path.

The subsequent legal-preflight documentation commit did not alter application/runtime code. Stable v78 root SHA remains unchanged.

## Remaining unavoidable external actions

1. Fund the two sandbox senders with test native gas and Circle test USDC; owner signs the exact two approved 0.01 testnet-USDC transfers.
2. Select/provide dedicated production RPC/indexer configuration, including TRON/TronGrid credentials, while keeping activation off until owner approval.
3. Supply actual operator/legal/contact/jurisdiction information and complete final legal review.
4. Verify GitHub and Supabase owner 2FA in their account UIs.
5. Approve a backup strategy/cost boundary and execute a real off-site backup + isolated restore rehearsal.
6. Configure Turnstile and mail relay and designate an owned Auth admin before Auth E2E.
7. Perform physical iPhone/Android PWA validation and then separately authorize the 10–20-user closed beta.
8. Only after successful beta/fixes: separately decide real payments, public registration, BASIC/PRO activation, v79 promotion and commercial launch date.

## Release boundary

Technical prelaunch preparation: ADVANCED / EXTERNAL DEPENDENCIES REMAIN.
Closed beta: PREPARED BUT NOT AUTHORIZED/STARTED.
Commercial production: NOT READY / NOT AUTHORIZED.
Stable v78: MUST REMAIN UNCHANGED until explicit owner publication decision.
