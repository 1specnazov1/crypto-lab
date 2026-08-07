# CRYPTO LAB v79 — launch points 1–4 checkpoint

Date: 2026-08-07
Build: 7930
Project: txhzxbizjpinowepfjkm

## Safety boundary

- Stable v78 remains unchanged.
- Public registration remains disabled.
- Paid checkout and paid entitlement remain disabled.
- Refund execution remains disabled.
- Recurring billing remains disabled.
- Production launch remains unauthorized.
- BASIC $20 and PRO $49 paid prices remain inactive.
- No real Auth user, admin, paid subscription, billing order/event, or on-chain claim has been created by this work.

## 1. Turnstile

Application integration is complete for registration and recovery with hostname/action validation and fail-closed readiness. Production keys are not installed. Required Edge Function Secrets:

- CRYPTO_TURNSTILE_SITE_KEY
- CRYPTO_TURNSTILE_SECRET_KEY

Public registration/recovery flags must remain false until separate launch authorization.

## 2. Mail

crypto-lab-mail-dispatch v5 supports direct Resend delivery with fixed versioned signup/recovery templates, action-link validation, service-role caller protection and idempotency. The legacy relay is fallback-only. Production/test-owner Resend secrets are not installed. Required Edge Function Secrets:

- RESEND_API_KEY
- CRYPTO_MAIL_FROM
- optional CRYPTO_MAIL_REPLY_TO

## 3. Real owner admin

One-time owner-only bootstrap is deployed. It does not create a synthetic user. The exact pre-authorized owner email can register in owner_bootstrap mode after Turnstile + mail + full legal set are ready, even while public registration is disabled. Email confirmation promotes that real account to the first admin and self-disables the bootstrap. 2FA remains an owner UI action after account creation.

Current state: auth users 0, admins 0, bootstrap authorized=true, consumed=false.

## Legal dependency

Registration requires the exact active set Terms + Privacy + Refund + Risk. Refund Policy v1 was owner-approved as policy content, but its recorded decision did not authorize publication. Refund remains inactive until a separate explicit publication authorization. Activating the legal document must not enable refund execution or payments.

## 4. Payment Sandbox E2E

Approved scope remains exactly:

- Ethereum Sepolia: 0.01 testnet USDC (10000 base units)
- Solana Devnet: 0.01 testnet USDC (10000 base units)

Fresh sender funding checks remain zero for native gas and Circle test USDC on both registered senders. The latest official Solana requestAirdrop retry returned HTTP 429. Circle public faucet is region-blocked on the owner UA network and must not be bypassed. Funding and owner wallet signatures remain external physical dependencies. Mainnet and real-value execution remain prohibited.

## CI / readiness

- PWA pwa2 contract: success.
- Preview Validation after current beta evidence: success, run 31197136254.
- Auth Launch Contract: success, run 31196704153.
- Supabase Security Advisor: 0 lints after bootstrap DDL.
- Closed beta: 23 scenarios, 14 passed offline, 9 blocked external, 0 failed; 460 checklist rows, 280 executed.
- Latest prelaunch monitor snapshot captured clean.

## Next resume condition

Resume immediately after external Turnstile/Resend secrets are installed and Refund publication is authorized, or after testnet funds appear on either registered sender. Re-query all readiness/balance state before any owner signing step.
