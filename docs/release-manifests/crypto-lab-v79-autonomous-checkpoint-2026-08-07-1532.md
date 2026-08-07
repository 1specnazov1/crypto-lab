# CRYPTO LAB v79 — Autonomous checkpoint

Timestamp: 2026-08-07 15:32 Europe/Kyiv
Candidate: v79 build 7930
Stable public version: v78

## Completed in this cycle

- Mainnet RPC health probe upgraded to version 2 with primary/fallback endpoint support for Ethereum, Solana and TRON.
- Health probe remains JWT + admin only, read-only, and records safe historical health evidence without exposing endpoint URLs or API keys.
- Mainnet profile metadata now contains primary/fallback secret names only; no secret values were installed and all mainnet profiles remain disabled.
- Billing review confirmed existing authoritative paid-subscription activation guard. A temporary redundant guard was added during audit and immediately removed; the stronger existing guard remains authoritative.
- Registration Edge Function upgraded to version 6 and now requires the exact commercial legal set: Terms, Privacy, Refund, Risk.
- Registration readiness external probe request 21281 returned HTTP 200 with enabled=false, feature_flag=false, turnstile=false, mail_relay=false and legal_documents=false. The active legal set currently contains only the old Terms/Privacy/Risk versions, so commercial registration cannot activate accidentally.
- Recovery flow was re-audited: it remains disabled, Turnstile/mail gated, and email-enumeration safe.
- Closed beta expanded with three passed offline contract checks: full legal-set registration gate, paid entitlement runtime hard gate, and mainnet RPC primary/fallback contract.

## Current closed beta readiness

- mode: prepared_inactive
- target users: 10–20
- synthetic personas: 20
- scenarios: 15 total
- passed scenarios: 6
- blocked external scenarios: 9
- failed scenarios: 0
- checklist rows: 300
- executed checklist rows: 120
- Auth users: 0
- invitations enabled: false
- auth accounts enabled: false
- real payments enabled: false
- mainnet enabled: false
- safe_to_prepare: true

## Security / production boundaries

Supabase Security Advisor: 0 security lints.
Prelaunch monitor snapshot id 39 (60 minutes): clean; 0 billing orders/events, 0 on-chain claims, 0 registration/recovery attempts, 0 risky admin actions, 0 incidents.

Production counters remain zero:
- Auth users: 0
- on-chain invoices: 0
- claims: 0
- observations: 0
- active on-chain prices: 0
- active receiving addresses: 0
- subscriptions: 0
- mainnet verifier profiles enabled: 0

Commercial runtime flags remain false:
- paid_checkout_enabled
- paid_entitlement_enabled
- public_registration_enabled
- recurring_billing_enabled
- refund_execution_enabled
- production_launch_authorized

Stable v78 root index blob SHA remains:
`4a278c891d37b3760ec1ac988690ea9ad587b24e`

Latest beta-contract GitHub commit before this checkpoint:
`0d6d834a274460870e809d88b1c57d4f680f14f6`

GitHub Actions for that commit completed successfully for Validate v79 Preview and Validate v79 Release Manifest Contract.

## Remaining external blockers

1. Testnet funding: test ETH/SOL/USDC and the two owner-signed 0.01 testnet-USDC transfers.
2. Dedicated production RPC secret values and TronGrid API key; failover contract is already deployed but secrets are not installed.
3. Turnstile site/secret keys.
4. Mail relay URL/publishable configuration and owned mailbox E2E.
5. Real operator/legal/contact/jurisdiction data and final legal review; commercial Refund draft still not active.
6. Owned Auth administrator account.
7. GitHub/Supabase owner 2FA verification.
8. Backup/PITR strategy plus a real off-site backup and isolated restore rehearsal.
9. Physical iPhone/Android PWA validation.
10. Separate owner authorization before any real beta invitations, real payments, public registration, BASIC/PRO activation, or v79 promotion over v78.
