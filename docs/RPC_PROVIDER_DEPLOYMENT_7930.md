# CRYPTO LAB v79 — Production RPC Provider Deployment Contract

Status: PRELAUNCH / INACTIVE
Build: 7930
Date: 2026-08-07

This contract prepares production-grade read-only blockchain RPC access. It does **not** authorize real payments, receiving-address activation, registration, subscriptions, refunds, transaction signing, transaction broadcasting, or promotion of v79 over v78.

## Initial provider strategy

### Ethereum Mainnet — Alchemy private RPC

Use an owned Alchemy application and a private Ethereum Mainnet RPC URL.

Supabase Edge Secret:
`ETHEREUM_MAINNET_RPC_URL`

Expected network identity:
- `eth_chainId` = `0x1` / decimal `1`.

### Solana Mainnet — Alchemy private RPC

Use an owned Alchemy application and a private Solana Mainnet RPC URL.

Supabase Edge Secret:
`SOLANA_MAINNET_RPC_URL`

Expected network identity:
- `getHealth` = `ok`;
- `getGenesisHash` = `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.

### TRON Mainnet — official TronGrid

Endpoint:
`https://api.trongrid.io`

Supabase Edge Secrets:
- `TRON_MAINNET_RPC_URL`
- `TRONGRID_API_KEY`

The API key must be created in the owner's TronGrid account. It is an infrastructure credential only and must never contain or expose any wallet private key.

## Why this initial combination

Current official provider documentation checked on 2026-08-07 shows:
- Alchemy supports both Ethereum and Solana and provides a free tier suitable for initial low-volume deployment/testing, with private RPC URLs created from an owned account.
- TronGrid documents an API key as the normal production configuration for Mainnet and documents rate limits around keyed access.

Provider pricing/limits can change. Re-check them before scaling beyond early commercial traffic.

Primary provider references:
- https://www.alchemy.com/docs/reference/pricing-plans
- https://www.alchemy.com/rpc/ethereum
- https://www.alchemy.com/rpc/solana
- https://developers.tron.network/docs/trongrid
- https://developers.tron.network/reference/select-network
- https://developers.tron.network/reference/rate-limits

## Secret-handling rule

Never paste RPC URLs containing API keys, TronGrid API keys, wallet private keys, seed phrases, passwords, or bearer tokens into GitHub, client JavaScript, public Supabase tables, screenshots, or chat.

Install provider credentials directly as **Supabase Edge Secrets** under the exact names above.

## Health-check contract

Deployed Edge Function:
`crypto-lab-v79-mainnet-rpc-health`

Version:
`7930-mainnet-health1`

Controls:
- Supabase JWT required;
- admin role required;
- allowed browser origin restricted to the CRYPTO LAB GitHub Pages origin;
- no transaction creation;
- no signing;
- no broadcasting;
- no entitlement write;
- no receiving-address activation;
- no payment activation;
- only network identity/head/health reads.

Negative authentication test:
- request without JWT -> HTTP `401` (confirmed).

## Activation boundary

Even after all four secrets are installed and all three networks pass the health probe:
- `crypto_onchain_verifier_profiles.enabled` must remain `false` until a separate owner decision;
- real payment execution remains forbidden;
- receiving addresses remain inactive;
- BASIC/PRO remain inactive;
- v78 remains stable public root.

## Required owner/external action

1. Create/sign in to an owned Alchemy account.
2. Create Ethereum Mainnet and Solana Mainnet applications/endpoints.
3. Create/sign in to an owned TronGrid account and create an API key.
4. Install the four values directly into Supabase Edge Secrets.
5. Do not send the secret values in chat; only report that each named secret is installed.

After that, the autonomous workflow can run the admin-only health checks, validate identities and latency, record evidence, and keep all production activation switches OFF until separately authorized.
