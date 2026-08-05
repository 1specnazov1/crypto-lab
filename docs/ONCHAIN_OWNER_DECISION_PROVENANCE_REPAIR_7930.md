# CRYPTO LAB v79 — On-chain Owner Decision Provenance

Date: 2026-08-05  
Build: 7930  
Payment activation: disabled

## Confirmed owner decision

The user explicitly wrote:

> Три сети утверждаю.

The exact UTF-8 SHA-256 fingerprint is:

`57458fbfe9da805c8dc8bec7ad2d8500516ca4568c35903565402aed62d848be`

This approves the future payment network set:

- TRON / TRC20;
- BNB Smart Chain / BEP20;
- Solana / SPL.

It does not activate those networks, select USDT or USDC, approve the BSC pegged-token contract, set BASIC or PRO prices, configure receiving addresses, authorize real-value tests, enable checkout, or publish v79 over v78.

## Confirmed concurrency defect

Overlapping autonomous runs applied mutually contradictory migrations and repository evidence. Some runs used the exact user message; other already-running instances used stale context and repeatedly restored an incorrect `candidate-only` state.

The recurring autonomous cycle was paused to terminate the race. No user, email, wallet transfer, invoice, blockchain observation, payment or entitlement was created during the incident.

## Final authoritative repair

The final Supabase migration is:

`20260805095547_finalize_explicit_owner_three_network_selection_after_race`

Source:

`supabase/migrations/20260805095547_finalize_explicit_owner_three_network_selection_after_race.sql`

Source commit:

`2cc1e4eaee419c69533139eb6e615865aa9ea2d1`

The final repair:

- restores one active immutable record with the exact decision text and hash;
- records an append-only effective authority correction event;
- marks the stale candidate-only supersession as ineffective while preserving it for audit;
- sets TRON, BSC and Solana to `approved_by_owner=true`, `status=inactive`;
- installs CHECK constraints and trigger guards preventing silent approval removal or premature activation;
- fixes `PAYMENT_PROVIDER` at `in_progress` with the exact decision fingerprint;
- keeps the settlement asset, prices and receiving addresses unconfigured;
- keeps checkout, webhook, recurring debit, refunds and automatic entitlement disabled.

The original user-message timestamp is not reconstructed; it remains explicitly unknown. The exact text and hash are the authoritative source.

## Verified safe state

- approved networks: three;
- active networks: zero;
- selected settlement assets: zero;
- active prices: zero;
- receiving addresses: zero;
- invoices: zero;
- blockchain observations and transaction claims: zero;
- provider mode: disabled;
- provider lifecycle: draft;
- checkout, webhook, recurring debit and refunds: disabled;
- Auth users, profiles, registration attempts and recovery attempts: zero;
- automatic entitlement: prepared but inactive;
- v78 unchanged.

Integrity snapshots after the final migration:

- owner-decision integrity: 8/8 healthy;
- on-chain integrity: 11/11 healthy;
- data integrity: 45/45 healthy;
- launch-control integrity: 6/6 healthy.

## Remaining decisions and external inputs

Payment activation remains blocked until these are independently completed:

- USDT or USDC selection;
- separate acceptance and verification of the BSC pegged-USDT contract if USDT is selected;
- BASIC and PRO pricing;
- one public receiving address for each approved network;
- RPC/indexer configuration;
- WalletConnect project ID;
- controlled sandbox evidence;
- explicit payment activation approval.

Seed phrases, private keys and wallet passwords are never required.

## Preserved release boundaries

- stable v78 SHA: `4a278c891d37b3760ec1ac988690ea9ad587b24e`;
- public v79 application commit: `e1cbe2eb1cb9d97295ecfc9836d0f9bac9cfc191`;
- PWA cache: `crypto-lab-v79-7930-auth1`;
- publication of v79 over v78: not authorized.
